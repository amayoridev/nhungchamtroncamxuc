import React from 'react';
import { Star, ShoppingBag, Sparkles, ArrowRight } from 'lucide-react';
import { useStarWallet } from '../context/StarContext';

interface StarWalletProps {
  variant?: 'sidebar' | 'header' | 'cards' | 'shop-header';
  streak?: number;
  onOpenShop?: () => void;
  className?: string;
}

export const StarWallet: React.FC<StarWalletProps> = ({
  variant = 'sidebar',
  streak = 1,
  onOpenShop,
  className = ''
}) => {
  const { totalStarsEarned, totalStarsSpent, availableStars } = useStarWallet();

  // VARIANT 1: SIDEBAR WIDGET
  if (variant === 'sidebar') {
    return (
      <div 
        onClick={onOpenShop}
        className={`bg-[#FFEEB6]/80 hover:bg-[#FFEEB6] border border-[#E8CF7A] p-4 rounded-2xl cursor-pointer transition-all shadow-sm ${className}`}
        id="star-wallet-sidebar"
      >
        <div className="flex justify-between items-center text-xs mb-2">
          <span className="text-[#4D3E00] font-extrabold uppercase tracking-wider text-[9px]">HÀNH TRÌNH KIÊN TRÌ</span>
          <span className="font-extrabold text-[#1E3A5F] bg-[#AFDCF1] px-2 py-0.5 rounded-full text-[10px] border border-[#8BC5E3]">
            🔮 {streak} Chấm Tròn
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-2xl">⭐</span>
          <div>
            <span className="text-[10px] font-bold text-[#4D3E00]/80 block">Kho Báu Sao Đổi Quà</span>
            <span className="text-sm font-extrabold text-[#4D3E00]">
              {availableStars} ⭐ Khả Dụng
            </span>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-[#E8CF7A]/60 flex justify-between items-center text-[10px] font-extrabold text-[#4D3E00]">
          <span>Mở cửa hàng đổi quà</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>
    );
  }

  // VARIANT 2: COMPACT HEADER PILL
  if (variant === 'header') {
    return (
      <button
        onClick={onOpenShop}
        className={`text-[11px] font-extrabold bg-[#FFEEB6] text-[#4D3E00] px-2.5 py-1 rounded-full border border-[#E8CF7A] cursor-pointer shadow-xs hover:bg-[#FFE699] transition-colors flex items-center gap-1 ${className}`}
        title={`Cửa Hàng Đổi Sao (${availableStars} ⭐ khả dụng)`}
        id="star-wallet-header-btn"
      >
        <span>⭐ Cửa Hàng ({availableStars})</span>
      </button>
    );
  }

  // VARIANT 3: SHOP HEADER BANNER
  if (variant === 'shop-header') {
    return (
      <div className={`bg-white/90 border border-[#E8CF7A] p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs ${className}`}>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#FFEEB6] text-[#4D3E00] border border-[#E8CF7A] rounded-2xl text-xl">
            ⭐
          </div>
          <div>
            <div className="text-xs font-bold text-[#4D3E00]/80 uppercase tracking-wider">Số Dư Sao Khả Dụng</div>
            <div className="text-2xl font-extrabold text-[#4D3E00] font-serif">{availableStars} ⭐</div>
          </div>
        </div>
        <div className="text-xs text-text-minimal/70 flex flex-wrap gap-2 sm:gap-4 font-sans bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
          <div>
            <span className="font-semibold text-text-minimal/60">Tổng tích lũy:</span>{' '}
            <strong className="text-[#5A1A24]">{totalStarsEarned} ⭐</strong>
          </div>
          <div>
            <span className="font-semibold text-text-minimal/60">Đã đổi quà:</span>{' '}
            <strong className="text-amber-800">{totalStarsSpent} ⭐</strong>
          </div>
        </div>
      </div>
    );
  }

  // DEFAULT / SUMMARY STAT CARDS (Two side-by-side cards)
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${className}`} id="star-wallet-stat-cards">
      {/* 1. Tổng Sao Tích Lũy (Lịch Sử) */}
      <div className="bg-white border border-[#FFD7D5] p-6 rounded-3xl shadow-sm relative overflow-hidden flex flex-col justify-between hover:scale-[1.02] transition-transform">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-extrabold text-[#5A1A24] uppercase tracking-wider">TỔNG SAO TÍCH LŨY</span>
          <div className="p-2 bg-[#FFD7D5] text-[#5A1A24] border border-[#F2B6B3] rounded-2xl">
            <Star className="w-5 h-5 fill-[#F2B6B3] text-[#5A1A24]" />
          </div>
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-serif text-[#5A1A24]">{totalStarsEarned}</span>
            <span className="text-xs font-bold text-text-minimal/70">⭐ Đã nhận</span>
          </div>
          <p className="text-[11px] text-text-minimal/60 mt-1">Tổng số sao mở khóa từ trước đến nay (Lịch sử vinh danh)</p>
        </div>
      </div>

      {/* 2. Sao Khả Dụng Đổi Quà (Số dư thực tế) */}
      <div 
        onClick={onOpenShop}
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
  );
};

export default StarWallet;
