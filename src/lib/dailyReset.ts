/**
 * Daily Auto-Reset System ("Tự Động Reset Nhiệm Vụ Theo Ngày Mới").
 *
 * Rules:
 * 1. Date Tracking: Stores last reset date ('last_daily_reset_date') in LocalStorage as YYYY-MM-DD.
 * 2. On app mount or reload, compares lastResetDate with today's system date (currentDate).
 * 3. When currentDate > lastResetDate (a new day has started past 00:00):
 *    - Reset ALL daily habit progress to default across ALL tasks (Water 0/8, exercises uncompleted, meals unchecked, breath/gratitude/meditation reset).
 *    - Update lastResetDate = currentDate.
 *    - KEEP INTACT long-term accumulated data (Available Stars, Streak count, Themes, Unlocked Rewards, Journal entries).
 */

import { getScopedItem, setScopedItem, getUserScopeId, removeScopedItem } from './scopedStorage';

export interface PairChallengeItem {
  id: string;
  title: string;
  points: number;
  complete: boolean;
  myCompleted: boolean;
  companionCompleted: boolean;
}

export const DEFAULT_PAIR_CHALLENGES: PairChallengeItem[] = [
  { id: 'pc1', title: 'Cùng nhau viết 1 trang nhật ký', points: 2, complete: false, myCompleted: false, companionCompleted: false },
  { id: 'pc2', title: 'Xem 1 video TikTok chữa lành', points: 2, complete: false, myCompleted: false, companionCompleted: false },
  { id: 'pc3', title: 'Cùng hít thở nhịp thở bình yên', points: 2, complete: false, myCompleted: false, companionCompleted: false }
];

export const DEFAULT_CONNECTION_CHALLENGES = [
  { id: 'c1', title: 'Cảm ơn một người hôm nay', isCompleted: false, streakAdded: false },
  { id: 'c2', title: 'Hỏi thăm một người bạn cũ', isCompleted: false, streakAdded: false },
  { id: 'c3', title: 'Ăn cơm cùng gia đình', isCompleted: false, streakAdded: false },
  { id: 'c4', title: 'Mời ai đó một ly nước mát', isCompleted: false, streakAdded: false },
  { id: 'c5', title: 'Kể một chuyện vui với người thân', isCompleted: false, streakAdded: false },
  { id: 'c6', title: 'Chúc ai đó một ngày tốt lành', isCompleted: false, streakAdded: false },
  { id: 'c7', title: 'Ôm một người thân yêu (nếu thoải mái)', isCompleted: false, streakAdded: false }
];

export function resetPairChallenges(scopeId?: string, todayStr?: string) {
  const date = todayStr || new Date().toLocaleDateString('sv-SE');
  const fresh = DEFAULT_PAIR_CHALLENGES.map(p => ({ ...p, complete: false, myCompleted: false, companionCompleted: false }));
  if (typeof localStorage !== 'undefined') {
    if (scopeId) {
      localStorage.setItem(`user_pair_challenges_${scopeId}`, JSON.stringify(fresh));
      localStorage.setItem(`user_pair_challenges_date_${scopeId}`, date);
    }
    localStorage.setItem('app_pair_challenges', JSON.stringify(fresh));
    localStorage.setItem('app_pair_challenges_date', date);
  }
  return fresh;
}

export function resetConnectionChallenges(scopeId?: string, todayStr?: string) {
  const date = todayStr || new Date().toLocaleDateString('sv-SE');
  const fresh = DEFAULT_CONNECTION_CHALLENGES.map(c => ({ ...c, isCompleted: false, streakAdded: false }));
  if (typeof localStorage !== 'undefined') {
    if (scopeId) {
      localStorage.setItem(`user_connection_challenges_${scopeId}`, JSON.stringify(fresh));
      localStorage.setItem(`user_connection_challenges_date_${scopeId}`, date);
    }
  }
  return fresh;
}

export function checkAndResetDailyTasks(userOrId?: any, forceReset = false): boolean {
  const scopeId = typeof userOrId === 'string' ? userOrId : getUserScopeId(userOrId);
  const todayStr = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD in local timezone
  const lastResetDate = getScopedItem('last_daily_reset_date', '', scopeId);
  const pairDate = typeof localStorage !== 'undefined' ? localStorage.getItem(`user_pair_challenges_date_${scopeId}`) : null;
  const connDate = typeof localStorage !== 'undefined' ? localStorage.getItem(`user_connection_challenges_date_${scopeId}`) : null;

  const isDayChanged = (lastResetDate && lastResetDate !== todayStr) ||
    (pairDate && pairDate !== todayStr) ||
    (connDate && connDate !== todayStr) ||
    forceReset;

  // If a last date is stored and it differs from today (new day detected) OR forced
  if (isDayChanged) {
    // 1. Reset Water Glasses (0/8)
    setScopedItem(
      'selfcare_water_glasses',
      [false, false, false, false, false, false, false, false],
      scopeId
    );

    // 2. Reset Exercises (uncheck all completed)
    const exercises = getScopedItem('selfcare_exercises', null, scopeId);
    if (Array.isArray(exercises)) {
      const resetEx = exercises.map((ex: any) => ({ ...ex, completed: false }));
      setScopedItem('selfcare_exercises', resetEx, scopeId);
    } else {
      resetDefaultExercises(scopeId);
    }

    // 3. Reset Healthy Meals (uncheck all)
    const meals = getScopedItem('selfcare_meals', null, scopeId);
    if (Array.isArray(meals)) {
      const resetMeals = meals.map((m: any) => ({ ...m, checked: false }));
      setScopedItem('selfcare_meals', resetMeals, scopeId);
    } else {
      resetDefaultMeals(scopeId);
    }

    // 4. Reset Breathing Exercise completion
    removeScopedItem('selfcare_breath_completed', scopeId);
    removeScopedItem('selfcare_breath_completed_date', scopeId);

    // 5. Reset Gratitude Notes
    setScopedItem('selfcare_gratitude_texts', { card1: '', card2: '', card3: '' }, scopeId);
    setScopedItem('selfcare_gratitude_saved', 'false', scopeId);

    // 6. Reset Meditation completion
    removeScopedItem('selfcare_meditation_completed', scopeId);

    // 7. Reset Sleep Quality rating
    setScopedItem('selfcare_sleep_quality', '80', scopeId);

    // 8. Reset Pair Challenges (Thử thách đôi: Nhật ký, Podcast, Hít thở)
    resetPairChallenges(scopeId, todayStr);

    // 9. Reset Connection Challenges (Thử thách kết nối hằng ngày: Cảm ơn, Hỏi thăm, Ăn cơm...)
    resetConnectionChallenges(scopeId, todayStr);

    // Update daily reset tracking date
    setScopedItem('last_daily_reset_date', todayStr, scopeId);

    // Dispatch global events so all mounted views sync
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('daily-tasks-reset', { detail: { date: todayStr } }));
      window.dispatchEvent(new CustomEvent('pair-challenges-reset', { detail: { date: todayStr } }));
      window.dispatchEvent(new CustomEvent('selfcare-state-change'));
    }

    return true; // Reset occurred
  }

  // First time initialization if missing
  if (!lastResetDate) {
    setScopedItem('last_daily_reset_date', todayStr, scopeId);
  }
  if (typeof localStorage !== 'undefined') {
    if (!localStorage.getItem(`user_pair_challenges_date_${scopeId}`)) {
      localStorage.setItem(`user_pair_challenges_date_${scopeId}`, todayStr);
    }
    if (!localStorage.getItem(`user_connection_challenges_date_${scopeId}`)) {
      localStorage.setItem(`user_connection_challenges_date_${scopeId}`, todayStr);
    }
  }

  return false; // No reset needed
}

function resetDefaultExercises(scopeId?: string) {
  setScopedItem(
    'selfcare_exercises',
    [
      { id: 'ex1', name: 'Duỗi cơ nhẹ nhàng buổi sáng', duration: 5, completed: false },
      { id: 'ex2', name: 'Đi bộ thư giãn quanh hồ', duration: 15, completed: false },
      { id: 'ex3', name: 'Bài tập hít thở sâu & giãn cơ lưng', duration: 10, completed: false }
    ],
    scopeId
  );
}

function resetDefaultMeals(scopeId?: string) {
  setScopedItem(
    'selfcare_meals',
    [
      { id: 'm1', name: 'Bữa sáng thanh đạm & đủ chất', checked: false },
      { id: 'm2', name: 'Bữa trưa tươi ngon, nhiều rau xanh', checked: false },
      { id: 'm3', name: 'Bữa tối nhẹ nhàng, ấm bụng', checked: false }
    ],
    scopeId
  );
}
