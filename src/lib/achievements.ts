import { getScopedItem, setScopedItem, getUserScopeId, getExactUserId } from './scopedStorage';

export interface BadgeStatus {
  id: string;
  title: string;
  description: string;
  emoji: string;
  category: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  currentProgress: number;
  targetProgress: number;
  unlockedAt?: string;
  pointsReward: number;
  isUnlocked: boolean;
}

export interface AchievementLog {
  id: string;
  badgeId?: string;
  title: string;
  points: number;
  stars?: number;
  date: string;
  timestamp: number;
  timeStr: string;
  category: string;
  emoji: string;
}

export function getBadgesStatus(streak: number = 0, journalCount: number = 0, userOrId?: any): BadgeStatus[] {
  const scopeId = typeof userOrId === 'string' ? userOrId : getUserScopeId(userOrId);

  // 1. Water
  const waterGlasses = getScopedItem('selfcare_water_glasses', [], scopeId);
  const waterCount = Array.isArray(waterGlasses) ? waterGlasses.filter(Boolean).length : 0;
  const isWaterUnlocked = waterCount >= 1;

  // 2. Breath - strictly check if completed on today's date
  const todayStr = new Date().toLocaleDateString('sv-SE');
  const breathDate = getScopedItem<string>('selfcare_breath_completed_date', '', scopeId);
  const isBreathUnlocked = Boolean(breathDate && breathDate === todayStr);

  // 3. Gratitude
  const gratitudeVal = getScopedItem<any>('selfcare_gratitude_saved', false, scopeId);
  const gratitudeSaved = gratitudeVal === true || gratitudeVal === 'true';
  const gratitudeTexts = getScopedItem('selfcare_gratitude_texts', null, scopeId);
  let hasGratitudeContent = false;
  if (gratitudeTexts && typeof gratitudeTexts === 'object') {
    hasGratitudeContent = Boolean((gratitudeTexts.card1 && gratitudeTexts.card1.trim()) || (gratitudeTexts.card2 && gratitudeTexts.card2.trim()) || (gratitudeTexts.card3 && gratitudeTexts.card3.trim()));
  }
  const isGratitudeUnlocked = gratitudeSaved && hasGratitudeContent;

  // 4. Meditation
  const meditationVal = getScopedItem<any>('selfcare_meditation_completed', false, scopeId);
  const isMeditationUnlocked = meditationVal === true || meditationVal === 'true';

  // 5. Journaling
  let totalJournal = journalCount;
  if (!totalJournal) {
    const journalList = getScopedItem(`journals_${scopeId}`, getScopedItem('journal_entries', [], scopeId), scopeId);
    if (Array.isArray(journalList)) {
      totalJournal = journalList.length;
    }
  }
  const isJournalUnlocked = totalJournal > 0;

  // 6. Exercise
  const exercises = getScopedItem('selfcare_exercises', [], scopeId);
  let isExerciseUnlocked = false;
  if (Array.isArray(exercises)) {
    isExerciseUnlocked = exercises.some((e: any) => e && e.completed);
  }

  // 7. Reading
  const readHist = getScopedItem('selfcare_read_history', [], scopeId);
  let isReadingUnlocked = false;
  if (Array.isArray(readHist)) {
    isReadingUnlocked = readHist.length > 0;
  }

  // 8 & 9. Streaks
  const appStreak = streak || getScopedItem('app_streak', 1, scopeId);
  const isStreak3Unlocked = appStreak >= 3;
  const isStreak7Unlocked = appStreak >= 7;

  // 10. Healthy Eating
  const meals = getScopedItem('selfcare_meals', [], scopeId);
  const checkedMealsCount = Array.isArray(meals) ? meals.filter((m: any) => m && m.checked).length : 0;
  const totalMealsCount = Array.isArray(meals) && meals.length > 0 ? meals.length : 4;
  const isAllMealsChecked = checkedMealsCount >= totalMealsCount;

  let healthyEatingDays = getScopedItem<string[]>('selfcare_healthy_eating_days', [], scopeId);
  if (!Array.isArray(healthyEatingDays)) healthyEatingDays = [];

  if (isAllMealsChecked) {
    if (!healthyEatingDays.includes(todayStr)) {
      healthyEatingDays = [...healthyEatingDays, todayStr];
      setScopedItem('selfcare_healthy_eating_days', healthyEatingDays, scopeId);
    }
  } else {
    if (healthyEatingDays.includes(todayStr)) {
      healthyEatingDays = healthyEatingDays.filter(d => d !== todayStr);
      setScopedItem('selfcare_healthy_eating_days', healthyEatingDays, scopeId);
    }
  }

  // 11. Sleep (Giấc Ngủ Trọn Vẹn) - Check if saved sleep today achieved 6.0 - 8.0 hours
  const sleepCompletedDate = getScopedItem<string>('selfcare_sleep_completed_date', '', scopeId);
  const sleepLogs = getScopedItem('selfcare_sleep_journal', [], scopeId);
  const todayFormattedVN = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  let isSleepUnlocked = Boolean(sleepCompletedDate && sleepCompletedDate === todayStr);
  if (!isSleepUnlocked && Array.isArray(sleepLogs)) {
    isSleepUnlocked = sleepLogs.some((l: any) => {
      if (!l) return false;
      const isToday = l.date === todayFormattedVN || l.date === todayStr;
      const duration = l.durationHours ?? (parseFloat(l.hours) || 0);
      return isToday && (l.isQualified === true || (duration >= 6.0 && duration <= 8.0));
    });
  }

  return [
    {
      id: 'b_eat_1',
      title: 'Thói Quen Ăn Lành Mạnh',
      description: 'Hoàn thành 100% (4/4 mục) Bữa Ăn Lành Mạnh trong ngày để nuôi dưỡng cơ thể thanh nhẹ.',
      emoji: '🥗',
      category: 'eating',
      bgColor: 'bg-[#C2D772]/30',
      borderColor: 'border-[#A8BD55]',
      textColor: 'text-[#2B4212]',
      currentProgress: checkedMealsCount,
      targetProgress: totalMealsCount,
      unlockedAt: isAllMealsChecked ? 'Đã đạt' : undefined,
      pointsReward: 1,
      isUnlocked: isAllMealsChecked
    },
    {
      id: 'b1',
      title: 'Hiệp Sĩ Uống Nước',
      description: 'Hôm nay bạn đã nạp đủ nước cho cơ thể chưa? Thử 1 ly nước tinh khiết ngay nhé!',
      emoji: '💧',
      category: 'self_care',
      bgColor: 'bg-[#AFDCF1]/40',
      borderColor: 'border-[#8BC5E3]',
      textColor: 'text-[#1E3A5F]',
      currentProgress: waterCount,
      targetProgress: 8,
      unlockedAt: isWaterUnlocked ? 'Đã đạt' : undefined,
      pointsReward: 1,
      isUnlocked: isWaterUnlocked
    },
    {
      id: 'b_sleep_1',
      title: 'Giấc Ngủ Trọn Vẹn',
      description: 'Ngủ đủ giấc từ 6 - 8 tiếng mỗi đêm để tái tạo năng lượng và nuôi dưỡng cơ thể thanh nhẹ.',
      emoji: '🌙',
      category: 'self_care',
      bgColor: 'bg-[#AFDCF1]/40',
      borderColor: 'border-[#8BC5E3]',
      textColor: 'text-[#1E3A5F]',
      currentProgress: isSleepUnlocked ? 1 : 0,
      targetProgress: 1,
      unlockedAt: isSleepUnlocked ? 'Đã đạt' : undefined,
      pointsReward: 1,
      isUnlocked: isSleepUnlocked
    },
    {
      id: 'b2',
      title: 'Tâm Trí Tươi Mát',
      description: 'Hít vào thật sâu, thở ra nhẹ nhàng... Dành vài giây thả lỏng tâm trí hôm nay nhé!',
      emoji: '🌬️',
      category: 'self_care',
      bgColor: 'bg-[#FFEEB6]/60',
      borderColor: 'border-[#E8CF7A]',
      textColor: 'text-[#4D3E00]',
      currentProgress: isBreathUnlocked ? 1 : 0,
      targetProgress: 1,
      unlockedAt: isBreathUnlocked ? 'Đã đạt' : undefined,
      pointsReward: 1,
      isUnlocked: isBreathUnlocked
    },
    {
      id: 'b3',
      title: 'Trái Tim Biết Ơn',
      description: 'Nhớ về một điều nho nhỏ khiến bạn mỉm cười hôm nay và lưu giữ lại nhé!',
      emoji: '💖',
      category: 'mindfulness',
      bgColor: 'bg-[#FFD7D5]/60',
      borderColor: 'border-[#F2B6B3]',
      textColor: 'text-[#5A1A24]',
      currentProgress: isGratitudeUnlocked ? 1 : 0,
      targetProgress: 1,
      unlockedAt: isGratitudeUnlocked ? 'Đã đạt' : undefined,
      pointsReward: 1,
      isUnlocked: isGratitudeUnlocked
    },
    {
      id: 'b4',
      title: 'Bậc Thầy Thiền Định',
      description: 'Tạm dừng bận rộn, lắng nghe nhịp thở để tìm lại sự an yên bên trong.',
      emoji: '🧘',
      category: 'mindfulness',
      bgColor: 'bg-[#FFB6BD]/50',
      borderColor: 'border-[#F89CA7]',
      textColor: 'text-[#4A121A]',
      currentProgress: isMeditationUnlocked ? 1 : 0,
      targetProgress: 1,
      unlockedAt: isMeditationUnlocked ? 'Đã đạt' : undefined,
      pointsReward: 1,
      isUnlocked: isMeditationUnlocked
    },
    {
      id: 'b5',
      title: 'Sổ Tay Tâm Sự',
      description: 'Gửi gắm suy nghĩ của bạn vào trang nhật ký nhỏ để lòng nhẹ nhàng hơn.',
      emoji: '📓',
      category: 'journal',
      bgColor: 'bg-[#AFDCF1]/40',
      borderColor: 'border-[#8BC5E3]',
      textColor: 'text-[#1E3A5F]',
      currentProgress: totalJournal > 0 ? 1 : 0,
      targetProgress: 1,
      unlockedAt: isJournalUnlocked ? 'Đã đạt' : undefined,
      pointsReward: 1,
      isUnlocked: isJournalUnlocked
    },
    {
      id: 'b6',
      title: 'Chiến Binh Vận Động',
      description: 'Đứng dậy vươn vai hoặc duỗi cơ nhẹ nhàng để đánh thức nguồn năng lượng tươi mới!',
      emoji: '🏃',
      category: 'self_care',
      bgColor: 'bg-[#FFEEB6]/60',
      borderColor: 'border-[#E8CF7A]',
      textColor: 'text-[#4D3E00]',
      currentProgress: isExerciseUnlocked ? 1 : 0,
      targetProgress: 1,
      unlockedAt: isExerciseUnlocked ? 'Đã đạt' : undefined,
      pointsReward: 1,
      isUnlocked: isExerciseUnlocked
    },
    {
      id: 'b7',
      title: 'Trí Tuệ Nở Hoa',
      description: 'Mở một trang sách hay và đắm mình trong những trang tư duy dịu lành.',
      emoji: '📖',
      category: 'self_care',
      bgColor: 'bg-[#FFD7D5]/60',
      borderColor: 'border-[#F2B6B3]',
      textColor: 'text-[#5A1A24]',
      currentProgress: isReadingUnlocked ? 1 : 0,
      targetProgress: 1,
      unlockedAt: isReadingUnlocked ? 'Đã đạt' : undefined,
      pointsReward: 1,
      isUnlocked: isReadingUnlocked
    },
    {
      id: 'b8',
      title: 'Chuỗi Kiên Trì 3 Ngày',
      description: 'Tự chăm sóc bản thân liên tục trong 3 ngày để gieo mầm thói quen tích cực.',
      emoji: '🔥',
      category: 'streak',
      bgColor: 'bg-[#FFB6BD]/50',
      borderColor: 'border-[#F89CA7]',
      textColor: 'text-[#4A121A]',
      currentProgress: Math.min(appStreak, 3),
      targetProgress: 3,
      unlockedAt: isStreak3Unlocked ? 'Đã đạt' : undefined,
      pointsReward: 1,
      isUnlocked: isStreak3Unlocked
    },
    {
      id: 'b9',
      title: 'Chuỗi Kiên Trì 7 Ngày',
      description: 'Tự chăm sóc bản thân trọn vẹn 7 ngày để hoa kiên trì nở rộ rạng rỡ.',
      emoji: '🌟',
      category: 'streak',
      bgColor: 'bg-[#FFEEB6]/60',
      borderColor: 'border-[#E8CF7A]',
      textColor: 'text-[#4D3E00]',
      currentProgress: Math.min(appStreak, 7),
      targetProgress: 7,
      unlockedAt: isStreak7Unlocked ? 'Đã đạt' : undefined,
      pointsReward: 1,
      isUnlocked: isStreak7Unlocked
    }
  ];
}

export function addStarHistoryLog(
  title: string,
  points: number = 1,
  emoji: string = '⭐',
  category: string = 'Thành tựu',
  badgeId?: string,
  userOrId?: any,
  customDate?: string,
  customTimestamp?: number
) {
  const scopeId = typeof userOrId === 'string' ? userOrId : getUserScopeId(userOrId);
  const now = customTimestamp ? new Date(customTimestamp) : new Date();
  const dateStr = customDate || now.toLocaleDateString('sv-SE');
  const timestamp = customTimestamp || now.getTime();

  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const timeStr = `${hours}:${mins} - ${day}/${month}/${year}`;

  let logs: AchievementLog[] = getScopedItem('achievement_logs', getScopedItem('star_history', [], scopeId), scopeId);
  if (!Array.isArray(logs)) logs = [];

  // Check if identical log for this badgeId and date already exists to prevent duplicate logs on same day
  if (badgeId) {
    const alreadyExists = logs.some(
      (l) => (l.badgeId === badgeId && l.date === dateStr) ||
             (l.badgeId === badgeId && !l.date && l.title.includes(title))
    );
    if (alreadyExists) return logs;
  }

  const cleanTitle = title.startsWith('Mở khóa thành tựu:') ? title : `Mở khóa thành tựu: ${title}`;

  const newLog: AchievementLog = {
    id: `star_${badgeId || 'custom'}_${timestamp}_${Math.random().toString(36).substring(2, 6)}`,
    badgeId,
    title: cleanTitle,
    points,
    stars: points,
    date: dateStr,
    timestamp,
    timeStr,
    category,
    emoji
  };

  const updated = [newLog, ...logs];
  
  // Sort newest first
  updated.sort((a, b) => {
    const timeA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp || a.date).getTime() || 0;
    const timeB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp || b.date).getTime() || 0;
    return timeB - timeA;
  });

  setScopedItem('achievement_logs', updated, scopeId);
  setScopedItem('star_history', updated, scopeId);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`star_history_${scopeId}`, JSON.stringify(updated));
      localStorage.setItem(`user_history_${scopeId}`, JSON.stringify(updated));
    } catch {}
    window.dispatchEvent(new CustomEvent('add-achievement-log', { detail: newLog }));
    window.dispatchEvent(new CustomEvent('achievement-stars-updated'));
  }

  return updated;
}

export function syncUnlockedBadgesToHistory(streak: number = 0, journalCount: number = 0, userOrId?: any) {
  const scopeId = typeof userOrId === 'string' ? userOrId : getUserScopeId(userOrId);
  const badges = getBadgesStatus(streak, journalCount, scopeId);
  
  let logs: AchievementLog[] = getScopedItem('achievement_logs', getScopedItem('star_history', [], scopeId), scopeId);
  if (!Array.isArray(logs)) logs = [];
  let updated = false;

  const now = new Date();
  const todayStr = now.toLocaleDateString('sv-SE');
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const timeStr = `${hours}:${mins} - ${day}/${month}/${year}`;

  // 1. Backfill all currently unlocked badges that are missing from history
  for (const b of badges) {
    if (b.isUnlocked) {
      const exists = logs.some((l) => l.badgeId === b.id || (l.title && l.title.includes(b.title)));
      if (!exists) {
        const categoryLabel = 
          b.category === 'eating' ? 'Ăn uống' :
          b.category === 'self_care' ? 'Thói quen' :
          b.category === 'journal' ? 'Nhật ký' :
          b.category === 'streak' ? 'Chuỗi ngày' : 'Tâm trí';

        const newLog: AchievementLog = {
          id: `star_${b.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          badgeId: b.id,
          title: `Mở khóa thành tựu: ${b.title}`,
          points: b.pointsReward || 1,
          stars: b.pointsReward || 1,
          date: todayStr,
          timestamp: Date.now(),
          timeStr,
          category: categoryLabel,
          emoji: b.emoji || '✨'
        };
        logs = [newLog, ...logs];
        updated = true;
      }
    }
  }

  // 2. Backfill historical healthy eating days (from selfcare_healthy_eating_days)
  const healthyEatingDays = getScopedItem<string[]>('selfcare_healthy_eating_days', [], scopeId);
  if (Array.isArray(healthyEatingDays)) {
    for (const dStr of healthyEatingDays) {
      if (typeof dStr === 'string' && dStr.includes('-')) {
        const existsForDate = logs.some(l => (l.badgeId === 'b_eat_1' || l.title.includes('Ăn Lành Mạnh')) && l.date === dStr);
        if (!existsForDate) {
          const parts = dStr.split('-');
          const logYear = parts[0];
          const logMonth = parts[1];
          const logDay = parts[2];
          const logTime = new Date(`${dStr}T12:00:00`).getTime() || Date.now();
          const newLog: AchievementLog = {
            id: `star_b_eat_1_${dStr}_${Math.random().toString(36).substring(2, 6)}`,
            badgeId: 'b_eat_1',
            title: 'Mở khóa thành tựu: Thói Quen Ăn Lành Mạnh',
            points: 1,
            stars: 1,
            date: dStr,
            timestamp: logTime,
            timeStr: `12:00 - ${logDay}/${logMonth}/${logYear}`,
            category: 'Ăn uống',
            emoji: '🥗'
          };
          logs = [newLog, ...logs];
          updated = true;
        }
      }
    }
  }

  // 3. Backfill journals if any exist
  const journals = getScopedItem(`journals_${scopeId}`, getScopedItem('journal_entries', [], scopeId), scopeId);
  if (Array.isArray(journals) && journals.length > 0) {
    for (const j of journals) {
      if (j && j.date) {
        const jDate = j.date;
        const existsForDate = logs.some(l => (l.badgeId === 'b5' || l.title.includes('Sổ Tay Tâm Sự')) && l.date === jDate);
        if (!existsForDate) {
          const parts = jDate.includes('-') ? jDate.split('-') : ['', '', ''];
          const logTime = j.timestamp || new Date(jDate).getTime() || Date.now();
          const newLog: AchievementLog = {
            id: `star_b5_${j.id || jDate}_${Math.random().toString(36).substring(2, 6)}`,
            badgeId: 'b5',
            title: 'Mở khóa thành tựu: Sổ Tay Tâm Sự',
            points: 1,
            stars: 1,
            date: jDate,
            timestamp: logTime,
            timeStr: j.time ? `${j.time} - ${parts[2]}/${parts[1]}/${parts[0]}` : `10:00 - ${parts[2]}/${parts[1]}/${parts[0]}`,
            category: 'Nhật ký',
            emoji: '📓'
          };
          logs = [newLog, ...logs];
          updated = true;
        }
      }
    }
  }

  // 4. Backfill reading history if any exist
  const readHistory = getScopedItem('selfcare_read_history', [], scopeId);
  if (Array.isArray(readHistory) && readHistory.length > 0) {
    for (const r of readHistory) {
      if (r) {
        const rDate = r.date || (r.timestamp ? new Date(r.timestamp).toLocaleDateString('sv-SE') : todayStr);
        const existsForDate = logs.some(l => (l.badgeId === 'b7' || l.title.includes('Trí Tuệ Nở Hoa')) && l.date === rDate);
        if (!existsForDate) {
          const logTime = r.timestamp || new Date(rDate).getTime() || Date.now();
          const newLog: AchievementLog = {
            id: `star_b7_${logTime}_${Math.random().toString(36).substring(2, 6)}`,
            badgeId: 'b7',
            title: 'Mở khóa thành tựu: Trí Tuệ Nở Hoa',
            points: 1,
            stars: 1,
            date: rDate,
            timestamp: logTime,
            timeStr: timeStr,
            category: 'Thói quen',
            emoji: '📖'
          };
          logs = [newLog, ...logs];
          updated = true;
        }
      }
    }
  }

  // 5. Backfill sleep logs if any exist with duration 6.0 - 8.0 hours
  const sleepJournal = getScopedItem('selfcare_sleep_journal', [], scopeId);
  if (Array.isArray(sleepJournal) && sleepJournal.length > 0) {
    for (const s of sleepJournal) {
      if (s) {
        const duration = s.durationHours ?? (parseFloat(s.hours) || 0);
        const qualified = s.isQualified === true || (duration >= 6.0 && duration <= 8.0);
        if (qualified) {
          let sDate = s.date;
          if (sDate && sDate.includes('/')) {
            const parts = sDate.split('/');
            if (parts.length === 3) {
              sDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
          }
          const sDateStr = sDate || todayStr;
          const existsForDate = logs.some(l => (l.badgeId === 'b_sleep_1' || l.title.includes('Giấc Ngủ Trọn Vẹn')) && (l.date === sDateStr || l.date === s.date));
          if (!existsForDate) {
            const logTime = s.id && !isNaN(Number(s.id)) ? Number(s.id) : Date.now();
            const dateDisplay = s.date || todayStr;
            const newLog: AchievementLog = {
              id: `star_b_sleep_1_${s.id || logTime}_${Math.random().toString(36).substring(2, 6)}`,
              badgeId: 'b_sleep_1',
              title: 'Mở khóa thành tựu: Giấc Ngủ Trọn Vẹn',
              points: 1,
              stars: 1,
              date: sDateStr,
              timestamp: logTime,
              timeStr: `07:00 - ${dateDisplay}`,
              category: 'Thói quen',
              emoji: '🌙'
            };
            logs = [newLog, ...logs];
            updated = true;
          }
        }
      }
    }
  }

  // Always sort in descending order (newest first)
  logs.sort((a, b) => {
    const timeA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp || a.date).getTime() || 0;
    const timeB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp || b.date).getTime() || 0;
    return timeB - timeA;
  });

  if (updated) {
    setScopedItem('achievement_logs', logs, scopeId);
    setScopedItem('star_history', logs, scopeId);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`star_history_${scopeId}`, JSON.stringify(logs));
        localStorage.setItem(`user_history_${scopeId}`, JSON.stringify(logs));
      } catch {}
      window.dispatchEvent(new CustomEvent('add-achievement-log'));
    }
  }

  return logs;
}

export const SHOP_REWARDS_COST_MAP: Record<string, number> = {
  theme_default: 0,
  sound_keyboard: 6,
  effect_bubbles: 8,
  theme_green: 10,
  effect_fireworks: 12,
  theme_purple: 15,
  sound_lofi: 20,
  theme_gold: 25,
};

export function getTotalStarsSpent(userOrId?: any): number {
  const scopeId = typeof userOrId === 'string' ? userOrId : getUserScopeId(userOrId);
  const userId = getExactUserId(userOrId);
  
  if (typeof window === 'undefined') return 0;

  // 1. Direct saved spent stars from scoped storage & exact keys
  const savedSpent = getScopedItem('achievement_spent_stars', 0, scopeId);
  let directSpent = typeof savedSpent === 'number' ? savedSpent : (parseInt(String(savedSpent), 10) || 0);
  if (isNaN(directSpent) || directSpent < 0) directSpent = 0;

  // Check direct user storage if present
  if (userId && userId !== 'anonymous') {
    try {
      const rawDirect = localStorage.getItem(`achievement_spent_stars_${userId}`) || localStorage.getItem(`user_spent_stars_${userId}`);
      if (rawDirect) {
        const parsed = parseInt(rawDirect, 10);
        if (!isNaN(parsed) && parsed > directSpent) {
          directSpent = parsed;
        }
      }
    } catch {}
  }

  // 2. Spent stars calculated from unlocked rewards array
  const unlockedRewards: string[] = getScopedItem('unlocked_rewards', ['theme_default'], scopeId);
  let rewardsSpent = 0;
  if (Array.isArray(unlockedRewards)) {
    rewardsSpent = unlockedRewards.reduce((sum, itemId) => {
      return sum + (SHOP_REWARDS_COST_MAP[itemId] || 0);
    }, 0);
  }

  return Math.max(directSpent, rewardsSpent);
}

export function calculateAvailableStars(streak: number = 0, journalCount: number = 0, userOrId?: any): {
  totalEarnedStars: number;
  totalStarsEarned: number;
  spentStars: number;
  totalStarsSpent: number;
  availableStars: number;
} {
  const scopeId = typeof userOrId === 'string' ? userOrId : getUserScopeId(userOrId);
  const userId = getExactUserId(userOrId);
  
  // Make sure unlocked badges are synced into star history
  const historyLogs: AchievementLog[] = syncUnlockedBadgesToHistory(streak, journalCount, scopeId);

  // 1. Calculate Total Earned Stars from all valid achievement records in Star History (+1 ⭐ each)
  // This is the LIFETIME EARNED STARS (e.g. 6 ⭐) - NEVER REDUCED by purchases!
  let starsFromHistory = 0;
  if (Array.isArray(historyLogs) && historyLogs.length > 0) {
    starsFromHistory = historyLogs.reduce((sum, item) => {
      if (!item) return sum;
      const starVal = Number(item.stars || item.points || 1);
      return sum + (isNaN(starVal) || starVal <= 0 ? 1 : starVal);
    }, 0);
  }

  // 2. Also check currently unlocked badges as guaranteed floor
  const badges = getBadgesStatus(streak, journalCount, scopeId);
  const currentlyUnlockedCount = badges.filter(b => b.isUnlocked).length;

  const totalEarnedStars = Math.max(starsFromHistory, currentlyUnlockedCount);
  const totalStarsEarned = totalEarnedStars;
  
  // 3. Calculate Total Stars Spent in Shop (from direct spent or unlocked shop rewards)
  let spentStars = getTotalStarsSpent(scopeId);
  
  // Safety: Spent stars can never exceed lifetime earned stars
  if (spentStars > totalEarnedStars) {
    spentStars = totalEarnedStars;
  }
  const totalStarsSpent = spentStars;

  // 4. Current Spendable Balance (Available Stars)
  // Formula: availableStars = totalEarnedStars - spentStars
  const availableStars = Math.max(0, totalEarnedStars - spentStars);

  if (typeof window !== 'undefined') {
    setScopedItem('user_stars', availableStars, scopeId);
    setScopedItem('achievement_spent_stars', spentStars, scopeId);
    if (userId && userId !== 'anonymous') {
      try {
        localStorage.setItem(`user_stars_${userId}`, availableStars.toString());
        localStorage.setItem(`achievement_spent_stars_${userId}`, spentStars.toString());
      } catch {}
    }
  }

  return { 
    totalEarnedStars, 
    totalStarsEarned, 
    spentStars, 
    totalStarsSpent, 
    availableStars 
  };
}

export function checkAchievementCompletion(streak: number = 0, journalCount: number = 0, notify: boolean = false, userOrId?: any) {
  const scopeId = typeof userOrId === 'string' ? userOrId : getUserScopeId(userOrId);
  const { totalEarnedStars, spentStars, availableStars } = calculateAvailableStars(streak, journalCount, scopeId);
  const badges = getBadgesStatus(streak, journalCount, scopeId);

  if (notify && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('selfcare-state-change', {
      detail: { totalEarnedStars, spentStars, availableStars, badges }
    }));
    window.dispatchEvent(new CustomEvent('achievement-stars-updated', {
      detail: { totalEarnedStars, spentStars, availableStars, badges }
    }));
  }

  return {
    badges,
    totalEarnedStars,
    spentStars,
    availableStars
  };
}

export function resetStaleStarsCache(streak: number = 0, journalCount: number = 0, userOrId?: any) {
  if (typeof window === 'undefined') return;
  const scopeId = typeof userOrId === 'string' ? userOrId : getUserScopeId(userOrId);
  setScopedItem('achievement_spent_stars', 0, scopeId);
  const result = checkAchievementCompletion(streak, journalCount, true, scopeId);
  window.dispatchEvent(new CustomEvent('achievement-stars-updated', { detail: result }));
  return result;
}

