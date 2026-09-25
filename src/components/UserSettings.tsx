import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Lock, Shield, Key, Check, AlertCircle, RefreshCw, 
  Sparkles, Heart, HeartHandshake, Eye, EyeOff, RotateCcw,
  Smile, ShieldCheck, LockKeyhole, Copy, LogOut
} from 'lucide-react';
import { UserProfile } from '../types';
import PasswordInput from './PasswordInput';

interface UserSettingsProps {
  currentUser: UserProfile | null;
  token: string;
  onUpdateProfile?: (updated: Partial<UserProfile> & { avatar?: string; motto?: string }) => void;
  onResetData?: () => void;
  onBack: () => void;
  onLogout?: () => void;
}

// Collection of cute avatars for mindfulness profile
export const CUTE_AVATARS = [
  { id: 'flower', emoji: '🌸', name: 'Hoa Đào' },
  { id: 'sprout', emoji: '🌱', name: 'Mầm Cây' },
  { id: 'circle', emoji: '🟢', name: 'Chấm Tròn' },
  { id: 'star', emoji: '⭐', name: 'Ngôi Sao' },
  { id: 'heart', emoji: '💖', name: 'Trái Tim' },
  { id: 'lotus', emoji: '🪷', name: 'Hoa Sen' },
  { id: 'sun', emoji: '☀️', name: 'Mặt Trời' },
  { id: 'cat', emoji: '🐱', name: 'Mèo An' },
  { id: 'bird', emoji: '🕊️', name: 'Chim Câu' },
  { id: 'butterfly', emoji: '🦋', name: 'Tự Do' },
];

export default function UserSettings({ 
  currentUser, 
  token, 
  onUpdateProfile, 
  onResetData, 
  onBack,
  onLogout
}: UserSettingsProps) {
  const userId = currentUser?.id || currentUser?._id || 'guest';

  // Helper getters for initial profile state
  const getInitialAvatar = () => {
    if (currentUser?.avatar) return currentUser.avatar;
    const saved = localStorage.getItem(`user_avatar_${userId}`) || localStorage.getItem('user_avatar');
    return saved || '🌸';
  };

  const getInitialMotto = () => {
    if (currentUser?.motto !== undefined && currentUser?.motto !== null) return currentUser.motto;
    const saved = localStorage.getItem(`user_motto_${userId}`) || localStorage.getItem('user_motto');
    return saved || '';
  };

  // Get or compute unique Circle Code (Mã Chấm Tròn)
  const getCircleCode = () => {
    if (currentUser?.circleCode) return currentUser.circleCode;
    const saved = localStorage.getItem(`user_circle_code_${userId}`) || localStorage.getItem('user_circle_code');
    if (saved) return saved;

    const uid = (userId || currentUser?.username || currentUser?.email || 'guest').toString();
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
      hash = (hash * 31 + uid.charCodeAt(i)) % 9000;
    }
    const codeNum = (1000 + Math.abs(hash)).toString().padStart(4, '0');
    const code = `CT_${codeNum}`;
    localStorage.setItem(`user_circle_code_${userId}`, code);
    localStorage.setItem('user_circle_code', code);
    return code;
  };

  const circleCode = getCircleCode();
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCircleCode = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(circleCode).catch(() => {});
      }
    } catch {}
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  // SECTION 1: Profile states
  const [nickname, setNickname] = useState<string>(currentUser?.username || '');
  const [selectedAvatar, setSelectedAvatar] = useState<string>(getInitialAvatar);
  const [motto, setMotto] = useState<string>(getInitialMotto);
  const [profileSaved, setProfileSaved] = useState<boolean>(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // SECTION 2: Journal PIN Lock states
  const [pinEnabled, setPinEnabled] = useState<boolean>(false);
  const [pinCode, setPinCode] = useState<string>('');
  const [confirmPinCode, setConfirmPinCode] = useState<string>('');
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  // SECTION 2: Reset Data Modal state
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Load saved profile & PIN lock settings on mount or user changes
  useEffect(() => {
    if (currentUser?.username) {
      setNickname(currentUser.username);
    }

    const savedAvatar = currentUser?.avatar || localStorage.getItem(`user_avatar_${userId}`) || localStorage.getItem('user_avatar');
    if (savedAvatar) {
      setSelectedAvatar(savedAvatar);
    }

    const savedMotto = currentUser?.motto !== undefined ? currentUser.motto : (localStorage.getItem(`user_motto_${userId}`) || localStorage.getItem('user_motto'));
    if (savedMotto !== undefined && savedMotto !== null) {
      setMotto(savedMotto);
    }

    const savedPinEnabled = localStorage.getItem(`journal_pin_enabled_${userId}`);
    if (savedPinEnabled === 'true') {
      setPinEnabled(true);
    }

    const savedPin = localStorage.getItem(`journal_pin_code_${userId}`);
    if (savedPin) {
      setPinCode(savedPin);
      setConfirmPinCode(savedPin);
    }
  }, [userId, currentUser?.avatar, currentUser?.username, currentUser?.motto]);

  // Action 1: Save Profile (Nickname, Avatar, Motto)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaved(false);
    setProfileError(null);

    if (!nickname.trim()) {
      setProfileError('Vui lòng nhập tên hiển thị.');
      return;
    }

    try {
      localStorage.setItem(`user_avatar_${userId}`, selectedAvatar);
      localStorage.setItem('user_avatar', selectedAvatar);
      localStorage.setItem(`user_motto_${userId}`, motto.trim());
      localStorage.setItem('user_motto', motto.trim());

      if (onUpdateProfile) {
        await onUpdateProfile({
          username: nickname.trim(),
          avatar: selectedAvatar,
          motto: motto.trim()
        });
      }

      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3500);
    } catch (err: any) {
      setProfileError('Không thể lưu cài đặt hồ sơ.');
    }
  };

  // Action 2: Save PIN Code for Journal
  const handleSavePinLock = (e: React.FormEvent) => {
    e.preventDefault();
    setPinSuccess(null);
    setPinError(null);

    if (pinEnabled) {
      if (!/^\d{4}$/.test(pinCode)) {
        setPinError('Mã PIN phải bao gồm đúng 4 chữ số (ví dụ: 1234).');
        return;
      }

      if (pinCode !== confirmPinCode) {
        setPinError('Mã PIN xác nhận không khớp.');
        return;
      }

      localStorage.setItem(`journal_pin_enabled_${userId}`, 'true');
      localStorage.setItem(`journal_pin_code_${userId}`, pinCode);
      setPinSuccess('Đã kích hoạt mã PIN 4 chữ số bảo vệ Nhật Ký Cảm Xúc!');
    } else {
      localStorage.setItem(`journal_pin_enabled_${userId}`, 'false');
      setPinSuccess('Đã tắt khóa mã PIN cho Nhật Ký.');
    }

    setTimeout(() => setPinSuccess(null), 3500);
  };

  // Action 4: Confirm Reset Personal Data
  const handleConfirmResetData = () => {
    if (onResetData) {
      onResetData();
    }
    setShowResetConfirmModal(false);
    setResetSuccess(true);
    setTimeout(() => setResetSuccess(false), 4000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 text-text-minimal" id="user-settings-container">
      
      {/* Header Banner */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <button 
            onClick={onBack} 
            className="flex items-center gap-2 text-text-minimal/70 hover:text-[#124B31] transition-colors bg-white border border-[#AFDCF1] px-4 py-2 rounded-full shadow-xs cursor-pointer text-xs font-bold mb-3"
            id="btn-settings-back"
          >
            <span>← Quay lại Trang Chủ</span>
          </button>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-text-minimal flex items-center gap-2.5">
            <span>⚙️</span> Cài Đặt Cá Nhân
          </h1>
          <p className="text-text-minimal/60 text-xs mt-1">
            Chăm sóc hồ sơ cá nhân, tùy chỉnh biểu tượng đại diện và bảo mật nhật ký riêng tư.
          </p>
        </div>

        {/* User Info Capsule */}
        <div className="hidden sm:flex items-center gap-3 bg-white border border-[#AFDCF1] p-3 rounded-2xl shadow-xs">
          <div className="w-10 h-10 bg-[#AFDCF1]/40 border border-[#8BC5E3] rounded-xl flex items-center justify-center text-xl">
            {selectedAvatar}
          </div>
          <div>
            <div className="text-xs font-bold text-text-minimal">{nickname || currentUser?.username}</div>
            <div className="text-[10px] text-text-minimal/50">{currentUser?.email}</div>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        
        {/* ==========================================
            MỤC 1: HỒ SƠ CÁ NHÂN (Profile Settings)
           ========================================== */}
        <div className="bg-white border border-[#E2DBFC] p-6 md:p-8 rounded-[32px] shadow-xs relative" id="section-profile-settings">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#AFDCF1] text-[#1E3A5F] border border-[#8BC5E3] rounded-2xl flex items-center justify-center shadow-xs">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold font-serif text-text-minimal">
                1. Hồ Sơ Cá Nhân (Profile Settings)
              </h2>
              <p className="text-xs text-text-minimal/60">
                Thay đổi tên hiển thị, biểu tượng đại diện dịu dàng và câu truyền cảm hứng cá nhân.
              </p>
            </div>
          </div>

          {/* Ô Mã Chấm Tròn Cá Nhân */}
          <div className="mb-6 p-4.5 bg-gradient-to-r from-[#AFDCF1]/20 via-[#E2DBFC]/20 to-[#C8F7DC]/20 border border-[#8BC5E3]/50 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs" id="box-user-circle-code">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-minimal/60 block">
                Mã Chấm Tròn độc quyền của bạn
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-base font-extrabold text-[#1E3A5F] bg-white px-3 py-1 rounded-xl border border-[#AFDCF1] font-mono tracking-wider shadow-2xs">
                  {circleCode}
                </span>
                <span className="text-[10px] text-[#124B31] bg-[#C8F7DC] font-bold px-2.5 py-0.5 rounded-full border border-[#9EE7C0]">
                  Bảo mật
                </span>
              </div>
              <p className="text-[11px] text-text-minimal/70 mt-1">
                Dùng mã này để bạn bè tìm kiếm và kết nối làm Bạn đồng hành trong ứng dụng.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyCircleCode}
              className="bg-white hover:bg-[#AFDCF1]/30 text-[#1E3A5F] border border-[#8BC5E3] font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all active:scale-95 flex-shrink-0"
              id="btn-copy-circle-code"
            >
              <Copy className="w-3.5 h-3.5 text-[#1E3A5F]" />
              <span>{copiedCode ? 'Đã sao chép! ✨' : 'Sao chép'}</span>
            </button>
          </div>

          {profileSaved && (
            <motion.div 
              initial={{ opacity: 0, y: -5, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5 }}
              className="mb-6 p-4 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-extrabold rounded-2xl flex items-center justify-between gap-2 shadow-xs"
            >
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Cập nhật hồ sơ thành công! ✨</span>
              </div>
              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100/80 px-2 py-0.5 rounded-full">
                Biểu tượng: {selectedAvatar}
              </span>
            </motion.div>
          )}

          {profileError && (
            <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>{profileError}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-6 text-xs">
            {/* Input Nickname */}
            <div className="space-y-1.5">
              <label className="font-extrabold uppercase tracking-wider text-[10px] text-text-minimal/60 block ml-1">
                Tên hiển thị (Nickname)
              </label>
              <input
                type="text"
                required
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Nhập nickname của bạn..."
                className="w-full px-4 py-3 bg-bg-minimal border border-accent-minimal rounded-2xl focus:outline-none focus:border-[#1E3A5F] text-text-minimal text-xs font-bold"
              />
            </div>

            {/* Select Avatar Grid */}
            <div className="space-y-2">
              <label className="font-extrabold uppercase tracking-wider text-[10px] text-text-minimal/60 block ml-1">
                Chọn Ảnh Đại Diện / Biểu Tượng Cảm Xúc
              </label>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5">
                {CUTE_AVATARS.map((avatar) => {
                  const isSelected = selectedAvatar === avatar.emoji;
                  return (
                    <button
                      type="button"
                      key={avatar.id}
                      onClick={() => setSelectedAvatar(avatar.emoji)}
                      className={`p-3 rounded-2xl text-center border transition-all cursor-pointer flex flex-col items-center justify-center ${
                        isSelected 
                          ? 'bg-[#AFDCF1] border-[#1E3A5F] scale-105 shadow-xs ring-2 ring-[#1E3A5F]/20' 
                          : 'bg-bg-minimal border-accent-minimal hover:bg-white hover:scale-102'
                      }`}
                      title={avatar.name}
                    >
                      <span className="text-2xl block">{avatar.emoji}</span>
                      <span className="text-[9px] font-bold text-text-minimal/70 mt-1 truncate max-w-full">
                        {avatar.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Personal Bio / Motto Input */}
            <div className="space-y-1.5">
              <label className="font-extrabold uppercase tracking-wider text-[10px] text-text-minimal/60 block ml-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Lời Nhắc Nhở Bản Thân (Personal Bio / Motto)</span>
              </label>
              <input
                type="text"
                value={motto}
                onChange={(e) => setMotto(e.target.value)}
                placeholder="Ví dụ: Lắng nghe chính mình bằng sự dịu dàng nhất..."
                className="w-full px-4 py-3 bg-bg-minimal border border-accent-minimal rounded-2xl focus:outline-none focus:border-[#1E3A5F] text-text-minimal text-xs font-medium italic"
              />
              <p className="text-[10px] text-text-minimal/50 ml-1">
                Lắng nghe lời thì thầm tích cực mỗi khi bạn trở về trang chủ.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="bg-[#AFDCF1] hover:bg-[#92CBE8] text-[#1E3A5F] border border-[#8BC5E3] font-extrabold py-3 px-6 rounded-2xl shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <Check className="w-4 h-4 text-[#1E3A5F]" />
                <span>Lưu Thay Đổi Hồ Sơ</span>
              </button>
            </div>
          </form>
        </div>


        {/* ==========================================
            MỤC 2: BẢO MẬT & DỮ LIỆU CÁ NHÂN (Privacy & Data)
           ========================================== */}
        <div className="bg-white border border-[#E2DBFC] p-6 md:p-8 rounded-[32px] shadow-xs space-y-8" id="section-privacy-security">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#C8F7DC] text-[#124B31] border border-[#9EE7C0] rounded-2xl flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold font-serif text-text-minimal">
                2. Bảo Mật & Dữ Liệu Cá Nhân (Privacy & Data)
              </h2>
              <p className="text-xs text-text-minimal/60">
                Khóa mã PIN 4 chữ số cho Nhật ký và quản lý dữ liệu cá nhân.
              </p>
            </div>
          </div>

          {/* ITEM 2.2: JOURNAL LOCK WITH 4-DIGIT PIN */}
          <div className="bg-bg-minimal/50 p-5 rounded-[24px] border border-accent-minimal space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LockKeyhole className="w-4 h-4 text-[#1E3A5F]" />
                <div>
                  <h3 className="text-xs font-extrabold text-text-minimal uppercase tracking-wider">
                    Khóa Nhật Ký Bằng Mã PIN (4 chữ số)
                  </h3>
                  <p className="text-[11px] text-text-minimal/60">
                    Yêu cầu nhập mã PIN mỗi khi mở trang Nhật Ký Cảm Xúc để bảo vệ tính riêng tư tuyệt đối.
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() => setPinEnabled(!pinEnabled)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  pinEnabled ? 'bg-[#1E3A5F]' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    pinEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {pinSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{pinSuccess}</span>
              </div>
            )}

            {pinError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>{pinError}</span>
              </div>
            )}

            {pinEnabled && (
              <form onSubmit={handleSavePinLock} className="space-y-4 text-xs pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <PasswordInput
                    label="Mã PIN 4 chữ số"
                    maxLength={4}
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="Ví dụ: 1234"
                    showIcon={false}
                    inputClassName="bg-white text-center font-mono text-lg tracking-widest text-text-minimal border border-accent-minimal rounded-2xl"
                    id="setting-pin-code"
                  />

                  <PasswordInput
                    label="Xác nhận mã PIN"
                    maxLength={4}
                    value={confirmPinCode}
                    onChange={(e) => setConfirmPinCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="Nhập lại PIN..."
                    showIcon={false}
                    inputClassName="bg-white text-center font-mono text-lg tracking-widest text-text-minimal border border-accent-minimal rounded-2xl"
                    id="setting-confirm-pin-code"
                  />
                </div>

                <button
                  type="submit"
                  className="bg-[#AFDCF1] hover:bg-[#92CBE8] text-[#1E3A5F] border border-[#8BC5E3] font-extrabold py-2.5 px-5 rounded-2xl shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                >
                  <LockKeyhole className="w-3.5 h-3.5 text-[#1E3A5F]" />
                  <span>Lưu Cài Đặt Mã PIN</span>
                </button>
              </form>
            )}
          </div>


          {/* ITEM 2.3: RESET PERSONAL DATA BUTTON */}
          <div className="bg-amber-50/60 p-5 rounded-[24px] border border-amber-200/80 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <RotateCcw className="w-4 h-4 text-amber-700" />
                <div>
                  <h3 className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">
                    Đặt Lai Dữ Liệu Cá Nhân
                  </h3>
                  <p className="text-[11px] text-amber-800/80">
                    Xóa bớt nhật ký và làm mới lại tiến trình nếu bạn muốn bắt đầu một hành trình mới.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowResetConfirmModal(true)}
                className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-extrabold py-2 px-4 rounded-2xl transition-all cursor-pointer text-xs flex items-center gap-1.5 shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Đặt Lại Dữ Liệu</span>
              </button>
            </div>

            {resetSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Đã đặt lại dữ liệu tiến trình thành công!</span>
              </div>
            )}
          </div>

          {/* SECTION 5: ACCOUNT & LOGOUT (Dễ dàng đăng xuất trên điện thoại và máy tính) */}
          <div className="bg-white/90 backdrop-blur-md border border-rose-200 p-6 md:p-8 rounded-[32px] shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-2xs">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-text-minimal">Tài Khoản & Đăng Xuất</h3>
                <p className="text-xs text-text-minimal/60">
                  Đang đăng nhập với: <strong className="text-rose-700 font-semibold">{currentUser?.username || 'Thành viên'}</strong> {currentUser?.role === 'admin' && '👑 (Quản Trị Viên)'}
                </p>
              </div>
            </div>

            <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-rose-900 block">Đăng xuất khỏi thiết bị</span>
                <span className="text-[11px] text-text-minimal/60">Bảo mật thông tin khi dùng chung thiết bị hoặc muốn đổi tài khoản khác.</span>
              </div>
              <button
                type="button"
                onClick={() => setShowLogoutModal(true)}
                className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-2.5 px-5 rounded-2xl transition-all cursor-pointer text-xs flex items-center justify-center gap-2 shadow-xs active:scale-95"
                id="btn-settings-logout-trigger"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Đăng Xuất Ngay</span>
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* CONFIRM RESET MODAL */}
      <AnimatePresence>
        {showResetConfirmModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-[#E2DBFC] p-6 rounded-[28px] max-w-md w-full shadow-lg text-center space-y-4"
            >
              <div className="w-12 h-12 bg-amber-100 text-amber-700 border border-amber-300 rounded-full flex items-center justify-center mx-auto text-xl">
                ⚠️
              </div>

              <h3 className="text-base font-bold font-serif text-text-minimal">
                Xác Nhận Đặt Lại Dữ Liệu Cá Nhân?
              </h3>

              <p className="text-xs text-text-minimal/70 leading-relaxed">
                Thao tác này sẽ làm mới các nhật ký cảm xúc, chuỗi kiên trì và số sao tích lũy để bạn khởi đầu lại một hành trình nhẹ nhàng hơn. Tài khoản đăng nhập của bạn vẫn sẽ được giữ nguyên.
              </p>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetConfirmModal(false)}
                  className="px-5 py-2.5 bg-bg-minimal hover:bg-gray-100 border border-accent-minimal text-text-minimal font-bold rounded-2xl text-xs cursor-pointer"
                >
                  Hủy Bỏ
                </button>

                <button
                  type="button"
                  onClick={handleConfirmResetData}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-2xl text-xs cursor-pointer shadow-xs"
                >
                  Xác Nhận Đặt Lại
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* LOGOUT CONFIRMATION MODAL */}
        {showLogoutModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border border-rose-200 p-6 rounded-[28px] max-w-sm w-full shadow-xl text-center space-y-4"
            >
              <div className="w-12 h-12 bg-rose-50 text-rose-600 border border-rose-200 rounded-full flex items-center justify-center mx-auto shadow-2xs">
                <LogOut className="w-5 h-5" />
              </div>

              <h3 className="text-base font-bold font-serif text-text-minimal">
                Xác Nhận Đăng Xuất?
              </h3>

              <p className="text-xs text-text-minimal/70 leading-relaxed">
                Bạn có chắc chắn muốn đăng xuất khỏi tài khoản <strong className="text-rose-700 font-semibold">{currentUser?.username}</strong> trên thiết bị này không?
              </p>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(false)}
                  className="px-4 py-2.5 bg-bg-minimal hover:bg-slate-100 border border-accent-minimal text-text-minimal font-bold rounded-2xl text-xs cursor-pointer"
                >
                  Hủy Bỏ
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowLogoutModal(false);
                    if (onLogout) onLogout();
                  }}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-2xl text-xs cursor-pointer shadow-xs active:scale-95 flex items-center justify-center gap-1.5"
                  id="btn-confirm-settings-logout"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Đăng Xuất</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
