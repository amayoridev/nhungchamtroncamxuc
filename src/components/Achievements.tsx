import React, { useState, useEffect } from 'react';
import { 
  Award, Sparkles, Trophy, Calendar, Filter, Star, Heart, Flame, 
  CheckCircle2, Droplet, Wind, BookOpen, Sun, Activity, Utensils, Moon, Music, Smile, ArrowLeft, ChevronRight, ShoppingBag, Check, Lock, Play, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { JournalEntry } from '../types';
import { getBadgesStatus, calculateAvailableStars, resetStaleStarsCache, syncUnlockedBadgesToHistory, BadgeStatus } from '../lib/achievements';
import { getScopedItem, setScopedItem, getUserScopeId } from '../lib/scopedStorage';

interface AchievementsProps {
  streak: number;
  emotionalCircles: number;
  entries: JournalEntry[];
  initialSubTab?: 'badges' | 'shop';
  onBack: () => void;
  onNavigateToSelfCare: () => void;
}

export interface AchievementBadge {
  id: string;
  title: string;
  description: string;
  emoji: string;
  category: 'self_care' | 'journal' | 'streak' | 'mindfulness';
  bgColor: string; // Tailwind 4-color palette class
  borderColor: string;
  textColor: string;
  currentProgress: number;
  targetProgress: number;
  unlockedAt?: string;
  pointsReward: number;
}

export interface AchievementLog {
  id: string;
  badgeId?: string;
  title: string;
  points: number;
  stars?: number;
  date: string; // YYYY-MM-DD or formatted date string
  timestamp: number;
  timeStr?: string;
  category: string;
  emoji: string;
}

export interface RewardItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  type: 'theme' | 'effect' | 'music';
  emoji: string;
  value: string; // e.g. theme id or track id
}

export default function Achievements({ 
  streak, 
  emotionalCircles, 
  entries, 
  initialSubTab = 'badges',
  onBack,
  onNavigateToSelfCare 
}: AchievementsProps) {
  // Main sub-tab: 'badges' | 'shop'
  const [activeSubTab, setActiveSubTab] = useState<'badges' | 'shop'>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Time filter state: [Theo Ngày] | [Theo Tháng] | [Theo Năm]
  const [timeFilter, setTimeFilter] = useState<'day' | 'month' | 'year'>('day');
  
  // Category filter state for badges
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'self_care' | 'eating' | 'journal' | 'streak'>('all');

  const scopeId = getUserScopeId();

  // Achievement activity logs stored locally
  const [logs, setLogs] = useState<AchievementLog[]>(() => {
    return getScopedItem('achievement_logs', [], scopeId);
  });

  // Persistent star level state for badges
  const [starLevels, setStarLevels] = useState<Record<string, number>>(() => {
    return getScopedItem('achievement_star_levels', {}, scopeId);
  });

  // Spent stars state for shop
  const [spentStars, setSpentStars] = useState<number>(() => {
    const saved = getScopedItem('achievement_spent_stars', 0, scopeId);
    return typeof saved === 'number' ? saved : (parseInt(String(saved), 10) || 0);
  });

  // Unlocked rewards state
  const [unlockedRewards, setUnlockedRewards] = useState<string[]>(() => {
    return getScopedItem('unlocked_rewards', ['theme_default'], scopeId);
  });

  // 1. Single Active Visual Theme state (e.g. 'theme_default', 'effect_bubbles', 'theme_green', 'effect_fireworks', 'theme_purple', 'theme_gold')
  const [currentActiveThemeId, setCurrentActiveThemeId] = useState<string>(() => {
    const saved = getScopedItem<string>('current_active_theme_id', '', scopeId) || 
                  getScopedItem<string>('app_theme', '', scopeId) || 
                  localStorage.getItem('current_active_theme_id') || 
                  localStorage.getItem('app_theme') || 
                  'theme_default';
    
    if (saved === 'green') return 'theme_green';
    if (saved === 'gold') return 'theme_gold';
    if (saved === 'purple') return 'theme_purple';
    if (saved === 'bubbles') return 'effect_bubbles';
    if (saved === 'fireworks') return 'effect_fireworks';
    if (saved === 'default' || saved === 'pink') return 'theme_default';
    return saved || 'theme_default';
  });

  // 2. Active Sound state ('', 'keyboard', 'lofi')
  const [activeSound, setActiveSound] = useState<string>(() => {
    return getScopedItem<string>('active_sound', '', scopeId) || localStorage.getItem('active_sound') || '';
  });

  // Feedback message toast in shop
  const [shopToast, setShopToast] = useState<string | null>(null);

  // Sync trigger to re-render badges dynamically on habit updates
  const [syncTrigger, setSyncTrigger] = useState(0);

  // Dynamic badges list based on real-time completion state
  const badgesList = getBadgesStatus(streak, entries.length);

  // Calculate Total Earned Stars from Unlocked Badges & Available Stars in Wallet
  const { totalEarnedStars, availableStars } = calculateAvailableStars(streak, entries.length, scopeId);

  // Sync unlocked badges to history on initial render & whenever props/trigger change
  useEffect(() => {
    syncUnlockedBadgesToHistory(streak, entries.length, scopeId);
    const initialLogs = getScopedItem('achievement_logs', getScopedItem('star_history', [], scopeId), scopeId);
    setLogs(Array.isArray(initialLogs) ? initialLogs : []);
  }, [streak, entries.length, syncTrigger, scopeId]);

  // Listen for real-time state changes and logs dispatched from SelfCare/Journal/Shop
  useEffect(() => {
    const handleSync = () => {
      syncUnlockedBadgesToHistory(streak, entries.length, scopeId);
      const updatedLogs = getScopedItem('achievement_logs', getScopedItem('star_history', [], scopeId), scopeId);
      setLogs(Array.isArray(updatedLogs) ? updatedLogs : []);

      // Read single visual theme id
      const storedThemeId = getScopedItem<string>('current_active_theme_id', '', scopeId) || 
                            getScopedItem<string>('app_theme', '', scopeId) || 
                            localStorage.getItem('current_active_theme_id') || 
                            localStorage.getItem('app_theme') || 
                            'theme_default';
      
      let normalized = storedThemeId;
      if (storedThemeId === 'green') normalized = 'theme_green';
      else if (storedThemeId === 'gold') normalized = 'theme_gold';
      else if (storedThemeId === 'purple') normalized = 'theme_purple';
      else if (storedThemeId === 'bubbles') normalized = 'effect_bubbles';
      else if (storedThemeId === 'fireworks') normalized = 'effect_fireworks';
      else if (storedThemeId === 'default' || storedThemeId === 'pink') normalized = 'theme_default';
      
      setCurrentActiveThemeId(normalized || 'theme_default');

      // Read sound
      setActiveSound(getScopedItem('active_sound', '', scopeId) || localStorage.getItem('active_sound') || '');

      const savedSpent = getScopedItem('achievement_spent_stars', 0, scopeId);
      setSpentStars(typeof savedSpent === 'number' ? savedSpent : (parseInt(String(savedSpent), 10) || 0));

      const updatedUnlocked = getScopedItem<string[]>('unlocked_rewards', ['theme_default'], scopeId);
      setUnlockedRewards(Array.isArray(updatedUnlocked) ? updatedUnlocked : ['theme_default']);

      setSyncTrigger(prev => prev + 1);
    };

    const handleNewLog = () => {
      handleSync();
    };

    window.addEventListener('add-achievement-log' as any, handleNewLog);
    window.addEventListener('selfcare-state-change' as any, handleSync);
    window.addEventListener('achievement-stars-updated' as any, handleSync);
    window.addEventListener('app-theme-changed' as any, handleSync);
    window.addEventListener('unlocked-rewards-changed' as any, handleSync);
    window.addEventListener('storage' as any, handleSync);
    return () => {
      window.removeEventListener('add-achievement-log' as any, handleNewLog);
      window.removeEventListener('selfcare-state-change' as any, handleSync);
      window.removeEventListener('achievement-stars-updated' as any, handleSync);
      window.removeEventListener('app-theme-changed' as any, handleSync);
      window.removeEventListener('unlocked-rewards-changed' as any, handleSync);
      window.removeEventListener('storage' as any, handleSync);
    };
  }, [streak, entries.length, scopeId]);

  // Store rewards available in shop
  const rewardItems: RewardItem[] = [
    { id: 'theme_default', name: 'Theme Hồng Mộng Mơ', description: 'Giao diện ngọt ngào ấm áp hoa anh đào dịu nhẹ.', cost: 0, type: 'theme', emoji: '🌸', value: 'theme_default' },
    { id: 'sound_keyboard', name: 'Tiếng Gõ Bàn Phím', description: 'Nhịp gõ phím đều đặn dịu êm giúp tập trung học tập và làm việc.', cost: 6, type: 'music', emoji: '⌨️', value: 'keyboard' },
    { id: 'effect_bubbles', name: 'Bong Bóng Đại Dương', description: 'Thả bong bóng óng ánh bảy sắc cùng đàn cá nhỏ tung tăng bơi lội đáng yêu.', cost: 8, type: 'effect', emoji: '🫧', value: 'effect_bubbles' },
    { id: 'theme_green', name: 'Theme Xanh Tươi Mát', description: 'Giao diện tươi mát lá cây dịu lành như khu vườn ban mai.', cost: 10, type: 'theme', emoji: '🌿', value: 'theme_green' },
    { id: 'effect_fireworks', name: 'Hiệu Ứng Pháo Hoa', description: 'Rực rỡ tung pháo hoa chúc mừng mỗi khi hoàn thành thói quen.', cost: 12, type: 'effect', emoji: '🎆', value: 'effect_fireworks' },
    { id: 'theme_purple', name: 'Theme Tím Hoàng Hôn', description: 'Giao diện tĩnh lặng dịu dàng trăng sao thư thái đầu óc.', cost: 15, type: 'theme', emoji: '🌙', value: 'theme_purple' },
    { id: 'sound_lofi', name: 'Nhạc Lofi Chill', description: 'Giai điệu Lofi êm ái thư giãn, vỗ về tâm trí sau ngày dài.', cost: 20, type: 'music', emoji: '🎧', value: 'lofi' },
    { id: 'theme_gold', name: 'Theme Vàng Nắng Ấm (Đặc biệt)', description: 'Giao diện rạng rỡ sưởi ấm năng lượng tích cực cao cấp.', cost: 25, type: 'theme', emoji: '✨', value: 'theme_gold' }
  ];

  // Helper to determine if an individual reward item is currently active
  const isItemActive = (item: RewardItem): boolean => {
    if (item.type === 'theme' || item.type === 'effect') {
      return currentActiveThemeId === item.id;
    }
    if (item.type === 'music' || item.type === 'sound') {
      return activeSound === item.value;
    }
    return false;
  };

  // Helper to activate a single visual theme and replace all previous ones
  const applySingleVisualTheme = (themeId: string, toastMessage?: string) => {
    setCurrentActiveThemeId(themeId);
    setScopedItem('current_active_theme_id', themeId, scopeId);
    setScopedItem('app_theme', themeId, scopeId);
    localStorage.setItem('current_active_theme_id', themeId);
    localStorage.setItem('app_theme', themeId);

    const currentUserId = getUserScopeId(scopeId);
    if (currentUserId && currentUserId !== 'anonymous') {
      try {
        localStorage.setItem(`current_active_theme_id_${currentUserId}`, themeId);
        localStorage.setItem(`app_theme_${currentUserId}`, themeId);
      } catch {}
    }

    // Broadcast change so whole app immediately adopts this visual theme
    window.dispatchEvent(new CustomEvent('app-theme-changed', { 
      detail: { 
        themeId, 
        theme: themeId 
      } 
    }));

    if (toastMessage) {
      setShopToast(toastMessage);
      setTimeout(() => setShopToast(null), 3500);
    }
  };

  // Redeem / Toggle reward function
  const handleRedeemReward = (item: RewardItem) => {
    const isUnlocked = unlockedRewards.includes(item.id);

    // 1. VISUAL THEME OR EFFECT (Single Active Mechanism)
    if (item.type === 'theme' || item.type === 'effect') {
      if (isUnlocked) {
        // Activate this visual theme as the ONLY active one (replaces all previous)
        applySingleVisualTheme(item.id, `✨ Đã kích hoạt ${item.name}! Toàn bộ giao diện đã được áp dụng.`);
        return;
      }

      // Locked Visual Theme: Check star balance
      if (availableStars < item.cost) {
        const missingStars = item.cost - availableStars;
        setShopToast(`Bạn cần thêm ${missingStars} ⭐ nữa để mở khóa ${item.name}. Cùng cố gắng nhé! ✨`);
        setTimeout(() => setShopToast(null), 4000);
        return;
      }

      // Deduct stars & unlock
      const newSpent = spentStars + item.cost;
      setSpentStars(newSpent);
      setScopedItem('achievement_spent_stars', newSpent, scopeId);

      const newUnlocked = [...unlockedRewards, item.id];
      setUnlockedRewards(newUnlocked);
      setScopedItem('unlocked_rewards', newUnlocked, scopeId);

      // Update available stars balance
      const newAvailable = Math.max(0, totalEarnedStars - newSpent);
      setScopedItem('user_stars', newAvailable, scopeId);

      const currentUserId = getUserScopeId(scopeId);
      if (currentUserId && currentUserId !== 'anonymous') {
        try {
          localStorage.setItem(`achievement_spent_stars_${currentUserId}`, newSpent.toString());
          localStorage.setItem(`user_spent_stars_${currentUserId}`, newSpent.toString());
          localStorage.setItem(`unlocked_rewards_${currentUserId}`, JSON.stringify(newUnlocked));
          localStorage.setItem(`user_stars_${currentUserId}`, newAvailable.toString());
        } catch {}
      }

      window.dispatchEvent(new CustomEvent('unlocked-rewards-changed', { detail: { rewards: newUnlocked, purchasedItem: item } }));
      window.dispatchEvent(new CustomEvent('achievement-stars-updated', { detail: { totalEarnedStars, spentStars: newSpent, availableStars: newAvailable } }));

      // Automatically activate the newly unlocked visual theme
      applySingleVisualTheme(item.id, `🎉 Đổi thành công và kích hoạt ngay ${item.name}!`);
      return;
    }

    // 2. AUDIO / MUSIC ITEM
    if (item.type === 'music' || item.type === 'sound') {
      if (isUnlocked) {
        if (activeSound === item.value) {
          // Toggle off
          setActiveSound('');
          setScopedItem('active_sound', '', scopeId);
          localStorage.setItem('active_sound', '');
          if (scopeId && scopeId !== 'anonymous') {
            localStorage.setItem(`active_sound_${scopeId}`, '');
          }
          window.dispatchEvent(new CustomEvent('stop-ambient-audio'));
          window.dispatchEvent(new CustomEvent('stop-selfcare-audio'));
          window.dispatchEvent(new CustomEvent('unlocked-rewards-changed'));
          setShopToast(`🔇 Đã ngưng phát âm thanh ${item.name}.`);
        } else {
          // Toggle on
          setActiveSound(item.value);
          setScopedItem('active_sound', item.value, scopeId);
          localStorage.setItem('active_sound', item.value);
          if (scopeId && scopeId !== 'anonymous') {
            localStorage.setItem(`active_sound_${scopeId}`, item.value);
          }
          window.dispatchEvent(new CustomEvent('play-shop-sound', { detail: { sound: item.value } }));
          window.dispatchEvent(new CustomEvent('unlocked-rewards-changed'));
          setShopToast(`🎵 Đã kích hoạt ${item.name}!`);
        }
        setTimeout(() => setShopToast(null), 3500);
        return;
      }

      // Locked Audio item
      if (availableStars < item.cost) {
        const missingStars = item.cost - availableStars;
        setShopToast(`Bạn cần thêm ${missingStars} ⭐ nữa để mở khóa ${item.name}. Cùng cố gắng nhé! ✨`);
        setTimeout(() => setShopToast(null), 4000);
        return;
      }

      const newSpent = spentStars + item.cost;
      setSpentStars(newSpent);
      setScopedItem('achievement_spent_stars', newSpent, scopeId);

      const newUnlocked = [...unlockedRewards, item.id];
      setUnlockedRewards(newUnlocked);
      setScopedItem('unlocked_rewards', newUnlocked, scopeId);

      const newAvailable = Math.max(0, totalEarnedStars - newSpent);
      setScopedItem('user_stars', newAvailable, scopeId);

      const currentUserId = getUserScopeId(scopeId);
      if (currentUserId && currentUserId !== 'anonymous') {
        try {
          localStorage.setItem(`achievement_spent_stars_${currentUserId}`, newSpent.toString());
          localStorage.setItem(`user_spent_stars_${currentUserId}`, newSpent.toString());
          localStorage.setItem(`unlocked_rewards_${currentUserId}`, JSON.stringify(newUnlocked));
          localStorage.setItem(`user_stars_${currentUserId}`, newAvailable.toString());
          localStorage.setItem(`active_sound_${currentUserId}`, item.value);
        } catch {}
      }

      setActiveSound(item.value);
      setScopedItem('active_sound', item.value, scopeId);
      localStorage.setItem('active_sound', item.value);

      window.dispatchEvent(new CustomEvent('unlocked-rewards-changed', { detail: { rewards: newUnlocked, purchasedItem: item } }));
      window.dispatchEvent(new CustomEvent('achievement-stars-updated', { detail: { totalEarnedStars, spentStars: newSpent, availableStars: newAvailable } }));
      window.dispatchEvent(new CustomEvent('play-shop-sound', { detail: { sound: item.value } }));
      setShopToast(`🎉 Đổi thành công ${item.name}! Âm thanh đã được tự động thêm và kích hoạt.`);
      setTimeout(() => setShopToast(null), 3500);
    }
  };

  // Filter logs according to time option: Day, Month, Year
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed (e.g. 7 for August)
  const todayDateStr = now.toLocaleDateString('sv-SE');

  const filteredLogs = logs.filter(log => {
    let year = currentYear;
    let month = currentMonth;
    let dateStr = '';

    if (log.date && typeof log.date === 'string') {
      const raw = log.date.trim();
      if (raw.includes('-')) {
        const parts = raw.split('T')[0].split('-').map(Number);
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          year = parts[0];
          month = parts[1] - 1;
          const day = parts.length >= 3 && !isNaN(parts[2]) ? parts[2] : 1;
          dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      } else if (raw.includes('/')) {
        const parts = raw.split('/').map(Number);
        if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
          const day = parts[0];
          month = parts[1] - 1;
          year = parts[2];
          dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
      }
    }

    if (!dateStr && log.timestamp) {
      const d = new Date(log.timestamp);
      if (!isNaN(d.getTime())) {
        year = d.getFullYear();
        month = d.getMonth();
        const day = d.getDate();
        dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }

    if (!dateStr) {
      dateStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    }

    if (timeFilter === 'day') {
      return dateStr === todayDateStr;
    } else if (timeFilter === 'month') {
      return month === currentMonth && year === currentYear;
    } else {
      return year === currentYear;
    }
  });

  // Always sort descending: newest at the top
  const sortedFilteredLogs = [...filteredLogs].sort((a, b) => {
    const timeA = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp || a.date).getTime() || 0;
    const timeB = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp || b.date).getTime() || 0;
    return timeB - timeA;
  });

  const filteredBadges = badgesList.filter(b => {
    if (categoryFilter === 'all') return true;
    return b.category === categoryFilter;
  });

  const unlockedBadgesCount = badgesList.filter(b => b.currentProgress >= b.targetProgress).length;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 text-text-minimal" id="achievements-dashboard-container">
      
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <button 
          onClick={onBack} 
          className="flex items-center gap-2 text-text-minimal/80 hover:text-[#4A121A] transition-colors bg-white/90 backdrop-blur px-4 py-2 rounded-full border border-[#AFDCF1] shadow-sm font-bold text-xs"
          id="btn-achievements-back"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại trang chủ</span>
        </button>

        {/* Main View Switcher: Badges vs Shop */}
        <div className="flex items-center bg-white/90 backdrop-blur border border-[#AFDCF1] p-1.5 rounded-full shadow-sm" id="achievement-view-tabs">
          <button
            onClick={() => setActiveSubTab('badges')}
            className={`px-5 py-2 rounded-full text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'badges' 
                ? 'bg-[#FFB6BD] text-[#4A121A] border border-[#F89CA7] shadow-sm' 
                : 'text-text-minimal/70 hover:text-text-minimal'
            }`}
            id="tab-view-badges"
          >
            <Trophy className="w-4 h-4" />
            <span>Thẻ Thành Tựu</span>
          </button>
          <button
            onClick={() => setActiveSubTab('shop')}
            className={`px-5 py-2 rounded-full text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'shop' 
                ? 'bg-[#FFEEB6] text-[#4D3E00] border border-[#E8CF7A] shadow-sm' 
                : 'text-text-minimal/70 hover:text-text-minimal'
            }`}
            id="tab-view-shop"
          >
            <ShoppingBag className="w-4 h-4 text-[#4D3E00]" />
            <span>Cửa Hàng Đổi Sao ({availableStars} ⭐)</span>
          </button>
        </div>
      </div>

      {/* Hero Welcome Banner */}
      <div className="bg-white/90 backdrop-blur-md border border-[#AFDCF1] p-8 rounded-[30px] relative overflow-hidden mb-8 shadow-sm">
        <div className="absolute -right-6 -bottom-6 text-[#AFDCF1]/30 pointer-events-none">
          {activeSubTab === 'badges' ? <Trophy className="w-48 h-48" /> : <ShoppingBag className="w-48 h-48 text-[#FFEEB6]" />}
        </div>
        
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-1.5 bg-[#FFEEB6] text-[#4D3E00] border border-[#E8CF7A] px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-[#4D3E00]" />
            <span>{activeSubTab === 'badges' ? 'Góc vinh danh thành tựu' : 'Đổi Sao nhận phần quà yêu thương'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif text-text-minimal font-bold tracking-tight">
            {activeSubTab === 'badges' ? 'Kho Báu Thành Tích & Cấp Độ Sao' : 'Cửa Hàng Đổi Sao Nhận Quà'}
          </h1>
          <p className="text-text-minimal/70 text-xs mt-2 leading-relaxed font-sans">
            {activeSubTab === 'badges'
              ? 'Tích lũy Chấm Tròn Kiên Trì qua từng ngày thực hành thói quen. Tăng cấp độ Sao ⭐ ở mỗi thẻ thành tựu để quy đổi quà tặng.'
              : 'Dùng những điểm Sao ⭐ thu thập được từ Thẻ Thành Tựu để mở khóa Theme giao diện, hiệu ứng hoạt họa và bản nhạc thiền cao cấp.'}
          </p>
        </div>
      </div>

      {/* 1. SUMMARY STAT CARDS (Chấm Tròn = Ngày kiên trì; Sao = Điểm đổi thưởng) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8" id="achievements-summary-grid">
        
        {/* Card 1: Chấm Tròn Kiên Trì (Day Streak) */}
        <div className="bg-white border border-[#AFDCF1] p-6 rounded-3xl shadow-sm relative overflow-hidden flex flex-col justify-between hover:scale-[1.02] transition-transform">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-extrabold text-[#1E3A5F] uppercase tracking-wider">CHẤM TRÒN KIÊN TRÌ</span>
            <div className="p-2 bg-[#AFDCF1] text-[#1E3A5F] border border-[#8BC5E3] rounded-2xl">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-serif text-[#1E3A5F]">{streak}</span>
              <span className="text-xs font-bold text-text-minimal/70">Ngày liên tiếp</span>
            </div>
            <p className="text-[11px] text-text-minimal/60 mt-1">Số ngày kiên trì tự chăm sóc bản thân</p>
          </div>
        </div>

        {/* Card 2: Total Earned Stars */}
        <div className="bg-white border border-[#FFD7D5] p-6 rounded-3xl shadow-sm relative overflow-hidden flex flex-col justify-between hover:scale-[1.02] transition-transform">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-extrabold text-[#5A1A24] uppercase tracking-wider">TỔNG SAO TÍCH LŨY</span>
            <div className="p-2 bg-[#FFD7D5] text-[#5A1A24] border border-[#F2B6B3] rounded-2xl">
              <Star className="w-5 h-5 fill-[#F2B6B3] text-[#5A1A24]" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-serif text-[#5A1A24]">{totalEarnedStars}</span>
              <span className="text-xs font-bold text-text-minimal/70">⭐ Đã nhận</span>
            </div>
            <p className="text-[11px] text-text-minimal/60 mt-1">Nhận từ việc mở khóa & nâng cấp Thẻ Thành Tựu</p>
          </div>
        </div>

        {/* Card 3: Available Redeemable Stars */}
        <div 
          onClick={() => setActiveSubTab('shop')}
          className="bg-white border border-[#FFEEB6] p-6 rounded-3xl shadow-sm relative overflow-hidden flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-extrabold text-[#4D3E00] uppercase tracking-wider">SAO KHẢ DỤNG ĐỔI QUÀ</span>
            <div className="p-2 bg-[#FFEEB6] text-[#4D3E00] border border-[#E8CF7A] rounded-2xl">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-serif text-[#4D3E00]">{availableStars}</span>
              <span className="text-xs font-bold text-[#4D3E00]">⭐ Có thể dùng</span>
            </div>
            <p className="text-[11px] text-[#4D3E00]/80 mt-1 flex items-center gap-1 font-semibold">
              <span>Bấm mở cửa hàng đổi quà</span>
              <span>→</span>
            </p>
          </div>
        </div>

      </div>

      {/* VIEW 1: BADGES & TITLES */}
      {activeSubTab === 'badges' && (
        <>
          <div className="bg-white/80 backdrop-blur-sm border border-[#AFDCF1] p-6 sm:p-8 rounded-[30px] shadow-sm mb-8" id="badges-section">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-serif text-text-minimal font-bold flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-[#5A1A24]" /> Danh Hiệu & Thẻ Thành Tựu
                </h2>
                <p className="text-text-minimal/60 text-xs mt-0.5">Hoàn thành các thử thách hằng ngày để khai phá và tích lũy cấp độ Sao ⭐.</p>
              </div>

              {/* Badge Category Filters */}
              <div className="flex flex-wrap gap-1.5" id="badge-category-filter">
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: 'eating', label: 'Ăn Lành Mạnh 🥗' },
                  { id: 'self_care', label: 'Thói quen' },
                  { id: 'journal', label: 'Nhật ký' },
                  { id: 'streak', label: 'Chuỗi ngày' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id as any)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      categoryFilter === cat.id 
                        ? 'bg-[#FFB6BD] text-[#4A121A] border border-[#F89CA7] shadow-sm' 
                        : 'bg-white border border-accent-minimal text-text-minimal/70 hover:border-text-minimal/30'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Badges Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4" id="badges-grid-list">
              {filteredBadges.map((badge) => {
                const isUnlocked = badge.isUnlocked;
                const starLevel = badge.pointsReward;

                return (
                  <motion.div
                    key={badge.id}
                    whileHover={{ scale: 1.03 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className={`p-5 rounded-3xl border flex flex-col justify-between transition-all relative overflow-hidden ${
                      isUnlocked 
                        ? `${badge.bgColor} ${badge.borderColor} shadow-xs` 
                        : 'bg-stone-50/70 border-stone-200/80 opacity-65'
                    }`}
                    id={`badge-card-${badge.id}`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-xs ${
                          isUnlocked ? 'bg-white/80 border border-white' : 'bg-stone-100/90 border border-stone-200/60'
                        }`}>
                          {badge.emoji}
                        </div>
                        {isUnlocked ? (
                          <span className="text-[10px] font-extrabold bg-white/90 text-[#4A121A] border border-[#F89CA7] px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Đã đạt</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-stone-200/70 text-stone-500 px-2.5 py-0.5 rounded-full border border-stone-300/40">
                            Đang nuôi dưỡng
                          </span>
                        )}
                      </div>

                      <h3 className={`font-serif font-bold text-sm mb-1.5 ${isUnlocked ? badge.textColor : 'text-stone-600'}`}>
                        {badge.title}
                      </h3>
                      <p className={`text-[11px] leading-relaxed ${isUnlocked ? 'text-text-minimal/75' : 'text-stone-500/70'}`}>
                        {badge.description}
                      </p>
                    </div>

                    {/* Progress Bar & Reward Stars */}
                    <div className="mt-4 pt-3 border-t border-black/5 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className={isUnlocked ? badge.textColor : 'text-stone-500'}>
                          Tiến trình: {badge.currentProgress}/{badge.targetProgress} {badge.category === 'eating' ? 'ngày' : 'mốc'}
                        </span>
                        <span className="flex items-center gap-1 font-extrabold text-[#4D3E00] bg-[#FFEEB6] border border-[#E8CF7A] px-2.5 py-0.5 rounded-full shadow-2xs text-[10px]">
                          <Star className="w-3 h-3 fill-[#E8CF7A] text-[#4D3E00]" />
                          <span>+{badge.pointsReward} ⭐</span>
                        </span>
                      </div>
                      <div className="w-full h-2 bg-black/10 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 rounded-full ${
                            isUnlocked ? 'bg-[#2B4212]' : 'bg-[#C2D772]'
                          }`}
                          style={{ width: `${Math.min(100, Math.round((badge.currentProgress / badge.targetProgress) * 100))}%` }}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-6 text-center flex flex-col sm:flex-row justify-center items-center gap-3">
              <button
                onClick={onNavigateToSelfCare}
                className="inline-flex items-center gap-2 bg-[#FFB6BD] hover:bg-[#FF8E98] text-[#4A121A] font-extrabold text-xs px-6 py-3 rounded-full shadow-sm cursor-pointer border border-[#F89CA7] transition-all"
                id="btn-go-to-selfcare-from-achievements"
              >
                <span>Thực hành thói quen hôm nay để nhận thêm ⭐</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveSubTab('shop')}
                className="inline-flex items-center gap-2 bg-[#FFEEB6] hover:bg-[#FFE699] text-[#4D3E00] font-extrabold text-xs px-6 py-3 rounded-full shadow-sm cursor-pointer border border-[#E8CF7A] transition-all"
                id="btn-go-to-shop"
              >
                <ShoppingBag className="w-4 h-4 text-[#4D3E00]" />
                <span>Mở Cửa Hàng Đổi Sao</span>
              </button>
            </div>
          </div>

          {/* 3. REWARD LOGS & HISTORY */}
          <div className="bg-white/80 backdrop-blur-sm border border-[#AFDCF1] p-6 sm:p-8 rounded-[30px] shadow-sm" id="achievement-logs-section">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-serif text-text-minimal font-bold flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#1E3A5F]" /> Lịch Sử Nhận Sao ⭐ ({timeFilter === 'day' ? 'Hôm nay' : timeFilter === 'month' ? `Tháng ${currentMonth + 1}/${currentYear}` : `Năm ${currentYear}`})
                </h2>
                <p className="text-text-minimal/60 text-xs mt-0.5">Danh sách các phần thưởng đã tự động đồng bộ sang trang Thành Tựu.</p>
              </div>

              {/* Time filter selector */}
              <div className="flex items-center bg-white/90 backdrop-blur border border-[#AFDCF1] p-1 rounded-full shadow-sm" id="time-filter-tabs">
                <button
                  onClick={() => setTimeFilter('day')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    timeFilter === 'day' 
                      ? 'bg-[#FFB6BD] text-[#4A121A] border border-[#F89CA7] shadow-sm' 
                      : 'text-text-minimal/70 hover:text-text-minimal'
                  }`}
                >
                  Ngày
                </button>
                <button
                  onClick={() => setTimeFilter('month')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    timeFilter === 'month' 
                      ? 'bg-[#FFB6BD] text-[#4A121A] border border-[#F89CA7] shadow-sm' 
                      : 'text-text-minimal/70 hover:text-text-minimal'
                  }`}
                >
                  Tháng
                </button>
                <button
                  onClick={() => setTimeFilter('year')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    timeFilter === 'year' 
                      ? 'bg-[#FFB6BD] text-[#4A121A] border border-[#F89CA7] shadow-sm' 
                      : 'text-text-minimal/70 hover:text-text-minimal'
                  }`}
                >
                  Năm
                </button>
              </div>
            </div>

            {sortedFilteredLogs.length === 0 ? (
              <div className="py-12 text-center bg-white/50 rounded-2xl border border-dashed border-accent-minimal">
                <span className="text-3xl block mb-2">🌸</span>
                <p className="text-text-minimal/60 text-xs font-semibold">Chưa có phần thưởng nào ghi nhận trong khoảng thời gian này.</p>
                <p className="text-text-minimal/40 text-[11px] mt-1">Hãy thực hành thói quen tại trang "Nuôi Dưỡng Bản Thân" nhé!</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1" id="reward-logs-list">
                {sortedFilteredLogs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-[#FFD7D5] p-4 rounded-2xl flex items-center justify-between gap-4 shadow-sm hover:border-[#FFB6BD] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#FFEEB6] border border-[#E8CF7A] rounded-2xl flex items-center justify-center text-lg shrink-0">
                        {log.emoji || '✨'}
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-text-minimal font-display">{log.title}</h4>
                        <span className="text-[10px] text-text-minimal/60 font-semibold">{log.category} • {log.timeStr || log.date}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 bg-[#FFEEB6] text-[#4D3E00] border border-[#E8CF7A] px-3 py-1 rounded-full text-xs font-extrabold shrink-0">
                      <Star className="w-3.5 h-3.5 fill-[#E8CF7A] text-[#4D3E00]" />
                      <span>+{log.stars || log.points || 1} ⭐</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* VIEW 2: STAR REWARDS SHOP */}
      {activeSubTab === 'shop' && (
        <div className="bg-white/90 backdrop-blur-md border border-[#FFEEB6] p-6 sm:p-8 rounded-[30px] shadow-sm mb-8" id="star-rewards-shop">
          
          {/* Toast Notification */}
          <AnimatePresence>
            {shopToast && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`mb-6 p-4 font-bold text-xs rounded-2xl shadow-sm text-center flex items-center justify-center gap-2 transition-all ${
                  shopToast.includes('Đã hủy') || shopToast.includes('ngưng')
                    ? 'bg-stone-100 border border-stone-300 text-stone-700'
                    : 'bg-[#FFEEB6] border border-[#E8CF7A] text-[#4D3E00]'
                }`}
              >
                {shopToast.includes('Đã hủy') || shopToast.includes('ngưng') ? (
                  <CheckCircle2 className="w-4 h-4 text-stone-600" />
                ) : (
                  <Sparkles className="w-4 h-4 text-[#4D3E00]" />
                )}
                <span>{shopToast}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-stone-100">
            <div>
              <h2 className="text-xl font-serif text-text-minimal font-bold flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#4D3E00]" /> Cửa Hàng Đổi Sao Nhận Phần Thưởng
              </h2>
              <p className="text-text-minimal/60 text-xs mt-0.5">Sử dụng điểm Sao ⭐ tích lũy được từ Thẻ Thành Tựu để cá nhân hóa ứng dụng của bạn.</p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 shrink-0">
              <div className="bg-[#FFEEB6] border border-[#E8CF7A] px-4 py-2 rounded-2xl text-[#4D3E00] font-extrabold text-xs shadow-xs flex items-center gap-2">
                <Star className="w-4 h-4 fill-[#E8CF7A] text-[#4D3E00]" />
                <span>Khả dụng: {availableStars} ⭐</span>
              </div>
              <div className="text-[11px] text-[#4D3E00]/80 font-semibold bg-amber-50/80 px-3 py-1.5 rounded-xl border border-amber-200/60">
                <span>Tích lũy: <strong className="text-[#5A1A24]">{totalEarnedStars} ⭐</strong> | Đã đổi: <strong className="text-amber-800">{spentStars} ⭐</strong></span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4" id="shop-items-grid">
            {rewardItems.map((item) => {
              const isUnlocked = unlockedRewards.includes(item.id);
              const isActive = isItemActive(item);

              return (
                <motion.div
                  key={item.id}
                  whileHover={{ scale: 1.02 }}
                  className={`p-5 rounded-3xl border flex flex-col justify-between transition-all relative overflow-hidden bg-white ${
                    isActive 
                      ? 'border-[#8BC5E3] ring-2 ring-[#AFDCF1]/50 shadow-xs' 
                      : isUnlocked 
                        ? 'border-[#AFDCF1] shadow-xs' 
                        : 'border-stone-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-3xl">{item.emoji}</span>
                      {isActive ? (
                        <span className="text-[10px] font-extrabold bg-[#C8F7DC] text-[#124B31] border border-[#9EE7C0] px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                          <Check className="w-3 h-3 text-[#124B31]" />
                          <span>Đang áp dụng</span>
                        </span>
                      ) : isUnlocked ? (
                        <span className="text-[10px] font-extrabold bg-[#AFDCF1]/60 text-[#1E3A5F] border border-[#8BC5E3] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3 text-[#1E3A5F]" />
                          <span>Đã sở hữu</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold bg-[#FFEEB6] text-[#4D3E00] border border-[#E8CF7A] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <Star className="w-3 h-3 fill-[#E8CF7A]" />
                          <span>Cần {item.cost} ⭐</span>
                        </span>
                      )}
                    </div>

                    <h3 className="font-serif font-bold text-sm text-text-minimal mb-1">
                      {item.name}
                    </h3>
                    <p className="text-text-minimal/70 text-[11px] leading-relaxed mb-4">
                      {item.description}
                    </p>
                  </div>

                  <button
                    onClick={() => handleRedeemReward(item)}
                    className={`w-full py-2.5 px-4 rounded-2xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      isActive 
                        ? 'bg-[#C8F7DC] text-[#124B31] border border-[#9EE7C0] shadow-xs cursor-default' 
                        : isUnlocked
                          ? 'bg-[#AFDCF1] hover:bg-[#97cfed] text-[#1E3A5F] border border-[#8BC5E3] shadow-xs hover:shadow-sm active:scale-[0.99]'
                          : availableStars >= item.cost
                            ? 'bg-[#FFEEB6] hover:bg-[#ffe58f] text-[#4D3E00] border border-[#E8CF7A] shadow-xs hover:shadow-sm active:scale-[0.99]'
                            : 'bg-[#FFEEB6]/60 hover:bg-[#FFEEB6] text-[#4D3E00] border border-[#E8CF7A] shadow-xs cursor-pointer'
                    }`}
                  >
                    {isActive ? (
                      <span className="flex items-center gap-1.5 font-bold">
                        <Check className="w-3.5 h-3.5 text-[#124B31]" />
                        <span>✓ Đang áp dụng</span>
                      </span>
                    ) : isUnlocked ? (
                      <span className="font-bold">Kích hoạt ngay</span>
                    ) : availableStars >= item.cost ? (
                      <>
                        <Star className="w-3.5 h-3.5 fill-[#E8CF7A]" />
                        <span>Dùng {item.cost} ⭐ Đổi Quà</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5 text-[#4D3E00]" />
                        <span>Cần {item.cost} ⭐ (Bấm để xem)</span>
                      </>
                    )}
                  </button>
                </motion.div>
              );
            })}
          </div>

        </div>
      )}

    </div>
  );
}

