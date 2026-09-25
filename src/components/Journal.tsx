import React, { useState, useEffect, useRef } from 'react';
import { 
  Smile, Mic, Image, Calendar, Search, Edit2, Trash2, Heart, 
  Sparkles, AlertCircle, Bookmark, Check, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { JournalEntry, EmotionType, EMOTIONS, CompanionMode } from '../types';
import { recordDailyPractice } from '../lib/streak';
import { GENTLE_LESSONS } from '../data/lessons';
import { addStarHistoryLog } from '../lib/achievements';
import { getUserScopeId } from '../lib/scopedStorage';

interface JournalProps {
  entries: JournalEntry[];
  streak: number;
  onAddEntry: (entry: JournalEntry) => void;
  onUpdateEntry: (entry: JournalEntry) => void;
  onDeleteEntry: (id: string) => void;
  onAddCircle: (count: number, reason: string) => void;
  onUpdateStreak: (newStreak: number) => void;
  onNavigateToLesson: (lessonId: string) => void;
  onNavigateToSelfCare: () => void;
  onBack: () => void;
}

// Emotion-aware fallback generator for offline or network timeout scenarios
function generateLocalFallbackInsight(emotion: EmotionType, text: string, mode: CompanionMode) {
  switch (emotion) {
    case 'vui_ve':
      return {
        reflection: "Đọc những dòng chia sẻ rạng rỡ của bạn, mình cảm nhận được trọn vẹn niềm vui, sự hân hoan và năng lượng tích cực lan tỏa!",
        reassurance: "Thật tuyệt vời khi được chứng kiến khoảnh khắc hạnh phúc này của bạn! Bạn hoàn toàn xứng đáng đón nhận trọn vẹn niềm vui và những thành quả ngọt ngào hôm nay.",
        lessonId: "tran_trong_niem_vui",
        suggestion: "Tự thưởng cho bản thân một món quà nhỏ hoặc chia sẻ nụ cười rạng rỡ này với người bạn thương quý.",
        quote: "Niềm vui được sẻ chia là niềm vui nhân đôi. Hãy ôm trọn khoảnh khắc rực rỡ này vào tim!"
      };
    case 'binh_yen':
      return {
        reflection: "Từng câu chữ của bạn toát lên một cảm giác an tĩnh, nhẹ nhàng và thảnh thơi hiếm có.",
        reassurance: "Những giây phút tâm hồn phẳng lặng, không vướng bận âu lo là món quà vô giá. Chúc bạn luôn giữ được sự an nhiên quý báu này giữa dòng đời hối hả.",
        lessonId: "giu_tron_binh_yen",
        suggestion: "Thong thả nhâm nhi một ngụm trà ấm, ngắm nhìn mây trời và cảm nhận hơi thở dịu nhẹ.",
        quote: "Bình yên không phải là không có bão giông, mà là sự an tĩnh sâu sắc ngay giữa lòng cuộc sống."
      };
    case 'met_moi':
      return {
        reflection: "Mình cảm nhận được sự mệt mỏi và kiệt sức sau những nỗ lực không ngừng nghỉ của bạn.",
        reassurance: "Bạn đã cố gắng rất nhiều rồi. Cho phép cơ thể và tâm trí được nghỉ ngơi, buông lỏng hoàn toàn hôm nay nhé.",
        lessonId: "cam_thay_qua_tai",
        suggestion: "Tạm gác lại danh sách việc cần làm trong tối nay và đi ngủ sớm hơn 30 phút.",
        quote: "Nghỉ ngơi chính là một phần của sự tiến bộ. Dịu dàng với chính mình nhé."
      };
    case 'lo_lang':
      return {
        reflection: "Có vẻ có những trăn trở, bất an đang khiến tâm trí bạn xoay vần và khó tĩnh tại.",
        reassurance: "Mọi việc rồi sẽ có cách giải quyết từng bước một. Bạn có đủ nội lực và sự thông tuệ để vượt qua.",
        lessonId: "lang_nghe_cam_xuc",
        suggestion: "Hít thở theo nhịp 4-4-4 ba lần để hạ nhịp tim và làm dịu hệ thần kinh.",
        quote: "Tập trung vào từng bước chân hiện tại thay vì lo lắng cho cả đoạn đường dài."
      };
    case 'co_don':
      return {
        reflection: "Cảm giác trống trải và mong muốn được thấu hiểu đang hiện diện trong từng dòng chữ của bạn.",
        reassurance: "Dù thế giới ngoài kia có ồn ào đến đâu, bạn luôn có một nơi chốn an toàn ở đây. Bạn luôn có giá trị riêng biệt.",
        lessonId: "gia_dinh_khong_hieu",
        suggestion: "Viết một lời nhắn ấm áp cho người bạn thân thiết hoặc tự ôm lấy bờ vai của mình.",
        quote: "Một mình không có nghĩa là cô độc, đó là cơ hội để bạn kết nối sâu sắc với chính mình."
      };
    case 'tuc_gian':
      return {
        reflection: "Mình thấu hiểu cảm giác bức bối, khó chịu khi ranh giới hoặc kỳ vọng của bạn bị tổn thương.",
        reassurance: "Cơn giận là tín hiệu cho thấy bạn quan tâm và có giới hạn riêng. Hãy để nó nguội dần một cách an toàn và lành mạnh.",
        lessonId: "giao_tiep_khong_thang_thua",
        suggestion: "Rửa mặt bằng nước mát hoặc viết xé một tờ giấy nháp để giải tỏa cơn giận.",
        quote: "Giữ sự bình tĩnh là sức mạnh lớn nhất khi đối diện với thử thách."
      };
    case 'buon_ba':
    default:
      return {
        reflection: "Mình đã lắng nghe trọn vẹn những nỗi niềm trĩu nặng mà bạn đang mang trong lòng.",
        reassurance: "Bạn không hề đơn độc. Cảm xúc buồn bã là hoàn toàn tự nhiên và mình luôn ở đây để đồng hành, ôm lấy bạn.",
        lessonId: "buon_khong_ly_do",
        suggestion: "Uống một cốc nước ấm, quấn một chiếc chăn nhẹ và cho phép bản thân được thả lỏng.",
        quote: "Bầu trời có lúc mưa dông, nhưng sau cơn mưa hoa lá sẽ đâm chồi xanh biếc."
      };
  }
}

export default function Journal({ 
  entries, streak, onAddEntry, onUpdateEntry, onDeleteEntry, 
  onAddCircle, onUpdateStreak, onNavigateToLesson, onNavigateToSelfCare, onBack 
}: JournalProps) {
  // Navigation states inside Journal module
  // 'list' | 'checkin' | 'writing' | 'detail' | 'edit'
  const [view, setView] = useState<'list' | 'checkin' | 'writing' | 'detail'>('list');
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  // New entry staging states
  const [chosenEmotion, setChosenEmotion] = useState<EmotionType | null>(null);
  const [journalText, setJournalText] = useState('');
  const [companionMode, setCompanionMode] = useState<CompanionMode>('chi_dan_lang_nghe');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [voiceUrl, setVoiceUrl] = useState<string | undefined>(undefined);

  // Search/Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEmotion, setFilterEmotion] = useState<string>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // UI Microinteraction states
  const [isSaving, setIsSaving] = useState(false);
  const [showRewardPopup, setShowRewardPopup] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Editing existing entry states
  const [editText, setEditText] = useState('');

  // Auto-save feedback simulator
  const [autoSaveStatus, setAutoSaveStatus] = useState<string>('');

  useEffect(() => {
    if (view === 'writing' && journalText.trim() !== '') {
      setAutoSaveStatus('Đang tự động lưu nháp...');
      const t = setTimeout(() => {
        setAutoSaveStatus('Đã lưu nháp lúc ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [journalText, view]);

  // Handle Photo upload with real file reader or camera
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotoUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Voice recorder with real MediaRecorder Web API
  const handleVoiceToggle = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          alert('Trình duyệt không hỗ trợ micro hoặc cần cấp quyền truy cập micro.');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioUrl = URL.createObjectURL(audioBlob);
          setVoiceUrl(audioUrl);
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Microphone error:', err);
        alert('Không thể truy cập micro. Vui lòng cho phép quyền micro để ghi âm tâm sự.');
      }
    }
  };

  // Start new Check-in flow
  const startNewJournal = () => {
    setChosenEmotion(null);
    setJournalText('');
    setPhotoUrl(undefined);
    setVoiceUrl(undefined);
    setCompanionMode('chi_dan_lang_nghe');
    setView('checkin');
  };

  const handleSelectEmotion = (emotion: EmotionType) => {
    setChosenEmotion(emotion);
    setView('writing');
  };

  // Submit and call real Express Gemini proxy
  const handleSaveJournal = async () => {
    if (journalText.trim() === '') {
      alert('Hãy viết đôi dòng chia sẻ để Chấm Tròn Cảm Xúc lắng nghe bạn nhé!');
      return;
    }

    const currentEmotion = chosenEmotion || 'binh_yen';
    setIsSaving(true);
    setAutoSaveStatus('Đang phân tích cảm xúc cùng AI...');

    try {
      const response = await fetch('/api/gemini/understand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story: journalText,
          mode: companionMode,
          emotion: currentEmotion
        })
      });

      const aiData = await response.json();

      const newEntry: JournalEntry = {
        id: 'j_' + Date.now(),
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        emotion: currentEmotion,
        text: journalText,
        isFavorite: false,
        companionMode: companionMode,
        photoUrl: photoUrl,
        voiceUrl: voiceUrl,
        aiInsight: aiData
      };

      onAddEntry(newEntry);
      setSelectedEntry(newEntry);
      setIsSaving(false);
      setShowRewardPopup(true);
      onUpdateStreak(recordDailyPractice());

      const savedLevelsStr = localStorage.getItem('achievement_star_levels');
      let levels: Record<string, number> = {};
      if (savedLevelsStr) {
        try { levels = JSON.parse(savedLevelsStr); } catch {}
      }
      levels['b5'] = Math.max(1, (levels['b5'] || 0) + 1);
      localStorage.setItem('achievement_star_levels', JSON.stringify(levels));

      const scopeId = getUserScopeId();
      addStarHistoryLog('Sổ Tay Tâm Sự', 1, '📓', 'Nhật ký', 'b5', scopeId, newEntry.date);
    } catch (err) {
      console.error(err);
      // Emotion-aware local fallback
      const fallbackInsight = generateLocalFallbackInsight(currentEmotion, journalText, companionMode);
      const fallbackEntry: JournalEntry = {
        id: 'j_' + Date.now(),
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        emotion: currentEmotion,
        text: journalText,
        isFavorite: false,
        companionMode: companionMode,
        photoUrl: photoUrl,
        voiceUrl: voiceUrl,
        aiInsight: fallbackInsight
      };
      onAddEntry(fallbackEntry);
      setSelectedEntry(fallbackEntry);
      setIsSaving(false);
      setShowRewardPopup(true);
      onUpdateStreak(recordDailyPractice());

      const savedLevelsStr = localStorage.getItem('achievement_star_levels');
      let levels: Record<string, number> = {};
      if (savedLevelsStr) {
        try { levels = JSON.parse(savedLevelsStr); } catch {}
      }
      levels['b5'] = Math.max(1, (levels['b5'] || 0) + 1);
      localStorage.setItem('achievement_star_levels', JSON.stringify(levels));

      const scopeId = getUserScopeId();
      addStarHistoryLog('Sổ Tay Tâm Sự', 1, '📓', 'Nhật ký', 'b5', scopeId, fallbackEntry.date);
    }
    window.dispatchEvent(new CustomEvent('selfcare-state-change'));
  };

  // Delete handler
  const confirmDelete = (id: string) => {
    onDeleteEntry(id);
    setShowDeleteConfirm(null);
    setView('list');
    window.dispatchEvent(new CustomEvent('selfcare-state-change'));
  };

  // Toggle favorite status
  const toggleFavorite = (entry: JournalEntry) => {
    const updated = { ...entry, isFavorite: !entry.isFavorite };
    onUpdateEntry(updated);
    if (selectedEntry && selectedEntry.id === entry.id) {
      setSelectedEntry(updated);
    }
  };

  // Filter journals list
  const filteredEntries = (entries || []).filter(e => {
    if (!e) return false;
    const text = (e.text || (e as any).content || '').toLowerCase();
    const reflection = (e.aiInsight?.reflection || '').toLowerCase();
    const query = (searchQuery || '').toLowerCase();
    const matchesSearch = text.includes(query) || reflection.includes(query);
    const matchesEmotion = filterEmotion === 'all' || e.emotion === filterEmotion;
    const matchesFav = !showFavoritesOnly || !!e.isFavorite;
    return matchesSearch && matchesEmotion && matchesFav;
  });

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 text-text-minimal" id="journal-module-container">
      
      {/* 1. LIST OF JOURNALS VIEW */}
      {view === 'list' && (
        <div id="journal-list-view">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
            <button 
              onClick={onBack} 
              className="flex items-center gap-2 text-text-minimal/60 hover:text-[#4A121A] transition-colors bg-white/80 backdrop-blur px-4 py-2 rounded-full border border-accent-minimal/60 shadow-sm"
              id="btn-journal-back"
            >
              <span>← Quay lại</span>
            </button>

            <button
              onClick={startNewJournal}
              className="flex items-center gap-2 bg-[#FFB6BD] hover:bg-[#FF8E98] text-[#4A121A] font-extrabold px-6 py-3 rounded-full shadow-sm cursor-pointer transition-all hover:scale-[1.02] border border-[#F89CA7]"
              id="btn-journal-new"
            >
              <Sparkles className="w-4 h-4 animate-spin text-[#4A121A]" />
              <span>Ghi chép Nhật ký Cảm xúc</span>
            </button>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-serif text-text-minimal tracking-tight">Nhật Ký Cảm Xúc</h1>
            <p className="text-text-minimal/60 text-xs mt-2 font-sans">Dịu dàng mở ra từng chương cảm xúc và nuôi dưỡng đứa trẻ bên trong bạn.</p>
          </div>

          {/* Search, Filter, and Favoriting Panel */}
          <div className="bg-white/80 backdrop-blur-sm border border-accent-minimal p-4 rounded-3xl shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center">
            <div className="flex items-center gap-2 bg-bg-minimal border border-accent-minimal/60 px-3 py-2 rounded-2xl w-full md:flex-1">
              <Search className="w-4 h-4 text-text-minimal/40" />
              <input 
                type="text" 
                placeholder="Tìm kiếm nhật ký, nội dung..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none text-xs text-text-minimal/80 w-full focus:outline-none"
              />
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              {/* Emotion selection */}
              <select
                value={filterEmotion}
                onChange={(e) => setFilterEmotion(e.target.value)}
                className="bg-bg-minimal border border-accent-minimal/60 text-xs px-3 py-2 rounded-2xl text-text-minimal/80 focus:outline-none cursor-pointer flex-1 md:flex-none"
              >
                <option value="all">Tất cả cảm xúc</option>
                {Object.keys(EMOTIONS).map((key) => (
                  <option key={key} value={key}>{EMOTIONS[key as EmotionType].emoji} {EMOTIONS[key as EmotionType].label}</option>
                ))}
              </select>

              {/* Favorites only */}
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`flex items-center gap-1.5 border px-4 py-2 rounded-2xl text-xs font-semibold cursor-pointer transition-all ${
                  showFavoritesOnly 
                    ? 'bg-rose-50/50 text-rose-600 border-rose-200' 
                    : 'bg-bg-minimal border-accent-minimal/60 text-text-minimal hover:border-accent-minimal'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-rose-500 text-rose-500' : 'text-text-minimal/40'}`} />
                <span>Yêu thích ({entries.filter(e => e.isFavorite).length})</span>
              </button>
            </div>
          </div>

          {/* Grid list or Empty State */}
          {filteredEntries.length === 0 ? (
            <div className="bg-white border border-accent-minimal rounded-[30px] p-12 text-center flex flex-col items-center justify-center min-h-[300px]" id="journal-empty-state">
              <div className="w-24 h-24 bg-[#AFDCF1]/30 border border-[#8BC5E3] rounded-full flex items-center justify-center mb-4 text-[#1E3A5F]">
                <Bookmark className="w-10 h-10" />
              </div>
              <h3 className="font-serif text-text-minimal text-lg font-bold">Chưa có trang nhật ký nào</h3>
              <p className="text-text-minimal/60 text-xs mt-2 max-w-sm font-sans">Hãy trút bỏ những bận lòng, lo toan của hôm nay bằng một trang viết mộc mạc và an bình.</p>
              <button 
                onClick={startNewJournal} 
                className="mt-6 bg-[#FFB6BD] hover:bg-[#FF8E98] text-[#4A121A] border border-[#F89CA7] font-extrabold text-xs px-6 py-2.5 rounded-full shadow-sm cursor-pointer transition-all"
              >
                Bắt đầu viết ngay
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="journal-entries-grid">
              {filteredEntries.map((entry) => {
                const emo = (entry?.emotion && EMOTIONS[entry.emotion]) ? EMOTIONS[entry.emotion] : EMOTIONS['binh_yen'];
                return (
                  <div 
                    key={entry.id}
                    className="bg-white border border-[#FFD7D5] rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Emotion & Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{emo.emoji}</span>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${emo.color} ${emo.border} ${emo.text}`}>
                            {emo.label}
                          </span>
                        </div>
                        <span className="text-[10px] text-text-minimal/60 font-bold flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {entry.date} lúc {entry.time}
                        </span>
                      </div>

                      {/* Content excerpt */}
                      <p className="text-text-minimal/80 text-xs leading-relaxed line-clamp-3 italic mb-4 font-serif">
                        "{entry.text}"
                      </p>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-accent-minimal/40">
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => toggleFavorite(entry)}
                          className="p-2 text-rose-500 hover:bg-[#FFB6BD] rounded-full transition-colors cursor-pointer"
                        >
                          <Heart className={`w-4 h-4 ${entry.isFavorite ? 'fill-rose-500 text-rose-500' : 'text-text-minimal/40'}`} />
                        </button>
                        {entry.aiInsight && (
                          <div className="flex items-center gap-1 text-[10px] bg-[#AFDCF1] text-[#1E3A5F] px-2.5 py-0.5 rounded-full border border-[#8BC5E3] font-extrabold">
                            <Sparkles className="w-3 h-3 text-[#1E3A5F] animate-pulse" />
                            <span>AI Phản hồi</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button 
                          onClick={() => { setSelectedEntry(entry); setView('detail'); }}
                          className="text-xs bg-bg-minimal hover:bg-accent-minimal/20 text-text-minimal font-semibold px-3.5 py-1.5 rounded-full cursor-pointer border border-accent-minimal/40"
                        >
                          Xem chi tiết
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(entry.id)}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-full transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. CHOOSE EMOTION CHECK-IN VIEW */}
      {view === 'checkin' && (
        <div className="text-center py-6" id="journal-checkin-view">
          <h2 className="text-2xl font-serif text-text-minimal">Cảm Xúc Hôm Nay Của Bạn Thế Nào?</h2>
          <p className="text-text-minimal/60 text-xs mt-2">Hãy lắng lòng lại một giây để chọn một biểu tượng phản ánh trung thực tâm hồn bạn lúc này.</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4 max-w-4xl mx-auto my-12">
            {Object.keys(EMOTIONS).map((key) => {
              const emo = EMOTIONS[key as EmotionType];
              return (
                <button
                  key={key}
                  onClick={() => handleSelectEmotion(key as EmotionType)}
                  className="flex flex-col items-center justify-center p-6 bg-white border border-accent-minimal rounded-3xl hover:border-primary-minimal/40 shadow-sm hover:scale-105 transition-all cursor-pointer"
                  id={`btn-checkin-emotion-${key}`}
                >
                  <span className="text-5xl mb-3 animate-bounce">{emo.emoji}</span>
                  <span className="text-xs font-bold text-text-minimal">{emo.label}</span>
                </button>
              );
            })}
          </div>

          <button 
            onClick={() => setView('list')} 
            className="text-text-minimal/60 hover:text-primary-minimal text-xs font-bold bg-white border border-accent-minimal/60 px-6 py-2.5 rounded-full transition-colors cursor-pointer"
          >
            Quay lại lịch sử
          </button>
        </div>
      )}

      {/* 3. WRITING JOURNAL VIEW */}
      {view === 'writing' && chosenEmotion && (
        <div id="journal-writing-view">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="text-3xl">{(EMOTIONS[chosenEmotion] || EMOTIONS['binh_yen']).emoji}</span>
              <span className="text-sm font-semibold text-text-minimal">Đang viết về nỗi lòng: "{(EMOTIONS[chosenEmotion] || EMOTIONS['binh_yen']).label}"</span>
            </div>
            <button 
              onClick={() => setView('checkin')} 
              className="text-xs text-text-minimal/50 hover:text-text-minimal bg-white px-3 py-1.5 rounded-full border border-accent-minimal cursor-pointer"
            >
              Chọn lại cảm xúc
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white/70 backdrop-blur-sm border border-accent-minimal p-6 rounded-[30px] flex flex-col justify-between min-h-[380px]">
              <div>
                <div className="flex justify-between items-center text-xs text-text-minimal/60 mb-2">
                  <span>Sổ tay lưu bút</span>
                  <span className="font-mono text-[10px] text-[#2B4212] font-extrabold">{autoSaveStatus}</span>
                </div>
                
                {/* Rich Writing Box */}
                <textarea
                  placeholder="Hãy viết ra mọi điều đang ở trong lòng bạn hệt như đang trò chuyện cùng người bạn thân mến..."
                  value={journalText}
                  onChange={(e) => setJournalText(e.target.value)}
                  className="w-full bg-transparent border-0 focus:ring-0 text-text-minimal text-sm leading-relaxed placeholder-text-minimal/30 resize-none min-h-[220px] focus:outline-none font-serif"
                  id="journal-writing-textarea"
                />
              </div>

              {/* Micro-interaction buttons (voice, photo, emoji) */}
              <div className="flex items-center justify-between pt-4 border-t border-accent-minimal/60">
                <div className="flex gap-2">
                  {/* Real Voice Recording */}
                  <button 
                    type="button"
                    onClick={handleVoiceToggle}
                    className={`p-2.5 rounded-full border transition-all cursor-pointer ${
                      isRecording 
                        ? 'bg-rose-500 text-white border-rose-500 animate-pulse' 
                        : 'bg-bg-minimal text-text-minimal/60 border-accent-minimal/80 hover:bg-accent-minimal/20'
                    }`}
                    title={isRecording ? "Dừng ghi âm" : "Ghi âm giọng nói tâm sự"}
                    id="btn-journal-voice"
                  >
                    <Mic className="w-4 h-4" />
                  </button>

                  {/* Photo Upload */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoUpload}
                    accept="image/*"
                    className="hidden"
                    id="journal-photo-file-input"
                  />
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 bg-bg-minimal text-text-minimal/60 border border-accent-minimal/80 rounded-full hover:bg-accent-minimal/20 cursor-pointer transition-all"
                    title="Thêm hình ảnh chữa lành từ thiết bị"
                    id="btn-journal-photo"
                  >
                    <Image className="w-4 h-4" />
                  </button>

                  {/* Emoji selection popup */}
                  <div className="relative">
                    <button 
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-2.5 bg-bg-minimal text-text-minimal/60 border border-accent-minimal/80 rounded-full hover:bg-accent-minimal/20 cursor-pointer transition-all"
                      title="Thêm nhãn dán cảm xúc"
                      id="btn-journal-emoji"
                    >
                      <Smile className="w-4 h-4" />
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute left-0 bottom-12 bg-white border border-accent-minimal p-3 rounded-2xl shadow-lg flex gap-2 z-20">
                        {['🌸', '🌱', '🌻', '🐱', '☁️', '🎈', '💖'].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              setJournalText(prev => prev + ' ' + emoji);
                              setShowEmojiPicker(false);
                            }}
                            className="text-xl hover:scale-125 transition-transform cursor-pointer"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Display current attached assets indicators */}
                <div className="flex gap-2">
                  {photoUrl && <span className="text-[10px] bg-[#AFDCF1] text-[#1E3A5F] px-2.5 py-0.5 rounded-full border border-[#8BC5E3] font-extrabold">🖼️ Đã đính kèm ảnh</span>}
                  {voiceUrl && <span className="text-[10px] bg-[#AFDCF1] text-[#1E3A5F] px-2.5 py-0.5 rounded-full border border-[#8BC5E3] font-extrabold">🎙️ Đã đính kèm giọng nói</span>}
                </div>
              </div>
            </div>

            {/* Companion Mode Options */}
            <div className="bg-white/70 backdrop-blur-sm border border-accent-minimal p-6 rounded-[30px] flex flex-col justify-between">
              <div>
                <h3 className="font-serif text-text-minimal text-sm mb-2 flex items-center gap-1.5 font-bold">
                  <Heart className="w-4 h-4 text-[#5A1A24]" /> Cách Mình Đồng Hành Cùng Bạn
                </h3>
                <p className="text-text-minimal/60 text-[11px] mb-4">Trước khi bắt đầu đọc tâm sự, hãy cho mình biết hôm nay bạn muốn mình đồng hành theo cách nào nhé.</p>

                <div className="flex flex-col gap-2.5">
                  {[
                    { id: 'chi_dan_lang_nghe', label: 'Chỉ cần lắng nghe', emoji: '🤍', desc: 'Lắng thấu tâm sự, ôm lấy nỗi niềm nhẹ nhàng.' },
                    { id: 'goc_nhin_khac', label: 'Cho mình góc nhìn khác', emoji: '🌿', desc: 'Mang lại cách nhìn tích cực, đầy thấu cảm.' },
                    { id: 'goi_y_bai_hoc', label: 'Gợi ý cho mình bài học', emoji: '📖', desc: 'Dẫn dắt đến bài học tự chữa lành tinh tế.' },
                    { id: 'loi_khuyen_nho', label: 'Cho mình lời khuyên nhỏ', emoji: '🌸', desc: 'Đưa ra hành động cụ thể, hữu ích hằng ngày.' }
                  ].map((mode) => {
                    const isSelected = companionMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        onClick={() => setCompanionMode(mode.id as CompanionMode)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-[#FFD7D5]/90 border-[#F2B6B3] scale-[1.02] shadow-sm font-bold' 
                            : 'bg-white border-accent-minimal/60 hover:border-accent-minimal'
                        }`}
                        id={`btn-companion-mode-${mode.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{mode.emoji}</span>
                          <span className="text-xs font-bold text-text-minimal">{mode.label}</span>
                        </div>
                        <p className="text-[10px] text-text-minimal/60 mt-1 leading-relaxed pl-5">{mode.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setView('list')}
                  className="w-1/3 bg-bg-minimal hover:bg-[#FFB6BD] text-text-minimal hover:text-[#4A121A] font-bold text-xs py-3.5 rounded-full cursor-pointer text-center border border-accent-minimal/40"
                >
                  Xóa bỏ
                </button>
                <button
                  onClick={handleSaveJournal}
                  disabled={isSaving}
                  className="flex-1 bg-[#FFB6BD] hover:bg-[#FF8E98] text-[#4A121A] font-extrabold text-xs py-3.5 rounded-full shadow-sm cursor-pointer flex items-center justify-center gap-2 border border-[#F89CA7]"
                  id="btn-save-journal-submit"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin text-[#4A121A]" /> : <Check className="w-4 h-4 text-[#4A121A]" />}
                  <span>{isSaving ? 'Đang đọc và lắng nghe...' : 'Để mình lắng nghe'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. JOURNAL DETAIL & AI INSIGHT VIEW */}
      {view === 'detail' && selectedEntry && (
        <div id="journal-detail-view">
          <div className="flex items-center justify-between mb-8">
            <button 
              onClick={() => setView('list')} 
              className="flex items-center gap-2 text-text-minimal/60 hover:text-primary-minimal transition-colors bg-white/80 backdrop-blur px-4 py-2 rounded-full border border-accent-minimal/60 shadow-sm"
            >
              <span>← Trở lại kho nhật ký</span>
            </button>

            <button 
              onClick={() => toggleFavorite(selectedEntry)}
              className={`p-2.5 border rounded-full transition-all cursor-pointer ${
                selectedEntry.isFavorite 
                  ? 'bg-rose-50/50 text-rose-500 border-rose-200 shadow-sm' 
                  : 'bg-white text-text-minimal/40 border-accent-minimal/60 hover:bg-bg-minimal'
              }`}
            >
              <Heart className={`w-4 h-4 ${selectedEntry.isFavorite ? 'fill-rose-500' : ''}`} />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Original Entry */}
            <div className="lg:col-span-1 bg-white border border-accent-minimal p-6 rounded-[30px] shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-4xl">{(selectedEntry?.emotion && EMOTIONS[selectedEntry.emotion] ? EMOTIONS[selectedEntry.emotion] : EMOTIONS['binh_yen']).emoji}</span>
                <div>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${(selectedEntry?.emotion && EMOTIONS[selectedEntry.emotion] ? EMOTIONS[selectedEntry.emotion] : EMOTIONS['binh_yen']).color} ${(selectedEntry?.emotion && EMOTIONS[selectedEntry.emotion] ? EMOTIONS[selectedEntry.emotion] : EMOTIONS['binh_yen']).border} ${(selectedEntry?.emotion && EMOTIONS[selectedEntry.emotion] ? EMOTIONS[selectedEntry.emotion] : EMOTIONS['binh_yen']).text}`}>
                    Cảm xúc: {(selectedEntry?.emotion && EMOTIONS[selectedEntry.emotion] ? EMOTIONS[selectedEntry.emotion] : EMOTIONS['binh_yen']).label}
                  </span>
                  <div className="text-[10px] text-text-minimal/50 mt-1 font-semibold">{selectedEntry.date} lúc {selectedEntry.time}</div>
                </div>
              </div>

              <div className="bg-bg-minimal border border-accent-minimal p-5 rounded-2xl italic text-xs leading-relaxed text-text-minimal/80 min-h-[160px] whitespace-pre-line mb-6 font-serif">
                "{selectedEntry.text}"
              </div>

              {selectedEntry.photoUrl && (
                <div className="mb-4 rounded-2xl overflow-hidden border border-accent-minimal shadow-sm">
                  <img src={selectedEntry.photoUrl} alt="Hình ảnh chữa lành" className="w-full h-40 object-cover" />
                </div>
              )}

              {selectedEntry.voiceUrl && (
                <div className="p-3 bg-[#AFDCF1]/40 border border-[#8BC5E3] rounded-2xl flex items-center gap-2 mb-4">
                  <span className="text-xl">🎙️</span>
                  <span className="text-[11px] font-extrabold text-[#1E3A5F]">Bản thu âm cảm xúc hằng ngày</span>
                </div>
              )}

              <button
                onClick={() => setShowDeleteConfirm(selectedEntry.id)}
                className="w-full text-center text-xs text-rose-500 hover:text-rose-600 bg-rose-50/50 border border-rose-200/50 font-bold py-2.5 rounded-xl cursor-pointer transition-colors"
              >
                Xóa trang nhật ký này
              </button>
            </div>

            {/* Right Column: AI Insight Response */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {selectedEntry.aiInsight ? (
                <>
                  {/* AI Response Card */}
                  <div className="bg-white border border-accent-minimal p-8 rounded-[30px] shadow-sm relative overflow-hidden">
                    <div className="absolute right-4 top-4 text-[#1E3A5F]/10">
                      <Sparkles className="w-24 h-24 text-[#AFDCF1]" />
                    </div>

                    <div className="flex items-center gap-2 mb-6">
                      <div className="p-2 bg-[#AFDCF1] text-[#1E3A5F] border border-[#8BC5E3] rounded-xl">
                        <Sparkles className="w-4 h-4 text-[#1E3A5F]" />
                      </div>
                      <h3 className="font-serif text-text-minimal text-base font-bold">Những Chấm Tròn Phản Hồi</h3>
                    </div>

                    <div className="space-y-6 text-xs text-text-minimal/80">
                      {(() => {
                        const isJoyful = selectedEntry.emotion === 'vui_ve';
                        const isPeaceful = selectedEntry.emotion === 'binh_yen';
                        const isPositive = isJoyful || isPeaceful;

                        return (
                          <>
                            <div>
                              <h4 className="font-bold text-text-minimal flex items-center gap-1.5 mb-1 text-sm font-serif">
                                <span>{isJoyful ? '✨' : isPeaceful ? '🌿' : '🤍'}</span>{' '}
                                {isJoyful 
                                  ? 'Điều mình cùng cảm nhận từ niềm vui rạng rỡ của bạn...' 
                                  : isPeaceful 
                                  ? 'Điều mình cảm nhận từ sự an yên của bạn...' 
                                  : 'Điều mình đọc được từ dòng bạn vừa viết...'}
                              </h4>
                              <p className="leading-relaxed bg-bg-minimal border border-accent-minimal/40 p-4 rounded-2xl font-sans">
                                {selectedEntry.aiInsight.reflection}
                              </p>
                            </div>

                            <div>
                              <h4 className="font-bold text-text-minimal flex items-center gap-1.5 mb-1 text-sm font-serif">
                                <span>{isJoyful ? '🎉' : isPeaceful ? '🍃' : '🌸'}</span>{' '}
                                {isJoyful 
                                  ? 'Cùng bạn chia vui & Tự hào về khoảnh khắc này' 
                                  : isPeaceful 
                                  ? 'Lời nhắn gửi an lành & Nuôi dưỡng bình yên' 
                                  : 'Lời vỗ về & Đồng hành cùng bạn'}
                              </h4>
                              <p className={`leading-relaxed p-4 rounded-2xl font-sans ${
                                isJoyful 
                                  ? 'bg-[#F4F9DE] border border-[#C2D772]/70 text-[#2B4212]' 
                                  : isPeaceful 
                                  ? 'bg-[#F6FFD3]/90 border border-[#DDEB8B] text-[#384E18]' 
                                  : 'bg-bg-minimal border border-accent-minimal/40 text-text-minimal/90'
                              }`}>
                                {selectedEntry.aiInsight.reassurance}
                              </p>
                            </div>

                            {/* Gentle Recommended Lesson */}
                            <div>
                              <h4 className="font-bold text-text-minimal flex items-center gap-1.5 mb-2 text-sm font-serif">
                                <span>📖</span> {isPositive ? 'Bài học gợi ý nuôi dưỡng tâm hồn' : 'Bài học dành cho bạn'}
                              </h4>
                              {(() => {
                                const recommendedLesson = GENTLE_LESSONS.find(l => l.id === selectedEntry.aiInsight?.lessonId);
                                if (!recommendedLesson) return null;
                                return (
                                  <div className="bg-white border border-[#FFEEB6] p-4 rounded-2xl flex justify-between items-center shadow-sm">
                                    <div>
                                      <h5 className="font-bold text-text-minimal font-serif">{recommendedLesson.title}</h5>
                                      <span className="text-[10px] text-text-minimal/60 font-semibold">{recommendedLesson.readingTime} đọc - Thể loại: {recommendedLesson.category === 'hieu_chinh_minh' ? 'Hiểu chính mình' : 'Chữa lành'}</span>
                                    </div>
                                    <button
                                      onClick={() => onNavigateToLesson(recommendedLesson.id)}
                                      className="bg-[#FFB6BD] hover:bg-[#FF8E98] text-[#4A121A] border border-[#F89CA7] font-extrabold text-[10px] px-4 py-2 rounded-full shadow-sm cursor-pointer transition-all"
                                    >
                                      Đọc ngay
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-bg-minimal border border-accent-minimal/60 p-4 rounded-2xl">
                                <h5 className="font-bold text-text-minimal flex items-center gap-1.5 mb-1 text-xs font-serif">
                                  <span>{isJoyful ? '🎁' : isPeaceful ? '☕' : '🌱'}</span>{' '}
                                  {isJoyful 
                                    ? 'Điều ngọt ngào bạn có thể tự thưởng' 
                                    : isPeaceful 
                                    ? 'Tận hưởng thêm một chút bình yên' 
                                    : 'Một điều nhỏ bạn có thể làm hôm nay'}
                                </h5>
                                <p className="text-text-minimal/85 italic font-serif">
                                  {selectedEntry.aiInsight.suggestion}
                                </p>
                              </div>
                              <div className="bg-bg-minimal border border-accent-minimal/60 p-4 rounded-2xl">
                                <h5 className="font-bold text-text-minimal flex items-center gap-1.5 mb-1 text-xs font-serif">
                                  <span>{isPositive ? '⭐' : '☁️'}</span> Mang theo hôm nay
                                </h5>
                                <p className="text-text-minimal/85 italic font-serif">
                                  "{selectedEntry.aiInsight.quote}"
                                </p>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white border border-accent-minimal p-8 rounded-[30px] shadow-sm text-center">
                  <AlertCircle className="w-10 h-10 text-text-minimal/40 mx-auto mb-3" />
                  <p className="text-text-minimal/50 text-xs">AI không đính kèm phản hồi cho nhật ký này hoặc do lỗi kết nối mạng.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-accent-minimal rounded-3xl p-6 max-w-sm w-full text-center">
            <h3 className="font-serif text-text-minimal text-base font-bold">Xóa Trang Nhật Ký?</h3>
            <p className="text-text-minimal/50 text-xs mt-2">Hành động này không thể khôi phục. Bạn có chắc chắn muốn xóa kỷ niệm này không?</p>
            <div className="flex gap-2 mt-6">
              <button 
                onClick={() => setShowDeleteConfirm(null)} 
                className="w-1/2 bg-bg-minimal hover:bg-accent-minimal/20 text-text-minimal font-semibold text-xs py-2.5 rounded-full cursor-pointer border border-accent-minimal/40"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={() => confirmDelete(showDeleteConfirm)} 
                className="w-1/2 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs py-2.5 rounded-full cursor-pointer shadow-sm"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reward Popup */}
      {showRewardPopup && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#FFD7D5] rounded-3xl p-8 max-w-md w-full text-center shadow-lg relative overflow-hidden">
            <span className="text-6xl mb-4 inline-block animate-bounce">🌸</span>
            <h2 className="text-xl font-serif text-text-minimal font-bold">Lưu Thư Thành Công!</h2>
            <p className="text-text-minimal/50 text-xs mt-2 leading-relaxed font-sans">
              Trang nhật ký cảm xúc của bạn đã được lưu giữ cẩn mật. Cảm ơn bạn vì đã kiên nhẫn đối diện với lòng mình hôm nay.
            </p>

            <div className="bg-bg-minimal border border-accent-minimal/60 rounded-2xl p-4 my-6 flex flex-col gap-1 text-center">
              <span className="text-xs font-semibold text-text-minimal">Bạn đã nhận được thưởng:</span>
              <div className="flex justify-center gap-2 mt-2">
                <span className="text-xs bg-[#AFDCF1] text-[#1E3A5F] border border-[#8BC5E3] font-bold px-3 py-1 rounded-full shadow-sm">+1 Chấm Tròn Cảm Xúc</span>
                <span className="text-xs bg-[#FFD7D5] text-[#5A1A24] border border-[#F2B6B3] font-bold px-3 py-1 rounded-full">+1 Streak Ngày</span>
              </div>
            </div>

            <div className="flex gap-2.5">
              <button 
                onClick={() => {
                  setShowRewardPopup(false);
                  onAddCircle(1, 'Lưu nhật ký cảm xúc');
                  setView('detail');
                }} 
                className="w-full bg-[#FFB6BD] hover:bg-[#FF8E98] text-[#4A121A] font-extrabold text-xs py-3.5 rounded-full shadow-sm cursor-pointer border border-[#F89CA7]"
              >
                Đọc phản hồi từ Chấm Tròn
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
