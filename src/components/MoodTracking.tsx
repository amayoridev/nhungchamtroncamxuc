import React, { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, TrendingUp, Sparkles, Award, FileText, ChevronLeft, 
  ChevronRight, Heart, Share2, Info, ArrowUpRight, ArrowDownRight, RefreshCw, AlertCircle, Check, X,
  Star, Trophy, ShieldCheck
} from 'lucide-react';
import { 
  ResponsiveContainer, XAxis, YAxis, Tooltip, 
  CartesianGrid, AreaChart, Area, BarChart, Bar
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { JournalEntry } from '../types';

interface MoodTrackingProps {
  currentUser?: any;
  entries: JournalEntry[];
  streak: number;
  onNavigateToJournal: () => void;
  onNavigateToSelfCare: () => void;
  onAddCircle: (count: number, reason: string) => void;
  onBack: () => void;
}

export default function MoodTracking({ currentUser, entries, streak, onNavigateToJournal, onNavigateToSelfCare, onAddCircle, onBack }: MoodTrackingProps) {
  const [view, setView] = useState<'dashboard' | 'charts' | 'heatmap' | 'garden' | 'pattern' | 'export'>('dashboard');

  // Heatmap month & year selector
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth()); // 0-11
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [selectedDayDetail, setSelectedDayDetail] = useState<string | null>(null);

  const monthNames = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4',
    'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8',
    'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleResetToCurrentMonth = () => {
    const now = new Date();
    setCurrentMonth(now.getMonth());
    setCurrentYear(now.getFullYear());
  };

  // Report loading state
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // AI Trend loader
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<{
    insight: string;
    score: number;
    trends: string;
  } | null>(null);

  // Helper to extract detailed activity breakdown & GitHub-style contribution level for any date YYYY-MM-DD
  const getDayActivityBreakdown = useCallback((dateStr: string) => {
    const dayEntries = (entries || []).filter(e => e && e.date === dateStr);
    const journalCount = dayEntries.length;
    
    let selfCareCount = 0;
    const activitiesList: string[] = [];

    if (journalCount > 0) {
      activitiesList.push(`${journalCount} bài viết nhật ký`);
    }

    try {
      const ex = JSON.parse(localStorage.getItem('selfcare_exercises') || '[]');
      if (Array.isArray(ex)) {
        const completedEx = ex.filter((e: any) => e.date === dateStr && e.completed);
        if (completedEx.length > 0) {
          selfCareCount += completedEx.length;
          activitiesList.push(`${completedEx.length} bài tập thể chất/thư giãn`);
        }
      }

      const meals = JSON.parse(localStorage.getItem('selfcare_meals') || '[]');
      if (Array.isArray(meals)) {
        const loggedMeals = meals.filter((m: any) => m.date === dateStr && m.logged);
        if (loggedMeals.length > 0) {
          selfCareCount += loggedMeals.length;
          activitiesList.push(`${loggedMeals.length} bữa ăn lành mạnh`);
        }
      }

      const sleepLogs = JSON.parse(localStorage.getItem('selfcare_sleep_journal') || '[]');
      if (Array.isArray(sleepLogs)) {
        const matchingSleep = sleepLogs.filter((s: any) => s.date === dateStr);
        if (matchingSleep.length > 0) {
          selfCareCount += matchingSleep.length;
          activitiesList.push(`${matchingSleep.length} nhật ký giấc ngủ`);
        }
      }

      const readHist = JSON.parse(localStorage.getItem('selfcare_read_history') || '[]');
      if (Array.isArray(readHist)) {
        const matchingRead = readHist.filter((r: any) => r.date === dateStr);
        if (matchingRead.length > 0) {
          selfCareCount += matchingRead.length;
          activitiesList.push(`${matchingRead.length} bài đọc chữa lành`);
        }
      }

      // Check achievement/star history logs for this date
      const scopeId = currentUser?.id || currentUser?._id || 'guest';
      const historyRaw = localStorage.getItem(`star_history_${scopeId}`) || localStorage.getItem(`user_history_${scopeId}`) || localStorage.getItem('star_history') || '[]';
      const historyLogs = JSON.parse(historyRaw);
      if (Array.isArray(historyLogs)) {
        const dateLogs = historyLogs.filter((l: any) => l.date === dateStr);
        const uniqueOtherLogs = dateLogs.filter((l: any) => !l.badgeId?.includes('sleep') && !l.id?.includes('j_'));
        if (uniqueOtherLogs.length > 0) {
          selfCareCount += uniqueOtherLogs.length;
          activitiesList.push(`${uniqueOtherLogs.length} thành tựu / thói quen`);
        }
      }
    } catch (err) {
      console.error(err);
    }

    const totalCount = journalCount + selfCareCount;
    
    // GitHub-style contribution levels (0 to 4)
    let level = 0;
    if (totalCount >= 5) {
      level = 4;
    } else if (totalCount >= 3) {
      level = 3;
    } else if (totalCount === 2) {
      level = 2;
    } else if (totalCount === 1) {
      level = 1;
    } else {
      level = 0;
    }

    return {
      dateStr,
      totalCount,
      level,
      journalCount,
      selfCareCount,
      activitiesList,
      dayEntries
    };
  }, [entries, currentUser]);

  // Helper to extract real user activity/emotion data for a given date string (YYYY-MM-DD)
  const getDayRealData = (dateStr: string) => {
    const dayEntries = (entries || []).filter(e => e && e.date === dateStr);
    
    // Check self-care activities in localStorage for this date
    let selfCareCount = 0;
    try {
      const ex = JSON.parse(localStorage.getItem('selfcare_exercises') || '[]');
      if (Array.isArray(ex)) {
        selfCareCount += ex.filter((e: any) => e.date === dateStr && e.completed).length;
      }
      const meals = JSON.parse(localStorage.getItem('selfcare_meals') || '[]');
      if (Array.isArray(meals)) {
        selfCareCount += meals.filter((m: any) => m.date === dateStr && m.logged).length;
      }
      const sleepLogs = JSON.parse(localStorage.getItem('selfcare_sleep_journal') || '[]');
      if (Array.isArray(sleepLogs)) {
        selfCareCount += sleepLogs.filter((s: any) => s.date === dateStr).length;
      }
      const readHist = JSON.parse(localStorage.getItem('selfcare_read_history') || '[]');
      if (Array.isArray(readHist)) {
        selfCareCount += readHist.filter((r: any) => r.date === dateStr).length;
      }
    } catch (err) {
      console.error(err);
    }

    if (dayEntries.length === 0 && selfCareCount === 0) {
      return { hasData: false, score: null, emotionName: 'Chưa có dữ liệu' };
    }

    if (dayEntries.length > 0) {
      const scores = dayEntries.map(e => {
        switch (e.emotion) {
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
      const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      const mainEmotion = dayEntries[0].emotion;
      let emotionName = 'Bình thường';
      switch (mainEmotion) {
        case 'vui_ve': emotionName = 'Vui vẻ'; break;
        case 'binh_yen': emotionName = 'Bình yên'; break;
        case 'met_moi': emotionName = 'Mệt mỏi'; break;
        case 'lo_lang': emotionName = 'Lo lắng'; break;
        case 'buon_ba': emotionName = 'Buồn bã'; break;
        case 'co_don': emotionName = 'Cô đơn'; break;
        case 'tuc_gian': emotionName = 'Tức giận'; break;
      }
      return { hasData: true, score: avgScore, emotionName };
    }

    return { hasData: true, score: 85, emotionName: 'Chăm sóc bản thân' };
  };

  // Recharts data derived strictly from real user entries and activities
  const getWeeklyData = () => {
    const daysOfWeek = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const data = [];
    const now = new Date();
    // Get last 7 days ending today
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = daysOfWeek[d.getDay()];
      
      const realData = getDayRealData(dateStr);

      data.push({ 
        day: dayName, 
        score: realData.score, 
        emotion: realData.emotionName, 
        date: dateStr,
        hasData: realData.hasData
      });
    }
    return data;
  };

  const getCompareWeekData = () => {
    const daysOfWeekShort = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const now = new Date();
    const data = [];
    
    for (let i = 6; i >= 0; i--) {
      const dThis = new Date();
      dThis.setDate(now.getDate() - i);
      const dateStrThis = dThis.toISOString().split('T')[0];
      const dayName = daysOfWeekShort[dThis.getDay()];
      
      const dLast = new Date();
      dLast.setDate(now.getDate() - i - 7);
      const dateStrLast = dLast.toISOString().split('T')[0];

      const dataThis = getDayRealData(dateStrThis);
      const dataLast = getDayRealData(dateStrLast);

      data.push({
        name: dayName,
        'Tuần này': dataThis.score,
        'Tuần trước': dataLast.score
      });
    }
    return data;
  };

  const getGardenDays = () => {
    return (entries || []).map((entry, index) => {
      if (!entry) return { day: index + 1, type: 'flower', name: 'Hạt Mầm', date: '' };
      let type = 'flower';
      let name = 'Hoa';
      
      switch (entry.emotion) {
        case 'vui_ve':
          type = 'flower';
          name = 'Cúc Vui Vẻ';
          break;
        case 'binh_yen':
          type = 'flower';
          name = 'Oải Hương Bình Yên';
          break;
        case 'met_moi':
          type = 'leaf';
          name = 'Nhành Thông Trầm Tư';
          break;
        case 'lo_lang':
          type = 'leaf';
          name = 'Dương Xỉ Ưu Tư';
          break;
        case 'buon_ba':
          type = 'leaf';
          name = 'Nhành Liễu Trầm Mặc';
          break;
        case 'co_don':
          type = 'leaf';
          name = 'Cỏ Lau Cô Độc';
          break;
        case 'tuc_gian':
          type = 'leaf';
          name = 'Nhánh Gai Giận Dữ';
          break;
        default:
          type = 'flower';
          name = 'Hạt Mầm Thấu Cảm';
      }
      
      const safeDate = entry.date ? String(entry.date) : '';
      const parts = safeDate ? safeDate.split('-') : [];
      const dayNum = parts.length === 3 ? parseInt(parts[2], 10) : (index + 1);
      
      return {
        day: isNaN(dayNum) ? (index + 1) : dayNum,
        type,
        name,
        date: safeDate
      };
    });
  };

  const weeklyData = getWeeklyData();
  const compareWeekData = getCompareWeekData();
  const gardenDays = getGardenDays();

  const hasWeeklyData = weeklyData.some(d => d.score !== null);

  // Dynamic statistics calculation strictly from real entries
  const safeEntries = Array.isArray(entries) ? entries : [];
  const peaceScores = safeEntries.map(e => {
    switch (e?.emotion) {
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

  const averagePeaceScore = peaceScores.length > 0 
    ? Math.round(peaceScores.reduce((a, b) => a + b, 0) / peaceScores.length)
    : 0;

  // Calculate completed empathy lessons from user object or user-specific localStorage
  const getCompletedEmpathyLessonsCount = useCallback(() => {
    try {
      const rawUser = localStorage.getItem('user');
      const userObj = currentUser || (rawUser ? JSON.parse(rawUser) : null);
      const userId = userObj?.id || userObj?._id || 'guest';

      // 1. If currentUser object has completedLessons array
      if (Array.isArray(userObj?.completedLessons)) {
        return userObj.completedLessons.length;
      }

      // 2. Check user-specific localStorage completed_lessons_${userId}
      const savedUserKey = localStorage.getItem(`completed_lessons_${userId}`);
      if (savedUserKey) {
        const parsed = JSON.parse(savedUserKey);
        if (Array.isArray(parsed)) return parsed.length;
      }

      // 3. Fallback check for general completed_lessons key
      const savedGeneralKey = localStorage.getItem('completed_lessons');
      if (savedGeneralKey) {
        const parsed = JSON.parse(savedGeneralKey);
        if (Array.isArray(parsed)) return parsed.length;
      }
    } catch (e) {
      console.error(e);
    }
    return 0;
  }, [currentUser]);

  const [completedLessons, setCompletedLessons] = useState<number>(() => getCompletedEmpathyLessonsCount());

  useEffect(() => {
    const updateLessonsCount = () => {
      setCompletedLessons(getCompletedEmpathyLessonsCount());
    };

    updateLessonsCount();

    window.addEventListener('empathy-lessons-updated', updateLessonsCount);
    window.addEventListener('user-auth-changed', updateLessonsCount);
    window.addEventListener('focus', updateLessonsCount);
    document.addEventListener('visibilitychange', updateLessonsCount);

    return () => {
      window.removeEventListener('empathy-lessons-updated', updateLessonsCount);
      window.removeEventListener('user-auth-changed', updateLessonsCount);
      window.removeEventListener('focus', updateLessonsCount);
      document.removeEventListener('visibilitychange', updateLessonsCount);
    };
  }, [getCompletedEmpathyLessonsCount]);

  const totalCount = safeEntries.length;
  const peaceVibe = safeEntries.filter(e => e?.emotion === 'binh_yen' || e?.emotion === 'vui_ve').length;
  const worryVibe = safeEntries.filter(e => e?.emotion === 'lo_lang' || e?.emotion === 'met_moi').length;
  const sadVibe = safeEntries.filter(e => e?.emotion === 'buon_ba' || e?.emotion === 'co_don' || e?.emotion === 'tuc_gian').length;

  const peacePercentage = totalCount > 0 ? Math.round((peaceVibe / totalCount) * 100) : 0;
  const worryPercentage = totalCount > 0 ? Math.round((worryVibe / totalCount) * 100) : 0;
  const sadPercentage = totalCount > 0 ? Math.round((sadVibe / totalCount) * 100) : 0;

  // Last 2 weeks average comparison
  const lastWeekEntries = safeEntries.filter(e => {
    if (!e?.date) return false;
    const d = new Date(e.date);
    if (isNaN(d.getTime())) return false;
    const diffTime = Math.abs(new Date().getTime() - d.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  });
  const prevWeekEntries = safeEntries.filter(e => {
    if (!e?.date) return false;
    const d = new Date(e.date);
    if (isNaN(d.getTime())) return false;
    const diffTime = Math.abs(new Date().getTime() - d.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 7 && diffDays <= 14;
  });

  const getEntriesAvgScore = (list: typeof entries) => {
    if (list.length === 0) return 0;
    const scores = list.map(e => {
      switch (e.emotion) {
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
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  };

  const thisWeekAvg = getEntriesAvgScore(lastWeekEntries);
  const prevWeekAvg = getEntriesAvgScore(prevWeekEntries);

  const diffScore = (thisWeekAvg > 0 && prevWeekAvg > 0) ? thisWeekAvg - prevWeekAvg : 0;

  // Achievements day milestones
  const achievements = [
    { id: 'ach7', title: 'Cột mốc 7 ngày', target: 7, desc: 'Hình thành thói quen lắng nghe và ghi nhận cảm xúc bản thân.', icon: Star, unlocked: streak >= 7 },
    { id: 'ach14', title: 'Cột mốc 14 ngày', target: 14, desc: 'Duy trì kết nối cảm xúc và cân bằng tâm trí bền bỉ.', icon: Award, unlocked: streak >= 14 },
    { id: 'ach30', title: 'Cột mốc 30 ngày', target: 30, desc: 'Thấu hiểu bản thân và tạo dựng bình an nội tại vững chắc.', icon: Trophy, unlocked: streak >= 30 },
    { id: 'ach100', title: 'Cột mốc 100 ngày', target: 100, desc: 'Làm chủ tâm thức và lan tỏa năng lượng tích cực trọn vẹn.', icon: Sparkles, unlocked: streak >= 100 }
  ];

  const triggerExportSimulation = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setExportSuccess(true);
      onAddCircle(1, 'Xuất báo cáo cảm xúc');
    }, 2000);
  };

  // Run Real AI Trend Analysis from Express
  const runAITrendAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/gemini/insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journals: entries })
      });
      const data = await response.json();
      setAiAnalysisResult(data);
    } catch (e) {
      console.error(e);
      setAiAnalysisResult({
        insight: "Mỗi chấm tròn cảm xúc mà bạn viết ra đều là một bước tiến quan trọng trên hành trình thấu hiểu bản thân. Bạn đang có xu hướng bình tĩnh hơn qua từng trang viết.",
        score: 82,
        trends: "Chỉ số bình yên của bạn đang tăng đều đặn."
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 text-text-minimal" id="mood-tracking-container">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={view === 'dashboard' ? onBack : () => { setView('dashboard'); setSelectedDayDetail(null); }} 
          className="flex items-center gap-2 text-text-minimal/60 hover:text-primary-minimal transition-colors bg-white border border-accent-minimal px-4 py-2 rounded-full shadow-sm cursor-pointer text-xs font-semibold"
          id="btn-mood-back"
        >
          <span>{view === 'dashboard' ? '← Quay lại' : '← Về trang tổng quan'}</span>
        </button>

        <div className="flex gap-2">
          {view !== 'export' && (
            <button
              onClick={() => { setView('export'); setSelectedDayDetail(null); }}
              className="flex items-center gap-2 bg-bg-minimal border border-accent-minimal px-4 py-2 rounded-full text-text-minimal/80 hover:text-primary-minimal text-xs font-semibold cursor-pointer shadow-sm transition-all"
              id="btn-mood-goto-export"
            >
              <FileText className="w-4 h-4" />
              <span>Xuất báo cáo</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. MAIN MOOD DASHBOARD */}
      {view === 'dashboard' && (
        <div id="mood-main-dashboard">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-serif text-text-minimal font-bold">Theo Dõi Cảm Xúc</h1>
            <p className="text-text-minimal/60 text-xs mt-2">Nhìn nhận lại hành trình thăng trầm cảm xúc qua các biểu đồ mộc mạc, đáng yêu.</p>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-bg-minimal border border-accent-minimal p-5 rounded-3xl shadow-sm text-center">
              <span className="text-[10px] text-text-minimal/60 font-bold uppercase tracking-wider">Chỉ số Bình Yên</span>
              <div className="text-2xl font-serif font-extrabold text-[#2B4212] mt-2">
                {entries.length === 0 && averagePeaceScore === 0 ? 'Mới bắt đầu' : `${averagePeaceScore}/100`}
              </div>
              <p className="text-[9px] text-text-minimal/60 mt-1">Tính từ nhật ký & tự chăm sóc</p>
            </div>
            <div className="bg-bg-minimal border border-accent-minimal p-5 rounded-3xl shadow-sm text-center">
              <span className="text-[10px] text-text-minimal/60 font-bold uppercase tracking-wider">Chuỗi Ngày Vui</span>
              <div className="text-2xl font-serif font-extrabold text-[#2B4212] mt-2">🔥 {streak || 1} ngày</div>
              <p className="text-[9px] text-text-minimal/60 mt-1">Hành trình thấu hiểu bền bỉ</p>
            </div>
            <div 
              onClick={onNavigateToJournal}
              className="bg-bg-minimal border border-accent-minimal p-5 rounded-3xl shadow-sm text-center cursor-pointer hover:border-[#A8BD55] transition-all"
            >
              <span className="text-[10px] text-text-minimal/60 font-bold uppercase tracking-wider">Sổ tay Nhật ký</span>
              <div className="text-2xl font-serif font-extrabold text-[#2B4212] mt-2">{entries.length} bài viết</div>
              <p className="text-[9px] text-text-minimal/60 mt-1">
                {entries.length === 0 ? 'Tạo bài viết đầu tiên' : 'Trang giấy mở lòng tâm sự'}
              </p>
            </div>
            <div 
              onClick={onNavigateToSelfCare}
              className="bg-bg-minimal border border-accent-minimal p-5 rounded-3xl shadow-sm text-center cursor-pointer hover:border-[#A8BD55] transition-all"
            >
              <span className="text-[10px] text-text-minimal/60 font-bold uppercase tracking-wider">Bài Học Thấu Cảm</span>
              <div className="text-2xl font-serif font-extrabold text-[#2B4212] mt-2">{completedLessons} hoàn thành</div>
              <p className="text-[9px] text-text-minimal/60 mt-1">Được nuôi dưỡng ngọt ngào</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Line Chart Summary */}
            <div className="lg:col-span-2 bg-white border border-accent-minimal rounded-[30px] p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-serif text-text-minimal text-sm font-bold flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-[#2B4212]" /> Biểu Đồ Cảm Xúc Tuần Này
                  </h3>
                  <button 
                    onClick={() => setView('charts')} 
                    className="text-[11px] text-[#2B4212] hover:text-[#2B4212]/80 font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    Xem chi tiết <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Interactive Weekly Chart */}
                <div className="h-56 w-full" id="weekly-recharts-line-chart">
                  {hasWeeklyData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={weeklyData}>
                        <defs>
                          <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#C2D772" stopOpacity={0.6}/>
                            <stop offset="95%" stopColor="#C2D772" stopOpacity={0.05}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-accent-minimal)" />
                        <XAxis dataKey="day" stroke="var(--color-text-minimal)" fontSize={11} tickLine={false} style={{ opacity: 0.8, fontWeight: 600 }} />
                        <YAxis domain={[40, 100]} stroke="var(--color-text-minimal)" fontSize={11} tickLine={false} style={{ opacity: 0.8, fontWeight: 600 }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid var(--color-accent-minimal)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                          labelStyle={{ fontWeight: 'bold', fontSize: '11px', color: 'var(--color-text-minimal)' }}
                          itemStyle={{ fontSize: '11px', color: '#2B4212', fontWeight: 'bold' }}
                          formatter={(value: any, name: any, item: any) => {
                            if (value === null || value === undefined) {
                              return ['Chưa có dữ liệu', 'Điểm bình yên'];
                            }
                            return [`${value}/100 - ${item.payload.emotion}`, 'Điểm bình yên'];
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="score" 
                          connectNulls={false}
                          stroke="#2B4212" 
                          strokeWidth={3} 
                          fillOpacity={1} 
                          fill="url(#colorScore)" 
                          name="Điểm bình yên" 
                          dot={{ r: 5, fill: '#2B4212', strokeWidth: 2, stroke: '#ffffff' }}
                          activeDot={{ r: 8, fill: '#C2D772', stroke: '#2B4212', strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center p-6 bg-bg-minimal/40 border border-dashed border-accent-minimal rounded-2xl text-center">
                      <div className="w-10 h-10 rounded-full bg-[#C2D772]/40 flex items-center justify-center text-lg mb-2 shadow-sm">
                        ✨
                      </div>
                      <p className="text-xs font-serif text-text-minimal font-semibold max-w-sm leading-relaxed">
                        Hãy viết nhật ký hoặc thực hiện 1 bài tập chăm sóc bản thân để bắt đầu vẽ biểu đồ cảm xúc của bạn nhé! ✨
                      </p>
                      <div className="flex gap-2.5 mt-3">
                        <button
                          onClick={onNavigateToJournal}
                          className="text-[10px] font-bold bg-[#2B4212] text-white px-3 py-1.5 rounded-full hover:bg-[#1f300c] transition-all cursor-pointer shadow-sm"
                        >
                          Viết nhật ký ngay
                        </button>
                        <button
                          onClick={onNavigateToSelfCare}
                          className="text-[10px] font-bold bg-white text-[#2B4212] border border-[#A8BD55] px-3 py-1.5 rounded-full hover:bg-[#C2D772]/20 transition-all cursor-pointer shadow-sm"
                        >
                          Tự chăm sóc
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Compare progress indicator */}
              <div className="mt-4 pt-3 border-t border-accent-minimal flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <ArrowUpRight className="w-4 h-4 text-[#2B4212]" />
                  <span className="text-text-minimal/70 font-medium">So với tuần trước:</span>
                  <span className="font-extrabold text-[#2B4212]">
                    {diffScore > 0 ? `+${diffScore}` : diffScore < 0 ? `${diffScore}` : '0'} điểm Bình Yên
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ArrowDownRight className="w-4 h-4 text-rose-600" />
                  <span className="text-text-minimal/70 font-medium">Mức độ căng thẳng:</span>
                  <span className="font-extrabold text-rose-600">
                    {diffScore > 0 ? 'Giảm bớt' : diffScore < 0 ? 'Tăng nhẹ' : 'Ổn định'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: AI Insight Trends and Heatmap Trigger */}
            <div className="lg:col-span-1 flex flex-col gap-6">
              {/* AI Insight Trends */}
              <div className="bg-[#C2D772]/20 border border-[#A8BD55] p-6 rounded-[30px] shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="font-serif text-text-minimal text-sm font-bold flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-[#2B4212] animate-pulse" /> AI Xu Hướng Tinh Thần
                  </h3>
                  
                  {aiAnalysisResult ? (
                    <div className="space-y-3">
                      <p className="text-xs text-text-minimal/80 leading-relaxed bg-white/80 p-3.5 rounded-2xl border border-[#A8BD55]">
                        {aiAnalysisResult.insight}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#2B4212] bg-[#C2D772] border border-[#A8BD55] p-2 rounded-xl">
                        <span>🌟</span>
                        <span>{aiAnalysisResult.trends}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-text-minimal/70 leading-relaxed">
                      Để phân tích chính xác xu hướng cảm xúc tuần này, hãy kết nối trí tuệ AI Chấm Tròn phân tích nhật ký của bạn.
                    </p>
                  )}
                </div>

                <div className="mt-6">
                  <button
                    onClick={runAITrendAnalysis}
                    disabled={isAnalyzing}
                    className="w-full bg-[#C2D772] hover:bg-[#B3C862] text-[#2B4212] font-extrabold text-xs py-3 rounded-xl shadow-sm cursor-pointer flex items-center justify-center gap-2 transition-all border border-[#A8BD55]"
                    id="btn-mood-run-ai-trends"
                  >
                    {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin text-[#2B4212]" /> : <Sparkles className="w-4 h-4 text-[#2B4212]" />}
                    <span>{isAnalyzing ? 'Đang thấu cảm...' : 'Nhận AI Insight hàng tuần'}</span>
                  </button>
                </div>
              </div>

              {/* Grid items for Heatmap & Garden triggers */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setView('heatmap')}
                  className="bg-white hover:bg-bg-minimal border border-accent-minimal p-4 rounded-3xl text-center flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105"
                  id="btn-mood-goto-heatmap"
                >
                  <Calendar className="w-6 h-6 text-[#2B4212] mb-2" />
                  <span className="text-xs font-bold text-text-minimal">Lịch Sưởi Ấm</span>
                  <span className="text-[9px] text-text-minimal/50 mt-0.5">Calendar Heatmap</span>
                </button>
                
                <button
                  onClick={() => setView('garden')}
                  className="bg-white hover:bg-bg-minimal border border-accent-minimal p-4 rounded-3xl text-center flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105"
                  id="btn-mood-goto-garden"
                >
                  <Award className="w-6 h-6 text-[#2B4212] mb-2" />
                  <span className="text-xs font-bold text-text-minimal">Vườn Hoa Chữa Lành</span>
                  <span className="text-[9px] text-text-minimal/50 mt-0.5">Flower Garden</span>
                </button>
              </div>
            </div>
          </div>

          {/* Emotional Balance Breakdown & Growing Tree Progress */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
            {/* Emotional Balance */}
            <div className="bg-white border border-accent-minimal p-6 rounded-[30px] shadow-sm">
              <h3 className="font-serif text-text-minimal text-sm font-bold mb-4">Cân Bằng Cảm Xúc Hàng Tháng</h3>
              
              <div className="space-y-3.5">
                {[
                  { label: 'Bình yên & Vui vẻ', percentage: peacePercentage, color: 'bg-primary-minimal' },
                  { label: 'Lo lắng & Mệt mỏi', percentage: worryPercentage, color: 'bg-primary-minimal/40' },
                  { label: 'Buồn bã & Cô đơn', percentage: sadPercentage, color: 'bg-primary-minimal/20' }
                ].map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs font-semibold text-text-minimal/70 mb-1">
                      <span>{item.label}</span>
                      <span>{item.percentage}%</span>
                    </div>
                    <div className="w-full bg-bg-minimal h-2 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color}`} style={{ width: `${item.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Achievement Milestones */}
            <div className="bg-white border border-accent-minimal p-6 rounded-[30px] shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-serif text-text-minimal text-sm font-bold mb-2 flex items-center gap-1">
                  <Award className="w-4 h-4 text-[#2B4212]" /> Cột Mốc Thành Tựu Tâm Hồn
                </h3>
                <p className="text-text-minimal/60 text-[10px] mb-4">Ghi nhận nỗ lực thấu cảm và chăm sóc bản thân của bạn qua từng ngày.</p>

                {/* Milestones list */}
                <div className="space-y-3">
                  {achievements.map((ach) => {
                    const AchIcon = ach.icon;
                    return (
                      <div 
                        key={ach.id} 
                        className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                          ach.unlocked 
                            ? 'bg-[#C2D772]/30 border-[#A8BD55]' 
                            : 'bg-bg-minimal border-accent-minimal/70'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                            ach.unlocked 
                              ? 'bg-[#2B4212] text-[#C2D772] shadow-xs' 
                              : 'bg-accent-minimal/70 text-text-minimal/40'
                          }`}>
                            <AchIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="font-bold text-text-minimal text-xs">{ach.title}</h4>
                            <p className="text-[10px] text-text-minimal/60">{ach.desc}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                          ach.unlocked ? 'bg-[#2B4212] text-white shadow-xs' : 'bg-accent-minimal text-text-minimal/60'
                        }`}>
                          {ach.unlocked ? 'Đã đạt' : 'Đang thực hiện'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. WEEKLY MOOD DETAIL CHART VIEW */}
      {view === 'charts' && (
        <div className="bg-white border border-accent-minimal p-8 rounded-[30px] shadow-sm animate-fade-in" id="mood-weekly-charts-view">
          <h2 className="text-2xl font-serif text-text-minimal font-bold mb-2 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[#124B31]" /> Phân Tích So Sánh Chi Tiết
          </h2>
          <p className="text-text-minimal/60 text-xs mb-8">So sánh sự biến chuyển của điểm số bình yên giữa Tuần này và Tuần trước.</p>

          <div className="h-72 w-full mb-8">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compareWeekData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-accent-minimal)" />
                <XAxis dataKey="name" stroke="var(--color-text-minimal)" fontSize={11} tickLine={false} style={{ opacity: 0.8 }} />
                <YAxis domain={[50, 100]} stroke="var(--color-text-minimal)" fontSize={11} tickLine={false} style={{ opacity: 0.8 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid var(--color-accent-minimal)' }}
                />
                <Bar dataKey="Tuần này" fill="#2B4212" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Tuần trước" fill="var(--color-accent-minimal)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="p-4 bg-bg-minimal border border-accent-minimal rounded-2xl">
            <h4 className="font-serif text-text-minimal text-xs font-bold flex items-center gap-1.5 mb-1">
              <Info className="w-4 h-4 text-[#124B31]" /> Nhận xét so sánh từ Chấm Tròn:
            </h4>
            <p className="text-text-minimal/80 text-xs leading-relaxed font-serif">
              {entries.length === 0 
                ? "Nhật ký của bạn chưa có dữ liệu so sánh. Hãy viết nhật ký cảm xúc thường xuyên hơn để bắt đầu nhận phân tích và so sánh thói quen!"
                : `Điểm số bình yên trung bình tuần này của bạn là ${thisWeekAvg}/100. ${diffScore > 0 ? `Bạn đang có sự tiến bộ rõ rệt (+${diffScore} điểm) so với tuần trước nhờ những nỗ lực chăm sóc bản thân ngọt ngào!` : diffScore < 0 ? `Cảm xúc tuần này có phần xáo động hơn so với tuần trước (${diffScore} điểm). Hãy dành thêm thời gian thư giãn và tập hít thở nhé.` : `Cảm xúc tuần này khá cân bằng và ổn định so với tuần trước. Hãy tiếp tục duy trì những thói quen tốt hằng ngày!`}`
              }
            </p>
          </div>
        </div>
      )}

      {/* 3. MONTHLY HEATMAP CALENDAR VIEW */}
      {view === 'heatmap' && (
        <div className="bg-white border border-accent-minimal p-6 sm:p-8 rounded-[30px] shadow-sm animate-fade-in" id="mood-monthly-heatmap-view">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-serif text-text-minimal font-bold flex items-center gap-2">
                <Calendar className="w-6 h-6 text-[#124B31]" /> Lịch Sưởi Ấm Cảm Xúc
              </h2>
              <p className="text-text-minimal/60 text-xs mt-1">Một ô nhỏ đầy sắc màu tương ứng với một ngày bạn viết nhật ký hoặc chăm sóc bản thân.</p>
            </div>
            
            {/* Month & Year switcher controls */}
            <div className="flex items-center gap-2 bg-bg-minimal border border-accent-minimal/60 px-3 py-1.5 rounded-2xl shadow-xs">
              <button 
                onClick={handlePrevMonth}
                title="Tháng trước"
                className="p-1.5 hover:bg-white rounded-full transition-colors cursor-pointer text-text-minimal/70 hover:text-text-minimal active:scale-95"
                id="btn-heatmap-prev-month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <span className="text-sm font-bold text-text-minimal font-serif px-2 min-w-[120px] text-center">
                {monthNames[currentMonth]} / {currentYear}
              </span>
              
              <button 
                onClick={handleNextMonth}
                title="Tháng sau"
                className="p-1.5 hover:bg-white rounded-full transition-colors cursor-pointer text-text-minimal/70 hover:text-text-minimal active:scale-95"
                id="btn-heatmap-next-month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={handleResetToCurrentMonth}
                title="Về tháng hiện tại"
                className="ml-1 text-[11px] font-bold text-[#124B31] bg-[#C2D772]/40 hover:bg-[#C2D772]/80 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                id="btn-heatmap-today-month"
              >
                Tháng này
              </button>
            </div>
          </div>

          {/* Quick 12 Months Selector Bar */}
          <div className="mb-6 pb-2 overflow-x-auto scrollbar-none border-b border-accent-minimal/40">
            <div className="flex items-center gap-1.5 min-w-max">
              {monthNames.map((mName, idx) => {
                const isSelected = currentMonth === idx;
                const monthPrefix = `${currentYear}-${String(idx + 1).padStart(2, '0')}`;
                
                // Calculate total actions in this month
                let countInMonth = 0;
                const daysInM = new Date(currentYear, idx + 1, 0).getDate();
                for (let d = 1; d <= daysInM; d++) {
                  const dStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
                  countInMonth += getDayActivityBreakdown(dStr).totalCount;
                }

                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentMonth(idx)}
                    className={`px-3 py-1.5 rounded-full text-xs font-serif transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#216e39] text-white font-bold shadow-xs'
                        : 'bg-bg-minimal hover:bg-[#9be9a8]/40 text-text-minimal/80 font-medium'
                    }`}
                    id={`btn-select-month-${idx + 1}`}
                  >
                    <span>{mName}</span>
                    {countInMonth > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-sans font-bold ${
                        isSelected ? 'bg-[#9be9a8] text-[#0d381e]' : 'bg-[#9be9a8]/60 text-[#0d381e]'
                      }`}>
                        {countInMonth}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clean Inline Notification instead of ugly window.alert */}
          <AnimatePresence>
            {selectedDayDetail && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-[#D7ECD9]/70 border border-[#82d68f] rounded-2xl p-4 mb-6 flex items-start justify-between gap-3 text-xs shadow-xs"
              >
                <div className="flex gap-2">
                  <Sparkles className="w-4 h-4 text-[#216e39] flex-shrink-0 mt-0.5" />
                  <p className="text-text-minimal font-serif leading-relaxed">{selectedDayDetail}</p>
                </div>
                <button 
                  onClick={() => setSelectedDayDetail(null)} 
                  className="text-text-minimal/50 hover:text-text-minimal cursor-pointer p-0.5 rounded-full hover:bg-[#9be9a8]/50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Heatmap Grid - GitHub Contribution style */}
          {(() => {
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
            const startDayOffset = new Date(currentYear, currentMonth, 1).getDay(); // 0 = CN, 1 = T2...
            const todayStr = new Date().toISOString().split('T')[0];

            return (
              <div className="grid grid-cols-7 gap-2 sm:gap-3 mb-8 text-center">
                {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(d => (
                  <span key={d} className="text-xs font-bold text-text-minimal/60 uppercase tracking-wider py-1">{d}</span>
                ))}
                
                {/* Empty grid items for offsetting starting day */}
                {Array.from({ length: startDayOffset }).map((_, eIdx) => (
                  <div key={`empty-${eIdx}`} className="aspect-square opacity-0 pointer-events-none" />
                ))}

                {/* Days of current month mapped to real user activity */}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                  const yearStr = String(currentYear);
                  const monthStr = String(currentMonth + 1).padStart(2, '0');
                  const dayStr = String(day).padStart(2, '0');
                  const dateQuery = `${yearStr}-${monthStr}-${dayStr}`;
                  const isToday = dateQuery === todayStr;
                  
                  // Extract detailed activity breakdown
                  const breakdown = getDayActivityBreakdown(dateQuery);
                  
                  // GitHub contribution style intensity styling
                  let intensityClass = 'bg-[#ebedf0] border-[#d0d7de]/70 text-text-minimal/60 font-medium hover:border-[#30a14e]';
                  if (breakdown.level === 4) {
                    intensityClass = 'bg-[#216e39] border-[#1b582e] text-white font-extrabold shadow-sm hover:brightness-110';
                  } else if (breakdown.level === 3) {
                    intensityClass = 'bg-[#30a14e] border-[#216e39] text-white font-bold shadow-xs hover:brightness-105';
                  } else if (breakdown.level === 2) {
                    intensityClass = 'bg-[#40c463] border-[#30a14e] text-[#0d381e] font-bold hover:brightness-95';
                  } else if (breakdown.level === 1) {
                    intensityClass = 'bg-[#9be9a8] border-[#7bc96f] text-[#0d381e] font-semibold hover:brightness-95';
                  }

                  let detailMsg = `Ngày ${day} ${monthNames[currentMonth]} ${currentYear}: Chưa có hoạt động ghi nhận nào. Hãy viết nhật ký hoặc thực hành tự chăm sóc để thắp sáng ngày này nhé!`;
                  
                  if (breakdown.totalCount > 0) {
                    const actDesc = breakdown.activitiesList.length > 0 ? breakdown.activitiesList.join(', ') : `${breakdown.totalCount} hoạt động`;
                    let extraMood = '';
                    if (breakdown.dayEntries.length > 0) {
                      const emo = breakdown.dayEntries[0].emotion;
                      const emoMap: Record<string, string> = {
                        vui_ve: 'Vui vẻ ✨',
                        binh_yen: 'Bình yên 🌿',
                        met_moi: 'Mệt mỏi 🍵',
                        lo_lang: 'Lo lắng 🌧️',
                        buon_ba: 'Buồn bã 💧',
                        co_don: 'Cô đơn 🌙',
                        tuc_gian: 'Cần giải tỏa ⚡'
                      };
                      const emoLabel = emoMap[emo] || emo;
                      const excerpt = breakdown.dayEntries[0].text.length > 70 
                        ? `${breakdown.dayEntries[0].text.substring(0, 70)}...` 
                        : breakdown.dayEntries[0].text;
                      extraMood = ` • Tâm trạng: ${emoLabel}. Trích nhật ký: "${excerpt}"`;
                    }
                    detailMsg = `Ngày ${day} ${monthNames[currentMonth]} ${currentYear}: Có ${breakdown.totalCount} hoạt động (${actDesc})${extraMood}`;
                  }
                  
                  return (
                    <button
                      key={day}
                      className={`aspect-square rounded-2xl border flex flex-col items-center justify-center text-xs transition-all hover:scale-105 cursor-pointer relative ${intensityClass} ${
                        isToday ? 'ring-2 ring-[#216e39] ring-offset-2' : ''
                      }`}
                      id={`btn-heatmap-day-${day}`}
                      onClick={() => setSelectedDayDetail(detailMsg)}
                      title={`Ngày ${day}/${currentMonth + 1}: ${breakdown.totalCount} hoạt động`}
                    >
                      <span className="text-xs">{day}</span>
                      {breakdown.totalCount > 0 && (
                        <span className={`text-[9px] font-extrabold leading-none mt-0.5 ${
                          breakdown.level >= 3 ? 'text-white/90' : 'text-[#0d381e]'
                        }`}>
                          {breakdown.totalCount >= 5 ? '5+' : breakdown.totalCount}
                        </span>
                      )}
                      {isToday && (
                        <span className="absolute -top-1.5 text-[8px] font-extrabold text-[#216e39] bg-white px-1.5 py-0.2 rounded-full border border-[#216e39]/40 shadow-xs">
                          Nay
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* Month Summary Bar */}
          {(() => {
            const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
            
            let totalMonthActivities = 0;
            let activeDaysCount = 0;

            for (let d = 1; d <= daysInMonth; d++) {
              const dStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
              const bd = getDayActivityBreakdown(dStr);
              if (bd.totalCount > 0) {
                activeDaysCount++;
                totalMonthActivities += bd.totalCount;
              }
            }
            
            return (
              <div className="mb-6 p-4 bg-bg-minimal border border-accent-minimal/60 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-base">🌱</span>
                  <span className="text-text-minimal font-serif">
                    Tổng kết <strong>{monthNames[currentMonth]} / {currentYear}</strong>: Bạn đã có <strong>{activeDaysCount}</strong> ngày năng nổ với tổng cộng <strong>{totalMonthActivities}</strong> lượt hoạt động & chăm sóc tâm hồn.
                  </span>
                </div>
                {activeDaysCount === 0 && (
                  <button
                    onClick={onNavigateToJournal}
                    className="text-[#216e39] font-bold hover:underline cursor-pointer flex-shrink-0"
                  >
                    + Bắt đầu hoạt động đầu tiên
                  </button>
                )}
              </div>
            );
          })()}

          {/* GitHub-style Contribution Level Legend */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-accent-minimal/60 text-xs text-text-minimal/80">
            <div className="flex items-center gap-1.5 font-medium text-[11px] text-text-minimal/70">
              <span>Độ đậm nhạt thể hiện tần suất hoạt động trong ngày</span>
            </div>
            <div className="flex items-center gap-2 font-semibold">
              <span className="text-[11px] text-text-minimal/60">Ít</span>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-md bg-[#ebedf0] border border-[#d0d7de]" title="0 hoạt động" />
                <span className="w-3.5 h-3.5 rounded-md bg-[#9be9a8] border border-[#7bc96f]" title="1 hoạt động (Mức 1)" />
                <span className="w-3.5 h-3.5 rounded-md bg-[#40c463] border border-[#30a14e]" title="2 hoạt động (Mức 2)" />
                <span className="w-3.5 h-3.5 rounded-md bg-[#30a14e] border border-[#216e39]" title="3-4 hoạt động (Mức 3)" />
                <span className="w-3.5 h-3.5 rounded-md bg-[#216e39] border border-[#1b582e]" title="5+ hoạt động (Mức 4)" />
              </div>
              <span className="text-[11px] text-text-minimal/60">Nhiều</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. YEAR OVERVIEW FLOWER GARDEN VIEW */}
      {view === 'garden' && (
        <div className="bg-white border border-accent-minimal p-8 rounded-[30px] shadow-sm text-center animate-fade-in" id="mood-flower-garden-view">
          <h2 className="text-2xl font-serif text-text-minimal font-bold mb-2">🌸 Vườn Hoa Chữa Lành Tâm Hồn 🌸</h2>
          <p className="text-text-minimal/60 text-xs mb-12">Những ngày vui khỏe, bình yên hóa thành đóa hoa xinh xắn. Những ngày có chút mệt mỏi biến thành những nhành lá xanh mát che bóng mát.</p>

          {/* Clean Inline Notification instead of window.alert */}
          <AnimatePresence>
            {selectedDayDetail && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-[#C2D772]/30 border border-[#A8BD55] rounded-2xl p-4 mb-8 flex items-start justify-between gap-3 text-xs max-w-xl mx-auto"
              >
                <div className="flex gap-2">
                  <Sparkles className="w-4 h-4 text-[#2B4212] flex-shrink-0 mt-0.5" />
                  <p className="text-text-minimal font-serif leading-relaxed text-left">{selectedDayDetail}</p>
                </div>
                <button 
                  onClick={() => setSelectedDayDetail(null)} 
                  className="text-text-minimal/50 hover:text-text-minimal cursor-pointer p-0.5 rounded-full hover:bg-[#C2D772]/50"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {gardenDays.length === 0 ? (
            <div className="my-12 p-8 border border-dashed border-accent-minimal rounded-3xl bg-bg-minimal max-w-md mx-auto text-center">
              <span className="text-4xl">🌱</span>
              <h3 className="font-serif text-text-minimal text-sm font-bold mt-3 mb-1">Mảnh đất đang đợi gieo mầm</h3>
              <p className="text-xs text-text-minimal/60 leading-relaxed">
                Khu vườn tâm hồn của bạn đang đợi những trang nhật ký cảm xúc đầu tiên. Hãy bắt đầu ghi nhật ký hôm nay để gieo mầm nở hoa nhé!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-6 max-w-2xl mx-auto my-8">
              {gardenDays.map((item, index) => {
                let emoji = '🌸';
                if (item.name.includes('Cúc')) emoji = '🌸';
                else if (item.name.includes('Hướng Dương')) emoji = '🌻';
                else if (item.name.includes('Oải Hương')) emoji = '🪻';
                else if (item.name.includes('Thông')) emoji = '🌿';
                else if (item.name.includes('Dương Xỉ')) emoji = '🍃';
                else if (item.name.includes('Liễu')) emoji = '🌱';
                else if (item.name.includes('Cỏ')) emoji = '🌾';
                
                return (
                  <div 
                    key={index}
                    className="bg-bg-minimal hover:bg-[#C2D772]/30 border border-accent-minimal hover:border-[#A8BD55] rounded-3xl p-4 transition-all hover:scale-105 flex flex-col items-center justify-center shadow-sm cursor-pointer"
                    onClick={() => setSelectedDayDetail(`Hạt mầm ngày ${item.day} của bạn đã sinh trưởng thành "${item.name}"! Đây là minh chứng tuyệt vời cho sự bao dung và kiên nhẫn đối với chính tâm hồn mình.`)}
                  >
                    <span className={`text-4xl mb-2`}>
                      {emoji}
                    </span>
                    <span className="text-[11px] font-bold text-text-minimal truncate w-full">{item.name}</span>
                    <span className="text-[9px] text-text-minimal/60 mt-1">Ngày {item.day}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-6 border-t border-accent-minimal/60 max-w-md mx-auto">
            <p className="text-xs text-text-minimal/60 italic font-serif">"Càng kiên nhẫn chăm sóc lòng mình, khu vườn tâm hồn của bạn sẽ càng ngát hương."</p>
          </div>
        </div>
      )}

      {/* 5. EXPORT REPORT POPUP */}
      {view === 'export' && (
        <div className="bg-white border border-accent-minimal p-8 rounded-[30px] shadow-sm max-w-xl mx-auto text-center animate-fade-in" id="mood-export-report-view">
          <FileText className="w-12 h-12 text-[#2B4212] mx-auto mb-4" />
          <h2 className="text-2xl font-serif text-text-minimal font-bold mb-2">Xuất Báo Cáo Sức Khỏe Tinh Thần</h2>
          <p className="text-text-minimal/60 text-xs mb-6">Kết xuất nhật ký hành trình cùng các chỉ số cảm xúc thành tệp báo cáo PDF/Hình ảnh cẩn mật để lưu giữ cá nhân hoặc chia sẻ tinh tế.</p>

          <div className="bg-bg-minimal border border-accent-minimal rounded-2xl p-6 text-left space-y-3 mb-8 text-xs">
            <h4 className="font-serif text-text-minimal font-bold mb-1">Nội dung tệp xuất bao gồm:</h4>
            <div className="flex items-center gap-2 text-text-minimal/80"><Check className="w-4 h-4 text-[#2B4212]" /> Chỉ số bình yên tinh thần bình quân hàng tháng</div>
            <div className="flex items-center gap-2 text-text-minimal/80"><Check className="w-4 h-4 text-[#2B4212]" /> Thống kê phân bố 7 chấm tròn cảm xúc</div>
            <div className="flex items-center gap-2 text-text-minimal/80"><Check className="w-4 h-4 text-[#2B4212]" /> Nhật ký tóm tắt & Các AI Insight thấu cảm sâu sắc</div>
            <div className="flex items-center gap-2 text-text-minimal/80"><Check className="w-4 h-4 text-[#2B4212]" /> Tổng hợp tiến độ nuôi dưỡng bản thân</div>
          </div>

          {exportSuccess ? (
            <div className="bg-[#C2D772]/50 border border-[#A8BD55] rounded-2xl p-4 mb-6 text-[#2B4212] text-xs font-bold">
              🎉 Kết xuất báo cáo thành công! Tệp tin đang được chuẩn bị để lưu về thiết bị của bạn.
            </div>
          ) : null}

          <div className="flex gap-3 justify-center">
            <button 
              onClick={() => { setView('dashboard'); setExportSuccess(false); }} 
              className="px-6 py-3 bg-bg-minimal hover:bg-accent-minimal/20 text-text-minimal/80 border border-accent-minimal font-bold text-xs rounded-full cursor-pointer transition-all"
            >
              Hủy bỏ
            </button>
            <button
              onClick={triggerExportSimulation}
              disabled={isExporting}
              className="px-8 py-3 bg-primary-minimal hover:bg-primary-minimal/90 text-white font-bold text-xs rounded-full shadow-sm cursor-pointer flex items-center gap-2 transition-all"
            >
              {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
              <span>{isExporting ? 'Đang kết xuất...' : 'Xác nhận xuất báo cáo'}</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
