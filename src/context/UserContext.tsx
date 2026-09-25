import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { 
  calculateAvailableStars, 
  getBadgesStatus, 
  addStarHistoryLog as addStarHistoryLogLib,
  syncUnlockedBadgesToHistory,
  BadgeStatus,
  AchievementLog
} from '../lib/achievements';
import { getScopedItem, setScopedItem, getUserScopeId, getExactUserId } from '../lib/scopedStorage';
import { getStoredStreak } from '../lib/streak';

export interface UserContextType {
  currentUser: any;
  stars: number;
  availableStars: number;
  totalStarsEarned: number;
  totalEarnedStars: number;
  totalStarsSpent: number;
  spentStars: number;
  achievements: BadgeStatus[];
  unlockedBadgeIds: string[];
  history: AchievementLog[];
  streak: number;
  reloadUserData: () => void;
  addHistoryLog: (title: string, points?: number, emoji?: string, category?: string, badgeId?: string) => void;
  setStars: (count: number) => void;
}

export const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const userId = getExactUserId(user);

  const [stars, setStarsState] = useState<number>(0);
  const [totalStarsEarned, setTotalStarsEarned] = useState<number>(0);
  const [totalStarsSpent, setTotalStarsSpent] = useState<number>(0);
  const [achievements, setAchievements] = useState<BadgeStatus[]>([]);
  const [unlockedBadgeIds, setUnlockedBadgeIds] = useState<string[]>([]);
  const [history, setHistory] = useState<AchievementLog[]>([]);
  const [streak, setStreak] = useState<number>(1);

  const reloadUserData = useCallback(() => {
    const currentStreak = getStoredStreak(user);
    setStreak(currentStreak);

    // 1. Auto-recover and sync all unlocked achievements to history logs
    syncUnlockedBadgesToHistory(currentStreak, 0, user);

    // 2. Load history logs for this user
    const logs: AchievementLog[] = getScopedItem('user_history', getScopedItem('achievement_logs', [], user), user);
    const validLogs = Array.isArray(logs) ? logs : [];
    setHistory(validLogs);

    // 3. Calculate available stars for this user based on star history records & shop spending
    const starResult = calculateAvailableStars(currentStreak, 0, user);
    setStarsState(starResult.availableStars);
    setTotalStarsEarned(starResult.totalStarsEarned);
    setTotalStarsSpent(starResult.totalStarsSpent);

    // 4. Save user_stars_${userId} explicitly
    if (userId && userId !== 'anonymous') {
      localStorage.setItem(`user_stars_${userId}`, starResult.availableStars.toString());
      setScopedItem('user_stars', starResult.availableStars, user);
    }

    const badges = getBadgesStatus(currentStreak, 0, user);
    setAchievements(badges);

    const unlocked = badges.filter(b => b.isUnlocked).map(b => b.id);
    setUnlockedBadgeIds(unlocked);

    // Save user_achievements_${userId} explicitly
    if (userId && userId !== 'anonymous') {
      localStorage.setItem(`user_achievements_${userId}`, JSON.stringify(unlocked));
      setScopedItem('user_achievements', unlocked, user);
    }

    // Save user_history_${userId} explicitly
    if (userId && userId !== 'anonymous') {
      localStorage.setItem(`user_history_${userId}`, JSON.stringify(validLogs));
      localStorage.setItem(`star_history_${userId}`, JSON.stringify(validLogs));
      setScopedItem('user_history', validLogs, user);
      setScopedItem('star_history', validLogs, user);
    }
  }, [user, userId]);

  useEffect(() => {
    reloadUserData();
  }, [reloadUserData, user]);

  useEffect(() => {
    const handleUpdate = () => {
      reloadUserData();
    };

    window.addEventListener('achievement-stars-updated', handleUpdate);
    window.addEventListener('selfcare-state-change', handleUpdate);
    window.addEventListener('add-achievement-log', handleUpdate);
    window.addEventListener('unlocked-rewards-changed', handleUpdate);
    window.addEventListener('user-auth-changed', handleUpdate);

    return () => {
      window.removeEventListener('achievement-stars-updated', handleUpdate);
      window.removeEventListener('selfcare-state-change', handleUpdate);
      window.removeEventListener('add-achievement-log', handleUpdate);
      window.removeEventListener('unlocked-rewards-changed', handleUpdate);
      window.removeEventListener('user-auth-changed', handleUpdate);
    };
  }, [reloadUserData]);

  const addHistoryLog = (title: string, points: number = 1, emoji: string = '⭐', category: string = 'Thành tựu', badgeId?: string) => {
    const updated = addStarHistoryLogLib(title, points, emoji, category, badgeId, user);
    setHistory(updated);
    if (userId && userId !== 'anonymous') {
      localStorage.setItem(`user_history_${userId}`, JSON.stringify(updated));
      setScopedItem('user_history', updated, user);
    }
    reloadUserData();
  };

  const setStars = (count: number) => {
    setStarsState(count);
    setScopedItem('user_stars', count, user);
    if (userId && userId !== 'anonymous') {
      localStorage.setItem(`user_stars_${userId}`, count.toString());
    }
  };

  return (
    <UserContext.Provider
      value={{
        currentUser: user,
        stars,
        availableStars: stars,
        totalStarsEarned,
        totalEarnedStars: totalStarsEarned,
        totalStarsSpent,
        spentStars: totalStarsSpent,
        achievements,
        unlockedBadgeIds,
        history,
        streak,
        reloadUserData,
        addHistoryLog,
        setStars
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export default UserContext;
