/**
 * Dynamic Calendar Day Streak Algorithm ("Chấm Tròn Kiên Trì").
 *
 * Consecutive Streak Rules:
 * 1. If not logged in (guest / no user) -> streak is strictly 0.
 * 2. If user missed logging in (> 1 day without login) -> streak is 0 until login.
 * 3. When logging in:
 *    - First time or after missed days -> streak starts at 1.
 *    - Logged in yesterday (diff = 1 calendar day) -> streak = streak + 1.
 *    - Already logged in today -> streak is maintained as-is.
 */

import { getScopedItem, setScopedItem, getUserScopeId } from './scopedStorage';
import { syncUserToAllAppUsers } from './userSync';

export function getTodayDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function getYesterdayDateStr(todayStr: string = getTodayDateStr()): string {
  const [y, m, d] = todayStr.split('-').map(Number);
  const yesterday = new Date(y, m - 1, d - 1);
  return `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
}

export function getDaysDiff(fromDateStr: string, toDateStr: string): number {
  if (!fromDateStr || !toDateStr || fromDateStr === toDateStr) return 0;
  const [y1, m1, d1] = fromDateStr.split('-').map(Number);
  const [y2, m2, d2] = toDateStr.split('-').map(Number);

  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0;

  const date1 = new Date(y1, m1 - 1, d1);
  const date2 = new Date(y2, m2 - 1, d2);

  return Math.round((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Returns the sorted array of active dates YYYY-MM-DD for this specific user.
 */
export function getActiveDates(userOrId?: any): string[] {
  if (!userOrId) return [];
  const scopeId = typeof userOrId === 'string' ? userOrId : getUserScopeId(userOrId);
  if (!scopeId || scopeId === 'guest' || scopeId === 'anonymous') return [];

  const rawDates = getScopedItem<string[]>('app_active_dates', [], scopeId);
  if (Array.isArray(rawDates) && rawDates.length > 0) {
    return Array.from(new Set(rawDates.filter(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)))).sort();
  }
  return [];
}

/**
 * Pure read-only getter for stored streak for the specified user.
 * If not logged in, returns 0.
 * If user missed days without login, returns 0.
 */
export function getStoredStreak(userOrId?: any): number {
  if (!userOrId) return 0;
  const scopeId = typeof userOrId === 'string' ? userOrId : getUserScopeId(userOrId);
  if (!scopeId || scopeId === 'guest' || scopeId === 'anonymous') return 0;

  const todayStr = getTodayDateStr();
  const yesterdayStr = getYesterdayDateStr(todayStr);

  const lastActiveDate = getScopedItem<string>('app_last_active_date', '', scopeId) ||
                         (userOrId && typeof userOrId === 'object' ? (userOrId.lastActiveDate || userOrId.lastLoginDate || '') : '');

  // If user hasn't been active today or yesterday, streak is broken -> 0
  if (lastActiveDate && lastActiveDate !== todayStr && lastActiveDate !== yesterdayStr) {
    const diff = getDaysDiff(lastActiveDate, todayStr);
    if (diff > 1) {
      return 0;
    }
  }

  const savedStreak = getScopedItem<number>('app_streak', 0, scopeId) || 
                      getScopedItem<number>('streak', 0, scopeId) || 
                      getScopedItem<number>('consecutiveStreak', 0, scopeId);

  if (typeof savedStreak === 'number' && savedStreak > 0) {
    return savedStreak;
  }
  if (userOrId && typeof userOrId === 'object' && typeof userOrId.streak === 'number' && userOrId.streak > 0) {
    return userOrId.streak;
  }
  return 0;
}

export function calculateStreak(userOrId?: any): number {
  return getStoredStreak(userOrId);
}

/**
 * Evaluates and auto-updates streak upon login or app launch for an individual user.
 */
export function evaluateDailyStreak(userOrId?: any): number {
  if (!userOrId) return 0;
  const scopeId = typeof userOrId === 'string' ? userOrId : getUserScopeId(userOrId);
  if (!scopeId || scopeId === 'guest' || scopeId === 'anonymous') return 0;

  const todayStr = getTodayDateStr();
  const yesterdayStr = getYesterdayDateStr(todayStr);

  const lastActiveDate = getScopedItem<string>('app_last_active_date', '', scopeId) ||
                         (userOrId && typeof userOrId === 'object' ? (userOrId.lastActiveDate || userOrId.lastLoginDate || '') : '');

  let currentStreak = getScopedItem<number>('app_streak', 0, scopeId) ||
                      (userOrId && typeof userOrId === 'object' && typeof userOrId.streak === 'number' ? userOrId.streak : 0);

  let newStreak: number;

  if (!lastActiveDate || currentStreak === 0) {
    // First time login or new user
    newStreak = 1;
  } else if (lastActiveDate === todayStr) {
    // Already active today, maintain streak
    newStreak = Math.max(1, currentStreak);
  } else if (lastActiveDate === yesterdayStr) {
    // Consecutive day login: increment streak
    newStreak = currentStreak + 1;
  } else {
    // Missed 1 or more days: previous streak was 0, now user is logging in today -> starts at 1
    newStreak = 1;
  }

  // Update active dates list
  let dates = getActiveDates(userOrId);
  if (!dates.includes(todayStr)) {
    dates.push(todayStr);
    dates.sort();
  }
  setScopedItem('app_active_dates', dates, scopeId);

  // Persist values in scoped storage for this specific user
  setScopedItem('app_streak', newStreak, scopeId);
  setScopedItem('streak', newStreak, scopeId);
  setScopedItem('circlePoints', newStreak, scopeId);
  setScopedItem('user_circle_points', newStreak, scopeId);
  setScopedItem('consecutiveStreak', newStreak, scopeId);
  setScopedItem('consecutiveDays', newStreak, scopeId);
  setScopedItem('app_last_active_date', todayStr, scopeId);
  setScopedItem('last_login_date', todayStr, scopeId);
  setScopedItem('lastActiveDate', todayStr, scopeId);
  setScopedItem('lastLoginDate', todayStr, scopeId);

  // Update current user in LocalStorage
  try {
    const userStr = localStorage.getItem('user') || localStorage.getItem('currentUser');
    if (userStr) {
      const u = JSON.parse(userStr);
      const curScope = getUserScopeId(u);
      if (curScope === scopeId) {
        u.streak = newStreak;
        u.circlePoints = newStreak;
        u.consecutiveStreak = newStreak;
        u.consecutiveDays = newStreak;
        u.lastActiveDate = todayStr;
        u.lastLoginDate = todayStr;
        localStorage.setItem('user', JSON.stringify(u));
        localStorage.setItem('currentUser', JSON.stringify(u));
        syncUserToAllAppUsers(u);
      }
    }
  } catch {}

  // Sync to backend DB asynchronously
  try {
    const token = localStorage.getItem('token');
    if (token) {
      const safeToken = token.replace(/[^\x00-\x7F]/g, '');
      fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${safeToken}`
        },
        body: JSON.stringify({ 
          streak: newStreak,
          circlePoints: newStreak,
          lastActiveDate: todayStr,
          lastLoginDate: todayStr
        })
      }).catch(() => {});
    }
  } catch {}

  return newStreak;
}

/**
 * Records daily practice / active check-in.
 */
export function recordDailyPractice(userOrId?: any): number {
  const updatedStreak = evaluateDailyStreak(userOrId);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('streak-updated', { detail: { streak: updatedStreak } }));
    window.dispatchEvent(new CustomEvent('achievement-stars-updated'));
  }
  return updatedStreak;
}

/**
 * Synchronizes streak directly from DB profile for the user.
 */
export function syncStreakFromProfile(profileStreak: number, userOrId?: any): number {
  if (!userOrId) return 0;
  const scopeId = typeof userOrId === 'string' ? userOrId : getUserScopeId(userOrId);
  if (!scopeId || scopeId === 'guest' || scopeId === 'anonymous') return 0;

  const todayStr = getTodayDateStr();
  const cleanStreak = typeof profileStreak === 'number' && profileStreak >= 0 ? profileStreak : 0;

  setScopedItem('app_streak', cleanStreak, scopeId);
  setScopedItem('streak', cleanStreak, scopeId);
  setScopedItem('circlePoints', cleanStreak, scopeId);
  setScopedItem('user_circle_points', cleanStreak, scopeId);
  setScopedItem('consecutiveStreak', cleanStreak, scopeId);
  setScopedItem('consecutiveDays', cleanStreak, scopeId);
  setScopedItem('app_last_active_date', todayStr, scopeId);
  return cleanStreak;
}
