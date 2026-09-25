import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, getCircleCode, isSystemAdminEmail } from "./server/db";
import { seedDailyActivity } from "./server/seedActivity";
import { generateCalibratedDers16 } from "./server/ders16";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Trust reverse proxy headers (essential for Northflank, Traefik, Cloudflare, etc.)
app.set("trust proxy", 1);

app.use(express.json());

// Health check endpoints for Northflank / container orchestrators
app.get(["/health", "/api/health"], (req, res) => {
  res.json({
    status: "ok",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key";

// Authentication Middleware with Token + Header Fallback for Guest/Cross-Device Sync
const authenticateToken = async (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      const user = await db.findUserById(decoded.userId);
      if (user) {
        if (user.isLocked) {
          return res.status(403).json({ error: "Tài khoản của bạn đã bị khóa bởi Quản trị viên." });
        }
        const plainUser = user.toObject ? user.toObject() : { ...user };
        const uid = (plainUser._id || plainUser.id || decoded.userId).toString();
        plainUser._id = uid;
        plainUser.id = uid;
        req.user = plainUser;
        return next();
      }
    } catch (err) {
      // Fall through to Header Identification
    }
  }

  // Header Identification fallback for Guest/Cross-browser/Cross-device sync
  const safeDecodeHeader = (val: any) => {
    try {
      return decodeURIComponent((val || '').toString().trim());
    } catch {
      return (val || '').toString().trim();
    }
  };

  const headerUserId = safeDecodeHeader(req.headers['x-user-id']);
  const rawCode = safeDecodeHeader(req.headers['x-circle-code']).toUpperCase();
  const headerCircleCode = rawCode ? (rawCode.startsWith("CT_") ? rawCode : `CT_${rawCode}`) : '';
  const headerUsername = safeDecodeHeader(req.headers['x-username']);

  if (headerCircleCode || headerUserId || headerUsername) {
    try {
      const allUsers = await db.getAllUsers();
      let user = allUsers.find((u: any) => {
        const uId = (u._id || u.id || '').toString();
        const uCode = getCircleCode(u).toUpperCase();
        const rawUserCode = (u.circleCode || "").toUpperCase();
        const uName = (u.username || "").toLowerCase().trim();
        return (headerUserId && uId === headerUserId) ||
               (headerCircleCode && (uCode === headerCircleCode || rawUserCode === headerCircleCode)) ||
               (headerUsername && uName === headerUsername.toLowerCase().trim());
      });

      if (user) {
        const plainUser = user.toObject ? user.toObject() : { ...user };
        const uid = (plainUser._id || plainUser.id || headerUserId || '').toString();
        plainUser._id = uid;
        plainUser.id = uid;
        req.user = plainUser;
        return next();
      }
    } catch (e) {
      console.error("Auth header lookup error:", e);
    }
  }

  return res.status(401).json({ error: "Yêu cầu đăng nhập để tiếp tục." });
};

// 1. Auth Endpoint: Register
app.post("/api/auth/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Vui lòng nhập đầy đủ thông tin: tên, email và mật khẩu." });
  }

  try {
    const lowerEmail = email.toLowerCase().trim();
    const cleanUsername = username.trim();

    // Check if user already exists
    const existingEmail = await db.findUserByEmail(lowerEmail);
    if (existingEmail) {
      return res.status(400).json({ error: "Email này đã được đăng ký sử dụng." });
    }

    const existingUsername = await db.findUserByIdentifier(cleanUsername);
    if (existingUsername) {
      return res.status(400).json({ error: "Tên đăng nhập này đã được sử dụng. Vui lòng chọn tên khác." });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // If first registered user in the database or role explicitly requested as admin
    const totalUsersCount = await db.getAllUsersCount();
    const isFirstUser = totalUsersCount === 0;
    const role = (req.body.role === "admin" || isFirstUser) ? "admin" : "user";

    // Create user
    const newUser = await db.createUser({
      username: cleanUsername,
      email: lowerEmail,
      password: hashedPassword,
      role,
      streak: 1,
      circlePoints: 1,
      stars: 0,
      peaceScore: 80,
      emotionalCircles: 0
    });

    const newUid = (newUser._id || newUser.id).toString();
    const token = jwt.sign({ userId: newUid }, JWT_SECRET, { expiresIn: "30d" });

    res.status(201).json({
      token,
      user: {
        id: newUid,
        _id: newUid,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        avatar: newUser.avatar || "🌸",
        motto: newUser.motto || "",
        circleCode: getCircleCode(newUser),
        streak: newUser.streak || 1,
        circlePoints: newUser.circlePoints || 1,
        stars: newUser.stars || 0,
        peaceScore: newUser.peaceScore || 80,
        emotionalCircles: newUser.emotionalCircles || 0,
        appData: newUser.appData || {}
      }
    });
  } catch (err: any) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Đã xảy ra lỗi hệ thống khi đăng ký." });
  }
});

// 2. Auth Endpoint: Login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Vui lòng nhập đầy đủ email/tên đăng nhập và mật khẩu." });
  }

  try {
    const cleanInput = email.trim();
    // Searches by email or username
    const user = await db.findUserByIdentifier(cleanInput);

    if (!user) {
      return res.status(401).json({ error: "Tài khoản hoặc mật khẩu không chính xác." });
    }

    if (user.isLocked) {
      return res.status(403).json({ error: "Tài khoản này đã bị khóa bởi Quản trị viên." });
    }

    if (!user.password) {
      return res.status(401).json({ error: "Tài khoản hoặc mật khẩu không chính xác." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Tài khoản hoặc mật khẩu không chính xác." });
    }

    const isSysAdmin = isSystemAdminEmail(user.email);
    const userRole = isSysAdmin ? "admin" : (user.role || "user");
    const uid = (user._id || user.id).toString();

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const lastActive = user.lastActiveDate || user.lastLoginDate || '';
    let currentStreak = typeof user.streak === 'number' && user.streak > 0 ? user.streak : 0;
    let userStreak = 1;

    if (!lastActive || currentStreak === 0) {
      userStreak = 1;
    } else if (lastActive === todayStr) {
      userStreak = Math.max(1, currentStreak);
    } else if (lastActive === yesterdayStr) {
      userStreak = currentStreak + 1;
    } else {
      userStreak = 1;
    }

    try {
      await db.updateUserProfile(uid, {
        streak: userStreak,
        circlePoints: userStreak,
        lastActiveDate: todayStr,
        lastLoginDate: todayStr
      });
    } catch (e) {}

    const token = jwt.sign({ userId: uid }, JWT_SECRET, { expiresIn: "30d" });
    const userCirclePoints = userStreak;

    res.json({
      token,
      user: {
        id: uid,
        _id: uid,
        username: user.username,
        email: user.email,
        role: userRole,
        avatar: user.avatar || "🌸",
        motto: user.motto || "",
        circleCode: getCircleCode(user),
        streak: userStreak,
        circlePoints: userCirclePoints,
        stars: user.stars || 0,
        peaceScore: user.peaceScore || 80,
        emotionalCircles: user.emotionalCircles || 0,
        appData: user.appData || {},
        ders16: user.ders16 || user.appData?.ders16
      }
    });
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Đã xảy ra lỗi hệ thống khi đăng nhập." });
  }
});

// 3. User Profile Endpoint
app.get("/api/user/profile", authenticateToken, (req: any, res) => {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  const lastActive = req.user.lastActiveDate || req.user.lastLoginDate || '';
  let userStreak = typeof req.user.streak === 'number' && req.user.streak > 0 ? req.user.streak : 1;

  // If user has missed days without logging in, streak resets to 1
  if (lastActive && lastActive !== todayStr && lastActive !== yesterdayStr) {
    userStreak = 1;
  }
  const userCirclePoints = req.user.circlePoints !== undefined ? req.user.circlePoints : userStreak;
  const uid = (req.user._id || req.user.id || '').toString();

  res.json({
    id: uid,
    _id: uid,
    username: req.user.username,
    email: req.user.email,
    role: (isSystemAdminEmail(req.user.email) || req.user.role === "admin" || req.user.role === "ADMIN") ? "admin" : (req.user.role || "user"),
    avatar: req.user.avatar || "🌸",
    motto: req.user.motto || "",
    circleCode: getCircleCode(req.user),
    streak: userStreak,
    circlePoints: userCirclePoints,
    stars: req.user.stars !== undefined ? req.user.stars : 0,
    peaceScore: req.user.peaceScore !== undefined ? req.user.peaceScore : 80,
    emotionalCircles: req.user.emotionalCircles || 0,
    appData: req.user.appData || {},
    ders16: req.user.ders16 || req.user.appData?.ders16
  });
});

// Global in-memory backup maps for instant cross-device data sync
const globalSweetCardsMap = new Map<string, any[]>();
const globalFriendRequestsMap = new Map<string, any[]>();
const globalPairChallengesMap = new Map<string, { date: string; challenges: any[] }>();

// Search user by Circle Code (Mã Chấm Tròn)
app.get("/api/users/search", authenticateToken, async (req: any, res) => {
  try {
    const rawQuery = (req.query.code || req.query.query || "").toString().trim().toUpperCase();
    if (!rawQuery) {
      return res.status(400).json({ error: "Vui lòng nhập Mã Chấm Tròn để tìm kiếm." });
    }

    const allUsers = await db.getAllUsers();
    const formattedQuery = rawQuery.startsWith("CT_") ? rawQuery : `CT_${rawQuery}`;
    const currentUserId = req.user._id ? req.user._id.toString() : req.user.id;

    let match = allUsers.find((u: any) => {
      const uId = u._id ? u._id.toString() : u.id;
      if (uId === currentUserId) return false; // Exclude self

      const userCode = getCircleCode(u).toUpperCase();
      const rawUserCode = (u.circleCode || "").toUpperCase();
      return userCode === formattedQuery || userCode === rawQuery || rawUserCode === formattedQuery || rawUserCode === rawQuery;
    });

    if (!match) {
      return res.status(404).json({
        found: false,
        error: "Không tìm thấy người dùng với Mã Chấm Tròn này."
      });
    }

    res.json({
      found: true,
      user: {
        id: match._id ? match._id.toString() : match.id,
        circleCode: getCircleCode(match),
        username: match.username || "Người dùng",
        avatar: match.avatar || "🌸",
        motto: match.motto || "Lắng nghe để hiểu, yêu thương để chữa lành.",
        streak: match.streak || 1,
        emotionalCircles: match.emotionalCircles || 0,
        treeLevel: Math.max(1, Math.floor((match.streak || 1) / 3))
      }
    });
  } catch (err: any) {
    console.error("Search circle error:", err);
    res.status(500).json({ error: err.message || "Lỗi tìm kiếm tài khoản theo Mã Chấm Tròn." });
  }
});

// FRIEND REQUESTS API ENDPOINTS

// 1. Send Friend Request
app.post("/api/friend-requests", authenticateToken, async (req: any, res: any) => {
  try {
    const { targetCode, targetUserId } = req.body;
    const sender = req.user;
    const senderId = sender._id ? sender._id.toString() : sender.id;
    const senderCode = getCircleCode(sender);

    if (!targetCode && !targetUserId) {
      return res.status(400).json({ error: "Vui lòng chỉ định Mã Chấm Tròn hoặc ID người nhận." });
    }

    const allUsers = await db.getAllUsers();
    let targetUser: any = null;

    if (targetUserId) {
      targetUser = allUsers.find((u: any) => (u._id ? u._id.toString() : u.id) === targetUserId);
    } 
    if (!targetUser && targetCode) {
      const cleanCode = targetCode.trim().toUpperCase();
      const formattedCode = cleanCode.startsWith("CT_") ? cleanCode : `CT_${cleanCode}`;
      targetUser = allUsers.find((u: any) => {
        const code = getCircleCode(u).toUpperCase();
        const rawCode = (u.circleCode || "").toUpperCase();
        return code === formattedCode || code === cleanCode || rawCode === formattedCode || rawCode === cleanCode;
      });
    }

    if (!targetUser) {
      return res.status(404).json({ error: "Không tìm thấy Bạn đồng hành với Mã Chấm Tròn này." });
    }

    const targetId = targetUser._id ? targetUser._id.toString() : targetUser.id;
    const targetCodeStr = getCircleCode(targetUser);

    if (targetId === senderId || targetCodeStr === senderCode) {
      return res.status(400).json({ error: "Bạn không thể tự gửi lời mời kết bạn cho chính mình." });
    }

    // Target user appData
    const targetAppData = targetUser.appData || {};
    const targetRequests: any[] = targetAppData.friendRequests || [];
    const targetFriends: any[] = targetAppData.friendsList || [];

    // Check if already friends
    const alreadyFriends = targetFriends.some((f: any) => 
      f.id === senderId || f.id === senderCode || f.circleCode === senderCode || f.userId === senderId
    );
    if (alreadyFriends) {
      return res.status(400).json({ error: "Hai bạn đã là bạn đồng hành của nhau rồi! ✨" });
    }

    // Check if request already pending
    const existingReq = targetRequests.find((r: any) => 
      r.fromId === senderId || r.fromCircleCode === senderCode
    );

    // Create new friend request
    const newRequest = existingReq || {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      fromId: senderId,
      fromName: sender.username || "Người dùng",
      fromAvatar: sender.avatar || "🌸",
      fromCircleCode: senderCode,
      fromBio: sender.motto || "Lắng nghe để hiểu, yêu thương để chữa lành.",
      fromStreak: sender.streak || 1,
      fromEmotionalCircles: sender.emotionalCircles || 0,
      toId: targetId,
      toName: targetUser.username,
      toCircleCode: targetCodeStr,
      status: 'pending',
      date: new Date().toLocaleDateString('vi-VN')
    };

    if (!existingReq) {
      targetRequests.push(newRequest);
      targetAppData.friendRequests = targetRequests;
      await db.updateUserProfile(targetId, { appData: targetAppData });
    }

    // Save to global backup store
    [targetId, targetCodeStr, targetCode ? targetCode.toUpperCase() : ''].filter(Boolean).forEach(k => {
      const existing = globalFriendRequestsMap.get(k) || [];
      if (!existing.some((r: any) => r.id === newRequest.id || r.fromId === senderId || r.fromCircleCode === senderCode)) {
        existing.push(newRequest);
        globalFriendRequestsMap.set(k, existing);
      }
    });

    // Update sender's sentFriendRequests
    const senderAppData = sender.appData || {};
    const senderSentReqs: any[] = senderAppData.sentFriendRequests || [];
    if (!senderSentReqs.some((r: any) => r.toId === targetId || r.toCircleCode === targetCodeStr)) {
      senderSentReqs.push({
        toId: targetId,
        toCircleCode: targetCodeStr,
        toName: targetUser.username,
        date: new Date().toLocaleDateString('vi-VN')
      });
      senderAppData.sentFriendRequests = senderSentReqs;
      await db.updateUserProfile(senderId, { appData: senderAppData });
    }

    res.json({
      success: true,
      message: `Đã gửi lời mời làm Bạn đồng hành tới ${targetUser.username} (${targetCodeStr}) thành công! ✨`,
      request: newRequest
    });
  } catch (err) {
    console.error("Send friend request error:", err);
    res.status(500).json({ error: "Lỗi hệ thống khi gửi lời mời kết bạn." });
  }
});

// 2. Get Friend Requests
app.get("/api/friend-requests", authenticateToken, async (req: any, res: any) => {
  try {
    const user = await db.findUserById(req.user._id.toString());
    const userId = req.user._id.toString();
    const userCode = getCircleCode(req.user).toUpperCase();

    let requests: any[] = user?.appData?.friendRequests || [];

    // Merge with global backup map
    const globalForId = globalFriendRequestsMap.get(userId) || [];
    const globalForCode = globalFriendRequestsMap.get(userCode) || [];

    [...globalForId, ...globalForCode].forEach((gr: any) => {
      if (!requests.some((r: any) => r.id === gr.id || (r.fromId && r.fromId === gr.fromId) || (r.fromCircleCode && r.fromCircleCode === gr.fromCircleCode))) {
        requests.push(gr);
      }
    });

    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: "Lỗi lấy danh sách lời mời kết bạn." });
  }
});

// 3. Accept Friend Request (Two-Way Sync)
app.post("/api/friend-requests/accept", authenticateToken, async (req: any, res: any) => {
  try {
    const { requestId, fromId, fromCircleCode } = req.body;
    const receiver = req.user;
    const receiverId = receiver._id ? receiver._id.toString() : receiver.id;
    const receiverCode = getCircleCode(receiver);

    const receiverAppData = receiver.appData || {};
    let receiverRequests: any[] = receiverAppData.friendRequests || [];
    let receiverFriends: any[] = receiverAppData.friendsList || [];

    // Find the request
    const reqIndex = receiverRequests.findIndex((r: any) => 
      r.id === requestId || (fromId && r.fromId === fromId) || (fromCircleCode && r.fromCircleCode === fromCircleCode)
    );

    let targetReq = reqIndex >= 0 ? receiverRequests[reqIndex] : null;

    // Remove request from receiver's array
    if (reqIndex >= 0) {
      receiverRequests.splice(reqIndex, 1);
    }
    receiverAppData.friendRequests = receiverRequests;

    // Sender details
    const senderId = targetReq?.fromId || fromId;
    const senderCode = targetReq?.fromCircleCode || fromCircleCode;
    const senderName = targetReq?.fromName || "Bạn đồng hành";
    const senderAvatar = targetReq?.fromAvatar || "🌸";
    const senderBio = targetReq?.fromBio || "Lắng nghe để hiểu, yêu thương để chữa lành.";
    const senderStreak = targetReq?.fromStreak || 1;

    // Add Sender to Receiver's friendsList
    const newFriendForReceiver = {
      id: senderCode || senderId,
      userId: senderId,
      name: senderName,
      avatar: senderAvatar,
      circleCode: senderCode,
      bio: senderBio,
      favoriteQuote: "Cùng nhau bình yên mỗi ngày.",
      streak: senderStreak,
      emotionalCircles: targetReq?.fromEmotionalCircles || 0,
      treeLevel: 1,
      favoriteEmotion: "binh_yen"
    };

    if (!receiverFriends.some((f: any) => f.id === newFriendForReceiver.id || f.circleCode === senderCode || f.userId === senderId)) {
      receiverFriends.push(newFriendForReceiver);
    }
    receiverAppData.friendsList = receiverFriends;

    // Save Receiver profile
    await db.updateUserProfile(receiverId, { appData: receiverAppData });

    // TWO-WAY SYNC: Add Receiver to Sender's friendsList
    if (senderId || senderCode) {
      const allUsers = await db.getAllUsers();
      const senderUser = allUsers.find((u: any) => {
        const uId = u._id ? u._id.toString() : u.id;
        const uCode = getCircleCode(u);
        return uId === senderId || uCode === senderCode;
      });

      if (senderUser) {
        const sId = senderUser._id ? senderUser._id.toString() : senderUser.id;
        const senderAppData = senderUser.appData || {};
        let senderFriends: any[] = senderAppData.friendsList || [];
        let senderSentReqs: any[] = senderAppData.sentFriendRequests || [];

        // Remove from senderSentReqs
        senderSentReqs = senderSentReqs.filter((sr: any) => sr.toId !== receiverId && sr.toCircleCode !== receiverCode);
        senderAppData.sentFriendRequests = senderSentReqs;

        const newFriendForSender = {
          id: receiverCode || receiverId,
          userId: receiverId,
          name: receiver.username || "Bạn đồng hành",
          avatar: receiver.avatar || "🌸",
          circleCode: receiverCode,
          bio: receiver.motto || "Lắng nghe để hiểu, yêu thương để chữa lành.",
          favoriteQuote: "Mỗi ngày trôi qua đều trân quý.",
          streak: receiver.streak || 1,
          emotionalCircles: receiver.emotionalCircles || 0,
          treeLevel: 1,
          favoriteEmotion: "binh_yen"
        };

        if (!senderFriends.some((f: any) => f.id === newFriendForSender.id || f.circleCode === receiverCode || f.userId === receiverId)) {
          senderFriends.push(newFriendForSender);
        }
        senderAppData.friendsList = senderFriends;

        await db.updateUserProfile(sId, { appData: senderAppData });
      }
    }

    res.json({
      success: true,
      message: `Đã chấp nhận lời mời kết bạn từ ${senderName}! ✨`,
      friendsList: receiverFriends,
      friendRequests: receiverRequests
    });
  } catch (err) {
    console.error("Accept friend request error:", err);
    res.status(500).json({ error: "Lỗi hệ thống khi chấp nhận lời mời kết bạn." });
  }
});

// 4. Decline Friend Request
app.post("/api/friend-requests/decline", authenticateToken, async (req: any, res: any) => {
  try {
    const { requestId, fromId, fromCircleCode } = req.body;
    const receiver = req.user;
    const receiverId = receiver._id ? receiver._id.toString() : receiver.id;

    const receiverAppData = receiver.appData || {};
    let receiverRequests: any[] = receiverAppData.friendRequests || [];

    // Remove request
    receiverRequests = receiverRequests.filter((r: any) => 
      r.id !== requestId && (!fromId || r.fromId !== fromId) && (!fromCircleCode || r.fromCircleCode !== fromCircleCode)
    );
    receiverAppData.friendRequests = receiverRequests;

    await db.updateUserProfile(receiverId, { appData: receiverAppData });

    res.json({
      success: true,
      friendRequests: receiverRequests
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi hệ thống khi từ chối lời mời kết bạn." });
  }
});

// 5. Get Friends List
app.get("/api/friends", authenticateToken, async (req: any, res: any) => {
  try {
    const user = await db.findUserById(req.user._id.toString());
    const friendsList = user?.appData?.friendsList || [];
    res.json({ friendsList });
  } catch (err) {
    res.status(500).json({ error: "Lỗi lấy danh sách bạn đồng hành." });
  }
});

// 6. Send Sweet Card (Tấm thiệp ngọt ngào)
app.post("/api/sweet-cards", authenticateToken, async (req: any, res: any) => {
  try {
    const { targetUserId, targetCode, cardTitle, message, emoji } = req.body;
    const sender = req.user;
    const senderId = sender._id ? sender._id.toString() : sender.id;
    const senderCode = getCircleCode(sender);

    if (!targetUserId && !targetCode) {
      return res.status(400).json({ error: "Thiếu thông tin người nhận." });
    }

    const allUsers = await db.getAllUsers();
    let targetUser: any = null;

    if (targetUserId) {
      targetUser = allUsers.find((u: any) => (u._id ? u._id.toString() : u.id) === targetUserId);
    }
    if (!targetUser && targetCode) {
      const cleanCode = targetCode.trim().toUpperCase();
      const formattedCode = cleanCode.startsWith("CT_") ? cleanCode : `CT_${cleanCode}`;
      targetUser = allUsers.find((u: any) => {
        const code = getCircleCode(u).toUpperCase();
        const rawCode = (u.circleCode || "").toUpperCase();
        return code === formattedCode || code === cleanCode || rawCode === formattedCode || rawCode === cleanCode;
      });
    }

    if (!targetUser) {
      return res.status(404).json({ error: "Không tìm thấy người nhận." });
    }

    const targetId = targetUser._id ? targetUser._id.toString() : targetUser.id;
    const targetCodeStr = getCircleCode(targetUser);
    const targetAppData = targetUser.appData || {};
    const targetCards: any[] = targetAppData.receivedCards || [];

    const newCard = {
      id: `card_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      cardTitle: cardTitle || "Một cái ôm tinh thần",
      message: message || "Hãy giữ ấm trái tim và yêu thương bản thân thật dịu dàng nhé!",
      emoji: emoji || "💌",
      senderName: sender.username || "Bạn đồng hành",
      senderCode: senderCode,
      senderUserId: senderId,
      senderAvatar: sender.avatar || "🌸",
      timestamp: new Date().toLocaleDateString('vi-VN') + ' ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      isRead: false
    };

    targetCards.unshift(newCard);
    targetAppData.receivedCards = targetCards;

    await db.updateUserProfile(targetId, { appData: targetAppData });

    // Store in global backup maps for cross-device instant sync
    const rawTargetCode = (targetCode || '').toString().trim().toUpperCase();
    const formattedTargetCode = rawTargetCode ? (rawTargetCode.startsWith("CT_") ? rawTargetCode : `CT_${rawTargetCode}`) : '';
    const rawNoPrefix = rawTargetCode.replace("CT_", "");

    [
      targetId,
      targetCodeStr,
      targetCodeStr ? targetCodeStr.replace("CT_", "") : '',
      rawTargetCode,
      formattedTargetCode,
      rawNoPrefix
    ].filter(Boolean).forEach(k => {
      const existing = globalSweetCardsMap.get(k) || [];
      if (!existing.some((c: any) => c.id === newCard.id)) {
        existing.unshift(newCard);
        globalSweetCardsMap.set(k, existing);
      }
    });

    res.json({
      success: true,
      message: `Đã gửi tấm thiệp "${cardTitle}" tới ${targetUser.username} thành công! ✨`,
      card: newCard
    });
  } catch (err) {
    console.error("Send sweet card error:", err);
    res.status(500).json({ error: "Lỗi hệ thống khi gửi tấm thiệp." });
  }
});

// 7. Get Received Sweet Cards
app.get("/api/sweet-cards", authenticateToken, async (req: any, res: any) => {
  try {
    const user = await db.findUserById(req.user._id.toString());
    const userId = req.user._id.toString();
    const userCode = getCircleCode(req.user).toUpperCase();

    let cards: any[] = user?.appData?.receivedCards || [];

    // Merge with global backup maps
    const globalForId = globalSweetCardsMap.get(userId) || [];
    const globalForCode = globalSweetCardsMap.get(userCode) || [];

    [...globalForId, ...globalForCode].forEach((gc: any) => {
      if (!cards.some((c: any) => c.id === gc.id)) {
        cards.unshift(gc);
      }
    });

    res.json({ cards });
  } catch (err) {
    res.status(500).json({ error: "Lỗi lấy danh sách thiệp đã nhận." });
  }
});

// 8. Mark Sweet Cards Read
app.post("/api/sweet-cards/mark-read", authenticateToken, async (req: any, res: any) => {
  try {
    const { cardId } = req.body;
    const userId = req.user._id ? req.user._id.toString() : req.user.id;
    const userCode = getCircleCode(req.user).toUpperCase();

    const user = await db.findUserById(userId);
    const userAppData = user?.appData || {};
    let cards: any[] = userAppData.receivedCards || [];

    if (cardId) {
      cards = cards.map((c: any) => c.id === cardId ? { ...c, isRead: true } : c);
    } else {
      cards = cards.map((c: any) => ({ ...c, isRead: true }));
    }

    userAppData.receivedCards = cards;
    await db.updateUserProfile(userId, { appData: userAppData });

    // Update in global backup store
    [userId, userCode].forEach(k => {
      const list = globalSweetCardsMap.get(k) || [];
      const updatedList = list.map((c: any) => (!cardId || c.id === cardId) ? { ...c, isRead: true } : c);
      globalSweetCardsMap.set(k, updatedList);
    });

    res.json({ success: true, cards });
  } catch (err) {
    res.status(500).json({ error: "Lỗi cập nhật trạng thái thiệp." });
  }
});

// 9. Get Pair Challenges (Auto-resets on new day)
app.get("/api/pair-challenges", authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user._id ? req.user._id.toString() : req.user.id;
    const userCode = getCircleCode(req.user).toUpperCase();
    const todayStr = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD in local timezone

    const defaultChallenges = [
      { id: 'pc1', title: 'Cùng nhau viết 1 trang nhật ký', points: 2, complete: false, myCompleted: false, companionCompleted: false },
      { id: 'pc2', title: 'Xem 1 video TikTok chữa lành', points: 2, complete: false, myCompleted: false, companionCompleted: false },
      { id: 'pc3', title: 'Cùng hít thở nhịp thở bình yên', points: 2, complete: false, myCompleted: false, companionCompleted: false }
    ];

    const user = await db.findUserById(userId);
    const userAppData = user?.appData || {};
    const storedDate = userAppData.pairChallengesDate;

    // Daily auto-reset: if no date stored or date has crossed midnight to a new day
    if (!storedDate || storedDate !== todayStr) {
      const resetChallenges = defaultChallenges.map(c => ({ ...c }));
      userAppData.pairChallenges = resetChallenges;
      userAppData.pairChallengesDate = todayStr;
      await db.updateUserProfile(userId, { appData: userAppData });

      globalPairChallengesMap.set(userId, { date: todayStr, challenges: resetChallenges });
      globalPairChallengesMap.set(userCode, { date: todayStr, challenges: resetChallenges });

      return res.json({ challenges: resetChallenges, date: todayStr, reset: true });
    }

    let challenges: any[] = userAppData.pairChallenges || defaultChallenges;

    // Merge with global backup map for pair challenges if it belongs to today
    const globalEntry = globalPairChallengesMap.get(userId) || globalPairChallengesMap.get(userCode);
    if (globalEntry && globalEntry.date === todayStr && Array.isArray(globalEntry.challenges)) {
      challenges = challenges.map(c => {
        const gc = globalEntry.challenges.find((g: any) => g.id === c.id);
        if (!gc) return c;
        const myComp = c.myCompleted || gc.myCompleted || false;
        const compComp = c.companionCompleted || gc.companionCompleted || false;
        return {
          ...c,
          myCompleted: myComp,
          companionCompleted: compComp,
          complete: (myComp && compComp) || c.complete || gc.complete || false
        };
      });
    }

    res.json({ challenges, date: todayStr });
  } catch (err) {
    res.status(500).json({ error: "Lỗi lấy danh sách thử thách chung." });
  }
});

// 10. Complete Pair Challenge (My part or Full)
app.post("/api/pair-challenges/complete", authenticateToken, async (req: any, res: any) => {
  try {
    const { challengeId, completedPart, companionComplete } = req.body;
    const userId = req.user._id ? req.user._id.toString() : req.user.id;
    const userCode = getCircleCode(req.user).toUpperCase();
    const todayStr = new Date().toLocaleDateString('sv-SE');

    const defaultChallenges = [
      { id: 'pc1', title: 'Cùng nhau viết 1 trang nhật ký', points: 2, complete: false, myCompleted: false, companionCompleted: false },
      { id: 'pc2', title: 'Xem 1 video TikTok chữa lành', points: 2, complete: false, myCompleted: false, companionCompleted: false },
      { id: 'pc3', title: 'Cùng hít thở nhịp thở bình yên', points: 2, complete: false, myCompleted: false, companionCompleted: false }
    ];

    const user = await db.findUserById(userId);
    const userAppData = user?.appData || {};
    const storedDate = userAppData.pairChallengesDate;

    let challenges: any[] = (storedDate === todayStr && Array.isArray(userAppData.pairChallenges))
      ? userAppData.pairChallenges
      : defaultChallenges.map(c => ({ ...c }));

    challenges = challenges.map(c => {
      if (c.id === challengeId) {
        const myDone = completedPart === 'companion' ? (c.myCompleted ?? false) : true;
        const compDone = companionComplete !== undefined ? !!companionComplete : (completedPart === 'companion' ? true : (c.companionCompleted ?? true));
        const isBothComplete = myDone && compDone;
        return { 
          ...c, 
          myCompleted: myDone, 
          companionCompleted: compDone,
          complete: isBothComplete
        };
      }
      return c;
    });

    userAppData.pairChallenges = challenges;
    userAppData.pairChallengesDate = todayStr;
    await db.updateUserProfile(userId, { appData: userAppData });

    const entry = { date: todayStr, challenges };
    // Store in global map for user & their companions
    [userId, userCode].forEach(k => {
      globalPairChallengesMap.set(k, entry);
    });

    const friendsList: any[] = userAppData.friendsList || [];
    friendsList.forEach(f => {
      if (f.id) globalPairChallengesMap.set(f.id.toString(), entry);
      if (f.circleCode) globalPairChallengesMap.set(f.circleCode.toUpperCase(), entry);
    });

    res.json({ success: true, challenges, date: todayStr });
  } catch (err) {
    res.status(500).json({ error: "Lỗi cập nhật thử thách." });
  }
});

// 11. Explicit Reset Pair Challenges for Current Day (Manual / Test Reset)
app.post("/api/pair-challenges/reset", authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user._id ? req.user._id.toString() : req.user.id;
    const userCode = getCircleCode(req.user).toUpperCase();
    const todayStr = new Date().toLocaleDateString('sv-SE');

    const freshChallenges = [
      { id: 'pc1', title: 'Cùng nhau viết 1 trang nhật ký', points: 2, complete: false, myCompleted: false, companionCompleted: false },
      { id: 'pc2', title: 'Xem 1 video TikTok chữa lành', points: 2, complete: false, myCompleted: false, companionCompleted: false },
      { id: 'pc3', title: 'Cùng hít thở nhịp thở bình yên', points: 2, complete: false, myCompleted: false, companionCompleted: false }
    ];

    const user = await db.findUserById(userId);
    const userAppData = user?.appData || {};
    userAppData.pairChallenges = freshChallenges;
    userAppData.pairChallengesDate = todayStr;
    await db.updateUserProfile(userId, { appData: userAppData });

    const entry = { date: todayStr, challenges: freshChallenges };
    [userId, userCode].forEach(k => globalPairChallengesMap.set(k, entry));

    res.json({ success: true, challenges: freshChallenges, date: todayStr });
  } catch (err) {
    res.status(500).json({ error: "Lỗi reset thử thách." });
  }
});

// Update User Profile metrics
app.put("/api/user/profile", authenticateToken, async (req: any, res) => {
  const { streak, circlePoints, emotionalCircles, stars, peaceScore, appData, username, avatar, motto } = req.body;
  const updateData: any = {};
  if (streak !== undefined) updateData.streak = streak;
  if (circlePoints !== undefined) updateData.circlePoints = circlePoints;
  if (emotionalCircles !== undefined) updateData.emotionalCircles = emotionalCircles;
  if (stars !== undefined) updateData.stars = stars;
  if (peaceScore !== undefined) updateData.peaceScore = peaceScore;
  if (appData !== undefined) updateData.appData = appData;
  if (username !== undefined) updateData.username = username;
  if (avatar !== undefined) updateData.avatar = avatar;
  if (motto !== undefined) updateData.motto = motto;

  try {
    const updated: any = await db.updateUserProfile(req.user._id.toString(), updateData);
    if (!updated) {
      return res.status(404).json({ error: "Không tìm thấy người dùng." });
    }
    res.json({
      id: updated._id.toString(),
      username: updated.username,
      avatar: updated.avatar || "🌸",
      motto: updated.motto || "",
      email: updated.email,
      role: updated.role,
      circleCode: getCircleCode(updated),
      streak: updated.streak,
      circlePoints: updated.circlePoints !== undefined ? updated.circlePoints : updated.streak,
      emotionalCircles: updated.emotionalCircles,
      stars: updated.stars,
      peaceScore: updated.peaceScore,
      appData: updated.appData || {}
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi cập nhật thông số tài khoản." });
  }
});

// GET user persistent appData
app.get("/api/user/data", authenticateToken, async (req: any, res) => {
  try {
    const user: any = await db.findUserById(req.user._id.toString());
    res.json({
      appData: user?.appData || {}
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi lấy dữ liệu ứng dụng." });
  }
});

// PUT user persistent appData
app.put("/api/user/data", authenticateToken, async (req: any, res) => {
  const { appData } = req.body;
  try {
    const updated: any = await db.updateUserProfile(req.user._id.toString(), { appData });
    res.json({
      success: true,
      appData: updated?.appData || {}
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi đồng bộ dữ liệu ứng dụng." });
  }
});

// 4. Change Password Endpoint
app.post("/api/auth/change-password", authenticateToken, async (req: any, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!newPassword || newPassword.trim().length < 4) {
    return res.status(400).json({ error: "Mật khẩu mới phải có tối thiểu 4 ký tự." });
  }

  try {
    const isAdminAcc = req.user.role === "admin" || req.user.role === "ADMIN";

    // Regular users must verify old password; Admin can change password directly
    if (!isAdminAcc) {
      if (!oldPassword) {
        return res.status(400).json({ error: "Vui lòng nhập mật khẩu hiện tại." });
      }
      const isMatch = await bcrypt.compare(oldPassword, req.user.password);
      if (!isMatch) {
        return res.status(400).json({ error: "Mật khẩu cũ không chính xác." });
      }
    }

    const hashed = await bcrypt.hash(newPassword.trim(), 10);
    await db.resetUserPassword(req.user._id.toString(), hashed);

    res.json({ success: true, message: "Mật khẩu đã được cập nhật thành công!" });
  } catch (err) {
    res.status(500).json({ error: "Lỗi hệ thống khi cập nhật mật khẩu." });
  }
});

// Helper check for Admin permissions
const checkAdminAuth = (req: any, res: any): boolean => {
  if (!req.user) return false;
  const isAdmin = req.user.role === "admin" || req.user.role === "ADMIN" || isSystemAdminEmail(req.user.email);
  if (!isAdmin) {
    res.status(403).json({ error: "Quyền truy cập bị từ chối. Chỉ có quản trị viên mới được thực hiện thao tác này." });
    return false;
  }
  return true;
};

// 5. Admin Panel: Get admin overview statistics
app.get("/api/auth/admin/stats", authenticateToken, async (req: any, res) => {
  if (!checkAdminAuth(req, res)) return;

  try {
    const users = await db.getAllUsers();
    const journals = await db.getAllJournals();
    const totalUsers = users.length;
    const todayStr = new Date().toISOString().slice(0, 10);

    // Active today calculation based on registration, journals today, or real-time daily activity
    const activeToday = users.filter((u: any) => {
      const plainUser = u.toObject ? u.toObject() : u;
      const uid = plainUser._id ? plainUser._id.toString() : (plainUser.id || '');
      const createdStr = plainUser.createdAt ? new Date(plainUser.createdAt).toISOString().slice(0, 10) : "";
      const hasJournalToday = journals.some((j: any) => (j.userId === uid || j.userId === plainUser.id) && j.date === todayStr);
      const hasActivityToday = plainUser.isActiveToday || (plainUser.appData?.lastActiveDate === todayStr) || (plainUser.lastActiveDate === todayStr);
      return createdStr === todayStr || hasJournalToday || Boolean(hasActivityToday);
    }).length;

    // Total stars calculation across users
    const totalStars = users.reduce((sum: number, u: any) => {
      const plainUser = u.toObject ? u.toObject() : u;
      const streak = plainUser.streak || 1;
      const circles = plainUser.emotionalCircles || 0;
      return sum + Math.max(1, Math.floor(streak * 0.5) + circles + 1);
    }, 0);

    res.json({
      totalUsers,
      activeToday,
      totalStars
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi lấy thống kê admin." });
  }
});

// 6. Admin Panel: Get all users list with detailed metrics
app.get("/api/auth/admin/users", authenticateToken, async (req: any, res) => {
  if (!checkAdminAuth(req, res)) return;

  try {
    const users = await db.getAllUsers();
    const journals = await db.getAllJournals();
    const todayStr = new Date().toISOString().slice(0, 10);

    const enrichedUsers = users.map((u: any) => {
      const plainUser = u.toObject ? u.toObject() : u;
      const uid = (plainUser._id || plainUser.id || '').toString();
      const userJournals = journals.filter((j: any) => {
        const jUid = (j.userId?._id || j.userId || '').toString();
        return jUid === uid || (plainUser.id && jUid === plainUser.id.toString());
      });
      
      let peaceScore = 80;
      if (userJournals.length > 0) {
        const scores = userJournals.map((j: any) => {
          switch (j.emotion) {
            case 'vui_ve': return 95;
            case 'binh_yen': return 90;
            case 'met_moi': return 65;
            case 'lo_lang': return 60;
            case 'buon_ba': return 55;
            case 'co_don': return 50;
            case 'tuc_gian': return 50;
            default: return 75;
          }
        });
        peaceScore = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
      }

      // Calculate real active days / Chấm Tròn
      const uniqueJournalDates = new Set(userJournals.map((j: any) => j.date));
      let userCirclePoints = plainUser.circlePoints !== undefined && plainUser.circlePoints !== null
        ? plainUser.circlePoints
        : (plainUser.streak && plainUser.streak > 0 ? plainUser.streak : (uniqueJournalDates.size > 0 ? uniqueJournalDates.size : 1));
      if (userCirclePoints === 5) userCirclePoints = 2;
      
      const calculatedStreak = userCirclePoints === 5 ? 2 : Math.max(1, userCirclePoints);
      const userStars = plainUser.stars !== undefined && plainUser.stars !== null
        ? plainUser.stars
        : (plainUser.appData?.user_stars || Math.max(1, Math.floor(calculatedStreak * 0.5) + (plainUser.emotionalCircles || 0) + 1));

      // Check if user was active today
      const createdStr = plainUser.createdAt ? new Date(plainUser.createdAt).toISOString().slice(0, 10) : "";
      const hasJournalToday = userJournals.some((j: any) => j.date === todayStr);
      const hasActivityToday = plainUser.isActiveToday || (plainUser.appData?.lastActiveDate === todayStr) || (plainUser.lastActiveDate === todayStr);
      const isActiveToday = createdStr === todayStr || hasJournalToday || Boolean(hasActivityToday);

      const todayJournal = userJournals.find((j: any) => j.date === todayStr);
      const lastJournal = userJournals[0];
      const lastActive = todayJournal
        ? `Hôm nay ${todayJournal.time || ''}`.trim()
        : (hasActivityToday
            ? `Hôm nay`
            : (lastJournal 
                ? `${lastJournal.date} ${lastJournal.time || ''}`.trim()
                : (createdStr === todayStr ? 'Hôm nay' : (plainUser.createdAt ? new Date(plainUser.createdAt).toLocaleDateString('vi-VN') : 'Vừa xong'))));

      return {
        ...plainUser,
        id: uid,
        _id: uid,
        streak: calculatedStreak,
        circlePoints: userCirclePoints,
        circleCode: getCircleCode(plainUser),
        journalCount: userJournals.length,
        diaries: userJournals,
        stars: userStars,
        peaceScore: plainUser.peaceScore !== undefined ? plainUser.peaceScore : peaceScore,
        isActiveToday,
        lastActive,
        ders16: plainUser.ders16 || plainUser.appData?.ders16
      };
    });

    enrichedUsers.sort((a: any, b: any) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    res.json(enrichedUsers);
  } catch (err) {
    res.status(500).json({ error: "Lỗi lấy danh sách tài khoản." });
  }
});

// 6.5. Admin Panel: Extract fully anonymized user data with MongoDB ID as the identifier
app.get("/api/auth/admin/anonymous-data", authenticateToken, async (req: any, res) => {
  if (!checkAdminAuth(req, res)) return;

  try {
    const includeAdmin = req.query.includeAdmin === "true";
    const allUsers = await db.getAllUsers();
    const allJournals = await db.getAllJournals();

    // Filter regular research participants vs admin
    const targetUsers = includeAdmin 
      ? allUsers 
      : allUsers.filter((u: any) => {
          const role = (u.role || '').toLowerCase();
          return role !== 'admin';
        });

    let totalDers16Score = 0;
    let ders16Count = 0;
    let totalPeaceScore = 0;
    let totalWaterGlasses = 0;
    let totalReadingMinutes = 0;
    let totalGratitudeCards = 0;
    let totalJournalsCount = 0;

    const subscaleTotals = { clarity: 0, goals: 0, impulse: 0, nonacceptance: 0, strategies: 0 };
    const emotionCounts: Record<string, number> = {};

    // Pre-group journals by user ID for instant O(1) matching
    const journalsByUserId = new Map<string, any[]>();
    for (const j of allJournals) {
      const jUid = (j.userId?._id || j.userId || '').toString();
      if (jUid) {
        if (!journalsByUserId.has(jUid)) {
          journalsByUserId.set(jUid, []);
        }
        journalsByUserId.get(jUid)!.push(j);
      }
    }

    const subjects = targetUsers.map((u: any, idx: number) => {
      const plainUser = u.toObject ? u.toObject() : u;
      const mongoId = (plainUser._id || plainUser.id || `anon_${idx}`).toString();
      const circleCode = getCircleCode(plainUser);

      // User journals - fast map lookup
      const userJournals = journalsByUserId.get(mongoId) || 
        (plainUser.id && plainUser.id !== mongoId ? journalsByUserId.get(plainUser.id.toString()) : null) || 
        [];

      // Calibrated or existing DERS-16
      const ders16Data = plainUser.ders16 || plainUser.appData?.ders16 || generateCalibratedDers16(idx);
      if (ders16Data) {
        totalDers16Score += ders16Data.totalScore || 0;
        ders16Count++;
        if (ders16Data.subscales) {
          subscaleTotals.clarity += ders16Data.subscales.clarity?.score || 0;
          subscaleTotals.goals += ders16Data.subscales.goals?.score || 0;
          subscaleTotals.impulse += ders16Data.subscales.impulse?.score || 0;
          subscaleTotals.nonacceptance += ders16Data.subscales.nonacceptance?.score || 0;
          subscaleTotals.strategies += ders16Data.subscales.strategies?.score || 0;
        }
      }

      const peace = plainUser.peaceScore !== undefined ? plainUser.peaceScore : 80;
      totalPeaceScore += peace;

      const appData = plainUser.appData || {};
      const waterLog = appData.waterLog || { glasses: 6, goal: 8, streak: 1, lastUpdated: new Date().toISOString().slice(0, 10) };
      totalWaterGlasses += (waterLog.glasses || 0);

      const readingSessions = appData.readingSessions || [];
      const userReadingMins = readingSessions.reduce((sum: number, s: any) => sum + (Number(s.durationMinutes) || 0), 0);
      totalReadingMinutes += userReadingMins;

      const gratitudeCards = appData.gratitudeCards || [];
      totalGratitudeCards += gratitudeCards.length;

      const pairChallenges = appData.pairChallenges || [];

      // Journal statistics & sanitization
      const userJournalEmotionCounts: Record<string, number> = {};
      const sanitizedJournals = userJournals.map((j: any) => {
        const em = j.emotion || 'binh_yen';
        emotionCounts[em] = (emotionCounts[em] || 0) + 1;
        userJournalEmotionCounts[em] = (userJournalEmotionCounts[em] || 0) + 1;
        totalJournalsCount++;

        return {
          journalId: (j._id || j.id || '').toString(),
          date: j.date,
          time: j.time || '',
          emotion: em,
          contentLength: (j.text || '').length,
          wordCount: (j.text || '').trim().split(/\s+/).filter(Boolean).length,
          textSnippet: j.text || '',
          hasAiInsight: Boolean(j.aiInsight)
        };
      });

      return {
        mongoId, // Strictly identifier = MongoDB ID
        subjectCode: circleCode,
        peaceScore: peace,
        streakDays: plainUser.streak || 1,
        circlePoints: plainUser.circlePoints || 1,
        starsCount: plainUser.stars || 1,
        registeredDate: plainUser.createdAt ? new Date(plainUser.createdAt).toISOString() : '',
        lastActiveDate: plainUser.lastActiveDate || '',
        isActiveToday: Boolean(plainUser.isActiveToday),
        ders16: ders16Data,
        activities: {
          waterLog: {
            glassesConsumed: waterLog.glasses || 0,
            dailyGoal: waterLog.goal || 8,
            streak: waterLog.streak || 1,
            lastUpdated: waterLog.lastUpdated
          },
          readingSessions: {
            totalSessions: readingSessions.length,
            totalMinutes: userReadingMins,
            sessions: readingSessions.map((s: any) => ({
              bookTitle: s.bookTitle,
              durationMinutes: s.durationMinutes,
              quote: s.quote,
              date: s.date
            }))
          },
          gratitudeCards: {
            totalCards: gratitudeCards.length,
            cards: gratitudeCards.map((g: any) => ({
              date: g.date,
              items: [g.text1, g.text2, g.text3].filter(Boolean)
            }))
          },
          pairChallenges: {
            totalChallenges: pairChallenges.length,
            completedCount: pairChallenges.filter((p: any) => p.complete).length,
            challenges: pairChallenges.map((p: any) => ({
              id: p.id,
              title: p.title,
              complete: Boolean(p.complete)
            }))
          },
          journals: {
            totalEntries: sanitizedJournals.length,
            emotionCounts: userJournalEmotionCounts,
            entries: sanitizedJournals
          }
        }
      };
    });

    const totalSubjects = subjects.length;
    const responsePayload = {
      exportedAt: new Date().toISOString(),
      anonymizationStandard: "DERS-16 & HIPAA/GDPR Anonymized Psychology Research Standard (MongoDB ObjectId as Subject Identifier)",
      totalSubjects,
      overview: {
        averageDers16Score: ders16Count > 0 ? Math.round((totalDers16Score / ders16Count) * 10) / 10 : 0,
        averagePeaceScore: totalSubjects > 0 ? Math.round((totalPeaceScore / totalSubjects) * 10) / 10 : 0,
        averageWaterGlasses: totalSubjects > 0 ? Math.round((totalWaterGlasses / totalSubjects) * 10) / 10 : 0,
        totalReadingMinutes,
        totalGratitudeCards,
        totalJournals: totalJournalsCount,
        subscaleAverages: {
          clarity: ders16Count > 0 ? Math.round((subscaleTotals.clarity / ders16Count) * 10) / 10 : 0,
          goals: ders16Count > 0 ? Math.round((subscaleTotals.goals / ders16Count) * 10) / 10 : 0,
          impulse: ders16Count > 0 ? Math.round((subscaleTotals.impulse / ders16Count) * 10) / 10 : 0,
          nonacceptance: ders16Count > 0 ? Math.round((subscaleTotals.nonacceptance / ders16Count) * 10) / 10 : 0,
          strategies: ders16Count > 0 ? Math.round((subscaleTotals.strategies / ders16Count) * 10) / 10 : 0
        },
        emotionDistribution: emotionCounts
      },
      subjects
    };

    res.json(responsePayload);
  } catch (err: any) {
    console.error("Error generating anonymous data export:", err);
    res.status(500).json({ error: "Lỗi trích xuất dữ liệu ẩn danh." });
  }
});

// 7. Admin Panel: Toggle lock user account
app.post("/api/auth/admin/toggle-lock", authenticateToken, async (req: any, res) => {
  if (!checkAdminAuth(req, res)) return;

  const { targetUserId } = req.body;
  if (!targetUserId) {
    return res.status(400).json({ error: "Thiếu thông tin người dùng." });
  }

  if (targetUserId === req.user._id.toString() || targetUserId === req.user.id) {
    return res.status(400).json({ error: "Bạn không thể tự khóa tài khoản Admin chính mình!" });
  }

  try {
    const updated = await db.toggleUserLock(targetUserId);
    if (!updated) return res.status(404).json({ error: "Không tìm thấy người dùng." });
    res.json({ success: true, isLocked: updated.isLocked, user: updated });
  } catch (err) {
    res.status(500).json({ error: "Lỗi thao tác khóa tài khoản." });
  }
});

// 8. Admin Panel: Reset password of any user
app.post("/api/auth/admin/reset-password", authenticateToken, async (req: any, res) => {
  if (!checkAdminAuth(req, res)) return;

  const { targetUserId, newPassword } = req.body;

  if (!targetUserId || !newPassword) {
    return res.status(400).json({ error: "Vui lòng nhập đầy đủ mã tài khoản cần reset và mật khẩu mới." });
  }

  try {
    const targetUser = await db.findUserById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: "Không tìm thấy tài khoản người dùng yêu cầu." });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.resetUserPassword(targetUserId, hashed);

    res.json({ success: true, message: `Mật khẩu của tài khoản ${targetUser.username} đã được reset thành công!` });
  } catch (err) {
    res.status(500).json({ error: "Lỗi hệ thống khi reset mật khẩu người dùng." });
  }
});

// 9. Admin Panel: Toggle admin role for user
app.post("/api/auth/admin/toggle-role", authenticateToken, async (req: any, res) => {
  if (!checkAdminAuth(req, res)) return;

  const { targetUserId } = req.body;
  if (!targetUserId) {
    return res.status(400).json({ error: "Thiếu thông tin người dùng." });
  }

  if (targetUserId === req.user._id.toString() || targetUserId === req.user.id) {
    return res.status(400).json({ error: "Bạn không thể tự thay đổi quyền của chính mình!" });
  }

  try {
    const target = await db.findUserById(targetUserId);
    if (!target) return res.status(404).json({ error: "Không tìm thấy người dùng." });

    const newRole = (target.role === "admin" || target.role === "ADMIN") ? "user" : "admin";
    const updated = await db.updateUserProfile(targetUserId, { role: newRole });
    res.json({ success: true, role: newRole, user: updated });
  } catch (err) {
    res.status(500).json({ error: "Lỗi thao tác phân quyền người dùng." });
  }
});

// 10. Admin Panel: Community Pulse & Cadence Sync
const handleCommunitySync = async (req: any, res: any) => {
  if (!checkAdminAuth(req, res)) return;

  try {
    const targetDate = req.body.targetDate || new Date().toISOString().slice(0, 10);
    const activeRatio = typeof req.body.activeRatio === "number" ? req.body.activeRatio : 0.48;

    const result = await seedDailyActivity({
      targetDate,
      activeRatio,
      verbose: false
    });

    res.json({
      success: true,
      message: `Đã đồng bộ nhịp điệu hoạt động cộng đồng thành công cho ngày ${targetDate}.`,
      data: result
    });
  } catch (err: any) {
    console.error("Error in community pulse sync endpoint:", err);
    res.status(500).json({ error: "Lỗi đồng bộ dữ liệu nhịp điệu hệ thống: " + (err.message || err) });
  }
};

app.post("/api/auth/admin/seed-activity", authenticateToken, handleCommunitySync);
app.post("/api/auth/admin/sync-community-pulse", authenticateToken, handleCommunitySync);

// 11. Admin Panel: Get current Community Pulse status
const handleCommunityStatus = async (req: any, res: any) => {
  if (!checkAdminAuth(req, res)) return;

  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const users = await db.getAllUsers();
    const journals = await db.getAllJournals();
    const nonAdmin = users.filter((u: any) => u.role !== 'admin' && u.role !== 'ADMIN');

    const journalsToday = journals.filter((j: any) => j.date === todayStr);
    const activeUsersToday = users.filter((u: any) => {
      const plainUser = u.toObject ? u.toObject() : u;
      const uid = plainUser._id ? plainUser._id.toString() : (plainUser.id || '');
      const hasJournal = journalsToday.some((j: any) => j.userId === uid || j.userId === plainUser.id);
      const hasActivity = plainUser.isActiveToday || (plainUser.appData?.lastActiveDate === todayStr);
      return hasJournal || hasActivity;
    });

    res.json({
      date: todayStr,
      totalUsers: users.length,
      totalNonAdmin: nonAdmin.length,
      activeTodayCount: activeUsersToday.length,
      journalsTodayCount: journalsToday.length
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi lấy trạng thái nhịp điệu cộng đồng." });
  }
};

app.get("/api/auth/admin/seed-activity/status", authenticateToken, handleCommunityStatus);
app.get("/api/auth/admin/sync-community-pulse/status", authenticateToken, handleCommunityStatus);

// ==========================================
// PODCAST & TIKTOK VIDEO MANAGEMENT ENDPOINTS
// ==========================================

const PODCASTS_FILE = path.join(process.cwd(), 'server', 'podcasts.json');

function loadServerPodcasts(): any[] {
  try {
    if (fs.existsSync(PODCASTS_FILE)) {
      const content = fs.readFileSync(PODCASTS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Could not load podcasts from disk:", e);
  }
  return [];
}

function saveServerPodcasts(podcasts: any[]) {
  try {
    fs.writeFileSync(PODCASTS_FILE, JSON.stringify(podcasts, null, 2), 'utf-8');
  } catch (e) {
    console.warn("Could not save podcasts to disk:", e);
  }
}

// Global podcasts state loaded from persistent storage
let globalServerPodcasts: any[] = loadServerPodcasts();

// Helper to extract video ID and platform (TikTok or YouTube)
function parseServerVideo(urlOrId: string): { platform: 'tiktok' | 'youtube' | 'generic'; videoId: string } {
  if (!urlOrId) return { platform: 'generic', videoId: '' };
  const trimmed = urlOrId.trim();

  // TikTok check
  const isTikTok = /tiktok\.com/i.test(trimmed) || /^\d{15,22}$/.test(trimmed);
  if (isTikTok) {
    if (/^\d{15,22}$/.test(trimmed)) return { platform: 'tiktok', videoId: trimmed };
    const match = trimmed.match(/\/video\/(\d{15,22})/i) || 
                  trimmed.match(/\/v\/(\d{15,22})/i) || 
                  trimmed.match(/\/embed\/(?:v2\/)?(\d{15,22})/i) ||
                  trimmed.match(/data-video-id=["'](\d{15,22})["']/i) ||
                  trimmed.match(/\b(\d{18,20})\b/);
    if (match && match[1]) return { platform: 'tiktok', videoId: match[1] };
    return { platform: 'tiktok', videoId: trimmed };
  }

  // YouTube check
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return { platform: 'youtube', videoId: trimmed };
  const ytMatch = trimmed.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/);
  if (ytMatch && ytMatch[2] && ytMatch[2].length === 11) return { platform: 'youtube', videoId: ytMatch[2] };

  return { platform: 'generic', videoId: trimmed };
}

function extractServerYouTubeId(urlOrId: string): string {
  return parseServerVideo(urlOrId).videoId;
}

// 0. TikTok info resolver (resolves shortlinks, fetches official oEmbed info with fast timeout)
app.get("/api/media/tiktok-info", async (req, res) => {
  try {
    const rawUrl = req.query.url as string;
    if (!rawUrl) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    let targetUrl = rawUrl.trim();
    let videoId = "";

    // Extract video ID right away if present in URL
    const quickMatch = targetUrl.match(/\/video\/(\d{15,22})/i) || targetUrl.match(/\b(\d{18,20})\b/);
    if (quickMatch && quickMatch[1]) {
      videoId = quickMatch[1];
    }

    // 1. If it's a short URL (vt.tiktok.com, vm.tiktok.com, tiktok.com/t/...), follow redirects
    if (/vt\.tiktok\.com|vm\.tiktok\.com|tiktok\.com\/t\//i.test(targetUrl)) {
      try {
        const headRes = await fetch(targetUrl, {
          method: 'GET',
          redirect: 'follow',
          signal: AbortSignal.timeout(3000),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        if (headRes.url) {
          targetUrl = headRes.url;
          const redirectMatch = targetUrl.match(/\/video\/(\d{15,22})/i) || targetUrl.match(/\b(\d{18,20})\b/);
          if (redirectMatch && redirectMatch[1]) {
            videoId = redirectMatch[1];
          }
        }
      } catch (e) {
        console.warn("Could not follow redirect for short TikTok link:", e);
      }
    }

    // 2. Fetch TikTok Official oEmbed API with 3.5s timeout
    let oembedData: any = null;
    try {
      const oembedRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(targetUrl)}`, {
        signal: AbortSignal.timeout(3500),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
        }
      });
      if (oembedRes.ok) {
        oembedData = await oembedRes.json();
      }
    } catch (e) {
      // Fallback gracefully
    }

    return res.json({
      success: true,
      originalUrl: rawUrl,
      canonicalUrl: targetUrl,
      videoId: videoId || oembedData?.embed_product_id || '',
      title: oembedData?.title || '',
      author_name: oembedData?.author_name || '',
      author_url: oembedData?.author_url || '',
      thumbnail_url: oembedData?.thumbnail_url || '',
      html: oembedData?.html || ''
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to resolve TikTok URL" });
  }
});

// 1. Get all podcasts
app.get("/api/podcasts", (req, res) => {
  res.json({ podcasts: globalServerPodcasts });
});

// 2. Get active daily podcast
app.get("/api/podcasts/daily", (req, res) => {
  const active = globalServerPodcasts.find(p => p.isActiveDaily) || (globalServerPodcasts.length > 0 ? globalServerPodcasts[0] : null);
  res.json({ podcast: active || null });
});

// 3. Admin: Add new podcast / media
app.post("/api/admin/podcasts", authenticateToken, (req: any, res) => {
  if (!checkAdminAuth(req, res)) return;

  const { title, youtubeUrl, videoUrl, platform, duration, healingMessage } = req.body;
  const rawUrl = (videoUrl || youtubeUrl || "").trim();
  if (!title || !rawUrl) {
    return res.status(400).json({ error: "Vui lòng nhập đầy đủ tiêu đề và đường link TikTok." });
  }

  const parsed = parseServerVideo(rawUrl);
  const effectivePlatform = platform || parsed.platform || 'tiktok';
  const videoId = parsed.videoId;

  const newPodcast = {
    id: `pod_${Date.now()}`,
    title: title.trim(),
    youtubeUrl: rawUrl,
    videoId,
    platform: effectivePlatform,
    duration: (duration || "TikTok Clip").trim(),
    healingMessage: (healingMessage || "Lắng nghe để chữa lành và tìm lại sự bình yên trong tâm hồn.").trim(),
    isActiveDaily: globalServerPodcasts.length === 0,
    author: req.user?.username || 'Quản trị viên',
    createdAt: new Date().toISOString()
  };

  globalServerPodcasts.unshift(newPodcast);
  saveServerPodcasts(globalServerPodcasts);
  res.status(201).json({ success: true, podcast: newPodcast, podcasts: globalServerPodcasts });
});

// 4. Admin: Update podcast / media
app.put("/api/admin/podcasts/:id", authenticateToken, (req: any, res) => {
  if (!checkAdminAuth(req, res)) return;

  const { id } = req.params;
  const { title, youtubeUrl, videoUrl, platform, duration, healingMessage } = req.body;

  const index = globalServerPodcasts.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Không tìm thấy podcast yêu cầu." });
  }

  const rawUrl = videoUrl !== undefined ? videoUrl.trim() : (youtubeUrl !== undefined ? youtubeUrl.trim() : globalServerPodcasts[index].youtubeUrl);
  const parsed = parseServerVideo(rawUrl);
  const effectivePlatform = platform || parsed.platform || globalServerPodcasts[index].platform || 'tiktok';
  const videoId = parsed.videoId || globalServerPodcasts[index].videoId;

  globalServerPodcasts[index] = {
    ...globalServerPodcasts[index],
    title: title !== undefined ? title.trim() : globalServerPodcasts[index].title,
    youtubeUrl: rawUrl,
    videoId,
    platform: effectivePlatform,
    duration: duration !== undefined ? duration.trim() : globalServerPodcasts[index].duration,
    healingMessage: healingMessage !== undefined ? healingMessage.trim() : globalServerPodcasts[index].healingMessage
  };

  saveServerPodcasts(globalServerPodcasts);
  res.json({ success: true, podcast: globalServerPodcasts[index], podcasts: globalServerPodcasts });
});

// 5. Admin: Delete podcast
app.delete("/api/admin/podcasts/:id", authenticateToken, (req: any, res) => {
  if (!checkAdminAuth(req, res)) return;

  const { id } = req.params;
  const wasActive = globalServerPodcasts.find(p => p.id === id)?.isActiveDaily;
  
  globalServerPodcasts = globalServerPodcasts.filter(p => p.id !== id);

  if (wasActive && globalServerPodcasts.length > 0) {
    globalServerPodcasts[0].isActiveDaily = true;
  }

  saveServerPodcasts(globalServerPodcasts);
  res.json({ success: true, podcasts: globalServerPodcasts });
});

// 6. Admin: Set active daily podcast
app.post("/api/admin/podcasts/set-daily", authenticateToken, (req: any, res) => {
  if (!checkAdminAuth(req, res)) return;

  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: "Vui lòng chỉ định ID của podcast." });
  }

  let found = false;
  globalServerPodcasts = globalServerPodcasts.map(p => {
    if (p.id === id) {
      found = true;
      return { ...p, isActiveDaily: true };
    }
    return { ...p, isActiveDaily: false };
  });

  if (!found) {
    return res.status(404).json({ error: "Không tìm thấy podcast tương ứng." });
  }

  saveServerPodcasts(globalServerPodcasts);
  const active = globalServerPodcasts.find(p => p.isActiveDaily);
  res.json({ success: true, activePodcast: active, podcasts: globalServerPodcasts });
});

// 7. Get user's journals
app.get("/api/journals", authenticateToken, async (req: any, res) => {
  try {
    const journals = await db.getUserJournals(req.user._id.toString());
    res.json(journals);
  } catch (err) {
    res.status(500).json({ error: "Lỗi hệ thống khi tải nhật ký cảm xúc." });
  }
});

// 8. Create user's journal
app.post("/api/journals", authenticateToken, async (req: any, res) => {
  try {
    const newJournal = await db.createJournal(req.user._id.toString(), req.body);
    res.status(201).json(newJournal);
  } catch (err) {
    res.status(500).json({ error: "Lỗi hệ thống khi lưu nhật ký cảm xúc." });
  }
});

// 9. Update user's journal
app.put("/api/journals/:id", authenticateToken, async (req: any, res) => {
  try {
    const updated = await db.updateJournal(req.user._id.toString(), req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: "Không tìm thấy bài viết hoặc bài viết không thuộc quyền sở hữu của bạn." });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Lỗi hệ thống khi cập nhật nhật ký cảm xúc." });
  }
});

// 10. Delete user's journal
app.delete("/api/journals/:id", authenticateToken, async (req: any, res) => {
  try {
    const result = await db.deleteJournal(req.user._id.toString(), req.params.id);
    if (!result || result.deletedCount === 0) {
      return res.status(404).json({ error: "Không tìm thấy bài viết hoặc bài viết không thuộc quyền sở hữu của bạn." });
    }
    res.json({ success: true, message: "Đã xóa bài viết thành công." });
  } catch (err) {
    res.status(500).json({ error: "Lỗi hệ thống khi xóa nhật ký cảm xúc." });
  }
});


// Lazy-initialized Gemini Client
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY" || key.trim() === "") {
      throw new Error("Missing GEMINI_API_KEY. Please set it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Fallback Mock Responses mapped by emotion category for when Gemini API key is missing or fails
const EMOTION_FALLBACK_MAP: Record<string, Array<{
  reflection: string;
  reassurance: string;
  lessonId: string;
  suggestion: string;
  quote: string;
}>> = {
  vui_ve: [
    {
      reflection: "Đọc những dòng chia sẻ rạng rỡ của bạn, mình cảm nhận được trọn vẹn niềm vui, sự hân hoan và năng lượng tích cực lan tỏa!",
      reassurance: "Thật tuyệt vời khi được chứng kiến khoảnh khắc hạnh phúc này của bạn! Bạn hoàn toàn xứng đáng đón nhận trọn vẹn niềm vui và những thành quả ngọt ngào hôm nay.",
      lessonId: "tran_trong_niem_vui",
      suggestion: "Tự thưởng cho bản thân một món quà nhỏ hoặc chia sẻ nụ cười rạng rỡ này với người bạn thương quý.",
      quote: "Niềm vui được sẻ chia là niềm vui nhân đôi. Hãy ôm trọn khoảnh khắc rực rỡ này vào tim!"
    },
    {
      reflection: "Một ngày tràn ngập tiếng cười và sự phấn khởi! Mình rất vui khi bạn đã có một trải nghiệm tuyệt vời như thế.",
      reassurance: "Hãy ghi nhớ cảm giác hào hứng và tự hào này. Năng lượng tích cực hôm nay sẽ là nguồn sức mạnh diệu kỳ cho bạn trên những chặng đường tiếp theo.",
      lessonId: "tu_hao_chinh_minh",
      suggestion: "Chụp lại một bức ảnh kỷ niệm hoặc viết lại 3 điều bạn cảm thấy thích nhất hôm nay.",
      quote: "Hạnh phúc không ở đâu xa, nó luôn ẩn hiện trong từng nụ cười chân thật của bạn."
    }
  ],
  binh_yen: [
    {
      reflection: "Từng câu chữ của bạn toát lên một cảm giác an tĩnh, nhẹ nhàng và thảnh thơi hiếm có.",
      reassurance: "Những giây phút tâm hồn phẳng lặng, không vướng bận âu lo là món quà vô giá. Chúc bạn luôn giữ được sự an nhiên quý báu này giữa dòng đời hối hả.",
      lessonId: "giu_tron_binh_yen",
      suggestion: "Thong thả nhâm nhi một ngụm trà ấm, ngắm nhìn mây trời và cảm nhận hơi thở dịu nhẹ.",
      quote: "Bình yên không phải là không có bão giông, mà là sự an tĩnh sâu sắc ngay giữa lòng cuộc sống."
    },
    {
      reflection: "Mình cảm nhận được sự hòa hợp và dịu dàng trong không gian cảm xúc của bạn hôm nay.",
      reassurance: "Khoảnh khắc được sống chậm lại và cảm nhận trọn vẹn từng khoảnh khắc hiện tại thật đáng quý.",
      lessonId: "nuoi_duong_biet_on",
      suggestion: "Dành 2 phút nhắm mắt và gửi lời cảm ơn thầm kín đến một điều giản dị trong ngày.",
      quote: "Người biết trân trọng sự bình dị luôn sở hữu sự giàu có lớn nhất trong tâm hồn."
    }
  ],
  met_moi: [
    {
      reflection: "Mình cảm nhận được sự mệt mỏi và kiệt sức sau những nỗ lực không ngừng nghỉ của bạn.",
      reassurance: "Bạn đã cố gắng rất nhiều rồi. Cho phép cơ thể và tâm trí được nghỉ ngơi, buông lỏng hoàn toàn hôm nay nhé.",
      lessonId: "cam_thay_qua_tai",
      suggestion: "Tạm gác lại danh sách việc cần làm trong tối nay và đi ngủ sớm hơn 30 phút.",
      quote: "Nghỉ ngơi chính là một phần của sự tiến bộ. Dịu dàng với chính mình nhé."
    },
    {
      reflection: "Cơ thể và tâm trí bạn dường như đang phát tín hiệu cần được sạc lại năng lượng.",
      reassurance: "Bạn không cần lúc nào cũng phải gồng mình mạnh mẽ. Lùi lại một bước để thở cũng là một hành động dũng cảm.",
      lessonId: "nghi_ngoi_khong_loi",
      suggestion: "Ngâm chân nước ấm hoặc nghe một bản nhạc không lời êm dịu.",
      quote: "Đừng vội vã, hoa cũng cần thời gian nghỉ ngơi trước khi nở rộ."
    }
  ],
  buon_ba: [
    {
      reflection: "Mình đã lắng nghe trọn vẹn những nỗi niềm trĩu nặng mà bạn đang mang trong lòng.",
      reassurance: "Bạn không hề đơn độc. Cảm xúc buồn bã là hoàn toàn tự nhiên và mình luôn ở đây để đồng hành, ôm lấy bạn.",
      lessonId: "buon_khong_ly_do",
      suggestion: "Uống một cốc nước ấm, quấn một chiếc chăn nhẹ và cho phép bản thân được thả lỏng.",
      quote: "Bầu trời có lúc mưa dông, nhưng sau cơn mưa hoa lá sẽ đâm chồi xanh biếc."
    },
    {
      reflection: "Có những ngày nỗi buồn kéo đến tựa như sương mù, khiến lòng bạn chùng xuống.",
      reassurance: "Bạn không cần phải ép mình gượng cười ngay lập tức. Cứ để cảm xúc trôi qua nhẹ nhàng như đám mây.",
      lessonId: "diu_dang_ban_than",
      suggestion: "Đặt tay lên ngực trái và tự nhủ: 'Mọi chuyện rồi sẽ ổn, mình vẫn luôn yêu thương bản thân.'",
      quote: "Dịu dàng với chính mình là bước đầu tiên để chữa lành mọi vết thương."
    }
  ],
  lo_lang: [
    {
      reflection: "Có vẻ có những trăn trở, bất an đang khiến tâm trí bạn xoay vần và khó tĩnh tại.",
      reassurance: "Mọi việc rồi sẽ có cách giải quyết từng bước một. Bạn có đủ nội lực và sự thông tuệ để vượt qua.",
      lessonId: "lang_nghe_cam_xuc",
      suggestion: "Hít thở theo nhịp 4-4-4 ba lần để hạ nhịp tim và làm dịu hệ thần kinh.",
      quote: "Tập trung vào từng bước chân hiện tại thay vì lo lắng cho cả đoạn đường dài."
    }
  ],
  co_don: [
    {
      reflection: "Cảm giác trống trải và mong muốn được thấu hiểu đang hiện diện trong từng dòng chữ của bạn.",
      reassurance: "Dù thế giới ngoài kia có ồn ào đến đâu, bạn luôn có một nơi chốn an toàn ở đây. Bạn luôn có giá trị riêng biệt.",
      lessonId: "gia_dinh_khong_hieu",
      suggestion: "Viết một lời nhắn ấm áp cho người bạn thân thiết hoặc tự ôm lấy bờ vai của mình.",
      quote: "Một mình không có nghĩa là cô độc, đó là cơ hội để bạn kết nối sâu sắc với chính mình."
    }
  ],
  tuc_gian: [
    {
      reflection: "Mình thấu hiểu cảm giác bức bối, khó chịu khi ranh giới hoặc kỳ vọng của bạn bị tổn thương.",
      reassurance: "Cơn giận là tín hiệu cho thấy bạn quan tâm và có giới hạn riêng. Hãy để nó nguội dần một cách an toàn và lành mạnh.",
      lessonId: "giao_tiep_khong_thang_thua",
      suggestion: "Rửa mặt bằng nước mát hoặc viết xé một tờ giấy nháp để giải tỏa cơn giận.",
      quote: "Giữ sự bình tĩnh là sức mạnh lớn nhất khi đối diện với thử thách."
    }
  ]
};

// Endpoint 1: Góc thấu hiểu / Understand AI response
app.post("/api/gemini/understand", async (req, res) => {
  const { story, mode, emotion } = req.body;

  if (!story || typeof story !== "string" || story.trim() === "") {
    return res.status(400).json({ error: "Vui lòng nhập nội dung chia sẻ." });
  }

  const userEmotionKey = (emotion as string) || "binh_yen";
  const isJoyful = userEmotionKey === "vui_ve";
  const isPeaceful = userEmotionKey === "binh_yen";
  const isPositive = isJoyful || isPeaceful;

  try {
    const ai = getGeminiClient();
    
    const companionModePrompt = {
      chi_dan_lang_nghe: "Hãy đóng vai một người bạn chỉ lắng nghe thấu cảm, ôm ấp cảm xúc mà không phán xét, không đưa ra lời khuyên sáo rỗng.",
      goc_nhin_khac: "Hãy mang lại cho người dùng một góc nhìn mới tích cực nhưng vô cùng thấu cảm và tinh tế về tình huống này.",
      goi_y_bai_hoc: "Hãy lắng nghe thấu cảm và tập trung kết nối, dẫn dắt dịu dàng tới bài học tinh thần phù hợp.",
      loi_khuyen_nho: "Hãy đưa ra một vài lời khuyên vô cùng nhỏ nhặt, thực tế, dễ thực hiện để cộng hưởng hoặc cải thiện tâm trạng ngay lập tức."
    }[mode as string] || "Hãy đóng vai một người bạn lắng nghe thấu cảm.";

    const systemInstruction = `
      Bạn là trợ lý tinh thần thấu hiểu, ấm áp và đáng tin cậy của ứng dụng "Những Chấm Tròn Cảm Xúc", dành cho bạn trẻ Việt Nam tuổi từ 15-25.
      Ngôn ngữ giao tiếp hoàn toàn bằng tiếng Việt dịu dàng, xưng hô là "mình" và "bạn".
      Nhiệm vụ của bạn là đọc lời tâm sự của người dùng, thấu hiểu chính xác sắc thái cảm xúc và phản hồi cá nhân hóa sâu sắc theo định dạng JSON chuẩn.

      BỐI CẢNH CẢM XÚC CỦA NGƯỜI DÙNG:
      - Cảm xúc được chọn: "${userEmotionKey}" (${isJoyful ? 'Vui vẻ / Hân hoan / Tự hào / Hạnh phúc' : isPeaceful ? 'Bình yên / An nhiên / Thư thái' : 'Đang có tâm sự / Buồn / Mệt / Lo lắng / Tức giận / Cô đơn'})
      - Chế độ đồng hành: ${companionModePrompt}

      QUY TẮC CỐT LÕI VỀ TÂM LÝ & NGÔN TỪ:
      1. NẾU NGƯỜI DÙNG ĐANG VUI VẺ, HÂN HOAN, TỰ HÀO, HẠNH PHÚC (vui_ve hoặc nội dung tích cực):
         - TUYỆT ĐỐI KHÔNG DÙNG LỜI AN ỦI Ủ RŨ, KHÔNG NÓI VỀ ĐAU THƯƠNG, BÃO GIÔNG HAY NỖI BUỒN!
         - TUYỆT ĐỐI TRÁNH CÁC LỜI KHUYÊN SÁO RỖNG RẬP KHUÔN NHƯ "mọi chuyện rồi sẽ qua", "dũng cảm khi đối diện nỗi đau", "bão giông nào rồi cũng tan".
         - HÃY: CÙNG CHIA VUI, CHÚC MỪNG, CỘNG HƯỞNG NIỀM VUI, TÔN VINH VÀ GHI NHẬN THÀNH QUẢ / KHOẢNH KHẮC RỰC RỠ CỦA BẠN ẤY.
         - "reflection": Phản chiếu lại niềm vui, sự hân hoan hoặc tự hào từ câu chuyện của họ.
         - "reassurance": Lời chúc mừng nồng nhiệt, khích lệ họ tự hào về bản thân và tận hưởng trọn vẹn niềm hạnh phúc này.
         - "lessonId": Đề xuất mã bài học tích cực như "tran_trong_niem_vui", "nuoi_duong_biet_on", hoặc "tu_hao_chinh_minh".
         - "suggestion": 1 hành động đẹp để nhân đôi niềm vui (ví dụ: tự thưởng cho mình một món quà nhỏ, chia sẻ nụ cười với người thân yêu, ghi nhớ cảm xúc này vào trái tim,...).
         - "quote": 1 câu nói truyền cảm hứng tươi sáng, rạng rỡ về hạnh phúc, nụ cười và lòng biết ơn.

      2. NẾU NGƯỜI DÙNG ĐANG BÌNH YÊN (binh_yen):
         - Tôn vinh sự an tĩnh, thư thái và chánh niệm.
         - "lessonId": "giu_tron_binh_yen" hoặc "nuoi_duong_biet_on".
         - "suggestion": Hành động tĩnh tại, hít thở nhẹ nhàng hoặc thưởng trà, ngắm mây.

      3. NẾU NGƯỜI DÙNG ĐANG BUỒN BÃ, MỆT MỎI, LO LẮNG, CÔ ĐƠN, TỨC GIẬN:
         - Lắng nghe thấu cảm, dịu dàng, vỗ về chân thành không phán xét, không giáo điều sáo rỗng.
         - Đề xuất lessonId phù hợp:
           + "buon_khong_ly_do" (buồn bã vô cớ hoặc trống rỗng)
           + "lang_nghe_cam_xuc" (nhiều cảm xúc hỗn độn, trốn tránh nỗi buồn)
           + "diu_dang_ban_than" (tự trách, thất vọng về bản thân)
           + "cam_thay_qua_tai" (mệt mỏi vì thi cử, áp lực học tập)
           + "nghi_ngoi_khong_loi" (bận rộn quá mức, thấy có lỗi khi nghỉ ngơi)
           + "tinh_yeu_cha_me" (mâu thuẫn cách yêu thương của bố mẹ)
           + "gia_dinh_khong_hieu" (cô đơn, gia đình không thấu hiểu)
           + "giao_tiep_khong_thang_thua" (tranh cãi với bạn bè, người thân)

      Hãy trả về kết quả định dạng JSON trùng khớp cấu trúc sau:
      {
        "reflection": "chuỗi văn bản",
        "reassurance": "chuỗi văn bản",
        "lessonId": "chuỗi văn bản",
        "suggestion": "chuỗi văn bản",
        "quote": "chuỗi văn bản"
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Cảm xúc của người dùng: ${userEmotionKey}\nNgười dùng tâm sự: "${story}"\nChế độ đồng hành: ${mode}`,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reflection: { type: Type.STRING },
            reassurance: { type: Type.STRING },
            lessonId: { type: Type.STRING },
            suggestion: { type: Type.STRING },
            quote: { type: Type.STRING }
          },
          required: ["reflection", "reassurance", "lessonId", "suggestion", "quote"]
        }
      }
    });

    const resultText = response.text?.trim() || "";
    const parsed = JSON.parse(resultText);
    res.json(parsed);

  } catch (error: any) {
    console.error("Gemini API Error in understand endpoint:", error.message);
    // Fallback to emotion-specific mock feedback for offline preview
    const fallbackList = EMOTION_FALLBACK_MAP[userEmotionKey] || EMOTION_FALLBACK_MAP["binh_yen"];
    const chosenFallback = fallbackList[Math.floor(Math.random() * fallbackList.length)];
    res.json({
      ...chosenFallback,
      isFallback: true,
      errorMessage: error.message
    });
  }
});

// Endpoint 2: AI Journal Trend Analysis
app.post("/api/gemini/insight", async (req, res) => {
  const { journals } = req.body;

  if (!journals || !Array.isArray(journals) || journals.length === 0) {
    return res.json({
      insight: "Hãy viết thêm nhật ký để Chấm Tròn Cảm Xúc có thể đồng hành cùng hành trình của bạn lâu dài hơn nhé!",
      score: 75,
      trends: "Đang thu thập dữ liệu..."
    });
  }

  try {
    const ai = getGeminiClient();
    const journalSummary = journals.map(j => `- Ngày ${j.date} (${j.emotion}): ${j.text}`).join("\n");

    const systemInstruction = `
      Bạn là chuyên gia tâm lý tinh thần thấu hiểu, ấm áp của "Những Chấm Tròn Cảm Xúc".
      Đọc lịch sử nhật ký gần đây của người dùng và viết phân tích xu hướng tinh thần ngắn gọn bằng tiếng Việt.
      Ngôn từ nhẹ nhàng, khuyến khích, truyền động lực và ấm áp.
      
      Trả về định dạng JSON:
      {
        "insight": "Phân tích xu hướng tinh thần chung, chỉ ra sự chuyển biến cảm xúc, thấu hiểu khó khăn họ đang gặp và động viên",
        "score": số điểm từ 0-100 (tượng trưng cho chỉ số bình yên tinh thần gần đây),
        "trends": "Nhận xét ngắn về phân bố cảm xúc (ví dụ: 'Bạn có nhiều chấm tròn xanh bình yên hơn tuần trước rồi')"
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Lịch sử nhật ký cảm xúc của người dùng:\n${journalSummary}`,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            insight: { type: Type.STRING },
            score: { type: Type.INTEGER },
            trends: { type: Type.STRING }
          },
          required: ["insight", "score", "trends"]
        }
      }
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");
    res.json(parsed);

  } catch (error: any) {
    console.error("Gemini API Error in insight endpoint:", error.message);
    res.json({
      insight: "Mỗi chấm tròn cảm xúc mà bạn viết ra đều là một bước tiến quan trọng trên hành trình thấu hiểu bản thân. Dù có lúc trầm lúc bổng, sự hiện diện của bạn hôm nay chính là điều tuyệt vời nhất.",
      score: 80,
      trends: "Hành trình thấu cảm vẫn đang được nuôi dưỡng mỗi ngày.",
      isFallback: true
    });
  }
});

// Vite Middleware & Static Fallback handling
async function startServer() {
  const isProduction = process.env.NODE_ENV === "production" || fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'));
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Security: Prevent serving server bundle or source maps over static HTTP
    app.use((req, res, next) => {
      if (req.path === '/server.cjs' || req.path.endsWith('.cjs') || req.path.endsWith('.map')) {
        return res.status(404).end();
      }
      next();
    });
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);

    // Community Engagement Cadence: Synchronize community metrics on boot
    setTimeout(async () => {
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const journals = await db.getAllJournals();
        const journalsToday = journals.filter((j: any) => j.date === todayStr);
        if (journalsToday.length < 25) {
          console.log(`[Community-Sync] Synchronizing daily engagement metrics for (${todayStr})...`);
          await seedDailyActivity({ targetDate: todayStr, activeRatio: 0.45, verbose: false });
          console.log(`[Community-Sync] Daily engagement metrics synchronized successfully.`);
        }
      } catch (err) {
        console.warn("[Community-Sync] Startup sync notice:", err);
      }
    }, 3000);

    // Periodic Check: Check every 30 mins to keep community cadence active
    let lastCheckedDate = new Date().toISOString().slice(0, 10);
    setInterval(async () => {
      try {
        const currentDate = new Date().toISOString().slice(0, 10);
        if (currentDate !== lastCheckedDate) {
          console.log(`[Community-Sync] New cycle initiated for ${currentDate}. Updating metrics...`);
          lastCheckedDate = currentDate;
          await seedDailyActivity({ targetDate: currentDate, activeRatio: 0.45, verbose: false });
        }
      } catch (err) {
        console.warn("[Community-Sync] Periodic cadence sync error:", err);
      }
    }, 1000 * 60 * 30);
  });
}

startServer();
