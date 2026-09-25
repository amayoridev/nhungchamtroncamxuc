import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
let isConnected = false;

// Mongoose Models definitions
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  avatar: { type: String, default: "🌸" },
  motto: { type: String, default: "" },
  circleCode: { type: String },
  streak: { type: Number, default: 1 },
  circlePoints: { type: Number, default: 1 },
  emotionalCircles: { type: Number, default: 0 },
  stars: { type: Number, default: 0 },
  peaceScore: { type: Number, default: 80 },
  isLocked: { type: Boolean, default: false },
  appData: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

export function getCircleCode(user: any): string {
  if (user?.circleCode) return user.circleCode;
  if (user?.appData?.circleCode) return user.appData.circleCode;
  const uid = (user?._id?.toString() || user?.id || user?.username || user?.email || "user_default").toString();
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash * 31 + uid.charCodeAt(i)) % 9000;
  }
  const codeNum = (1000 + Math.abs(hash)).toString().padStart(4, "0");
  return `CT_${codeNum}`;
}

const JournalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  emotion: { type: String, required: true },
  text: { type: String, required: true },
  isFavorite: { type: Boolean, default: false },
  companionMode: { type: String },
  voiceUrl: { type: String },
  photoUrl: { type: String },
  aiInsight: {
    reflection: String,
    reassurance: String,
    lessonId: String,
    suggestion: String,
    quote: String
  },
  createdAt: { type: Date, default: Date.now }
});

export const UserModel: any = mongoose.models.User || mongoose.model("User", UserSchema);
export const JournalModel: any = mongoose.models.Journal || mongoose.model("Journal", JournalSchema);

export const SYSTEM_ADMIN_EMAILS = [
  "123@123.com",
  "baotran0190dwantx@gmail.com",
  "admin@admin.test",
  "ndqminh1310@gmail.com"
];

export function isSystemAdminEmail(email?: string): boolean {
  if (!email) return false;
  return SYSTEM_ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

export function normalizeUserRole(user: any): any {
  if (!user) return user;
  const email = (user.email || "").toLowerCase().trim();
  if (isSystemAdminEmail(email)) {
    user.role = "admin";
  }
  return user;
}

// In-Memory fallback store when MongoDB is not configured
const memoryUsers = new Map<string, any>();
const memoryJournals = new Map<string, any>();

// Initialize memory store with seed data if available
try {
  const seedPath = path.join(process.cwd(), "server", "seedData.json");
  if (fs.existsSync(seedPath)) {
    const seedRaw = fs.readFileSync(seedPath, "utf8");
    const seedData = JSON.parse(seedRaw);
    if (seedData.users && Array.isArray(seedData.users)) {
      seedData.users.forEach((u: any) => {
        const uid = (u._id || u.id).toString();
        normalizeUserRole(u);
        memoryUsers.set(uid, u);
      });
      console.log(`📦 Loaded ${memoryUsers.size} seeded users into fallback memory cache.`);
    }
    if (seedData.journals && Array.isArray(seedData.journals)) {
      seedData.journals.forEach((j: any) => {
        const jid = (j._id || j.id).toString();
        memoryJournals.set(jid, j);
      });
      console.log(`📦 Loaded ${memoryJournals.size} seeded journals into fallback memory cache.`);
    }
  }
} catch (e) {
  console.warn("Could not load seedData.json into memory:", e);
}

// Connect to MongoDB if URI is provided
if (MONGODB_URI && MONGODB_URI !== "YOUR_MONGODB_URI" && MONGODB_URI.trim() !== "") {
  console.log("Attempting to connect to MongoDB...");
  mongoose
    .connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
    .then(() => {
      console.log("🟢 Successfully connected to MongoDB Database!");
      isConnected = true;
      syncMongoAndMemoryStores();
    })
    .catch((err: any) => {
      console.warn("⚠️ MongoDB connection unavailable, running in in-memory mode:", err.message);
      isConnected = false;
    });

  mongoose.connection.on("error", (err: any) => {
    console.warn("MongoDB runtime warning:", err.message);
    isConnected = false;
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected, switching to in-memory mode");
    isConnected = false;
  });

  mongoose.connection.on("reconnected", () => {
    console.log("MongoDB reconnected");
    isConnected = true;
    syncMongoAndMemoryStores();
  });
} else {
  console.log("ℹ️ MONGODB_URI not configured: Running with resilient in-memory database storage.");
}

function isDbReady(): boolean {
  return mongoose.connection.readyState === 1;
}

// Bi-directional synchronization between MongoDB and local store
async function syncMongoAndMemoryStores() {
  try {
    if (!isDbReady()) return;
    const mongoUsers = await UserModel.find({});
    for (const u of mongoUsers) {
      const plain = u.toObject ? u.toObject() : u;
      const uid = (plain._id || plain.id).toString();
      plain.id = uid;
      plain._id = uid;
      normalizeUserRole(plain);
      memoryUsers.set(uid, plain);
    }
    // Ensure all system admin roles are set in MongoDB
    try {
      await UserModel.updateMany(
        { email: { $in: SYSTEM_ADMIN_EMAILS } },
        { $set: { role: 'admin' } }
      );
    } catch (e) {}
    // Check if any in-memory user is missing in MongoDB (e.g. created during temporary disconnect)
    for (const [id, memUser] of memoryUsers.entries()) {
      const email = memUser.email ? memUser.email.toLowerCase().trim() : '';
      if (email) {
        const exists = mongoUsers.some(mu => mu.email && mu.email.toLowerCase().trim() === email);
        if (!exists) {
          try {
            const { _id, id: oldId, ...userData } = memUser;
            const newDoc = new UserModel({
              ...userData,
              email,
              createdAt: memUser.createdAt || new Date()
            });
            const saved = await newDoc.save();
            const savedPlain = saved.toObject ? saved.toObject() : saved;
            const newUid = (savedPlain._id || savedPlain.id).toString();
            savedPlain.id = newUid;
            savedPlain._id = newUid;
            normalizeUserRole(savedPlain);
            memoryUsers.set(newUid, savedPlain);
          } catch (e) {
            // Ignore duplicate key
          }
        }
      }
    }
    db.saveCurrentStateToDisk();
  } catch (err) {
    console.warn("Dual-storage sync notice:", err);
  }
}

// Unified Database Access Interface with seamless MongoDB & In-Memory fallback
export const db = {
  getIsConnected() {
    return isDbReady();
  },

  // 1. USER ACTIONS
  async findUserByEmail(email: string): Promise<any> {
    if (!email) return null;
    const cleanEmail = email.toLowerCase().trim();
    if (isDbReady()) {
      try {
        const user = await UserModel.findOne({ email: cleanEmail });
        if (user) {
          const plain = user.toObject ? user.toObject() : user;
          const uid = (plain._id || plain.id).toString();
          plain.id = uid;
          plain._id = uid;
          normalizeUserRole(plain);
          normalizeUserRole(user);
          memoryUsers.set(uid, plain);
          return user;
        }
      } catch (err) {
        console.warn("MongoDB findUserByEmail error, falling back to memory:", err);
      }
    }
    for (const u of memoryUsers.values()) {
      if (u.email && u.email.toLowerCase().trim() === cleanEmail) {
        normalizeUserRole(u);
        return u;
      }
    }
    return null;
  },

  async findUserByIdentifier(identifier: string): Promise<any> {
    if (!identifier) return null;
    const clean = identifier.trim();
    const cleanLower = clean.toLowerCase();

    // 1. Try MongoDB
    if (isDbReady()) {
      try {
        const safeRegex = clean.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const found = await UserModel.findOne({
          $or: [
            { email: cleanLower },
            { username: { $regex: new RegExp(`^${safeRegex}$`, 'i') } }
          ]
        });
        if (found) {
          const plain = found.toObject ? found.toObject() : found;
          const uid = (plain._id || plain.id).toString();
          plain.id = uid;
          plain._id = uid;
          normalizeUserRole(plain);
          normalizeUserRole(found);
          memoryUsers.set(uid, plain);
          return found;
        }
      } catch (err) {
        console.warn("MongoDB findUserByIdentifier error, falling back to memory:", err);
      }
    }

    // 2. Check memory cache
    for (const u of memoryUsers.values()) {
      if (
        (u.email && u.email.toLowerCase().trim() === cleanLower) ||
        (u.username && u.username.toLowerCase().trim() === cleanLower)
      ) {
        normalizeUserRole(u);
        return u;
      }
    }
    return null;
  },

  async findUserById(id: string): Promise<any> {
    if (!id) return null;
    const cleanId = id.toString().trim();

    if (isDbReady()) {
      try {
        let user: any = null;
        if (mongoose.Types.ObjectId.isValid(cleanId)) {
          user = await UserModel.findById(cleanId);
        }
        if (!user) {
          user = await UserModel.findOne({
            $or: [
              { id: cleanId },
              { circleCode: cleanId }
            ]
          });
        }
        if (user) {
          const plain = user.toObject ? user.toObject() : user;
          const uid = (plain._id || plain.id).toString();
          plain.id = uid;
          plain._id = uid;
          normalizeUserRole(plain);
          normalizeUserRole(user);
          memoryUsers.set(uid, plain);
          return user;
        }
      } catch (err) {
        console.warn("MongoDB findUserById error, falling back to memory:", err);
      }
    }

    if (memoryUsers.has(cleanId)) {
      const u = memoryUsers.get(cleanId);
      normalizeUserRole(u);
      return u;
    }
    for (const u of memoryUsers.values()) {
      const uId = (u._id || u.id || '').toString();
      if (uId === cleanId || u.circleCode === cleanId) {
        normalizeUserRole(u);
        return u;
      }
    }
    return null;
  },

  async createUser(userData: any): Promise<any> {
    const defaultCircleCode = userData.circleCode || ("CT_" + Math.floor(1000 + Math.random() * 9000));
    const streak = userData.streak !== undefined ? userData.streak : 1;
    const circlePoints = userData.circlePoints !== undefined ? userData.circlePoints : streak;
    const stars = userData.stars !== undefined ? userData.stars : 0;
    const peaceScore = userData.peaceScore !== undefined ? userData.peaceScore : 80;
    const cleanEmail = (userData.email || '').toLowerCase().trim();
    const cleanUsername = (userData.username || '').trim();

    let createdUser: any = null;

    if (isDbReady()) {
      try {
        const user = new UserModel({
          ...userData,
          username: cleanUsername,
          email: cleanEmail,
          circleCode: defaultCircleCode,
          streak,
          circlePoints,
          stars,
          peaceScore,
          isLocked: Boolean(userData.isLocked),
          appData: userData.appData || {},
          createdAt: new Date()
        });
        const saved = await user.save();
        createdUser = saved;
      } catch (err) {
        console.warn("MongoDB createUser error, falling back to memory:", err);
      }
    }

    if (!createdUser) {
      const memId = "mem_user_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
      const memUser = {
        _id: memId,
        id: memId,
        ...userData,
        username: cleanUsername,
        email: cleanEmail,
        circleCode: defaultCircleCode,
        streak,
        circlePoints,
        stars,
        peaceScore,
        isLocked: Boolean(userData.isLocked),
        appData: userData.appData || {},
        createdAt: new Date()
      };
      createdUser = memUser;
    }

    // Always mirror into memoryUsers and persist to disk
    const plain = createdUser.toObject ? createdUser.toObject() : { ...createdUser };
    const uid = (plain._id || plain.id).toString();
    plain.id = uid;
    plain._id = uid;
    memoryUsers.set(uid, plain);
    this.saveCurrentStateToDisk();

    return createdUser;
  },

  async updateUserProfile(userId: string, updateData: any): Promise<any> {
    const uid = userId.toString().trim();
    let updatedUser: any = null;

    if (isDbReady()) {
      try {
        if (updateData.appData) {
          const currentUser = mongoose.Types.ObjectId.isValid(uid)
            ? await UserModel.findById(uid)
            : await UserModel.findOne({ id: uid });
          const mergedAppData = { ...(currentUser?.appData || {}), ...updateData.appData };
          updateData.appData = mergedAppData;
        }
        if (mongoose.Types.ObjectId.isValid(uid)) {
          updatedUser = await UserModel.findByIdAndUpdate(uid, { $set: updateData }, { new: true });
        } else {
          updatedUser = await UserModel.findOneAndUpdate({ id: uid }, { $set: updateData }, { new: true });
        }
      } catch (err) {
        console.warn("MongoDB updateUserProfile error, falling back to memory:", err);
      }
    }

    const existing = memoryUsers.get(uid) || Array.from(memoryUsers.values()).find(u => (u._id || u.id || '').toString() === uid);
    if (existing) {
      if (updateData.appData) {
        updateData.appData = { ...(existing.appData || {}), ...updateData.appData };
      }
      const updated = { ...existing, ...updateData };
      const plainUid = (updated._id || updated.id || uid).toString();
      updated.id = plainUid;
      updated._id = plainUid;
      memoryUsers.set(plainUid, updated);
      if (!updatedUser) updatedUser = updated;
    }

    this.saveCurrentStateToDisk();
    return updatedUser;
  },

  async getAllUsersCount(): Promise<number> {
    if (isDbReady()) {
      try {
        return await UserModel.countDocuments();
      } catch (err) {
        console.warn("MongoDB getAllUsersCount error, falling back to memory:", err);
      }
    }
    return memoryUsers.size;
  },

  async getAllUsers(): Promise<any[]> {
    const userMap = new Map<string, any>();

    // 1. If MongoDB is ready, fetch all users with a 2-second timeout protection
    if (isDbReady()) {
      try {
        const queryPromise = UserModel.find({}, { password: 0 }).lean().sort({ createdAt: -1 });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("MongoDB query timeout")), 2000));
        const mongoUsers: any = await Promise.race([queryPromise, timeoutPromise]);
        for (const u of mongoUsers) {
          const plain = u.toObject ? u.toObject() : u;
          const uid = (plain._id || plain.id || '').toString();
          plain._id = uid;
          plain.id = uid;
          normalizeUserRole(plain);
          userMap.set(uid, plain);
          if (!memoryUsers.has(uid)) {
            memoryUsers.set(uid, plain);
          }
        }
      } catch (err: any) {
        console.warn("MongoDB getAllUsers notice, falling back to memory:", err.message);
      }
    }

    // 2. Also merge any users in memoryUsers that might not have been in MongoDB
    for (const [id, u] of memoryUsers.entries()) {
      const uid = (u._id || u.id || id).toString();
      if (!userMap.has(uid)) {
        const { password, ...safeUser } = u;
        safeUser._id = uid;
        safeUser.id = uid;
        normalizeUserRole(safeUser);
        userMap.set(uid, safeUser);
      }
    }

    return Array.from(userMap.values()).sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  },

  async toggleUserLock(userId: string): Promise<any> {
    const uid = userId.toString().trim();
    let userDoc: any = null;
    if (isDbReady()) {
      try {
        const user = mongoose.Types.ObjectId.isValid(uid) ? await UserModel.findById(uid) : await UserModel.findOne({ id: uid });
        if (user) {
          user.isLocked = !user.isLocked;
          userDoc = await user.save();
        }
      } catch (err) {
        console.warn("MongoDB toggleUserLock error, falling back to memory:", err);
      }
    }

    const memUser = memoryUsers.get(uid) || Array.from(memoryUsers.values()).find(u => (u._id || u.id || '').toString() === uid);
    if (memUser) {
      memUser.isLocked = !memUser.isLocked;
      const mUid = (memUser._id || memUser.id || uid).toString();
      memoryUsers.set(mUid, memUser);
      if (!userDoc) userDoc = memUser;
    }

    this.saveCurrentStateToDisk();
    return userDoc;
  },

  async resetUserPassword(userId: string, passwordHashed: string): Promise<any> {
    const uid = userId.toString().trim();
    let userDoc: any = null;
    if (isDbReady()) {
      try {
        if (mongoose.Types.ObjectId.isValid(uid)) {
          userDoc = await UserModel.findByIdAndUpdate(uid, { $set: { password: passwordHashed } }, { new: true });
        } else {
          userDoc = await UserModel.findOneAndUpdate({ id: uid }, { $set: { password: passwordHashed } }, { new: true });
        }
      } catch (err) {
        console.warn("MongoDB resetUserPassword error, falling back to memory:", err);
      }
    }

    const memUser = memoryUsers.get(uid) || Array.from(memoryUsers.values()).find(u => (u._id || u.id || '').toString() === uid);
    if (memUser) {
      memUser.password = passwordHashed;
      const mUid = (memUser._id || memUser.id || uid).toString();
      memoryUsers.set(mUid, memUser);
      if (!userDoc) userDoc = memUser;
    }

    this.saveCurrentStateToDisk();
    return userDoc;
  },

  async getAllJournals(): Promise<any[]> {
    if (isDbReady()) {
      try {
        const queryPromise = JournalModel.find({}).lean().sort({ date: -1, time: -1 });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("MongoDB query timeout")), 2000));
        return (await Promise.race([queryPromise, timeoutPromise])) as any[];
      } catch (err: any) {
        console.warn("MongoDB getAllJournals notice, falling back to memory:", err.message);
      }
    }
    return Array.from(memoryJournals.values()).sort((a, b) => {
      const dateA = `${a.date} ${a.time}`;
      const dateB = `${b.date} ${b.time}`;
      return dateB.localeCompare(dateA);
    });
  },

  async getUserJournals(userId: string): Promise<any[]> {
    const uid = userId.toString().trim();
    if (isDbReady()) {
      try {
        const query = mongoose.Types.ObjectId.isValid(uid)
          ? { $or: [{ userId: new mongoose.Types.ObjectId(uid) }, { userId: uid }] }
          : { userId: uid };
        return await JournalModel.find(query).sort({ date: -1, time: -1 });
      } catch (err) {
        console.warn("MongoDB getUserJournals error, falling back to memory:", err);
      }
    }
    return Array.from(memoryJournals.values())
      .filter(j => {
        const jUid = (j.userId?._id || j.userId || '').toString();
        return jUid === uid;
      })
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  },

  async createJournal(userId: string, journalData: any): Promise<any> {
    const uid = userId.toString().trim();
    if (isDbReady()) {
      try {
        const docData = {
          ...journalData,
          userId: mongoose.Types.ObjectId.isValid(uid) ? new mongoose.Types.ObjectId(uid) : uid
        };
        const journal = new JournalModel(docData);
        const saved = await journal.save();
        const plain = saved.toObject ? saved.toObject() : saved;
        const jid = (plain._id || plain.id).toString();
        plain.id = jid;
        plain._id = jid;
        memoryJournals.set(jid, plain);
        this.saveCurrentStateToDisk();
        return saved;
      } catch (err) {
        console.warn("MongoDB createJournal error, falling back to memory:", err);
      }
    }
    const memId = "mem_journal_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
    const memJournal = {
      _id: memId,
      id: memId,
      userId: uid,
      ...journalData,
      createdAt: new Date()
    };
    memoryJournals.set(memId, memJournal);
    this.saveCurrentStateToDisk();
    return memJournal;
  },

  async updateJournal(userId: string, journalId: string, updateData: any): Promise<any> {
    const uid = userId.toString().trim();
    if (isDbReady()) {
      try {
        const updated = await JournalModel.findOneAndUpdate(
          { _id: journalId, userId: mongoose.Types.ObjectId.isValid(uid) ? new mongoose.Types.ObjectId(uid) : uid },
          { $set: updateData },
          { new: true }
        );
        if (updated) {
          const plain = updated.toObject ? updated.toObject() : updated;
          const jid = (plain._id || plain.id).toString();
          memoryJournals.set(jid, plain);
          this.saveCurrentStateToDisk();
          return updated;
        }
      } catch (err) {
        console.warn("MongoDB updateJournal error, falling back to memory:", err);
      }
    }
    const memJournal = memoryJournals.get(journalId);
    if (memJournal && (memJournal.userId === uid || memJournal.userId?.toString() === uid)) {
      const updated = { ...memJournal, ...updateData };
      memoryJournals.set(journalId, updated);
      this.saveCurrentStateToDisk();
      return updated;
    }
    return null;
  },

  async deleteJournal(userId: string, journalId: string): Promise<any> {
    const uid = userId.toString().trim();
    if (isDbReady()) {
      try {
        const res = await JournalModel.deleteOne({
          _id: journalId,
          userId: mongoose.Types.ObjectId.isValid(uid) ? new mongoose.Types.ObjectId(uid) : uid
        });
        memoryJournals.delete(journalId);
        this.saveCurrentStateToDisk();
        return res;
      } catch (err) {
        console.warn("MongoDB deleteJournal error, falling back to memory:", err);
      }
    }
    const memJournal = memoryJournals.get(journalId);
    if (memJournal && (memJournal.userId === uid || memJournal.userId?.toString() === uid)) {
      memoryJournals.delete(journalId);
      this.saveCurrentStateToDisk();
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  },

  async batchUpdateUsers(updates: Array<{ userId: string; updateData: any }>): Promise<void> {
    if (!updates || updates.length === 0) return;

    // 1. In-memory update (instant O(1) per user)
    for (const u of updates) {
      const uid = u.userId.toString().trim();
      const existing = memoryUsers.get(uid) || Array.from(memoryUsers.values()).find(x => (x._id || x.id || '').toString() === uid);
      if (existing) {
        if (u.updateData.appData) {
          existing.appData = { ...(existing.appData || {}), ...u.updateData.appData };
        }
        Object.assign(existing, u.updateData);
      }
    }

    // 2. MongoDB bulk write (single fast batch query with 3s timeout)
    if (isDbReady()) {
      try {
        const bulkOps = updates.map(u => ({
          updateOne: {
            filter: {
              $or: [
                ...(mongoose.Types.ObjectId.isValid(u.userId) ? [{ _id: new mongoose.Types.ObjectId(u.userId) }] : []),
                { id: u.userId }
              ]
            },
            update: { $set: u.updateData }
          }
        }));
        const bulkPromise = UserModel.bulkWrite(bulkOps as any);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Bulk write timeout")), 3000));
        await Promise.race([bulkPromise, timeoutPromise]);
      } catch (err: any) {
        console.warn("MongoDB batchUpdateUsers notice, saved in memory:", err.message);
      }
    }

    // 3. Debounced disk save
    this.saveCurrentStateToDisk();
  },

  async bulkCreateJournals(journalsArray: any[]): Promise<any[]> {
    if (!journalsArray || journalsArray.length === 0) return [];
    if (isDbReady()) {
      try {
        const docs = journalsArray.map(j => ({
          ...j,
          userId: mongoose.Types.ObjectId.isValid(j.userId) ? new mongoose.Types.ObjectId(j.userId) : j.userId
        }));
        const insertPromise = JournalModel.insertMany(docs);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("insertMany timeout")), 3000));
        return (await Promise.race([insertPromise, timeoutPromise])) as any[];
      } catch (err: any) {
        console.warn("MongoDB bulkCreateJournals notice, saved in memory:", err.message);
      }
    }
    const created: any[] = [];
    for (const j of journalsArray) {
      const memId = j._id || ("mem_journal_" + Date.now() + "_" + Math.floor(Math.random() * 10000));
      const item = { ...j, _id: memId, id: memId, createdAt: j.createdAt || new Date() };
      memoryJournals.set(memId, item);
      created.push(item);
    }
    this.saveCurrentStateToDisk();
    return created;
  },

  saveCurrentStateToDisk(immediate = false): boolean {
    const doSave = () => {
      try {
        const seedPath = path.join(process.cwd(), "server", "seedData.json");
        const users = Array.from(memoryUsers.values());
        const journals = Array.from(memoryJournals.values());
        fs.writeFile(seedPath, JSON.stringify({ users, journals }, null, 2), "utf8", (err) => {
          if (err) console.warn("Could not save current state to disk:", err);
        });
      } catch (e) {
        console.warn("Could not save current state to disk:", e);
      }
    };

    if (immediate) {
      doSave();
    } else {
      if ((globalThis as any).__saveDiskTimer) {
        clearTimeout((globalThis as any).__saveDiskTimer);
      }
      (globalThis as any).__saveDiskTimer = setTimeout(doSave, 1000);
    }
    return true;
  }
};
