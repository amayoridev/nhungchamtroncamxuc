import React, { useState, useEffect } from 'react';
import { extractTikTokVideoId, parseVideoUrl } from '../lib/videoEmbed';
import { ExternalLink, Video, AlertCircle, RefreshCw, Maximize2, Minimize2, Play, Sparkles, Volume2, ShieldAlert } from 'lucide-react';

interface TikTokEmbedProps {
  urlOrId: string;
  className?: string;
  compact?: boolean;
  autoplay?: boolean;
}

interface TikTokMeta {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
  canonicalUrl?: string;
  videoId?: string;
}

export default function TikTokEmbed({
  urlOrId,
  className = '',
  compact = false
}: TikTokEmbedProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [meta, setMeta] = useState<TikTokMeta | null>(null);
  const [activeTab, setActiveTab] = useState<'player' | 'card'>('player');

  const localId = extractTikTokVideoId(urlOrId);
  const videoId = meta?.videoId || localId;

  // Resolve TikTok short links / metadata from backend
  useEffect(() => {
    if (!urlOrId) return;

    let isMounted = true;
    const fetchMeta = async () => {
      try {
        const res = await fetch(`/api/media/tiktok-info?url=${encodeURIComponent(urlOrId)}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success) {
            setMeta(data);
          }
        }
      } catch (e) {
        // Fallback to local regex ID
      }
    };

    fetchMeta();
    return () => {
      isMounted = false;
    };
  }, [urlOrId]);

  if (!urlOrId && !videoId) {
    return null;
  }

  const effectiveId = videoId || extractTikTokVideoId(urlOrId);
  const originalUrl = meta?.canonicalUrl || (urlOrId.startsWith('http') ? urlOrId : `https://www.tiktok.com/@user/video/${effectiveId}`);

  // Use TikTok embed v2 (reliable and public)
  const embedSrc = effectiveId 
    ? `https://www.tiktok.com/embed/v2/${effectiveId}` 
    : (urlOrId.includes('/embed') ? urlOrId : `https://www.tiktok.com/embed/v2/${effectiveId}`);

  // Prevent loading state from hanging indefinitely
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [embedSrc]);

  return (
    <div 
      className={`relative bg-black/95 rounded-2xl overflow-hidden border border-slate-800 shadow-md flex flex-col items-center ${
        compact && !isExpanded ? 'max-w-[280px] h-[460px]' : 'max-w-[340px] sm:max-w-[360px] h-[560px] sm:h-[580px]'
      } w-full mx-auto transition-all ${className}`}
    >
      {/* Header bar */}
      <div className="w-full px-3 py-2 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/60 flex items-center justify-between text-xs text-slate-300 z-10">
        <div className="flex items-center gap-1.5 font-bold">
          <span className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px]">
            ♪
          </span>
          <span className="text-[11px] font-sans tracking-wide text-white">TikTok Chữa Lành</span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700 text-[10px]">
            <button
              onClick={() => setActiveTab('player')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                activeTab === 'player' ? 'bg-rose-500 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Phát trực tiếp"
            >
              Phát Web
            </button>
            <button
              onClick={() => setActiveTab('card')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                activeTab === 'card' ? 'bg-rose-500 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Thẻ video mượt mà"
            >
              Thẻ Chi Tiết
            </button>
          </div>

          {compact && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
              title={isExpanded ? 'Thu nhỏ' : 'Mở rộng'}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}

          <a
            href={originalUrl}
            target="_blank"
            rel="noreferrer"
            className="p-1 hover:bg-slate-700 rounded text-rose-400 hover:text-rose-300 transition-colors"
            title="Mở trên ứng dụng TikTok"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative w-full flex-1 bg-black flex items-center justify-center overflow-hidden">
        {activeTab === 'player' ? (
          <>
            {isLoading && !hasError && (
              <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-2.5 text-slate-400 z-5">
                <RefreshCw className="w-6 h-6 animate-spin text-rose-500" />
                <span className="text-xs font-medium">Đang kết nối TikTok...</span>
              </div>
            )}

            {hasError ? (
              <div className="p-5 text-center text-slate-300 space-y-3">
                <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h5 className="font-bold text-xs text-white">Chặn nhúng từ máy chủ TikTok</h5>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    TikTok vừa kích hoạt cơ chế bảo vệ tải (Overload-Protect). Bạn có thể xem ngay bằng Thẻ Chi Tiết hoặc mở ứng dụng.
                  </p>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    onClick={() => setActiveTab('card')}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    Xem bằng Thẻ Chi Tiết
                  </button>
                  <a
                    href={originalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Mở ngay trên TikTok
                  </a>
                </div>
              </div>
            ) : (
              <iframe
                src={embedSrc}
                title={`TikTok Video Player ${effectiveId || ''}`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setHasError(true);
                }}
              />
            )}
          </>
        ) : (
          /* High-Reliability Card Mode (Never triggers overload-protect) */
          <div className="w-full h-full flex flex-col justify-between p-4 bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white relative">
            {/* Background art / blur */}
            {meta?.thumbnail_url && (
              <div 
                className="absolute inset-0 bg-cover bg-center opacity-20 filter blur-lg scale-110 pointer-events-none"
                style={{ backgroundImage: `url(${meta.thumbnail_url})` }}
              />
            )}

            <div className="relative z-1 space-y-3">
              {/* Creator / Tag */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-rose-500 text-white font-black text-xs flex items-center justify-center">
                  ♪
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">
                    {meta?.author_name || 'TikTok Creator'}
                  </p>
                  <p className="text-[10px] text-rose-400">@video_{effectiveId ? effectiveId.slice(-6) : 'tiktok'}</p>
                </div>
              </div>

              {/* Cover thumbnail preview */}
              <div className="relative w-full aspect-[9/12] max-h-[260px] rounded-xl overflow-hidden border border-slate-800 bg-slate-900 group shadow-inner">
                <img
                  src={meta?.thumbnail_url || 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500&q=80'}
                  alt={meta?.title || 'TikTok Thumbnail'}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500&q=80';
                  }}
                />
                <a
                  href={originalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute inset-0 bg-black/40 hover:bg-black/20 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-all">
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </div>
                  <span className="text-[11px] font-bold text-white bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-xs">
                    Xem trên TikTok
                  </span>
                </a>
              </div>

              {/* Title / Description */}
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-white line-clamp-2 leading-relaxed">
                  {meta?.title || 'Clip âm thanh & video chữa lành trên TikTok'}
                </h4>
              </div>
            </div>

            {/* Bottom action button */}
            <div className="relative z-1 pt-2">
              <a
                href={originalUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-98"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Mở Xem Trực Tiếp Trên TikTok</span>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info with Overload notice hint */}
      <div className="w-full px-3 py-1.5 bg-slate-900/90 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800">
        <span className="truncate max-w-[170px]">ID: <code className="font-mono text-slate-300">{effectiveId || 'TikTok'}</code></span>
        {activeTab === 'player' && (
          <button
            onClick={() => setActiveTab('card')}
            className="text-rose-400 hover:underline cursor-pointer font-medium"
          >
            Nếu giật/lỗi? Chuyển Thẻ
          </button>
        )}
      </div>
    </div>
  );
}
