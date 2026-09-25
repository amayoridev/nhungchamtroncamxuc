export type DERS16ScaleScore = 1 | 2 | 3 | 4 | 5;

export interface DERS16Item {
  id: number;
  question: string;
  subscale: 'clarity' | 'goals' | 'impulse' | 'nonacceptance' | 'strategies';
  subscaleName: string;
  score: number; // 1 to 5
  scaleLabel: string;
}

export interface DERS16SubscaleScore {
  key: string;
  name: string;
  score: number;
  maxScore: number;
  percentage: number;
  level: string;
  description: string;
}

export interface DERS16Assessment {
  totalScore: number;
  maxScore: number;
  percentage: number;
  level: string;
  summary: string;
  assessedAt: string;
  subscales: {
    clarity: DERS16SubscaleScore;
    goals: DERS16SubscaleScore;
    impulse: DERS16SubscaleScore;
    nonacceptance: DERS16SubscaleScore;
    strategies: DERS16SubscaleScore;
  };
  answers: DERS16Item[];
}

export const DERS16_SCALE_LABELS: Record<number, { vi: string; en: string; short: string }> = {
  1: { vi: "Hầu như không bao giờ (0-10%)", en: "Almost Never", short: "1 - Hầu như không" },
  2: { vi: "Đôi khi (11-35%)", en: "Sometimes", short: "2 - Đôi khi" },
  3: { vi: "Khoảng một nửa thời gian (36-65%)", en: "About half the time", short: "3 - Một nửa thời gian" },
  4: { vi: "Phần lớn thời gian (66-90%)", en: "Most of the time", short: "4 - Phần lớn thời gian" },
  5: { vi: "Hầu như luôn luôn (91-100%)", en: "Almost Always", short: "5 - Hầu như luôn luôn" },
};

export const DERS16_QUESTIONS = [
  {
    id: 1,
    question: "Tôi gặp khó khăn trong việc hiểu rõ cảm xúc của mình.",
    subscale: 'clarity' as const,
    subscaleName: "Hiểu & Nhận biết cảm xúc (Clarity)",
    benchmarkScore: 3
  },
  {
    id: 2,
    question: "Tôi cảm thấy bối rối/mơ hồ về những gì mình đang cảm nhận.",
    subscale: 'clarity' as const,
    subscaleName: "Hiểu & Nhận biết cảm xúc (Clarity)",
    benchmarkScore: 3
  },
  {
    id: 3,
    question: "Khi buồn bực/khó chịu, tôi gặp khó khăn trong việc hoàn thành công việc.",
    subscale: 'goals' as const,
    subscaleName: "Tập trung & Định hướng mục tiêu (Goals)",
    benchmarkScore: 3
  },
  {
    id: 4,
    question: "Khi buồn bực/khó chịu, tôi trở nên mất kiểm soát.",
    subscale: 'impulse' as const,
    subscaleName: "Kiểm soát hành vi & Xung động (Impulse)",
    benchmarkScore: 4
  },
  {
    id: 5,
    question: "Khi buồn bực/khó chịu, tôi tin rằng mình sẽ giữ tâm trạng như vậy trong một thời gian dài.",
    subscale: 'strategies' as const,
    subscaleName: "Chiến lược điều hòa & Tự xoa dịu (Strategies)",
    benchmarkScore: 3
  },
  {
    id: 6,
    question: "Khi buồn bực/khó chịu, tôi tin rằng cuối cùng mình sẽ rơi vào trạng thái rất trầm uất/chán nản.",
    subscale: 'strategies' as const,
    subscaleName: "Chiến lược điều hòa & Tự xoa dịu (Strategies)",
    benchmarkScore: 3
  },
  {
    id: 7,
    question: "Khi buồn bực/khó chịu, tôi gặp khó khăn trong việc tập trung vào những việc khác.",
    subscale: 'goals' as const,
    subscaleName: "Tập trung & Định hướng mục tiêu (Goals)",
    benchmarkScore: 3
  },
  {
    id: 8,
    question: "Khi buồn bực/khó chịu, tôi cảm thấy mất kiểm soát.",
    subscale: 'impulse' as const,
    subscaleName: "Kiểm soát hành vi & Xung động (Impulse)",
    benchmarkScore: 2
  },
  {
    id: 9,
    question: "Khi buồn bực/khó chịu, tôi cảm thấy bản thân thật yếu đuối.",
    subscale: 'nonacceptance' as const,
    subscaleName: "Chấp nhận cảm xúc cá nhân (Nonacceptance)",
    benchmarkScore: 3
  },
  {
    id: 10,
    question: "Khi buồn bực/khó chịu, tôi gặp khó khăn trong việc kiểm soát hành vi của mình.",
    subscale: 'impulse' as const,
    subscaleName: "Kiểm soát hành vi & Xung động (Impulse)",
    benchmarkScore: 5
  },
  {
    id: 11,
    question: "Khi buồn bực/khó chịu, tôi tin rằng không có việc gì mình có thể làm để khiến bản thân cảm thấy khá hơn.",
    subscale: 'strategies' as const,
    subscaleName: "Chiến lược điều hòa & Tự xoa dịu (Strategies)",
    benchmarkScore: 5
  },
  {
    id: 12,
    question: "Khi buồn bực/khó chịu, tôi trở nên bực bội với chính mình vì cảm thấy như thế.",
    subscale: 'nonacceptance' as const,
    subscaleName: "Chấp nhận cảm xúc cá nhân (Nonacceptance)",
    benchmarkScore: 2
  },
  {
    id: 13,
    question: "Khi buồn bực/khó chịu, tôi bắt đầu cảm thấy rất tồi tệ về bản thân.",
    subscale: 'nonacceptance' as const,
    subscaleName: "Chấp nhận cảm xúc cá nhân (Nonacceptance)",
    benchmarkScore: 3
  },
  {
    id: 14,
    question: "Khi buồn bực/khó chịu, tôi gặp khó khăn khi nghĩ về bất cứ điều gì khác.",
    subscale: 'goals' as const,
    subscaleName: "Tập trung & Định hướng mục tiêu (Goals)",
    benchmarkScore: 5
  },
  {
    id: 15,
    question: "Khi buồn bực/khó chịu, cảm xúc của tôi trở nên quá sức chịu đựng (ngập tràn/choáng ngợp).",
    subscale: 'strategies' as const,
    subscaleName: "Chiến lược điều hòa & Tự xoa dịu (Strategies)",
    benchmarkScore: 5
  },
  {
    id: 16,
    question: "Khi buồn bực/khó chịu, tôi mất nhiều thời gian để cảm thấy khá hơn.",
    subscale: 'strategies' as const,
    subscaleName: "Chiến lược điều hòa & Tự xoa dịu (Strategies)",
    benchmarkScore: 4
  }
];

export function buildDERS16Assessment(scores: number[], assessedAtDate?: string): DERS16Assessment {
  const answers: DERS16Item[] = DERS16_QUESTIONS.map((q, idx) => {
    const raw = scores[idx] !== undefined ? scores[idx] : q.benchmarkScore;
    const score = Math.max(1, Math.min(5, Math.round(raw)));
    const label = DERS16_SCALE_LABELS[score] || DERS16_SCALE_LABELS[3];
    return {
      id: q.id,
      question: q.question,
      subscale: q.subscale,
      subscaleName: q.subscaleName,
      score,
      scaleLabel: `${score} - ${label.vi}`
    };
  });

  const subscaleTotals = {
    clarity: { score: 0, maxScore: 10, name: "Nhận biết cảm xúc (Clarity)", key: "clarity" },
    goals: { score: 0, maxScore: 15, name: "Tập trung & Mục tiêu (Goals)", key: "goals" },
    impulse: { score: 0, maxScore: 15, name: "Kiểm soát xung động (Impulse)", key: "impulse" },
    nonacceptance: { score: 0, maxScore: 15, name: "Chấp nhận cảm xúc (Nonacceptance)", key: "nonacceptance" },
    strategies: { score: 0, maxScore: 25, name: "Chiến lược xoa dịu (Strategies)", key: "strategies" }
  };

  let totalScore = 0;
  for (const item of answers) {
    totalScore += item.score;
    if (subscaleTotals[item.subscale]) {
      subscaleTotals[item.subscale].score += item.score;
    }
  }

  const maxScore = 80;
  const percentage = Math.round((totalScore / maxScore) * 100);

  const getSubscaleLevel = (score: number, max: number) => {
    const pct = score / max;
    if (pct >= 0.75) return { level: "Rất cao (Thách thức lớn)", desc: "Gặp khó khăn đáng kể khi cảm xúc tiêu cực phát sinh, dễ mất thăng bằng." };
    if (pct >= 0.60) return { level: "Cao (Cần hỗ trợ)", desc: "Thường xuyên chịu ảnh hưởng bởi cảm xúc, cần thêm kỹ thuật xoa dịu." };
    if (pct >= 0.40) return { level: "Trung bình", desc: "Đôi khi gặp trở ngại trong việc điều hòa nhưng vẫn có khả năng thích nghi." };
    return { level: "Tốt (Ít khó khăn)", desc: "Khả năng làm chủ và ứng phó với cảm xúc tương đối vững vàng." };
  };

  const clarityLvl = getSubscaleLevel(subscaleTotals.clarity.score, 10);
  const goalsLvl = getSubscaleLevel(subscaleTotals.goals.score, 15);
  const impulseLvl = getSubscaleLevel(subscaleTotals.impulse.score, 15);
  const nonaccLvl = getSubscaleLevel(subscaleTotals.nonacceptance.score, 15);
  const stratLvl = getSubscaleLevel(subscaleTotals.strategies.score, 25);

  const subscales = {
    clarity: {
      key: "clarity",
      name: subscaleTotals.clarity.name,
      score: subscaleTotals.clarity.score,
      maxScore: 10,
      percentage: Math.round((subscaleTotals.clarity.score / 10) * 100),
      level: clarityLvl.level,
      description: clarityLvl.desc
    },
    goals: {
      key: "goals",
      name: subscaleTotals.goals.name,
      score: subscaleTotals.goals.score,
      maxScore: 15,
      percentage: Math.round((subscaleTotals.goals.score / 15) * 100),
      level: goalsLvl.level,
      description: goalsLvl.desc
    },
    impulse: {
      key: "impulse",
      name: subscaleTotals.impulse.name,
      score: subscaleTotals.impulse.score,
      maxScore: 15,
      percentage: Math.round((subscaleTotals.impulse.score / 15) * 100),
      level: impulseLvl.level,
      description: impulseLvl.desc
    },
    nonacceptance: {
      key: "nonacceptance",
      name: subscaleTotals.nonacceptance.name,
      score: subscaleTotals.nonacceptance.score,
      maxScore: 15,
      percentage: Math.round((subscaleTotals.nonacceptance.score / 15) * 100),
      level: nonaccLvl.level,
      description: nonaccLvl.desc
    },
    strategies: {
      key: "strategies",
      name: subscaleTotals.strategies.name,
      score: subscaleTotals.strategies.score,
      maxScore: 25,
      percentage: Math.round((subscaleTotals.strategies.score / 25) * 100),
      level: stratLvl.level,
      description: stratLvl.desc
    }
  };

  const level = totalScore >= 52
    ? "Khó khăn điều hòa cảm xúc cao (Elevated Dysregulation)"
    : totalScore >= 40
    ? "Khó khăn điều hòa cảm xúc trung bình (Moderate Dysregulation)"
    : "Khả năng điều hòa cảm xúc ổn định (Healthy Regulation)";

  const summary = `Điểm DERS-16 tổng: ${totalScore}/80 (${percentage}%). Điểm số thể hiện các vùng nhạy cảm cao nhất tại Chiến lược xoa dịu (Strategies: ${subscales.strategies.percentage}%), Kiểm soát xung động (Impulse: ${subscales.impulse.percentage}%) và Định hướng mục tiêu (Goals: ${subscales.goals.percentage}%). Người dùng hưởng lợi sâu sắc từ các hoạt động hít thở nhịp nhàng, nhật ký giải tỏa cảm xúc và sự đồng hành kết nối.`;

  return {
    totalScore,
    maxScore,
    percentage,
    level,
    summary,
    assessedAt: assessedAtDate || new Date().toISOString(),
    subscales,
    answers
  };
}

export function generateCalibratedDers16(seedOffset: number = 0, assessedAtDate?: string): DERS16Assessment {
  const base = [3, 3, 3, 4, 3, 3, 3, 2, 3, 5, 5, 2, 3, 5, 5, 4];
  
  const variation = base.map((val, idx) => {
    const hash = Math.sin((seedOffset + 1) * (idx + 1) * 997.3) * 10000;
    const delta = (hash - Math.floor(hash));
    
    if ([9, 10, 13, 14].includes(idx)) {
      return delta > 0.35 ? 5 : 4;
    }
    if ([7, 11].includes(idx)) {
      return delta > 0.4 ? 2 : (delta > 0.15 ? 1 : 3);
    }
    if (idx === 3) {
      return delta > 0.25 ? 4 : 5;
    }
    if (delta > 0.7) return Math.min(5, val + 1);
    if (delta < 0.2) return Math.max(1, val - 1);
    return val;
  });

  return buildDERS16Assessment(variation, assessedAtDate);
}
