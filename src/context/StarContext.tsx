import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { calculateAvailableStars, getTotalStarsSpent, SHOP_REWARDS_COST_MAP } from '../lib/achievements';
import { getScopedItem, setScopedItem, getUserScopeId, getExactUserId } from '../lib/scopedStorage';
import { getStoredStreak } from '../lib/streak';

export interface StarWalletState {
  totalStarsEarned: number; // 6 ⭐ - Tổng số sao mở khóa từ trước đến nay trong lịch sử (Không bao giờ bị trừ)
  totalEarnedStars: number; // Alias
  totalStarsSpent: number;  // Tổng số sao đã dùng đổi quà trong Cửa Hàng
  spentStars: number;       // Alias
  availableStars: number;   // Số dư khả dụng thực tế: totalStarsEarned - totalStarsSpent
  unlockedRewards: string[];
  spendStars: (cost: number, itemId: string) => boolean;
  reloadStarWallet: () => void;
}

const StarContext = createContext<StarWalletState | undefined>(undefined);

export const StarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const scopeId = getUserScopeId(user);
  const userId = getExactUserId(user);

  const [totalStarsEarned, setTotalStarsEarned] = useState<number>(0);
  const [totalStarsSpent, setTotalStarsSpent] = useState<number>(0);
  const [availableStars, setAvailableStars] = useState<number>(0);
  const [unlockedRewards, setUnlockedRewards] = useState<string[]>(['theme_default']);

  const reloadStarWallet = useCallback(() => {
    const streak = getStoredStreak(user);
    const result = calculateAvailableStars(streak, 0, user);

    setTotalStarsEarned(result.totalEarnedStars);
    setTotalStarsSpent(result.spentStars);
    setAvailableStars(result.availableStars);

    const rewards: string[] = getScopedItem('unlocked_rewards', ['theme_default'], scopeId);
    setUnlockedRewards(Array.isArray(rewards) ? rewards : ['theme_default']);
  }, [user, scopeId]);

  useEffect(() => {
    reloadStarWallet();
  }, [reloadStarWallet, user]);

  useEffect(() => {
    const handleUpdate = () => {
      reloadStarWallet();
    };

    window.addEventListener('achievement-stars-updated', handleUpdate);
    window.addEventListener('selfcare-state-change', handleUpdate);
    window.addEventListener('unlocked-rewards-changed', handleUpdate);
    window.addEventListener('add-achievement-log', handleUpdate);
    window.addEventListener('user-auth-changed', handleUpdate);

    return () => {
      window.removeEventListener('achievement-stars-updated', handleUpdate);
      window.removeEventListener('selfcare-state-change', handleUpdate);
      window.removeEventListener('unlocked-rewards-changed', handleUpdate);
      window.removeEventListener('add-achievement-log', handleUpdate);
      window.removeEventListener('user-auth-changed', handleUpdate);
    };
  }, [reloadStarWallet]);

  const spendStars = useCallback((cost: number, itemId: string): boolean => {
    if (availableStars < cost) {
      return false;
    }

    const currentSpent = getTotalStarsSpent(user);
    const newSpent = currentSpent + cost;
    const newAvailable = Math.max(0, totalStarsEarned - newSpent);

    setTotalStarsSpent(newSpent);
    setAvailableStars(newAvailable);
    setScopedItem('achievement_spent_stars', newSpent, scopeId);
    setScopedItem('user_stars', newAvailable, scopeId);

    if (userId && userId !== 'anonymous') {
      try {
        localStorage.setItem(`achievement_spent_stars_${userId}`, newSpent.toString());
        localStorage.setItem(`user_spent_stars_${userId}`, newSpent.toString());
        localStorage.setItem(`user_stars_${userId}`, newAvailable.toString());
      } catch {}
    }

    const currentRewards: string[] = getScopedItem('unlocked_rewards', ['theme_default'], scopeId);
    const updatedRewards = Array.from(new Set([...(Array.isArray(currentRewards) ? currentRewards : []), itemId]));
    setUnlockedRewards(updatedRewards);
    setScopedItem('unlocked_rewards', updatedRewards, scopeId);

    if (userId && userId !== 'anonymous') {
      try {
        localStorage.setItem(`unlocked_rewards_${userId}`, JSON.stringify(updatedRewards));
      } catch {}
    }

    window.dispatchEvent(new CustomEvent('unlocked-rewards-changed', { detail: { rewards: updatedRewards, purchasedItemId: itemId } }));
    window.dispatchEvent(new CustomEvent('achievement-stars-updated', {
      detail: { totalEarnedStars: totalStarsEarned, totalStarsEarned, spentStars: newSpent, totalStarsSpent: newSpent, availableStars: newAvailable }
    }));

    return true;
  }, [availableStars, totalStarsEarned, user, scopeId, userId]);

  return (
    <StarContext.Provider
      value={{
        totalStarsEarned,
        totalEarnedStars: totalStarsEarned,
        totalStarsSpent,
        spentStars: totalStarsSpent,
        availableStars,
        unlockedRewards,
        spendStars,
        reloadStarWallet
      }}
    >
      {children}
    </StarContext.Provider>
  );
};

export const useStarWallet = (): StarWalletState => {
  const context = useContext(StarContext);
  if (!context) {
    throw new Error('useStarWallet must be used within a StarProvider');
  }
  return context;
};

export const useStarContext = useStarWallet;
export default StarContext;
