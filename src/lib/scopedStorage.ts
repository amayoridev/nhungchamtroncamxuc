/**
 * Scoped LocalStorage & Backend Sync Helper
 * Manages user-bound data persistence per User ID / Username.
 */

export function getCurrentUser(): any {
  try {
    const raw = localStorage.getItem('user');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

export function getExactUserId(userOrId?: any): string {
  if (typeof userOrId === 'string' && userOrId !== '[object Object]') {
    return userOrId.trim();
  }
  let user = userOrId;
  if (!user || typeof user !== 'object') {
    user = getCurrentUser();
  }
  if (!user) return 'anonymous';
  return (user.id || user._id || user.email || user.username || 'anonymous').toString().trim();
}

export function getUserScopeId(userOrId?: any): string {
  const rawId = getExactUserId(userOrId);
  return rawId.toLowerCase().replace(/[\s_\-]/g, '');
}

/**
 * Reads a value from scoped localStorage for the specified key and user.
 * Keys like 'user_stars', 'user_achievements', 'user_history', 'star_history', 'achievement_logs'
 * look across all scoped and direct storage keys to preserve historical records.
 */
export function getScopedItem<T = any>(key: string, defaultValue: T, userOrId?: any): T {
  const scopeId = getUserScopeId(userOrId);
  const userId = getExactUserId(userOrId);

  // Special preservation for history logs: merge all stored sources so no historical log is ever lost
  if (key === 'user_history' || key === 'achievement_logs' || key === 'star_history') {
    const candidateKeys = [
      `star_history_${userId}`,
      `user_history_${userId}`,
      `achievement_logs_${userId}`,
      `usr_${scopeId}_star_history`,
      `usr_${scopeId}_achievement_logs`,
      `usr_${scopeId}_user_history`,
      'star_history',
      'achievement_logs',
      'user_history'
    ];

    const collectedLogs: any[] = [];
    const seenIds = new Set<string>();

    for (const ck of candidateKeys) {
      try {
        const raw = localStorage.getItem(ck);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (!item) continue;
              const dedupeKey = item.id || (item.badgeId && item.date ? `${item.badgeId}_${item.date}` : `${item.title || ''}_${item.date || ''}_${item.timestamp || ''}`);
              if (!seenIds.has(dedupeKey)) {
                seenIds.add(dedupeKey);
                collectedLogs.push(item);
              }
            }
          }
        }
      } catch (e) {}
    }

    if (collectedLogs.length > 0) {
      collectedLogs.sort((a, b) => {
        const timeA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp || a.date).getTime() || 0;
        const timeB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp || b.date).getTime() || 0;
        return timeB - timeA;
      });
      return collectedLogs as unknown as T;
    }
    return defaultValue;
  }

  // Direct user keys specified in requirements: user_stars_${id}, user_achievements_${id}
  if (key === 'user_stars' || key === 'user_achievements') {
    const directKey = `${key}_${userId}`;
    try {
      const value = localStorage.getItem(directKey);
      if (value !== null) {
        return JSON.parse(value);
      }
    } catch (e) {
      const raw = localStorage.getItem(directKey);
      if (raw !== null) {
        if (typeof defaultValue === 'number') {
          const num = Number(raw);
          if (!isNaN(num)) return num as unknown as T;
        }
        if (typeof defaultValue === 'string') return raw as unknown as T;
      }
    }
  }

  const scopedKey = `usr_${scopeId}_${key}`;

  try {
    const value = localStorage.getItem(scopedKey);
    if (value !== null) {
      return JSON.parse(value);
    }
  } catch (e) {
    const raw = localStorage.getItem(scopedKey);
    if (raw !== null) {
      if (typeof defaultValue === 'string') return raw as unknown as T;
      if (typeof defaultValue === 'number') {
        const num = Number(raw);
        if (!isNaN(num)) return num as unknown as T;
      }
    }
  }

  // Fallback to legacy un-scoped key ONLY IF user is anonymous
  if (scopeId === 'anonymous') {
    try {
      const legacyValue = localStorage.getItem(key);
      if (legacyValue !== null) {
        return JSON.parse(legacyValue);
      }
    } catch (e) {}
  }

  return defaultValue;
}

/**
 * Saves a value to scoped localStorage and triggers background server API sync if authenticated.
 */
export function setScopedItem(key: string, value: any, userOrId?: any): void {
  const scopeId = getUserScopeId(userOrId);
  const userId = getExactUserId(userOrId);
  const scopedKey = `usr_${scopeId}_${key}`;

  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(scopedKey, serialized);

    // Also maintain direct user key for requirement specs: user_stars_${id}, user_achievements_${id}, user_history_${id}, star_history_${id}
    if (userId && userId !== 'anonymous') {
      if (key === 'user_stars') {
        localStorage.setItem(`user_stars_${userId}`, serialized);
      } else if (key === 'user_achievements') {
        localStorage.setItem(`user_achievements_${userId}`, serialized);
      } else if (key === 'user_history' || key === 'achievement_logs' || key === 'star_history') {
        localStorage.setItem(`user_history_${userId}`, serialized);
        localStorage.setItem(`star_history_${userId}`, serialized);
        localStorage.setItem(`achievement_logs_${userId}`, serialized);
      }
    }

    // Debounced sync to server endpoint
    syncUserDataToServer(scopeId, key, value);
  } catch (e) {
    console.error('Error writing to scoped storage:', e);
  }
}

/**
 * Removes a scoped item.
 */
export function removeScopedItem(key: string, userOrId?: any): void {
  const scopeId = getUserScopeId(userOrId);
  const userId = getExactUserId(userOrId);
  const scopedKey = `usr_${scopeId}_${key}`;
  localStorage.removeItem(scopedKey);

  if (userId && userId !== 'anonymous') {
    if (key === 'user_stars') localStorage.removeItem(`user_stars_${userId}`);
    if (key === 'user_achievements') localStorage.removeItem(`user_achievements_${userId}`);
    if (key === 'user_history' || key === 'achievement_logs') localStorage.removeItem(`user_history_${userId}`);
  }
}

// Internal debounced queue for syncing key-value pairs to the server
const pendingSync: Record<string, any> = {};
let syncTimeout: any = null;

export function syncUserDataToServer(scopeId: string, key: string, value: any) {
  if (scopeId === 'anonymous') return;
  
  pendingSync[key] = value;

  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const payload = { ...pendingSync };
      await fetch('/api/user/data', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ appData: payload })
      });
    } catch (err) {
      console.warn('Failed to sync user appData to server:', err);
    }
  }, 800);
}

/**
 * Hydrates local storage from server response when user logs in or refreshes.
 */
export function hydrateFromUserData(appData: Record<string, any>, userOrId?: any) {
  if (!appData || typeof appData !== 'object') return;
  const scopeId = getUserScopeId(userOrId);
  const userId = getExactUserId(userOrId);

  Object.entries(appData).forEach(([key, val]) => {
    const scopedKey = `usr_${scopeId}_${key}`;
    try {
      const serialized = typeof val === 'string' ? val : JSON.stringify(val);
      localStorage.setItem(scopedKey, serialized);
      if (userId && userId !== 'anonymous') {
        if (key === 'user_stars') localStorage.setItem(`user_stars_${userId}`, serialized);
        if (key === 'user_achievements') localStorage.setItem(`user_achievements_${userId}`, serialized);
        if (key === 'user_history' || key === 'achievement_logs') localStorage.setItem(`user_history_${userId}`, serialized);
      }
    } catch (e) {}
  });
}
