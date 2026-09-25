import React, { createContext, useContext, useState } from 'react';
import { hydrateFromUserData } from '../lib/scopedStorage';
import { syncUserToAllAppUsers } from '../lib/userSync';
import { UserProfile } from '../types';

export type { UserProfile };

export interface AuthContextType {
  user: UserProfile | null;
  currentUser: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (newToken: string, newUser: UserProfile) => void;
  logout: () => void;
  updateProfile: (updated: Partial<UserProfile>) => Promise<void>;
  updateUserProgress: (updated: Partial<UserProfile>) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const isAuthenticated = Boolean(token && user);

  const login = (newToken: string, newUser: UserProfile) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);

    if (newUser.appData) {
      hydrateFromUserData(newUser.appData, newUser);
    }

    // Synchronize to all_app_users store
    syncUserToAllAppUsers(newUser);

    // Trigger state reload events across application
    window.dispatchEvent(new Event('selfcare-state-change'));
    window.dispatchEvent(new Event('achievement-stars-updated'));
    window.dispatchEvent(new Event('user-auth-changed'));
    window.dispatchEvent(new Event('user-progress-synced'));
  };

  const logout = () => {
    // Only remove active session identifiers from localStorage.
    // CRITICAL: DO NOT clear or remove any user_stars_*, user_achievements_*, or user_history_* data!
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);

    window.dispatchEvent(new Event('selfcare-state-change'));
    window.dispatchEvent(new Event('achievement-stars-updated'));
    window.dispatchEvent(new Event('user-auth-changed'));
  };

  const updateProfile = async (updated: Partial<UserProfile>) => {
    if (!user) return;
    const userId = user.id || user._id || 'guest';
    const currentAvatar = updated.avatar || user.avatar || localStorage.getItem(`user_avatar_${userId}`) || '🌸';
    const currentMotto = updated.motto !== undefined ? updated.motto : (user.motto || localStorage.getItem(`user_motto_${userId}`) || '');

    const newUser: UserProfile = {
      ...user,
      ...updated,
      avatar: currentAvatar,
      motto: currentMotto
    };

    setUser(newUser);
    localStorage.setItem('user', JSON.stringify(newUser));

    // Update in all_app_users store
    syncUserToAllAppUsers(newUser);

    if (token) {
      try {
        await fetch('/api/user/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            username: newUser.username,
            avatar: currentAvatar,
            motto: currentMotto,
            streak: newUser.streak,
            circlePoints: newUser.circlePoints,
            emotionalCircles: newUser.emotionalCircles,
            peaceScore: newUser.peaceScore,
            stars: newUser.stars
          })
        });
      } catch (err) {
        console.error('Failed to update profile in backend:', err);
      }
    }
  };

  const updateUserProgress = async (updated: Partial<UserProfile>) => {
    if (!user) return;
    const newUser: UserProfile = {
      ...user,
      ...updated
    };

    setUser(newUser);
    localStorage.setItem('user', JSON.stringify(newUser));

    // Update in all_app_users store
    syncUserToAllAppUsers(newUser);

    if (token) {
      try {
        await fetch('/api/user/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            streak: newUser.streak,
            circlePoints: newUser.circlePoints,
            emotionalCircles: newUser.emotionalCircles,
            peaceScore: newUser.peaceScore,
            stars: newUser.stars
          })
        });
      } catch (err) {
        console.error('Failed to sync progress to backend:', err);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        currentUser: user,
        token,
        isAuthenticated,
        login,
        logout,
        updateProfile,
        updateUserProgress
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
