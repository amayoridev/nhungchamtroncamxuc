import { UserProfile } from '../types';

const ALL_USERS_KEY = 'all_app_users';

/**
 * Normalizes user ID or key for consistent matching.
 */
export function getNormalizedUserId(user: any): string {
  if (!user) return '';
  return (user.id || user._id || user.email || user.username || '').toString().trim();
}

/**
 * Strips heavy fields (diaries, appData, ders16) to keep localStorage footprint minimal (<50KB).
 */
function sanitizeForLocalStore(u: Partial<UserProfile>): UserProfile {
  const uid = (u.id || u._id || '').toString().trim();
  return {
    id: uid,
    _id: uid,
    username: u.username || 'Người dùng',
    email: u.email || '',
    role: u.role || 'user',
    avatar: u.avatar || '🌸',
    motto: u.motto || '',
    circleCode: u.circleCode,
    streak: typeof u.streak === 'number' ? u.streak : 1,
    circlePoints: typeof u.circlePoints === 'number' ? u.circlePoints : 1,
    emotionalCircles: typeof u.emotionalCircles === 'number' ? u.emotionalCircles : 0,
    journalCount: typeof u.journalCount === 'number' ? u.journalCount : (u.diaries ? u.diaries.length : 0),
    peaceScore: typeof u.peaceScore === 'number' ? u.peaceScore : 80,
    stars: typeof u.stars === 'number' ? u.stars : 0,
    isLocked: Boolean(u.isLocked),
    createdAt: u.createdAt || '',
    lastActive: u.lastActive || 'Vừa xong',
    isActiveToday: Boolean(u.isActiveToday),
    diaries: [] // Intentionally omit full diary array from bulk all_app_users cache
  };
}

/**
 * Reads all synced users from LocalStorage 'all_app_users' store.
 */
export function getAllAppUsersFromStore(): UserProfile[] {
  try {
    const raw = localStorage.getItem(ALL_USERS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

/**
 * Saves lightweight synced users to LocalStorage 'all_app_users' store.
 * Safe against QuotaExceededError.
 */
export function saveAllAppUsersToStore(users: UserProfile[]): void {
  try {
    // Keep at most 30 lightweight users in local storage cache (<5KB)
    const cleanList = users.slice(0, 30).map(sanitizeForLocalStore);
    localStorage.setItem(ALL_USERS_KEY, JSON.stringify(cleanList));
  } catch (e) {
    try {
      // If quota is still tight, keep only top 10
      const minimalList = users.slice(0, 10).map(sanitizeForLocalStore);
      localStorage.setItem(ALL_USERS_KEY, JSON.stringify(minimalList));
    } catch (inner) {
      // Safely purge all_app_users key if storage is full
      try {
        localStorage.removeItem(ALL_USERS_KEY);
      } catch (ignore) {}
    }
  }
}

/**
 * Synchronizes single user progress (streak, circlePoints, journals, peaceScore, stars)
 * to 'all_app_users' store and triggers real-time UI events.
 */
export function syncUserToAllAppUsers(updated: Partial<UserProfile> & { id?: string; _id?: string; username?: string; email?: string }): UserProfile[] {
  if (!updated) return getAllAppUsersFromStore();

  const uid = (updated.id || updated._id || '').toString().trim();
  const email = (updated.email || '').toLowerCase().trim();
  const username = (updated.username || '').trim();

  if (!uid && !email && !username) return getAllAppUsersFromStore();

  const currentList = getAllAppUsersFromStore();
  const matchKey = (email || uid || username).toLowerCase();
  const existing: Partial<UserProfile> = currentList.find(u => 
    Boolean(
      (uid && (u.id === uid || u._id === uid)) ||
      (email && u.email && u.email.toLowerCase() === email) ||
      (username && u.username && u.username.toLowerCase() === username)
    )
  ) || {};

  const finalStreak = updated.streak !== undefined ? updated.streak : (existing.streak !== undefined ? existing.streak : 1);
  const finalCirclePoints = updated.circlePoints !== undefined 
    ? updated.circlePoints 
    : (existing.circlePoints !== undefined ? existing.circlePoints : finalStreak);

  const finalJournalCount = updated.journalCount !== undefined
    ? updated.journalCount
    : (updated.diaries ? updated.diaries.length : (existing.journalCount !== undefined ? existing.journalCount : (existing.diaries?.length || 0)));

  const finalPeaceScore = updated.peaceScore !== undefined
    ? updated.peaceScore
    : (existing.peaceScore !== undefined ? existing.peaceScore : 80);

  const finalStars = updated.stars !== undefined
    ? updated.stars
    : (existing.stars !== undefined ? existing.stars : 0);

  const finalCircleCode = updated.circleCode || existing.circleCode || `CT_${(uid || username || '1000').slice(-4).toUpperCase()}`;

  const mergedUser: UserProfile = sanitizeForLocalStore({
    ...existing,
    ...updated,
    id: uid || existing.id || existing._id || `user_${Date.now()}`,
    _id: uid || existing._id || existing.id || `user_${Date.now()}`,
    username: username || existing.username || 'Người dùng',
    email: email || existing.email || '',
    role: updated.role || existing.role || 'user',
    avatar: updated.avatar || existing.avatar || '🌸',
    motto: updated.motto !== undefined ? updated.motto : (existing.motto || ''),
    circleCode: finalCircleCode,
    streak: finalStreak,
    circlePoints: finalCirclePoints,
    emotionalCircles: updated.emotionalCircles !== undefined ? updated.emotionalCircles : (existing.emotionalCircles || 0),
    journalCount: finalJournalCount,
    peaceScore: finalPeaceScore,
    stars: finalStars,
    isLocked: updated.isLocked !== undefined ? updated.isLocked : (existing.isLocked || false),
    createdAt: updated.createdAt || existing.createdAt || new Date().toISOString(),
    lastActive: updated.lastActive || existing.lastActive || 'Vừa xong',
    isActiveToday: updated.isActiveToday !== undefined ? updated.isActiveToday : true
  });

  // Upsert into list
  let found = false;
  const updatedList = currentList.map(u => {
    const isSame = Boolean(
      (uid && (u.id === uid || u._id === uid)) ||
      (email && u.email && u.email.toLowerCase() === email) ||
      (username && u.username && u.username.toLowerCase() === username)
    );
    if (isSame) {
      found = true;
      return mergedUser;
    }
    return u;
  });

  if (!found) {
    updatedList.unshift(mergedUser);
  }

  saveAllAppUsersToStore(updatedList);

  // Dispatch progress sync event without re-triggering auth reload loops
  try {
    window.dispatchEvent(new CustomEvent('user-progress-synced', { detail: { user: mergedUser } }));
  } catch (e) {}

  return updatedList;
}

/**
 * Bulk updates store with the verified database accounts list while keeping local active stats accurate.
 */
export function syncDatabaseUsersToStore(serverUsers: UserProfile[], activeCurrentUser?: UserProfile | null): UserProfile[] {
  const emailMap = new Map<string, UserProfile>();

  // If serverUsers is provided, serverUsers is the single source of truth for all users in the system.
  // We populate directly from serverUsers so old/deleted users in localStorage are purged cleanly.
  serverUsers.forEach(u => {
    const key = (u.email || u.id || u._id || u.username || '').toLowerCase().trim();
    if (!key || key === '123@123.com') return;

    const uid = u.id || u._id || '';
    const streak = u.streak !== undefined ? u.streak : 1;
    const circlePoints = u.circlePoints !== undefined ? u.circlePoints : streak;
    const journalCount = u.journalCount !== undefined ? u.journalCount : (u.diaries ? u.diaries.length : 0);
    const peaceScore = u.peaceScore !== undefined ? u.peaceScore : 80;
    const stars = u.stars !== undefined ? u.stars : 0;

    emailMap.set(key, {
      ...u,
      id: uid,
      _id: uid,
      username: u.username || 'Người dùng',
      email: u.email || '',
      circleCode: u.circleCode,
      streak,
      circlePoints,
      journalCount,
      peaceScore,
      stars,
      createdAt: u.createdAt || new Date().toISOString(),
      isLocked: u.isLocked !== undefined ? u.isLocked : false,
      lastActive: u.lastActive || 'Vừa xong'
    });
  });

  // If activeCurrentUser is logged in, ensure its latest live progress is updated
  if (activeCurrentUser) {
    const activeKey = (activeCurrentUser.email || activeCurrentUser.id || activeCurrentUser._id || activeCurrentUser.username || '').toLowerCase().trim();
    if (activeKey && activeKey !== '123@123.com') {
      const existing = emailMap.get(activeKey);
      if (existing) {
        emailMap.set(activeKey, {
          ...existing,
          ...activeCurrentUser,
          id: activeCurrentUser.id || activeCurrentUser._id || existing.id || existing._id || '',
          _id: activeCurrentUser.id || activeCurrentUser._id || existing.id || existing._id || '',
          username: activeCurrentUser.username || existing.username || 'Người dùng',
          email: activeCurrentUser.email || existing.email || '',
          streak: activeCurrentUser.streak || existing.streak || 1,
          circlePoints: activeCurrentUser.circlePoints || activeCurrentUser.streak || existing.circlePoints || 1,
          journalCount: activeCurrentUser.journalCount !== undefined ? activeCurrentUser.journalCount : existing.journalCount,
          peaceScore: activeCurrentUser.peaceScore !== undefined ? activeCurrentUser.peaceScore : existing.peaceScore,
          stars: activeCurrentUser.stars !== undefined ? activeCurrentUser.stars : existing.stars
        });
      } else {
        emailMap.set(activeKey, {
          ...activeCurrentUser,
          id: activeCurrentUser.id || activeCurrentUser._id || '',
          _id: activeCurrentUser.id || activeCurrentUser._id || '',
          username: activeCurrentUser.username || 'Người dùng',
          email: activeCurrentUser.email || '',
          streak: activeCurrentUser.streak || 1,
          circlePoints: activeCurrentUser.circlePoints || 1,
          journalCount: activeCurrentUser.journalCount || 0,
          peaceScore: activeCurrentUser.peaceScore || 80,
          stars: activeCurrentUser.stars || 0,
          createdAt: activeCurrentUser.createdAt || new Date().toISOString()
        });
      }
    }
  }

  const merged = Array.from(emailMap.values())
    .map(sanitizeForLocalStore)
    .sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  saveAllAppUsersToStore(merged);
  return merged;
}
