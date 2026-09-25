import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Heart, Sparkles, BookOpen, Calendar, Smile, Compass, Users, 
  Settings, Award, MessageSquare, Info, RefreshCw, Volume2, VolumeX, Menu, LogOut, Shield, Trophy, LockKeyhole, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { JournalEntry, EmotionType, EMOTIONS } from './types';
import { calculateAvailableStars, checkAchievementCompletion } from './lib/achievements';
import { getStoredStreak, evaluateDailyStreak, recordDailyPractice, syncStreakFromProfile } from './lib/streak';
import { checkAndResetDailyTasks } from './lib/dailyReset';
import { hydrateFromUserData, setScopedItem, getScopedItem } from './lib/scopedStorage';
import { syncUserToAllAppUsers } from './lib/userSync';
import Journal from './components/Journal';
import SelfCare from './components/SelfCare';
import MoodTracking from './components/MoodTracking';
import Connections from './components/Connections';
import ErrorBoundary from './components/ErrorBoundary';
import Auth from './components/Auth';
import AdminPanel from './components/AdminPanel';
import UserSettings from './components/UserSettings';
import PasswordInput from './components/PasswordInput';
import Achievements from './components/Achievements';
import ThemeBackgroundAnimation from './components/ThemeBackgroundAnimation';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UserProvider, useUser } from './context/UserContext';
import { StarProvider, useStarWallet } from './context/StarContext';
import StarWallet from './components/StarWallet';

function MainAppContent() {
  const { user, token, login, logout, updateProfile } = useAuth();
  const { stars, reloadUserData } = useUser();
  const { totalStarsEarned, totalStarsSpent, availableStars: walletAvailableStars } = useStarWallet();

  // Role-based Admin check strictly by role
  const isAdmin = user?.role === 'admin' || user?.role === 'ADMIN';

  // Navigation states
  const [activeTab, setActiveTab] = useState<'home' | 'journal' | 'self_care' | 'mood' | 'connections' | 'admin' | 'user_settings' | 'settings' | 'achievements'>('home');
  const [achievementsSubTab, setAchievementsSubTab] = useState<'badges' | 'shop'>('badges');
  const [selfCareTab, setSelfCareTab] = useState<string>('water');

  // Journal 4-Digit PIN Lock states
  const [isJournalUnlocked, setIsJournalUnlocked] = useState(false);
  const [inputPin, setInputPin] = useState('');
  const [pinModalError, setPinModalError] = useState<string | null>(null);
  const [showMobileLogoutConfirm, setShowMobileLogoutConfirm] = useState(false);

  const userId = user?.id || user?._id || 'guest';
  const isPinEnabled = localStorage.getItem(`journal_pin_enabled_${userId}`) === 'true';
  const storedPin = localStorage.getItem(`journal_pin_code_${userId}`);

  const handleOpenShop = () => {
    setAchievementsSubTab('shop');
    setActiveTab('achievements');
  };
  
  // App-level metrics & states (dynamically synchronized)
  const [streak, setStreak] = useState<number>(() => user ? getStoredStreak(user) : 0); // "Chấm Tròn Kiên Trì" (Day Streak)
  const [emotionalCircles, setEmotionalCircles] = useState(0); // Total Habit practices
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loadingDb, setLoadingDb] = useState(false);
  const [appTheme, setAppTheme] = useState(() => {
    return getScopedItem<string>('current_active_theme_id', '', user) || 
           getScopedItem<string>('app_theme', '', user) || 
           localStorage.getItem('current_active_theme_id') || 
           localStorage.getItem('app_theme') || 
           'theme_default';
  });

  // Reset user personal progress callback
  const handleResetUserData = () => {
    setEntries([]);
    localStorage.setItem('user_streak', '1');
    setScopedItem('user_stars', 0, user);
    setStreak(1);
    setEmotionalCircles(0);
    window.dispatchEvent(new Event('streak-updated'));
    window.dispatchEvent(new Event('achievement-stars-updated'));
  };

  // Update user profile callback (nickname, avatar, motto)
  const handleUpdateUserProfile = async (updated: any) => {
    await updateProfile(updated);
  };

  // Available stars calculation state
  const [availableStars, setAvailableStars] = useState<number>(() => {
    return checkAchievementCompletion(getStoredStreak(user), 0, false, user).availableStars;
  });

  // Keep stars synced with UserContext & StarContext
  useEffect(() => {
    if (typeof walletAvailableStars === 'number') {
      setAvailableStars(walletAvailableStars);
    } else {
      setAvailableStars(stars);
    }
  }, [walletAvailableStars, stars]);

  const [pendingInvitesCount, setPendingInvitesCount] = useState<number>(0);
  const [unreadCardsCount, setUnreadCardsCount] = useState<number>(0);
  const [globalActiveCardPopup, setGlobalActiveCardPopup] = useState<any | null>(null);
  const [dismissedCardIds, setDismissedCardIds] = useState<Set<string>>(new Set());

  const checkCloudSync = useCallback(async () => {
    if (!user) {
      setPendingInvitesCount(0);
      setUnreadCardsCount(0);
      return;
    }
    const userId = user.id || user._id || 'guest';
    const userCode = user.circleCode || localStorage.getItem(`user_circle_code_${userId}`) || '';
    const username = user.username || (user as any).name || 'Bạn đồng hành';
    const token = localStorage.getItem('token');
    const safeToken = token ? token.replace(/[^\x00-\x7F]/g, '') : '';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (safeToken) headers['Authorization'] = `Bearer ${safeToken}`;
    if (userId) headers['x-user-id'] = encodeURIComponent(userId);
    if (userCode) headers['x-circle-code'] = encodeURIComponent(userCode);
    if (username) headers['x-username'] = encodeURIComponent(username);

    // 1. Check pending friend requests
    try {
      const resReqs = await fetch('/api/friend-requests', { headers });
      if (resReqs.ok) {
        const data = await resReqs.json();
        if (Array.isArray(data.requests)) {
          setPendingInvitesCount(data.requests.length);
          try {
            localStorage.setItem(`user_friend_requests_${userId}`, JSON.stringify(data.requests));
            localStorage.setItem(`app_companion_invites_${userId}`, JSON.stringify(data.requests));
          } catch (e) {}
        }
      }
    } catch (e) {}

    // 2. Check sweet cards
    try {
      const resCards = await fetch('/api/sweet-cards', { headers });
      if (resCards.ok) {
        const data = await resCards.json();
        if (Array.isArray(data.cards)) {
          const cards: any[] = data.cards;
          const unreadCards = cards.filter(c => !c.isRead);
          setUnreadCardsCount(unreadCards.length);

          // Find an unread card that hasn't been dismissed in this session
          const popupCard = unreadCards.find(c => !dismissedCardIds.has(c.id));
          if (popupCard && !globalActiveCardPopup) {
            setGlobalActiveCardPopup(popupCard);
          }

          try {
            localStorage.setItem(`user_received_cards_${userId}`, JSON.stringify(cards));
            localStorage.setItem(`app_received_cards_${userId}`, JSON.stringify(cards));
          } catch (e) {}
        }
      }
    } catch (e) {}
  }, [user, globalActiveCardPopup, dismissedCardIds]);

  useEffect(() => {
    checkCloudSync();
    if (user) {
      checkAndResetDailyTasks(user);
    }

    const handleFocus = () => {
      checkCloudSync();
      if (user) {
        checkAndResetDailyTasks(user);
      }
    };

    window.addEventListener('friend-requests-updated', checkCloudSync);
    window.addEventListener('sweet-cards-updated', checkCloudSync);
    window.addEventListener('companions-updated', checkCloudSync);
    window.addEventListener('user-auth-changed', checkCloudSync);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    // Auto refresh every 3 seconds for instant real-time cross-device sync
    const interval = setInterval(() => {
      checkCloudSync();
      if (user) {
        checkAndResetDailyTasks(user);
      }
    }, 3000);

    return () => {
      window.removeEventListener('friend-requests-updated', checkCloudSync);
      window.removeEventListener('sweet-cards-updated', checkCloudSync);
      window.removeEventListener('companions-updated', checkCloudSync);
      window.removeEventListener('user-auth-changed', checkCloudSync);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      clearInterval(interval);
    };
  }, [checkCloudSync]);

  // 1. Initial Streak Evaluation on App / User Load (Runs safely when user ID changes)
  useEffect(() => {
    if (user) {
      const calculatedStreak = evaluateDailyStreak(user);
      setStreak(calculatedStreak);
      checkAndResetDailyTasks(user);
    } else {
      setStreak(0);
    }
  }, [user?.id, user?.username]);

  // 2. Listen for theme changes or star/streak events
  useEffect(() => {
    const updateStarsAndTheme = (e?: any) => {
      const customTheme = e?.detail?.themeId || e?.detail?.theme;
      const theme = customTheme !== undefined 
        ? customTheme 
        : (getScopedItem<string>('current_active_theme_id', '', user) || 
           getScopedItem<string>('app_theme', '', user) || 
           localStorage.getItem('current_active_theme_id') || 
           localStorage.getItem('app_theme') || 
           'theme_default');
      setAppTheme(theme);

      // DOM Cleanup of theme classes
      if (theme === 'none' || !theme) {
        document.body.classList.remove('theme-green', 'theme-gold', 'theme-purple', 'theme-bubbles', 'theme-fireworks', 'theme-default', 'theme-rose', 'theme-ambient-petals');
      }

      const currentStreak = getStoredStreak(user);
      setStreak(currentStreak);
      const starData = checkAchievementCompletion(currentStreak, entries.length, false, user);
      setAvailableStars(starData.availableStars);
    };

    updateStarsAndTheme();

    window.addEventListener('app-theme-changed' as any, updateStarsAndTheme);
    window.addEventListener('add-achievement-log' as any, updateStarsAndTheme);
    window.addEventListener('selfcare-state-change' as any, updateStarsAndTheme);
    window.addEventListener('achievement-stars-updated' as any, updateStarsAndTheme);
    window.addEventListener('unlocked-rewards-changed' as any, updateStarsAndTheme);
    window.addEventListener('daily-tasks-reset' as any, updateStarsAndTheme);
    window.addEventListener('streak-updated' as any, updateStarsAndTheme);
    return () => {
      window.removeEventListener('app-theme-changed' as any, updateStarsAndTheme);
      window.removeEventListener('add-achievement-log' as any, updateStarsAndTheme);
      window.removeEventListener('selfcare-state-change' as any, updateStarsAndTheme);
      window.removeEventListener('achievement-stars-updated' as any, updateStarsAndTheme);
      window.removeEventListener('unlocked-rewards-changed' as any, updateStarsAndTheme);
      window.removeEventListener('daily-tasks-reset' as any, updateStarsAndTheme);
      window.removeEventListener('streak-updated' as any, updateStarsAndTheme);
    };
  }, [entries.length, user]);

  // Audio system controls for meditation music
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingAmbient, setIsPlayingAmbient] = useState(false);

  // Quote rotation state
  const quotes = [
    { text: "Hôm nay bạn đã làm rất tốt rồi, hãy dịu dàng ôm lấy chính mình nhé.", author: "Chấm Tròn Bình Yên" },
    { text: "Bão giông nào rồi cũng sẽ nhường chỗ cho những đóa hoa rực rỡ.", author: "Nhành Cát Tường" },
    { text: "Mỗi ngày trôi qua, nỗ lực nhỏ nhoi của bạn đều vô cùng trân quý.", author: "Hạt Mầm Hy Vọng" },
    { text: "Cứ đi thong thả thôi, bạn không cần phải vội vã cùng ai cả.", author: "Đóa Thạch Thảo" }
  ];
  const [quoteIndex, setQuoteIndex] = useState(0);

  // Jump straight to lesson state in Connections
  const [jumpToLessonId, setJumpToLessonId] = useState<string | null>(null);

  // Clickable emotional circles state for Homepage (4-Color Palette)
  const [homepageCircles, setHomepageCircles] = useState([
    { id: 'hc1', color: 'bg-[#FFB6BD]/80 border-[#F89CA7]', text: 'Bình yên', emoji: '🌸', message: 'Tâm hồn thảnh thơi tựa nhành hoa nở dịu dàng.' },
    { id: 'hc2', color: 'bg-[#FFD7D5]/90 border-[#F2B6B3]', text: 'Yêu thương', emoji: '🌷', message: 'Yêu chiều bản thân chính là món quà tốt nhất.' },
    { id: 'hc3', color: 'bg-[#FFEEB6] border-[#E8CF7A]', text: 'Tươi mát', emoji: '✨', message: 'Ánh nắng ấm áp xua tan ngột ngạt tâm trí.' },
    { id: 'hc4', color: 'bg-[#AFDCF1]/90 border-[#8BC5E3]', text: 'An lành', emoji: '☁️', message: 'Cây non bén rễ sâu thì gió bão chẳng lo lay.' }
  ]);
  const [clickedCircleMsg, setClickedCircleMsg] = useState<string | null>(null);

  // Auth persistence helpers
  const handleAuthSuccess = (newToken: string, newUser: any) => {
    login(newToken, newUser);
    const evaluated = evaluateDailyStreak(newUser);
    const effectiveStreak = evaluated || newUser.streak || 1;
    setStreak(effectiveStreak);
    setEmotionalCircles(newUser.emotionalCircles || 0);
  };

  const handleLogout = () => {
    logout();
    setStreak(0);
    setEntries([]);
    setActiveTab('home');
  };

  // Load user data on startup / token change
  useEffect(() => {
    if (!token) return;

    const loadData = async () => {
      setLoadingDb(true);
      try {
        const safeToken = token.replace(/[^\x00-\x7F]/g, '');
        const authHeaders: Record<string, string> = {
          'Authorization': `Bearer ${safeToken}`
        };
        if (user) {
          const uid = (user.id || user._id || '').toString();
          if (uid) authHeaders['x-user-id'] = uid;
          if (user.circleCode) authHeaders['x-circle-code'] = user.circleCode;
          if (user.username) authHeaders['x-username'] = encodeURIComponent(user.username);
        }

        let profileRes = await fetch('/api/user/profile', { headers: authHeaders });

        // Resilient retry: if 401, retry once to guard against container reboot or network hiccup
        if (profileRes.status === 401) {
          await new Promise(r => setTimeout(r, 600));
          profileRes = await fetch('/api/user/profile', { headers: authHeaders });
        }

        if (profileRes.status === 403) {
          handleLogout();
          return;
        }

        if (profileRes.status === 401) {
          handleLogout();
          return;
        }

        if (!profileRes.ok) {
          console.warn("Profile fetch skipped due to non-OK response:", profileRes.status);
          return;
        }

        const profileData = await profileRes.json();

        if (profileData.appData) {
          hydrateFromUserData(profileData.appData, profileData);
          window.dispatchEvent(new Event('selfcare-state-change'));
          window.dispatchEvent(new Event('achievement-stars-updated'));
        }

        const evaluatedStreak = evaluateDailyStreak(profileData);
        const realStreak = evaluatedStreak || profileData.streak || 1;
        syncStreakFromProfile(realStreak, profileData);

        const effectiveUserId = profileData.id || profileData._id || (user?.id || user?._id || 'guest');
        const effectiveAvatar = profileData.avatar || localStorage.getItem(`user_avatar_${effectiveUserId}`) || localStorage.getItem('user_avatar') || '🌸';
        const effectiveMotto = profileData.motto || localStorage.getItem(`user_motto_${effectiveUserId}`) || localStorage.getItem('user_motto') || '';

        const fullProfileUser = {
          ...(user || {}),
          ...profileData,
          id: effectiveUserId,
          _id: effectiveUserId,
          avatar: effectiveAvatar,
          motto: effectiveMotto,
          streak: realStreak
        };

        // Update UserContext so latest data is active across components
        login(token, fullProfileUser);

        localStorage.setItem(`user_avatar_${effectiveUserId}`, effectiveAvatar);
        localStorage.setItem(`user_motto_${effectiveUserId}`, effectiveMotto);
        setStreak(realStreak);
        setEmotionalCircles(profileData.emotionalCircles || 0);

        const journalsRes = await fetch('/api/journals', {
          headers: authHeaders
        });
        if (journalsRes.ok) {
          const journalsData = await journalsRes.json();
          const mappedJournals = journalsData.map((j: any) => ({
            ...j,
            id: j.id || j._id
          }));
          setEntries(mappedJournals);
        }
      } catch (err) {
        console.error("Error fetching data from MongoDB:", err);
      } finally {
        setLoadingDb(false);
      }
    };

    loadData();
  }, [token]);

  // Handle journal CRUD with DB persistence
  const handleAddEntry = async (entry: JournalEntry) => {
    if (!token) return;
    try {
      const res = await fetch('/api/journals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(entry)
      });
      const savedEntry = await res.json();
      setEntries(prev => [{ ...savedEntry, id: savedEntry.id || savedEntry._id }, ...prev]);
    } catch (err) {
      console.error("Failed to save entry to MongoDB:", err);
      setEntries(prev => [entry, ...prev]);
    }
  };

  const handleUpdateEntry = async (entry: JournalEntry) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/journals/${entry.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(entry)
      });
      const updatedEntry = await res.json();
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...updatedEntry, id: updatedEntry.id || updatedEntry._id } : e));
    } catch (err) {
      console.error("Failed to update entry in MongoDB:", err);
      setEntries(prev => prev.map(e => e.id === entry.id ? entry : e));
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/journals/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setEntries(prev => prev.filter(e => e.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete entry from MongoDB:", err);
      setEntries(prev => prev.filter(e => e.id !== id));
    }
  };

  // Persist metrics updates to DB
  const handleAddCircle = async (count: number, reason: string) => {
    const nextCircles = emotionalCircles + count;
    setEmotionalCircles(nextCircles);
    if (token) {
      try {
        await fetch('/api/user/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ emotionalCircles: nextCircles })
        });
      } catch (err) {
        console.error("Failed to update circles in MongoDB:", err);
      }
    }
  };

  const handleUpdateStreak = async (newStreak?: number) => {
    const atomicStreak = typeof newStreak === 'number' && newStreak > 0 ? newStreak : getStoredStreak(user);
    setStreak(atomicStreak);
    window.dispatchEvent(new CustomEvent('streak-updated', { detail: { streak: atomicStreak } }));
    if (token) {
      try {
        await fetch('/api/user/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            streak: atomicStreak,
            circlePoints: atomicStreak
          })
        });
      } catch (err) {
        console.error("Failed to update streak in MongoDB:", err);
      }
    }
  };

  // Keep all_app_users synchronized whenever current user's journals, streak, or circles update
  useEffect(() => {
    if (!user) return;

    let peaceScore = 80;
    if (entries.length > 0) {
      const scores = entries.map(j => {
        switch (j.emotion) {
          case 'vui_ve': return 95;
          case 'binh_yen': return 90;
          case 'met_moi': return 65;
          case 'lo_lang': return 60;
          case 'buon_ba': return 55;
          case 'co_don': return 50;
          case 'tuc_gian': return 50;
          default: return 75;
        }
      });
      peaceScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }

    const { availableStars } = calculateAvailableStars(streak, entries.length, user);

    syncUserToAllAppUsers({
      ...user,
      streak,
      circlePoints: streak,
      emotionalCircles,
      journalCount: entries.length,
      diaries: [], // Keep storage lightweight
      peaceScore,
      stars: availableStars,
      lastActive: entries.length > 0 ? `${entries[0].date} ${entries[0].time || ''}`.trim() : 'Vừa xong'
    });
  }, [entries.length, streak, emotionalCircles, user?.id, user?.email]);

  useEffect(() => {
    // Intervale quotes changing
    const t = setInterval(() => {
      setQuoteIndex(prev => (prev + 1) % quotes.length);
    }, 8000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handleStopAmbientAudio = () => {
      if (ambientAudioRef.current) {
        ambientAudioRef.current.pause();
      }
      setIsPlayingAmbient(false);
    };

    window.addEventListener('stop-ambient-audio', handleStopAmbientAudio);
    return () => {
      window.removeEventListener('stop-ambient-audio', handleStopAmbientAudio);
    };
  }, []);

  // HTMLAudioElement global meditation audio playback for "Nhấn nghe nhạc thiền sưởi ấm"
  const toggleAmbientSound = async () => {
    const audioSrc = '/meditation-music.mp3';

    if (!ambientAudioRef.current) {
      const audio = new Audio(audioSrc);
      audio.loop = true;
      audio.preload = 'auto';

      audio.addEventListener('playing', () => {
        setIsPlayingAmbient(true);
      });
      audio.addEventListener('pause', () => {
        setIsPlayingAmbient(false);
      });
      audio.addEventListener('ended', () => {
        setIsPlayingAmbient(false);
      });

      ambientAudioRef.current = audio;
    } else if (!ambientAudioRef.current.src || !ambientAudioRef.current.src.endsWith('/meditation-music.mp3')) {
      ambientAudioRef.current.src = audioSrc;
    }

    if (isPlayingAmbient) {
      ambientAudioRef.current.pause();
      setIsPlayingAmbient(false);
    } else {
      // Stop any other playing ambient sound in SelfCare
      window.dispatchEvent(new CustomEvent('stop-selfcare-audio'));

      try {
        await ambientAudioRef.current.play();
        setIsPlayingAmbient(true);
      } catch (err: any) {
        setIsPlayingAmbient(false);
        if (
          err?.name === 'AbortError' ||
          err?.name === 'NotAllowedError' ||
          err?.name === 'NotSupportedError' ||
          (err?.message && (err.message.includes('supported') || err.message.includes('interrupted')))
        ) {
          return;
        }
        console.warn("Meditation playback notice:", err);
      }
    }
  };

  // Render correct Greeting based on local hours
  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Chào buổi sáng thảnh thơi';
    if (hr < 18) return 'Chào buổi chiều an lành';
    return 'Chào buổi tối tĩnh lặng';
  };

  // Render Auth panel if not logged in
  if (!token || !user) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  // Dynamic theme background canvas style class
  const getThemeBgClass = (theme: string) => {
    const norm = (theme || 'none').toLowerCase();
    if (norm === 'green' || norm === 'theme_green') return 'bg-[#F2F9F3]';
    if (norm === 'gold' || norm === 'theme_gold') return 'bg-[#FFFDF0]';
    if (norm === 'purple' || norm === 'theme_purple') return 'bg-[#F7F4FC]';
    if (norm === 'bubbles' || norm === 'effect_bubbles') return 'bg-[#F0F8FF]';
    if (norm === 'fireworks' || norm === 'effect_fireworks') return 'bg-[#FFF0F5]';
    if (norm === 'default' || norm === 'theme_default') return 'bg-[#FFF5F6]';
    return 'bg-[#FAF9F6]'; // default clean minimal background when 'none' / unapplied
  };

  return (
    <div className={`min-h-screen ${getThemeBgClass(appTheme)} text-text-minimal font-sans flex flex-col md:flex-row relative z-10 transition-colors duration-500 overflow-x-hidden`} id="app-root-container">
      
      {/* Dynamic Theme Background & Ambient Particle Animation System */}
      <ThemeBackgroundAnimation themeId={appTheme} />

      {/* Blurred Ambient background circles for 4-color palette theme */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[45%] h-[45%] rounded-full bg-[#AFDCF1]/30 blur-[120px]" />
        <div className="absolute top-[25%] -right-[15%] w-[50%] h-[50%] rounded-full bg-[#FFD7D5]/35 blur-[130px]" />
        <div className="absolute -bottom-[5%] left-[15%] w-[40%] h-[40%] rounded-full bg-[#FFEEB6]/50 blur-[110px]" />
      </div>

      {/* 1. SIDEBAR NAVIGATION FOR DESKTOP */}
      <aside className="hidden md:flex flex-col justify-between w-64 bg-white/80 backdrop-blur-md border-r border-[#AFDCF1] p-6 sticky top-0 h-screen z-20" id="desktop-sidebar">
        <div>
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 mb-6 cursor-pointer" onClick={() => setActiveTab('home')} id="sidebar-brand-logo">
            <div className="w-10 h-10 bg-[#AFDCF1] text-[#1E3A5F] border border-[#8BC5E3] rounded-2xl flex items-center justify-center font-extrabold text-xl shadow-sm">
              🌸
            </div>
            <div>
              <h2 className="font-extrabold text-sm tracking-tight text-text-minimal leading-none font-display">Những Chấm Tròn</h2>
              <span className="text-[10px] font-bold text-[#5A1A24]">CẢM XÚC</span>
            </div>
          </div>

          {/* Active User Capsule in Sidebar */}
          {user && (
            <div 
              onClick={() => setActiveTab('user_settings')}
              className="flex items-center gap-3 p-2.5 bg-white border border-[#AFDCF1] hover:border-[#8BC5E3] rounded-2xl mb-5 shadow-2xs cursor-pointer transition-all hover:bg-[#AFDCF1]/10 group"
              title="Nhấn để tùy chỉnh hồ sơ cá nhân"
              id="sidebar-user-capsule"
            >
              <div className="w-9 h-9 bg-[#AFDCF1]/40 border border-[#8BC5E3] rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                {user.avatar || localStorage.getItem(`user_avatar_${user.id || user._id || 'guest'}`) || '🌸'}
              </div>
              <div className="truncate flex-1">
                <div className="text-xs font-bold text-text-minimal truncate group-hover:text-[#1E3A5F]">{user.username || 'Người dùng'}</div>
                <div className="text-[10px] text-text-minimal/50 truncate font-medium">{user.motto || user.email || 'Cài đặt hồ sơ →'}</div>
              </div>
            </div>
          )}

          {/* Navigation Items */}
          <nav className="space-y-1.5">
            {[
              { id: 'home', label: '🤍 Trang Chủ', icon: Compass },
              { id: 'journal', label: '📓 Nhật ký cảm xúc', icon: Smile },
              { id: 'self_care', label: '🌱 Nuôi dưỡng bản thân', icon: Heart },
              { id: 'achievements', label: '🏆 Thành tựu', icon: Trophy },
              { id: 'mood', label: '📊 Theo dõi cảm xúc', icon: Calendar },
              { id: 'connections', label: '👥 Gia đình & Bạn bè', icon: Users },
              ...(isAdmin ? [{ id: 'admin', label: '👑 Quản trị hệ thống', icon: Shield }] : []),
              { id: 'user_settings', label: '⚙️ Cài đặt cá nhân', icon: Settings }
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id || (item.id === 'user_settings' && activeTab === 'settings' && !isAdmin) || (item.id === 'admin' && activeTab === 'settings' && isAdmin);
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-[#AFDCF1] text-[#1E3A5F] border border-[#8BC5E3] shadow-sm font-extrabold' 
                      : 'text-text-minimal/80 hover:bg-[#FFB6BD] hover:text-[#4A121A]'
                  }`}
                  id={`btn-sidebar-nav-${item.id}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.id === 'connections' && (pendingInvitesCount + unreadCardsCount) > 0 && (
                    <span className="px-2 py-0.5 bg-rose-500 text-white font-extrabold text-[10px] rounded-full animate-pulse shadow-2xs flex items-center gap-1">
                      🔴 {pendingInvitesCount + unreadCardsCount}
                    </span>
                  )}
                </button>
              );
            })}

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold text-rose-600 hover:bg-[#FFB6BD] hover:text-[#4A121A] transition-all cursor-pointer"
              id="btn-sidebar-nav-logout"
            >
              <LogOut className="w-4 h-4" />
              <span>Đăng xuất ({user?.username})</span>
            </button>
          </nav>
        </div>

        {/* User metrics overview */}
        <div 
          onClick={handleOpenShop}
          className="bg-[#FFEEB6]/70 border border-[#E8CF7A] p-4 rounded-2xl cursor-pointer hover:bg-[#FFEEB6] transition-all shadow-sm"
          id="sidebar-metrics-card"
        >
          <div className="flex justify-between items-center text-xs mb-2">
            <span className="text-[#4D3E00] font-extrabold uppercase tracking-wider text-[9px]">HÀNH TRÌNH KIÊN TRÌ</span>
            <span className="font-extrabold text-[#1E3A5F] bg-[#AFDCF1] px-2 py-0.5 rounded-full text-[10px] border border-[#8BC5E3]">🔮 {streak} Chấm Tròn</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl">⭐</span>
            <div>
              <span className="text-[10px] font-bold text-[#4D3E00]/80 block">Kho Báu Sao Đổi Quà</span>
              <span className="text-sm font-extrabold text-[#4D3E00]">{availableStars} ⭐ Khả Dụng</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-[#E8CF7A]/60 flex justify-between items-center text-[10px] font-extrabold text-[#4D3E00]">
            <span>Mở cửa hàng đổi quà</span>
            <span>→</span>
          </div>
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE */}
      <main className="flex-1 overflow-y-auto pb-24 md:pb-6" id="main-workspace-scrollable">
        
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-3.5 py-3 bg-white/95 backdrop-blur-md sticky top-0 z-40 border-b border-[#AFDCF1]/80 shadow-2xs" id="mobile-header">
          <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => setActiveTab('home')}>
            <span className="text-2xl">🌸</span>
            <h2 className="font-extrabold text-sm tracking-tight text-text-minimal font-display hidden xs:inline sm:inline">Những Chấm Tròn</h2>
          </div>
          
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <button 
              onClick={() => setActiveTab('achievements')}
              className="text-[11px] font-extrabold bg-[#AFDCF1] text-[#1E3A5F] px-2 py-1 rounded-full border border-[#8BC5E3] cursor-pointer shadow-2xs active:scale-95 transition-transform"
              title="Số ngày kiên trì tự chăm sóc"
            >
              🔮 {streak}
            </button>
            <button 
              onClick={handleOpenShop}
              className="text-[11px] font-extrabold bg-[#FFEEB6] text-[#4D3E00] px-2 py-1 rounded-full border border-[#E8CF7A] cursor-pointer shadow-2xs hover:bg-[#FFE699] active:scale-95 transition-transform"
              title="Cửa Hàng Đổi Sao"
              id="btn-mobile-header-stars-shop"
            >
              ⭐ {availableStars}
            </button>
            <button 
              onClick={toggleAmbientSound}
              className={`p-1.5 rounded-full border cursor-pointer transition-colors ${isPlayingAmbient ? 'bg-[#AFDCF1] text-[#1E3A5F] border-[#8BC5E3]' : 'bg-white/70 border-[#AFDCF1] text-text-minimal/80'}`}
              title="Nhạc thiền tịnh tâm"
            >
              {isPlayingAmbient ? <Volume2 className="w-3.5 h-3.5 animate-pulse" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setActiveTab('user_settings')}
              className="w-7 h-7 bg-white border border-[#AFDCF1] rounded-full flex items-center justify-center text-sm cursor-pointer shadow-2xs hover:scale-105 active:scale-95 transition-transform"
              title="Cài đặt cá nhân"
              id="btn-mobile-header-avatar"
            >
              {user?.avatar || localStorage.getItem(`user_avatar_${user?.id || user?._id || 'guest'}`) || '🌸'}
            </button>
            {/* Mobile Header Logout Button */}
            <button
              type="button"
              onClick={() => setShowMobileLogoutConfirm(true)}
              className="p-1.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 cursor-pointer shadow-2xs transition-all active:scale-95 flex items-center justify-center"
              title="Đăng xuất khỏi thiết bị"
              id="btn-mobile-header-logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Main Content Sections */}
        <AnimatePresence mode="wait">
          
          {/* TAB 1: HOMEPAGE */}
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-6 md:p-10 space-y-10"
              id="home-tab-view"
            >
              <ErrorBoundary fallbackTitle="Không gian Khám Phá đang tải lại" onReset={() => setActiveTab('home')}>
                {/* Dynamic Welcome Banner */}
              <div className="bg-white/90 backdrop-blur-md border border-[#AFDCF1] p-8 rounded-[30px] relative overflow-hidden minimal-shadow">
                <div className="absolute right-4 top-4 text-[#AFDCF1]/30 pointer-events-none select-none">
                  <Sparkles className="w-36 h-36" />
                </div>

                <div className="relative z-10">
                  <span className="text-[10px] font-bold text-[#1E3A5F] uppercase tracking-widest block mb-1">Mỗi ngày là một nhành mầm mới</span>
                  <h1 className="text-2xl md:text-3xl font-serif text-text-minimal tracking-tight leading-tight">
                    {getGreeting()}, <span className="text-[#5A1A24] font-bold italic">{user?.username || 'Người Bạn Thân Mến'}!</span>
                  </h1>
                  <p className="text-text-minimal/80 text-xs mt-2 max-w-md font-sans">Hôm nay Chấm Tròn Cảm Xúc đã sẵn sàng lắng thấu từng suy tư mộc mạc và sưởi ấm lòng bạn.</p>
                  
                  {/* Micro Ambient button */}
                  <button
                    onClick={toggleAmbientSound}
                    className="mt-6 flex items-center gap-2 bg-[#FFB6BD] hover:bg-[#FF8E98] text-[#4A121A] font-extrabold text-xs px-5 py-2.5 rounded-full shadow-sm cursor-pointer transition-all hover:scale-[1.02] relative z-20 border border-[#F89CA7]"
                    id="btn-home-ambient-play"
                  >
                    {isPlayingAmbient ? <Volume2 className="w-4 h-4 animate-bounce text-[#4A121A]" /> : <VolumeX className="w-4 h-4 text-[#4A121A]" />}
                    <span>{isPlayingAmbient ? 'Đang phát nhạc thiền sưởi ấm...' : 'Nhấn nghe nhạc thiền sưởi ấm'}</span>
                  </button>
                </div>
              </div>

              {/* Clickable Circle Orbs Grid */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-text-minimal text-sm flex items-center gap-1.5 font-display">
                    <span>💡</span> Gõ nhẹ Chấm Tròn gieo hạt Bình Yên
                  </h3>
                  <p className="text-text-minimal/50 text-[10px] mt-0.5">Mỗi đóa chấm tròn ẩn chứa những thông điệp yêu thương dịu dàng dành tặng bạn.</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" id="home-orbs-grid">
                  {homepageCircles.map((circle) => (
                    <button
                      key={circle.id}
                      onClick={() => {
                        setClickedCircleMsg(circle.message);
                        const newStreak = recordDailyPractice(user);
                        handleUpdateStreak(newStreak);
                      }}
                      className={`p-6 rounded-3xl text-center border ${circle.color} backdrop-blur-sm hover:scale-105 cursor-pointer shadow-sm transition-all`}
                      id={`btn-orb-circle-${circle.id}`}
                    >
                      <span className="text-4xl block mb-2 animate-bounce">{circle.emoji}</span>
                      <span className="text-xs font-semibold text-text-minimal">{circle.text}</span>
                    </button>
                  ))}
                </div>

                {clickedCircleMsg && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-[#FFEEB6]/80 border border-[#E8CF7A] rounded-2xl text-[#4D3E00] text-xs font-bold text-center italic minimal-shadow"
                  >
                    "{clickedCircleMsg}"
                  </motion.div>
                )}
              </div>

              {/* Gentle Quote Panel */}
              <div className="bg-[#FFEEB6]/40 backdrop-blur-sm border border-[#E8CF7A] p-6 rounded-3xl shadow-sm text-center">
                <span className="text-[10px] font-bold text-[#4D3E00] uppercase tracking-wider block mb-2">Lời thì thầm từ Gió</span>
                <p className="text-text-minimal text-xs leading-relaxed italic max-w-xl mx-auto transition-all font-serif">
                  "{quotes[quoteIndex].text}"
                </p>
                <span className="text-[11px] text-[#5A1A24] font-extrabold block mt-3">~ {quotes[quoteIndex].author}</span>
              </div>

              {/* Navigation Widgets Shortcut */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                
                {/* Journal widget shortcut */}
                <div className="bg-white border border-[#FFD7D5] p-6 rounded-3xl shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-2xl block mb-2">📓</span>
                    <h4 className="font-bold text-text-minimal text-xs mb-1 font-display">Mở Sổ Tay Nhật Ký</h4>
                    <p className="text-text-minimal/70 text-[10px] leading-relaxed">Viết nhật ký, thu âm cảm nhận hoặc đính kèm ảnh thiên nhiên chữa lành cùng AI.</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('journal')}
                    className="mt-4 bg-[#FFD7D5] hover:bg-[#FFB6BD] text-[#5A1A24] font-extrabold text-[11px] py-2.5 px-4 rounded-xl text-center border border-[#F2B6B3] cursor-pointer transition-all shadow-sm"
                  >
                    Bắt đầu viết ngay
                  </button>
                </div>

                {/* Self Care widget */}
                <div className="bg-white border border-[#FFEEB6] p-6 rounded-3xl shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-2xl block mb-2">🌱</span>
                    <h4 className="font-bold text-text-minimal text-xs mb-1 font-display">Nuôi Dưỡng Bản Thân</h4>
                    <p className="text-text-minimal/70 text-[10px] leading-relaxed">Hít thở sâu, uống nước đầy đủ, rèn luyện yoga tĩnh lặng và lắng nghe âm thanh dịu mát.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setSelfCareTab('water');
                      setActiveTab('self_care');
                    }}
                    className="mt-4 bg-[#FFEEB6] hover:bg-[#FFB6BD] text-[#4D3E00] hover:text-[#4A121A] font-extrabold text-[11px] py-2.5 px-4 rounded-xl text-center border border-[#E8CF7A] cursor-pointer transition-all shadow-sm"
                  >
                    Bắt đầu thực hành
                  </button>
                </div>

                {/* TikTok Healing Video widget */}
                <div className="bg-white border border-rose-200 p-6 rounded-3xl shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-2xl block mb-2">🎬</span>
                    <h4 className="font-bold text-text-minimal text-xs mb-1 font-display">Video TikTok Chữa Lành</h4>
                    <p className="text-text-minimal/70 text-[10px] leading-relaxed">Lắng nghe video ngắn tích cực và podcast an trú mộc mạc do Ban Quản Trị chọn lọc.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setSelfCareTab('tiktok');
                      setActiveTab('self_care');
                    }}
                    className="mt-4 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-extrabold text-[11px] py-2.5 px-4 rounded-xl text-center cursor-pointer transition-all shadow-sm"
                  >
                    Xem & Nghe video hôm nay
                  </button>
                </div>

                {/* Connections widget */}
                <div className="bg-white border border-[#AFDCF1] p-6 rounded-3xl shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-2xl block mb-2">👥</span>
                    <h4 className="font-bold text-text-minimal text-xs mb-1 font-display">Gia Đình & Bạn Bè</h4>
                    <p className="text-text-minimal/70 text-[10px] leading-relaxed">Kết nối cùng bạn đồng hành, gieo mầm tri ân ngọt ngào và đọc bài học dịu dàng.</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('connections')}
                    className="mt-4 bg-[#AFDCF1] hover:bg-[#FFB6BD] text-[#1E3A5F] hover:text-[#4A121A] font-extrabold text-[11px] py-2.5 px-4 rounded-xl text-center border border-[#8BC5E3] cursor-pointer transition-all shadow-sm"
                  >
                    Góc kết nối chân thành
                  </button>
                </div>

              </div>
              </ErrorBoundary>
            </motion.div>
          )}

          {/* TAB 2: JOURNAL MODULE */}
          {activeTab === 'journal' && (
            <motion.div
              key="journal"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ErrorBoundary fallbackTitle="Sổ Tay Nhật Ký đang đồng bộ" onReset={() => setActiveTab('home')}>
                <Journal 
                  entries={entries}
                  streak={streak}
                  onAddEntry={handleAddEntry}
                  onUpdateEntry={handleUpdateEntry}
                  onDeleteEntry={handleDeleteEntry}
                  onAddCircle={handleAddCircle}
                  onUpdateStreak={setStreak}
                  onNavigateToLesson={(lessonId) => {
                    setJumpToLessonId(lessonId);
                    setActiveTab('connections');
                  }}
                  onNavigateToSelfCare={() => setActiveTab('self_care')}
                  onBack={() => setActiveTab('home')}
                />
              </ErrorBoundary>
            </motion.div>
          )}

          {/* TAB 3: SELF CARE ACTIONS MODULE */}
          {activeTab === 'self_care' && (
            <motion.div
              key="self_care"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ErrorBoundary fallbackTitle="Không gian Nuôi Dưỡng Bản Thân đang làm mới" onReset={() => setActiveTab('home')}>
                <SelfCare 
                  streak={streak}
                  onAddCircle={handleAddCircle}
                  onUpdateStreak={setStreak}
                  onBack={() => setActiveTab('home')}
                  initialTab={selfCareTab}
                />
              </ErrorBoundary>
            </motion.div>
          )}

          {/* TAB 4: ACHIEVEMENTS & REWARDS */}
          {activeTab === 'achievements' && (
            <motion.div
              key="achievements"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ErrorBoundary fallbackTitle="Kho Tàng Thành Tựu & Cửa Hàng đang đồng bộ" onReset={() => setActiveTab('home')}>
                <Achievements 
                  streak={streak}
                  emotionalCircles={emotionalCircles}
                  entries={entries}
                  initialSubTab={achievementsSubTab}
                  onBack={() => setActiveTab('home')}
                  onNavigateToSelfCare={() => setActiveTab('self_care')}
                />
              </ErrorBoundary>
            </motion.div>
          )}

          {/* TAB 5: MOOD TRACKING CHARTS MODULE */}
          {activeTab === 'mood' && (
            <motion.div
              key="mood"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ErrorBoundary fallbackTitle="Biểu Đồ Theo Dõi Cảm Xúc đang cập nhật" onReset={() => setActiveTab('home')}>
                <MoodTracking 
                  currentUser={user}
                  entries={entries}
                  streak={streak}
                  onNavigateToJournal={() => setActiveTab('journal')}
                  onNavigateToSelfCare={() => setActiveTab('self_care')}
                  onAddCircle={handleAddCircle}
                  onBack={() => setActiveTab('home')}
                />
              </ErrorBoundary>
            </motion.div>
          )}

          {/* TAB 5: CONNECTIONS (FAMILY & FRIENDS) */}
          {activeTab === 'connections' && (
            <motion.div
              key="connections"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ErrorBoundary 
                fallbackTitle="Không gian Gia Đình & Bạn Bè đang đồng bộ"
                onReset={() => setActiveTab('home')}
              >
                <Connections 
                  streak={streak}
                  onAddCircle={handleAddCircle}
                  onUpdateStreak={setStreak}
                  onBack={() => setActiveTab('home')}
                  initialLessonId={jumpToLessonId}
                  onClearInitialLesson={() => setJumpToLessonId(null)}
                />
              </ErrorBoundary>
            </motion.div>
          )}

          {/* TAB 6: ADMIN PANEL (Visible ONLY for Admin) */}
          {(activeTab === 'admin' || (activeTab === 'settings' && isAdmin)) && isAdmin && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ErrorBoundary fallbackTitle="Bảng Quản Trị Hệ Thống đang tải lại" onReset={() => setActiveTab('home')}>
                <AdminPanel 
                  currentUser={user}
                  token={token || ''}
                  onBack={() => setActiveTab('home')}
                />
              </ErrorBoundary>
            </motion.div>
          )}

          {/* PREVENT BLANK SCREEN IF NON-ADMIN ATTEMPTS ADMIN TAB */}
          {activeTab === 'admin' && !isAdmin && (
            <motion.div
              key="no_admin_perm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-8 max-w-lg mx-auto text-center space-y-4 bg-white/95 rounded-[32px] border border-amber-200 shadow-sm mt-10"
            >
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl border border-amber-200 flex items-center justify-center mx-auto text-xl shadow-2xs">
                🛡️
              </div>
              <h3 className="text-base font-bold font-serif text-text-minimal">Khu Vực Quản Trị Viên</h3>
              <p className="text-xs text-text-minimal/70 leading-relaxed">
                Tài khoản của bạn hiện không có quyền truy cập bảng quản trị hệ thống.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('home')}
                className="px-5 py-2.5 bg-[#AFDCF1] hover:bg-[#8BC5E3] text-[#1E3A5F] font-bold text-xs rounded-2xl cursor-pointer transition-all shadow-2xs active:scale-95"
              >
                Quay về Trang Chủ
              </button>
            </motion.div>
          )}

          {/* TAB 7: USER PERSONAL SETTINGS */}
          {(activeTab === 'user_settings' || (activeTab === 'settings' && !isAdmin)) && (
            <motion.div
              key="user_settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ErrorBoundary fallbackTitle="Cài Đặt Cá Nhân đang làm mới" onReset={() => setActiveTab('home')}>
                <UserSettings 
                  currentUser={user}
                  token={token || ''}
                  onUpdateProfile={handleUpdateUserProfile}
                  onResetData={handleResetUserData}
                  onBack={() => setActiveTab('home')}
                  onLogout={handleLogout}
                />
              </ErrorBoundary>
            </motion.div>
          )}

          {/* UNIVERSAL FALLBACK FOR ANY UNKNOWN TAB: PREVENTS BLANK PAGE ON MOBILE */}
          {!['home', 'journal', 'self_care', 'achievements', 'mood', 'connections', 'user_settings', 'admin', 'settings'].includes(activeTab) && (
            <motion.div
              key="unknown_tab_fallback"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-8 max-w-lg mx-auto text-center space-y-4 bg-white/95 rounded-[32px] border border-accent-minimal/60 shadow-sm mt-10"
            >
              <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-2xl border border-sky-200 flex items-center justify-center mx-auto text-xl shadow-2xs">
                🧭
              </div>
              <h3 className="text-base font-bold font-serif text-text-minimal">Trang Không Khả Dụng</h3>
              <p className="text-xs text-text-minimal/70 leading-relaxed">
                Trang bạn yêu cầu tạm thời không tìm thấy hoặc phiên làm việc đã được làm mới.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('home')}
                className="px-5 py-2.5 bg-[#AFDCF1] hover:bg-[#8BC5E3] text-[#1E3A5F] font-bold text-xs rounded-2xl cursor-pointer transition-all shadow-2xs active:scale-95"
              >
                Trở Về Trang Chủ
              </button>
            </motion.div>
          )}

        </AnimatePresence>

      </main>

      {/* JOURNAL 4-DIGIT PIN UNLOCK MODAL */}
      <AnimatePresence>
        {activeTab === 'journal' && isPinEnabled && storedPin && !isJournalUnlocked && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-[#AFDCF1] p-6 md:p-8 rounded-[32px] max-w-sm w-full shadow-2xl text-center space-y-5"
            >
              <div className="w-14 h-14 bg-[#AFDCF1]/40 border border-[#8BC5E3] text-[#1E3A5F] rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                <LockKeyhole className="w-7 h-7 text-[#1E3A5F]" />
              </div>

              <div>
                <h3 className="text-lg font-serif font-bold text-text-minimal">
                  Khóa Nhật Ký Cảm Xúc
                </h3>
                <p className="text-xs text-text-minimal/60 mt-1">
                  Vui lòng nhập mã PIN 4 chữ số để mở khóa nhật ký riêng tư.
                </p>
              </div>

              {pinModalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl">
                  {pinModalError}
                </div>
              )}

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (inputPin === storedPin) {
                    setIsJournalUnlocked(true);
                    setPinModalError(null);
                    setInputPin('');
                  } else {
                    setPinModalError('Mã PIN không chính xác, vui lòng thử lại.');
                  }
                }}
                className="space-y-4"
              >
                <PasswordInput
                  maxLength={4}
                  autoFocus
                  value={inputPin}
                  showIcon={false}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setInputPin(val);
                    setPinModalError(null);
                    if (val.length === 4) {
                      if (val === storedPin) {
                        setIsJournalUnlocked(true);
                        setPinModalError(null);
                        setInputPin('');
                      } else {
                        setPinModalError('Mã PIN không chính xác, vui lòng thử lại.');
                      }
                    }
                  }}
                  placeholder="••••"
                  inputClassName="bg-bg-minimal border border-accent-minimal rounded-2xl focus:border-[#1E3A5F] text-center font-mono text-2xl tracking-[0.5em] text-text-minimal shadow-inner"
                  id="journal-unlock-pin-input"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('home')}
                    className="w-1/2 py-3 bg-bg-minimal hover:bg-gray-100 border border-accent-minimal text-text-minimal font-bold rounded-2xl text-xs cursor-pointer"
                  >
                    Trở Lại
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-3 bg-[#AFDCF1] hover:bg-[#92CBE8] text-[#1E3A5F] border border-[#8BC5E3] font-extrabold rounded-2xl text-xs cursor-pointer shadow-xs"
                  >
                    Mở Khóa
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* MOBILE LOGOUT CONFIRMATION MODAL */}
        {showMobileLogoutConfirm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-rose-200 rounded-[28px] p-6 max-w-sm w-full text-center shadow-2xl space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto shadow-2xs">
                <LogOut className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-text-minimal text-base font-bold">Xác Nhận Đăng Xuất?</h3>
              <p className="text-text-minimal/70 text-xs leading-relaxed">
                Bạn có chắc chắn muốn đăng xuất khỏi tài khoản <strong className="text-rose-700 font-semibold">{user?.username || 'Thành viên'}</strong> trên thiết bị này không?
              </p>
              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowMobileLogoutConfirm(false)} 
                  className="bg-bg-minimal hover:bg-slate-100 text-text-minimal font-bold text-xs py-2.5 rounded-2xl cursor-pointer border border-accent-minimal/40 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setShowMobileLogoutConfirm(false);
                    handleLogout();
                  }} 
                  className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs py-2.5 rounded-2xl cursor-pointer shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  id="btn-confirm-mobile-logout"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-[#AFDCF1]/80 flex justify-around py-3 px-1 z-40" id="mobile-bottom-bar">
        {[
          { id: 'home', label: 'Khám phá', icon: Compass },
          { id: 'journal', label: 'Nhật ký', icon: Smile },
          { id: 'self_care', label: 'Nuôi dưỡng', icon: Heart },
          { id: 'achievements', label: 'Thành tựu', icon: Trophy },
          { id: 'connections', label: 'Kết nối', icon: Users },
          ...(isAdmin ? [{ id: 'admin', label: 'Quản trị', icon: Shield }] : []),
          { id: 'user_settings', label: 'Cài đặt', icon: Settings }
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id || (item.id === 'user_settings' && activeTab === 'settings' && !isAdmin) || (item.id === 'admin' && activeTab === 'settings' && isAdmin);
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex flex-col items-center justify-center cursor-pointer transition-all relative ${
                isActive ? 'text-[#4A121A] scale-105 font-bold' : 'text-text-minimal/50 hover:text-text-minimal'
              }`}
              id={`btn-bottom-nav-${item.id}`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {item.id === 'connections' && (pendingInvitesCount + unreadCardsCount) > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white font-extrabold text-[9px] px-1.5 py-0.2 rounded-full animate-pulse shadow-2xs border border-white">
                    {pendingInvitesCount + unreadCardsCount}
                  </span>
                )}
              </div>
              <span className="text-[9px] mt-1.5">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* GLOBAL INSTANT SWEET CARD NOTIFICATION POPUP */}
      <AnimatePresence>
        {globalActiveCardPopup && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 cursor-pointer"
            onClick={async (e) => {
              if (e.target === e.currentTarget && globalActiveCardPopup) {
                const popup = globalActiveCardPopup;
                setDismissedCardIds(prev => new Set(prev).add(popup.id));
                setGlobalActiveCardPopup(null);
                const token = localStorage.getItem('token');
                const safeToken = token ? token.replace(/[^\x00-\x7F]/g, '') : '';
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (safeToken) headers['Authorization'] = `Bearer ${safeToken}`;
                if (user?.id || user?._id) headers['x-user-id'] = encodeURIComponent(user.id || user._id);
                try {
                  await fetch('/api/sweet-cards/mark-read', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ cardId: popup.id })
                  });
                } catch (err) {}
                window.dispatchEvent(new Event('sweet-cards-updated'));
              }
            }}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.85, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 30 }}
              className="bg-white border-2 border-rose-300 rounded-3xl p-6 max-w-sm w-full text-center relative overflow-hidden shadow-2xl z-50 cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Right Close Button (Icon X) */}
              <button
                onClick={async () => {
                  if (!globalActiveCardPopup) return;
                  const popup = globalActiveCardPopup;
                  setDismissedCardIds(prev => new Set(prev).add(popup.id));
                  setGlobalActiveCardPopup(null);
                  const token = localStorage.getItem('token');
                  const safeToken = token ? token.replace(/[^\x00-\x7F]/g, '') : '';
                  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                  if (safeToken) headers['Authorization'] = `Bearer ${safeToken}`;
                  if (user?.id || user?._id) headers['x-user-id'] = encodeURIComponent(user.id || user._id);
                  try {
                    await fetch('/api/sweet-cards/mark-read', {
                      method: 'POST',
                      headers,
                      body: JSON.stringify({ cardId: popup.id })
                    });
                  } catch (err) {}
                  window.dispatchEvent(new Event('sweet-cards-updated'));
                }}
                className="absolute top-3.5 right-3.5 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer z-20"
                title="Đóng thông báo"
                aria-label="Đóng"
                id="btn-close-sweet-card-modal"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Floating decorative elements */}
              <div className="absolute top-2 left-3 text-xl opacity-70 animate-bounce">🌸</div>
              <div className="absolute top-3 right-12 text-xl opacity-70 animate-pulse">✨</div>
              <div className="absolute bottom-2 left-4 text-xl opacity-60">💖</div>
              <div className="absolute bottom-3 right-3 text-xl opacity-60 animate-bounce">🌱</div>

              <span className="text-6xl mb-2 inline-block animate-pulse">{globalActiveCardPopup.emoji || '💌'}</span>
              
              <h3 className="font-extrabold text-slate-800 text-sm mb-1 leading-snug px-4">
                💌 Bạn nhận được một Tấm Thiệp Ngọt Ngào từ {globalActiveCardPopup.senderName || 'Bạn Đồng Hành'}!
              </h3>
              
              <span className="text-[10px] text-slate-400 font-semibold block mb-3">
                Mã: {globalActiveCardPopup.senderCode || 'CT_xxx'} • {globalActiveCardPopup.timestamp || 'Mới nhận'}
              </span>

              <div className="bg-rose-50/80 border border-rose-200 p-4 rounded-2xl text-left my-3 shadow-2xs">
                <h4 className="font-bold text-rose-900 text-xs mb-1 flex items-center gap-1.5">
                  <span>{globalActiveCardPopup.emoji || '💌'}</span>
                  <span>{globalActiveCardPopup.cardTitle}</span>
                </h4>
                <p className="text-xs text-rose-800/90 leading-relaxed italic">
                  "{globalActiveCardPopup.message}"
                </p>
              </div>

              <div className="flex flex-col gap-2 mt-4">
                <button
                  onClick={async () => {
                    const token = localStorage.getItem('token');
                    const safeToken = token ? token.replace(/[^\x00-\x7F]/g, '') : '';
                    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                    if (safeToken) headers['Authorization'] = `Bearer ${safeToken}`;
                    if (user?.id || user?._id) headers['x-user-id'] = encodeURIComponent(user.id || user._id);
                    if (user?.circleCode) headers['x-circle-code'] = encodeURIComponent(user.circleCode);

                    try {
                      await fetch('/api/sweet-cards', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                          targetCode: globalActiveCardPopup.senderCode,
                          cardTitle: 'Gửi tim đáp lại 💖',
                          message: 'Cảm ơn bạn vì tấm thiệp ấm áp! Gửi lại bạn triệu trái tim dịu dàng.',
                          emoji: '💖'
                        })
                      });

                      await fetch('/api/sweet-cards/mark-read', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ cardId: globalActiveCardPopup.id })
                      });
                    } catch (e) {}

                    setDismissedCardIds(prev => new Set(prev).add(globalActiveCardPopup.id));
                    setGlobalActiveCardPopup(null);
                    setActiveTab('connections');
                    window.dispatchEvent(new Event('sweet-cards-updated'));
                  }}
                  className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-extrabold text-xs py-2.5 rounded-full shadow-md shadow-rose-200 cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                >
                  <span>💖</span>
                  <span>Gửi tim đáp lại ngay</span>
                </button>

                <button
                  onClick={async () => {
                    const token = localStorage.getItem('token');
                    const safeToken = token ? token.replace(/[^\x00-\x7F]/g, '') : '';
                    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                    if (safeToken) headers['Authorization'] = `Bearer ${safeToken}`;
                    if (user?.id || user?._id) headers['x-user-id'] = encodeURIComponent(user.id || user._id);

                    try {
                      await fetch('/api/sweet-cards/mark-read', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ cardId: globalActiveCardPopup.id })
                      });
                    } catch (e) {}

                    setDismissedCardIds(prev => new Set(prev).add(globalActiveCardPopup.id));
                    setGlobalActiveCardPopup(null);
                    setActiveTab('connections');
                    window.dispatchEvent(new Event('sweet-cards-updated'));
                  }}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2 rounded-full cursor-pointer transition-all"
                >
                  Xem tất cả thiệp đã nhận 💌
                </button>

                <button
                  onClick={async () => {
                    const token = localStorage.getItem('token');
                    const safeToken = token ? token.replace(/[^\x00-\x7F]/g, '') : '';
                    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                    if (safeToken) headers['Authorization'] = `Bearer ${safeToken}`;
                    if (user?.id || user?._id) headers['x-user-id'] = encodeURIComponent(user.id || user._id);

                    try {
                      await fetch('/api/sweet-cards/mark-read', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ cardId: globalActiveCardPopup.id })
                      });
                    } catch (e) {}

                    setDismissedCardIds(prev => new Set(prev).add(globalActiveCardPopup.id));
                    setGlobalActiveCardPopup(null);
                    window.dispatchEvent(new Event('sweet-cards-updated'));
                  }}
                  className="w-full text-slate-400 hover:text-slate-600 text-[11px] font-semibold py-1 cursor-pointer mt-1 hover:underline transition-all"
                >
                  Đã nhận với lòng biết ơn 🌸
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <UserProvider>
        <StarProvider>
          <MainAppContent />
        </StarProvider>
      </UserProvider>
    </AuthProvider>
  );
}
