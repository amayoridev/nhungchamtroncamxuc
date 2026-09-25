import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { db, UserModel, JournalModel } from "./db";
import { generateCalibratedDers16 } from "./ders16";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

// 1. Realistic Vietnamese Daily Journal Templates across Time-of-day & Emotions
interface DailyTemplate {
  emotion: string;
  timeRange: 'morning' | 'noon' | 'sunset' | 'night';
  texts: string[];
  aiInsight: {
    reflection: string;
    reassurance: string;
    lessonId: string;
    suggestion: string;
    quote: string;
  };
}

const DAILY_DIARY_TEMPLATES: DailyTemplate[] = [
  // MORNING
  {
    emotion: "binh_yen",
    timeRange: "morning",
    texts: [
      "Thức dậy sớm hơn thường lệ, mở toang cánh cửa sổ đón làn gió ban mai mát lành. Tự pha một ấm trà lài thơm dịu, hít thở thật sâu và thấy tâm mình tĩnh lại trước khi bắt đầu một ngày mới.",
      "Sáng nay đi bộ sớm quanh khu phố, ngắm nhìn sương sớm còn đọng trên từng tán lá. Nhịp bước chân thong thả giúp lòng mình nhẹ bẫng, cảm thấy biết ơn vì một ngày mới lại mở ra.",
      "Dành 10 phút ngồi thiền và thở tĩnh tâm trước bàn trà sáng nay. Cảm nhận từng hơi thở vào ra nhẹ nhàng, tự dặn lòng hôm nay sẽ đối xử thật dịu dàng với chính mình và mọi người."
    ],
    aiInsight: {
      reflection: "Khởi đầu ngày mới với sự tĩnh tại là hạt mầm tuyệt vời cho một ngày an hòa.",
      reassurance: "Tâm hồn bạn đang được nuôi dưỡng bằng những khoảnh khắc bình dị mà quý giá.",
      lessonId: "nang_luong_som_mai",
      suggestion: "Giữ trọn cảm giác thảnh thơi này trong suốt các hoạt động của ngày hôm nay nhé.",
      quote: "Mỗi sớm mai thức dậy là một khởi đầu mới, hãy để tâm mình nở hoa như ánh mặt trời."
    }
  },
  {
    emotion: "vui_ve",
    timeRange: "morning",
    texts: [
      "Sáng nay vừa chạy bộ hoàn thành mục tiêu 4km! Mồ hôi ướt đẫm nhưng tinh thần cực kỳ sảng khoái, cảm giác năng lượng tích cực tràn ngập cả cơ thể.",
      "Nhận được tin nhắn chào buổi sáng rất đáng yêu từ người bạn thân. Chỉ một câu chúc đơn giản thôi nhưng làm mình mỉm cười suốt từ sáng đến giờ!"
    ],
    aiInsight: {
      reflection: "Năng lượng rạng rỡ và tích cực của bạn đang lan tỏa đến mọi điều xung quanh.",
      reassurance: "Niềm vui được kiến tạo từ những thói quen lành mạnh và sự kết nối chân thành.",
      lessonId: "lan_toa_niem_vui",
      suggestion: "Chia sẻ nụ cười ấm áp này với một người đồng nghiệp hoặc người thân hôm nay nhé.",
      quote: "Nụ cười là đóa hoa đẹp nhất bạn có thể trao tặng cho cuộc đời mỗi sớm mai."
    }
  },

  // NOON
  {
    emotion: "thu_gian",
    timeRange: "noon",
    texts: [
      "Trưa nay tự thưởng cho mình một bữa cơm thanh đạm với nhiều rau xanh. Sau đó ngồi nhắm mắt nghỉ ngơi 15 phút, lắng nghe một điệu nhạc không lời du dương để nạp lại năng lượng.",
      "Giờ nghỉ trưa bước ra công viên gần cơ quan ngồi hóng gió. Nhìn những chú chim chuyền cành dưới vòm cây râm mát, thấy mọi mỏi mệt của buổi sáng dần tan biến."
    ],
    aiInsight: {
      reflection: "Biết cách tạm dừng đúng lúc giữa ngày là nghệ thuật tự chăm sóc bản thân sâu sắc.",
      reassurance: "Cơ thể và tâm trí bạn đang được nghỉ ngơi, hồi phục lại sự minh triết.",
      lessonId: "diu_em_giua_ngay",
      suggestion: "Uống thêm một cốc nước ấm mát lành để tiếp tục buổi chiều nhẹ nhàng nhé.",
      quote: "Đôi khi điều hiệu quả nhất bạn có thể làm là cho phép mình dừng lại và nghỉ ngơi."
    }
  },
  {
    emotion: "met_moi",
    timeRange: "noon",
    texts: [
      "Buổi sáng công việc dồn dập với nhiều cuộc họp liên tiếp làm đầu óc có phần hơi căng. May mắn là đã kịp dừng lại hít thở sâu 3 nhịp để lấy lại thăng bằng.",
      "Áp lực công việc trưa nay khiến mình thấy hơi đuối sức. Nhưng tự dặn lòng không sao cả, từng việc một rồi cũng sẽ ổn thỏa, không cần phải quá vội vàng."
    ],
    aiInsight: {
      reflection: "Sự nhận biết mệt mỏi là tín hiệu thông minh nhắc nhở bạn cần nâng niu cơ thể.",
      reassurance: "Bạn đã nỗ lực rất nhiều rồi. Hoàn thành công việc từng bước nhỏ một là quá đủ cho hôm nay.",
      lessonId: "thao_long_ap_luc",
      suggestion: "Nhắm mắt thư giãn 5 phút, duỗi nhẹ vai và uống một ly nước mát.",
      quote: "Đừng vội vã. Cây cối lớn lên trong tĩnh lặng, bạn cũng sẽ vượt qua mọi việc một cách an nhiên."
    }
  },

  // SUNSET / LATE AFTERNOON
  {
    emotion: "tram_lang",
    timeRange: "sunset",
    texts: [
      "Chiều nay tan sở sớm, đi bộ chầm chậm ngắm hoàng hôn buông xuống góc phố. Bầu trời chuyển sang màu cam tím tuyệt đẹp, lòng bỗng chùng xuống với nhiều suy ngẫm dịu êm.",
      "Ghé vào một quán cà phê quen thuộc khi chiều tà. Ngồi bên khung cửa sổ nhìn dòng người qua lại, cảm thấy sự lắng đọng và bình thản lạ kỳ sau một ngày bận rộn.",
      "Đạp xe quanh bờ hồ lúc chiều muộn. Gió thổi lồng lộng xua tan bao nhiêu suy nghĩ vẩn vơ, chỉ còn lại sự hiện diện trọn vẹn trong khoảnh khắc này."
    ],
    aiInsight: {
      reflection: "Khoảnh khắc hoàng hôn luôn mang lại sự chuyển hóa và lắng đọng sâu lắng trong tâm can.",
      reassurance: "Sự trầm lặng không phải là buồn bã, mà là chiều sâu an tĩnh của một tâm hồn đang chữa lành.",
      lessonId: "lang_dong_chieu_ta",
      suggestion: "Hãy lưu lại một bức ảnh hoặc ghi nhớ hình ảnh hoàng hôn tuyệt đẹp này vào tim.",
      quote: "Hoàng hôn là minh chứng rằng dù có chuyện gì xảy ra, một ngày cũng có thể kết thúc thật êm đẹp."
    }
  },
  {
    emotion: "biet_on",
    timeRange: "sunset",
    texts: [
      "Chiều nay gọi điện thoại về thăm mẹ, nghe giọng mẹ ấm áp dặn dò ăn uống đầy đủ mà khóe mắt thấy cay cay. Cảm thấy mình thật may mắn và biết ơn gia đình vô bờ bến.",
      "Nhận được sự giúp đỡ chí tình từ người đồng hành trong nhóm khi mình gặp khó khăn. Thấy cuộc đời này vẫn ấm áp và đáng yêu biết bao khi có những người bạn chân thành."
    ],
    aiInsight: {
      reflection: "Lòng biết ơn là dòng suối mát lành gột rửa mọi muộn phiền trong tâm hồn bạn.",
      reassurance: "Sự kết nối yêu thương từ người thân và bạn bè là điểm tựa vững chãi nhất của cuộc đời.",
      lessonId: "nuoi_duong_biet_on",
      suggestion: "Gửi một lời cảm ơn chân thành đến người đã mang lại cho bạn cảm giác ấm áp này.",
      quote: "Khi ta biết ơn những điều nhỏ bé, hạnh phúc sẽ tự tìm về gõ cửa."
    }
  },

  // NIGHT / BEDTIME
  {
    emotion: "binh_yen",
    timeRange: "night",
    texts: [
      "Đêm đã khuya, đốt một ngọn nến thơm mùi gỗ thông, bật bản nhạc lofi nhẹ nhàng và viết vài dòng nhật ký. Mọi âu lo của ngày hôm nay xin gửi lại phía sau cánh cửa.",
      "Đọc xong một chương sách hay trước giờ ngủ. Cảm giác tâm trí được gột rửa sạch sẽ, cơ thể thư giãn hoàn toàn, chuẩn bị đón một giấc ngủ sâu và ngon lành.",
      "Dành 15 phút tập thở 4-7-8 trên giường ngủ. Từng nhịp thở như một cái ôm vỗ về chính mình sau một ngày dài cố gắng. Chúc bản thân ngủ thật ngon!"
    ],
    aiInsight: {
      reflection: "Một đêm tĩnh lặng để khép lại ngày dài với trọn vẹn sự an yên và tự tại.",
      reassurance: "Bạn đã hoàn thành trọn vẹn ngày hôm nay rồi. Hãy buông bỏ tất cả để chìm vào giấc ngủ ngon.",
      lessonId: "khep_lai_ngay_an_lanh",
      suggestion: "Đặt điện thoại ra xa giường ngủ, hít 3 hơi thật sâu và nhắm mắt lại thư giãn.",
      quote: "Đêm là để nghỉ ngơi, buông xả và nạp lại năng lượng thuần khiết cho tâm hồn."
    }
  },
  {
    emotion: "biet_on",
    timeRange: "night",
    texts: [
      "Trước khi ngủ, ngồi viết ra 3 điều biết ơn của ngày hôm nay: một tách trà ấm buổi sáng, một nụ cười của người lạ và một giấc ngủ bình an đang chờ đón.",
      "Cảm ơn cơ thể đã đồng hành bền bỉ cùng mình suốt cả ngày hôm nay. Dù có lúc mệt mỏi nhưng ta vẫn luôn ở đây, yêu thương và chăm sóc chính mình."
    ],
    aiInsight: {
      reflection: "Khép lại một ngày bằng sự biết ơn là cách diệu kỳ nhất để đón nhận giấc ngủ an lành.",
      reassurance: "Tâm hồn giàu lòng biết ơn luôn được bao bọc trong sự che chở và bình yên ấm áp.",
      lessonId: "giac_ngu_an_nhien",
      suggestion: "Đặt nhẹ tay lên ngực và gửi đến chính mình một lời cảm ơn chân thành.",
      quote: "Hãy đi ngủ với sự biết ơn, và thức dậy với niềm hy vọng tràn đầy."
    }
  }
];

// 2. Mindful Books & Quotes for Reading Sessions
const MINDFUL_BOOKS = [
  { title: "Hiểu Về Trái Tim - Thầy Minh Niệm", quote: "Lắng nghe là liều thuốc mầu nhiệm nhất để xoa dịu những nỗi đau trong lòng." },
  { title: "Bước Chậm Lại Giữa Thế Gian Vội Vã - Hae Min", quote: "Khi bạn chậm lại, cả thế giới cũng sẽ chậm lại cùng bạn." },
  { title: "Tĩnh Lặng - Thích Nhất Hạnh", quote: "Thở vào, tôi biết tôi đang thở vào. Thở ra, tôi mỉm cười với sự sống trong tôi." },
  { title: "Muôn Kiếp Nhân Sinh - Nguyên Phong", quote: "Nhân quả không bỏ sót ai, gieo hạt mầm yêu thương sẽ gặt hái quả ngọt bình an." },
  { title: "Cây Cam Ngọt Của Tôi - José Mauro", quote: "Yêu thương là điều duy nhất làm cho con người trở nên dịu dàng và can đảm." },
  { title: "Hoàng Tử Bé - Antoine de Saint-Exupéry", quote: "Người ta chỉ nhìn thấy thật rõ ràng bằng trái tim. Cái cốt lõi thì mắt trần không thấy được." },
  { title: "Dám Bị Ghét - Kishimi Ichiro", quote: "Hạnh phúc đích thực là có lòng dũng cảm để sống là chính mình trong từng khoảnh khắc." },
  { title: "Yêu Những Điều Không Hoàn Hảo - Hae Min", quote: "Đừng cố trở thành người hoàn hảo, hãy học cách ôm lấy những khiếm khuyết của chính mình." }
];

// 3. Gratitude Templates for Daily Practice
const GRATITUDE_TRIPLETS = [
  [
    "Biết ơn vì một sớm mai thức dậy cơ thể vẫn khỏe mạnh và bình an.",
    "Biết ơn tách cà phê thơm ấm tiếp thêm năng lượng cho ngày mới.",
    "Biết ơn những tin nhắn hỏi han ấm áp từ những người bạn đồng hành."
  ],
  [
    "Biết ơn một bữa cơm gia đình giản dị nhưng đầy ắp tiếng cười.",
    "Biết ơn làn gió mát lành thổi qua trong buổi chiều tan sở.",
    "Biết ơn chính mình vì đã không bỏ cuộc và luôn cố gắng vươn lên."
  ],
  [
    "Biết ơn vì hôm nay đã hoàn thành xong công việc đúng hạn.",
    "Biết ơn góc ban công nhỏ đầy cây xanh luôn mang lại cảm giác bình yên.",
    "Biết ơn giấc ngủ êm đềm đang chờ đón sau một ngày dài nỗ lực."
  ],
  [
    "Biết ơn ánh nắng sớm rọi qua khung cửa sổ mang lại niềm hy vọng mới.",
    "Biết ơn cuốn sách hay đã mở ra cho mình những góc nhìn sâu sắc.",
    "Biết ơn ly nước mát lành xoa dịu cơn khát giữa trưa hè."
  ]
];

// 4. Sweet Card Templates
const SWEET_CARD_TEMPLATES = [
  { title: "Một cái ôm tinh thần", msg: "Gửi bạn một cái ôm thật ấm áp! Dù hôm nay có áp lực thế nào thì bạn cũng đã làm rất tốt rồi.", emoji: "🤗" },
  { title: "Năng lượng bình an", msg: "Chúc bạn một ngày thảnh thơi, mọi âu lo đều nhẹ nhàng trôi qua như làn mây trắng.", emoji: "🍃" },
  { title: "Luôn có mình đồng hành", msg: "Nếu cần một người lắng nghe, mình luôn ở đây nhé. Chúc bạn luôn giữ được sự an yên.", emoji: "💌" },
  { title: "Dịu dàng với bản thân", msg: "Đừng quá khắt khe với chính mình nhé. Bạn là một sự tồn tại độc nhất và rất đáng trân quý ✨", emoji: "🌸" },
  { title: "Trà ấm cho ngày an lành", msg: "Pha một tách trà ấm và dành vài phút thư giãn cho riêng mình nhé bạn đồng hành!", emoji: "🍵" },
  { title: "Ngủ thật ngon giấc nhé", msg: "Gác lại mọi bộn bề ngoài cánh cửa, chúc bạn có một giấc ngủ thật sâu và an lành 🌙", emoji: "✨" },
  { title: "Bạn đang làm rất tốt!", msg: "Cứ vững tin bước tiếp từng bước nhỏ. Mọi nỗ lực chân thành rồi sẽ đơm hoa thơm trái ngọt.", emoji: "🌱" }
];

// Generate random realistic time for a timeRange
function generateTimeForRange(range: 'morning' | 'noon' | 'sunset' | 'night'): string {
  let h = 8;
  let m = Math.floor(Math.random() * 60);

  switch (range) {
    case 'morning':
      h = Math.floor(6 + Math.random() * 3); // 6:00 to 8:59
      break;
    case 'noon':
      h = Math.floor(11 + Math.random() * 3); // 11:00 to 13:59
      break;
    case 'sunset':
      h = Math.floor(17 + Math.random() * 2); // 17:00 to 18:59
      break;
    case 'night':
      h = Math.floor(20 + Math.random() * 4); // 20:00 to 23:59
      break;
  }

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface SeedDailyActivityOptions {
  targetDate?: string; // YYYY-MM-DD, defaults to today
  activeRatio?: number; // 0.35 to 0.65, default 0.45
  verbose?: boolean;
}

export interface SeedDailyActivityResult {
  success: boolean;
  date: string;
  totalUsers: number;
  activeUsersCount: number;
  newJournalsCount: number;
  newCardsCount: number;
  details: string;
}

/**
 * Seeds realistic daily activities for users on a specified date (or today).
 * Simulates genuine human actions: writing diaries at different times, drinking water,
 * reading books, gratitude cards, pair challenges (including watching healing TikTok clips),
 * and exchanging sweet cards with friends.
 */
export async function seedDailyActivity(options: SeedDailyActivityOptions = {}): Promise<SeedDailyActivityResult> {
  const targetDateStr = options.targetDate || new Date().toISOString().slice(0, 10);
  const activeRatio = options.activeRatio !== undefined ? options.activeRatio : 0.48; // ~48% users active today
  const verbose = options.verbose !== undefined ? options.verbose : true;

  if (verbose) {
    console.log(`\n======================================================`);
    console.log(`🌱 AUTO SEED USER DAILY ACTIVITY FOR DATE: [${targetDateStr}]`);
    console.log(`======================================================`);
  }

  // 1. Fetch all users from db
  const allUsers = await db.getAllUsers();
  const nonAdminUsers = allUsers.filter(u => u.role !== 'admin' && u.role !== 'ADMIN');

  if (nonAdminUsers.length === 0) {
    return {
      success: false,
      date: targetDateStr,
      totalUsers: allUsers.length,
      activeUsersCount: 0,
      newJournalsCount: 0,
      newCardsCount: 0,
      details: "Không tìm thấy người dùng phù hợp để tạo hoạt động."
    };
  }

  // 2. Select a realistic subset of users who log in and are active today
  // Shuffle users
  const shuffled = [...nonAdminUsers].sort(() => Math.random() - 0.5);
  const activeCount = Math.max(25, Math.floor(shuffled.length * activeRatio));
  const activeUsers = shuffled.slice(0, activeCount);

  if (verbose) {
    console.log(`👥 Selected ${activeUsers.length}/${nonAdminUsers.length} users (~${Math.round((activeUsers.length / nonAdminUsers.length) * 100)}%) active today.`);
  }

  const newJournals: any[] = [];
  let newCardsSentCount = 0;
  const updatedUserDocs: any[] = [];

  // Parse target date base
  const [y, m, d] = targetDateStr.split('-').map(Number);

  for (let i = 0; i < activeUsers.length; i++) {
    const user = activeUsers[i];
    const uid = (user._id || user.id).toString();
    const appData = user.appData ? { ...user.appData } : {};

    // Ensure user has calibrated DERS-16 profile
    if (!appData.ders16 || !user.ders16) {
      const ders16 = generateCalibratedDers16(i, targetDateStr);
      appData.ders16 = ders16;
      user.ders16 = ders16;
    }

    // 1. Journal Writing (approx 45% of active users write a journal today)
    const writesJournal = Math.random() < 0.45;
    if (writesJournal) {
      const tpl = DAILY_DIARY_TEMPLATES[Math.floor(Math.random() * DAILY_DIARY_TEMPLATES.length)];
      const text = tpl.texts[Math.floor(Math.random() * tpl.texts.length)];
      const timeStr = generateTimeForRange(tpl.timeRange);
      const [th, tm] = timeStr.split(':').map(Number);
      const journalDateTime = new Date(y, m - 1, d, th, tm, Math.floor(Math.random() * 60));

      const journalId = new mongoose.Types.ObjectId().toString();
      newJournals.push({
        _id: journalId,
        id: journalId,
        userId: uid,
        date: targetDateStr,
        time: timeStr,
        emotion: tpl.emotion,
        text,
        isFavorite: Math.random() > 0.85,
        companionMode: "chi_dan_lang_nghe",
        aiInsight: tpl.aiInsight,
        createdAt: journalDateTime
      });
    }

    // 2. Self-care Habit: Log Water Intake (85% of active users log water)
    if (Math.random() < 0.85) {
      const currentStreak = user.streak || 1;
      appData.waterLog = {
        glasses: Math.floor(5 + Math.random() * 4), // 5 to 8 glasses
        goal: 8,
        streak: Math.min(currentStreak, Math.floor(currentStreak * 0.8) + 1),
        lastUpdated: targetDateStr
      };
    }

    // 3. Self-care Habit: Mindful Reading (30% of active users read today)
    if (Math.random() < 0.30) {
      const book = MINDFUL_BOOKS[Math.floor(Math.random() * MINDFUL_BOOKS.length)];
      const readingSessions = Array.isArray(appData.readingSessions) ? [...appData.readingSessions] : [];
      readingSessions.unshift({
        id: `read_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        date: targetDateStr,
        bookTitle: book.title,
        durationMinutes: [15, 20, 25, 30, 45][Math.floor(Math.random() * 5)],
        quote: book.quote
      });
      // Keep max 10 recent sessions
      appData.readingSessions = readingSessions.slice(0, 10);
    }

    // 4. Self-care Habit: Gratitude Practice (35% of active users write 3 gratitude points)
    if (Math.random() < 0.35) {
      const triplet = GRATITUDE_TRIPLETS[Math.floor(Math.random() * GRATITUDE_TRIPLETS.length)];
      const gratitudeCards = Array.isArray(appData.gratitudeCards) ? [...appData.gratitudeCards] : [];
      gratitudeCards.unshift({
        id: `grat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        date: targetDateStr,
        text1: triplet[0],
        text2: triplet[1],
        text3: triplet[2]
      });
      appData.gratitudeCards = gratitudeCards.slice(0, 10);
    }

    // 5. Thử thách đôi (Pair Challenges): Complete today's TikTok video & breathing challenge
    if (Math.random() < 0.55) {
      const currentChallenges = Array.isArray(appData.pairChallenges) && appData.pairChallenges.length > 0
        ? appData.pairChallenges
        : [
            { id: "pc1", title: "Cùng nhau viết 1 trang nhật ký", points: 2, complete: false, myCompleted: false, companionCompleted: false },
            { id: "pc2", title: "Xem 1 video TikTok chữa lành", points: 2, complete: false, myCompleted: false, companionCompleted: false },
            { id: "pc3", title: "Cùng hít thở nhịp thở bình yên", points: 2, complete: false, myCompleted: false, companionCompleted: false }
          ];

      appData.pairChallenges = currentChallenges.map((ch: any) => {
        if (ch.id === "pc2") {
          // Video TikTok challenge
          return { ...ch, title: "Xem 1 video TikTok chữa lành", myCompleted: true, complete: Math.random() > 0.4 };
        }
        if (ch.id === "pc1" && writesJournal) {
          return { ...ch, myCompleted: true, complete: Math.random() > 0.3 };
        }
        if (ch.id === "pc3") {
          return { ...ch, myCompleted: true, companionCompleted: Math.random() > 0.5, complete: true };
        }
        return ch;
      });
    }

    // 6. Social: Send a Sweet Card to a friend in their circle (approx 25% of active users)
    const friendsList = Array.isArray(appData.friendsList) ? appData.friendsList : [];
    if (friendsList.length > 0 && Math.random() < 0.25) {
      const recipientFriend = friendsList[Math.floor(Math.random() * friendsList.length)];
      const recipientUser = allUsers.find(u => (u._id || u.id).toString() === recipientFriend.userId || u.circleCode === recipientFriend.circleCode);

      if (recipientUser) {
        const cardTpl = SWEET_CARD_TEMPLATES[Math.floor(Math.random() * SWEET_CARD_TEMPLATES.length)];
        const cardTime = generateTimeForRange(Math.random() > 0.5 ? 'noon' : 'sunset');
        const [ch, cm] = cardTime.split(':').map(Number);
        const cardDateObj = new Date(y, m - 1, d, ch, cm);
        const timestampStr = cardDateObj.toLocaleDateString('vi-VN') + ' ' + cardTime;

        const recipientAppData = recipientUser.appData ? { ...recipientUser.appData } : {};
        const receivedCards = Array.isArray(recipientAppData.receivedCards) ? [...recipientAppData.receivedCards] : [];

        receivedCards.unshift({
          id: `card_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          cardTitle: cardTpl.title,
          message: cardTpl.msg,
          emoji: cardTpl.emoji,
          senderName: user.username,
          senderCode: user.circleCode,
          senderUserId: uid,
          senderAvatar: user.avatar || "🌸",
          timestamp: timestampStr,
          isRead: false
        });

        recipientAppData.receivedCards = receivedCards.slice(0, 30);
        recipientUser.appData = recipientAppData;
        newCardsSentCount++;

        // Queue recipient update for fast batch write
        const recipUid = (recipientUser._id || recipientUser.id).toString();
        updatedUserDocs.push({
          userId: recipUid,
          updateData: { appData: recipientAppData }
        });
      }
    }

    // 7. Progression: streak, stars, peace score
    const currentStreak = user.streak || 1;
    const newStreak = currentStreak + 1;
    const earnedStarsToday = Math.floor(3 + Math.random() * 6); // +3 to +8 stars today
    const currentStars = user.stars || (appData.user_stars || 15);
    const newStars = currentStars + earnedStarsToday;
    appData.user_stars = newStars;

    // Slight realistic fluctuation in peaceScore
    const currentPeace = user.peaceScore || 80;
    const newPeace = Math.min(98, Math.max(72, currentPeace + (Math.random() > 0.5 ? 1 : -1)));

    // Mark as active today
    appData.lastActiveDate = targetDateStr;

    const userUpdate = {
      streak: newStreak,
      stars: newStars,
      peaceScore: newPeace,
      lastActiveDate: targetDateStr,
      isActiveToday: true,
      ders16: appData.ders16,
      appData
    };

    updatedUserDocs.push({
      userId: uid,
      updateData: userUpdate
    });
  }

  // 8. Bulk insert new journals in one single fast operation
  if (newJournals.length > 0) {
    await db.bulkCreateJournals(newJournals);
  }

  // 9. Batch update all users in-memory and in MongoDB in a single fast call
  if (updatedUserDocs.length > 0) {
    await db.batchUpdateUsers(updatedUserDocs);
  }

  // 10. Persist updated in-memory state to disk asynchronously
  db.saveCurrentStateToDisk();

  const details = `Đã hoàn tất đồng bộ nhịp điệu cộng đồng ngày (${targetDateStr}): cập nhật ${activeUsers.length} tương tác hoạt động, ${newJournals.length} nhật ký an yên, ${newCardsSentCount} thông điệp kết nối, tối ưu hóa chỉ số thói quen và chuỗi ngày tích cực.`;

  if (verbose) {
    console.log(`\n🎉 HOÀN THÀNH ĐỒNG BỘ NHỊP ĐIỆU CỘNG ĐỒNG NGÀY ${targetDateStr}:`);
    console.log(`- 👥 Tài khoản tương tác hôm nay: ${activeUsers.length} accounts`);
    console.log(`- 📖 Nhật ký an yên cập nhật:     ${newJournals.length} entries`);
    console.log(`- 💌 Thông điệp kết nối trao gửi: ${newCardsSentCount} cards`);
    console.log(`- 💧 Chỉ số thói quen & nhịp điệu: Đã tối ưu hóa theo thời gian thực`);
    console.log(`- 💾 Dữ liệu hệ thống:             Đã lưu trữ an toàn vào CSDL & kho dữ liệu`);
    console.log(`======================================================\n`);
  }

  return {
    success: true,
    date: targetDateStr,
    totalUsers: allUsers.length,
    activeUsersCount: activeUsers.length,
    newJournalsCount: newJournals.length,
    newCardsCount: newCardsSentCount,
    details
  };
}

// CLI Execution Support: npx tsx server/seedActivity.ts
if (process.argv[1] && (process.argv[1].endsWith("seedActivity.ts") || process.argv[1].endsWith("seedActivity.js"))) {
  const args = process.argv.slice(2);
  let targetDate = new Date().toISOString().slice(0, 10);
  let activeRatio = 0.48;

  for (const arg of args) {
    if (arg.startsWith("--date=")) {
      targetDate = arg.split("=")[1];
    } else if (arg.startsWith("--ratio=")) {
      activeRatio = parseFloat(arg.split("=")[1]);
    }
  }

  seedDailyActivity({ targetDate, activeRatio, verbose: true })
    .then((result) => {
      console.log("✅ Seed activity script finished successfully!");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Error in seedActivity script:", err);
      process.exit(1);
    });
}
