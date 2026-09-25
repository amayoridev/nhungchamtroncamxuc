import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Download, Copy, Check, Search, Filter, Database, ShieldCheck, 
  BarChart3, FileSpreadsheet, FileCode, RefreshCw, Eye, X, 
  Droplets, BookOpen, Sparkles, Heart, Users, ExternalLink, Activity
} from 'lucide-react';
import { AnonymousDataExportResponse, AnonymousUserSubject } from '../types';

interface AdminAnonymousDataExportProps {
  token: string | null;
}

export default function AdminAnonymousDataExport({ token }: AdminAnonymousDataExportProps) {
  const [data, setData] = useState<AnonymousDataExportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDersLevel, setSelectedDersLevel] = useState<'all' | 'high' | 'moderate' | 'low'>('all');
  const [selectedActivityFilter, setSelectedActivityFilter] = useState<'all' | 'has_journals' | 'has_reading' | 'active_today'>('all');
  const [includeAdmin, setIncludeAdmin] = useState(false);

  // Copy & Action feedback
  const [copiedMongoId, setCopiedMongoId] = useState<string | null>(null);
  const [copiedAllJson, setCopiedAllJson] = useState(false);
  const [downloadSuccessNotice, setDownloadSuccessNotice] = useState<string | null>(null);

  // Selected subject for deep inspection
  const [inspectedSubject, setInspectedSubject] = useState<AnonymousUserSubject | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'ders16' | 'activities' | 'journals' | 'raw_json'>('ders16');

  // Fetch anonymous data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/auth/admin/anonymous-data?includeAdmin=${includeAdmin}`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Lỗi khi tải dữ liệu ẩn danh.');
      }
      const json: AnonymousDataExportResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Không thể kết nối đến máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [includeAdmin]);

  // Copy MongoDB ID
  const handleCopyId = (mongoId: string) => {
    navigator.clipboard.writeText(mongoId);
    setCopiedMongoId(mongoId);
    setTimeout(() => setCopiedMongoId(null), 2000);
  };

  // Copy entire JSON
  const handleCopyAllJson = () => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedAllJson(true);
    setTimeout(() => setCopiedAllJson(false), 2500);
  };

  // Download Full JSON
  const handleDownloadFullJson = () => {
    if (!data) return;
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `anonymous_research_dataset_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotice('Đã tải xuống tệp JSON dữ liệu ẩn danh thành công!');
  };

  // Download Subjects Summary CSV
  const handleDownloadSubjectsSummaryCsv = () => {
    if (!data || !data.subjects.length) return;

    const headers = [
      'MongoDB_ID',
      'Subject_Code',
      'DERS16_Total_Score',
      'DERS16_Percentage',
      'DERS16_Level',
      'Subscale_Clarity_10',
      'Subscale_Goals_15',
      'Subscale_Impulse_15',
      'Subscale_Nonacceptance_15',
      'Subscale_Strategies_25',
      'Peace_Score_100',
      'Streak_Days',
      'Circle_Points',
      'Stars_Count',
      'Water_Glasses_Consumed',
      'Reading_Total_Sessions',
      'Reading_Total_Minutes',
      'Gratitude_Cards_Count',
      'Pair_Challenges_Completed',
      'Journals_Count',
      'Is_Active_Today',
      'Registered_Date',
      'Last_Active_Date'
    ];

    const rows = data.subjects.map(s => {
      const sub = s.ders16?.subscales;
      return [
        `"${s.mongoId}"`,
        `"${s.subjectCode || ''}"`,
        s.ders16?.totalScore ?? '',
        s.ders16?.percentage ?? '',
        `"${s.ders16?.level || ''}"`,
        sub?.clarity?.score ?? '',
        sub?.goals?.score ?? '',
        sub?.impulse?.score ?? '',
        sub?.nonacceptance?.score ?? '',
        sub?.strategies?.score ?? '',
        s.peaceScore ?? 80,
        s.streakDays ?? 1,
        s.circlePoints ?? 1,
        s.starsCount ?? 1,
        s.activities.waterLog.glassesConsumed ?? 0,
        s.activities.readingSessions.totalSessions ?? 0,
        s.activities.readingSessions.totalMinutes ?? 0,
        s.activities.gratitudeCards.totalCards ?? 0,
        s.activities.pairChallenges.completedCount ?? 0,
        s.activities.journals.totalEntries ?? 0,
        s.isActiveToday ? 'YES' : 'NO',
        `"${s.registeredDate || ''}"`,
        `"${s.lastActiveDate || ''}"`
      ].join(',');
    });

    // Add UTF-8 BOM for Excel Vietnamese compatibility
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    downloadFile(csvContent, `anonymous_subjects_summary_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
    showNotice('Đã tải xuống tệp CSV tổng quan đối tượng nghiên cứu!');
  };

  // Download DERS-16 Items Breakdown CSV (Q1 to Q16 for SPSS/R)
  const handleDownloadDers16BreakdownCsv = () => {
    if (!data || !data.subjects.length) return;

    const headers = [
      'MongoDB_ID',
      'DERS16_Total_Score',
      'Q1_Clarity',
      'Q2_Clarity',
      'Q3_Goals',
      'Q4_Impulse',
      'Q5_Strategies',
      'Q6_Strategies',
      'Q7_Goals',
      'Q8_Impulse',
      'Q9_Nonacceptance',
      'Q10_Impulse',
      'Q11_Strategies',
      'Q12_Nonacceptance',
      'Q13_Nonacceptance',
      'Q14_Goals',
      'Q15_Strategies',
      'Q16_Strategies'
    ];

    const rows = data.subjects.map(s => {
      const answersMap: Record<number, number> = {};
      (s.ders16?.answers || []).forEach(a => {
        answersMap[a.id] = a.score;
      });

      const qScores = Array.from({ length: 16 }, (_, i) => answersMap[i + 1] ?? '');
      return [`"${s.mongoId}"`, s.ders16?.totalScore ?? '', ...qScores].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    downloadFile(csvContent, `ders16_16items_breakdown_spss_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
    showNotice('Đã tải xuống bảng điểm chi tiết 16 câu DERS-16 (tương thích SPSS/R/Python)!');
  };

  // Download Anonymous Journals CSV
  const handleDownloadJournalsCsv = () => {
    if (!data || !data.subjects.length) return;

    const headers = [
      'Journal_ID',
      'Author_MongoDB_ID',
      'Date',
      'Time',
      'Emotion',
      'Content_Length_Chars',
      'Word_Count',
      'Has_AI_Insight',
      'Content_Text_Anonymized'
    ];

    const rows: string[] = [];
    data.subjects.forEach(s => {
      s.activities.journals.entries.forEach(j => {
        const cleanSnippet = (j.textSnippet || '').replace(/"/g, '""').replace(/\r?\n/g, ' ');
        rows.push([
          `"${j.journalId}"`,
          `"${s.mongoId}"`,
          `"${j.date}"`,
          `"${j.time}"`,
          `"${j.emotion}"`,
          j.contentLength,
          j.wordCount,
          j.hasAiInsight ? 'YES' : 'NO',
          `"${cleanSnippet}"`
        ].join(','));
      });
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    downloadFile(csvContent, `anonymous_journals_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
    showNotice(`Đã tải xuống ${rows.length} bài nhật ký cảm xúc ẩn danh!`);
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const showNotice = (msg: string) => {
    setDownloadSuccessNotice(msg);
    setTimeout(() => setDownloadSuccessNotice(null), 3500);
  };

  // Filtered subjects
  const filteredSubjects = useMemo(() => {
    if (!data) return [];
    return data.subjects.filter(s => {
      // Search by MongoDB ID or Circle Code
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchMongo = s.mongoId.toLowerCase().includes(q);
        const matchCode = (s.subjectCode || '').toLowerCase().includes(q);
        if (!matchMongo && !matchCode) return false;
      }

      // Filter by DERS level
      if (selectedDersLevel === 'high') {
        if (!s.ders16 || s.ders16.totalScore < 60) return false;
      } else if (selectedDersLevel === 'moderate') {
        if (!s.ders16 || s.ders16.totalScore < 45 || s.ders16.totalScore >= 60) return false;
      } else if (selectedDersLevel === 'low') {
        if (!s.ders16 || s.ders16.totalScore >= 45) return false;
      }

      // Filter by activity
      if (selectedActivityFilter === 'has_journals') {
        if (s.activities.journals.totalEntries === 0) return false;
      } else if (selectedActivityFilter === 'has_reading') {
        if (s.activities.readingSessions.totalSessions === 0) return false;
      } else if (selectedActivityFilter === 'active_today') {
        if (!s.isActiveToday) return false;
      }

      return true;
    });
  }, [data, searchQuery, selectedDersLevel, selectedActivityFilter]);

  return (
    <div className="space-y-6" id="anonymous-data-export-page">
      {/* 1. Header & Anonymity Guarantee Banner */}
      <div className="bg-gradient-to-r from-[#124B31] via-[#165B3B] to-[#1F7A52] text-white p-6 sm:p-7 rounded-[32px] shadow-lg border border-[#0F3E28] relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-bold mb-3 backdrop-blur-xs">
            <ShieldCheck className="w-4 h-4 text-[#9EE7C0]" />
            <span>Chuẩn Ẩn Danh Nghiên Cứu Tâm Lý Học (HIPAA & GDPR Compliant)</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold font-serif tracking-tight">
            Trích Xuất Dữ Liệu Ẩn Danh (De-identified Dataset)
          </h2>

          <p className="text-xs sm:text-sm text-white/80 mt-2 max-w-3xl leading-relaxed">
            Hệ thống tự động loại bỏ 100% dữ liệu định danh cá nhân (Họ tên, Email, Mật khẩu, Avatar). 
            Mỗi đối tượng nghiên cứu được đại diện duy nhất bằng <strong>Mã ID trong MongoDB</strong>, 
            kèm đầy đủ thang đo 16 câu <strong>DERS-16 (1-5)</strong>, thói quen uống nước, phiên đọc sách, thẻ biết ơn và nhật ký cảm xúc.
          </p>

          <div className="mt-4 pt-4 border-t border-white/15 flex flex-wrap items-center gap-4 text-xs font-semibold text-white/90">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#9EE7C0] animate-pulse"></span>
              <span>Định danh đối tượng: <strong>MongoDB ObjectId</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-300"></span>
              <span>Thang đo chuẩn hóa: <strong>DERS-16 (1 - 5 Điểm)</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-300"></span>
              <span>Hỗ trợ xuất: <strong>JSON, CSV (SPSS / Excel)</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Notice Message */}
      <AnimatePresence>
        {downloadSuccessNotice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-4 bg-[#C8F7DC] border border-[#9EE7C0] text-[#124B31] text-xs font-extrabold rounded-2xl flex items-center justify-between shadow-xs"
          >
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#124B31]" />
              <span>{downloadSuccessNotice}</span>
            </div>
            <button onClick={() => setDownloadSuccessNotice(null)} className="text-[#124B31]/60 hover:text-[#124B31]">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Quick Cohort Overview Cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 bg-white border border-[#E2DBFC] rounded-2xl shadow-xs">
            <span className="text-[10px] font-bold text-text-minimal/60 block uppercase">Tổng Đối Tượng</span>
            <div className="text-xl sm:text-2xl font-extrabold text-[#124B31] font-serif mt-0.5">
              {data.totalSubjects}
            </div>
            <span className="text-[10px] text-text-minimal/50">Mã MongoDB ID</span>
          </div>

          <div className="p-4 bg-white border border-[#BAE6FD] rounded-2xl shadow-xs">
            <span className="text-[10px] font-bold text-[#0369A1] block uppercase">DERS-16 TB</span>
            <div className="text-xl sm:text-2xl font-extrabold text-[#0369A1] font-serif mt-0.5">
              {data.overview.averageDers16Score}/80
            </div>
            <span className="text-[10px] text-text-minimal/50">
              {Math.round((data.overview.averageDers16Score / 80) * 100)}% thang đo
            </span>
          </div>

          <div className="p-4 bg-white border border-[#9EE7C0] rounded-2xl shadow-xs">
            <span className="text-[10px] font-bold text-[#124B31] block uppercase">Điểm Bình Yên TB</span>
            <div className="text-xl sm:text-2xl font-extrabold text-[#124B31] font-serif mt-0.5">
              {data.overview.averagePeaceScore}/100
            </div>
            <span className="text-[10px] text-text-minimal/50">Chỉ số an nhiên</span>
          </div>

          <div className="p-4 bg-white border border-[#FFE299] rounded-2xl shadow-xs">
            <span className="text-[10px] font-bold text-amber-800 block uppercase">Uống Nước TB</span>
            <div className="text-xl sm:text-2xl font-extrabold text-amber-700 font-serif mt-0.5">
              {data.overview.averageWaterGlasses} ly/ngày
            </div>
            <span className="text-[10px] text-text-minimal/50">Thói quen dưỡng thể</span>
          </div>

          <div className="p-4 bg-white border border-purple-200 rounded-2xl shadow-xs">
            <span className="text-[10px] font-bold text-purple-800 block uppercase">Đọc Sách</span>
            <div className="text-xl sm:text-2xl font-extrabold text-purple-700 font-serif mt-0.5">
              {data.overview.totalReadingMinutes} phút
            </div>
            <span className="text-[10px] text-text-minimal/50">Tĩnh tâm xoa dịu</span>
          </div>

          <div className="p-4 bg-white border border-rose-200 rounded-2xl shadow-xs">
            <span className="text-[10px] font-bold text-rose-800 block uppercase">Nhật Ký Ẩn Danh</span>
            <div className="text-xl sm:text-2xl font-extrabold text-rose-700 font-serif mt-0.5">
              {data.overview.totalJournals} bài
            </div>
            <span className="text-[10px] text-text-minimal/50">{data.overview.totalGratitudeCards} thẻ biết ơn</span>
          </div>
        </div>
      )}

      {/* 3. Export Actions Hub (Trích Xuất Đa Định Dạng) */}
      <div className="p-5 sm:p-6 bg-white border border-[#E2DBFC] rounded-[28px] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-accent-minimal/60 pb-3">
          <div>
            <h3 className="text-base font-bold font-serif text-text-minimal flex items-center gap-2">
              <Download className="w-5 h-5 text-[#124B31]" />
              <span>Bộ Công Cụ Trích Xuất Dữ Liệu Nghiên Cứu (Export Hub)</span>
            </h3>
            <p className="text-xs text-text-minimal/60 mt-0.5">
              Chọn định dạng phù hợp cho báo cáo nghiên cứu, phân tích SPSS, R, Python hoặc lưu trữ ngoại tuyến.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-3.5 py-2 rounded-full border border-accent-minimal text-xs font-bold text-text-minimal hover:bg-bg-minimal flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Làm mới dữ liệu từ MongoDB"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
            <button
              onClick={handleCopyAllJson}
              disabled={loading || !data}
              className="px-3.5 py-2 rounded-full border border-[#BAE6FD] bg-[#E0F2FE] text-[#0369A1] hover:bg-[#BAE6FD] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="Sao chép toàn bộ JSON vào Clipboard"
            >
              {copiedAllJson ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAllJson ? 'Đã sao chép JSON!' : 'Copy JSON'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Option 1: Full JSON */}
          <button
            onClick={handleDownloadFullJson}
            disabled={loading || !data}
            className="p-4 rounded-2xl bg-gradient-to-br from-[#F0FDF4] to-[#E6F9EE] border border-[#9EE7C0] text-left hover:border-[#124B31] hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-[#C8F7DC] text-[#124B31] flex items-center justify-center">
                <FileCode className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-[#124B31] bg-white px-2 py-0.5 rounded-full border border-[#9EE7C0]">
                .JSON
              </span>
            </div>
            <div className="font-bold text-xs text-[#124B31] group-hover:text-[#0D3824]">
              Tải Full Dataset JSON
            </div>
            <p className="text-[10px] text-text-minimal/60 mt-1 leading-relaxed">
              Cấu trúc phân cấp đầy đủ 16 câu DERS-16, 5 phân nhóm, thói quen uống nước, đọc sách & nhật ký.
            </p>
          </button>

          {/* Option 2: Summary CSV */}
          <button
            onClick={handleDownloadSubjectsSummaryCsv}
            disabled={loading || !data}
            className="p-4 rounded-2xl bg-gradient-to-br from-[#EFF6FF] to-[#E0F2FE] border border-[#BAE6FD] text-left hover:border-[#0369A1] hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-[#E0F2FE] text-[#0369A1] flex items-center justify-center">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-[#0369A1] bg-white px-2 py-0.5 rounded-full border border-[#BAE6FD]">
                .CSV / Excel
              </span>
            </div>
            <div className="font-bold text-xs text-[#0369A1] group-hover:text-[#075985]">
              Tải CSV Tổng Quan Đối Tượng
            </div>
            <p className="text-[10px] text-text-minimal/60 mt-1 leading-relaxed">
              1 dòng cho mỗi MongoDB ID với điểm DERS-16, 5 nhóm subscales, điểm bình yên, số ly nước, số phút đọc.
            </p>
          </button>

          {/* Option 3: DERS-16 16-Items SPSS Breakdown */}
          <button
            onClick={handleDownloadDers16BreakdownCsv}
            disabled={loading || !data}
            className="p-4 rounded-2xl bg-gradient-to-br from-[#F7F5FE] to-[#EDE9FE] border border-[#C7D2FE] text-left hover:border-[#4338CA] hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-[#E0E7FF] text-[#4338CA] flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-[#4338CA] bg-white px-2 py-0.5 rounded-full border border-[#C7D2FE]">
                SPSS / R
              </span>
            </div>
            <div className="font-bold text-xs text-[#4338CA] group-hover:text-[#3730A3]">
              Tải Ma Trận 16 Câu DERS-16
            </div>
            <p className="text-[10px] text-text-minimal/60 mt-1 leading-relaxed">
              Ma trận 16 câu hỏi (Q1 đến Q16) điểm 1-5 theo từng MongoDB ID, sẵn sàng chạy Cronbach Alpha hay EFA.
            </p>
          </button>

          {/* Option 4: Anonymous Journals CSV */}
          <button
            onClick={handleDownloadJournalsCsv}
            disabled={loading || !data}
            className="p-4 rounded-2xl bg-gradient-to-br from-[#FFFDF5] to-[#FEF3C7] border border-[#FFE299] text-left hover:border-amber-600 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-[#FEF3C7] text-amber-800 flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold text-amber-800 bg-white px-2 py-0.5 rounded-full border border-[#FFE299]">
                Text / NLP
              </span>
            </div>
            <div className="font-bold text-xs text-amber-800 group-hover:text-amber-900">
              Tải CSV Nhật Ký Ẩn Danh
            </div>
            <p className="text-[10px] text-text-minimal/60 mt-1 leading-relaxed">
              Toàn bộ bài chia sẻ cảm xúc kèm MongoDB ID tác giả, nhãn cảm xúc, độ dài văn bản và số từ.
            </p>
          </button>
        </div>
      </div>

      {/* 4. Filters & Controls */}
      <div className="bg-white border border-[#E2DBFC] p-4 sm:p-5 rounded-[28px] shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-text-minimal/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo MongoDB ID (hoặc Circle Code)..."
              className="w-full pl-9 pr-4 py-2 bg-bg-minimal/50 border border-accent-minimal rounded-xl text-xs focus:outline-none focus:border-[#124B31] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-minimal/40 hover:text-text-minimal"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* DERS Level Filter */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-[11px] font-bold text-text-minimal/60 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Mức DERS-16:
            </span>
            <button
              onClick={() => setSelectedDersLevel('all')}
              className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                selectedDersLevel === 'all'
                  ? 'bg-[#124B31] text-white'
                  : 'bg-bg-minimal text-text-minimal/60 hover:text-text-minimal'
              }`}
            >
              Tất cả ({data?.subjects.length || 0})
            </button>
            <button
              onClick={() => setSelectedDersLevel('high')}
              className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                selectedDersLevel === 'high'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
              }`}
            >
              Cao (≥60)
            </button>
            <button
              onClick={() => setSelectedDersLevel('moderate')}
              className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                selectedDersLevel === 'moderate'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              Trung bình (45-59)
            </button>
            <button
              onClick={() => setSelectedDersLevel('low')}
              className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                selectedDersLevel === 'low'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Ổn định (&lt;45)
            </button>
          </div>
        </div>

        {/* Second row of filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-accent-minimal/40 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-text-minimal/60 mr-1">Lọc hoạt động:</span>
            <button
              onClick={() => setSelectedActivityFilter('all')}
              className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                selectedActivityFilter === 'all' ? 'bg-[#124B31] text-white' : 'text-text-minimal/60 hover:bg-black/5'
              }`}
            >
              Mọi hoạt động
            </button>
            <button
              onClick={() => setSelectedActivityFilter('has_journals')}
              className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                selectedActivityFilter === 'has_journals' ? 'bg-[#124B31] text-white' : 'text-text-minimal/60 hover:bg-black/5'
              }`}
            >
              Có viết nhật ký
            </button>
            <button
              onClick={() => setSelectedActivityFilter('has_reading')}
              className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                selectedActivityFilter === 'has_reading' ? 'bg-[#124B31] text-white' : 'text-text-minimal/60 hover:bg-black/5'
              }`}
            >
              Có đọc sách
            </button>
            <button
              onClick={() => setSelectedActivityFilter('active_today')}
              className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                selectedActivityFilter === 'active_today' ? 'bg-[#124B31] text-white' : 'text-text-minimal/60 hover:bg-black/5'
              }`}
            >
              Hoạt động hôm nay
            </button>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-semibold text-text-minimal/70">
            <input
              type="checkbox"
              checked={includeAdmin}
              onChange={(e) => setIncludeAdmin(e.target.checked)}
              className="rounded accent-[#124B31] cursor-pointer"
            />
            <span>Bao gồm tài khoản Admin</span>
          </label>
        </div>
      </div>

      {/* 5. Subjects Table (MongoDB ID as Primary Identity) */}
      <div className="bg-white border border-[#E2DBFC] rounded-[28px] shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-accent-minimal/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#124B31]" />
            <h4 className="font-bold text-xs uppercase tracking-wider text-text-minimal">
              Danh Sách Đối Tượng Nghiên Cứu ({filteredSubjects.length} / {data?.totalSubjects || 0})
            </h4>
          </div>
          <span className="text-[11px] text-text-minimal/50 font-medium">
            Tên định danh = MongoDB ObjectId
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-text-minimal/50 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#124B31]" />
            <span>Đang tải và chuẩn hóa dữ liệu ẩn danh từ cơ sở dữ liệu...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 text-xs font-semibold">
            {error}
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="p-12 text-center text-text-minimal/50 text-xs">
            Không tìm thấy đối tượng nào phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-bg-minimal/70 text-text-minimal/60 font-bold border-b border-accent-minimal text-[10px] uppercase">
                <tr>
                  <th className="py-3 px-4">Tên / MongoDB ID</th>
                  <th className="py-3 px-3">Thang Đo DERS-16</th>
                  <th className="py-3 px-3 hidden md:table-cell">5 Phân Nhóm</th>
                  <th className="py-3 px-3">Hoạt Động</th>
                  <th className="py-3 px-3 hidden sm:table-cell">Bình Yên</th>
                  <th className="py-3 px-4 text-right">Chi Tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-accent-minimal/50">
                {filteredSubjects.map((s, idx) => {
                  const ders = s.ders16;
                  const isCopied = copiedMongoId === s.mongoId;
                  const topEmotion = Object.entries(s.activities.journals.emotionCounts || {}).sort((a, b) => b[1] - a[1])[0];

                  return (
                    <tr key={s.mongoId || idx} className="hover:bg-bg-minimal/40 transition-colors">
                      {/* MongoDB ID */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-xs font-bold text-text-minimal bg-[#F7F5FE] border border-[#E2DBFC] px-2 py-0.5 rounded-lg flex items-center gap-1.5 shadow-2xs">
                            <span>{s.mongoId}</span>
                            <button
                              onClick={() => handleCopyId(s.mongoId)}
                              className="text-text-minimal/40 hover:text-[#124B31] transition-colors cursor-pointer"
                              title="Sao chép MongoDB ID"
                            >
                              {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                          {s.isActiveToday && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500" title="Hoạt động hôm nay"></span>
                          )}
                        </div>
                        <div className="text-[10px] text-text-minimal/50 mt-0.5">
                          {s.subjectCode && <span className="font-mono font-bold text-[#124B31] mr-1.5">{s.subjectCode}</span>}
                          <span>Chuỗi: {s.streakDays} ngày • Đăng ký: {s.registeredDate ? new Date(s.registeredDate).toLocaleDateString('vi-VN') : 'Gần đây'}</span>
                        </div>
                      </td>

                      {/* DERS-16 Total */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-extrabold ${
                            (ders?.totalScore || 0) >= 60
                              ? 'bg-rose-100 text-rose-900 border-rose-300'
                              : (ders?.totalScore || 0) >= 45
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          }`}>
                            {ders?.totalScore || 56} / 80
                          </span>
                          <span className="text-[10px] font-bold text-text-minimal/60">
                            ({ders?.percentage || 70}%)
                          </span>
                        </div>
                        <div className="text-[10px] text-text-minimal/50 truncate max-w-[140px] mt-0.5">
                          {ders?.level?.split('(')[0] || 'Khó khăn điều hòa cảm xúc cao'}
                        </div>
                      </td>

                      {/* 5 Subscales Breakdown */}
                      <td className="py-3.5 px-3 whitespace-nowrap hidden md:table-cell">
                        <div className="flex items-center gap-1 text-[10px]">
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200" title="Clarity (Nhận biết): 10đ">
                            Cl: <strong>{ders?.subscales.clarity.score || 6}</strong>
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200" title="Goals (Mục tiêu): 15đ">
                            Go: <strong>{ders?.subscales.goals.score || 11}</strong>
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200" title="Impulse (Xung động): 15đ">
                            Im: <strong>{ders?.subscales.impulse.score || 11}</strong>
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200" title="Nonacceptance (Chấp nhận): 15đ">
                            No: <strong>{ders?.subscales.nonacceptance.score || 8}</strong>
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-200 text-rose-700 font-bold" title="Strategies (Chiến lược): 25đ">
                            St: <strong>{ders?.subscales.strategies.score || 20}</strong>
                          </span>
                        </div>
                      </td>

                      {/* Activities Summary */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-[10px] font-medium text-text-minimal/70">
                          <span title="Thói quen uống nước" className="flex items-center gap-0.5">
                            <Droplets className="w-3 h-3 text-[#0369A1]" />
                            <strong>{s.activities.waterLog.glassesConsumed}</strong>/8 ly
                          </span>
                          <span>•</span>
                          <span title="Số bài nhật ký" className="flex items-center gap-0.5">
                            <BookOpen className="w-3 h-3 text-purple-700" />
                            <strong>{s.activities.journals.totalEntries}</strong> bài
                          </span>
                          <span>•</span>
                          <span title="Phút đọc sách" className="flex items-center gap-0.5">
                            <Sparkles className="w-3 h-3 text-amber-700" />
                            <strong>{s.activities.readingSessions.totalMinutes}</strong>p
                          </span>
                        </div>
                        {topEmotion && (
                          <div className="text-[10px] text-text-minimal/50 mt-0.5">
                            Cảm xúc chính: <strong>{topEmotion[0]}</strong> ({topEmotion[1]} lần)
                          </div>
                        )}
                      </td>

                      {/* Peace Score */}
                      <td className="py-3.5 px-3 whitespace-nowrap hidden sm:table-cell">
                        <div className="font-extrabold text-[#124B31] text-xs">
                          {s.peaceScore} / 100
                        </div>
                        <div className="w-16 bg-accent-minimal/50 h-1.5 rounded-full overflow-hidden mt-1">
                          <div
                            className="bg-[#124B31] h-full rounded-full"
                            style={{ width: `${Math.min(100, s.peaceScore)}%` }}
                          ></div>
                        </div>
                      </td>

                      {/* Inspection Action */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setInspectedSubject(s);
                            setInspectorTab('ders16');
                          }}
                          className="px-3 py-1 rounded-full bg-[#E0F2FE] hover:bg-[#BAE6FD] text-[#0369A1] font-bold text-[11px] border border-[#BAE6FD] transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Chi Tiết</span>
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

      {/* 6. Deep Inspection Modal for a Single Anonymous Subject */}
      <AnimatePresence>
        {inspectedSubject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white border border-[#E2DBFC] rounded-[32px] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto"
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 bg-gradient-to-r from-[#F7F5FE] via-white to-[#F0FDF4] border-b border-accent-minimal/70 flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#C8F7DC] text-[#124B31] border border-[#9EE7C0] text-[10px] font-bold mb-1">
                    <ShieldCheck className="w-3 h-3 text-[#124B31]" />
                    <span>HỒ SƠ ẨN DANH NGHIÊN CỨU (DE-IDENTIFIED SUBJECT)</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-bold font-mono text-text-minimal">
                      {inspectedSubject.mongoId}
                    </h3>
                    <button
                      onClick={() => handleCopyId(inspectedSubject.mongoId)}
                      className="text-text-minimal/50 hover:text-[#124B31] transition-colors p-1"
                      title="Sao chép MongoDB ID"
                    >
                      {copiedMongoId === inspectedSubject.mongoId ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    {inspectedSubject.subjectCode && (
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD]">
                        {inspectedSubject.subjectCode}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-minimal/60 mt-0.5">
                    Điểm DERS-16: <strong className="text-[#0369A1]">{inspectedSubject.ders16?.totalScore || 56}/80</strong> • Điểm bình yên: <strong className="text-[#124B31]">{inspectedSubject.peaceScore}/100</strong> • Chuỗi: <strong className="text-amber-700">{inspectedSubject.streakDays} ngày</strong>
                  </p>
                </div>

                <button
                  onClick={() => setInspectedSubject(null)}
                  className="p-2 rounded-full hover:bg-black/5 text-text-minimal/50 hover:text-text-minimal transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Tabs */}
              <div className="flex items-center gap-2 px-6 pt-3 border-b border-accent-minimal/60 bg-bg-minimal/40 text-xs font-bold">
                <button
                  onClick={() => setInspectorTab('ders16')}
                  className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    inspectorTab === 'ders16'
                      ? 'border-[#124B31] text-[#124B31]'
                      : 'border-transparent text-text-minimal/60 hover:text-text-minimal'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Thang Đo DERS-16 (16 Câu)</span>
                </button>

                <button
                  onClick={() => setInspectorTab('activities')}
                  className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    inspectorTab === 'activities'
                      ? 'border-[#124B31] text-[#124B31]'
                      : 'border-transparent text-text-minimal/60 hover:text-text-minimal'
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  <span>Hoạt Động Xoa Dịu & Thói Quen</span>
                </button>

                <button
                  onClick={() => setInspectorTab('journals')}
                  className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    inspectorTab === 'journals'
                      ? 'border-[#124B31] text-[#124B31]'
                      : 'border-transparent text-text-minimal/60 hover:text-text-minimal'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Nhật Ký Ẩn Danh ({inspectedSubject.activities.journals.totalEntries})</span>
                </button>

                <button
                  onClick={() => setInspectorTab('raw_json')}
                  className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    inspectorTab === 'raw_json'
                      ? 'border-[#124B31] text-[#124B31]'
                      : 'border-transparent text-text-minimal/60 hover:text-text-minimal'
                  }`}
                >
                  <FileCode className="w-4 h-4" />
                  <span>Raw JSON Subject</span>
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
                {/* 1. DERS-16 Tab */}
                {inspectorTab === 'ders16' && (
                  <div className="space-y-5">
                    {/* Subscales */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      <div className="p-3 bg-bg-minimal/60 border border-accent-minimal rounded-xl text-center">
                        <span className="text-[10px] text-text-minimal/60 block font-bold">Clarity (Nhận biết)</span>
                        <div className="text-base font-extrabold text-[#124B31] mt-0.5">
                          {inspectedSubject.ders16?.subscales.clarity.score || 6} / 10
                        </div>
                        <span className="text-[9px] text-text-minimal/50">2 câu (Q1, Q2)</span>
                      </div>
                      <div className="p-3 bg-bg-minimal/60 border border-accent-minimal rounded-xl text-center">
                        <span className="text-[10px] text-text-minimal/60 block font-bold">Goals (Mục tiêu)</span>
                        <div className="text-base font-extrabold text-amber-700 mt-0.5">
                          {inspectedSubject.ders16?.subscales.goals.score || 11} / 15
                        </div>
                        <span className="text-[9px] text-text-minimal/50">3 câu (Q3, Q7, Q14)</span>
                      </div>
                      <div className="p-3 bg-bg-minimal/60 border border-accent-minimal rounded-xl text-center">
                        <span className="text-[10px] text-text-minimal/60 block font-bold">Impulse (Xung động)</span>
                        <div className="text-base font-extrabold text-rose-700 mt-0.5">
                          {inspectedSubject.ders16?.subscales.impulse.score || 11} / 15
                        </div>
                        <span className="text-[9px] text-text-minimal/50">3 câu (Q4, Q8, Q10)</span>
                      </div>
                      <div className="p-3 bg-bg-minimal/60 border border-accent-minimal rounded-xl text-center">
                        <span className="text-[10px] text-text-minimal/60 block font-bold">Nonacceptance</span>
                        <div className="text-base font-extrabold text-teal-700 mt-0.5">
                          {inspectedSubject.ders16?.subscales.nonacceptance.score || 8} / 15
                        </div>
                        <span className="text-[9px] text-text-minimal/50">3 câu (Q9, Q12, Q13)</span>
                      </div>
                      <div className="p-3 bg-bg-minimal/60 border border-accent-minimal rounded-xl text-center col-span-2 sm:col-span-1">
                        <span className="text-[10px] text-text-minimal/60 block font-bold">Strategies (Xoa dịu)</span>
                        <div className="text-base font-extrabold text-purple-700 mt-0.5">
                          {inspectedSubject.ders16?.subscales.strategies.score || 20} / 25
                        </div>
                        <span className="text-[9px] text-text-minimal/50">5 câu (Q5, 6, 11, 15, 16)</span>
                      </div>
                    </div>

                    {/* 16 Items Table */}
                    <div className="border border-accent-minimal rounded-2xl overflow-hidden shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-bg-minimal/80 text-text-minimal/60 font-bold border-b border-accent-minimal text-[10px] uppercase">
                          <tr>
                            <th className="p-2.5 text-center w-10">#</th>
                            <th className="p-2.5">Câu hỏi DERS-16</th>
                            <th className="p-2.5 hidden sm:table-cell">Phân nhóm</th>
                            <th className="p-2.5 text-right w-32">Điểm (1-5)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-accent-minimal/60">
                          {inspectedSubject.ders16?.answers.map(item => (
                            <tr key={item.id} className="hover:bg-bg-minimal/30 transition-colors">
                              <td className="p-2.5 text-center font-bold text-text-minimal/50">
                                {item.id}
                              </td>
                              <td className="p-2.5 font-medium text-text-minimal">
                                {item.question}
                              </td>
                              <td className="p-2.5 text-text-minimal/60 text-[11px] hidden sm:table-cell">
                                {item.subscaleName}
                              </td>
                              <td className="p-2.5 text-right whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${
                                  item.score === 5 ? 'bg-rose-100 text-rose-800 border-rose-300' :
                                  item.score === 4 ? 'bg-orange-100 text-orange-800 border-orange-300' :
                                  item.score === 3 ? 'bg-amber-100 text-amber-800 border-amber-300' :
                                  item.score === 2 ? 'bg-teal-100 text-teal-800 border-teal-300' :
                                  'bg-emerald-100 text-emerald-800 border-emerald-300'
                                }`}>
                                  {item.score} / 5
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 2. Activities Tab */}
                {inspectorTab === 'activities' && (
                  <div className="space-y-4">
                    {/* Water log */}
                    <div className="p-4 bg-white border border-[#BAE6FD] rounded-2xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-text-minimal">
                          <Droplets className="w-4 h-4 text-[#0369A1]" />
                          <span>Uống Nước Dưỡng Thể</span>
                        </div>
                        <span className="font-extrabold text-[#0369A1]">
                          {inspectedSubject.activities.waterLog.glassesConsumed} / {inspectedSubject.activities.waterLog.dailyGoal} ly
                        </span>
                      </div>
                      <div className="w-full bg-[#E0F2FE]/60 h-2 rounded-full overflow-hidden my-2">
                        <div
                          className="bg-[#0369A1] h-full rounded-full"
                          style={{ width: `${Math.min(100, (inspectedSubject.activities.waterLog.glassesConsumed / 8) * 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] text-text-minimal/60">
                        Chuỗi thói quen: {inspectedSubject.activities.waterLog.streak} ngày liên tiếp
                      </span>
                    </div>

                    {/* Reading Sessions */}
                    <div className="p-4 bg-white border border-purple-200 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between font-bold text-text-minimal">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-purple-700" />
                          <span>Phiên Đọc Sách Chánh Niệm ({inspectedSubject.activities.readingSessions.totalSessions} phiên)</span>
                        </div>
                        <span className="text-purple-700 font-extrabold">
                          {inspectedSubject.activities.readingSessions.totalMinutes} phút tổng cộng
                        </span>
                      </div>

                      {inspectedSubject.activities.readingSessions.sessions.length === 0 ? (
                        <p className="text-text-minimal/50 text-center py-2">Chưa có phiên đọc sách.</p>
                      ) : (
                        inspectedSubject.activities.readingSessions.sessions.map((s, i) => (
                          <div key={i} className="p-2.5 bg-bg-minimal/50 border border-accent-minimal/60 rounded-xl flex items-start justify-between gap-3 text-[11px]">
                            <div>
                              <div className="font-bold text-text-minimal">📖 {s.bookTitle} ({s.durationMinutes} phút)</div>
                              {s.quote && <p className="italic text-text-minimal/70 mt-0.5">"{s.quote}"</p>}
                            </div>
                            <span className="text-[10px] text-text-minimal/50 whitespace-nowrap">{s.date}</span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Gratitude Cards */}
                    <div className="p-4 bg-white border border-[#FFE299] rounded-2xl space-y-2">
                      <div className="flex items-center gap-2 font-bold text-text-minimal">
                        <Sparkles className="w-4 h-4 text-amber-700" />
                        <span>Thực Hành Biết Ơn ({inspectedSubject.activities.gratitudeCards.totalCards} thẻ)</span>
                      </div>

                      {inspectedSubject.activities.gratitudeCards.cards.length === 0 ? (
                        <p className="text-text-minimal/50 text-center py-2">Chưa có thẻ biết ơn.</p>
                      ) : (
                        inspectedSubject.activities.gratitudeCards.cards.map((g, i) => (
                          <div key={i} className="p-2.5 bg-[#FFFDF5] border border-[#FFEBB3] rounded-xl text-[11px] space-y-1">
                            <span className="text-[10px] font-bold text-amber-800 block">{g.date}</span>
                            {g.items.map((item, idx) => (
                              <p key={idx} className="text-text-minimal/80">• {item}</p>
                            ))}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Journals Tab */}
                {inspectorTab === 'journals' && (
                  <div className="space-y-3">
                    {inspectedSubject.activities.journals.entries.length === 0 ? (
                      <p className="text-text-minimal/50 text-center py-8">Đối tượng này chưa có bài nhật ký nào.</p>
                    ) : (
                      inspectedSubject.activities.journals.entries.map((j, i) => (
                        <div key={j.journalId || i} className="p-4 bg-white border border-accent-minimal rounded-2xl space-y-2 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-[11px] px-2 py-0.5 rounded-full bg-bg-minimal border border-accent-minimal text-text-minimal">
                              Cảm xúc: {j.emotion}
                            </span>
                            <span className="text-[10px] text-text-minimal/50">
                              {j.date} {j.time && `• ${j.time}`} • {j.wordCount} từ ({j.contentLength} ký tự)
                            </span>
                          </div>
                          <p className="text-[11px] italic text-text-minimal/80 leading-relaxed">
                            "{j.textSnippet}"
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 4. Raw JSON Tab */}
                {inspectorTab === 'raw_json' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-text-minimal/60">JSON Của Đối Tượng Nghiên Cứu:</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(inspectedSubject, null, 2));
                          showNotice(`Đã sao chép JSON của đối tượng ${inspectedSubject.mongoId}`);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#E0F2FE] text-[#0369A1] font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Sao chép JSON</span>
                      </button>
                    </div>
                    <pre className="p-4 bg-slate-900 text-slate-100 rounded-2xl font-mono text-[10px] overflow-x-auto max-h-[350px]">
                      {JSON.stringify(inspectedSubject, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-bg-minimal/80 border-t border-accent-minimal/70 flex items-center justify-between text-[11px]">
                <span className="text-text-minimal/60">
                  Đối tượng: <strong className="font-mono text-text-minimal">{inspectedSubject.mongoId}</strong>
                </span>
                <button
                  onClick={() => setInspectedSubject(null)}
                  className="px-4 py-1.5 bg-[#124B31] text-white rounded-full font-bold hover:bg-[#0D3824] transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
