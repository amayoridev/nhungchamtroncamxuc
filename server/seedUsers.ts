import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { generateCalibratedDers16 } from "./ders16";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

// 1. Vietnamese Name Pools
const FIRST_NAMES = [
  "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng",
  "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý", "Đinh", "Đoàn", "Lâm", "Trịnh",
  "Mai", "Đào", "Cao", "Hà", "Lương", "Thái", "Tạ", "Châu", "Phùng", "Quách",
  "Tô", "Nghiêm", "Vương", "Tăng", "Hứa", "Trương", "Thạch", "Lục", "Kiều"
];

const MIDDLE_NAMES = [
  "Minh", "Thu", "Thanh", "Hoàng", "Bảo", "Gia", "Khánh", "Quang", "Đức", "Phương",
  "Thùy", "Ngọc", "Anh", "Hải", "Hữu", "Thiên", "Bích", "Tùng", "Cẩm", "Văn",
  "Hoài", "Kim", "Quốc", "Hồng", "Duy", "Như", "Thành", "Diễm", "Tuyết", "Trọng",
  "Yến", "Thục", "Mỹ", "Diệu", "Xuân", "Việt", "Đăng", "Tuấn", "Thảo", "Hà"
];

const LAST_NAMES = [
  "Tuấn", "Anh", "Linh", "Long", "Hà", "Châu", "Huy", "Nhi", "Trang", "Dung",
  "Bách", "Diệp", "Quân", "My", "Thảo", "Minh", "Hương", "Kiệt", "Yến", "Phước",
  "Trúc", "An", "Ngọc", "Dương", "Tú", "Nam", "Thương", "Ngân", "Bảo", "Nhung",
  "Mạnh", "Quỳnh", "Đạt", "Uyên", "Nhân", "Quyên", "Lan", "Khoa", "Tâm", "Hằng",
  "Phúc", "Thịnh", "Thắng", "Vy", "Trinh", "Tiên", "Vinh", "Khôi", "Bình", "Sơn"
];

const AVATARS = [
  "🌸", "🌿", "🌻", "🍃", "🍀", "🌺", "🕊️", "🌼", "☕", "🌙",
  "⭐", "🥑", "🌷", "🍁", "🎨", "🌈", "🧸", "🐱", "🐶", "🍵",
  "🌊", "☁️", "🎋", "🌾", "🦋", "🪴", "🕯️", "🌅", "🍓", "🧁",
  "🤍", "💫", "✨", "🍎", "🍊", "🍋", "🍏", "🍧", "🎈", "🌤️"
];

const MOTTOS = [
  "Lắng nghe để hiểu, yêu thương để chữa lành.",
  "Mỗi ngày trôi qua đều là một món quà đáng trân quý.",
  "Hít vào bình an, thở ra nhẹ nhõm.",
  "Tìm lại sự tĩnh lặng giữa nhịp sống hối hả.",
  "Dịu dàng với chính mình và bao dung với thế giới.",
  "Chữa lành đứa trẻ bên trong, ôm lấy mọi xúc cảm.",
  "Bình yên là một sự lựa chọn từ trong tâm.",
  "Sống chậm lại để cảm nhận trọn vẹn từng khoảnh khắc.",
  "Nuôi dưỡng lòng biết ơn mỗi sớm mai thức dậy.",
  "Mặt trời luôn mọc lại sau những ngày mưa giông.",
  "Tự do là khi lòng không còn vướng bận.",
  "Một tách trà ấm, một cuốn sách hay và một tâm hồn an tĩnh.",
  "Học cách buông bỏ những điều không thuộc về mình.",
  "Yêu thương bản thân là khởi đầu của mọi hạnh phúc.",
  "Từng hơi thở là một bước chân về với hiện tại.",
  "Cảm ơn cuộc đời đã cho ta thêm một ngày để thương yêu.",
  "Gieo hạt mầm bình an vào mảnh đất tâm hồn.",
  "Tâm an vạn sự an, tâm tịnh ngàn hoa nở.",
  "Dù thế giới ngoài kia có ồn ào, lòng mình vẫn giữ góc an yên.",
  "Chân thành với cảm xúc của chính mình."
];

// STRICT EXTENSIONS: ONLY @gmail.com, @outlook.com, @yahoo.com
const EMAIL_DOMAINS = [
  "gmail.com",
  "gmail.com",
  "gmail.com",
  "outlook.com",
  "yahoo.com"
];

const DIARY_TEMPLATES = [
  {
    emotion: "binh_yen",
    texts: [
      "Sáng nay thức dậy sớm hơn thường lệ, pha một ấm trà lài thơm nức rồi ngồi ngắm nắng sớm xuyên qua kẽ lá. Cảm giác cả thế giới như lắng lại, không còn vội vã hay áp lực nào.",
      "Buổi chiều đi bộ quanh bờ hồ, ngắm nhìn dòng người chậm rãi qua lại. Gió mát lành khẽ lướt qua vai, thấy lòng nhẹ bẫng và biết ơn cuộc sống này xiết bao.",
      "Tối nay đọc xong cuốn 'Hiểu Về Trái Tim'. Từng trang sách như soi rọi vào sâu thẳm tâm can, giúp mình học cách đón nhận mọi thứ với tâm thế an hòa.",
      "Dành 15 phút tập thở sâu và thiền định trước giờ ngủ. Cảm nhận từng nhịp thở vào ra, mọi mỏi mệt trong ngày tan biến hết vào hư không.",
      "Một ngày cuối tuần trọn vẹn bên góc ban công nhỏ đầy cây xanh. Nghe một bản nhạc không lời êm dịu và cảm nhận sự an yên từ bên trong."
    ],
    aiInsight: {
      reflection: "Từng câu chữ toát lên sự tĩnh lặng và an hòa tuyệt đẹp trong tâm hồn bạn.",
      reassurance: "Khoảnh khắc được sống chậm lại và cảm nhận trọn vẹn hiện tại là món quà vô giá.",
      lessonId: "giu_tron_binh_yen",
      suggestion: "Tiếp tục duy trì thói quen dành ra 10 phút tĩnh tâm mỗi ngày nhé.",
      quote: "Bình yên không phải là không có bão giông, mà là sự an tĩnh sâu sắc ngay giữa lòng cuộc sống."
    }
  },
  {
    emotion: "vui_ve",
    texts: [
      "Hôm nay dự án ở công ty vừa hoàn thành xuất sắc sau bao ngày cả team cùng nỗ lực! Được sếp và đồng nghiệp khen ngợi, cảm thấy mọi cố gắng đều được đền đáp xứng đáng.",
      "Tự thưởng cho bản thân một buổi hẹn cà phê với đứa bạn thân sau mấy tháng chưa gặp. Ngồi tám đủ thứ chuyện trên đời mà cười muốn xỉu, năng lượng tích cực tràn trề!",
      "Nhận được một món quà bất ngờ từ người thương gửi tặng. Những cử chỉ quan tâm nhỏ bé nhưng đủ làm tim mình ấm áp cả một ngày dài.",
      "Hôm nay nấu được một bữa cơm thật ngon cho cả gia đình. Nhìn mọi người ăn ngon miệng và cười nói vui vẻ, hạnh phúc chỉ đơn giản thế thôi.",
      "Vừa chạy bộ hoàn thành mục tiêu 5km đầu tiên trong đời! Cảm giác vượt qua giới hạn của bản thân thật sự rất phấn khích và tự hào."
    ],
    aiInsight: {
      reflection: "Năng lượng tích cực và nụ cười rạng rỡ của bạn lan tỏa qua từng dòng nhật ký!",
      reassurance: "Bạn xứng đáng đón nhận trọn vẹn niềm vui và hạnh phúc ngọt ngào này.",
      lessonId: "tran_trong_niem_vui",
      suggestion: "Lưu giữ khoảnh khắc này bằng một bức ảnh hoặc chia sẻ niềm vui với người thân yêu.",
      quote: "Niềm vui được sẻ chia là niềm vui nhân đôi. Hãy ôm trọn khoảnh khắc rực rỡ này vào tim!"
    }
  },
  {
    emotion: "met_moi",
    texts: [
      "Hôm nay công việc dồn dập từ sáng tới tối, họp liên tục và xử lý hàng tá deadline. Cơ thể rã rời và mắt mỏi nhừ. Tự nhủ tối nay sẽ đi ngủ thật sớm để sạc lại pin.",
      "Một ngày dài đầy những tình huống ngoài dự tính. Cảm giác như cạn kiệt năng lượng, chỉ muốn trốn vào một góc phòng yên tĩnh để nghỉ ngơi một chút.",
      "Cố gắng cân bằng giữa công việc và cuộc sống cá nhân đôi khi thật khó khăn. Thấy mình hơi quá tải, cần phải học cách từ chối bớt việc không quan trọng.",
      "Đêm muộn mới về đến nhà sau chuyến công tác dài. Cơ thể như muốn đình công. Thả lỏng người trên chiếc giường êm, hít thở sâu và buông bỏ hết âu lo."
    ],
    aiInsight: {
      reflection: "Mình cảm nhận được sự mệt nhoài sau những nỗ lực không ngừng nghỉ của bạn.",
      reassurance: "Bạn đã cố gắng hết sức rồi. Cho phép cơ thể và tâm trí được nghỉ ngơi hoàn toàn nhé.",
      lessonId: "cam_thay_qua_tai",
      suggestion: "Tắm nước ấm, uống một cốc sữa ấm và đi ngủ sớm hơn 45 phút tối nay.",
      quote: "Nghỉ ngơi chính là một phần của hành trình. Hãy dịu dàng với chính mình."
    }
  },
  {
    emotion: "lo_lang",
    texts: [
      "Ngày mai có buổi thuyết trình quan trọng trước ban giám đốc. Dù đã chuẩn bị kỹ lưỡng nhưng trong lòng vẫn có chút bồn chồn và lo lắng không biết mọi thứ có suôn sẻ không.",
      "Đang đứng trước một quyết định chuyển đổi công việc lớn. Nhiều băn khoăn về tương lai và những thử thách phía trước. Cần thêm thời gian để lắng nghe trực giác của mình.",
      "Gần đây có nhiều chuyện xảy ra cùng lúc khiến tâm trí không thể tập trung. Cảm giác bồn chồn khó tả, phải tập hít thở đều để kéo tâm về lại hiện tại."
    ],
    aiInsight: {
      reflection: "Sự lo lắng cho thấy bạn rất có trách nhiệm và quan tâm sâu sắc đến những gì mình làm.",
      reassurance: "Hãy tin vào năng lực và sự chuẩn bị của bản thân. Bạn mạnh mẽ hơn bạn nghĩ rất nhiều.",
      lessonId: "vuot_qua_noi_so",
      suggestion: "Viết ra giấy 3 điều tồi tệ nhất có thể xảy ra và cách bạn sẽ xử lý chúng.",
      quote: "Đừng để nỗi sợ về ngày mai cướp đi sự bình an của ngày hôm nay."
    }
  },
  {
    emotion: "buon_ba",
    texts: [
      "Hôm nay có một chuyện không vui xảy ra giữa mình và một người bạn thân. Cảm giác bị hiểu lầm thật sự rất đau lòng và hụt hẫng.",
      "Trời mưa rả rích cả ngày làm tâm trạng cũng chùng xuống theo. Có những nỗi buồn không tên cứ len lỏi vào tâm trí, chỉ muốn được ai đó ôm một cái thật chặt.",
      "Nhớ nhà, nhớ những bữa cơm gia đình đầm ấm ở quê. Sống xa nhà đôi khi cảm thấy thật chông chênh giữa thành phố đông đúc này."
    ],
    aiInsight: {
      reflection: "Nỗi buồn là một phần tự nhiên của trải nghiệm con người, cho thấy trái tim bạn vẫn luôn nhạy cảm và chân thật.",
      reassurance: "Không sao cả, hãy cho phép mình được buồn. Nước mắt rơi sẽ cuốn trôi những muộn phiền.",
      lessonId: "om_ap_noi_buon",
      suggestion: "Nghe một bản nhạc êm dịu, ôm một chiếc gối ấm hoặc viết hết những cảm xúc này ra giấy.",
      quote: "Sau cơn mưa trời lại sáng, cầu vồng luôn xuất hiện sau những đám mây u ám."
    }
  },
  {
    emotion: "co_don",
    texts: [
      "Đi làm về giữa dòng người tấp nập của phố thị, tự nhiên thấy mình thật cô độc. Về đến phòng trọ vắng tanh, chỉ có tiếng quạt gió kêu đều đều.",
      "Có những tâm tư sâu kín chẳng biết tâm sự cùng ai. Sợ làm phiền người khác nên lại chọn cách giữ chặt trong lòng.",
      "Đêm khuya lướt điện thoại thấy bạn bè ai cũng có đôi có cặp hoặc bận rộn với cuộc sống riêng. Thấy một khoảng trống vô định trong tim."
    ],
    aiInsight: {
      reflection: "Cô đơn là lúc tâm hồn đang muốn bạn quay về kết nối sâu sắc hơn với chính mình.",
      reassurance: "Bạn không hề đơn độc. Ở đây luôn có một không gian an toàn sẵn sàng lắng nghe mọi nỗi niềm của bạn.",
      lessonId: "ket_noi_chinh_minh",
      suggestion: "Gửi một tấm thiệp ngọt ngào cho một người bạn đồng hành trong nhóm hoặc tự thưởng cho mình một món quà nhỏ.",
      quote: "Cô đơn không phải là ở một mình, mà là cơ hội để tìm thấy sự trọn vẹn tự thân."
    }
  },
  {
    emotion: "tuc_gian",
    texts: [
      "Hôm nay bị đồng nghiệp đổ lỗi vô cớ trong cuộc họp nhóm. Lúc đó tức đến mức muốn nói thẳng mặt, nhưng đã cố gắng kiềm chế để không làm to chuyện.",
      "Kẹt xe hơn một tiếng đồng hồ dưới trời nắng gắt cộng thêm người đi đường chen lấn bấm còi inh ỏi làm mình bực bội vô cùng."
    ],
    aiInsight: {
      reflection: "Cơn tức giận xuất hiện khi ranh giới của bạn bị xâm phạm. Việc bạn nhận biết được nó đã là một bước tiến lớn.",
      reassurance: "Bạn đã xử lý rất văn minh bằng cách giữ bình tĩnh. Đừng để năng lượng tiêu cực của người khác chi phối tâm trạng bạn.",
      lessonId: "chuyen_hoa_con_gian",
      suggestion: "Uống một cốc nước mát, rửa mặt bằng nước lạnh và hít thở sâu 5 lần.",
      quote: "Tức giận là tự uống thuốc độc rồi hy vọng người khác chịu đau. Hãy buông xả để tâm nhẹ nhõm."
    }
  }
];

const SWEET_CARD_MESSAGES = [
  { title: "Một cái ôm tinh thần", msg: "Gửi bạn một cái ôm thật ấm áp! Dù hôm nay có mệt mỏi thế nào thì bạn cũng đã làm rất tốt rồi.", emoji: "🤗" },
  { title: "Năng lượng bình an", msg: "Chúc bạn một ngày thảnh thơi, mọi muộn phiền đều nhẹ nhàng trôi qua như làn mây trắng.", emoji: "🍃" },
  { title: "Luôn có mình ở đây", msg: "Nếu cần một người lắng nghe, bạn luôn có thể chia sẻ cùng mình nhé. Luôn đồng hành bên bạn!", emoji: "💌" },
  { title: "Dịu dàng với bản thân", msg: "Đừng quá khắt khe với chính mình. Bạn là một sự tồn tại độc nhất và tuyệt vời trên thế giới này ✨", emoji: "🌸" },
  { title: "Cố lên bạn nhé!", msg: "Mọi khó khăn chỉ là tạm thời thôi. Hãy giữ vững niềm tin và bước tiếp từng bước nhỏ an yên nhé!", emoji: "💪" },
  { title: "Trà ấm cho ngày mưa", msg: "Pha một tách trà ấm và dành chút thời gian yêu thương chính mình nhé bạn đồng hành!", emoji: "🍵" },
  { title: "Ngủ ngon giấc nhé", msg: "Gác lại mọi âu lo ngoài cánh cửa phòng, chúc bạn có một giấc ngủ thật sâu và những giấc mơ đẹp 🌙", emoji: "✨" }
];

const BOOK_TITLES = [
  "Hiểu Về Trái Tim - Thầy Minh Niệm",
  "Muôn Kiếp Nhân Sinh - Nguyên Phong",
  "Bước Chậm Lại Giữa Thế Gian Vội Vã - Hae Min",
  "Cây Cam Ngọt Của Tôi - José Mauro",
  "Hoàng Tử Bé - Antoine de Saint-Exupéry",
  "Tĩnh Lặng - Thích Nhất Hạnh",
  "Hành Trình Về Phương Đông",
  "Tâm Hồn Cao Thượng",
  "Dám Bị Ghét - Kishimi Ichiro",
  "Nghệ Thuật Sống An Lạc"
];

// Utility: Normalize to ascii username
function removeVietnameseTones(str: string) {
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  str = str.replace(/Đ/g, "D");
  return str;
}

export async function generate421Users() {
  console.log("🌱 Starting realistic generation of 421 users (Password: 'moimoi', domains: gmail/outlook/yahoo)...");

  // Hashed password for 'moimoi'
  const defaultHashedPassword = await bcrypt.hash("moimoi", 10);

  const users: any[] = [];
  const usedEmails = new Set<string>();
  const usedCircleCodes = new Set<string>();

  const baseDate = new Date();

  // 1. Generate 421 user profiles
  for (let i = 0; i < 421; i++) {
    const fName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const mName = MIDDLE_NAMES[Math.floor(Math.random() * MIDDLE_NAMES.length)];
    const lName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const fullName = `${fName} ${mName} ${lName}`;

    // Clean username
    const rawClean = removeVietnameseTones(`${lName.toLowerCase()}${mName.toLowerCase()}${fName.toLowerCase()}`);
    const numSuffix = Math.floor(10 + Math.random() * 90);
    const domain = EMAIL_DOMAINS[Math.floor(Math.random() * EMAIL_DOMAINS.length)];
    let email = `${rawClean}${numSuffix}@${domain}`;
    let counter = 1;
    while (usedEmails.has(email)) {
      email = `${rawClean}${numSuffix}${counter}@${domain}`;
      counter++;
    }
    usedEmails.add(email);

    // Unique Circle Code CT_1001 -> CT_9999
    let codeNum = 1001 + i;
    let circleCode = `CT_${codeNum.toString().padStart(4, "0")}`;
    while (usedCircleCodes.has(circleCode)) {
      codeNum = Math.floor(1000 + Math.random() * 8999);
      circleCode = `CT_${codeNum}`;
    }
    usedCircleCodes.add(circleCode);

    // Registration date (spread over the past 120 days)
    const daysAgo = Math.floor(Math.random() * 120);
    const createdAt = new Date(baseDate.getTime() - daysAgo * 24 * 60 * 60 * 1000 - Math.random() * 86400000);

    // Streaks
    let streak = 1;
    const streakRand = Math.random();
    if (streakRand < 0.15) {
      streak = Math.floor(30 + Math.random() * 90);
    } else if (streakRand < 0.6) {
      streak = Math.floor(7 + Math.random() * 23);
    } else if (streakRand < 0.9) {
      streak = Math.floor(2 + Math.random() * 5);
    } else {
      streak = 1;
    }

    const emotionalCircles = Math.min(12, Math.floor(streak / 4) + (Math.random() > 0.5 ? 1 : 0));
    const circlePoints = streak + Math.floor(Math.random() * 5);
    const stars = Math.floor(streak * 2.5 + emotionalCircles * 8 + Math.random() * 50) + 15;
    const peaceScore = Math.floor(65 + Math.random() * 32); // 65 to 97

    const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    const motto = MOTTOS[Math.floor(Math.random() * MOTTOS.length)];

    const id = new mongoose.Types.ObjectId().toString();

    const ders16 = generateCalibratedDers16(i);

    // AppData initialization
    const appData: Record<string, any> = {
      circleCode,
      user_stars: stars,
      ders16,
      waterLog: {
        glasses: Math.floor(4 + Math.random() * 5),
        goal: 8,
        streak: Math.min(streak, Math.floor(1 + Math.random() * 14)),
        lastUpdated: new Date().toISOString().slice(0, 10)
      },
      readingSessions: [
        {
          id: `read_${i}_1`,
          date: new Date(baseDate.getTime() - Math.floor(Math.random() * 10) * 86400000).toISOString().slice(0, 10),
          bookTitle: BOOK_TITLES[Math.floor(Math.random() * BOOK_TITLES.length)],
          durationMinutes: Math.floor(15 + Math.random() * 30),
          quote: "Đọc sách để lòng lắng đọng lại và nhìn thấu bản thân."
        }
      ],
      gratitudeCards: [
        {
          id: `grat_${i}_1`,
          text1: "Biết ơn vì một ngày bình an trôi qua bên những người thân yêu.",
          text2: "Biết ơn tách cà phê thơm dịu buổi sáng tiếp thêm năng lượng.",
          text3: "Biết ơn cơ thể vẫn luôn khỏe mạnh và đồng hành cùng mình.",
          date: new Date(baseDate.getTime() - Math.floor(Math.random() * 5) * 86400000).toISOString().slice(0, 10)
        }
      ],
      pairChallenges: [
        { id: "pc1", title: "Cùng nhau viết 1 trang nhật ký", points: 2, complete: Math.random() > 0.3, myCompleted: true, companionCompleted: Math.random() > 0.4 },
        { id: "pc2", title: "Lắng nghe 1 tập podcast chữa lành", points: 2, complete: Math.random() > 0.5, myCompleted: Math.random() > 0.3, companionCompleted: true },
        { id: "pc3", title: "Cùng hít thở nhịp thở bình yên", points: 2, complete: Math.random() > 0.4, myCompleted: true, companionCompleted: true }
      ],
      user_achievements: ["first_step", "journal_1", "streak_3"],
      friendsList: [],
      friendRequests: [],
      sentFriendRequests: [],
      receivedCards: []
    };

    users.push({
      _id: id,
      id,
      username: fullName,
      email,
      password: defaultHashedPassword,
      role: "user",
      avatar,
      motto,
      circleCode,
      streak,
      circlePoints,
      emotionalCircles,
      stars,
      peaceScore,
      isLocked: false,
      ders16,
      appData,
      createdAt
    });
  }

  // 2. Interconnect friendships and sweet cards among users (Social Graph)
  console.log("🤝 Linking friendships and social network among 421 users...");
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const friendCount = Math.floor(2 + Math.random() * 5); // 2 to 6 friends each

    for (let f = 0; f < friendCount; f++) {
      const friendIndex = (i + Math.floor(1 + Math.random() * (users.length - 1))) % users.length;
      const friend = users[friendIndex];

      if (friend && friend._id !== user._id) {
        // Add to user's friendsList
        if (!user.appData.friendsList.some((existing: any) => existing.userId === friend._id || existing.circleCode === friend.circleCode)) {
          user.appData.friendsList.push({
            id: friend.circleCode,
            userId: friend._id,
            name: friend.username,
            avatar: friend.avatar,
            circleCode: friend.circleCode,
            bio: friend.motto,
            favoriteQuote: "Cùng nhau bình yên mỗi ngày.",
            streak: friend.streak,
            emotionalCircles: friend.emotionalCircles,
            treeLevel: Math.max(1, Math.floor(friend.streak / 3)),
            favoriteEmotion: "binh_yen"
          });
        }

        // Add to friend's friendsList (Two-way friendship)
        if (!friend.appData.friendsList.some((existing: any) => existing.userId === user._id || existing.circleCode === user.circleCode)) {
          friend.appData.friendsList.push({
            id: user.circleCode,
            userId: user._id,
            name: user.username,
            avatar: user.avatar,
            circleCode: user.circleCode,
            bio: user.motto,
            favoriteQuote: "Mỗi ngày trôi qua đều trân quý.",
            streak: user.streak,
            emotionalCircles: user.emotionalCircles,
            treeLevel: Math.max(1, Math.floor(user.streak / 3)),
            favoriteEmotion: "binh_yen"
          });
        }

        // Send a sweet card occasionally
        if (Math.random() > 0.4) {
          const cardTpl = SWEET_CARD_MESSAGES[Math.floor(Math.random() * SWEET_CARD_MESSAGES.length)];
          const cardDate = new Date(baseDate.getTime() - Math.floor(Math.random() * 10) * 86400000);
          user.appData.receivedCards.push({
            id: `card_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            cardTitle: cardTpl.title,
            message: cardTpl.msg,
            emoji: cardTpl.emoji,
            senderName: friend.username,
            senderCode: friend.circleCode,
            senderUserId: friend._id,
            senderAvatar: friend.avatar,
            timestamp: cardDate.toLocaleDateString('vi-VN') + ' ' + cardDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            isRead: Math.random() > 0.3
          });
        }
      }
    }

    // Add 1-2 pending friend requests occasionally
    if (Math.random() > 0.5) {
      const requesterIndex = (i + 15 + Math.floor(Math.random() * 50)) % users.length;
      const requester = users[requesterIndex];
      if (requester && requester._id !== user._id) {
        user.appData.friendRequests.push({
          id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          fromId: requester._id,
          fromName: requester.username,
          fromAvatar: requester.avatar,
          fromCircleCode: requester.circleCode,
          fromBio: requester.motto,
          fromStreak: requester.streak,
          fromEmotionalCircles: requester.emotionalCircles,
          toId: user._id,
          toName: user.username,
          toCircleCode: user.circleCode,
          status: 'pending',
          date: new Date(baseDate.getTime() - Math.floor(Math.random() * 3) * 86400000).toLocaleDateString('vi-VN')
        });
      }
    }
  }

  // 3. Generate Journals for users
  console.log("📖 Generating realistic journals for all users...");
  const journals: any[] = [];
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const journalCount = Math.floor(2 + Math.random() * 8); // 2 to 9 journals per user

    for (let j = 0; j < journalCount; j++) {
      const tpl = DIARY_TEMPLATES[Math.floor(Math.random() * DIARY_TEMPLATES.length)];
      const text = tpl.texts[Math.floor(Math.random() * tpl.texts.length)];

      const journalDate = new Date(baseDate.getTime() - (j * Math.floor(1 + Math.random() * 5)) * 86400000 - Math.random() * 43200000);
      const dateStr = journalDate.toISOString().slice(0, 10);
      const timeStr = `${String(journalDate.getHours()).padStart(2, '0')}:${String(journalDate.getMinutes()).padStart(2, '0')}`;

      journals.push({
        _id: new mongoose.Types.ObjectId().toString(),
        userId: user._id,
        date: dateStr,
        time: timeStr,
        emotion: tpl.emotion,
        text,
        isFavorite: Math.random() > 0.8,
        companionMode: "chi_dan_lang_nghe",
        aiInsight: tpl.aiInsight,
        createdAt: journalDate
      });
    }
  }

  console.log(`✨ Generated ${users.length} users and ${journals.length} journal entries!`);
  return { users, journals };
}

async function runSeed() {
  const { users, journals } = await generate421Users();

  // Save to JSON backup file
  const backupPath = path.join(process.cwd(), "server", "seedData.json");
  fs.writeFileSync(backupPath, JSON.stringify({ users, journals }, null, 2), "utf8");
  console.log(`💾 Saved backup JSON to ${backupPath} (${(fs.statSync(backupPath).size / 1024 / 1024).toFixed(2)} MB)`);

  // If MongoDB is connected, seed directly into MongoDB
  if (MONGODB_URI && MONGODB_URI.trim() !== "") {
    try {
      console.log("🚀 Connecting to MongoDB to insert seeded data...");
      await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
      console.log("🟢 Connected to MongoDB!");

      const usersCollection = mongoose.connection.db.collection("users");
      const journalsCollection = mongoose.connection.db.collection("journals");

      // Preserve existing admin accounts if any exist
      const existingAdmins = await usersCollection.find({ role: "admin" }).toArray();
      console.log(`Preserving ${existingAdmins.length} existing admin accounts...`);

      // Clear all previous non-admin seeded users and all their journals
      console.log("Wiping older non-admin users and journals to seed exact 421 realistic users...");
      const adminEmails = existingAdmins.map(a => a.email.toLowerCase());
      await usersCollection.deleteMany({ email: { $nin: adminEmails } });
      await journalsCollection.deleteMany({});

      // Batch insert users
      const userDocs = users.map(u => ({
        ...u,
        _id: new mongoose.Types.ObjectId(u._id)
      }));

      const CHUNK_SIZE = 150;
      for (let i = 0; i < userDocs.length; i += CHUNK_SIZE) {
        const chunk = userDocs.slice(i, i + CHUNK_SIZE);
        await usersCollection.insertMany(chunk);
        console.log(`Inserted users chunk ${i + 1} to ${Math.min(i + CHUNK_SIZE, userDocs.length)}`);
      }

      // Batch insert journals
      const journalDocs = journals.map(j => ({
        ...j,
        _id: new mongoose.Types.ObjectId(j._id),
        userId: new mongoose.Types.ObjectId(j.userId)
      }));

      for (let i = 0; i < journalDocs.length; i += CHUNK_SIZE) {
        const chunk = journalDocs.slice(i, i + CHUNK_SIZE);
        await journalsCollection.insertMany(chunk);
        console.log(`Inserted journals chunk ${i + 1} to ${Math.min(i + CHUNK_SIZE, journalDocs.length)}`);
      }

      const totalUsers = await usersCollection.countDocuments();
      const totalJournals = await journalsCollection.countDocuments();
      console.log(`🎉 SUCCESS! MongoDB now has ${totalUsers} total users and ${totalJournals} journals!`);

      process.exit(0);
    } catch (err) {
      console.error("MongoDB seed error:", err);
      process.exit(1);
    }
  } else {
    console.log("ℹ️ MONGODB_URI not provided; seed data written to server/seedData.json.");
    process.exit(0);
  }
}

if (process.argv[1] && process.argv[1].endsWith("seedUsers.ts")) {
  runSeed();
}
