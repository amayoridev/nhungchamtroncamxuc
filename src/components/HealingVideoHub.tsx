import React, { useState, useEffect } from 'react';
import { PodcastItem } from '../types';
import { syncPodcastsFromServer, getLocalPodcasts, getActiveDailyPodcast } from '../lib/podcasts';
import TikTokEmbed from './TikTokEmbed';
import { 
  Play, Sparkles, Check, Heart, ExternalLink, RefreshCw, 
  Search, Video, Music2, Clock, User, Bookmark
} from 'lucide-react';

interface HealingVideoHubProps {
  onAddCircle?: (count: number, reason: string) => void;
  className?: string;
  initialVideoId?: string;
}

export default function HealingVideoHub({ onAddCircle, className = '', initialVideoId }: HealingVideoHubProps) {
  const [podcasts, setPodcasts] = useState<PodcastItem[]>(() => getLocalPodcasts());
  const [selectedPodcast, setSelectedPodcast] = useState<PodcastItem | null>(() => getActiveDailyPodcast());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasWatched, setHasWatched] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fetch / sync latest podcasts uploaded by Admin
  const loadPodcasts = async () => {
    setIsLoading(true);
    try {
      const { podcasts: list, daily } = await syncPodcastsFromServer();
      setPodcasts(list);
      if (initialVideoId) {
        const matching = list.find(p => p.id === initialVideoId || p.videoId === initialVideoId);
        if (matching) {
          setSelectedPodcast(matching);
          setIsLoading(false);
          return;
        }
      }
      if (!selectedPodcast) {
        setSelectedPodcast(daily || list[0] || null);
      } else {
        // Keep selected or fallback to daily
        const refreshed = list.find(p => p.id === selectedPodcast.id);
        setSelectedPodcast(refreshed || daily || list[0] || null);
      }
    } catch (e) {
      console.warn("Could not sync podcasts:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPodcasts();

    const handleUpdate = () => {
      loadPodcasts();
    };

    window.addEventListener('daily-podcast-updated', handleUpdate);
    return () => window.removeEventListener('daily-podcast-updated', handleUpdate);
  }, [initialVideoId]);

  const handleClaimReward = () => {
    if (hasWatched) return;
    setHasWatched(true);
    if (onAddCircle) {
      onAddCircle(2, 'Xem video TikTok chữa lành');
    }
  };

  const filteredPodcasts = podcasts.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (p.title && p.title.toLowerCase().includes(q)) ||
      (p.author && p.author.toLowerCase().includes(q)) ||
      (p.healingMessage && p.healingMessage.toLowerCase().includes(q))
    );
  });

  return (
    <div className={`space-y-8 text-text-minimal ${className}`} id="healing-video-hub">
      {/* Top Banner / Introduction */}
      <div className="bg-gradient-to-br from-rose-50/70 via-amber-50/40 to-white border border-rose-200/70 p-5 sm:p-6 rounded-[28px] shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black tracking-wide border border-rose-200 flex items-center gap-1">
                <span>♪</span>
                <span>TIKTOK & PODCAST CHỮA LÀNH</span>
              </span>
              <span className="text-[10px] text-slate-500 font-bold">
                {podcasts.length} clip chọn lọc
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif text-slate-900 font-bold">
              Góc Video Chữa Lành & An Trú
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Những thước phim ngắn mộc mạc, âm điệu dịu êm và thông điệp sưởi ấm tâm hồn do Ban Quản Trị chọn lọc mỗi ngày dành riêng cho bạn.
            </p>
          </div>

          <button
            onClick={loadPodcasts}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-60"
            title="Làm mới danh sách video"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Đang tải...' : 'Làm mới'}</span>
          </button>
        </div>
      </div>

      {/* Main Video Spotlight Area */}
      {selectedPodcast ? (
        <div className="bg-white border-2 border-rose-100/90 rounded-[32px] p-4 sm:p-7 shadow-xs space-y-6" id="video-spotlight-card">
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            
            {/* Embedded Player Section */}
            <div className="w-full lg:w-[380px] flex-shrink-0 flex justify-center">
              {selectedPodcast.platform === 'tiktok' || (!selectedPodcast.platform && selectedPodcast.youtubeUrl?.includes('tiktok')) ? (
                <TikTokEmbed 
                  urlOrId={selectedPodcast.youtubeUrl || selectedPodcast.videoId} 
                  className="rounded-2xl shadow-md"
                />
              ) : (
                /* YouTube Embed Fallback */
                <div className="w-full aspect-[9/16] max-w-[340px] rounded-2xl overflow-hidden shadow-md bg-black relative border border-slate-800">
                  <iframe
                    src={`https://www.youtube.com/embed/${selectedPodcast.videoId}?autoplay=0`}
                    title={selectedPodcast.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
            </div>

            {/* Video Details & Reflection Section */}
            <div className="flex-1 space-y-5 min-w-0">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-rose-500 text-white text-[10px] font-black flex items-center gap-1">
                    <span>♪</span>
                    <span>Clip TikTok</span>
                  </span>
                  {selectedPodcast.isActiveDaily && (
                    <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      <span>Video Hôm Nay</span>
                    </span>
                  )}
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{selectedPodcast.duration || '5 phút'}</span>
                  </span>
                </div>

                <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                  {selectedPodcast.title}
                </h3>

                {selectedPodcast.author && (
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Người chia sẻ: <strong className="text-slate-700">{selectedPodcast.author}</strong></span>
                  </p>
                )}
              </div>

              {/* Healing Message Card */}
              <div className="bg-gradient-to-r from-amber-50/70 to-orange-50/50 border border-amber-200/80 p-4 sm:p-5 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs">
                  <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                  <span>Lời Nhắn Gửi Chữa Lành</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed italic font-serif">
                  "{selectedPodcast.healingMessage || 'Lắng nghe những rung cảm mộc mạc để tìm lại sự bình yên trong tâm hồn sau những giờ làm việc mỏi mệt.'}"
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  onClick={handleClaimReward}
                  disabled={hasWatched}
                  className={`px-5 py-3 rounded-2xl font-extrabold text-xs flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer ${
                    hasWatched 
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
                      : 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white shadow-rose-200'
                  }`}
                  id="btn-claim-video-reward"
                >
                  {hasWatched ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-700" />
                      <span>Đã lắng nghe trọn vẹn (+2 ⭐)</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Đã xem & Nhận +2 ⭐ Chăm sóc</span>
                    </>
                  )}
                </button>

                {selectedPodcast.youtubeUrl && (
                  <a
                    href={selectedPodcast.youtubeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    <span>Mở xem trên ứng dụng TikTok</span>
                  </a>
                )}
              </div>

            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border-2 border-dashed border-rose-200 rounded-3xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto text-xl">
            🎬
          </div>
          <h4 className="font-bold text-slate-800 text-sm">Chưa có video chữa lành nào</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Admin sẽ cập nhật các video TikTok chữa lành và podcast tích cực cho ngày hôm nay. Hãy quay lại sau ít phút bạn nhé!
          </p>
        </div>
      )}

      {/* Library of All Uploaded Videos */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>📚</span>
              <span>Thư Viện Clip TikTok & Video Chữa Lành</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Chọn bất kỳ clip nào để lắng nghe và nuôi dưỡng tâm trí của bạn.
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-xs w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm clip hoặc tác giả..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-400 focus:bg-white transition-all"
            />
          </div>
        </div>

        {filteredPodcasts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPodcasts.map((item) => {
              const isSelected = selectedPodcast?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedPodcast(item);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                    isSelected 
                      ? 'bg-rose-50/60 border-rose-300 ring-2 ring-rose-200 shadow-sm' 
                      : 'bg-white border-slate-200/80 hover:border-rose-200 hover:shadow-xs'
                  }`}
                >
                  {/* Thumbnail / Platform Icon */}
                  <div className="w-16 h-20 rounded-xl bg-slate-950 flex-shrink-0 flex flex-col items-center justify-center text-rose-500 relative overflow-hidden border border-slate-800 shadow-inner">
                    <span className="text-xl">♪</span>
                    <span className="text-[8px] font-bold text-white tracking-wider">TikTok</span>
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center hover:bg-black/10 transition-all">
                      <div className="w-6 h-6 rounded-full bg-rose-500/90 text-white flex items-center justify-center shadow-xs">
                        <Play className="w-3 h-3 fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      {item.isActiveDaily && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-black rounded-md">
                          ⭐ Hôm nay
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500 font-medium">
                        {item.duration || '5 phút'}
                      </span>
                    </div>

                    <h4 className="font-bold text-xs sm:text-sm text-slate-800 line-clamp-2 leading-snug">
                      {item.title}
                    </h4>

                    {item.author && (
                      <p className="text-[11px] text-slate-500 truncate">
                        Tác giả: <span className="font-semibold text-slate-700">{item.author}</span>
                      </p>
                    )}

                    <div className="pt-1 flex items-center justify-between text-[11px]">
                      <span className={`font-bold ${isSelected ? 'text-rose-600' : 'text-slate-600'}`}>
                        {isSelected ? '● Đang phát' : 'Nhấn để xem'}
                      </span>
                      <a
                        href={item.youtubeUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-slate-400 hover:text-rose-600 flex items-center gap-0.5 text-[10px]"
                        title="Mở TikTok"
                      >
                        <span>Mở TikTok</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
            Không tìm thấy clip nào phù hợp với từ khóa "{searchQuery}".
          </div>
        )}
      </div>
    </div>
  );
}
