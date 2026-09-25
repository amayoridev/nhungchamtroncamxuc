import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Mail, Users, Heart, BookOpen, Search, Send, Check, Sparkles, 
  Trash2, User, UserPlus, Settings, Bell, Calendar, HelpCircle, Share2, Star, Copy,
  Headphones, Play, Pause, RotateCcw, ArrowRight, ShieldCheck, CheckCircle2, Award, Clock,
  Volume2, VolumeX, ExternalLink, Music, Wind
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FriendProfile, ConnectionChallenge, Lesson, CompanionRequest, EncouragementCard, SweetCard, PodcastItem } from '../types';
import { GENTLE_LESSONS } from '../data/lessons';
import { recordDailyPractice } from '../lib/streak';
import { addStarHistoryLog, checkAchievementCompletion } from '../lib/achievements';
import { getActiveDailyPodcast, extractYouTubeId, extractTikTokVideoId, parseVideoUrl, syncPodcastsFromServer } from '../lib/podcasts';
import { checkAndResetDailyTasks, resetPairChallenges, resetConnectionChallenges } from '../lib/dailyReset';
import TikTokEmbed from './TikTokEmbed';

// --- TOP-LEVEL UTILITIES (Safe against Temporal Dead Zone during component initialization) ---
export function getCurrentUserObj() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

export function getUserCircleCode() {
  try {
    const userRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
    if (userRaw) {
      try {
        const u = JSON.parse(userRaw);
        if (u.circleCode) return u.circleCode;
      } catch (e) {}
    }
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('user_circle_code') : null;
    if (saved) return saved;
  } catch (e) {}
  return 'CT_2026';
}

export function getApiHeaders(): Record<string, string> {
  let rawToken = typeof localStorage !== 'undefined' ? (localStorage.getItem('token') || '').trim() : '';
  const safeToken = rawToken.replace(/[^\x00-\x7F]/g, '');

  const user = getCurrentUserObj();
  const userId = user?.id || user?._id || 'guest';
  const userCode = user?.circleCode || getUserCircleCode() || '';
  const username = user?.username || user?.name || 'Bạn đồng hành';

  const toAsciiHeader = (val: any) => {
    if (!val) return '';
    try {
      return encodeURIComponent(String(val)).replace(/[^\x00-\x7F]/g, '');
    } catch {
      return String(val).replace(/[^\x00-\x7F]/g, '');
    }
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (safeToken) {
    headers['Authorization'] = `Bearer ${safeToken}`;
  }

  const safeUserId = toAsciiHeader(userId);
  if (safeUserId) {
    headers['x-user-id'] = safeUserId;
  }

  const safeUserCode = toAsciiHeader(userCode);
  if (safeUserCode) {
    headers['x-circle-code'] = safeUserCode;
  }

  const safeUsername = toAsciiHeader(username);
  if (safeUsername) {
    headers['x-username'] = safeUsername;
  }

  return headers;
}

interface ConnectionsProps {
  streak: number;
  onAddCircle: (count: number, reason: string) => void;
  onUpdateStreak: (newStreak: number) => void;
  onBack: () => void;
  initialLessonId?: string | null;
  onClearInitialLesson?: () => void;
}

export default function Connections({ streak, onAddCircle, onUpdateStreak, onBack, initialLessonId, onClearInitialLesson }: ConnectionsProps) {
  // Navigation states: 'main' | 'unsent_letter' | 'connect_challenges' | 'lessons' | 'gratitude_note' | 'companions_tabs'
  const [view, setView] = useState<'main' | 'unsent_letter' | 'connect_challenges' | 'lessons' | 'gratitude_note' | 'companions_tabs'>('main');

  // Popup states
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Jump to lesson if requested from Journal
  useEffect(() => {
    if (initialLessonId) {
      const lesson = GENTLE_LESSONS.find(l => l.id === initialLessonId);
      if (lesson) {
        setView('lessons');
        setSelectedLesson(lesson);
      }
      if (onClearInitialLesson) {
        onClearInitialLesson();
      }
    }
  }, [initialLessonId]);

  // 1. UNSENT LETTER STATE
  const [letterText, setLetterText] = useState('');
  const [letterPrompt, setLetterPrompt] = useState('Mình muốn nói với...');
  const [letterDrafts, setLetterDrafts] = useState<string[]>([]);
  const [isLetterFavorite, setIsLetterFavorite] = useState(false);

  // 2. CONNECT CHALLENGES STATE (Auto-resets daily)
  const [challenges, setChallenges] = useState<ConnectionChallenge[]>(() => {
    const user = getCurrentUserObj();
    const userId = user?.id || user?._id || 'guest';
    const todayStr = new Date().toLocaleDateString('sv-SE');
    try {
      const savedDate = localStorage.getItem(`user_connection_challenges_date_${userId}`);
      if (!savedDate || savedDate !== todayStr) {
        return resetConnectionChallenges(userId, todayStr);
      }
      const saved = localStorage.getItem(`user_connection_challenges_${userId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}
    return resetConnectionChallenges(userId, todayStr);
  });
  const [relationshipTreeLevel, setRelationshipTreeLevel] = useState(1);

  // 3. GENTLE LESSONS STATE
  const [selectedCategory, setSelectedCategory] = useState<Lesson['category'] | 'all'>('all');
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [favoriteLessonIds, setFavoriteLessonIds] = useState<string[]>([]);
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('user');
      const user = raw ? JSON.parse(raw) : null;
      const userId = user?.id || user?._id || 'guest';
      const saved = localStorage.getItem(`completed_lessons_${userId}`) || localStorage.getItem('completed_lessons');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });

  useEffect(() => {
    const syncCompletedLessons = () => {
      try {
        const raw = localStorage.getItem('user');
        const user = raw ? JSON.parse(raw) : null;
        const userId = user?.id || user?._id || 'guest';
        const saved = localStorage.getItem(`completed_lessons_${userId}`) || localStorage.getItem('completed_lessons');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setCompletedLessonIds(parsed);
            return;
          }
        }
      } catch (e) {}
      setCompletedLessonIds([]);
    };

    window.addEventListener('user-auth-changed', syncCompletedLessons);
    window.addEventListener('empathy-lessons-updated', syncCompletedLessons);
    return () => {
      window.removeEventListener('user-auth-changed', syncCompletedLessons);
      window.removeEventListener('empathy-lessons-updated', syncCompletedLessons);
    };
  }, []);

  // 4. GRATITUDE NOTE STATE
  const [todayGratitude, setTodayGratitude] = useState('');

  // 5. COMPANIONS SECTIONS (5 Tabs: Thử thách, Kết nối, Lời mời, Bạn đồng hành, Hộp thư Tấm thiệp)
  const [companionTab, setCompanionTab] = useState<'challenges' | 'search' | 'invites' | 'companions' | 'cards_mailbox'>('challenges');
  const [searchQuery, setSearchQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [privacySettings, setPrivacySettings] = useState({
    allowSearchById: true,
    allowSearchByEmail: true,
    allowSearchByPhone: false,
    hideFromSuggestions: false,
    showActivity: true,
    showStreak: true,
    showAchievements: true
  });

  // Sweet Cards State
  const [receivedCards, setReceivedCards] = useState<SweetCard[]>([]);
  const [unreadCardsCount, setUnreadCardsCount] = useState<number>(0);
  const [activeCardPopup, setActiveCardPopup] = useState<SweetCard | null>(null);

  // Companion Real List from LocalStorage / Scoped Storage
  const [companions, setCompanions] = useState<FriendProfile[]>([]);
  const [invites, setInvites] = useState<CompanionRequest[]>([]);

  // Selected Companion for Joint Challenges
  const [selectedCompanionId, setSelectedCompanionId] = useState<string>(() => {
    const user = getCurrentUserObj();
    const userId = user?.id || user?._id || 'guest';
    return typeof localStorage !== 'undefined' ? (localStorage.getItem(`active_pair_companion_id_${userId}`) || '') : '';
  });

  // Pair Challenge Modal and interactive states
  const [activeChallengeModal, setActiveChallengeModal] = useState<{
    id: string;
    title: string;
    points: number;
    complete: boolean;
    myCompleted?: boolean;
    companionCompleted?: boolean;
  } | null>(null);

  // Challenge 1: Journal action state
  const [challengeJournalText, setChallengeJournalText] = useState('');
  const [challengeJournalSaved, setChallengeJournalSaved] = useState(false);

  // Challenge 2: Podcast action state
  const [dailyPodcast, setDailyPodcast] = useState<PodcastItem | null>(() => getActiveDailyPodcast());
  const [podcastPlaying, setPodcastPlaying] = useState(false);
  const [podcastSeconds, setPodcastSeconds] = useState(0);
  const [podcastProgress, setPodcastProgress] = useState(0);
  const [podcastCompleted, setPodcastCompleted] = useState(false);
  const [podcastMuted, setPodcastMuted] = useState(false);
  const podcastIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Sync active daily podcast with server / storage
  useEffect(() => {
    const syncPodcast = async () => {
      try {
        const { daily } = await syncPodcastsFromServer();
        if (daily) {
          setDailyPodcast(daily);
          return;
        }
      } catch (e) {}
      setDailyPodcast(getActiveDailyPodcast());
    };

    syncPodcast();
    window.addEventListener('daily-podcast-updated', syncPodcast);
    return () => window.removeEventListener('daily-podcast-updated', syncPodcast);
  }, []);

  // Parse podcast total seconds
  const parseTotalSeconds = (durStr: string) => {
    if (!durStr) return 300;
    if (durStr.includes(':')) {
      const parts = durStr.split(':');
      return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
    }
    const match = durStr.match(/(\d+)/);
    if (match) {
      return parseInt(match[1], 10) * 60;
    }
    return 300;
  };

  const totalPodcastSec = parseTotalSeconds(dailyPodcast?.duration || '5 phút');

  const formatPodcastTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Toggle podcast play/pause
  const togglePodcastPlay = () => {
    const nextState = !podcastPlaying;
    setPodcastPlaying(nextState);

    const iframe = document.getElementById('yt-healing-iframe') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      if (nextState) {
        iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
      } else {
        iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
      }
    }
  };

  const handleSeekPodcast = (targetPercent: number) => {
    const newSec = Math.round((targetPercent / 100) * totalPodcastSec);
    setPodcastSeconds(newSec);
    setPodcastProgress(targetPercent);
    const iframe = document.getElementById('yt-healing-iframe') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(`{"event":"command","func":"seekTo","args":[${newSec}, true]}`, '*');
    }
  };

  const handleSkipPodcast = (deltaSeconds: number) => {
    const newSec = Math.max(0, Math.min(totalPodcastSec, podcastSeconds + deltaSeconds));
    const newPct = Math.round((newSec / totalPodcastSec) * 100);
    setPodcastSeconds(newSec);
    setPodcastProgress(newPct);
    const iframe = document.getElementById('yt-healing-iframe') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(`{"event":"command","func":"seekTo","args":[${newSec}, true]}`, '*');
    }
  };

  // Podcast progress timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (podcastPlaying) {
      timer = setInterval(() => {
        setPodcastSeconds(sec => {
          const nextSec = sec + 1;
          const nextPct = Math.min(100, Math.round((nextSec / totalPodcastSec) * 100));
          setPodcastProgress(nextPct);
          if (nextSec >= totalPodcastSec) {
            setPodcastPlaying(false);
            setPodcastCompleted(true);
            return totalPodcastSec;
          }
          return nextSec;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [podcastPlaying, totalPodcastSec]);

  // Challenge 3: Breath action state (4s Inhale, 4s Hold, 4s Exhale)
  const [breathPhase, setBreathPhase] = useState<'idle' | 'inhale' | 'hold' | 'exhale'>('idle');
  const [breathCount, setBreathCount] = useState(4);
  const [breathRoundsCompleted, setBreathRoundsCompleted] = useState(0);
  const [breathIsRunning, setBreathIsRunning] = useState(false);

  // Pair Challenges State (Tracks both 'myCompleted' and 'companionCompleted' with Daily Auto-Reset)
  const [pairChallenges, setPairChallenges] = useState<{
    id: string;
    title: string;
    points: number;
    complete: boolean;
    myCompleted: boolean;
    companionCompleted: boolean;
  }[]>(() => {
    const user = getCurrentUserObj();
    const userId = user?.id || user?._id || 'guest';
    const todayStr = new Date().toLocaleDateString('sv-SE');
    try {
      const savedDate = localStorage.getItem(`user_pair_challenges_date_${userId}`);
      if (!savedDate || savedDate !== todayStr) {
        return resetPairChallenges(userId, todayStr);
      }
      const saved = localStorage.getItem(`user_pair_challenges_${userId}`) || localStorage.getItem('app_pair_challenges');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any) => ({
            id: item.id || `pc_${item.title}`,
            title: item.title,
            points: item.points || 2,
            myCompleted: !!item.myCompleted,
            companionCompleted: !!item.companionCompleted,
            complete: !!item.complete || (!!item.myCompleted && !!item.companionCompleted)
          }));
        }
      }
    } catch (e) {}
    return resetPairChallenges(userId, todayStr);
  });

  // Breathing loop timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (breathIsRunning) {
      timer = setInterval(() => {
        setBreathCount((prev) => {
          if (prev <= 1) {
            if (breathPhase === 'inhale') {
              setBreathPhase('hold');
              return 4;
            } else if (breathPhase === 'hold') {
              setBreathPhase('exhale');
              return 4;
            } else {
              setBreathPhase('inhale');
              setBreathRoundsCompleted(r => r + 1);
              return 4;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [breathIsRunning, breathPhase]);

  // Synchronize and auto-reset when a new day is detected across tabs or window focus
  useEffect(() => {
    const user = getCurrentUserObj();
    const userId = user?.id || user?._id || 'guest';
    const todayStr = new Date().toLocaleDateString('sv-SE');

    // Check if new day on mount
    checkAndResetDailyTasks(user);

    const handleDailyResetEvent = () => {
      const freshPair = resetPairChallenges(userId, todayStr);
      setPairChallenges(freshPair);
      const freshConn = resetConnectionChallenges(userId, todayStr);
      setChallenges(freshConn);
    };

    window.addEventListener('daily-tasks-reset', handleDailyResetEvent);
    window.addEventListener('pair-challenges-reset', handleDailyResetEvent);

    const handleFocus = () => {
      const didReset = checkAndResetDailyTasks(user);
      if (didReset) {
        handleDailyResetEvent();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('daily-tasks-reset', handleDailyResetEvent);
      window.removeEventListener('pair-challenges-reset', handleDailyResetEvent);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  // Helper to get active selected companion for pair challenges
  const getActiveCompanion = useCallback((): FriendProfile | null => {
    if (companions.length === 0) return null;
    if (selectedCompanionId) {
      const found = companions.find(c => c.id === selectedCompanionId || c.circleCode === selectedCompanionId);
      if (found) return found;
    }
    return companions[0];
  }, [companions, selectedCompanionId]);

  // Handler to switch active companion for pair challenges
  const handleSelectCompanion = (comp: FriendProfile) => {
    const compId = comp.id || comp.circleCode || '';
    setSelectedCompanionId(compId);
    const user = getCurrentUserObj();
    const userId = user?.id || user?._id || 'guest';
    const todayStr = new Date().toLocaleDateString('sv-SE');

    try {
      localStorage.setItem(`active_pair_companion_id_${userId}`, compId);

      const compKey = `user_pair_challenges_${userId}_comp_${compId}`;
      const compDateKey = `user_pair_challenges_date_${userId}_comp_${compId}`;
      const savedDate = localStorage.getItem(compDateKey);
      const saved = localStorage.getItem(compKey);

      if (saved && savedDate === todayStr) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPairChallenges(parsed);
          setSuccessMsg(`Đã chọn cùng làm thử thách với ${comp.name} 🌿`);
          return;
        }
      }

      // Check legacy challenges for today
      const legacySaved = localStorage.getItem(`user_pair_challenges_${userId}`);
      const legacyDate = localStorage.getItem(`user_pair_challenges_date_${userId}`);
      if (legacySaved && legacyDate === todayStr && !saved) {
        const parsedLegacy = JSON.parse(legacySaved);
        if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
          setPairChallenges(parsedLegacy);
          localStorage.setItem(compKey, legacySaved);
          localStorage.setItem(compDateKey, todayStr);
          setSuccessMsg(`Đã chọn cùng làm thử thách với ${comp.name} 🌿`);
          return;
        }
      }

      // Fresh reset for today with this companion
      const fresh = resetPairChallenges(userId, todayStr);
      setPairChallenges(fresh);
      localStorage.setItem(compKey, JSON.stringify(fresh));
      localStorage.setItem(compDateKey, todayStr);
      setSuccessMsg(`Đã chọn cùng làm thử thách với ${comp.name} 🌿`);
    } catch (e) {
      console.error("Error switching companion:", e);
    }
  };

  // Add a sample companion if user has no companions yet
  const handleAddSampleCompanion = () => {
    const user = getCurrentUserObj();
    const userId = user?.id || user?._id || 'guest';
    const sample: FriendProfile = {
      id: 'BT882',
      circleCode: 'BT882',
      name: 'Bảo Trân',
      avatar: '🌸',
      bio: 'Hít vào bình an, thở ra nụ cười 🌸',
      favoriteQuote: 'Mỗi ngày là một khởi đầu mới dịu dàng.',
      streak: 7,
      emotionalCircles: 42,
      treeLevel: 3,
      favoriteEmotion: 'binh_yen'
    };

    const updated = [sample, ...companions.filter(c => c.id !== 'BT882' && c.circleCode !== 'BT882')];
    setCompanions(updated);
    setSelectedCompanionId('BT882');
    try {
      localStorage.setItem(`user_friends_list_${userId}`, JSON.stringify(updated));
      localStorage.setItem(`app_companions_list_${userId}`, JSON.stringify(updated));
      localStorage.setItem('app_companions_list', JSON.stringify(updated));
      localStorage.setItem(`active_pair_companion_id_${userId}`, 'BT882');
    } catch (e) {}
    setSuccessMsg(`Đã thêm bạn đồng hành ${sample.name} 🌸 để cùng tham gia thử thách!`);
  };

  // Toggle companion's part of challenge
  const handleToggleCompanionPartOfChallenge = (id: string) => {
    const user = getCurrentUserObj();
    const userId = user?.id || user?._id || 'guest';
    const activeComp = getActiveCompanion();
    const compName = activeComp?.name || 'Bạn đồng hành';

    const item = pairChallenges.find(p => p.id === id);
    if (!item) return;

    const newCompDone = !item.companionCompleted;
    const isBothDone = item.myCompleted && newCompDone;

    const updated = pairChallenges.map(p => {
      if (p.id === id) {
        return {
          ...p,
          companionCompleted: newCompDone,
          complete: isBothDone
        };
      }
      return p;
    });

    setPairChallenges(updated);

    const todayStr = new Date().toLocaleDateString('sv-SE');
    const compKey = activeComp ? (activeComp.id || activeComp.circleCode) : 'default';

    try {
      localStorage.setItem(`user_pair_challenges_${userId}_comp_${compKey}`, JSON.stringify(updated));
      localStorage.setItem(`user_pair_challenges_date_${userId}_comp_${compKey}`, todayStr);
      localStorage.setItem(`user_pair_challenges_${userId}`, JSON.stringify(updated));
      localStorage.setItem(`user_pair_challenges_date_${userId}`, todayStr);
      localStorage.setItem('app_pair_challenges', JSON.stringify(updated));
      localStorage.setItem('app_pair_challenges_date', todayStr);
    } catch (e) {}

    if (newCompDone) {
      if (isBothDone) {
        setSuccessMsg(`🎉 Tuyệt vời! Cả 2 bạn đã cùng hoàn thành xong thử thách "${item.title}"!`);
      } else {
        setSuccessMsg(`✨ Đã ghi nhận ${compName} hoàn thành bài! Đang chờ bạn thực hiện phần của mình.`);
      }
    } else {
      setSuccessMsg(`Đã chuyển trạng thái bài của ${compName} về Chưa làm.`);
    }
  };

  const handleManualResetToday = async () => {
    const user = getCurrentUserObj();
    const userId = user?.id || user?._id || 'guest';
    const todayStr = new Date().toLocaleDateString('sv-SE');

    try {
      await fetch('/api/pair-challenges/reset', {
        method: 'POST',
        headers: getApiHeaders()
      });
    } catch (e) {}

    checkAndResetDailyTasks(user, true);

    const freshPair = resetPairChallenges(userId, todayStr);
    setPairChallenges(freshPair);
    const freshConn = resetConnectionChallenges(userId, todayStr);
    setChallenges(freshConn);

    const activeComp = getActiveCompanion();
    const compKey = activeComp ? (activeComp.id || activeComp.circleCode) : 'default';
    try {
      localStorage.setItem(`user_pair_challenges_${userId}_comp_${compKey}`, JSON.stringify(freshPair));
      localStorage.setItem(`user_pair_challenges_date_${userId}_comp_${compKey}`, todayStr);
      localStorage.setItem(`user_pair_challenges_${userId}`, JSON.stringify(freshPair));
      localStorage.setItem(`user_pair_challenges_date_${userId}`, todayStr);
      localStorage.setItem('app_pair_challenges', JSON.stringify(freshPair));
      localStorage.setItem('app_pair_challenges_date', todayStr);
    } catch (e) {}

    triggerCelebration('Đã làm mới tất cả nhiệm vụ hôm nay về trạng thái chưa làm!', 1);
  };

  const handleCompleteMyPartOfChallenge = async (id: string) => {
    const user = getCurrentUserObj();
    const userId = user?.id || user?._id || 'guest';
    const item = pairChallenges.find(p => p.id === id);
    if (!item) return;

    const myDone = true;
    const compDone = item.companionCompleted;
    const isBothDone = myDone && compDone;

    const updated = pairChallenges.map(p => {
      if (p.id === id) {
        return {
          ...p,
          myCompleted: myDone,
          companionCompleted: compDone,
          complete: isBothDone
        };
      }
      return p;
    });

    setPairChallenges(updated);

    const todayStr = new Date().toLocaleDateString('sv-SE');
    const activeComp = getActiveCompanion();
    const compKey = activeComp ? (activeComp.id || activeComp.circleCode) : 'default';

    try {
      localStorage.setItem(`user_pair_challenges_${userId}_comp_${compKey}`, JSON.stringify(updated));
      localStorage.setItem(`user_pair_challenges_date_${userId}_comp_${compKey}`, todayStr);
      localStorage.setItem(`user_pair_challenges_${userId}`, JSON.stringify(updated));
      localStorage.setItem(`user_pair_challenges_date_${userId}`, todayStr);
      localStorage.setItem('app_pair_challenges', JSON.stringify(updated));
      localStorage.setItem('app_pair_challenges_date', todayStr);
    } catch (e) {}

    try {
      await fetch('/api/pair-challenges/complete', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          challengeId: id,
          completedPart: 'me',
          companionComplete: compDone
        })
      });
    } catch (e) {
      console.error("Error completing pair challenge on API:", e);
    }

    // Award +2 STARS immediately to the user's Star Wallet & History
    const pointsToAward = item.points || 2;
    const challengeEmoji = id === 'pc2' ? '🎧' : id === 'pc1' ? '📖' : '🌬️';
    const challengeCategory = id === 'pc2' ? 'Bài nghe chữa lành' : 'Thử thách đôi';

    addStarHistoryLog(
      `Hoàn thành thử thách: ${item.title}`,
      pointsToAward,
      challengeEmoji,
      challengeCategory,
      `pair_${id}_${todayStr}`,
      user
    );

    const updatedStreak = recordDailyPractice();
    onUpdateStreak(updatedStreak);
    checkAchievementCompletion(updatedStreak, 0, true, user);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('achievement-stars-updated'));
      window.dispatchEvent(new CustomEvent('selfcare-state-change'));
      window.dispatchEvent(new CustomEvent('daily-practice-recorded'));
    }

    if (isBothDone) {
      setSuccessMsg(`🎉 Tuyệt vời! Cả 2 bạn đã cùng hoàn thành trọn vẹn: "${item.title}". Bạn nhận được +${pointsToAward} ⭐ Sao Khả Dụng!`);
    } else {
      setSuccessMsg(`🎉 Bạn đã hoàn thành xuất sắc bài hôm nay và nhận được +${pointsToAward} ⭐ Sao Khả Dụng! Đang chờ bạn đồng hành hoàn thành phần còn lại.`);
    }

    setActiveChallengeModal(null);
  };

  const handleOpenChallengeModal = (item: typeof pairChallenges[0]) => {
    setActiveChallengeModal(item);
    setChallengeJournalText('');
    setChallengeJournalSaved(false);
    setPodcastPlaying(false);
    setPodcastProgress(item.myCompleted ? 100 : 35);
    setPodcastCompleted(item.myCompleted);
    setBreathPhase('idle');
    setBreathCount(4);
    setBreathRoundsCompleted(item.myCompleted ? 3 : 0);
    setBreathIsRunning(false);
  };

  const loadPairChallenges = useCallback(async () => {
    try {
      const headers = getApiHeaders();
      const res = await fetch('/api/pair-challenges', { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.challenges) && data.challenges.length > 0) {
          setPairChallenges(data.challenges);
          const user = getCurrentUserObj();
          const userId = user?.id || user?._id || 'guest';
          const todayStr = data.date || new Date().toLocaleDateString('sv-SE');
          try {
            localStorage.setItem(`user_pair_challenges_${userId}`, JSON.stringify(data.challenges));
            localStorage.setItem(`user_pair_challenges_date_${userId}`, todayStr);
            localStorage.setItem('app_pair_challenges', JSON.stringify(data.challenges));
            localStorage.setItem('app_pair_challenges_date', todayStr);
          } catch (e) {}
        }
      }
    } catch (e) {}
  }, []);

  const loadFriendData = useCallback(async () => {
    const user = getCurrentUserObj();
    const userId = user?.id || user?._id || 'guest';

    // 1. Load pending friend requests from local storage
    let localInvites: CompanionRequest[] = [];
    try {
      const savedScoped = localStorage.getItem(`user_friend_requests_${userId}`) || 
                          localStorage.getItem(`app_companion_invites_${userId}`) || 
                          localStorage.getItem('app_companion_invites');
      if (savedScoped) localInvites = JSON.parse(savedScoped);
    } catch (e) {}

    // 2. Load companions list from local storage
    let localCompanions: FriendProfile[] = [];
    try {
      const savedScoped = localStorage.getItem(`user_friends_list_${userId}`) || 
                          localStorage.getItem(`app_companions_list_${userId}`) || 
                          localStorage.getItem('app_companions_list');
      if (savedScoped) localCompanions = JSON.parse(savedScoped);
    } catch (e) {}

    // 3. Fetch from API (always using fallback headers for guest/cross-browser sync)
    try {
      const headers = getApiHeaders();
      const [reqsRes, friendsRes] = await Promise.all([
        fetch('/api/friend-requests', { headers }),
        fetch('/api/friends', { headers })
      ]);

      if (reqsRes.ok) {
        const reqsData = await reqsRes.json();
        if (Array.isArray(reqsData.requests)) {
          const apiRequests: CompanionRequest[] = reqsData.requests.map((r: any) => ({
            id: r.id,
            fromId: r.fromId,
            fromName: r.fromName,
            fromAvatar: r.fromAvatar || '🌸',
            fromCircleCode: r.fromCircleCode,
            toId: r.toId,
            status: r.status || 'pending',
            date: r.date || new Date().toLocaleDateString('vi-VN')
          }));

          // Combine API and local requests without duplicates
          const combined = [...apiRequests];
          localInvites.forEach(loc => {
            if (!combined.some(c => c.id === loc.id || (c.fromId && c.fromId === loc.fromId) || (c.fromCircleCode && c.fromCircleCode === loc.fromCircleCode))) {
              combined.push(loc);
            }
          });
          localInvites = combined;
        }
      }

      if (friendsRes.ok) {
        const friendsData = await friendsRes.json();
        if (Array.isArray(friendsData.friendsList)) {
          const apiFriends: FriendProfile[] = friendsData.friendsList;
          const combined = [...apiFriends];
          localCompanions.forEach(loc => {
            if (!combined.some(c => c.id === loc.id || (c.circleCode && c.circleCode === loc.circleCode))) {
              combined.push(loc);
            }
          });
          localCompanions = combined;
        }
      }
    } catch (err) {
      console.error("Error fetching friend data from API:", err);
    }

    setInvites(localInvites);
    setCompanions(localCompanions);
    if (localCompanions.length > 0) {
      setSelectedCompanionId(prev => prev || localCompanions[0].id || localCompanions[0].circleCode || '');
    }

    // Persist to user-scoped local keys
    try {
      localStorage.setItem(`user_friend_requests_${userId}`, JSON.stringify(localInvites));
      localStorage.setItem(`app_companion_invites_${userId}`, JSON.stringify(localInvites));
      localStorage.setItem('app_companion_invites', JSON.stringify(localInvites));

      localStorage.setItem(`user_friends_list_${userId}`, JSON.stringify(localCompanions));
      localStorage.setItem(`app_companions_list_${userId}`, JSON.stringify(localCompanions));
      localStorage.setItem('app_companions_list', JSON.stringify(localCompanions));
    } catch (e) {}
  }, []);

  const loadSweetCards = useCallback(async () => {
    const user = getCurrentUserObj();
    const userId = user?.id || user?._id || 'guest';
    const userCode = user?.circleCode || getUserCircleCode();

    let cards: SweetCard[] = [];

    const keysToRead = [
      `user_received_cards_${userId}`,
      `user_received_cards_${userCode}`,
      `app_received_cards_${userId}`,
      `app_received_cards_${userCode}`,
      'app_received_cards'
    ];

    for (const key of keysToRead) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((c: SweetCard) => {
              if (!cards.some(existing => existing.id === c.id)) {
                cards.push(c);
              }
            });
          }
        }
      } catch (e) {}
    }

    try {
      const headers = getApiHeaders();
      const res = await fetch('/api/sweet-cards', { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.cards)) {
          data.cards.forEach((c: SweetCard) => {
            if (!cards.some(existing => existing.id === c.id)) {
              cards.push(c);
            }
          });
        }
      }
    } catch (e) {
      console.error("Error fetching sweet cards from API:", e);
    }

    setReceivedCards(cards);
    const unreadCount = cards.filter(c => !c.isRead).length;
    setUnreadCardsCount(unreadCount);

    // Auto popup unread card immediately if no popup is active
    const unreadCard = cards.find(c => !c.isRead);
    if (unreadCard && !activeCardPopup) {
      setActiveCardPopup(unreadCard);
    }
  }, [activeCardPopup]);

  useEffect(() => {
    loadFriendData();
    loadSweetCards();
    loadPairChallenges();

    const handleUpdate = () => {
      loadFriendData();
      loadSweetCards();
      loadPairChallenges();
    };

    window.addEventListener('friend-requests-updated', handleUpdate);
    window.addEventListener('companions-updated', handleUpdate);
    window.addEventListener('sweet-cards-updated', handleUpdate);
    window.addEventListener('user-auth-changed', handleUpdate);
    window.addEventListener('focus', handleUpdate);
    document.addEventListener('visibilitychange', handleUpdate);

    // Auto-refresh every 3 seconds for instant real-time sync across devices
    const interval = setInterval(() => {
      loadFriendData();
      loadSweetCards();
      loadPairChallenges();
    }, 3000);

    return () => {
      window.removeEventListener('friend-requests-updated', handleUpdate);
      window.removeEventListener('companions-updated', handleUpdate);
      window.removeEventListener('sweet-cards-updated', handleUpdate);
      window.removeEventListener('user-auth-changed', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
      document.removeEventListener('visibilitychange', handleUpdate);
      clearInterval(interval);
    };
  }, [loadFriendData, loadSweetCards]);

  // Re-fetch whenever user switches view or companionTab
  useEffect(() => {
    loadFriendData();
    loadSweetCards();
  }, [view, companionTab, loadFriendData, loadSweetCards]);

  const saveInvitesToLocalAndState = (newInvites: CompanionRequest[]) => {
    setInvites(newInvites);
    const user = getCurrentUserObj();
    const userId = user?.id || user?._id || 'guest';
    try {
      localStorage.setItem(`user_friend_requests_${userId}`, JSON.stringify(newInvites));
      localStorage.setItem(`app_companion_invites_${userId}`, JSON.stringify(newInvites));
      localStorage.setItem('app_companion_invites', JSON.stringify(newInvites));
    } catch (e) {}
    window.dispatchEvent(new Event('friend-requests-updated'));
  };

  const saveCompanionsToLocalAndState = (newCompanions: FriendProfile[]) => {
    setCompanions(newCompanions);
    const user = getCurrentUserObj();
    const userId = user?.id || user?._id || 'guest';
    try {
      localStorage.setItem(`user_friends_list_${userId}`, JSON.stringify(newCompanions));
      localStorage.setItem(`app_companions_list_${userId}`, JSON.stringify(newCompanions));
      localStorage.setItem('app_companions_list', JSON.stringify(newCompanions));
    } catch (e) {}
    window.dispatchEvent(new Event('companions-updated'));
  };

  const [selectedCompanionProfile, setSelectedCompanionProfile] = useState<FriendProfile | null>(null);

  // Search Results States
  const [searchResult, setSearchResult] = useState<FriendProfile | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [myCodeCopied, setMyCodeCopied] = useState(false);

  // Encouragement Cards Selection
  const encouragementCards: EncouragementCard[] = [
    { id: 'e1', title: 'Một cái ôm tinh thần', content: 'Mình luôn ở đây lắng nghe và ủng hộ bạn vượt qua mọi khó khăn nhé!', emoji: '🤗' },
    { id: 'e2', title: 'Bạn đang làm tốt lắm', content: 'Đừng lo lắng, nỗ lực nhỏ của bạn mỗi ngày đều rất tuyệt vời.', emoji: '✨' },
    { id: 'e3', title: 'Một đóa hoa bình yên', content: 'Hôm nay hãy dành thời gian hít thở sâu và yêu thương bản thân nhé.', emoji: '🌸' }
  ];

  const triggerCelebration = (reason: string, reward: number = 1) => {
    setSuccessMsg(reason);
    onAddCircle(reward, reason);
    const updatedStreak = recordDailyPractice();
    onUpdateStreak(updatedStreak);
  };

  // 1. UNSENT LETTER ACTIONS
  const saveLetterDraft = () => {
    if (letterText.trim() === '') return;
    setLetterDrafts([...letterDrafts, letterText]);
    setLetterText('');
    triggerCelebration('Bạn đã lưu bức thư vào hộp kín cẩn mật. "Không phải mọi lá thư đều cần được gửi đi. Đôi khi, việc viết ra cũng đã là một bước chữa lành."', 1);
  };

  // 2. CONNECT CHALLENGES ACTIONS
  const toggleChallenge = (id: string) => {
    const user = getCurrentUserObj();
    const userId = user?.id || user?._id || 'guest';
    const todayStr = new Date().toLocaleDateString('sv-SE');
    setChallenges(prev => {
      const next = prev.map(ch => {
        if (ch.id === id) {
          const nextState = !ch.isCompleted;
          if (nextState) {
            triggerCelebration(`Hoàn thành thử thách kết nối: "${ch.title}"! Cây quan hệ của bạn đã lớn thêm một chút.`, 1);
            setRelationshipTreeLevel(p => p + 1);
          }
          return { ...ch, isCompleted: nextState };
        }
        return ch;
      });
      try {
        localStorage.setItem(`user_connection_challenges_${userId}`, JSON.stringify(next));
        localStorage.setItem(`user_connection_challenges_date_${userId}`, todayStr);
      } catch (e) {}
      return next;
    });
  };

  // 3. GENTLE LESSONS ACTIONS
  const toggleLessonFav = (id: string) => {
    setFavoriteLessonIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const markLessonCompleted = (id: string) => {
    if (!completedLessonIds.includes(id)) {
      const updated = [...completedLessonIds, id];
      setCompletedLessonIds(updated);
      try {
        const raw = localStorage.getItem('user');
        const user = raw ? JSON.parse(raw) : null;
        const userId = user?.id || user?._id || 'guest';
        localStorage.setItem(`completed_lessons_${userId}`, JSON.stringify(updated));
        localStorage.setItem('completed_lessons', JSON.stringify(updated));
      } catch (e) {}

      window.dispatchEvent(new Event('empathy-lessons-updated'));
      triggerCelebration('Hoàn thành bài học dịu dàng tinh thần hằng ngày!', 1);
    }
  };

  // 4. GRATITUDE NOTE ACTIONS
  const saveTodayGratitude = () => {
    if (todayGratitude.trim() === '') return;
    setTodayGratitude('');
    triggerCelebration('Đã gửi lời tri ân ngọt ngào của bạn tới mọi người hôm nay! 🌸', 1);
  };

  // 5. SEARCH FRIENDS BY CIRCLE CODE
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    setSearchError(null);
    setSearchResult(null);
    setRequestSent(false);

    const cleanQuery = searchQuery.trim().toUpperCase();

    // Check if user is searching for their own Circle Code
    const myCode = getUserCircleCode().toUpperCase();
    if (cleanQuery === myCode || `CT_${cleanQuery}` === myCode) {
      setSearchError('Đây là Mã Chấm Tròn của chính bạn. Hãy nhập Mã Chấm Tròn của bạn bè nhé! ✨');
      setIsSearching(false);
      return;
    }

    try {
      const res = await fetch(`/api/users/search?code=${encodeURIComponent(cleanQuery)}`, {
        headers: getApiHeaders()
      });
      const data = await res.json();
      if (data.found && data.user) {
        const foundCircleCode = data.user.circleCode || data.user.id;
        const foundUserId = data.user.id || data.user._id;
        setSearchResult({
          id: foundCircleCode,
          userId: foundUserId,
          circleCode: foundCircleCode,
          name: data.user.username,
          avatar: data.user.avatar || '🌸',
          bio: data.user.motto || 'Lắng nghe để hiểu, yêu thương để chữa lành.',
          favoriteQuote: 'Dịu dàng với chính mình.',
          streak: data.user.streak || 1,
          emotionalCircles: data.user.emotionalCircles || 0,
          treeLevel: data.user.treeLevel || 1,
          favoriteEmotion: 'binh_yen'
        });
        setIsSearching(false);
        return;
      }
    } catch (err) {
      console.error("Search API error:", err);
    }

    setSearchError('Không tìm thấy Bạn đồng hành với Mã Chấm Tròn này');
    setIsSearching(false);
  };

  const handleSendCompanionRequest = async (friend: FriendProfile) => {
    const userA = getCurrentUserObj();
    const userAId = userA?.id || userA?._id || 'guest';
    const userACode = userA?.circleCode || getUserCircleCode();
    const userAName = userA?.username || 'Người dùng';
    const userAAvatar = userA?.avatar || '🌸';

    const targetCode = friend.circleCode || friend.id;
    const targetUserId = friend.userId || friend.id;

    // Check if already in companions
    if (companions.some(c => c.id === targetCode || c.id === targetUserId || (c.circleCode && (c.circleCode === targetCode || c.circleCode === targetUserId)))) {
      alert(`Hai bạn (${friend.name}) đã là bạn đồng hành của nhau rồi! ✨`);
      return;
    }

    const newRequest: CompanionRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      fromId: userAId,
      fromName: userAName,
      fromAvatar: userAAvatar,
      fromCircleCode: userACode,
      toId: targetUserId,
      toName: friend.name,
      status: 'pending',
      date: new Date().toLocaleDateString('vi-VN')
    };

    // 1. Send via API (always)
    try {
      const res = await fetch('/api/friend-requests', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          targetCode: targetCode,
          targetUserId: targetUserId !== targetCode ? targetUserId : undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error) {
          alert(data.error);
          return;
        }
      }
    } catch (err) {
      console.error("API error sending friend request:", err);
    }

    // 2. Sync to Target User B's LocalStorage keys (for multi-user testing on same browser/tab)
    try {
      const keysToUpdate = [
        `user_friend_requests_${targetUserId}`,
        `user_friend_requests_${targetCode}`,
        `app_companion_invites_${targetUserId}`,
        `app_companion_invites_${targetCode}`
      ];

      for (const key of keysToUpdate) {
        const existingRaw = localStorage.getItem(key);
        let targetRequests: CompanionRequest[] = existingRaw ? JSON.parse(existingRaw) : [];
        if (!targetRequests.some(r => r.fromId === userAId || r.fromCircleCode === userACode)) {
          targetRequests.push(newRequest);
          localStorage.setItem(key, JSON.stringify(targetRequests));
        }
      }

      // Save sent list marker for User A
      const sentKey = `user_sent_requests_${userAId}`;
      const sentRaw = localStorage.getItem(sentKey);
      let sentList: string[] = sentRaw ? JSON.parse(sentRaw) : [];
      if (!sentList.includes(targetCode)) sentList.push(targetCode);
      if (!sentList.includes(targetUserId)) sentList.push(targetUserId);
      localStorage.setItem(sentKey, JSON.stringify(sentList));
    } catch (e) {
      console.error("Local storage sync error:", e);
    }

    setRequestSent(true);
    window.dispatchEvent(new Event('friend-requests-updated'));
    alert(`Đã gửi lời mời kết bạn tới ${friend.name} thành công! ✨`);
  };

  const handleCopyMyCode = () => {
    const code = getUserCircleCode();
    navigator.clipboard.writeText(code);
    setMyCodeCopied(true);
    setTimeout(() => setMyCodeCopied(false), 2500);
  };

  const handleAcceptInvite = async (req: CompanionRequest) => {
    const userB = getCurrentUserObj();
    const userBId = userB?.id || userB?._id || 'guest';
    const userBCode = userB?.circleCode || getUserCircleCode();
    const userBName = userB?.username || 'Bạn đồng hành';
    const userBAvatar = userB?.avatar || '🌸';

    // 1. Remove request from receiver's invites
    const nextInvites = invites.filter(i => i.id !== req.id && i.fromId !== req.fromId && i.fromCircleCode !== req.fromCircleCode);
    saveInvitesToLocalAndState(nextInvites);

    // 2. Add Sender to Receiver's companions list
    const newCompanionForB: FriendProfile = {
      id: req.fromCircleCode || req.fromId,
      name: req.fromName,
      avatar: req.fromAvatar || '🌸',
      bio: 'Lắng nghe để hiểu, yêu thương để chữa lành.',
      favoriteQuote: 'Mỗi ngày là một món quà.',
      streak: 4,
      emotionalCircles: 5,
      treeLevel: 1,
      favoriteEmotion: 'binh_yen'
    };

    const nextCompanionsForB = [...companions];
    if (!nextCompanionsForB.some(c => c.id === newCompanionForB.id || (c.circleCode && c.circleCode === newCompanionForB.id))) {
      nextCompanionsForB.push(newCompanionForB);
    }
    saveCompanionsToLocalAndState(nextCompanionsForB);

    // 3. TWO-WAY SYNC: Add Receiver to Sender's companions list in LocalStorage
    try {
      const senderId = req.fromId;
      if (senderId) {
        const senderFriendsKey = `user_friends_list_${senderId}`;
        const senderFriendsRaw = localStorage.getItem(senderFriendsKey) || localStorage.getItem(`app_companions_list_${senderId}`);
        let senderFriends: FriendProfile[] = senderFriendsRaw ? JSON.parse(senderFriendsRaw) : [];

        const newCompanionForA: FriendProfile = {
          id: userBCode || userBId,
          name: userBName,
          avatar: userBAvatar,
          bio: 'Lắng nghe để hiểu, yêu thương để chữa lành.',
          favoriteQuote: 'Cùng nhau bình yên mỗi ngày.',
          streak: userB?.streak || 1,
          emotionalCircles: userB?.emotionalCircles || 0,
          treeLevel: 1,
          favoriteEmotion: 'binh_yen'
        };

        if (!senderFriends.some(c => c.id === newCompanionForA.id || (c.circleCode && c.circleCode === newCompanionForA.id))) {
          senderFriends.push(newCompanionForA);
          localStorage.setItem(senderFriendsKey, JSON.stringify(senderFriends));
          localStorage.setItem(`app_companions_list_${senderId}`, JSON.stringify(senderFriends));
        }
      }
    } catch (e) {
      console.error("Two-way sync local storage error:", e);
    }

    // 4. API Call for Accept
    try {
      await fetch('/api/friend-requests/accept', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          requestId: req.id,
          fromId: req.fromId,
          fromCircleCode: req.fromCircleCode
        })
      });
    } catch (err) {
      console.error("API accept error:", err);
    }

    triggerCelebration(`Bạn vừa tạo thêm một kết nối đồng hành tích cực cùng ${req.fromName}! ✨`, 1);
  };

  const handleDeclineInvite = async (req: CompanionRequest) => {
    const nextInvites = invites.filter(i => i.id !== req.id && i.fromId !== req.fromId && i.fromCircleCode !== req.fromCircleCode);
    saveInvitesToLocalAndState(nextInvites);

    try {
      await fetch('/api/friend-requests/decline', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          requestId: req.id,
          fromId: req.fromId,
          fromCircleCode: req.fromCircleCode
        })
      });
    } catch (err) {
      console.error("API decline error:", err);
    }
  };

  const markCardAsRead = async (cardId: string) => {
    const user = getCurrentUserObj();
    const userId = user?.id || user?._id || 'guest';
    const userCode = user?.circleCode || getUserCircleCode();

    const updatedCards = receivedCards.map(c => c.id === cardId ? { ...c, isRead: true } : c);
    setReceivedCards(updatedCards);
    setUnreadCardsCount(updatedCards.filter(c => !c.isRead).length);

    const keysToUpdate = [
      `user_received_cards_${userId}`,
      `user_received_cards_${userCode}`,
      `app_received_cards_${userId}`,
      `app_received_cards_${userCode}`
    ];

    for (const key of keysToUpdate) {
      try {
        localStorage.setItem(key, JSON.stringify(updatedCards));
      } catch (e) {}
    }

    try {
      await fetch('/api/sweet-cards/mark-read', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({ cardId })
      });
    } catch (e) {}

    window.dispatchEvent(new Event('sweet-cards-updated'));
  };

  const handleSendEncouragement = async (comp: FriendProfile | string, card: EncouragementCard) => {
    const userA = getCurrentUserObj();
    const userAId = userA?.id || userA?._id || 'guest';
    const userACode = userA?.circleCode || getUserCircleCode();
    const userAName = userA?.username || 'Bạn đồng hành';
    const userAAvatar = userA?.avatar || '🌸';

    let targetCode = typeof comp === 'string' ? comp : (comp.circleCode || comp.id);
    let targetUserId = typeof comp === 'string' ? comp : (comp.userId || comp.id);
    let targetName = typeof comp === 'string' ? comp : comp.name;

    if (typeof comp === 'string') {
      const found = companions.find(c => c.name === comp || c.id === comp || c.circleCode === comp);
      if (found) {
        targetCode = found.circleCode || found.id;
        targetUserId = found.userId || found.id;
        targetName = found.name;
      }
    }

    const newSweetCard: SweetCard = {
      id: `card_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      cardTitle: card.title,
      message: card.content,
      emoji: card.emoji || '💌',
      senderName: userAName,
      senderCode: userACode,
      senderUserId: userAId,
      senderAvatar: userAAvatar,
      timestamp: new Date().toLocaleDateString('vi-VN') + ' ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      isRead: false
    };

    // 1. API Post (always)
    try {
      await fetch('/api/sweet-cards', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          targetUserId: targetUserId !== targetCode ? targetUserId : undefined,
          targetCode: targetCode,
          cardTitle: card.title,
          message: card.content,
          emoji: card.emoji || '💌'
        })
      });
    } catch (err) {
      console.error("API send sweet card error:", err);
    }

    // 2. LocalStorage sync to receiver keys
    try {
      const keysToUpdate = [
        `user_received_cards_${targetUserId}`,
        `user_received_cards_${targetCode}`,
        `app_received_cards_${targetUserId}`,
        `app_received_cards_${targetCode}`
      ];

      for (const key of keysToUpdate) {
        const existingRaw = localStorage.getItem(key);
        let targetCards: SweetCard[] = existingRaw ? JSON.parse(existingRaw) : [];
        if (!targetCards.some(c => c.id === newSweetCard.id)) {
          targetCards.unshift(newSweetCard);
          localStorage.setItem(key, JSON.stringify(targetCards));
        }
      }
    } catch (e) {
      console.error("Local storage card sync error:", e);
    }

    window.dispatchEvent(new Event('sweet-cards-updated'));
    triggerCelebration(`Đã gửi tấm thiệp "${card.title}" tới ${targetName} thành công! ✨`, 1);
  };

  const handleReplyHeartCard = async (targetCode: string, targetName: string) => {
    const heartCard: EncouragementCard = {
      id: 'c_reply_heart',
      title: 'Gửi tim đáp lại 💖',
      content: 'Cảm ơn bạn vì tấm thiệp ấm áp! Gửi lại bạn triệu trái tim dịu dàng và năng lượng tích cực.',
      emoji: '💖'
    };

    const targetComp = companions.find(c => c.id === targetCode || c.circleCode === targetCode) || {
      id: targetCode,
      circleCode: targetCode,
      name: targetName || 'Bạn đồng hành',
      avatar: '🌸',
      bio: '',
      favoriteQuote: '',
      streak: 1,
      emotionalCircles: 1,
      treeLevel: 1,
      favoriteEmotion: 'binh_yen' as const
    };

    await handleSendEncouragement(targetComp, heartCard);
    if (activeCardPopup) {
      markCardAsRead(activeCardPopup.id);
    }
    setActiveCardPopup(null);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 text-slate-800" id="connections-module-container">
      
      {/* SUCCESS POPUP REWARD */}
      <AnimatePresence>
        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mb-8 p-6 bg-[#C8F7DC]/30 border border-[#9EE7C0] rounded-3xl relative overflow-hidden shadow-sm flex items-center justify-between"
            id="connection-success-popup"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#C8F7DC] border border-[#9EE7C0] rounded-2xl text-[#124B31]">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#124B31] text-sm">Gieo mầm tích cực thành công 🌱</h3>
                <p className="text-text-minimal/80 text-xs mt-1">{successMsg}</p>
                <div className="flex gap-2 mt-2">
                  {successMsg.includes('⭐') ? (
                    <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2.5 py-0.5 rounded-full shadow-sm">+2 ⭐ Sao Khả Dụng</span>
                  ) : (
                    <span className="text-[10px] bg-[#C8F7DC] text-[#124B31] border border-[#9EE7C0] font-bold px-2.5 py-0.5 rounded-full shadow-sm">+1 Chấm Tròn Cảm Xúc</span>
                  )}
                  <span className="text-[10px] bg-[#E2DBFC] text-[#5B21B6] border border-[#C4B5FD] font-bold px-2.5 py-0.5 rounded-full">+1 Streak Ngày</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setSuccessMsg(null)} 
              className="bg-[#C8F7DC] hover:bg-[#B5F1D0] text-[#124B31] text-xs font-extrabold px-4 py-2 rounded-full shadow-sm cursor-pointer border border-[#9EE7C0]"
            >
              Cảm ơn
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. MAIN FEATURE HUB */}
      {view === 'main' && (
        <div id="connections-main-hub">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
            <button 
              onClick={onBack} 
              className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 transition-colors bg-white/80 backdrop-blur px-4 py-2 rounded-full border border-slate-100 shadow-sm cursor-pointer"
              id="btn-conn-back"
            >
              <span>← Quay lại</span>
            </button>

            <button
              onClick={() => setView('companions_tabs')}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-400 text-white font-bold px-6 py-2.5 rounded-full shadow-sm hover:scale-105 transition-all cursor-pointer relative"
              id="btn-goto-companions"
            >
              <Users className="w-4 h-4" />
              <span>Góc Bạn Đồng Hành ({companions.length})</span>
              {(invites.length > 0 || unreadCardsCount > 0) && (
                <span className="ml-1 bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-extrabold animate-bounce shadow-2xs">
                  🔴 {invites.length + unreadCardsCount}
                </span>
              )}
            </button>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-slate-800">Gia Đình & Bạn Bè</h1>
            <p className="text-slate-500 mt-2">Kết nối sâu sắc với những mối quan hệ thân thương qua những hành động thấu hiểu dịu dàng.</p>
          </div>

          {/* Feature Grid cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6" id="connections-features-grid">
            {/* Unsent Letter Card */}
            <button
              onClick={() => setView('unsent_letter')}
              className="bg-gradient-to-tr from-sky-50 to-white hover:from-sky-100/50 border border-sky-100 rounded-3xl p-6 text-left shadow-sm hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between min-h-[160px]"
              id="btn-goto-unsent-letter"
            >
              <div className="flex items-center justify-between w-full">
                <div className="p-2.5 bg-sky-500 text-white rounded-2xl">
                  <Mail className="w-5 h-5" />
                </div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tâm tư giấu kín</span>
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-base mt-4">💌 Hộp thư chưa gửi</h3>
                <p className="text-slate-500 text-xs mt-1">Viết ra những tâm sự chưa từng can đảm thổ lộ. Đôi khi viết ra cũng đã là một cách xoa dịu lành mạnh.</p>
              </div>
            </button>

            {/* Connection Challenges */}
            <button
              onClick={() => setView('connect_challenges')}
              className="bg-white hover:bg-[#C8F7DC]/20 border border-[#9EE7C0] rounded-3xl p-6 text-left shadow-sm hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between min-h-[160px]"
              id="btn-goto-challenges"
            >
              <div className="flex items-center justify-between w-full">
                <div className="p-2.5 bg-[#C8F7DC] border border-[#9EE7C0] text-[#124B31] rounded-2xl">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cùng nhau vun đắp</span>
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-base mt-4">🌱 Thử thách kết nối</h3>
                <p className="text-slate-500 text-xs mt-1">Mỗi ngày một thử thách nhỏ để hâm nóng tình cảm gia đình, bạn bè và ngắm nhìn cây nhân duyên nở hoa.</p>
              </div>
            </button>

            {/* Gentle Lessons */}
            <button
              onClick={() => setView('lessons')}
              className="bg-gradient-to-tr from-purple-50 to-white hover:from-purple-100/50 border border-purple-100 rounded-3xl p-6 text-left shadow-sm hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between min-h-[160px]"
              id="btn-goto-lessons"
            >
              <div className="flex items-center justify-between w-full">
                <div className="p-2.5 bg-purple-500 text-white rounded-2xl">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Hạt mầm tri thức</span>
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-base mt-4">🌸 Những bài học dịu dàng</h3>
                <p className="text-slate-500 text-xs mt-1">Học cách lắng nghe, chấp nhận sự khác biệt và xoa dịu những rạn nứt giao tiếp không đáng có hằng ngày.</p>
              </div>
            </button>

            {/* Gratitude Note */}
            <button
              onClick={() => setView('gratitude_note')}
              className="bg-gradient-to-tr from-peach-50/70 to-white hover:from-orange-100/30 border border-orange-100 rounded-3xl p-6 text-left shadow-sm hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between min-h-[160px]"
              id="btn-goto-gratitude"
            >
              <div className="flex items-center justify-between w-full">
                <div className="p-2.5 bg-orange-500 text-white rounded-2xl">
                  <Heart className="w-5 h-5" />
                </div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Biết ơn cuộc sống</span>
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-base mt-4">🌼 Lời cảm ơn hôm nay</h3>
                <p className="text-slate-500 text-xs mt-1">Bày tỏ lòng tri ân mộc mạc tới một người bạn trân quý trong ngày hôm nay. Đơm hoa kết trái niềm vui lành mạnh.</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* 2. UNSENT LETTER WRITING TAB */}
      {view === 'unsent_letter' && (
        <div className="bg-white border border-slate-100 p-8 rounded-[30px] shadow-sm" id="unsent-letter-view">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
              <Mail className="w-5 h-5 text-sky-500" /> Hộp Thư Chưa Gửi 💌
            </h2>
            <button 
              onClick={() => setIsLetterFavorite(!isLetterFavorite)}
              className="p-2 text-rose-500 hover:bg-rose-50 rounded-full transition-colors cursor-pointer"
            >
              <Star className={`w-5 h-5 ${isLetterFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              {/* Prompt selection */}
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {['Mình muốn nói với...', 'Nếu hôm nay đủ can đảm...', 'Điều mình chưa từng nói...'].map(pr => (
                  <button
                    key={pr}
                    onClick={() => { setLetterPrompt(pr); setLetterText(pr + ' '); }}
                    className={`px-3 py-1.5 rounded-full border text-[11px] font-bold cursor-pointer transition-all whitespace-nowrap ${
                      letterPrompt === pr 
                        ? 'bg-sky-100 border-sky-300 text-sky-800' 
                        : 'bg-slate-50 border-slate-100 text-slate-500'
                    }`}
                  >
                    {pr}
                  </button>
                ))}
              </div>

              {/* Textarea */}
              <textarea
                placeholder="Viết bức thư tay giấu kín dành tặng người bạn trân trọng nhất..."
                value={letterText}
                onChange={(e) => setLetterText(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl p-4 text-xs h-60 focus:outline-none focus:ring-1 focus:ring-sky-400 resize-none text-slate-700"
                id="unsent-letter-textarea"
              />

              <div className="flex gap-2.5 mt-4 justify-end">
                <button 
                  onClick={() => setView('main')} 
                  className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-full cursor-pointer"
                >
                  Quay lại
                </button>
                <button 
                  onClick={saveLetterDraft}
                  className="px-8 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-full shadow-md shadow-sky-100 cursor-pointer"
                  id="btn-letter-save"
                >
                  Lưu kín trong hộp bảo mật
                </button>
              </div>
            </div>

            {/* Draft lists or healing quotes */}
            <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl flex flex-col justify-between">
              <div>
                <h4 className="font-extrabold text-slate-700 text-xs mb-3 flex items-center gap-1">🔒 Hòm thư bảo mật ({letterDrafts.length})</h4>
                <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto">
                  {letterDrafts.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic">Chưa có bức thư giấu kín nào được cất giữ ở đây.</p>
                  ) : (
                    letterDrafts.map((dr, index) => (
                      <div key={index} className="bg-white border border-slate-100 p-2.5 rounded-xl text-[10px] text-slate-600 italic line-clamp-2">
                        "{dr}"
                      </div>
                    ))
                  )}
                </div>
              </div>

              <p className="text-[9px] text-slate-400 italic mt-6 leading-relaxed">
                "Đôi khi, việc viết ra suy nghĩ thành những dòng văn chỉn chu chính là bước đối diện đầu tiên giúp bạn sưởi ấm vết thương lòng của mình."
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. CONNECT CHALLENGES TAB */}
      {view === 'connect_challenges' && (
        <div className="bg-white border border-slate-100 p-8 rounded-[30px] shadow-sm" id="connect-challenges-view">
          <h2 className="text-xl font-extrabold text-slate-800 mb-2 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-500" /> Thử Thách Kết Nối Hằng Ngày 🌱
          </h2>
          <p className="text-slate-500 text-sm mb-6">Mỗi hành động ngọt ngào quan tâm ngày hôm nay giúp trồng thêm một nhành lá cho cây nhân duyên hạnh phúc.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* List of Challenges */}
            <div className="md:col-span-2 space-y-3">
              {challenges.map((ch) => (
                <div 
                  key={ch.id}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                    ch.isCompleted 
                      ? 'bg-[#C8F7DC]/30 border-[#9EE7C0]' 
                      : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => toggleChallenge(ch.id)}
                      className={`p-1.5 rounded-full border transition-all cursor-pointer ${
                        ch.isCompleted ? 'bg-[#C8F7DC] text-[#124B31] border-[#9EE7C0]' : 'bg-slate-50 border-slate-200 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <span className={`text-xs font-semibold ${ch.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{ch.title}</span>
                  </div>

                  <button
                    onClick={() => toggleChallenge(ch.id)}
                    className="text-[10px] text-slate-400 hover:text-[#124B31] font-bold"
                  >
                    {ch.isCompleted ? 'Thực hiện lại' : 'Đánh dấu xong'}
                  </button>
                </div>
              ))}
            </div>

            {/* Tree Growth visualization */}
            <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl text-center flex flex-col items-center justify-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">CÂY NHÂN DUYÊN</span>
              <div className="relative w-32 h-32 flex items-center justify-center bg-white rounded-full border border-slate-200/50 mb-4 shadow-inner">
                <span className="text-6xl animate-pulse">🌳</span>
                <span className="absolute -bottom-1 bg-[#C8F7DC] text-[#124B31] border border-[#9EE7C0] text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                  Cấp độ: {relationshipTreeLevel}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed max-w-[180px]">Mỗi thử thách kết nối bạn hoàn thành sẽ giúp tích lũy dinh dưỡng nuôi nấng cây quan hệ đơm hoa thơm quả ngọt.</p>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 mt-8 border-t border-slate-100 pt-6">
            <button 
              onClick={() => setView('main')} 
              className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-full cursor-pointer"
            >
              Quay lại
            </button>
          </div>
        </div>
      )}

      {/* 4. GENTLE LESSONS READING TAB */}
      {view === 'lessons' && (
        <div id="gentle-lessons-view">
          {!selectedLesson ? (
            <div className="bg-white border border-slate-100 p-8 rounded-[30px] shadow-sm">
              <h2 className="text-xl font-extrabold text-slate-800 mb-2 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-500" /> Thư Viện Những Bài Học Dịu Dàng 📖
              </h2>
              <p className="text-slate-500 text-sm mb-6">Trang bị ranh giới cá nhân lành mạnh và học cách biểu lộ sự thấu hiểu chân thành với những người xung quanh.</p>

              {/* Categories Navigation */}
              <div className="flex gap-2.5 overflow-x-auto pb-4 mb-6">
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: 'hieu_chinh_minh', label: '🤍 Hiểu chính mình' },
                  { id: 'gia_dinh', label: '👨‍👩‍👧 Gia đình' },
                  { id: 'ban_be', label: '🌻 Bạn bè' },
                  { id: 'giao_tiep', label: '🌿 Giao tiếp' },
                  { id: 'chua_lanh', label: '🌸 Chữa lành' }
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id as any)}
                    className={`px-4 py-2 rounded-full border text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${
                      selectedCategory === cat.id 
                        ? 'bg-purple-500 text-white border-purple-500 shadow-sm' 
                        : 'bg-slate-50 text-slate-600 border-slate-100 hover:border-slate-300'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Grid lists of lessons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {GENTLE_LESSONS
                  .filter(l => selectedCategory === 'all' || l.category === selectedCategory)
                  .map((lesson) => {
                    const isFav = favoriteLessonIds.includes(lesson.id);
                    const isCompleted = completedLessonIds.includes(lesson.id);
                    return (
                      <div 
                        key={lesson.id}
                        className="bg-slate-50 hover:bg-white border border-slate-100 hover:border-purple-200 p-5 rounded-2xl flex flex-col justify-between transition-all hover:shadow-sm"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] text-purple-500 font-bold uppercase tracking-wider">
                              {lesson.category === 'hieu_chinh_minh' ? 'Hiểu chính mình' : lesson.category === 'gia_dinh' ? 'Gia đình' : 'Chữa lành'}
                            </span>
                            <span className="text-[9px] text-slate-400 font-medium">{lesson.readingTime} đọc</span>
                          </div>
                          <h4 className="font-extrabold text-slate-700 text-xs mb-2 line-clamp-1">{lesson.title}</h4>
                          <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{lesson.intro}</p>
                        </div>

                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200/40">
                          <button
                            onClick={() => toggleLessonFav(lesson.id)}
                            className="text-slate-300 hover:text-rose-500 transition-colors"
                          >
                            <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : ''}`} />
                          </button>
                          
                          <button
                            onClick={() => setSelectedLesson(lesson)}
                            className="bg-purple-500 hover:bg-purple-600 text-white text-[10px] font-bold px-4 py-1.5 rounded-full cursor-pointer"
                          >
                            Đọc bài học
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="flex justify-end gap-2 mt-8 pt-4 border-t border-slate-100">
                <button onClick={() => setView('main')} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-full">Quay lại</button>
              </div>
            </div>
          ) : (
            /* ACTIVE LESSON VIEW CONTAINER */
            <div className="bg-white border border-slate-100 p-8 rounded-[30px] shadow-sm max-w-2xl mx-auto" id="lesson-detail-reading-view">
              <button 
                onClick={() => setSelectedLesson(null)}
                className="text-slate-400 hover:text-purple-500 text-xs font-semibold mb-6 flex items-center gap-1 cursor-pointer"
              >
                <span>← Trở lại thư viện bài học</span>
              </button>

              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] text-purple-600 bg-purple-50 px-3 py-0.5 border border-purple-100 rounded-full font-bold uppercase tracking-wider">{selectedLesson.category}</span>
                <span className="text-xs text-slate-400 font-bold">Thời gian đọc: {selectedLesson.readingTime}</span>
              </div>

              <h2 className="text-2xl font-extrabold text-slate-800 mb-6">{selectedLesson.title}</h2>

              <div className="space-y-6 text-xs text-slate-600 leading-relaxed">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm mb-1.5">🌟 Giới thiệu nhẹ nhàng</h4>
                  <p className="bg-slate-50 p-4 rounded-2xl italic">"{selectedLesson.intro}"</p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 text-sm mb-1.5">💡 Tìm hiểu thấu cảm</h4>
                  <p>{selectedLesson.explanation}</p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 text-sm mb-1.5">🏡 Câu chuyện cuộc sống</h4>
                  <p className="bg-purple-50/40 p-4 rounded-2xl border border-purple-100/50">{selectedLesson.example}</p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 text-sm mb-1.5">🌱 Một điều nhỏ bạn có thể làm hôm nay</h4>
                  <p className="font-semibold text-purple-700 bg-purple-50 p-4 rounded-2xl">{selectedLesson.action}</p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 text-sm mb-1.5">☁️ Mang theo hôm nay</h4>
                  <p className="italic font-medium text-slate-500">"{selectedLesson.takeaway}"</p>
                </div>
              </div>

              <div className="flex justify-between items-center mt-10 pt-6 border-t border-slate-100">
                <button
                  onClick={() => toggleLessonFav(selectedLesson.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 border rounded-full text-xs font-bold cursor-pointer ${
                    favoriteLessonIds.includes(selectedLesson.id) 
                      ? 'bg-rose-50 text-rose-500 border-rose-200' 
                      : 'bg-slate-50 border-slate-100 text-slate-500'
                  }`}
                >
                  <Heart className="w-4 h-4" />
                  <span>Yêu thích</span>
                </button>

                <button
                  onClick={() => {
                    markLessonCompleted(selectedLesson.id);
                    setSelectedLesson(null);
                  }}
                  className="bg-purple-500 hover:bg-purple-600 text-white font-bold text-xs px-6 py-2.5 rounded-full shadow-md shadow-purple-100 cursor-pointer"
                >
                  Đánh dấu hoàn thành bài học
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. GRATITUDE NOTE */}
      {view === 'gratitude_note' && (
        <div className="bg-white border border-slate-100 p-8 rounded-[30px] shadow-sm max-w-xl mx-auto text-center" id="gratitude-note-writing-view">
          <span className="text-6xl mb-4 inline-block animate-bounce">🌼</span>
          <h2 className="text-xl font-extrabold text-slate-800 mb-1">Lời Cảm Ơn Hôm Nay</h2>
          <p className="text-slate-500 text-sm mb-6">Đơm hoa kết trái lòng biết ơn bằng cách viết ra một lời tri ân ngọt ngào hôm nay.</p>

          <textarea
            placeholder="Hôm nay bạn trân trọng sự giúp đỡ, nụ cười hay sự ấm áp của ai? Hãy ghi lại đây nhé..."
            value={todayGratitude}
            onChange={(e) => setTodayGratitude(e.target.value)}
            className="w-full bg-slate-50 p-4 rounded-2xl text-xs h-36 border-none focus:ring-1 focus:ring-orange-400 focus:outline-none resize-none text-slate-600"
            id="gratitude-note-textarea"
          />

          <div className="flex gap-2.5 justify-center mt-6">
            <button onClick={() => setView('main')} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-full">Quay lại</button>
            <button 
              onClick={saveTodayGratitude}
              className="px-8 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-full shadow-md shadow-orange-100 cursor-pointer"
              id="btn-gratitude-save"
            >
              Gieo hạt biết ơn
            </button>
          </div>
        </div>
      )}

      {/* 6. COMPANIONS TABS SECTION */}
      {view === 'companions_tabs' && (
        <div className="bg-white border border-slate-100 p-8 rounded-[30px] shadow-sm" id="companions-corner-tabs">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
            <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-500" /> Bạn Đồng Hành Sưởi Ấm Tâm Hồn
            </h2>

            <button 
              onClick={() => setView('main')}
              className="text-xs text-slate-400 hover:text-emerald-500 font-bold border border-slate-100 px-3.5 py-1.5 rounded-full"
            >
              Quay lại sảnh kết nối
            </button>
          </div>

          {/* Sub Navigation tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-100 mb-6">
            {[
              { id: 'challenges', label: '📝 Thử thách chung' },
              { id: 'search', label: '👥 Tìm bạn đồng hành' },
              { id: 'invites', label: '📨 Lời mời gửi đến' },
              { id: 'companions', label: '🌟 Bạn thân đồng hành' },
              { id: 'cards_mailbox', label: '💌 Hộp thư Tấm thiệp' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCompanionTab(tab.id as any)}
                className={`px-4 py-2 text-xs font-bold rounded-2xl cursor-pointer transition-all flex items-center gap-1.5 ${
                  companionTab === tab.id 
                    ? 'bg-emerald-50 text-emerald-700 border-none font-bold shadow-2xs' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                id={`btn-companion-tab-${tab.id}`}
              >
                <span>{tab.label}</span>
                {tab.id === 'invites' && invites.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-rose-500 text-white font-extrabold text-[10px] rounded-full animate-pulse shadow-2xs">
                    🔴 {invites.length}
                  </span>
                )}
                {tab.id === 'cards_mailbox' && unreadCardsCount > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-rose-500 text-white font-extrabold text-[10px] rounded-full animate-pulse shadow-2xs">
                    🔴 {unreadCardsCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab 1: Challenges joint */}
          {companionTab === 'challenges' && (() => {
            const activeCompanion = getActiveCompanion();
            const companionName = activeCompanion ? activeCompanion.name : 'Bạn đồng hành';
            const companionAvatar = activeCompanion ? activeCompanion.avatar || '🌸' : '🌸';
            const companionCode = activeCompanion ? activeCompanion.circleCode || 'Đồng hành' : 'Chưa kết nối';

            const myCompletedCount = pairChallenges.filter(p => p.myCompleted).length;
            const companionCompletedCount = pairChallenges.filter(p => p.companionCompleted).length;
            const bothCompletedCount = pairChallenges.filter(p => p.complete || (p.myCompleted && p.companionCompleted)).length;
            const totalCount = pairChallenges.length;
            const totalPairStars = (myCompletedCount + companionCompletedCount) * 2;

            return (
              <div className="space-y-6">
                {/* 1. COMPREHENSIVE PAIR TRACKING DASHBOARD (BẢNG THEO DÕI SONG HÀNH) */}
                <div className="bg-gradient-to-br from-white via-[#F4FDF8] to-[#FFFBEB] border-2 border-[#9EE7C0] rounded-3xl p-5 sm:p-6 shadow-sm" id="pair-challenges-dashboard-card">
                  {/* Dashboard Header */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-emerald-100/80">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center text-lg shadow-sm flex-shrink-0">
                        📊
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-extrabold text-slate-800 text-sm sm:text-base flex items-center gap-1.5">
                            <span>Bảng Theo Dõi Tiến Độ Song Hành Hôm Nay</span>
                          </h3>
                          <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold rounded-full flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-emerald-600" />
                            <span>Tự động làm mới 00:00</span>
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Theo dõi chi tiết xem bạn và người đồng hành đã hoàn thành những bài nào trong ngày. Hệ thống sẽ tự động đưa về "Chưa làm" vào mỗi ngày mới.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
                      <button
                        onClick={handleManualResetToday}
                        title="Làm mới lại tất cả nhiệm vụ hôm nay về trạng thái chưa làm"
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-100 active:scale-95 text-slate-700 border border-slate-200 hover:border-emerald-300 font-bold text-xs rounded-full flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                        id="btn-reset-pair-challenges-today"
                      >
                        <RotateCcw className="w-3 h-3 text-emerald-600" />
                        <span>Làm mới hôm nay</span>
                      </button>
                      <span className="px-3 py-1 bg-amber-100 border border-amber-300 text-amber-900 font-extrabold text-xs rounded-full flex items-center gap-1 shadow-2xs">
                        <span>⭐</span>
                        <span>Đã tích lũy: +{totalPairStars} ⭐</span>
                      </span>
                      <span className="px-3 py-1 bg-emerald-100 border border-emerald-300 text-emerald-900 font-extrabold text-xs rounded-full flex items-center gap-1 shadow-2xs">
                        <span>🌱</span>
                        <span>Cả đôi: {bothCompletedCount}/{totalCount} trọn vẹn</span>
                      </span>
                    </div>
                  </div>

                  {/* COMPANION SELECTOR BAR (CHỖ CHỌN NGƯỜI ĐỂ LÀM THỬ THÁCH CHUNG) */}
                  <div className="my-4 p-4 rounded-2xl bg-white/95 border-2 border-emerald-200/90 shadow-2xs space-y-3" id="companion-challenge-selector-container">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🤝</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm">
                              Chọn người bạn đồng hành cùng làm thử thách
                            </h4>
                            {activeCompanion && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[10px] font-black border border-emerald-300 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                <span>Đang cùng: {activeCompanion.avatar || '🌸'} {activeCompanion.name}</span>
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Chọn một người bạn từ danh sách kết nối để cùng làm nhiệm vụ, đồng bộ tiến độ và nhận sao đôi hôm nay.
                          </p>
                        </div>
                      </div>

                      {companions.length > 0 && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 self-start sm:self-auto flex items-center gap-1">
                          <Users className="w-3 h-3 text-emerald-600" />
                          <span>{companions.length} bạn trong danh bạ</span>
                        </span>
                      )}
                    </div>

                    {/* Companion Choices List */}
                    {companions.length > 0 ? (
                      <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-1 scrollbar-thin">
                        {companions.map((comp) => {
                          const isSelected = (activeCompanion?.id === comp.id) || (activeCompanion?.circleCode === comp.circleCode);
                          return (
                            <button
                              key={comp.id || comp.circleCode}
                              type="button"
                              onClick={() => handleSelectCompanion(comp)}
                              className={`px-3.5 py-2.5 rounded-2xl border-2 transition-all flex items-center gap-2.5 flex-shrink-0 cursor-pointer text-left ${
                                isSelected
                                  ? 'bg-gradient-to-r from-emerald-50 via-teal-50/60 to-white border-emerald-500 shadow-sm ring-2 ring-emerald-300/70'
                                  : 'bg-slate-50/90 hover:bg-white border-slate-200 hover:border-emerald-300 text-slate-700'
                              }`}
                              id={`btn-select-companion-${comp.id || comp.circleCode}`}
                              title={`Chọn ${comp.name} để cùng làm thử thách đôi`}
                            >
                              <div className={`w-9 h-9 rounded-xl border text-lg flex items-center justify-center shadow-2xs flex-shrink-0 ${
                                isSelected ? 'bg-white border-emerald-300' : 'bg-white border-slate-200'
                              }`}>
                                {comp.avatar || '🌸'}
                              </div>
                              <div className="min-w-0 pr-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-xs font-black truncate ${isSelected ? 'text-emerald-950' : 'text-slate-800'}`}>
                                    {comp.name}
                                  </span>
                                  {isSelected && (
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                  <span>Mã: {comp.circleCode || comp.id}</span>
                                  {comp.streak ? <span>• 🔥 {comp.streak} ngày</span> : null}
                                </div>
                              </div>
                              {isSelected ? (
                                <span className="ml-1 text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-0.5 border border-emerald-300">
                                  <Check className="w-3 h-3 text-emerald-700" />
                                  <span>Đang chọn</span>
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                                  Chọn
                                </span>
                              )}
                            </button>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => setCompanionTab('search')}
                          className="px-3.5 py-2.5 rounded-2xl border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center gap-1.5 flex-shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95"
                          title="Tìm thêm bạn đồng hành mới qua mã"
                        >
                          <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                          <span>+ Tìm bạn mới</span>
                        </button>
                      </div>
                    ) : (
                      /* When user has no companions yet */
                      <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-start sm:items-center gap-2.5 text-amber-900">
                          <span className="text-xl flex-shrink-0">💡</span>
                          <div>
                            <span className="font-extrabold text-xs">Bạn chưa có Bạn đồng hành nào trong danh sách.</span>
                            <p className="text-[11px] text-amber-800/80 mt-0.5">
                              Hãy dùng Mã Chấm Tròn để tìm bạn hoặc bấm chọn bạn mẫu dưới đây để bắt đầu trải nghiệm thử thách song hành ngay!
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={handleAddSampleCompanion}
                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-xs shadow-2xs transition-all cursor-pointer active:scale-95"
                            id="btn-add-sample-companion"
                          >
                            🌸 Chọn bạn mẫu (Bảo Trân)
                          </button>
                          <button
                            type="button"
                            onClick={() => setCompanionTab('search')}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer active:scale-95 flex items-center gap-1"
                          >
                            <Search className="w-3 h-3" />
                            <span>Tìm bạn</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Two Columns: Me vs Companion Tracking Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                    {/* LEFT COLUMN: ME (TÔI) */}
                    <div className="bg-white/90 border border-emerald-200/90 rounded-2xl p-4 shadow-2xs space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 text-xl flex items-center justify-center shadow-2xs">
                            {getCurrentUserObj()?.avatar || '🌱'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-slate-800 text-xs sm:text-sm">
                                {getCurrentUserObj()?.name || 'Tôi (Bạn)'}
                              </span>
                              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded">
                                Bạn
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium">
                              Mã: {getCurrentUserObj()?.circleCode || getUserCircleCode()}
                            </span>
                          </div>
                        </div>

                        {/* Overall badge for Me */}
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-black border flex items-center gap-1 shadow-2xs ${
                          myCompletedCount === totalCount
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : myCompletedCount > 0
                            ? 'bg-sky-100 text-sky-900 border-sky-300'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {myCompletedCount === totalCount ? '✓ Đã xong 3/3' : myCompletedCount > 0 ? `Đã làm ${myCompletedCount}/3` : 'Chưa làm 0/3'}
                        </span>
                      </div>

                      {/* Checklist Breakdown for Me */}
                      <div className="space-y-2 pt-1 border-t border-slate-100">
                        {pairChallenges.map((p) => {
                          const icon = p.id === 'pc1' ? '📖' : p.id === 'pc2' ? '🎧' : '🌬️';
                          return (
                            <div 
                              key={`me-${p.id}`}
                              className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                                p.myCompleted 
                                  ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950 font-bold' 
                                  : 'bg-slate-50/70 border-slate-200 text-slate-600'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span>{icon}</span>
                                <span className="truncate">{p.title}</span>
                              </div>
                              {p.myCompleted ? (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-200/80 text-emerald-900 text-[10px] font-black flex items-center gap-1 flex-shrink-0">
                                  <Check className="w-3 h-3 text-emerald-700" />
                                  <span>Đã xong (+2⭐)</span>
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleOpenChallengeModal(p)}
                                  className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer transition-all flex-shrink-0"
                                >
                                  Làm ngay
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* RIGHT COLUMN: COMPANION (BẠN ĐỒNG HÀNH) */}
                    <div className="bg-white/90 border border-amber-200/90 rounded-2xl p-4 shadow-2xs space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 text-xl flex items-center justify-center shadow-2xs">
                            {companionAvatar}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-slate-800 text-xs sm:text-sm">
                                {companionName}
                              </span>
                              <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[9px] font-bold rounded">
                                Đồng hành
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium">
                              Mã: {companionCode}
                            </span>
                          </div>
                        </div>

                        {/* Overall badge for Companion */}
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-black border flex items-center gap-1 shadow-2xs ${
                          companionCompletedCount === totalCount
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : companionCompletedCount > 0
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {companionCompletedCount === totalCount ? '✓ Đã xong 3/3' : companionCompletedCount > 0 ? `Đã làm ${companionCompletedCount}/3` : 'Đang chờ 0/3'}
                        </span>
                      </div>

                      {/* Checklist Breakdown for Companion */}
                      <div className="space-y-2 pt-1 border-t border-slate-100">
                        {pairChallenges.map((p) => {
                          const icon = p.id === 'pc1' ? '📖' : p.id === 'pc2' ? '🎧' : '🌬️';
                          return (
                            <div 
                              key={`comp-${p.id}`}
                              className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                                p.companionCompleted 
                                  ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950 font-bold' 
                                  : 'bg-amber-50/40 border-amber-200/70 text-slate-600'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span>{icon}</span>
                                <span className="truncate">{p.title}</span>
                              </div>
                              {p.companionCompleted ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleCompanionPartOfChallenge(p.id)}
                                  title="Bấm để chuyển lại trạng thái nếu cần"
                                  className="px-2 py-0.5 rounded-md bg-emerald-200/80 hover:bg-emerald-300 text-emerald-900 text-[10px] font-black flex items-center gap-1 flex-shrink-0 cursor-pointer transition-colors"
                                >
                                  <Check className="w-3 h-3 text-emerald-700" />
                                  <span>Đã xong (+2⭐)</span>
                                </button>
                              ) : (
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleCompanionPartOfChallenge(p.id)}
                                    title={`Bấm để ghi nhận khi ${companionName} đã hoàn thành`}
                                    className="px-2 py-0.5 rounded-md bg-amber-100 hover:bg-emerald-100 text-amber-900 hover:text-emerald-900 text-[10px] font-bold flex items-center gap-1 border border-amber-300 hover:border-emerald-300 cursor-pointer transition-all active:scale-95"
                                  >
                                    <Clock className="w-2.5 h-2.5" />
                                    <span>Ghi nhận xong</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Summary Status Banner & Encouragement Action */}
                  <div className="mt-4 pt-3.5 border-t border-emerald-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-slate-600">
                      {bothCompletedCount === totalCount ? (
                        <span className="font-extrabold text-emerald-700 flex items-center gap-1.5">
                          <span>🎉</span>
                          <span>Tuyệt vời! Cả 2 bạn đã hoàn thành trọn vẹn tất cả thử thách hôm nay!</span>
                        </span>
                      ) : myCompletedCount === totalCount ? (
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                          <span>✨</span>
                          <span>Bạn đã làm xong phần của mình! Hãy gửi lời nhắn khích lệ {companionName}.</span>
                        </span>
                      ) : companionCompletedCount > myCompletedCount ? (
                        <span className="font-bold text-amber-800 flex items-center gap-1.5">
                          <span>🔔</span>
                          <span>{companionName} đã hoàn thành bài trước, hãy nhanh chóng tham gia nhé!</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 flex items-center gap-1.5">
                          <span>🌱</span>
                          <span>Cùng nhau thực hiện để tích lũy thêm sao và hâm nóng tình cảm bạn bè nhé.</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setCompanionTab('cards_mailbox');
                          setSuccessMsg(`Bạn có thể gửi một tấm thiệp ấm áp để nhắc nhở và khích lệ ${companionName} 💌`);
                        }}
                        className="px-4 py-2 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-extrabold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                      >
                        <Heart className="w-3.5 h-3.5 fill-white" />
                        <span>Gửi Lời Nhắc / Thiệp Động Viên 💌</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. DETAILED PAIR CHALLENGES LIST CARDS */}
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
                      <span>Danh Sách 3 Thử Thách Ghép Đôi Hôm Nay</span>
                    </h4>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Nhận +2 ⭐ Sao Khả Dụng / bài
                    </span>
                  </div>

                  {pairChallenges.map((joint) => {
                    const isFullyCompleted = joint.complete || (joint.myCompleted && joint.companionCompleted);
                    const icon = joint.id === 'pc1' ? '📖' : joint.id === 'pc2' ? '🎧' : '🌬️';

                    return (
                      <div 
                        key={joint.id} 
                        className={`p-4 sm:p-5 rounded-3xl border-2 transition-all ${
                          isFullyCompleted 
                            ? 'bg-gradient-to-r from-emerald-50/50 via-amber-50/30 to-white border-emerald-300 shadow-2xs' 
                            : 'bg-white border-slate-100 hover:border-emerald-200 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          {/* Title & Reward */}
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2.5">
                              <span className="text-2xl">{icon}</span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-extrabold text-slate-800 text-sm sm:text-base">
                                    {joint.title}
                                  </h4>
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black rounded-full flex items-center gap-0.5">
                                    <span>+2</span>
                                    <span>⭐</span>
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  {joint.id === 'pc1' 
                                    ? 'Cùng viết vài dòng cảm xúc thật chân thành để lưu giữ khoảnh khắc.' 
                                    : joint.id === 'pc2' 
                                    ? 'Lắng nghe video/podcast chữa lành do Admin chọn lọc cho ngày hôm nay.' 
                                    : 'Thực hành nhịp thở 4-4-4 thư giãn sâu để tái tạo năng lượng.'}
                                </p>
                              </div>
                            </div>

                            {/* Live Two-Player Status Badges */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              {/* Player 1: Me */}
                              <div className={`px-3 py-2 rounded-xl border flex items-center justify-between text-xs ${
                                joint.myCompleted 
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950 font-extrabold' 
                                  : 'bg-slate-50 border-slate-200 text-slate-600'
                              }`}>
                                <div className="flex items-center gap-1.5">
                                  <span>👤</span>
                                  <span>Bạn:</span>
                                </div>
                                {joint.myCompleted ? (
                                  <span className="text-emerald-700 bg-emerald-100/90 font-black px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                                    <Check className="w-3 h-3 text-emerald-700" />
                                    <span>Đã hoàn thành (+2 ⭐)</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400 bg-white border border-slate-200 font-bold px-2 py-0.5 rounded text-[10px]">
                                    Chưa thực hiện
                                  </span>
                                )}
                              </div>

                              {/* Player 2: Companion */}
                              <div className={`px-3 py-2 rounded-xl border flex items-center justify-between text-xs ${
                                joint.companionCompleted 
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950 font-extrabold' 
                                  : 'bg-amber-50/60 border-amber-200 text-amber-950'
                              }`}>
                                <div className="flex items-center gap-1.5 truncate">
                                  <span>👥</span>
                                  <span className="truncate">{companionName}:</span>
                                </div>
                                {joint.companionCompleted ? (
                                  <span className="text-emerald-700 bg-emerald-100/90 font-black px-2 py-0.5 rounded text-[10px] flex items-center gap-1 flex-shrink-0">
                                    <Check className="w-3 h-3 text-emerald-700" />
                                    <span>Đã hoàn thành</span>
                                  </span>
                                ) : (
                                  <span className="text-amber-800 bg-amber-100/80 font-bold px-2 py-0.5 rounded text-[10px] flex items-center gap-1 flex-shrink-0">
                                    <Clock className="w-2.5 h-2.5" />
                                    <span>Chưa làm / Đang chờ</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0">
                            {isFullyCompleted ? (
                              <div className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black shadow-2xs">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span>Cả 2 Đã Xong (+2 ⭐)</span>
                              </div>
                            ) : (
                              <button 
                                onClick={() => handleOpenChallengeModal(joint)}
                                className={`px-5 py-2.5 rounded-2xl text-xs font-extrabold cursor-pointer shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                                  joint.myCompleted 
                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200' 
                                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-200'
                                }`}
                                id={`btn-pair-challenge-${joint.id}`}
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>{joint.myCompleted ? 'Xem lại & Tiến độ' : 'Thực hiện ngay'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Tab 2: Searching companion friends */}
          {companionTab === 'search' && (
            <div>
              <div className="flex gap-2 bg-slate-50 border border-slate-100 p-2.5 rounded-2xl max-w-md mb-6 shadow-2xs">
                <Search className="w-4 h-4 text-slate-400 self-center" />
                <input 
                  type="text" 
                  placeholder="Nhập Mã Chấm Tròn (Ví dụ: CT_1234)..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="bg-transparent text-xs w-full focus:outline-none text-slate-700 font-medium"
                />
                <button 
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="bg-[#C8F7DC] hover:bg-[#B5F1D0] text-[#124B31] border border-[#9EE7C0] text-xs px-4 py-1.5 rounded-xl font-extrabold cursor-pointer transition-all shadow-2xs flex-shrink-0"
                >
                  {isSearching ? 'Đang tìm...' : 'Tìm kiếm'}
                </button>
              </div>

              {!hasSearched ? (
                <div className="text-center py-8 bg-slate-50/50 border border-slate-100 rounded-3xl p-6">
                  <span className="text-5xl inline-block mb-3">🌸</span>
                  <h4 className="font-bold text-slate-700 text-sm">Tìm bạn bằng Mã Chấm Tròn</h4>
                  <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
                    Hãy tìm kiếm bạn bè bằng Mã Chấm Tròn độc quyền để cùng gắn kết và hỗ trợ tinh thần cho nhau.
                  </p>
                  
                  {/* Share code */}
                  <div className="mt-6 flex flex-col sm:flex-row justify-center gap-2 max-w-sm mx-auto">
                    <button 
                      onClick={handleCopyMyCode} 
                      className="bg-white hover:bg-slate-100 border border-slate-200 text-[#1E3A5F] text-[11px] font-bold px-3.5 py-2 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#1E3A5F]" />
                      <span>{myCodeCopied ? 'Đã sao chép! ✨' : `Sao chép Mã của tôi (${getUserCircleCode()})`}</span>
                    </button>
                  </div>
                </div>
              ) : isSearching ? (
                <div className="text-center py-8">
                  <span className="text-3xl animate-bounce inline-block">✨</span>
                  <p className="text-xs text-slate-500 mt-2">Đang tìm kiếm Bạn đồng hành...</p>
                </div>
              ) : searchError ? (
                <div className="text-center py-10 px-6 bg-slate-50 border border-slate-200/60 rounded-3xl max-w-md mx-auto shadow-2xs">
                  <span className="text-4xl mb-3 inline-block">🌱</span>
                  <p className="text-slate-600 text-xs font-semibold leading-relaxed">{searchError}</p>
                </div>
              ) : searchResult ? (
                /* Search results */
                <div>
                  <h4 className="text-xs font-bold text-slate-600 mb-3">Kết quả tìm kiếm</h4>
                  <div className="bg-white border border-[#AFDCF1] p-4 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between max-w-md shadow-2xs gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-[#AFDCF1]/30 border border-[#8BC5E3] rounded-2xl flex items-center justify-center text-3xl shadow-2xs flex-shrink-0">
                        {searchResult.avatar}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-xs">{searchResult.name}</h4>
                        <span className="text-[10px] text-slate-400 font-semibold block">Mã: {searchResult.id} • Duy trì: {searchResult.streak} ngày</span>
                        <p className="text-[10px] text-slate-500 italic mt-0.5 max-w-xs">"{searchResult.bio}"</p>
                      </div>
                    </div>

                    <div className="flex gap-1.5 w-full sm:w-auto justify-end">
                      <button 
                        onClick={() => setSelectedCompanionProfile(searchResult)}
                        className="bg-slate-100 text-slate-700 text-[10px] font-bold px-3 py-1.5 rounded-xl hover:bg-slate-200 cursor-pointer"
                      >
                        Hồ sơ
                      </button>
                      <button 
                        onClick={() => handleSendCompanionRequest(searchResult)}
                        disabled={requestSent}
                        className={`text-[10px] font-extrabold px-3.5 py-1.5 rounded-xl cursor-pointer transition-all shadow-2xs ${
                          requestSent 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                            : 'bg-[#C8F7DC] text-[#124B31] border border-[#9EE7C0] hover:bg-[#B5F1D0]'
                        }`}
                      >
                        {requestSent ? 'Đã gửi lời mời ✨' : 'Gửi lời mời kết bạn'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Privacy settings toggles */}
              <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 mt-8">
                <h4 className="font-bold text-slate-700 text-xs mb-4 flex items-center gap-1.5">
                  <Settings className="w-4 h-4 text-slate-400" /> Cài đặt riêng tư của bạn
                </h4>
                
                <div className="space-y-3 text-xs">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={privacySettings.allowSearchById} 
                      onChange={() => setPrivacySettings({ ...privacySettings, allowSearchById: !privacySettings.allowSearchById })}
                    />
                    <span>Cho phép tìm kiếm tôi bằng Mã Chấm Tròn</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={privacySettings.allowSearchByEmail} 
                      onChange={() => setPrivacySettings({ ...privacySettings, allowSearchByEmail: !privacySettings.allowSearchByEmail })}
                    />
                    <span>Cho phép tìm kiếm tôi bằng Email</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={privacySettings.showActivity} 
                      onChange={() => setPrivacySettings({ ...privacySettings, showActivity: !privacySettings.showActivity })}
                    />
                    <span>Hiển thị hoạt động của tôi cho Bạn đồng hành</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Invites received */}
          {companionTab === 'invites' && (
            <div>
              {invites.length === 0 ? (
                <div className="text-center py-10 px-6 bg-slate-50 border border-slate-200/60 rounded-3xl max-w-md mx-auto shadow-2xs">
                  <span className="text-4xl mb-3 inline-block">📨</span>
                  <h4 className="font-extrabold text-slate-700 text-xs mb-1">Chưa có lời mời kết bạn mới</h4>
                  <p className="text-slate-500 text-xs leading-relaxed mb-4">
                    Hiện chưa có lời mời kết bạn nào. Hãy chia sẻ Mã Chấm Tròn của bạn nhé! ✨
                  </p>
                  <button 
                    onClick={handleCopyMyCode} 
                    className="bg-white hover:bg-slate-100 border border-slate-200 text-[#1E3A5F] text-[11px] font-bold px-4 py-2 rounded-xl cursor-pointer transition-all inline-flex items-center gap-1.5 shadow-2xs"
                    id="btn-copy-code-invites-empty"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#1E3A5F]" />
                    <span>{myCodeCopied ? 'Đã sao chép! ✨' : `Sao chép Mã của tôi (${getUserCircleCode()})`}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-600">Lời mời kết bạn đang chờ phản hồi ({invites.length})</span>
                  </div>
                  {invites.map((req) => (
                    <div key={req.id} className="bg-white border border-[#AFDCF1] p-4.5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between max-w-lg shadow-2xs gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-[#AFDCF1]/40 border border-[#8BC5E3] rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 shadow-2xs">
                          {req.fromAvatar || '🌸'}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-xs">{req.fromName}</h4>
                          <span className="text-[10px] text-slate-500 font-semibold block">
                            Mã Chấm Tròn: {req.fromCircleCode || req.fromId}
                          </span>
                          <span className="text-[9px] text-slate-400 block mt-0.5">
                            Yêu cầu được gửi ngày {req.date || 'Hôm nay'}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2 w-full sm:w-auto justify-end">
                        <button 
                          onClick={() => handleDeclineInvite(req)}
                          className="flex-1 sm:flex-initial px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                          id={`btn-decline-req-${req.id}`}
                        >
                          <span>🔴</span>
                          <span>Từ chối</span>
                        </button>
                        <button 
                          onClick={() => handleAcceptInvite(req)}
                          className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold rounded-xl cursor-pointer shadow-xs transition-all flex items-center justify-center gap-1.5"
                          id={`btn-accept-req-${req.id}`}
                        >
                          <span>🟢</span>
                          <span>Chấp nhận</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Friends List and Encouragement cards sending */}
          {companionTab === 'companions' && (
            <div className="space-y-6">
              {companions.length === 0 ? (
                <div className="text-center py-12 px-6 bg-slate-50 border border-slate-200/60 rounded-3xl max-w-lg mx-auto shadow-2xs">
                  <div className="w-16 h-16 bg-[#AFDCF1]/40 border border-[#8BC5E3] rounded-2xl text-[#1E3A5F] flex items-center justify-center text-3xl mx-auto mb-4 shadow-2xs">
                    🌸
                  </div>
                  <h4 className="font-extrabold text-slate-700 text-sm mb-2">Chưa có Bạn đồng hành</h4>
                  <p className="text-slate-500 text-xs leading-relaxed max-w-md mx-auto">
                    Bạn chưa có Bạn đồng hành nào. Hãy dùng Mã Chấm Tròn để tìm và kết nối nhé! ✨
                  </p>
                  <button
                    onClick={() => setCompanionTab('search')}
                    className="mt-6 bg-[#AFDCF1] hover:bg-[#92CBE8] text-[#1E3A5F] border border-[#8BC5E3] text-xs font-extrabold px-5 py-2.5 rounded-2xl shadow-2xs transition-all cursor-pointer inline-flex items-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    <span>Tìm Bạn đồng hành bằng Mã</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {companions.map((comp) => (
                    <div key={comp.id} className="bg-slate-50 border border-slate-100 p-5 rounded-3xl flex flex-col justify-between">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-4xl">{comp.avatar}</span>
                        <div>
                          <h4 className="font-bold text-slate-700 text-xs">{comp.name}</h4>
                          <span className="text-[10px] text-slate-400 font-semibold">Mã: {comp.id} - Duy trì: {comp.streak} ngày</span>
                          <p className="text-[10px] text-slate-500 italic mt-0.5">"{comp.bio}"</p>
                        </div>
                      </div>

                      <div className="border-t border-slate-200/50 pt-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Gửi tấm thiệp động viên ngọt ngào</span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {encouragementCards.map((card) => (
                            <button
                              key={card.id}
                              onClick={() => handleSendEncouragement(comp, card)}
                              className="bg-white border border-slate-200 p-2 rounded-xl text-center hover:bg-emerald-50 hover:border-emerald-200 transition-colors cursor-pointer"
                              title={card.content}
                            >
                              <span className="text-lg block">{card.emoji}</span>
                              <span className="text-[9px] font-bold text-slate-600 block truncate mt-0.5">{card.title}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 5: Sweet Cards Mailbox */}
          {companionTab === 'cards_mailbox' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                  <span>💌 Hộp thư Tấm thiệp yêu thương ({receivedCards.length})</span>
                </h3>
                {unreadCardsCount > 0 && (
                  <button
                    onClick={() => {
                      receivedCards.forEach(c => markCardAsRead(c.id));
                    }}
                    className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200 cursor-pointer transition-all shadow-2xs"
                  >
                    Đánh dấu tất cả đã đọc ✨
                  </button>
                )}
              </div>

              {receivedCards.length === 0 ? (
                <div className="text-center py-12 px-6 bg-slate-50 border border-slate-200/60 rounded-3xl max-w-lg mx-auto shadow-2xs">
                  <span className="text-5xl mb-3 inline-block">💌</span>
                  <h4 className="font-extrabold text-slate-700 text-sm mb-1">Hộp thư Tấm thiệp đang trống</h4>
                  <p className="text-slate-500 text-xs leading-relaxed max-w-md mx-auto mb-4">
                    Bạn chưa nhận được tấm thiệp nào. Hãy kết nối và gửi thiệp động viên cho bạn bè để lan tỏa yêu thương nhé! ✨
                  </p>
                  <button
                    onClick={() => setCompanionTab('companions')}
                    className="bg-[#C8F7DC] hover:bg-[#B5F1D0] text-[#124B31] border border-[#9EE7C0] text-xs font-extrabold px-5 py-2.5 rounded-2xl shadow-2xs transition-all cursor-pointer inline-flex items-center gap-2"
                  >
                    <span>Gửi thiệp cho Bạn đồng hành 🌸</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {receivedCards.map((card) => (
                    <div 
                      key={card.id} 
                      className={`p-5 rounded-3xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                        !card.isRead 
                          ? 'bg-rose-50/60 border-rose-200 shadow-sm' 
                          : 'bg-white border-slate-100 shadow-2xs'
                      }`}
                    >
                      {!card.isRead && (
                        <span className="absolute top-3 right-3 text-[9px] bg-rose-500 text-white font-extrabold px-2 py-0.5 rounded-full shadow-2xs animate-pulse">
                          Thiệp Mới 🔴
                        </span>
                      )}
                      
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-emerald-100/60 border border-emerald-200 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
                            {card.senderAvatar || '🌸'}
                          </div>
                          <div>
                            <h4 className="font-extrabold text-slate-800 text-xs">{card.senderName}</h4>
                            <span className="text-[10px] text-slate-400 font-semibold block">Mã: {card.senderCode} • {card.timestamp}</span>
                          </div>
                        </div>

                        <div className="bg-slate-50/80 border border-slate-100 p-3.5 rounded-2xl my-2">
                          <div className="flex items-center gap-1.5 font-bold text-slate-700 text-xs mb-1">
                            <span className="text-base">{card.emoji}</span>
                            <span>{card.cardTitle}</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed italic">
                            "{card.message}"
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                        {!card.isRead ? (
                          <button
                            onClick={() => markCardAsRead(card.id)}
                            className="text-[10px] text-slate-500 hover:text-slate-700 font-bold underline cursor-pointer"
                          >
                            Đánh dấu đã đọc
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">✓ Đã đọc</span>
                        )}

                        <button
                          onClick={() => handleReplyHeartCard(card.senderCode, card.senderName)}
                          className="bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 text-[10px] font-extrabold px-3.5 py-1.5 rounded-xl cursor-pointer transition-all shadow-2xs flex items-center gap-1"
                        >
                          <span>💖</span>
                          <span>Gửi tim đáp lại</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* SELECTED COMPANION PROFILE MODAL */}
      {selectedCompanionProfile && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-100 rounded-3xl p-6 max-w-sm w-full text-center relative overflow-hidden">
            <span className="text-6xl mb-3 block">{selectedCompanionProfile.avatar}</span>
            <h3 className="font-extrabold text-slate-800 text-sm">{selectedCompanionProfile.name}</h3>
            <span className="text-[10px] text-slate-400 font-semibold">Mã: {selectedCompanionProfile.id}</span>
            <p className="text-slate-500 text-xs italic mt-3 bg-slate-50 p-3 rounded-xl">"{selectedCompanionProfile.bio}"</p>
            
            <div className="grid grid-cols-2 gap-2 my-4 text-left text-xs bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/50">
              <div>🎯 Duy trì: <span className="font-bold text-emerald-800">{selectedCompanionProfile.streak} ngày</span></div>
              <div>💖 Cây tinh thần: <span className="font-bold text-emerald-800">Cấp {selectedCompanionProfile.treeLevel}</span></div>
            </div>

            <button 
              onClick={() => setSelectedCompanionProfile(null)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs py-2 rounded-full cursor-pointer mt-2"
            >
              Đóng hồ sơ
            </button>
          </div>
        </div>
      )}

      {/* 7. PAIR CHALLENGE EXECUTION MODAL */}
      <AnimatePresence>
        {activeChallengeModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-7 max-w-lg w-full relative shadow-2xl my-6"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-900 border border-amber-200 flex items-center justify-center text-2xl flex-shrink-0">
                    {activeChallengeModal.id === 'pc1' ? '📖' : activeChallengeModal.id === 'pc2' ? '🎧' : '🌬️'}
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/80 inline-block mb-0.5">
                      Thử Thách Ghép Đôi (+2 ⭐)
                    </span>
                    <h3 className="font-extrabold text-slate-800 text-sm sm:text-base leading-snug">
                      {activeChallengeModal.title}
                    </h3>
                  </div>
                </div>

                <button
                  onClick={() => setActiveChallengeModal(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold transition-all cursor-pointer flex-shrink-0"
                >
                  ✕
                </button>
              </div>

              {/* Progress Summary Tracker */}
              {(() => {
                const activeCompanion = getActiveCompanion();
                const compName = activeCompanion ? activeCompanion.name : 'Bạn đồng hành';
                const compAvatar = activeCompanion ? activeCompanion.avatar || '🌸' : '🌸';

                return (
                  <div className="bg-gradient-to-r from-emerald-50/70 via-slate-50 to-amber-50/70 border border-emerald-100 rounded-2xl p-4 mb-5 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Trạng thái cặp đôi bài này:</span>
                      </span>
                      <span className="font-extrabold text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[10px]">
                        <Award className="w-3 h-3 text-amber-700" />
                        <span>Thưởng: +2 ⭐ Sao Khả Dụng</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {/* Player 1: Me */}
                      <div className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                        activeChallengeModal.myCompleted 
                          ? 'bg-emerald-100/80 border-emerald-300 text-emerald-950 font-extrabold' 
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}>
                        <div className="flex items-center gap-1.5 truncate">
                          <span>{getCurrentUserObj()?.avatar || '🌱'}</span>
                          <span className="truncate font-bold">Tôi:</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-black flex items-center gap-1 ${
                          activeChallengeModal.myCompleted ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {activeChallengeModal.myCompleted ? '✓ Đã xong (+2⭐)' : 'Chưa xong'}
                        </span>
                      </div>

                      {/* Player 2: Companion */}
                      <div className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                        activeChallengeModal.companionCompleted 
                          ? 'bg-emerald-100/80 border-emerald-300 text-emerald-950 font-extrabold' 
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}>
                        <div className="flex items-center gap-1.5 truncate">
                          <span>{compAvatar}</span>
                          <span className="truncate font-bold">{compName}:</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-black flex items-center gap-1 ${
                          activeChallengeModal.companionCompleted ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-900'
                        }`}>
                          {activeChallengeModal.companionCompleted ? '✓ Đã xong' : 'Đang chờ...'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Dynamic Challenge Execution Content */}
              {/* CHALLENGE 1: VIẾT NHẬT KÝ */}
              {activeChallengeModal.id === 'pc1' && (
                <div className="space-y-3.5">
                  <div className="bg-sky-50/70 border border-sky-100 p-3.5 rounded-2xl">
                    <h4 className="font-bold text-sky-900 text-xs mb-1">📝 Viết nhật ký cảm xúc cùng bạn đồng hành</h4>
                    <p className="text-[11px] text-sky-800/90 leading-relaxed">
                      Chia sẻ vài dòng cảm nghĩ ấm áp, một niềm vui nhỏ hoặc giải tỏa những trăn trở hôm nay của bạn.
                    </p>
                  </div>

                  <textarea
                    value={challengeJournalText}
                    onChange={(e) => setChallengeJournalText(e.target.value)}
                    placeholder="Hôm nay mình cảm thấy... (Ghi lại một dòng cảm xúc để hoàn thành thử thách đôi)"
                    rows={4}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-400 resize-none"
                  />

                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>{challengeJournalText.length} ký tự</span>
                    {challengeJournalSaved && (
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Đã lưu tạm dòng suy nghĩ
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* CHALLENGE 2: VIDEO TIKTOK CHỮA LÀNH */}
              {activeChallengeModal.id === 'pc2' && (
                <div className="space-y-4" id="healing-tiktok-player-container">
                  {dailyPodcast && (dailyPodcast.videoId || dailyPodcast.youtubeUrl) ? (
                    <div className="space-y-4">
                      {/* Header Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-extrabold shadow-2xs">
                          <span className="w-3.5 h-3.5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[8px]">♪</span>
                          <span>VIDEO TIKTOK CHỮA LÀNH HÔM NAY</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium">
                          Do Quản trị viên đề cử
                        </span>
                      </div>

                      {/* Info card */}
                      <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-emerald-50 border border-rose-200 p-4 rounded-2xl">
                        <h4 className="font-serif font-bold text-slate-800 text-sm md:text-base leading-snug">
                          {dailyPodcast.title || 'Video TikTok Chữa Lành'}
                        </h4>
                        <p className="text-[11px] text-slate-600 italic mt-1 leading-relaxed">
                          "{dailyPodcast.healingMessage || 'Lắng nghe những rung cảm bình dị để thả lỏng căng thẳng và nuôi dưỡng sự an yên.'}"
                        </p>
                      </div>

                      {/* TikTok Embed Player */}
                      <TikTokEmbed urlOrId={dailyPodcast.youtubeUrl || dailyPodcast.videoId} compact={false} />

                      {/* Complete Video Challenge Button & Open in TikTok */}
                      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                        {!activeChallengeModal.myCompleted && (
                          <button
                            onClick={() => {
                              setPodcastProgress(100);
                              handleCompleteMyPartOfChallenge(activeChallengeModal.id);
                            }}
                            className="px-6 py-2.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                          >
                            <Check className="w-4 h-4" />
                            <span>Đã Xem Xong & Xác Nhận Hoàn Thành (+2 ⭐)</span>
                          </button>
                        )}
                        {dailyPodcast.youtubeUrl && (
                          <a
                            href={dailyPodcast.youtubeUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 flex items-center gap-1.5 transition-all"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                            <span>Mở ứng dụng TikTok</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* EMPTY STATE WHEN NO TIKTOK VIDEO IS ADDED BY ADMIN */
                    <div className="bg-gradient-to-b from-[#FFFDF7] to-[#F7F5FE] border-2 border-dashed border-rose-200 p-7 rounded-[30px] text-center space-y-3">
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center text-2xl shadow-2xs">
                        ♪
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-serif font-bold text-slate-800 text-sm">
                          Chưa có video TikTok nào hôm nay
                        </h4>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                          Khi Quản trị viên thêm đường link video TikTok trong <strong>Quản Trị Hệ Thống</strong>, video sẽ lập tức xuất hiện tại đây để bạn và người đồng hành cùng theo dõi và hoàn thành thử thách.
                        </p>
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500 italic text-center">
                    "Lắng nghe và chiêm nghiệm trọn vẹn sẽ giúp bạn và người đồng hành cùng nuôi dưỡng tâm hồn bình an."
                  </p>
                </div>
              )}


              {/* CHALLENGE 3: HÍT THỞ BÌNH YÊN */}
              {activeChallengeModal.id === 'pc3' && (
                <div className="space-y-4 text-center">
                  <div className="bg-emerald-50/70 border border-emerald-100 p-5 rounded-2xl flex flex-col items-center">
                    <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider mb-2">
                      Nhịp Thở 4 - 4 - 4 (Thư Giãn Sâu)
                    </span>

                    {/* Breathing circle indicator */}
                    <div className={`w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-1000 my-2 ${
                      breathPhase === 'inhale' 
                        ? 'bg-emerald-100 border-emerald-400 scale-110' 
                        : breathPhase === 'hold' 
                        ? 'bg-amber-100 border-amber-400 scale-105' 
                        : breathPhase === 'exhale' 
                        ? 'bg-sky-100 border-sky-400 scale-90' 
                        : 'bg-white border-slate-200'
                    }`}>
                      <span className="text-2xl font-black text-slate-800">{breathCount}</span>
                      <span className="text-[10px] font-extrabold uppercase text-slate-600">
                        {breathPhase === 'inhale' ? 'Hít Vào' : breathPhase === 'hold' ? 'Giữ Hơi' : breathPhase === 'exhale' ? 'Thở Ra' : 'Sẵn Sàng'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      {!breathIsRunning ? (
                        <button
                          onClick={() => {
                            setBreathIsRunning(true);
                            setBreathPhase('inhale');
                            setBreathCount(4);
                          }}
                          className="px-4 py-1.5 rounded-full bg-emerald-600 text-white font-extrabold text-xs cursor-pointer hover:bg-emerald-700 shadow-2xs flex items-center gap-1"
                        >
                          <Play className="w-3 h-3 fill-white" />
                          <span>Bắt đầu thở 3 vòng</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setBreathIsRunning(false);
                            setBreathPhase('idle');
                          }}
                          className="px-4 py-1.5 rounded-full bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer hover:bg-slate-300"
                        >
                          Tạm dừng
                        </button>
                      )}
                    </div>

                    <span className="text-[10px] text-slate-500 mt-2 font-semibold">
                      Đã hoàn thành: {breathRoundsCompleted} / 3 vòng thở
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2.5 mt-6 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setActiveChallengeModal(null)}
                  className="w-full sm:w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl cursor-pointer transition-all text-center"
                >
                  Đóng
                </button>

                {!activeChallengeModal.myCompleted ? (
                  <button
                    onClick={() => handleCompleteMyPartOfChallenge(activeChallengeModal.id)}
                    className="w-full sm:w-2/3 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-xs rounded-2xl shadow-md shadow-emerald-200 cursor-pointer transition-all flex items-center justify-center gap-1.5 active:scale-95"
                    id="btn-confirm-my-part-challenge"
                  >
                    <Check className="w-4 h-4" />
                    <span>Xác nhận hoàn thành & Nhận +2 ⭐</span>
                  </button>
                ) : (
                  <div className="w-full sm:w-2/3 py-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold text-xs rounded-2xl flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Bạn đã hoàn thành & nhận +2 ⭐ hôm nay</span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ACTIVE UNREAD SWEET CARD POPUP MODAL */}
      <AnimatePresence>
        {activeCardPopup && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white border-2 border-rose-200 rounded-3xl p-6 max-w-sm w-full text-center relative overflow-hidden shadow-2xl"
            >
              {/* Floating decorative elements */}
              <div className="absolute top-2 left-3 text-xl opacity-60 animate-bounce">🌸</div>
              <div className="absolute top-3 right-4 text-xl opacity-60 animate-pulse">✨</div>
              <div className="absolute bottom-2 left-4 text-xl opacity-50">💖</div>
              <div className="absolute bottom-3 right-3 text-xl opacity-50 animate-bounce">🌱</div>

              <span className="text-6xl mb-2 inline-block animate-pulse">{activeCardPopup.emoji || '💌'}</span>
              
              <h3 className="font-extrabold text-slate-800 text-sm mb-1">
                💌 Tấm Thiệp Ngọt Ngào Từ {activeCardPopup.senderName}!
              </h3>
              
              <span className="text-[10px] text-slate-400 font-semibold block mb-3">
                Mã: {activeCardPopup.senderCode} • {activeCardPopup.timestamp}
              </span>

              <div className="bg-rose-50/70 border border-rose-100 p-4 rounded-2xl text-left my-3 shadow-2xs">
                <h4 className="font-bold text-rose-900 text-xs mb-1 flex items-center gap-1">
                  <span>{activeCardPopup.emoji}</span>
                  <span>{activeCardPopup.cardTitle}</span>
                </h4>
                <p className="text-xs text-rose-800/90 leading-relaxed italic">
                  "{activeCardPopup.message}"
                </p>
              </div>

              <div className="flex flex-col gap-2 mt-4">
                <button
                  onClick={() => handleReplyHeartCard(activeCardPopup.senderCode, activeCardPopup.senderName)}
                  className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-extrabold text-xs py-2.5 rounded-full shadow-md shadow-rose-200 cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                >
                  <span>💖</span>
                  <span>Gửi tim đáp lại ngay</span>
                </button>

                <button
                  onClick={() => {
                    markCardAsRead(activeCardPopup.id);
                    setCompanionTab('cards_mailbox');
                    setActiveCardPopup(null);
                  }}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2 rounded-full cursor-pointer transition-all"
                >
                  Xem tất cả thiệp đã nhận 💌
                </button>

                <button
                  onClick={() => {
                    markCardAsRead(activeCardPopup.id);
                    setActiveCardPopup(null);
                  }}
                  className="w-full text-slate-400 hover:text-slate-600 text-[11px] font-semibold py-1 cursor-pointer mt-1"
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
