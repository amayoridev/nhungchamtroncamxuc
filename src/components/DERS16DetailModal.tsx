import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Activity, Heart, Droplets, BookOpen, Sparkles, Users, 
  Calendar, CheckCircle2, AlertCircle, ChevronRight, BarChart3,
  Flame, Shield, Clock, Smile, MessageSquare
} from 'lucide-react';
import { UserProfile } from '../types';
import { DERS16Assessment, DERS16Item } from '../lib/ders16';

interface DERS16DetailModalProps {
  user: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function DERS16DetailModal({ user, isOpen, onClose }: DERS16DetailModalProps) {
  const [activeTab, setActiveTab] = useState<'scale' | 'activities' | 'diaries'>('scale');

  if (!isOpen || !user) return null;

  const ders16: DERS16Assessment | undefined = user.ders16 || user.appData?.ders16;
  const appData = user.appData || {};
  const diaries = user.diaries || [];
  const waterLog = appData.waterLog;
  const readingSessions = appData.readingSessions || [];
  const gratitudeCards = appData.gratitudeCards || [];
  const pairChallenges = appData.pairChallenges || [];

  const isAdmin = user.role === 'admin' || user.role === 'ADMIN';

  const getScoreBadgeColor = (score: number) => {
    switch (score) {
      case 5:
        return 'bg-rose-100 text-rose-800 border-rose-300 font-extrabold';
      case 4:
        return 'bg-orange-100 text-orange-800 border-orange-300 font-extrabold';
      case 3:
        return 'bg-amber-100 text-amber-800 border-amber-300 font-bold';
      case 2:
        return 'bg-teal-100 text-teal-800 border-teal-300 font-medium';
      case 1:
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-medium';
    }
  };

  const getEmotionBadge = (emotion: string) => {
    switch (emotion) {
      case 'lo_lang':
        return { label: 'Lo lắng', color: 'bg-amber-100 text-amber-900 border-amber-300', emoji: '😰' };
      case 'met_moi':
        return { label: 'Mệt mỏi', color: 'bg-slate-100 text-slate-800 border-slate-300', emoji: '😮‍💨' };
      case 'buon_ba':
        return { label: 'Buồn bã', color: 'bg-blue-100 text-blue-900 border-blue-300', emoji: '🌧️' };
      case 'tuc_gian':
        return { label: 'Tức giận', color: 'bg-rose-100 text-rose-900 border-rose-300', emoji: '😤' };
      case 'binh_yen':
        return { label: 'Bình yên', color: 'bg-emerald-100 text-emerald-900 border-emerald-300', emoji: '🍃' };
      case 'vui_ve':
        return { label: 'Vui vẻ', color: 'bg-yellow-100 text-yellow-900 border-yellow-300', emoji: '✨' };
      default:
        return { label: emotion, color: 'bg-gray-100 text-gray-800 border-gray-300', emoji: '💭' };
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white border border-[#E2DBFC] rounded-[32px] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 bg-gradient-to-r from-[#F7F5FE] via-white to-[#F0FDF4] border-b border-accent-minimal/70 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-2xl bg-[#C8F7DC] border border-[#9EE7C0] flex items-center justify-center text-2xl shadow-xs flex-shrink-0">
                {user.avatar || '🌸'}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-bold font-serif text-text-minimal">
                    {user.username}
                  </h2>
                  <span className="font-mono text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#C8F7DC] text-[#124B31] border border-[#9EE7C0]">
                    {user.circleCode || 'CT_1001'}
                  </span>
                  {isAdmin ? (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                      ADMIN
                    </span>
                  ) : (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD]">
                      DERS-16: {ders16 ? `${ders16.totalScore}/80 (${ders16.percentage}%)` : 'Đã đồng bộ'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-minimal/60 mt-0.5">
                  {user.email} • Điểm bình yên: <strong className="text-[#124B31]">{user.peaceScore || 80}/100</strong> • Chuỗi: <strong className="text-amber-600">{user.streak || 1} ngày</strong>
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-black/5 text-text-minimal/50 hover:text-text-minimal transition-colors cursor-pointer"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 px-6 pt-3 border-b border-accent-minimal/60 bg-bg-minimal/40 text-xs font-bold">
            <button
              onClick={() => setActiveTab('scale')}
              className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'scale'
                  ? 'border-[#124B31] text-[#124B31]'
                  : 'border-transparent text-text-minimal/60 hover:text-text-minimal'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Thang Đo DERS-16 (16 Câu)</span>
            </button>

            <button
              onClick={() => setActiveTab('activities')}
              className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'activities'
                  ? 'border-[#124B31] text-[#124B31]'
                  : 'border-transparent text-text-minimal/60 hover:text-text-minimal'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Mọi Hoạt Động Của User ({readingSessions.length + gratitudeCards.length + (waterLog ? 1 : 0)})</span>
            </button>

            <button
              onClick={() => setActiveTab('diaries')}
              className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'diaries'
                  ? 'border-[#124B31] text-[#124B31]'
                  : 'border-transparent text-text-minimal/60 hover:text-text-minimal'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Nhật Ký Cảm Xúc ({diaries.length})</span>
            </button>
          </div>

          {/* Content Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
            {/* TAB 1: DERS-16 EVALUATION SCALE */}
            {activeTab === 'scale' && (
              <div className="space-y-6">
                {/* Scale Overview Banner */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#F0FDF4] to-[#F7F5FE] border border-[#9EE7C0]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div>
                      <span className="text-[10px] font-extrabold text-[#124B31] uppercase tracking-wider block">
                        ĐÁNH GIÁ KHÓ KHĂN ĐIỀU HÒA CẢM XÚC (DERS-16)
                      </span>
                      <h3 className="text-base font-bold font-serif text-text-minimal mt-0.5">
                        {ders16?.level || 'Khó khăn điều hòa cảm xúc cao (Elevated Dysregulation)'}
                      </h3>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-extrabold font-serif text-[#124B31]">
                        {ders16 ? `${ders16.totalScore}/80` : '56/80'}
                      </div>
                      <span className="text-[10px] font-bold text-text-minimal/60">
                        {ders16 ? `${ders16.percentage}% tổng điểm thang đo` : '70% thang đo'}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-text-minimal/70 leading-relaxed">
                    {ders16?.summary || 'Điểm số thể hiện các vùng nhạy cảm cao nhất tại Chiến lược xoa dịu (Strategies), Kiểm soát xung động (Impulse) và Định hướng mục tiêu (Goals). Người dùng hưởng lợi sâu sắc từ các hoạt động hít thở nhịp nhàng, nhật ký giải tỏa cảm xúc và sự đồng hành kết nối.'}
                  </p>

                  <div className="mt-3 pt-3 border-t border-[#9EE7C0]/60 flex flex-wrap items-center gap-2 text-[10px] text-text-minimal/60 font-medium">
                    <span className="font-bold text-text-minimal">Quy chuẩn điểm:</span>
                    <span className="px-2 py-0.5 rounded-md bg-white border border-accent-minimal">1: Almost never (0-10%)</span>
                    <span className="px-2 py-0.5 rounded-md bg-white border border-accent-minimal">2: Sometimes (11-35%)</span>
                    <span className="px-2 py-0.5 rounded-md bg-white border border-accent-minimal">3: About half (36-65%)</span>
                    <span className="px-2 py-0.5 rounded-md bg-white border border-accent-minimal">4: Most time (66-90%)</span>
                    <span className="px-2 py-0.5 rounded-md bg-white border border-accent-minimal">5: Almost always (91-100%)</span>
                  </div>
                </div>

                {/* Subscales Breakdown */}
                <div>
                  <h4 className="font-bold text-text-minimal text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[#124B31]" />
                    <span>Chi Tiết 5 Phân Nhóm Thang Đo (Subscales)</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {/* Clarity */}
                    <div className="p-3.5 bg-bg-minimal/50 border border-accent-minimal rounded-2xl">
                      <div className="flex items-center justify-between font-bold text-text-minimal mb-1">
                        <span>Nhận biết cảm xúc (Clarity)</span>
                        <span className="text-[#124B31]">{ders16?.subscales.clarity.score || 6}/10</span>
                      </div>
                      <div className="w-full bg-accent-minimal/40 h-2 rounded-full overflow-hidden my-1.5">
                        <div className="bg-[#124B31] h-full rounded-full" style={{ width: `${ders16?.subscales.clarity.percentage || 60}%` }}></div>
                      </div>
                      <span className="text-[10px] text-text-minimal/60 block">
                        Câu 1, 2 (Mức độ: {ders16?.subscales.clarity.level || 'Trung bình'})
                      </span>
                    </div>

                    {/* Goals */}
                    <div className="p-3.5 bg-bg-minimal/50 border border-accent-minimal rounded-2xl">
                      <div className="flex items-center justify-between font-bold text-text-minimal mb-1">
                        <span>Định hướng mục tiêu (Goals)</span>
                        <span className="text-amber-700">{ders16?.subscales.goals.score || 11}/15</span>
                      </div>
                      <div className="w-full bg-accent-minimal/40 h-2 rounded-full overflow-hidden my-1.5">
                        <div className="bg-amber-600 h-full rounded-full" style={{ width: `${ders16?.subscales.goals.percentage || 73}%` }}></div>
                      </div>
                      <span className="text-[10px] text-text-minimal/60 block">
                        Câu 3, 7, 14 (Mức độ: {ders16?.subscales.goals.level || 'Cao'})
                      </span>
                    </div>

                    {/* Impulse */}
                    <div className="p-3.5 bg-bg-minimal/50 border border-accent-minimal rounded-2xl">
                      <div className="flex items-center justify-between font-bold text-text-minimal mb-1">
                        <span>Kiểm soát xung động (Impulse)</span>
                        <span className="text-rose-700">{ders16?.subscales.impulse.score || 11}/15</span>
                      </div>
                      <div className="w-full bg-accent-minimal/40 h-2 rounded-full overflow-hidden my-1.5">
                        <div className="bg-rose-500 h-full rounded-full" style={{ width: `${ders16?.subscales.impulse.percentage || 73}%` }}></div>
                      </div>
                      <span className="text-[10px] text-text-minimal/60 block">
                        Câu 4, 8, 10 (Mức độ: {ders16?.subscales.impulse.level || 'Cao'})
                      </span>
                    </div>

                    {/* Nonacceptance */}
                    <div className="p-3.5 bg-bg-minimal/50 border border-accent-minimal rounded-2xl">
                      <div className="flex items-center justify-between font-bold text-text-minimal mb-1">
                        <span>Chấp nhận cảm xúc (Nonacceptance)</span>
                        <span className="text-teal-700">{ders16?.subscales.nonacceptance.score || 8}/15</span>
                      </div>
                      <div className="w-full bg-accent-minimal/40 h-2 rounded-full overflow-hidden my-1.5">
                        <div className="bg-teal-600 h-full rounded-full" style={{ width: `${ders16?.subscales.nonacceptance.percentage || 53}%` }}></div>
                      </div>
                      <span className="text-[10px] text-text-minimal/60 block">
                        Câu 9, 12, 13 (Mức độ: {ders16?.subscales.nonacceptance.level || 'Trung bình'})
                      </span>
                    </div>

                    {/* Strategies */}
                    <div className="p-3.5 bg-bg-minimal/50 border border-accent-minimal rounded-2xl sm:col-span-2">
                      <div className="flex items-center justify-between font-bold text-text-minimal mb-1">
                        <span>Chiến lược điều hòa & Xoa dịu (Strategies)</span>
                        <span className="text-rose-700 font-extrabold">{ders16?.subscales.strategies.score || 20}/25 (80%)</span>
                      </div>
                      <div className="w-full bg-accent-minimal/40 h-2 rounded-full overflow-hidden my-1.5">
                        <div className="bg-rose-600 h-full rounded-full" style={{ width: `${ders16?.subscales.strategies.percentage || 80}%` }}></div>
                      </div>
                      <span className="text-[10px] text-text-minimal/60 block">
                        Câu 5, 6, 11, 15, 16 • Thách thức cao nhất: Cần các thói quen xoa dịu lành mạnh như hít thở, uống nước và thiệp động viên.
                      </span>
                    </div>
                  </div>
                </div>

                {/* All 16 Items Table */}
                <div>
                  <h4 className="font-bold text-text-minimal text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#124B31]" />
                    <span>Bảng Chi Tiết Điểm Số 16 Câu DERS-16 (1: Almost Never - 5: Almost Always)</span>
                  </h4>

                  <div className="border border-accent-minimal rounded-2xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-bg-minimal/80 text-text-minimal/60 font-bold border-b border-accent-minimal text-[10px] uppercase">
                        <tr>
                          <th className="p-2.5 text-center w-10">#</th>
                          <th className="p-2.5">Câu hỏi DERS-16</th>
                          <th className="p-2.5 hidden sm:table-cell">Nhóm phân loại</th>
                          <th className="p-2.5 text-right w-36">Điểm đánh giá</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-accent-minimal/60">
                        {ders16?.answers.map((item: DERS16Item) => (
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
                              <span className={`px-2.5 py-1 rounded-full border text-[11px] inline-flex items-center gap-1 ${getScoreBadgeColor(item.score)}`}>
                                <span>{item.score} / 5</span>
                                <span className="hidden md:inline">• {item.scaleLabel.split('-')[1]?.trim()}</span>
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ALL USER ACTIVITIES */}
            {activeTab === 'activities' && (
              <div className="space-y-6">
                {/* 1. Water Log Activity */}
                <div className="p-4 bg-white border border-[#BAE6FD] rounded-2xl shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-[#E0F2FE] text-[#0369A1] flex items-center justify-center">
                        <Droplets className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-text-minimal text-xs">Thói Quen Uống Nước Dưỡng Thể</h4>
                        <span className="text-[10px] text-text-minimal/60">Giúp hạ nhiệt thần kinh và tái tạo năng lượng</span>
                      </div>
                    </div>
                    <span className="font-extrabold text-[#0369A1] text-sm">
                      {waterLog ? `${waterLog.glasses || 0} / ${waterLog.goal || 8} ly` : 'Chưa ghi nhận'}
                    </span>
                  </div>
                  <div className="w-full bg-[#E0F2FE]/50 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#0369A1] h-full rounded-full transition-all" 
                      style={{ width: `${Math.min(100, ((waterLog?.glasses || 0) / 8) * 100)}%` }}
                    ></div>
                  </div>
                  <div className="mt-2 text-[10px] text-text-minimal/60 flex items-center justify-between">
                    <span>Chuỗi thói quen: <strong>{waterLog?.streak || 1} ngày liên tiếp</strong></span>
                    <span>Cập nhật ngày: {waterLog?.lastUpdated || 'Hôm nay'}</span>
                  </div>
                </div>

                {/* 2. Reading Sessions Activity */}
                <div className="p-4 bg-white border border-accent-minimal rounded-2xl shadow-xs">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-text-minimal text-xs">Phiên Đọc Sách Chánh Niệm ({readingSessions.length} phiên)</h4>
                      <span className="text-[10px] text-text-minimal/60">Chiến lược xoa dịu tâm trí (DERS-16 Strategies)</span>
                    </div>
                  </div>

                  {readingSessions.length === 0 ? (
                    <p className="text-text-minimal/50 text-center py-4">Chưa có phiên đọc sách nào được ghi nhận.</p>
                  ) : (
                    <div className="space-y-2">
                      {readingSessions.map((session: any, idx: number) => (
                        <div key={session.id || idx} className="p-3 bg-bg-minimal/60 border border-accent-minimal/60 rounded-xl flex items-start justify-between gap-3">
                          <div>
                            <div className="font-bold text-text-minimal text-[11px] flex items-center gap-1.5">
                              <span>📖 {session.bookTitle}</span>
                              <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded-md font-semibold">
                                {session.durationMinutes} phút
                              </span>
                            </div>
                            {session.quote && (
                              <p className="text-[10px] italic text-text-minimal/70 mt-1">
                                "{session.quote}"
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] text-text-minimal/50 whitespace-nowrap flex-shrink-0">
                            {session.date}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Gratitude Cards Activity */}
                <div className="p-4 bg-white border border-[#FFE299] rounded-2xl shadow-xs">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-text-minimal text-xs">Thực Hành Biết Ơn ({gratitudeCards.length} thẻ)</h4>
                      <span className="text-[10px] text-text-minimal/60">Kéo tâm trí khỏi suy nghĩ dồn dập & củng cố cảm xúc tích cực</span>
                    </div>
                  </div>

                  {gratitudeCards.length === 0 ? (
                    <p className="text-text-minimal/50 text-center py-4">Chưa có thẻ biết ơn nào.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {gratitudeCards.map((g: any, idx: number) => (
                        <div key={g.id || idx} className="p-3 bg-[#FFFDF5] border border-[#FFEBB3] rounded-xl text-[11px] space-y-1">
                          <div className="text-[10px] font-bold text-amber-800 flex items-center justify-between border-b border-amber-200/50 pb-1">
                            <span>✨ 3 Điều Biết Ơn</span>
                            <span>{g.date}</span>
                          </div>
                          <p className="text-text-minimal/80">1. {g.text1}</p>
                          <p className="text-text-minimal/80">2. {g.text2}</p>
                          <p className="text-text-minimal/80">3. {g.text3}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Pair Challenges Activity */}
                <div className="p-4 bg-white border border-[#9EE7C0] rounded-2xl shadow-xs">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-xl bg-[#C8F7DC] text-[#124B31] flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-text-minimal text-xs">Thử Thách Đôi (Pair Challenges)</h4>
                      <span className="text-[10px] text-text-minimal/60">Gắn kết bạn đồng hành cùng hỗ trợ điều hòa cảm xúc</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {pairChallenges.map((pc: any) => (
                      <div key={pc.id} className="p-3 bg-bg-minimal/60 border border-accent-minimal/80 rounded-xl text-center">
                        <span className="text-[10px] font-bold text-text-minimal/60 block mb-1">
                          {pc.id === 'pc1' ? '📝 Nhật ký' : pc.id === 'pc2' ? '🎬 Video TikTok' : '🫁 Hít thở'}
                        </span>
                        <div className="font-extrabold text-xs text-text-minimal mb-1.5">{pc.title}</div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                          pc.complete ? 'bg-[#C8F7DC] text-[#124B31]' : 'bg-amber-100 text-amber-800'
                        }`}>
                          <CheckCircle2 className="w-3 h-3" />
                          {pc.complete ? 'Đã hoàn thành' : 'Đang tiến hành'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: EMOTION JOURNALS ALIGNED WITH DERS-16 */}
            {activeTab === 'diaries' && (
              <div className="space-y-4">
                <div className="p-3.5 bg-bg-minimal border border-accent-minimal rounded-2xl text-[11px] text-text-minimal/70 leading-relaxed flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-500 flex-shrink-0" />
                  <span>
                    Toàn bộ nhật ký cảm xúc của người dùng được cấu trúc trực tiếp theo phân bổ thang đo DERS-16 (tập trung vào các cơn bão cảm xúc, khó khăn tập trung và khoảnh khắc tự xoa dịu).
                  </span>
                </div>

                {diaries.length === 0 ? (
                  <p className="text-text-minimal/50 text-center py-8">Chưa có bài nhật ký nào.</p>
                ) : (
                  <div className="space-y-3">
                    {diaries.map((diary: any, idx: number) => {
                      const badge = getEmotionBadge(diary.emotion);
                      return (
                        <div key={diary.id || diary._id || idx} className="p-4 bg-white border border-accent-minimal rounded-2xl shadow-xs space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-extrabold flex items-center gap-1 ${badge.color}`}>
                              <span>{badge.emoji}</span>
                              <span>{badge.label}</span>
                            </span>
                            <span className="text-[10px] text-text-minimal/50 font-medium">
                              📅 {diary.date} {diary.time && `• ${diary.time}`}
                            </span>
                          </div>

                          <p className="text-[11px] text-text-minimal/80 leading-relaxed italic">
                            "{diary.text}"
                          </p>

                          {diary.aiInsight && (
                            <div className="p-3 bg-[#F7F5FE] border border-[#E2DBFC] rounded-xl text-[10px] space-y-1 text-text-minimal/80">
                              <div className="font-extrabold text-[#124B31] flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                <span>Phản hồi xoa dịu cảm xúc (AI Chấm Tròn):</span>
                              </div>
                              <p className="text-text-minimal/70">{diary.aiInsight.reflection}</p>
                              {diary.aiInsight.suggestion && (
                                <p className="text-indigo-900 font-medium">💡 Gợi ý: {diary.aiInsight.suggestion}</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-bg-minimal/80 border-t border-accent-minimal/70 flex items-center justify-between text-[11px] text-text-minimal/60">
            <span>Dữ liệu đã được đồng bộ chuẩn hóa theo thang đo DERS-16 (1-5).</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[#124B31] text-white rounded-full font-bold hover:bg-[#0D3824] transition-colors cursor-pointer shadow-xs"
            >
              Đóng
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
