import React, { useState, useEffect, useRef } from 'react';
import { 
  Droplet, Wind, Activity, Moon, Utensils, BookOpen, 
  Music, Heart, Sun, Play, Pause, RotateCcw, Check, Sparkles, AlertCircle, Trash2, X, Video
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import HealingVideoHub from './HealingVideoHub';
import { recordDailyPractice } from '../lib/streak';
import { checkAndResetDailyTasks } from '../lib/dailyReset';
import { checkAchievementCompletion, addStarHistoryLog } from '../lib/achievements';
import { getScopedItem, setScopedItem, getUserScopeId } from '../lib/scopedStorage';
import gentleWavesAudioSrc from '../assets/dragon-studio-gentle-waves.mp3';
import forestBirdsAudioSrc from '../assets/forest-birds.mp3';

interface SelfCareProps {
  streak: number;
  onAddCircle: (count: number, reason: string) => void;
  onUpdateStreak: (newStreak: number) => void;
  onBack: () => void;
  initialTab?: string;
}

export default function SelfCare({ streak, onAddCircle, onUpdateStreak, onBack, initialTab }: SelfCareProps) {
  const scopeId = getUserScopeId();
  const [activeTab, setActiveTab] = useState<string>(initialTab || 'water');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // 1. Water State
  const [waterGlasses, setWaterGlasses] = useState<boolean[]>(() => {
    return getScopedItem('selfcare_water_glasses', [false, false, false, false, false, false, false, false], scopeId);
  });
  const [waterStreak, setWaterStreak] = useState(streak);

  // 2. Breathing State
  const [breathDuration, setBreathDuration] = useState<number>(60); // seconds
  const [breathTimeLeft, setBreathTimeLeft] = useState<number>(60);
  const [isBreathing, setIsBreathing] = useState<boolean>(false);
  const [breathPhase, setBreathPhase] = useState<'hít vào' | 'giữ lại' | 'thở ra' | 'chờ'>('chờ');
  const breathTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 3. Workout State
  const [exercises, setExercises] = useState(() => {
    return getScopedItem('selfcare_exercises', [
      { id: 'ex1', name: 'Duỗi cơ nhẹ nhàng buổi sáng', duration: 5, completed: false },
      { id: 'ex2', name: 'Đi bộ thư giãn quanh hồ', duration: 15, completed: false },
      { id: 'ex3', name: 'Nhảy tự do theo bài hát yêu thích', duration: 3, completed: false },
      { id: 'ex4', name: 'Tập yoga kéo giãn cơ thể', duration: 10, completed: false }
    ], scopeId);
  });
  const [workoutTimer, setWorkoutTimer] = useState<number>(0);
  const [selectedExForTimer, setSelectedExForTimer] = useState<string | null>(null);
  const [isExRunning, setIsExRunning] = useState(false);
  const exTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 4. Sleep State
  const [bedtime, setBedtime] = useState(() => getScopedItem('selfcare_bedtime', '22:30', scopeId));
  const [wakeTime, setWakeTime] = useState(() => getScopedItem('selfcare_waketime', '06:30', scopeId));
  const [sleepQuality, setSleepQuality] = useState(() => {
    const saved = getScopedItem('selfcare_sleep_quality', 80, scopeId);
    return typeof saved === 'number' ? saved : (parseInt(String(saved), 10) || 80);
  });
  const [sleepFeedback, setSleepFeedback] = useState<{
    isQualified: boolean;
    totalHours: number;
    advice: string;
    message: string;
  } | null>(null);
  const [sleepLogs, setSleepLogs] = useState<Array<{
    id: string;
    date: string;
    hours: string;
    durationHours?: number;
    qualityScore: number;
    qualityLabel: string;
    qualityEmoji: string;
    bedtime: string;
    wakeTime: string;
    advice?: string;
    isQualified?: boolean;
  }>>(() => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86400000);
    const yesterdayStr = yesterday.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return getScopedItem('selfcare_sleep_journal', [
      {
        id: 'initial-1',
        date: yesterdayStr,
        hours: '8.0 tiếng',
        durationHours: 8.0,
        qualityScore: 85,
        qualityLabel: 'Sảng khoái',
        qualityEmoji: '😊',
        bedtime: '22:30',
        wakeTime: '06:30',
        advice: 'Tuyệt vời! Bạn đã duy trì giấc ngủ lý tưởng (từ 6 đến 8 tiếng). Cơ thể và tâm trí bạn đã được tái tạo năng lượng hoàn hảo! ✨',
        isQualified: true
      }
    ], scopeId);
  });
  const [showSleepJournalModal, setShowSleepJournalModal] = useState(false);

  // 5. Healthy Eating State
  const [meals, setMeals] = useState(() => {
    return getScopedItem('selfcare_meals', [
      { id: 'm1', name: 'Ăn bữa sáng đầy đủ dinh dưỡng', checked: false },
      { id: 'm2', name: 'Bổ sung rau xanh trong bữa trưa', checked: false },
      { id: 'm3', name: 'Ăn tối thanh đạm trước 7h tối', checked: false },
      { id: 'm4', name: 'Uống một tách trà thảo mộc ấm', checked: false }
    ], scopeId);
  });

  // 6. Reading State
  const [readDuration, setReadDuration] = useState<number>(300); // seconds (default 5 mins)
  const [readTimeLeft, setReadTimeLeft] = useState<number>(300);
  const [isReadRunning, setIsReadRunning] = useState(false);
  const readTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [bookTitle, setBookTitle] = useState(() => {
    const saved = getScopedItem<string>('selfcare_book_title', '', scopeId);
    return saved === 'Dám bị ghét' ? '' : saved;
  });
  const [bookSavedToast, setBookSavedToast] = useState<string | null>(null);
  const [readingSubTab, setReadingSubTab] = useState<'my_book' | 'suggested_books'>('my_book');
  const [readHistory, setReadHistory] = useState<string[]>(() => {
    return getScopedItem('selfcare_read_history', [], scopeId);
  });
  const [favQuotes, setFavQuotes] = useState<string[]>(() => {
    return getScopedItem('selfcare_fav_quotes', [], scopeId);
  });
  const [newQuote, setNewQuote] = useState('');

  // Curated 100% Real Healing Books
  const suggestedBooks = [
    {
      id: 'b1',
      title: 'Hiểu Về Trái Tim',
      author: 'Thích Minh Niệm',
      summary: 'Nhìn lại tâm mình, gọi tên từng cảm xúc để yêu thương và chữa lành từ bên trong.',
      emoji: '🫀',
      bgGradient: 'from-rose-50 to-pink-50 border-rose-200/80'
    },
    {
      id: 'b2',
      title: 'Gieo Trồng Hạnh Phúc',
      author: 'Thích Nhất Hạnh',
      summary: 'Học cách thực hành chánh niệm, tìm thấy sự bình yên ngay trong từng hơi thở.',
      emoji: '🌱',
      bgGradient: 'from-emerald-50 to-teal-50 border-emerald-200/80'
    },
    {
      id: 'b3',
      title: 'Sức Mạnh Của Hiện Tại',
      author: 'Eckhart Tolle',
      summary: 'Bản hòa tấu đưa bạn thoát khỏi những lo âu về quá khứ và tương lai.',
      emoji: '⏳',
      bgGradient: 'from-amber-50 to-orange-50 border-amber-200/80'
    },
    {
      id: 'b4',
      title: 'Yêu Thương Chính Mình',
      author: 'Kristin Neff',
      summary: 'Dừng việc dằn xé bản thân và học cách bao dung với chính những khuyết điểm của mình.',
      emoji: '💖',
      bgGradient: 'from-purple-50 to-indigo-50 border-purple-200/80'
    },
    {
      id: 'b5',
      title: 'Đời Ngắn Đừng Ngủ Dài',
      author: 'Robin Sharma',
      summary: 'Những bài học nhẹ nhàng truyền cảm hứng để bạn sống trọn vẹn từng khoảnh khắc.',
      emoji: '☀️',
      bgGradient: 'from-sky-50 to-blue-50 border-sky-200/80'
    }
  ];

  const handleSaveBookTitle = (titleToSave?: string) => {
    const target = titleToSave !== undefined ? titleToSave : bookTitle;
    const trimmed = target.trim();
    setBookTitle(trimmed);
    setScopedItem('selfcare_book_title', trimmed, scopeId);
    if (trimmed) {
      setBookSavedToast(`Đã lưu cuốn sách đang đọc: "${trimmed}"! ✨`);
    } else {
      setBookSavedToast('Đã xóa tên sách đang đọc. ✨');
    }
    setTimeout(() => setBookSavedToast(null), 3500);
  };

  const handleSelectSuggestedBook = (book: typeof suggestedBooks[0]) => {
    handleSaveBookTitle(book.title);
    setReadingSubTab('my_book');
  };

  // 7. Relaxation Sound State
  const [selectedSound, setSelectedSound] = useState('rain');
  const [isPlayingSound, setIsPlayingSound] = useState(false);
  const [soundVolume, setSoundVolume] = useState(50);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Helper to dynamically retrieve available sounds (default + unlocked from shop)
  const getAvailableSoundsList = () => {
    const baseList = [
      { id: 'rain', label: 'Mưa rào ấm áp', emoji: '🌧️', desc: 'Real Audio' },
      { id: 'ocean', label: 'Sóng biển rì rào', emoji: '🌊', desc: 'Real Audio' },
      { id: 'white_noise', label: 'Tiếng ồn trắng', emoji: '📺', desc: 'White Noise' },
      { id: 'nature', label: 'Chim hót rừng chiều', emoji: '🐦', desc: 'Real Audio' }
    ];

    try {
      const unlocked: string[] = getScopedItem('unlocked_rewards', [], scopeId);
      if (Array.isArray(unlocked)) {
        if (unlocked.includes('sound_keyboard') || unlocked.includes('keyboard')) {
          baseList.push({ id: 'keyboard', label: 'Tiếng Gõ Bàn Phím', emoji: '⌨️', desc: 'ASMR Tập Trung (Đã mở)' });
        }
        if (unlocked.includes('sound_lofi') || unlocked.includes('lofi')) {
          baseList.push({ id: 'lofi', label: 'Nhạc Lofi Chill', emoji: '🎧', desc: 'Lofi Thư Giãn (Đã mở)' });
        }
      }
    } catch (e) {
      console.error(e);
    }

    return baseList;
  };

  const [availableSounds, setAvailableSounds] = useState(getAvailableSoundsList);

  useEffect(() => {
    const syncSounds = () => {
      setAvailableSounds(getAvailableSoundsList());
    };
    window.addEventListener('unlocked-rewards-changed', syncSounds);
    window.addEventListener('storage', syncSounds);
    return () => {
      window.removeEventListener('unlocked-rewards-changed', syncSounds);
      window.removeEventListener('storage', syncSounds);
    };
  }, []);

  // 8. Gratitude State
  const [gratitudeTexts, setGratitudeTexts] = useState(() => {
    return getScopedItem('selfcare_gratitude_texts', { card1: '', card2: '', card3: '' }, scopeId);
  });
  const [gratitudeSaved, setGratitudeSaved] = useState(() => {
    const saved = getScopedItem<any>('selfcare_gratitude_saved', 'false', scopeId);
    return saved === 'true' || saved === true;
  });

  // 9. Meditation State
  const [medTime, setMedTime] = useState(180); // 3 mins default
  const [medTimeLeft, setMedTimeLeft] = useState(180);
  const [isMedRunning, setIsMedRunning] = useState(false);
  const medTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timers on mount & listen for global audio stops / shop triggers
  useEffect(() => {
    const handleStopSelfCareAudio = () => {
      setIsPlayingSound(false);
      pauseMp3Sound();
      stopWebAudio();
    };

    const handlePlayShopSound = (e: any) => {
      const soundId = e.detail?.sound;
      if (soundId) {
        setSelectedSound(soundId);
        setIsPlayingSound(true);
        if (['rain', 'ocean', 'nature', 'keyboard', 'lofi'].includes(soundId)) {
          setSoundVolume(60);
          playMp3Sound(soundId);
        } else {
          stopMp3Sound();
          playWebAudio(soundId);
        }
      }
    };

    window.addEventListener('stop-selfcare-audio', handleStopSelfCareAudio);
    window.addEventListener('play-shop-sound' as any, handlePlayShopSound);

    // Sync state when daily auto-reset occurs
    const handleDailyReset = () => {
      const waterSaved = localStorage.getItem('selfcare_water_glasses');
      if (waterSaved) {
        try { setWaterGlasses(JSON.parse(waterSaved)); } catch {}
      } else {
        setWaterGlasses([false, false, false, false, false, false, false, false]);
      }

      const exSaved = localStorage.getItem('selfcare_exercises');
      if (exSaved) {
        try { setExercises(JSON.parse(exSaved)); } catch {}
      }

      const mealsSaved = localStorage.getItem('selfcare_meals');
      if (mealsSaved) {
        try { setMeals(JSON.parse(mealsSaved)); } catch {}
      }

      const gratitudeSavedStr = localStorage.getItem('selfcare_gratitude_texts');
      if (gratitudeSavedStr) {
        try { setGratitudeTexts(JSON.parse(gratitudeSavedStr)); } catch {}
      } else {
        setGratitudeTexts({ card1: '', card2: '', card3: '' });
      }

      setGratitudeSaved(localStorage.getItem('selfcare_gratitude_saved') === 'true');
    };

    // Run daily reset check immediately on component mount
    checkAndResetDailyTasks();
    window.addEventListener('daily-tasks-reset', handleDailyReset);

    return () => {
      window.removeEventListener('stop-selfcare-audio', handleStopSelfCareAudio);
      window.removeEventListener('play-shop-sound' as any, handlePlayShopSound);
      window.removeEventListener('daily-tasks-reset', handleDailyReset);
      if (breathTimerRef.current) clearInterval(breathTimerRef.current);
      if (exTimerRef.current) clearInterval(exTimerRef.current);
      if (readTimerRef.current) clearInterval(readTimerRef.current);
      if (medTimerRef.current) clearInterval(medTimerRef.current);
      stopWebAudio();
      stopMp3Sound();
    };
  }, []);

  const pauseMp3Sound = () => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch (e) {
        console.warn('[SelfCare Audio] Error pausing MP3:', e);
      }
    }
  };

  const stopMp3Sound = () => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch (e) {
        console.warn('[SelfCare Audio] Error stopping MP3:', e);
      }
      audioRef.current = null;
    }
  };

  const playMp3Sound = async (type: string) => {
    // Dừng hoàn toàn âm thanh cũ (WebAudio Synthesizer & MP3)
    stopWebAudio();
    stopMp3Sound();

    let primarySrc = '';
    let fallbackSrc = '';

    if (type === 'rain') {
      primarySrc = '/rain.mp3';
      fallbackSrc = 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a73467.mp3?filename=heavy-rain-nature-sounds-112906.mp3';
    } else if (type === 'nature') {
      primarySrc = '/forest-birds.mp3';
      fallbackSrc = 'https://cdn.pixabay.com/download/audio/2022/05/16/audio_db65912030.mp3?filename=birds-in-forest-112368.mp3';
    } else if (type === 'ocean') {
      primarySrc = '/ocean-waves.mp3';
      fallbackSrc = 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a73467.mp3?filename=ocean-waves-112906.mp3';
    } else if (type === 'keyboard') {
      primarySrc = '/keyboard.mp3';
      fallbackSrc = 'https://cdn.pixabay.com/download/audio/2021/08/09/audio_3d191fb898.mp3?filename=keyboard-clicking-10113.mp3';
    } else if (type === 'lofi') {
      primarySrc = 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';
      fallbackSrc = 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=chill-lofi-song-8444.mp3';
    } else {
      playWebAudio(type);
      return;
    }

    const audio = new Audio();
    audio.preload = 'auto';
    audio.loop = true;
    audio.muted = false;
    audioRef.current = audio;

    const currentVol = soundVolume / 100;
    audio.volume = Math.min(1, Math.max(0, currentVol));

    audio.src = primarySrc;
    audio.currentTime = 0;

    try {
      await audio.play();
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.warn("[SelfCare Audio] Lỗi phát âm thanh chính, đang thử file dự phòng:", err?.message || err);
      try {
        audio.pause();
        audio.src = fallbackSrc;
        audio.currentTime = 0;
        audio.load();
        await audio.play();
      } catch (fallbackErr: any) {
        if (fallbackErr?.name !== 'AbortError') {
          console.warn("[SelfCare Audio] Lỗi phát âm thanh dự phòng, chuyển sang WebAudio synth:", fallbackErr?.message || fallbackErr);
          playWebAudio('rain');
        }
      }
    }
  };

  // Web Audio Synth for white noises & sounds
  const playWebAudio = (type: string) => {
    try {
      stopWebAudio();
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(soundVolume / 1500, ctx.currentTime);
      gainNode.connect(ctx.destination);
      gainNodeRef.current = gainNode;

      if (type === 'rain' || type === 'white_noise') {
        const bufferSize = 4 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
        const leftChannel = noiseBuffer.getChannelData(0);
        const rightChannel = noiseBuffer.getChannelData(1);

        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
          b6 = white * 0.115926;

          if (type === 'rain') {
            leftChannel[i] = pink * 0.06;
            rightChannel[i] = pink * 0.06;
          } else {
            leftChannel[i] = white * 0.05;
            rightChannel[i] = white * 0.05;
          }
        }

        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;
        noiseSource.connect(gainNode);
        noiseSource.start(0);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const stopWebAudio = () => {
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
    oscillatorRef.current = null;
    gainNodeRef.current = null;
  };

  useEffect(() => {
    if (isPlayingSound) {
      window.dispatchEvent(new CustomEvent('stop-ambient-audio'));
      if (['rain', 'ocean', 'nature', 'keyboard', 'lofi'].includes(selectedSound)) {
        playMp3Sound(selectedSound);
      } else {
        stopMp3Sound();
        playWebAudio(selectedSound);
      }
    } else {
      pauseMp3Sound();
      stopWebAudio();
    }
  }, [isPlayingSound, selectedSound]);

  useEffect(() => {
    if (gainNodeRef.current && audioContextRef.current) {
      gainNodeRef.current.gain.setValueAtTime(soundVolume / 1500, audioContextRef.current.currentTime);
    }
    if (audioRef.current) {
      audioRef.current.volume = Math.min(1, Math.max(0, soundVolume / 100));
    }
  }, [soundVolume]);

  const triggerCelebration = (
    reason: string, 
    circleReward: number = 1, 
    emoji: string = '✨', 
    category: string = 'Tự chăm sóc', 
    badgeId?: string,
    achievementTitle?: string
  ) => {
    setSuccessMsg(reason);
    onAddCircle(circleReward, reason);
    const newStreak = recordDailyPractice();
    onUpdateStreak(newStreak);

    if (badgeId) {
      const savedLevelsStr = localStorage.getItem('achievement_star_levels');
      let levels: Record<string, number> = {};
      if (savedLevelsStr) {
        try { levels = JSON.parse(savedLevelsStr); } catch {}
      }
      levels[badgeId] = Math.max(1, (levels[badgeId] || 0) + 1);
      localStorage.setItem('achievement_star_levels', JSON.stringify(levels));
    }

    // Immediately record star history log to ensure synchronous persistence
    const logTitle = achievementTitle || reason;
    addStarHistoryLog(logTitle, circleReward, emoji, category, badgeId, scopeId);

    // Instantly calculate and broadcast updated achievement completion & wallet stars
    checkAchievementCompletion(newStreak, 0, true, scopeId);
  };

  // 1. Water interaction
  const toggleGlass = (index: number) => {
    const nextGlasses = [...waterGlasses];
    nextGlasses[index] = !nextGlasses[index];
    setWaterGlasses(nextGlasses);
    setScopedItem('selfcare_water_glasses', nextGlasses, scopeId);
    window.dispatchEvent(new CustomEvent('selfcare-state-change'));

    const filledCount = nextGlasses.filter(g => g).length;
    if (filledCount === 8) {
      triggerCelebration('Chúc mừng! Bạn đã hoàn thành thói quen Uống Nước và nhận được 1 ⭐', 1, '💧', 'Thói quen', 'b1');
    }
  };

  // Soft chime / singing bowl audio generator
  const playGentleChime = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();

      // Singing bowl / soft chime harmonic frequencies (Hz)
      const frequencies = [528, 639, 792, 1056];
      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        const startTime = ctx.currentTime + idx * 0.12;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.25 / frequencies.length, startTime + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 3.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 3.3);
      });
    } catch (e) {
      console.warn("[Chime Audio] Could not play chime sound:", e);
    }
  };

  // Toggle completion of an exercise manually
  const toggleExerciseToggle = (id: string) => {
    setExercises(prevEx => {
      const updated = prevEx.map(item => item.id === id ? { ...item, completed: !item.completed } : item);
      setScopedItem('selfcare_exercises', updated, scopeId);
      window.dispatchEvent(new CustomEvent('selfcare-state-change'));
      const item = updated.find(i => i.id === id);
      if (item && item.completed) {
        playGentleChime();
        triggerCelebration(`Tuyệt vời! Bạn đã hoàn thành ${item.name} hôm nay! ✨`, 1, '🏃', 'Thói quen', 'b6');
      }
      return updated;
    });
  };

  // 2. Breathing loop timer
  const toggleBreathing = () => {
    if (isBreathing) {
      if (breathTimerRef.current) clearInterval(breathTimerRef.current);
      setIsBreathing(false);
      setBreathPhase('chờ');
    } else {
      setIsBreathing(true);
      setBreathTimeLeft(breathDuration);
      let localTimeLeft = breathDuration;
      let secondCounter = 0;

      // 4-4-4-4 Box Breathing
      const getPhase = (sec: number) => {
        const cycle = sec % 16;
        if (cycle < 4) return 'hít vào';
        if (cycle < 8) return 'giữ lại';
        if (cycle < 12) return 'thở ra';
        return 'chờ';
      };

      setBreathPhase(getPhase(0));

      breathTimerRef.current = setInterval(() => {
        localTimeLeft -= 1;
        secondCounter += 1;
        setBreathTimeLeft(localTimeLeft);
        setBreathPhase(getPhase(secondCounter));

        if (localTimeLeft <= 0) {
          if (breathTimerRef.current) clearInterval(breathTimerRef.current);
          setIsBreathing(false);
          setBreathPhase('chờ');
          const todayStr = new Date().toLocaleDateString('sv-SE');
          setScopedItem('selfcare_breath_completed_date', todayStr, scopeId);
          setScopedItem('selfcare_breath_completed', todayStr, scopeId);
          window.dispatchEvent(new CustomEvent('selfcare-state-change'));
          triggerCelebration(`Hoàn thành bài tập hít thở sâu ${breathDuration / 60} phút! Tâm trí bạn đã nhẹ nhàng hơn rất nhiều.`, 1, '🌬️', 'Tâm trí', 'b2');
        }
      }, 1000);
    }
  };

  // 3. Workout timer
  const startExerciseTimer = (ex: typeof exercises[0]) => {
    if (exTimerRef.current) clearInterval(exTimerRef.current);
    setSelectedExForTimer(ex.id);
    setWorkoutTimer(ex.duration * 60);
    setIsExRunning(true);

    exTimerRef.current = setInterval(() => {
      setWorkoutTimer(prev => {
        if (prev <= 1) {
          clearInterval(exTimerRef.current!);
          setIsExRunning(false);
          playGentleChime();
          // Mark completed
          setExercises(prevEx => {
            const updated = prevEx.map(item => item.id === ex.id ? { ...item, completed: true } : item);
            setScopedItem('selfcare_exercises', updated, scopeId);
            window.dispatchEvent(new CustomEvent('selfcare-state-change'));
            return updated;
          });
          triggerCelebration(`Tuyệt vời! Bạn đã hoàn thành ${ex.name} hôm nay! ✨`, 1, '🏃', 'Thói quen', 'b6');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const toggleExPlayPause = () => {
    if (isExRunning) {
      if (exTimerRef.current) clearInterval(exTimerRef.current);
      setIsExRunning(false);
    } else if (selectedExForTimer) {
      setIsExRunning(true);
      const currentEx = exercises.find(e => e.id === selectedExForTimer);
      exTimerRef.current = setInterval(() => {
        setWorkoutTimer(prev => {
          if (prev <= 1) {
            clearInterval(exTimerRef.current!);
            setIsExRunning(false);
            playGentleChime();
            setExercises(prevEx => {
              const updated = prevEx.map(item => item.id === selectedExForTimer ? { ...item, completed: true } : item);
              setScopedItem('selfcare_exercises', updated, scopeId);
              window.dispatchEvent(new CustomEvent('selfcare-state-change'));
              return updated;
            });
            triggerCelebration(`Tuyệt vời! Bạn đã hoàn thành ${currentEx?.name || 'bài tập'} hôm nay! ✨`, 1, '🏃', 'Thói quen', 'b6');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  // 6. Reading timer (Strict countdown to 100% completion)
  const toggleReadingTimer = () => {
    if (isReadRunning) {
      if (readTimerRef.current) clearInterval(readTimerRef.current);
      setIsReadRunning(false);
      setReadTimeLeft(readDuration);
    } else {
      setIsReadRunning(true);
      setReadTimeLeft(readDuration);
      let localTimeLeft = readDuration;

      readTimerRef.current = setInterval(() => {
        localTimeLeft -= 1;
        setReadTimeLeft(localTimeLeft);

        if (localTimeLeft <= 0) {
          if (readTimerRef.current) clearInterval(readTimerRef.current);
          setIsReadRunning(false);
          setReadTimeLeft(readDuration);

          const formattedMins = Math.floor(readDuration / 60);
          const activeBookName = bookTitle.trim() || 'Sách đang đọc';
          const updatedHistory = [`Đọc ${formattedMins} phút cuốn "${activeBookName}" - Hôm nay`, ...readHistory];
          setReadHistory(updatedHistory);
          setScopedItem('selfcare_read_history', updatedHistory, scopeId);
          window.dispatchEvent(new CustomEvent('selfcare-state-change'));
          triggerCelebration(`Chúc mừng! Bạn đã hoàn thành ${formattedMins} phút đọc sách cuốn "${activeBookName}"! ✨`, 1, '📖', 'Thói quen', 'b7');
        }
      }, 1000);
    }
  };

  const addQuote = () => {
    if (newQuote.trim() !== '') {
      const activeBookName = bookTitle.trim() ? ` - ${bookTitle.trim()}` : '';
      const updatedQuotes = [...favQuotes, `"${newQuote}"${activeBookName}`];
      setFavQuotes(updatedQuotes);
      setScopedItem('selfcare_fav_quotes', updatedQuotes, scopeId);
      setNewQuote('');
    }
  };

  // 4. Sleep Journal Handlers
  const getSleepDurationValue = (bed: string, wake: string): number => {
    try {
      const [bH, bM] = bed.split(':').map(Number);
      const [wH, wM] = wake.split(':').map(Number);
      let diffMinutes = (wH * 60 + wM) - (bH * 60 + bM);
      if (diffMinutes <= 0) {
        diffMinutes += 1440;
      }
      return parseFloat((diffMinutes / 60).toFixed(1));
    } catch {
      return 8.0;
    }
  };

  const calculateSleepDurationHours = (bed: string, wake: string): string => {
    const val = getSleepDurationValue(bed, wake);
    return `${val.toFixed(1)} tiếng`;
  };

  const getSleepAdviceAndQualification = (totalHours: number) => {
    if (totalHours < 6.0) {
      return {
        isQualified: false,
        advice: 'Giấc ngủ của bạn hơi ngắn (dưới 6 tiếng). Thiếu ngủ có thể khiến cơ thể mệt mỏi và giảm tập trung. Hãy thử sắp xếp đi ngủ sớm hơn để nạp đủ năng lượng nhé! 🌙',
        statusLabel: 'Chưa đạt chuẩn (< 6 tiếng)',
        badgeClass: 'bg-[#FFEEB6] text-[#4D3E00] border-[#E8CF7A]'
      };
    } else if (totalHours > 8.0) {
      return {
        isQualified: false,
        advice: 'Thời gian ngủ của bạn hơi nhiều (trên 8 tiếng). Ngủ quá nhiều đôi khi làm cơ thể uể oải và nặng nề. Bạn nên duy trì mức ngủ 7–8 tiếng mỗi đêm để luôn tỉnh táo và sảng khoái nhé! 🌿',
        statusLabel: 'Chưa đạt chuẩn (> 8 tiếng)',
        badgeClass: 'bg-[#FFD7D5] text-[#5A1A24] border-[#F2B6B3]'
      };
    } else {
      return {
        isQualified: true,
        advice: 'Tuyệt vời! Bạn đã duy trì giấc ngủ lý tưởng (từ 6 đến 8 tiếng). Cơ thể và tâm trí bạn đã được tái tạo năng lượng hoàn hảo! ✨',
        statusLabel: 'Đạt chuẩn lý tưởng (6–8 tiếng) ⭐',
        badgeClass: 'bg-[#C2D772]/40 text-[#2B4212] border-[#A8BD55]'
      };
    }
  };

  const handleSaveSleep = () => {
    const totalHours = getSleepDurationValue(bedtime, wakeTime);
    const hoursStr = `${totalHours.toFixed(1)} tiếng`;
    const { isQualified, advice } = getSleepAdviceAndQualification(totalHours);

    let emoji = '😊';
    let label = 'Sảng khoái';
    if (sleepQuality <= 40) {
      emoji = '😴';
      label = 'Rất mệt';
    } else if (sleepQuality <= 75) {
      emoji = '😐';
      label = 'Bình thường';
    }

    const todayDateStr = new Date().toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    const newLog = {
      id: Date.now().toString(),
      date: todayDateStr,
      hours: hoursStr,
      durationHours: totalHours,
      qualityScore: sleepQuality,
      qualityLabel: label,
      qualityEmoji: emoji,
      bedtime,
      wakeTime,
      advice,
      isQualified
    };

    const updatedLogs = [newLog, ...sleepLogs];
    setSleepLogs(updatedLogs);
    setScopedItem('selfcare_sleep_journal', updatedLogs, scopeId);
    setScopedItem('selfcare_bedtime', bedtime, scopeId);
    setScopedItem('selfcare_waketime', wakeTime, scopeId);
    setScopedItem('selfcare_sleep_quality', sleepQuality, scopeId);

    setSleepFeedback({
      isQualified,
      totalHours,
      advice,
      message: isQualified
        ? `🎉 Chúc mừng! Bạn đã hoàn thành giấc ngủ lý tưởng (${hoursStr}) và nhận được 1 ⭐!`
        : advice
    });

    if (isQualified) {
      const todayDateIso = new Date().toLocaleDateString('sv-SE');
      setScopedItem('selfcare_sleep_completed_date', todayDateIso, scopeId);

      playGentleChime();
      triggerCelebration(
        `Chúc mừng! Bạn đã hoàn thành giấc ngủ lý tưởng (${hoursStr}) và nhận được 1 ⭐!`,
        1,
        '🌙',
        'Thói quen',
        'b_sleep_1',
        'Giấc Ngủ Trọn Vẹn'
      );
      window.dispatchEvent(new CustomEvent('selfcare-state-change'));
      window.dispatchEvent(new CustomEvent('achievement-stars-updated'));
    }
  };

  const deleteSleepLog = (id: string) => {
    const updated = sleepLogs.filter(log => log.id !== id);
    setSleepLogs(updated);
    setScopedItem('selfcare_sleep_journal', updated, scopeId);
  };

  // 5. Healthy Meals toggle
  const toggleMeal = (id: string) => {
    const updated = meals.map(m => m.id === id ? { ...m, checked: !m.checked } : m);
    setMeals(updated);
    setScopedItem('selfcare_meals', updated, scopeId);

    const checkedCount = updated.filter(m => m.checked).length;
    const isAllChecked = checkedCount >= updated.length && updated.length > 0;
    const todayStr = new Date().toISOString().split('T')[0];
    const healthyDays = getScopedItem<string[]>('selfcare_healthy_eating_days', [], scopeId);

    let newHealthyDays = Array.isArray(healthyDays) ? [...healthyDays] : [];
    if (isAllChecked) {
      if (!newHealthyDays.includes(todayStr)) {
        newHealthyDays.push(todayStr);
      }
    } else {
      newHealthyDays = newHealthyDays.filter(d => d !== todayStr);
    }
    setScopedItem('selfcare_healthy_eating_days', newHealthyDays, scopeId);

    playGentleChime();
    const currentStreak = streak || 1;
    checkAchievementCompletion(currentStreak, 0, true, scopeId);

    if (isAllChecked) {
      triggerCelebration('Tuyệt vời! Bạn đã đạt 100% Ăn Uống Lành Mạnh hôm nay và nhận được +1 ⭐!', 1, '🥗', 'Dinh dưỡng', 'b_eat_1');
    } else {
      window.dispatchEvent(new CustomEvent('selfcare-state-change'));
      window.dispatchEvent(new CustomEvent('achievement-stars-updated'));
    }
  };

  // 8. Gratitude action
  const saveGratitude = () => {
    if (!gratitudeTexts.card1 && !gratitudeTexts.card2 && !gratitudeTexts.card3) {
      alert("Vui lòng ghi lại ít nhất một điều bạn trân trọng nhé!");
      return;
    }
    setGratitudeSaved(true);
    setScopedItem('selfcare_gratitude_texts', gratitudeTexts, scopeId);
    setScopedItem('selfcare_gratitude_saved', 'true', scopeId);
    window.dispatchEvent(new CustomEvent('selfcare-state-change'));
    triggerCelebration('Cảm ơn bạn đã nuôi dưỡng lòng biết ơn. Đóa hoa tâm hồn đang nở rộ ngọt ngào.', 1, '💖', 'Tâm trí', 'b3');
  };

  // 9. Meditation timer
  const toggleMeditation = () => {
    if (isMedRunning) {
      if (medTimerRef.current) clearInterval(medTimerRef.current);
      setIsMedRunning(false);
    } else {
      setIsMedRunning(true);
      setMedTimeLeft(medTime);
      
      medTimerRef.current = setInterval(() => {
        setMedTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(medTimerRef.current!);
            setIsMedRunning(false);
            setScopedItem('selfcare_meditation_completed', 'true', scopeId);
            window.dispatchEvent(new CustomEvent('selfcare-state-change'));
            triggerCelebration('Bạn đã hoàn thành phiên thiền tĩnh lặng tuyệt vời hôm nay. Thật an yên!', 1, '🧘', 'Tâm trí', 'b4');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const selfCareActivities = [
    { id: 'water', label: 'Uống đủ nước', icon: Droplet, color: 'text-[#2B4212] bg-[#F6DBE2] border-[#F0B8C8]' },
    { id: 'breath', label: 'Hít thở sâu', icon: Wind, color: 'text-[#2B4212] bg-[#C2D772] border-[#A8BD55]' },
    { id: 'workout', label: 'Vận động nhẹ', icon: Activity, color: 'text-[#2B4212] bg-[#F6DBE2] border-[#F0B8C8]' },
    { id: 'sleep', label: 'Ngủ đủ giấc', icon: Moon, color: 'text-[#2B4212] bg-[#C2D772] border-[#A8BD55]' },
    { id: 'eating', label: 'Ăn lành mạnh', icon: Utensils, color: 'text-[#2B4212] bg-[#C2D772] border-[#A8BD55]' },
    { id: 'reading', label: 'Đọc sách hay', icon: BookOpen, color: 'text-[#2B4212] bg-[#F6DBE2] border-[#F0B8C8]' },
    { id: 'relax', label: 'Thư giãn âm thanh', icon: Music, color: 'text-[#4A121A] bg-[#FFD7D5] border-[#F2B6B3]' },
    { id: 'gratitude', label: 'Lòng biết ơn', icon: Heart, color: 'text-[#4A121A] bg-[#FFB6BD] border-[#F89CA7]' },
    { id: 'meditation', label: 'Thiền định', icon: Sun, color: 'text-[#4D3E00] bg-[#FFEEB6] border-[#E8CF7A]' },
    { id: 'tiktok', label: 'Video TikTok', icon: Video, color: 'text-rose-700 bg-rose-100 border-rose-300' }
  ];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 text-text-minimal" id="selfcare-dashboard-container">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={onBack} 
          className="flex items-center gap-2 text-text-minimal/70 hover:text-[#4A121A] transition-colors bg-white/80 backdrop-blur px-4 py-2 rounded-full border border-accent-minimal shadow-sm font-semibold"
          id="btn-selfcare-back"
        >
          <span>← Quay lại</span>
        </button>
      </div>

      <div className="text-center mb-8">
        <h1 className="text-3xl font-serif text-text-minimal tracking-tight" id="selfcare-main-title">Hành Trình Nuôi Dưỡng Bản Thân</h1>
        <p className="text-text-minimal/60 text-xs mt-2 font-sans">Dành vài phút mỗi ngày cho các thói quen nhỏ để nâng niu cơ thể và tâm hồn.</p>
      </div>

      {/* Grid Menu of SelfCare Activities */}
      <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-2.5 mb-8" id="selfcare-nav-tabs">
        {selfCareActivities.map((act) => {
          const IconComponent = act.icon;
          const isActive = activeTab === act.id;
          return (
            <button
              key={act.id}
              onClick={() => {
                setActiveTab(act.id);
                stopWebAudio();
                setIsPlayingSound(false);
              }}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 shadow-sm cursor-pointer ${
                isActive 
                  ? 'bg-[#FFB6BD] text-[#4A121A] border-[#F89CA7] font-bold scale-105 shadow-sm' 
                  : 'bg-white text-text-minimal/60 border-accent-minimal hover:border-[#FFB6BD]'
              }`}
              id={`tab-select-${act.id}`}
            >
              <IconComponent className={`w-6 h-6 mb-1 ${isActive ? 'text-[#4A121A]' : 'text-text-minimal/50'}`} />
              <span className="text-[11px] font-semibold text-center leading-tight">{act.label}</span>
            </button>
          );
        })}
      </div>

      {/* Success Popup / Toast - Automatically Syncs to Achievements */}
      <AnimatePresence>
        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="mb-8 p-5 bg-white border border-[#F89CA7] rounded-3xl relative overflow-hidden shadow-sm flex items-start sm:items-center gap-4 pr-20"
            id="selfcare-success-popup"
          >
            <div className="absolute right-4 top-4 text-[#FFB6BD]/20 pointer-events-none z-0">
              <Sparkles className="w-24 h-24 text-[#FFB6BD]" />
            </div>
            <div className="p-3 bg-[#FFB6BD] border border-[#F89CA7] rounded-2xl text-[#4A121A] relative z-10 shrink-0">
              <Sparkles className="w-6 h-6 text-[#4A121A]" />
            </div>
            <div className="relative z-10 flex-1 pr-4 sm:pr-12 pb-1">
              <h3 className="font-bold text-text-minimal">Chúc mừng bạn đã hoàn thành! 🎉</h3>
              <p className="text-text-minimal/70 text-sm mt-1">{successMsg}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-xs bg-[#AFDCF1] text-[#1E3A5F] border border-[#8BC5E3] font-extrabold px-2.5 py-0.5 rounded-full shadow-sm">+1 Chấm Tròn Kiên Trì</span>
                <span className="text-xs bg-[#FFEEB6] text-[#4D3E00] border border-[#E8CF7A] font-extrabold px-2.5 py-0.5 rounded-full shadow-sm">+1 ⭐ Tích Lũy</span>
                <span className="text-[11px] text-[#4A121A] bg-[#FFD7D5] border border-[#F2B6B3] font-bold px-2.5 py-0.5 rounded-full">✨ Tích lũy Sao & Đồng bộ sang "Thành Tựu"</span>
              </div>
            </div>
            <button 
              onClick={() => setSuccessMsg(null)} 
              className="absolute right-4 bottom-4 bg-[#FFB6BD] hover:bg-[#FF8E98] text-[#4A121A] text-xs px-3.5 py-1.5 rounded-full font-bold cursor-pointer border border-[#F89CA7] transition-colors z-10"
              id="btn-close-success"
            >
              Đóng
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Tabs content */}
      <div className="bg-white/80 backdrop-blur rounded-[30px] border border-accent-minimal p-8 shadow-sm min-h-[400px] flex flex-col justify-between" id="selfcare-tab-body">
        
        {/* 1. WATER */}
        {activeTab === 'water' && (
          <div className="flex-1 flex flex-col items-center justify-center py-6" id="water-tab-content">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-serif text-text-minimal flex items-center justify-center gap-2 font-bold">
                <Droplet className="w-6 h-6 text-[#2B4212]" /> Uống Đủ Nước Hằng Ngày
              </h2>
              <p className="text-text-minimal/60 text-xs mt-1">Mục tiêu hôm nay: Uống đủ 8 cốc nước (khoảng 2 lít nước tinh khiết).</p>
            </div>

            {/* Glasses visualization */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-4 mb-8">
              {waterGlasses.map((filled, i) => (
                <button
                  key={i}
                  onClick={() => toggleGlass(i)}
                  className={`w-16 h-20 rounded-b-2xl rounded-t-lg border flex flex-col items-center justify-end p-2 transition-all relative overflow-hidden cursor-pointer ${
                    filled 
                      ? 'bg-[#C2D772]/50 border-[#A8BD55] scale-105 shadow-sm' 
                      : 'bg-bg-minimal hover:bg-accent-minimal/20 border-accent-minimal'
                  }`}
                  id={`btn-water-glass-${i}`}
                >
                  {/* Wave water simulation */}
                  <div 
                    className={`absolute bottom-0 left-0 right-0 transition-all duration-500 ${
                      filled ? 'h-3/4 bg-[#C2D772]' : 'h-0'
                    }`}
                  />
                  <span className="text-[10px] font-extrabold z-10 text-[#2B4212] mb-1">Cốc {i + 1}</span>
                  <Droplet className={`w-4 h-4 z-10 ${filled ? 'text-[#2B4212]' : 'text-text-minimal/40'}`} />
                </button>
              ))}
            </div>

            {/* Summary Progress */}
            <div className="w-full max-w-md bg-bg-minimal border border-accent-minimal p-4 rounded-2xl text-center">
              <span className="text-xs font-semibold text-text-minimal/80">Hôm nay bạn đã uống:</span>
              <div className="text-3xl font-serif text-[#2B4212] font-bold mt-1">
                {waterGlasses.filter(g => g).length} / 8 Cốc
              </div>
              <p className="text-xs text-text-minimal/60 mt-1">Chạm vào từng cốc để đánh dấu khi bạn uống xong nhé.</p>
              
              {/* Reminder Box */}
              <div className="mt-4 pt-3 border-t border-accent-minimal/60 text-[11px] text-text-minimal/80 flex items-center justify-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-[#2B4212]" />
                <span>Mẹo nhỏ: Hãy đặt một cốc nước ngay bàn học để luôn nhớ uống đủ nước hằng ngày!</span>
              </div>
            </div>
          </div>
        )}

        {/* 2. BREATHING */}
        {activeTab === 'breath' && (
          <div className="flex-1 flex flex-col items-center justify-center py-6" id="breath-tab-content">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-serif text-text-minimal flex items-center justify-center gap-2 font-bold">
                <Wind className="w-6 h-6 text-[#2B4212]" /> Nhịp Thở Bình Yên (Box Breathing)
              </h2>
              <p className="text-text-minimal/60 text-xs mt-1">Thả lỏng đôi vai, điều hòa nhịp tim và sạc đầy năng lượng tâm trí.</p>
            </div>

            {/* Duration Selector */}
            {!isBreathing && (
              <div className="flex gap-3 mb-8">
                {[60, 180, 300].map((dur) => (
                  <button
                    key={dur}
                    onClick={() => {
                      setBreathDuration(dur);
                      setBreathTimeLeft(dur);
                    }}
                    className={`px-4 py-2 rounded-full border text-sm font-semibold cursor-pointer transition-all ${
                      breathDuration === dur 
                        ? 'bg-[#C2D772] text-[#2B4212] border-[#A8BD55] font-bold shadow-sm' 
                        : 'bg-bg-minimal text-text-minimal border-accent-minimal hover:border-text-minimal/30'
                    }`}
                    id={`btn-breath-duration-${dur}`}
                  >
                    {dur / 60} Phút
                  </button>
                ))}
              </div>
            )}

            {/* Animated breathing circle */}
            <div className="relative w-48 h-48 flex items-center justify-center mb-8">
              <AnimatePresence>
                {isBreathing && (
                  <motion.div 
                    animate={{
                      scale: breathPhase === 'hít vào' ? [1, 1.4] : breathPhase === 'giữ lại' ? 1.4 : breathPhase === 'thở ra' ? [1.4, 1] : 1,
                    }}
                    transition={{
                      duration: 4,
                      ease: "easeInOut",
                      repeat: Infinity
                    }}
                    className="absolute inset-0 bg-[#C2D772]/30 rounded-full opacity-60"
                  />
                )}
              </AnimatePresence>

              <div className="w-36 h-36 bg-[#C2D772] text-[#2B4212] border-2 border-[#A8BD55] rounded-full flex flex-col items-center justify-center shadow-sm relative z-10">
                <span className="text-2xl font-extrabold font-mono">{formatTime(breathTimeLeft)}</span>
                <span className="text-xs font-bold uppercase tracking-wider mt-1">{breathPhase === 'chờ' ? 'Sẵn sàng' : breathPhase}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={toggleBreathing}
                className="flex items-center gap-2 bg-[#C2D772] hover:bg-[#B5CB65] text-[#2B4212] border border-[#A8BD55] font-extrabold px-8 py-3.5 rounded-full shadow-sm cursor-pointer transition-all"
                id="btn-start-breathing"
              >
                {isBreathing ? <Pause className="w-5 h-5 text-[#2B4212]" /> : <Play className="w-5 h-5 text-[#2B4212]" />}
                <span>{isBreathing ? 'Tạm dừng' : 'Bắt đầu ngay'}</span>
              </button>
              {isBreathing && (
                <button
                  onClick={() => {
                    if (breathTimerRef.current) clearInterval(breathTimerRef.current);
                    setIsBreathing(false);
                    setBreathPhase('chờ');
                    setBreathTimeLeft(breathDuration);
                  }}
                  className="p-3 bg-bg-minimal hover:bg-accent-minimal/20 text-text-minimal border border-accent-minimal rounded-full cursor-pointer"
                  id="btn-reset-breathing"
                  title="Đặt lại"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="mt-8 text-center text-xs text-text-minimal/60">
              Mẹo: Hít vào bằng mũi trong 4s, giữ hơi thở 4s, thở ra bằng miệng trong 4s, giữ trống rỗng 4s.
            </div>
          </div>
        )}

        {/* 3. WORKOUT */}
        {activeTab === 'workout' && (
          <div className="flex-1 flex flex-col md:flex-row gap-8 py-4" id="workout-tab-content">
            <div className="flex-1">
              <h2 className="text-xl font-serif text-text-minimal flex items-center gap-2 mb-4 font-bold">
                <Activity className="w-5 h-5 text-[#2B4212]" /> Thử Thách Vận Động Nhẹ Nhàng
              </h2>
              <p className="text-text-minimal/60 text-xs mb-6">Mỗi chuyển động nhỏ giúp tăng endorphin giải tỏa căng thẳng.</p>

              {/* Workout List */}
              <div className="flex flex-col gap-3">
                {exercises.map((ex) => (
                  <div 
                    key={ex.id}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                      ex.completed 
                        ? 'bg-[#C2D772]/30 border-[#A8BD55]' 
                        : selectedExForTimer === ex.id 
                          ? 'bg-bg-minimal border-[#A8BD55]' 
                          : 'bg-white border-accent-minimal hover:border-text-minimal/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${ex.completed ? 'bg-[#C2D772] text-[#2B4212] border border-[#A8BD55]' : 'bg-bg-minimal text-text-minimal/60'}`}>
                        {ex.completed ? <Check className="w-4 h-4 text-[#2B4212]" /> : <Activity className="w-4 h-4" />}
                      </div>
                      <div>
                        <h4 className="font-semibold text-text-minimal text-sm">{ex.name}</h4>
                        <span className="text-xs text-text-minimal/60">{ex.duration} phút</span>
                      </div>
                    </div>

                    <button
                      onClick={() => startExerciseTimer(ex)}
                      disabled={ex.completed}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        ex.completed 
                          ? 'bg-[#C2D772]/50 text-[#2B4212] border border-[#A8BD55] cursor-not-allowed' 
                          : 'bg-[#C2D772] hover:bg-[#B5CB65] text-[#2B4212] border border-[#A8BD55] shadow-sm'
                      }`}
                      id={`btn-workout-start-${ex.id}`}
                    >
                      {ex.completed ? 'Hoàn thành' : 'Tập ngay'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress ring & Timer details */}
            <div className="w-full md:w-80 bg-bg-minimal border border-accent-minimal rounded-3xl p-6 flex flex-col items-center justify-center">
              <span className="text-xs text-text-minimal/60 uppercase tracking-wider font-semibold mb-2">Đồng Hồ Vận Động</span>
              
              {/* Progress Circle Visualizer */}
              <div className="relative w-40 h-40 flex items-center justify-center mb-6">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="80" cy="80" r="70" className="stroke-accent-minimal fill-none" strokeWidth="6" />
                  <circle 
                    cx="80" 
                    cy="80" 
                    r="70" 
                    className="stroke-[#2B4212] fill-none transition-all duration-1000" 
                    strokeWidth="6" 
                    strokeDasharray={439.8}
                    strokeDashoffset={
                      selectedExForTimer 
                        ? 439.8 - (439.8 * (workoutTimer / (exercises.find(e => e.id === selectedExForTimer)!.duration * 60)))
                        : 439.8
                    }
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-2xl font-bold font-mono text-text-minimal">{formatTime(workoutTimer)}</span>
                  <span className="text-[10px] text-text-minimal/60">còn lại</span>
                </div>
              </div>

              {selectedExForTimer ? (
                <div className="text-center w-full">
                  <p className="text-sm font-bold text-text-minimal truncate mb-4 font-serif">
                    {exercises.find(e => e.id === selectedExForTimer)?.name}
                  </p>
                  <div className="flex gap-2 justify-center items-center">
                    <button
                      onClick={toggleExPlayPause}
                      className="p-3 bg-[#C2D772] hover:bg-[#B5CB65] text-[#2B4212] border border-[#A8BD55] rounded-full shadow-sm cursor-pointer"
                      id="btn-workout-pause"
                      title={isExRunning ? "Tạm dừng" : "Tiếp tục"}
                    >
                      {isExRunning ? <Pause className="w-4 h-4 text-[#2B4212]" /> : <Play className="w-4 h-4 text-[#2B4212]" />}
                    </button>
                    <button
                      onClick={() => {
                        if (exTimerRef.current) clearInterval(exTimerRef.current);
                        setIsExRunning(false);
                        setWorkoutTimer(0);
                        setSelectedExForTimer(null);
                      }}
                      className="p-3 bg-accent-minimal/40 hover:bg-accent-minimal/60 text-text-minimal rounded-full cursor-pointer"
                      id="btn-workout-cancel"
                      title="Đặt lại đồng hồ"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-text-minimal/60 text-center">Hãy chọn một bài tập nhẹ bên trái để bắt đầu đo thời gian.</p>
              )}
            </div>
          </div>
        )}

        {/* 4. SLEEP */}
        {activeTab === 'sleep' && (
          <div className="flex-1 flex flex-col items-center justify-center py-4" id="sleep-tab-content">
            <div className="flex flex-col sm:flex-row items-center justify-between w-full max-w-2xl mb-6 gap-4">
              <div className="text-center sm:text-left">
                <h2 className="text-2xl font-serif text-text-minimal flex items-center justify-center sm:justify-start gap-2 font-bold">
                  <Moon className="w-6 h-6 text-[#2B4212]" /> Đồng Hồ Giấc Ngủ Bình Yên
                </h2>
                <p className="text-text-minimal/60 text-xs mt-1">Theo dõi thời gian đi ngủ và chất lượng giấc ngủ để hồi phục hoàn hảo.</p>
              </div>
              <button
                onClick={() => setShowSleepJournalModal(true)}
                className="flex items-center gap-2 bg-[#C2D772] hover:bg-[#B5CB65] text-[#2B4212] border border-[#A8BD55] px-4 py-2 rounded-full text-xs font-extrabold shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
                id="btn-open-sleep-journal"
              >
                <BookOpen className="w-4 h-4 text-[#2B4212]" />
                <span>📖 Xem Nhật Ký Giấc Ngủ ({sleepLogs.length})</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-2xl mb-8">
              {/* Settings */}
              <div className="bg-bg-minimal border border-accent-minimal p-6 rounded-2xl flex flex-col gap-4">
                <h3 className="font-serif text-text-minimal text-sm font-bold mb-2">Cài Đặt Thời Gian</h3>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-minimal/80">Giờ đi ngủ dự kiến:</span>
                  <input 
                    type="time" 
                    value={bedtime} 
                    onChange={(e) => setBedtime(e.target.value)} 
                    className="border border-accent-minimal rounded-lg p-1.5 text-sm font-semibold bg-white cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-minimal/80">Giờ thức dậy dự kiến:</span>
                  <input 
                    type="time" 
                    value={wakeTime} 
                    onChange={(e) => setWakeTime(e.target.value)} 
                    className="border border-accent-minimal rounded-lg p-1.5 text-sm font-semibold bg-white cursor-pointer"
                  />
                </div>
                <div className="pt-2 border-t border-accent-minimal flex items-center justify-between">
                  <span className="text-xs text-text-minimal/80 font-medium">Tổng số giờ ngủ dự kiến:</span>
                  <span className="text-base font-extrabold text-[#2B4212]">{calculateSleepDurationHours(bedtime, wakeTime)}</span>
                </div>
              </div>

              {/* Quality Tracker */}
              <div className="bg-bg-minimal border border-accent-minimal p-6 rounded-2xl flex flex-col justify-between">
                <div>
                  <h3 className="font-serif text-text-minimal text-sm font-bold mb-2">Đánh Giá Giấc Ngủ Đêm Qua</h3>
                  <p className="text-[10px] text-text-minimal/60 mb-4">Bạn ngủ sâu không? Sáng thức dậy có sảng khoái không?</p>
                  
                  <div className="mt-4">
                    <div className="flex justify-between text-[10px] font-semibold text-text-minimal/80 mb-1">
                      <span>Rất mệt</span>
                      <span>Bình thường</span>
                      <span>Sảng khoái</span>
                    </div>
                    <input 
                      type="range" 
                      min="20" 
                      max="100" 
                      value={sleepQuality} 
                      onChange={(e) => setSleepQuality(parseInt(e.target.value))} 
                      className="w-full accent-[#2B4212] cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-4">
                  <button
                    onClick={handleSaveSleep}
                    className="w-full bg-[#C2D772] hover:bg-[#B5CB65] text-[#2B4212] border border-[#A8BD55] text-xs font-extrabold py-2.5 rounded-xl shadow-sm transition-all cursor-pointer text-center flex items-center justify-center gap-2"
                    id="btn-save-sleep"
                  >
                    <Check className="w-4 h-4 text-[#2B4212]" />
                    <span>Lưu giấc ngủ hôm nay</span>
                  </button>

                  <button
                    onClick={() => setShowSleepJournalModal(true)}
                    className="w-full bg-white hover:bg-bg-minimal text-text-minimal/80 border border-accent-minimal text-xs font-semibold py-2 rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
                    id="btn-view-sleep-journal-sub"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-text-minimal/60" />
                    <span>📖 Xem lịch sử Nhật Ký Giấc Ngủ ({sleepLogs.length})</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Smart Advice & Feedback Banner */}
            {sleepFeedback && (
              <motion.div 
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`w-full max-w-2xl p-4 rounded-2xl border text-xs font-semibold leading-relaxed mb-6 flex items-start gap-3 shadow-xs ${
                  sleepFeedback.isQualified
                    ? 'bg-[#C2D772]/30 border-[#A8BD55] text-[#2B4212]'
                    : 'bg-[#FFEEB6]/70 border-[#E8CF7A] text-[#4D3E00]'
                }`}
                id="sleep-feedback-banner"
              >
                <div className="text-xl flex-shrink-0 mt-0.5">
                  {sleepFeedback.isQualified ? '⭐' : '🌙'}
                </div>
                <div className="flex-1">
                  <div className="font-bold font-serif text-sm mb-1 flex items-center justify-between">
                    <span>{sleepFeedback.isQualified ? '🎉 Đạt Chuẩn Giấc Ngủ Lý Tưởng (+1 ⭐)' : '💡 Lời Khuyên Giấc Ngủ Cho Bạn'}</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-current opacity-80">
                      {sleepFeedback.totalHours.toFixed(1)} tiếng
                    </span>
                  </div>
                  <p className="text-xs opacity-90">{sleepFeedback.advice}</p>
                </div>
              </motion.div>
            )}

            {/* Suggestions Box */}
            <div className="w-full max-w-2xl bg-[#C2D772]/30 border border-[#A8BD55] p-5 rounded-2xl flex gap-3 items-start">
              <Sparkles className="w-5 h-5 text-[#2B4212] flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-serif text-text-minimal text-sm font-bold">Gợi ý giấc ngủ dịu dàng:</h4>
                <ul className="text-xs text-text-minimal/80 mt-1 list-disc pl-4 space-y-1">
                  <li>Không bấm điện thoại trước khi ngủ 30 phút. Sóng xanh làm não chậm tiết hormone ngủ melatonin.</li>
                  <li>Nếu trằn trọc không ngủ được, hãy thử nghe danh sách âm thanh thư giãn (Mưa rơi hoặc Sóng biển) ở góc bên cạnh.</li>
                  <li>Uống một ngụm nước ấm trước khi nằm xuống giường.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* 5. HEALTHY EATING */}
        {activeTab === 'eating' && (
          <div className="flex-1 flex flex-col items-center justify-center py-4" id="eating-tab-content">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-serif text-text-minimal flex items-center justify-center gap-2 font-bold">
                <Utensils className="w-6 h-6 text-[#2B4212]" /> Bữa Ăn Lành Mạnh Nuôi Dưỡng Cơ Thể
              </h2>
              <p className="text-text-minimal/60 text-xs mt-1">Yêu thương bản thân bắt đầu từ việc lựa chọn thực phẩm xanh và sạch hằng ngày.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-2xl">
              {/* Checklist */}
              <div className="bg-bg-minimal border border-accent-minimal p-6 rounded-2xl flex flex-col gap-4">
                <h3 className="font-serif text-text-minimal text-sm font-bold mb-2">Thực Đơn Lành Mạnh Hôm Nay</h3>
                
                <div className="flex flex-col gap-3">
                  {meals.map((meal) => (
                    <label 
                      key={meal.id} 
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        meal.checked ? 'bg-[#C2D772]/30 border-[#A8BD55] text-text-minimal' : 'bg-white border-accent-minimal hover:border-text-minimal/20'
                      }`}
                    >
                      <input 
                        type="checkbox" 
                        checked={meal.checked} 
                        onChange={() => toggleMeal(meal.id)}
                        className="w-4 h-4 rounded border-accent-minimal text-[#2B4212] focus:ring-[#2B4212]"
                      />
                      <span className="text-xs font-semibold">{meal.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Meal log visual */}
              <div className="bg-bg-minimal border border-accent-minimal p-6 rounded-2xl flex flex-col justify-between">
                <div>
                  <h3 className="font-serif text-text-minimal text-sm font-bold mb-2">Chỉ Số Dinh Dưỡng Hôm Nay</h3>
                  <div className="mt-4 flex justify-center py-4">
                    <div className="relative w-28 h-28 flex items-center justify-center bg-[#C2D772]/40 rounded-full border border-[#A8BD55]">
                      <Utensils className="w-10 h-10 text-[#2B4212]" />
                      <div className="absolute -bottom-1 -right-1 bg-[#C2D772] text-[#2B4212] border border-[#A8BD55] text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
                        {Math.round((meals.filter(m => m.checked).length / meals.length) * 100)}% Lành mạnh
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-text-minimal/80 text-center mt-2">Duy trì ăn uống lành mạnh giúp đường ruột khỏe mạnh và tâm trạng ổn định.</p>
                </div>

                <div className="text-[10px] text-text-minimal/60 text-center italic mt-4 font-serif">
                  "Let food be thy medicine, and medicine thy food."
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 6. READING */}
        {activeTab === 'reading' && (
          <div className="flex-1 flex flex-col gap-6 py-2" id="reading-tab-content">
            {/* Header */}
            <div className="bg-bg-minimal border border-accent-minimal/80 p-5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
              <div>
                <h2 className="text-xl font-serif text-text-minimal flex items-center gap-2 font-bold">
                  <BookOpen className="w-5 h-5 text-[#2B4212]" /> Góc Đọc Sách Nuôi Dưỡng Tâm Hồn
                </h2>
                <p className="text-text-minimal/70 text-xs mt-1">Mỗi trang sách hay như một ô cửa sổ đón ánh nắng ấm áp vào tâm trí bạn.</p>
              </div>

              {/* Sub-tabs Navigation */}
              <div className="flex items-center gap-2 bg-white/90 p-1.5 rounded-2xl border border-accent-minimal/80 shadow-2xs flex-shrink-0">
                <button
                  onClick={() => setReadingSubTab('my_book')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    readingSubTab === 'my_book'
                      ? 'bg-[#2B4212] text-white shadow-xs'
                      : 'text-text-minimal/70 hover:bg-bg-minimal'
                  }`}
                  id="subtab-my-book"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Sách Bạn Đang Đọc</span>
                  {bookTitle.trim() !== '' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </button>

                <button
                  onClick={() => setReadingSubTab('suggested_books')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    readingSubTab === 'suggested_books'
                      ? 'bg-[#2B4212] text-white shadow-xs'
                      : 'text-text-minimal/70 hover:bg-bg-minimal'
                  }`}
                  id="subtab-suggested-books"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Gợi Ý Sách Thấu Cảm</span>
                </button>
              </div>
            </div>

            {/* Sub-tab 1: SÁCH BẠN ĐANG ĐỌC (USER INPUT & TIMER) */}
            {readingSubTab === 'my_book' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                {/* CỘT TRÁI - GÓC ĐỌC SÁCH CỦA TÔI (My Reading Space) */}
                <div className="bg-bg-minimal border border-accent-minimal p-6 rounded-3xl flex flex-col justify-between shadow-2xs">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-accent-minimal/60 mb-5">
                      <h3 className="font-serif text-text-minimal text-base font-bold flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-[#2B4212]" /> Góc Đọc Sách Của Tôi
                      </h3>
                      {bookTitle.trim() !== '' ? (
                        <span className="text-[11px] bg-[#C2D772]/40 text-[#2B4212] border border-[#A8BD55] font-extrabold px-3 py-1 rounded-full">
                          Đã lưu sách ✨
                        </span>
                      ) : (
                        <span className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200/80 font-bold px-3 py-1 rounded-full">
                          Chưa nhập
                        </span>
                      )}
                    </div>

                    {/* Ô nhập tên sách - Nằm trên 1 hàng gọn gàng */}
                    <div className="mb-4">
                      <label htmlFor="input-user-book-title" className="text-xs font-bold text-text-minimal/80 mb-2 block">
                        Nhập tên cuốn sách bạn đang đọc thực tế:
                      </label>
                      <div className="flex gap-2 items-center">
                        <input 
                          type="text" 
                          placeholder="Ví dụ: Hiểu Về Trái Tim, Hoàng Tử Bé..." 
                          value={bookTitle} 
                          onChange={(e) => setBookTitle(e.target.value)} 
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveBookTitle()}
                          className="border border-accent-minimal rounded-2xl px-4 py-2.5 text-xs font-medium bg-white flex-1 text-text-minimal focus:outline-none focus:border-[#2B4212] shadow-2xs"
                          id="input-user-book-title"
                        />
                        <button
                          onClick={() => handleSaveBookTitle()}
                          className="bg-[#C2D772] hover:bg-[#B5CB65] text-[#2B4212] border border-[#A8BD55] font-extrabold text-xs px-4 py-2.5 rounded-2xl transition-all cursor-pointer shadow-2xs active:scale-95 flex items-center gap-1.5 flex-shrink-0"
                          id="btn-save-book-title"
                        >
                          <Check className="w-4 h-4" />
                          <span>Lưu</span>
                        </button>
                      </div>

                      {bookSavedToast && (
                        <motion.div 
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-2.5 text-[11px] font-bold text-[#2B4212] bg-[#C2D772]/30 border border-[#A8BD55] px-3.5 py-1.5 rounded-xl text-center shadow-2xs"
                        >
                          {bookSavedToast}
                        </motion.div>
                      )}
                    </div>

                    {/* Sách đang gắn với nhật ký đọc */}
                    <div className="p-3.5 bg-white border border-accent-minimal/80 rounded-2xl mb-5 flex items-center justify-between gap-3 shadow-2xs">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-extrabold text-text-minimal/50 uppercase tracking-wider block">Gắn với nhật ký đọc:</span>
                        <p className="text-xs font-bold text-[#2B4212] truncate mt-0.5">
                          {bookTitle.trim() !== '' ? `📖 "${bookTitle.trim()}"` : 'Chưa có tên sách. Nhập ở trên hoặc chọn gợi ý!'}
                        </p>
                      </div>
                      <button
                        onClick={() => setReadingSubTab('suggested_books')}
                        className="text-[11px] text-[#2B4212] font-bold underline hover:text-black cursor-pointer flex-shrink-0 whitespace-nowrap"
                      >
                        Gợi ý sách hay →
                      </button>
                    </div>

                    {/* Bộ đếm thời gian đọc sách */}
                    {!isReadRunning && (
                      <div className="flex gap-2 mb-3">
                        {[60, 300, 600, 900].map((dur) => (
                          <button
                            key={dur}
                            onClick={() => {
                              setReadDuration(dur);
                              setReadTimeLeft(dur);
                            }}
                            className={`px-3 py-1 rounded-full border text-xs font-semibold cursor-pointer transition-all ${
                              readDuration === dur 
                                ? 'bg-[#C2D772] text-[#2B4212] border-[#A8BD55] font-bold shadow-2xs' 
                                : 'bg-bg-minimal text-text-minimal border-accent-minimal hover:border-text-minimal/30'
                            }`}
                            id={`btn-read-duration-${dur}`}
                          >
                            {dur / 60} Phút
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="bg-white border border-accent-minimal p-4 rounded-2xl shadow-2xs mb-5 flex items-center justify-between gap-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-text-minimal/60 uppercase tracking-wider font-extrabold">Đồng hồ đọc sách</span>
                        <span className="text-2xl font-bold font-mono text-[#2B4212] mt-0.5 tracking-wider">{formatTime(readTimeLeft)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={toggleReadingTimer}
                          className={`px-5 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer shadow-2xs active:scale-95 flex-shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
                            isReadRunning 
                              ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                              : 'bg-[#C2D772] hover:bg-[#B5CB65] text-[#2B4212] border border-[#A8BD55]'
                          }`}
                          id="btn-toggle-reading-timer"
                        >
                          {isReadRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          <span>{isReadRunning ? 'Tạm dừng & Hủy' : 'Bắt đầu đếm giờ'}</span>
                        </button>
                        {isReadRunning && (
                          <button
                            onClick={() => {
                              if (readTimerRef.current) clearInterval(readTimerRef.current);
                              setIsReadRunning(false);
                              setReadTimeLeft(readDuration);
                            }}
                            className="p-2.5 bg-bg-minimal hover:bg-accent-minimal/20 text-text-minimal border border-accent-minimal rounded-2xl cursor-pointer"
                            id="btn-reset-reading-timer"
                            title="Đặt lại"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Lịch sử / Hành trình đọc gần đây */}
                  <div className="pt-4 border-t border-accent-minimal/60">
                    <h4 className="text-xs font-bold text-text-minimal/80 mb-2">Hành trình đọc gần đây:</h4>
                    {readHistory.length === 0 ? (
                      <p className="text-xs text-text-minimal/50 italic py-1">Hãy bật đếm giờ để ghi lại các mốc thời gian đọc sách của bạn.</p>
                    ) : (
                      <div className="flex flex-col gap-1.5 max-h-[110px] overflow-y-auto pr-1">
                        {readHistory.map((hist, i) => (
                          <div key={i} className="text-xs text-text-minimal/80 flex items-center gap-2 border-b border-accent-minimal/30 pb-1.5 last:border-0 last:pb-0">
                            <span className="w-1.5 h-1.5 bg-[#2B4212] rounded-full flex-shrink-0" />
                            <span className="truncate">{hist}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* CỘT PHẢI - KHO BÁU CÂU NÓI TRÂN QUÝ (Reading Quotes) */}
                <div className="bg-bg-minimal border border-accent-minimal rounded-3xl p-6 flex flex-col justify-between shadow-2xs min-h-[420px]">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-accent-minimal/60 mb-4">
                      <h3 className="font-serif text-text-minimal text-base font-bold flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-500" /> Kho Báu Câu Nói Trân Quý
                      </h3>
                      <span className="text-[10px] bg-white border border-accent-minimal text-text-minimal/70 font-bold px-2.5 py-0.5 rounded-full">
                        {favQuotes.length} câu đã lưu
                      </span>
                    </div>

                    <div className="flex flex-col gap-3 max-h-[260px] overflow-y-auto pr-1">
                      {favQuotes.length === 0 ? (
                        <div className="py-8 text-center">
                          <span className="text-3xl block mb-2">✨</span>
                          <p className="text-xs text-text-minimal/60 italic max-w-xs mx-auto">
                            Chưa có câu nói nào. Hãy lưu lại những trích dẫn sâu sắc chạm đến trái tim bạn!
                          </p>
                        </div>
                      ) : (
                        favQuotes.map((q, i) => (
                          <div key={i} className="p-3.5 bg-white border border-accent-minimal/80 rounded-2xl text-xs text-text-minimal/90 italic font-serif leading-relaxed shadow-2xs">
                            {q}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Input field + Add quote button anchored at the bottom */}
                  <div className="mt-5 pt-4 border-t border-accent-minimal/60 flex flex-col gap-2.5">
                    <label htmlFor="input-new-quote" className="text-xs font-bold text-text-minimal/80">
                      Trích dẫn câu nói hay từ trang sách:
                    </label>
                    <input 
                      id="input-new-quote"
                      type="text" 
                      placeholder="Nhập câu nói chạm đến cảm xúc của bạn..." 
                      value={newQuote} 
                      onChange={(e) => setNewQuote(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addQuote()}
                      className="border border-accent-minimal rounded-2xl p-3 text-xs bg-white focus:ring-1 focus:ring-[#2B4212] focus:outline-none text-text-minimal shadow-2xs"
                    />
                    <button 
                      onClick={addQuote}
                      className="bg-[#C2D772] hover:bg-[#B5CB65] text-[#2B4212] border border-[#A8BD55] text-xs font-extrabold py-2.5 rounded-2xl cursor-pointer transition-all shadow-2xs active:scale-98 flex items-center justify-center gap-1.5"
                      id="btn-add-reading-quote"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Thêm vào kho báu câu nói</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tab 2: GỢI Ý SÁCH THẤU CẢM (CURATED REAL BOOKS) */}
            {readingSubTab === 'suggested_books' && (
              <div className="space-y-5">
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 p-5 border border-emerald-200/80 rounded-3xl shadow-2xs">
                  <h3 className="text-base font-serif font-extrabold text-[#124B31] flex items-center gap-2">
                    <Sparkles className="w-4.5 h-4.5 text-emerald-600" /> Danh Sách Sách Chữa Lành Kinh Điển (Thực Tế 100%)
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Những cuốn sách nối tiếng nhất về chăm sóc tinh thần và chữa lành nội tâm. Bạn có thể chọn ngay một cuốn để đưa vào mục sách đang đọc của mình.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {suggestedBooks.map((book) => {
                    const isCurrent = bookTitle.trim().toLowerCase() === book.title.trim().toLowerCase();
                    return (
                      <div 
                        key={book.id} 
                        className={`p-5 rounded-3xl border bg-gradient-to-br ${book.bgGradient} flex flex-col justify-between shadow-2xs hover:shadow-md transition-all`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <span className="text-3xl p-2.5 bg-white/90 rounded-2xl border border-white shadow-2xs">{book.emoji}</span>
                            {isCurrent ? (
                              <span className="text-[10px] bg-emerald-700 text-white font-extrabold px-3 py-1 rounded-full shadow-2xs flex items-center gap-1">
                                <Check className="w-3 h-3" /> Đang đọc
                              </span>
                            ) : (
                              <span className="text-[10px] bg-white/80 text-slate-600 font-bold px-2.5 py-1 rounded-full border border-slate-200">
                                Sách thực tế 100%
                              </span>
                            )}
                          </div>
                          <h4 className="font-serif font-bold text-slate-800 text-base leading-snug">{book.title}</h4>
                          <span className="text-xs text-slate-600 font-semibold block mt-1">Tác giả: <strong className="text-slate-800">{book.author}</strong></span>
                          <p className="text-xs text-slate-600 italic mt-3 leading-relaxed bg-white/80 p-3.5 rounded-2xl border border-white/90 shadow-2xs">
                            "{book.summary}"
                          </p>
                        </div>

                        <button
                          onClick={() => handleSelectSuggestedBook(book)}
                          disabled={isCurrent}
                          className={`mt-5 w-full py-2.5 px-4 rounded-2xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs whitespace-nowrap ${
                            isCurrent
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 hover:border-slate-400 active:scale-98'
                          }`}
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>{isCurrent ? 'Cuốn sách hiện tại của bạn' : 'Thêm vào sách đang đọc'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 7. RELAXATION SOUND */}
        {activeTab === 'relax' && (
          <div className="flex-1 flex flex-col items-center justify-center py-4" id="relax-tab-content">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-serif text-text-minimal flex items-center justify-center gap-2 font-bold">
                <Music className="w-6 h-6 text-[#2B4212]" /> Không Gian Âm Thanh Thư Giãn
              </h2>
              <p className="text-text-minimal/60 text-xs mt-1">Chọn một dải tần số êm dịu để giải tỏa bớt những ồn ào mệt mỏi trong đầu.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 w-full max-w-2xl mb-8">
              {availableSounds.map((sound) => {
                const isSelected = selectedSound === sound.id;
                const isThisPlaying = isSelected && isPlayingSound;
                return (
                  <button
                    key={sound.id}
                    onClick={() => {
                      if (selectedSound === sound.id) {
                        const nextPlaying = !isPlayingSound;
                        setIsPlayingSound(nextPlaying);
                        if (nextPlaying) {
                          window.dispatchEvent(new CustomEvent('stop-ambient-audio'));
                          if (['rain', 'ocean', 'nature', 'keyboard', 'lofi'].includes(sound.id)) {
                            playMp3Sound(sound.id);
                          } else {
                            stopMp3Sound();
                            playWebAudio(sound.id);
                          }
                        } else {
                          pauseMp3Sound();
                          stopWebAudio();
                        }
                      } else {
                        setSelectedSound(sound.id);
                        setIsPlayingSound(true);
                        window.dispatchEvent(new CustomEvent('stop-ambient-audio'));
                        if (['rain', 'ocean', 'nature', 'keyboard', 'lofi'].includes(sound.id)) {
                          setSoundVolume(60);
                          playMp3Sound(sound.id);
                        } else {
                          stopMp3Sound();
                          playWebAudio(sound.id);
                        }
                      }
                    }}
                    className={`p-4 rounded-2xl border flex flex-col items-center text-center transition-all cursor-pointer relative ${
                      isSelected 
                        ? 'bg-[#C2D772]/50 border-[#A8BD55] shadow-sm ring-2 ring-[#2B4212]/20' 
                        : 'bg-bg-minimal hover:bg-accent-minimal/20 border-accent-minimal'
                    }`}
                    id={`btn-sound-${sound.id}`}
                  >
                    {isThisPlaying && (
                      <span className="absolute top-2.5 right-2.5 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2B4212] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#2B4212]"></span>
                      </span>
                    )}
                    <span className="text-3xl mb-1">{sound.emoji}</span>
                    <span className="text-xs font-extrabold text-[#2B4212]">{sound.label}</span>
                    <span className="text-[9px] text-text-minimal/60 mt-0.5">{sound.desc}</span>
                  </button>
                );
              })}
            </div>

            {/* Simulated Player UI */}
            <div className="bg-bg-minimal border border-accent-minimal p-6 rounded-2xl w-full max-w-md flex flex-col items-center">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2.5 h-2.5 rounded-full ${isPlayingSound ? 'bg-[#2B4212] animate-ping' : 'bg-text-minimal/30'}`} />
                <span className="text-xs font-semibold text-text-minimal/80">
                  {isPlayingSound ? 'Đang phát...' : 'Đang dừng'} {isPlayingSound && `- ${availableSounds.find(s => s.id === selectedSound)?.label || selectedSound}`}
                </span>
              </div>

              {/* Visual Equalizer Mockup */}
              <div className="flex gap-1 items-end h-8 mb-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((bar) => (
                  <motion.div 
                    key={bar}
                    animate={isPlayingSound ? {
                      height: [8, Math.random() * 24 + 8, 8]
                    } : { height: 8 }}
                    transition={{
                      duration: 0.5 + (bar * 0.05),
                      repeat: Infinity,
                      ease: 'easeInOut'
                    }}
                    className="w-1.5 bg-[#2B4212] rounded-full"
                  />
                ))}
              </div>

              {/* Volume Slider & Toggle */}
              <div className="flex items-center justify-between w-full mt-2 pt-3 border-t border-accent-minimal/60">
                <span className="text-xs text-text-minimal/70 font-semibold">Âm lượng:</span>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={soundVolume} 
                  onChange={(e) => setSoundVolume(parseInt(e.target.value))}
                  className="w-1/2 accent-[#2B4212] cursor-pointer"
                />
                <button
                  onClick={() => {
                    const nextPlaying = !isPlayingSound;
                    setIsPlayingSound(nextPlaying);
                    if (nextPlaying) {
                      window.dispatchEvent(new CustomEvent('stop-ambient-audio'));
                      if (['rain', 'ocean', 'nature', 'keyboard', 'lofi'].includes(selectedSound)) {
                        playMp3Sound(selectedSound);
                      } else {
                        stopMp3Sound();
                        playWebAudio(selectedSound);
                      }
                    } else {
                      pauseMp3Sound();
                      stopWebAudio();
                    }
                  }}
                  className="flex items-center gap-1.5 bg-[#C2D772] hover:bg-[#B5CB65] text-[#2B4212] border border-[#A8BD55] text-xs font-extrabold px-4 py-2 rounded-full shadow-sm cursor-pointer transition-all"
                  id="btn-play-pause-sound"
                >
                  {isPlayingSound ? <Pause className="w-3.5 h-3.5 text-[#2B4212]" /> : <Play className="w-3.5 h-3.5 text-[#2B4212]" />}
                  <span>{isPlayingSound ? 'Tạm dừng' : 'Phát'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 8. GRATITUDE */}
        {activeTab === 'gratitude' && (
          <div className="flex-1 flex flex-col items-center justify-center py-4" id="gratitude-tab-content">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-serif text-text-minimal flex items-center justify-center gap-2 font-bold">
                <Heart className="w-6 h-6 text-[#2B4212] animate-pulse" /> 3 Điều Biết Ơn Hôm Nay
              </h2>
              <p className="text-text-minimal/60 text-xs mt-1">Viết ra 3 điều nhỏ khiến bạn cảm thấy may mắn, vui tươi hoặc trân trọng ngày hôm nay.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl mb-8">
              {[1, 2, 3].map((num) => {
                const key = `card${num}` as 'card1' | 'card2' | 'card3';
                return (
                  <div 
                    key={num} 
                    className="bg-[#C2D772]/10 border border-[#A8BD55] rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col min-h-[160px] justify-between relative overflow-hidden"
                  >
                    <div className="absolute right-3 top-3 text-[#2B4212]/10">
                      <Heart className="w-12 h-12" />
                    </div>
                    <span className="text-xs font-extrabold text-[#2B4212] tracking-wider">ĐIỀU BIẾT ƠN {num}</span>
                    <textarea
                      placeholder="Một điều khiến mình khẽ cười hôm nay..."
                      value={gratitudeTexts[key]}
                      disabled={gratitudeSaved}
                      onChange={(e) => setGratitudeTexts({ ...gratitudeTexts, [key]: e.target.value })}
                      className="w-full bg-transparent border-0 focus:ring-0 text-text-minimal text-sm mt-3 placeholder-text-minimal/40 resize-none h-20 outline-none font-serif leading-relaxed"
                    />
                  </div>
                );
              })}
            </div>

            <button
              onClick={saveGratitude}
              disabled={gratitudeSaved}
              className={`flex items-center gap-2 font-extrabold px-8 py-3.5 rounded-full shadow-sm transition-all cursor-pointer ${
                gratitudeSaved 
                  ? 'bg-[#C2D772]/50 text-[#2B4212] border border-[#A8BD55] cursor-not-allowed' 
                  : 'bg-[#C2D772] hover:bg-[#B5CB65] text-[#2B4212] border border-[#A8BD55]'
              }`}
              id="btn-save-gratitude"
            >
              {gratitudeSaved ? <Check className="w-5 h-5 text-[#2B4212]" /> : <Sparkles className="w-5 h-5 text-[#2B4212]" />}
              <span>{gratitudeSaved ? 'Đã gieo mầm biết ơn!' : 'Gửi lời biết ơn vào vũ trụ'}</span>
            </button>
          </div>
        )}

        {/* 9. MEDITATION */}
        {activeTab === 'meditation' && (
          <div className="flex-1 flex flex-col items-center justify-center py-4" id="meditation-tab-content">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-serif text-text-minimal flex items-center justify-center gap-2 font-bold">
                <Sun className="w-6 h-6 text-[#2B4212]" /> Thiền Định Tĩnh Lặng
              </h2>
              <p className="text-text-minimal/60 text-xs mt-1">Dành vài phút trút bỏ mọi suy nghĩ bận rộn để hoàn toàn ở trong khoảnh khắc này.</p>
            </div>

            {/* Time selection */}
            {!isMedRunning && (
              <div className="flex gap-3 mb-8">
                {[180, 300, 600].map((dur) => (
                  <button
                    key={dur}
                    onClick={() => {
                      setMedTime(dur);
                      setMedTimeLeft(dur);
                    }}
                    className={`px-4 py-2 rounded-full border text-sm font-semibold cursor-pointer transition-all ${
                      medTime === dur 
                        ? 'bg-[#C2D772] text-[#2B4212] border-[#A8BD55] font-bold shadow-sm' 
                        : 'bg-bg-minimal text-text-minimal border-accent-minimal hover:border-text-minimal/30'
                    }`}
                    id={`btn-med-duration-${dur}`}
                  >
                    {dur / 60} Phút
                  </button>
                ))}
              </div>
            )}

            {/* Floating flower animation for meditation */}
            <div className="relative w-44 h-44 flex items-center justify-center mb-8">
              <AnimatePresence>
                {isMedRunning && (
                  <>
                    <motion.div 
                      animate={{
                        scale: [1, 1.3, 1],
                        rotate: [0, 45, 90]
                      }}
                      transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: 'easeInOut'
                      }}
                      className="absolute inset-0 bg-[#C2D772]/30 rounded-2xl opacity-60"
                    />
                    <motion.div 
                      animate={{
                        scale: [1, 1.15, 1],
                        rotate: [0, -30, -60]
                      }}
                      transition={{
                        duration: 6,
                        repeat: Infinity,
                        ease: 'easeInOut'
                      }}
                      className="absolute inset-2 bg-[#C2D772]/20 rounded-full opacity-60 border border-[#A8BD55]"
                    />
                  </>
                )}
              </AnimatePresence>

              <div className="w-32 h-32 bg-[#C2D772] text-[#2B4212] border-2 border-[#A8BD55] rounded-full flex flex-col items-center justify-center shadow-sm relative z-10">
                <span className="text-2xl font-extrabold font-mono">{formatTime(medTimeLeft)}</span>
                <span className="text-xs font-bold uppercase tracking-wider mt-1">{isMedRunning ? 'Đang lắng nghe' : 'Thiền định'}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
              <button
                onClick={toggleMeditation}
                className="flex items-center gap-2 bg-[#C2D772] hover:bg-[#B5CB65] text-[#2B4212] border border-[#A8BD55] font-extrabold px-8 py-3.5 rounded-full shadow-sm cursor-pointer transition-all"
                id="btn-start-meditation"
              >
                {isMedRunning ? <Pause className="w-5 h-5 text-[#2B4212]" /> : <Play className="w-5 h-5 text-[#2B4212]" />}
                <span>{isMedRunning ? 'Tạm dừng' : 'Bắt đầu ngồi thiền'}</span>
              </button>
              {isMedRunning && (
                <button
                  onClick={() => {
                    if (medTimerRef.current) clearInterval(medTimerRef.current);
                    setIsMedRunning(false);
                    setMedTimeLeft(medTime);
                  }}
                  className="p-3 bg-bg-minimal hover:bg-accent-minimal/20 text-text-minimal border border-accent-minimal rounded-full cursor-pointer"
                  id="btn-reset-meditation"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 10: TIKTOK & PODCAST HEALING CLIPS */}
        {activeTab === 'tiktok' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <HealingVideoHub onAddCircle={onAddCircle} />
          </motion.div>
        )}

      </div>

      {/* Sleep Journal Modal */}
      <AnimatePresence>
        {showSleepJournalModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowSleepJournalModal(false)}
            id="sleep-journal-modal-overlay"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-accent-minimal rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-xl max-h-[85vh] flex flex-col relative"
              id="sleep-journal-modal-content"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-accent-minimal mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#C2D772]/40 text-[#2B4212] border border-[#A8BD55] rounded-2xl">
                    <Moon className="w-6 h-6 text-[#2B4212]" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-xl text-text-minimal">📖 Nhật Ký Giấc Ngủ</h3>
                    <p className="text-xs text-text-minimal/60 mt-0.5">Lịch sử theo dõi thời gian ngủ và mức độ hồi phục năng lượng</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSleepJournalModal(false)}
                  className="p-2 text-text-minimal/60 hover:text-text-minimal hover:bg-accent-minimal/30 rounded-full transition-colors cursor-pointer"
                  id="btn-close-sleep-journal-x"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Table / List */}
              <div className="flex-1 overflow-y-auto pr-1">
                {sleepLogs.length === 0 ? (
                  <div className="text-center py-12 text-text-minimal/60">
                    <Moon className="w-12 h-12 text-text-minimal/30 mx-auto mb-3" />
                    <p className="text-sm font-semibold">Chưa có nhật ký giấc ngủ nào.</p>
                    <p className="text-xs mt-1">Hãy bấm "Lưu giấc ngủ hôm nay" sau khi theo dõi để ghi lại vào nhật ký nhé!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-accent-minimal/60 text-text-minimal/60 bg-bg-minimal/60">
                          <th className="py-3 px-3 font-extrabold uppercase tracking-wider">Ngày tháng</th>
                          <th className="py-3 px-3 font-extrabold uppercase tracking-wider">Thời gian ngủ</th>
                          <th className="py-3 px-3 font-extrabold uppercase tracking-wider">Đánh giá cảm nhận</th>
                          <th className="py-3 px-3 font-extrabold uppercase tracking-wider min-w-[200px]">Lời khuyên giấc ngủ</th>
                          <th className="py-3 px-3 font-extrabold uppercase tracking-wider text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-accent-minimal/40">
                        {sleepLogs.map((log) => {
                          const duration = log.durationHours ?? (parseFloat(log.hours) || 8.0);
                          const isStd = log.isQualified ?? (duration >= 6.0 && duration <= 8.0);
                          const adviceText = log.advice || (
                            duration < 6.0
                              ? 'Giấc ngủ của bạn hơi ngắn (dưới 6 tiếng). Thiếu ngủ có thể khiến cơ thể mệt mỏi và giảm tập trung. Hãy thử sắp xếp đi ngủ sớm hơn để nạp đủ năng lượng nhé! 🌙'
                              : duration > 8.0
                                ? 'Thời gian ngủ của bạn hơi nhiều (trên 8 tiếng). Ngủ quá nhiều đôi khi làm cơ thể uể oải và nặng nề. Bạn nên duy trì mức ngủ 7–8 tiếng mỗi đêm để luôn tỉnh táo và sảng khoái nhé! 🌿'
                                : 'Tuyệt vời! Bạn đã duy trì giấc ngủ lý tưởng (từ 6 đến 8 tiếng). Cơ thể và tâm trí bạn đã được tái tạo năng lượng hoàn hảo! ✨'
                          );

                          return (
                            <tr key={log.id} className="hover:bg-bg-minimal/40 transition-colors">
                              <td className="py-3.5 px-3 font-bold text-text-minimal whitespace-nowrap">
                                <div>{log.date}</div>
                                <div className="text-[10px] text-text-minimal/60 font-normal mt-0.5">
                                  {log.bedtime} - {log.wakeTime}
                                </div>
                              </td>
                              <td className="py-3.5 px-3 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-[#2B4212] bg-[#C2D772]/30 border border-[#A8BD55] px-2 py-0.5 rounded-md">
                                    {log.hours}
                                  </span>
                                  {isStd ? (
                                    <span className="text-[10px] font-bold text-[#2B4212] bg-[#C2D772]/40 border border-[#A8BD55] px-2 py-0.5 rounded-full whitespace-nowrap">
                                      Đạt chuẩn ⭐
                                    </span>
                                  ) : duration < 6.0 ? (
                                    <span className="text-[10px] font-bold text-[#4D3E00] bg-[#FFEEB6] border border-[#E8CF7A] px-2 py-0.5 rounded-full whitespace-nowrap">
                                      &lt; 6 tiếng
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-[#5A1A24] bg-[#FFD7D5] border border-[#F2B6B3] px-2 py-0.5 rounded-full whitespace-nowrap">
                                      &gt; 8 tiếng
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3.5 px-3 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                  log.qualityScore > 75 
                                    ? 'bg-[#C2D772]/40 text-[#2B4212] border-[#A8BD55]' 
                                    : log.qualityScore > 40 
                                      ? 'bg-[#FFEEB6] text-[#4D3E00] border-[#E8CF7A]' 
                                      : 'bg-[#FFD7D5] text-[#5A1A24] border-[#F2B6B3]'
                                }`}>
                                  <span>{log.qualityEmoji}</span>
                                  <span>{log.qualityLabel}</span>
                                  <span className="opacity-70 text-[10px]">({log.qualityScore}/100)</span>
                                </span>
                              </td>
                              <td className="py-3.5 px-3 text-text-minimal/85 text-[11px] leading-relaxed max-w-xs">
                                <p className="line-clamp-3">{adviceText}</p>
                              </td>
                              <td className="py-3.5 px-3 text-right whitespace-nowrap">
                                <button
                                  onClick={() => deleteSleepLog(log.id)}
                                  className="p-1.5 text-text-minimal/40 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Xóa nhật ký"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-4 mt-4 border-t border-accent-minimal flex items-center justify-between">
                <span className="text-xs text-text-minimal/60">
                  Tổng cộng: <strong className="text-text-minimal">{sleepLogs.length}</strong> nhật ký giấc ngủ
                </span>
                <button 
                  onClick={() => setShowSleepJournalModal(false)}
                  className="bg-[#C2D772] hover:bg-[#B5CB65] text-[#2B4212] border border-[#A8BD55] text-xs font-bold px-5 py-2 rounded-full shadow-sm cursor-pointer transition-all"
                  id="btn-close-sleep-journal-footer"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
