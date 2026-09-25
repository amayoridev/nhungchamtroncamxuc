import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Mail, User, RefreshCw, KeyRound, ArrowLeft, Check } from 'lucide-react';
import PasswordInput from './PasswordInput';

interface AuthProps {
  onAuthSuccess: (token: string, user: any) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isLogin = mode === 'login';
  const isRegister = mode === 'register';
  const isReset = mode === 'reset';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    if (isRegister && password !== confirmPassword) {
      setError('Mật khẩu và xác nhận mật khẩu không trùng khớp.');
      setLoading(false);
      return;
    }

    if (isReset) {
      if (password !== confirmPassword) {
        setError('Mật khẩu mới và xác nhận mật khẩu không trùng khớp.');
        setLoading(false);
        return;
      }
      try {
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, newPassword: password })
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Đặt lại mật khẩu thất bại, vui lòng thử lại.');
        }
        setSuccessMsg('Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.');
        setPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setMode('login');
          setSuccessMsg(null);
        }, 2000);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    const url = isLogin ? '/api/auth/login' : '/api/auth/register';
    const body = isLogin 
      ? { email, password }
      : { username, email, password };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Đã xảy ra lỗi, vui lòng thử lại.');
      }

      onAuthSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-minimal flex items-center justify-center p-6 relative overflow-hidden" id="auth-container">
      {/* Calm ambient background shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-[#C8F7DC]/30 blur-[120px]" />
        <div className="absolute -bottom-[5%] right-[5%] w-[45%] h-[45%] rounded-full bg-[#BFE3FF]/30 blur-[130px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white border border-[#E2DBFC] p-8 rounded-[36px] shadow-sm z-10 relative"
      >
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-[#C8F7DC] text-[#124B31] border border-[#9EE7C0] rounded-[22px] flex items-center justify-center font-extrabold text-3xl shadow-sm mx-auto mb-4">
            🌸
          </div>
          <h1 className="text-2xl font-serif font-bold text-text-minimal tracking-tight">
            {isLogin && 'Chào mừng bạn quay lại'}
            {isRegister && 'Bắt đầu gieo hạt mầm'}
            {isReset && 'Đặt lại mật khẩu mới'}
          </h1>
          <p className="text-text-minimal/60 text-xs mt-2">
            {isLogin && 'Đăng nhập để tiếp tục hành trình nuôi dưỡng và thấu cảm tâm hồn.'}
            {isRegister && 'Đăng ký tài khoản để viết nhật ký cảm xúc cùng người bạn Chấm Tròn.'}
            {isReset && 'Nhập email và mật khẩu mới để phục hồi quyền truy cập tài khoản.'}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-semibold text-center">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold text-center flex items-center justify-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-minimal/50 uppercase tracking-wider block ml-1">
                Tên của bạn / Biệt danh
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-minimal/40">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="Nhập tên hoặc biệt danh..."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-bg-minimal border border-accent-minimal rounded-2xl text-xs focus:outline-none focus:border-primary-minimal transition-all text-text-minimal placeholder:text-text-minimal/30"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-text-minimal/50 uppercase tracking-wider block ml-1">
              {isLogin ? "Email hoặc Tên đăng nhập" : "Địa chỉ Email"}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-minimal/40">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type={isLogin ? "text" : "email"}
                required
                placeholder={isLogin ? "Nhập email hoặc tên tài khoản" : "email@example.com"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-bg-minimal border border-accent-minimal rounded-2xl text-xs focus:outline-none focus:border-primary-minimal transition-all text-text-minimal placeholder:text-text-minimal/30"
              />
            </div>
          </div>

          <PasswordInput
            label={isReset ? "Mật khẩu mới" : "Mật khẩu"}
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            id="auth-password-input"
          />

          {(isRegister || isReset) && (
            <PasswordInput
              label={isReset ? "Xác nhận mật khẩu mới" : "Xác nhận lại mật khẩu"}
              required
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              id="auth-confirm-password-input"
            />
          )}

          {isLogin && (
            <div className="text-right pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setMode('reset');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-[11px] text-[#124B31] hover:underline font-bold cursor-pointer"
              >
                Quên mật khẩu?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#C8F7DC] hover:bg-[#B5F1D0] text-[#124B31] border border-[#9EE7C0] font-extrabold text-xs py-3.5 rounded-2xl shadow-sm transition-all hover:scale-[1.01] flex items-center justify-center gap-2 cursor-pointer mt-6"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[#124B31]" />
            ) : isReset ? (
              <KeyRound className="w-4 h-4 text-[#124B31]" />
            ) : (
              <Sparkles className="w-4 h-4 text-[#124B31]" />
            )}
            <span>
              {loading
                ? 'Đang xử lý...'
                : isLogin
                ? 'Đăng Nhập'
                : isRegister
                ? 'Đăng Ký Tài Khoản'
                : 'Xác Nhận Đặt Lại Mật Khẩu'}
            </span>
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-accent-minimal text-center text-xs">
          {isReset ? (
            <button
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccessMsg(null);
              }}
              className="text-[#124B31] hover:underline font-bold cursor-pointer flex items-center justify-center gap-1.5 mx-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại trang Đăng nhập</span>
            </button>
          ) : (
            <>
              <span className="text-text-minimal/50">
                {isLogin ? 'Bạn chưa có hạt mầm tài khoản?' : 'Bạn đã có tài khoản rồi?'}
              </span>{' '}
              <button
                onClick={() => {
                  setMode(isLogin ? 'register' : 'login');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-[#124B31] hover:underline font-bold cursor-pointer"
              >
                {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

