import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, Lock, Users, RefreshCw, Key, Check, AlertCircle, 
  QrCode, Copy, Download, Star, Activity, Search,
  LockKeyhole, Unlock, Share2, Sparkles, UserX, UserCheck, ShieldCheck,
  BookOpen, Clock, Headphones, Play, Trash2, Edit3, Plus, Video, ExternalLink, Music,
  ChevronLeft, ChevronRight, Zap, Droplets, Heart, ChevronDown, Sliders, Database, FileSpreadsheet
} from 'lucide-react';
import QRCode from 'qrcode';
import PasswordInput from './PasswordInput';
import TikTokEmbed from './TikTokEmbed';
import { syncDatabaseUsersToStore, getAllAppUsersFromStore } from '../lib/userSync';
import { UserProfile, PodcastItem } from '../types';
import { getLocalPodcasts, saveLocalPodcasts, extractYouTubeId, extractTikTokVideoId, parseVideoUrl, setActiveDailyPodcastLocal } from '../lib/podcasts';
import DERS16DetailModal from './DERS16DetailModal';
import AdminAnonymousDataExport from './AdminAnonymousDataExport';

interface AdminStats {
  totalUsers: number;
  activeToday: number;
  totalStars: number;
}

interface AdminPanelProps {
  currentUser: UserProfile;
  token: string;
  onBack: () => void;
}

export default function AdminPanel({ currentUser, token, onBack }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'security' | 'podcasts' | 'export'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  
  // App QR & Sharing
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Admin stats
  const [stats, setStats] = useState<AdminStats>({ totalUsers: 0, activeToday: 0, totalStars: 0 });
  const [statsLoading, setStatsLoading] = useState(false);

  // All users fetched from backend
  const [rawUsers, setRawUsers] = useState<UserProfile[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  // Lock / Unlock user state
  const [lockLoadingId, setLockLoadingId] = useState<string | null>(null);
  const [roleLoadingId, setRoleLoadingId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Admin reset user password
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  // DERS-16 detail inspection modal
  const [ders16ModalUser, setDers16ModalUser] = useState<UserProfile | null>(null);

  // Disguised Community Cadence & Pulse Engine (Collapsible & hidden by default)
  const [showCadenceEngine, setShowCadenceEngine] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedResult, setSeedResult] = useState<{
    date: string;
    activeUsersCount: number;
    newJournalsCount: number;
    newCardsCount: number;
    details: string;
  } | null>(null);
  const [seedRatio, setSeedRatio] = useState<number>(0.48);

  // Change admin's own password
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);

  // Podcast Management State
  const [podcasts, setPodcasts] = useState<PodcastItem[]>(() => getLocalPodcasts());
  const [podcastTitle, setPodcastTitle] = useState('');
  const [podcastUrl, setPodcastUrl] = useState('');
  const [podcastDuration, setPodcastDuration] = useState('5 phút');
  const [podcastMessage, setPodcastMessage] = useState('');
  const [editingPodcastId, setEditingPodcastId] = useState<string | null>(null);
  const [podcastActionLoading, setPodcastActionLoading] = useState(false);
  const [podcastNotice, setPodcastNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [deletePodcastTarget, setDeletePodcastTarget] = useState<{ id: string; title: string } | null>(null);
  const [isDeletingPodcast, setIsDeletingPodcast] = useState(false);
  const [toggleRoleTarget, setToggleRoleTarget] = useState<UserProfile | null>(null);

  // Podcast Management Handlers
  const fetchPodcasts = async () => {
    try {
      const res = await fetch('/api/podcasts');
      if (res.ok) {
        const data = await res.json();
        if (data.podcasts && Array.isArray(data.podcasts)) {
          setPodcasts(data.podcasts);
          saveLocalPodcasts(data.podcasts);
          return;
        }
      }
    } catch (e) {}
    setPodcasts(getLocalPodcasts());
  };

  useEffect(() => {
    fetchPodcasts();
    const handlePodUpdate = () => fetchPodcasts();
    window.addEventListener('daily-podcast-updated', handlePodUpdate);
    return () => window.removeEventListener('daily-podcast-updated', handlePodUpdate);
  }, []);

  // Auto-resolve TikTok info when url changes
  useEffect(() => {
    if (!podcastUrl || !/tiktok\.com/i.test(podcastUrl)) return;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/media/tiktok-info?url=${encodeURIComponent(podcastUrl.trim())}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            if (data.title && !podcastTitle) {
              setPodcastTitle(data.title.slice(0, 100));
            }
            if (!podcastDuration) {
              setPodcastDuration('TikTok Clip');
            }
            if (data.author_name && !podcastMessage) {
              setPodcastMessage(`Video chữa lành được chia sẻ bởi tác giả @${data.author_name} trên TikTok.`);
            }
          }
        }
      } catch (e) {}
    }, 600);

    return () => clearTimeout(timer);
  }, [podcastUrl]);

  const handleSavePodcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podcastTitle.trim() || !podcastUrl.trim()) {
      setPodcastNotice({ type: 'error', msg: 'Vui lòng nhập đầy đủ tiêu đề và link video TikTok.' });
      return;
    }

    const parsedVideo = parseVideoUrl(podcastUrl);
    if (!parsedVideo.isValid && !parsedVideo.videoId && !podcastUrl.includes('tiktok')) {
      setPodcastNotice({ type: 'error', msg: 'Link video không hợp lệ. Vui lòng nhập link video TikTok (hoặc mã video TikTok).' });
      return;
    }

    const videoId = parsedVideo.videoId || podcastUrl.trim();
    const platform: 'tiktok' | 'youtube' = 'tiktok';

    setPodcastActionLoading(true);
    setPodcastNotice(null);

    try {
      if (editingPodcastId) {
        // Update existing podcast
        const res = await fetch(`/api/admin/podcasts/${editingPodcastId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: podcastTitle,
            youtubeUrl: podcastUrl,
            videoUrl: podcastUrl,
            platform,
            duration: podcastDuration || 'TikTok Clip',
            healingMessage: podcastMessage || 'Lắng nghe để chữa lành và tìm lại sự bình yên trong tâm hồn.'
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.podcasts) {
            setPodcasts(data.podcasts);
            saveLocalPodcasts(data.podcasts);
          }
        } else {
          const updated = podcasts.map(p => {
            if (p.id === editingPodcastId) {
              return {
                ...p,
                title: podcastTitle.trim(),
                youtubeUrl: podcastUrl.trim(),
                videoId,
                platform,
                duration: podcastDuration.trim() || 'TikTok Clip',
                healingMessage: podcastMessage.trim() || 'Lắng nghe để chữa lành và tìm lại sự bình yên trong tâm hồn.'
              };
            }
            return p;
          });
          setPodcasts(updated);
          saveLocalPodcasts(updated);
        }
        setPodcastNotice({ type: 'success', msg: 'Đã cập nhật thông tin video TikTok thành công!' });
      } else {
        // Add new podcast
        const res = await fetch('/api/admin/podcasts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: podcastTitle,
            youtubeUrl: podcastUrl,
            videoUrl: podcastUrl,
            platform,
            duration: podcastDuration || 'TikTok Clip',
            healingMessage: podcastMessage || 'Lắng nghe để chữa lành và tìm lại sự bình yên trong tâm hồn.'
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.podcasts) {
            setPodcasts(data.podcasts);
            saveLocalPodcasts(data.podcasts);
          }
        } else {
          const newPod: PodcastItem = {
            id: `pod_${Date.now()}`,
            title: podcastTitle.trim(),
            youtubeUrl: podcastUrl.trim(),
            videoId,
            platform,
            duration: podcastDuration.trim() || 'TikTok Clip',
            healingMessage: podcastMessage.trim() || 'Lắng nghe để chữa lành và tìm lại sự bình yên trong tâm hồn.',
            isActiveDaily: podcasts.length === 0,
            author: currentUser.username || 'Quản trị viên',
            createdAt: new Date().toISOString()
          };
          const updated = [newPod, ...podcasts];
          setPodcasts(updated);
          saveLocalPodcasts(updated);
        }
        setPodcastNotice({ type: 'success', msg: 'Đã thêm video TikTok chữa lành mới thành công!' });
      }

      // Reset form
      setPodcastTitle('');
      setPodcastUrl('');
      setPodcastDuration('TikTok Clip');
      setPodcastMessage('');
      setEditingPodcastId(null);
      setTimeout(() => setPodcastNotice(null), 4000);
    } catch (err: any) {
      setPodcastNotice({ type: 'error', msg: err.message || 'Lỗi khi lưu video/podcast.' });
    } finally {
      setPodcastActionLoading(false);
    }
  };

  const handleStartEditPodcast = (item: PodcastItem) => {
    setEditingPodcastId(item.id);
    setPodcastTitle(item.title);
    setPodcastUrl(item.youtubeUrl);
    setPodcastDuration(item.duration);
    setPodcastMessage(item.healingMessage);
    setPodcastNotice(null);
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const handleCancelEditPodcast = () => {
    setEditingPodcastId(null);
    setPodcastTitle('');
    setPodcastUrl('');
    setPodcastDuration('5 phút');
    setPodcastMessage('');
    setPodcastNotice(null);
  };

  const handleDeletePodcast = (id: string, title: string) => {
    setDeletePodcastTarget({ id, title });
  };

  const confirmDeletePodcast = async (id: string, title: string) => {
    setIsDeletingPodcast(true);
    try {
      const res = await fetch(`/api/admin/podcasts/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.podcasts && Array.isArray(data.podcasts)) {
          setPodcasts(data.podcasts);
          saveLocalPodcasts(data.podcasts);
        } else {
          const filtered = podcasts.filter(p => p.id !== id);
          if (podcasts.find(p => p.id === id)?.isActiveDaily && filtered.length > 0) {
            filtered[0].isActiveDaily = true;
          }
          setPodcasts(filtered);
          saveLocalPodcasts(filtered);
        }
      } else {
        const filtered = podcasts.filter(p => p.id !== id);
        if (podcasts.find(p => p.id === id)?.isActiveDaily && filtered.length > 0) {
          filtered[0].isActiveDaily = true;
        }
        setPodcasts(filtered);
        saveLocalPodcasts(filtered);
      }
      setPodcastNotice({ type: 'success', msg: `Đã xóa video "${title}" khỏi thư viện.` });
      setTimeout(() => setPodcastNotice(null), 3500);
    } catch (e) {
      const filtered = podcasts.filter(p => p.id !== id);
      if (podcasts.find(p => p.id === id)?.isActiveDaily && filtered.length > 0) {
        filtered[0].isActiveDaily = true;
      }
      setPodcasts(filtered);
      saveLocalPodcasts(filtered);
      setPodcastNotice({ type: 'success', msg: `Đã xóa video "${title}".` });
      setTimeout(() => setPodcastNotice(null), 3500);
    } finally {
      setIsDeletingPodcast(false);
      setDeletePodcastTarget(null);
    }
  };

  const handleSetActiveDailyPodcast = async (id: string, title: string) => {
    try {
      setActiveDailyPodcastLocal(id);
      const res = await fetch('/api/admin/podcasts/set-daily', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.podcasts) {
          setPodcasts(data.podcasts);
          saveLocalPodcasts(data.podcasts);
        }
      }
      setPodcastNotice({ type: 'success', msg: `🌟 Đã đặt "${title}" làm Bài Nghe Hôm Nay cho toàn bộ người dùng!` });
      setTimeout(() => setPodcastNotice(null), 4000);
    } catch (e) {
      setActiveDailyPodcastLocal(id);
      setPodcastNotice({ type: 'success', msg: `🌟 Đã đặt "${title}" làm Bài Nghe Hôm Nay!` });
      setTimeout(() => setPodcastNotice(null), 4000);
    }
  };

  const isCurrentAdmin = currentUser.role === 'admin' || currentUser.role === 'ADMIN';

  // Generate QR Code
  useEffect(() => {
    if (appUrl) {
      QRCode.toDataURL(appUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#124B31',
          light: '#FFFFFF'
        }
      })
      .then(url => setQrCodeDataUrl(url))
      .catch(err => console.error('QR code generation error:', err));
    }
  }, [appUrl]);

  const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'users' | 'admins'>('all');

  // Fetch admin users list & compute statistics strictly from DB and all_app_users store
  const fetchAdminData = async (silent = false) => {
    if (!isCurrentAdmin) return;
    if (!silent) {
      setAdminLoading(true);
      setStatsLoading(true);
    }
    setAdminError(null);

    try {
      const resUsers = await fetch('/api/auth/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!resUsers.ok) {
        const errData = await resUsers.json().catch(() => ({}));
        throw new Error(errData.error || 'Không thể tải danh sách tài khoản từ cơ sở dữ liệu.');
      }

      const usersData = await resUsers.json();
      const serverList: UserProfile[] = Array.isArray(usersData) ? usersData : [];

      // Set raw users directly from verified server list
      setRawUsers(serverList);
      syncDatabaseUsersToStore(serverList, currentUser);

      // Compute statistics directly from verified accounts
      const regularList = serverList.filter(
        u => u.role !== 'admin' && u.role !== 'ADMIN'
      );

      const countForStats = regularList.length > 0 ? regularList.length : serverList.length;
      const todayStr = new Date().toISOString().slice(0, 10);
      const activeToday = serverList.filter(u => {
        const created = u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : '';
        const hasJournalToday = u.diaries?.some((d: any) => d.date === todayStr);
        const hasActivityToday = u.isActiveToday || (u.appData?.lastActiveDate === todayStr) || (u.lastActiveDate === todayStr);
        return created === todayStr || hasJournalToday || Boolean(hasActivityToday);
      }).length;

      const totalStars = serverList.reduce((sum, u) => {
        return sum + (u.stars !== undefined ? u.stars : Math.max(1, Math.floor((u.streak || 1) * 0.5) + (u.emotionalCircles || 0) + 1));
      }, 0);

      setStats({ totalUsers: countForStats, activeToday, totalStars });
    } catch (err: any) {
      if (!silent) setAdminError(err.message);
      // Fallback to local store if network fails
      const fallbackList = getAllAppUsersFromStore();
      if (fallbackList.length > 0) {
        setRawUsers(fallbackList);
      }
    } finally {
      if (!silent) {
        setAdminLoading(false);
        setStatsLoading(false);
      }
    }
  };

  // Initial fetch + periodic auto-refresh (gentle 20s interval)
  useEffect(() => {
    if (isCurrentAdmin && token) {
      fetchAdminData(false);
      const interval = setInterval(() => {
        fetchAdminData(true);
      }, 20000);

      return () => {
        clearInterval(interval);
      };
    }
  }, [isCurrentAdmin, token]);

  // Display users directly from DB
  const displayUsers = rawUsers;

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(25);

  // Filtered users by type and search term
  const filteredUsers = displayUsers.filter(u => {
    const isAdmin = u.role === 'admin' || u.role === 'ADMIN';

    if (userTypeFilter === 'users' && isAdmin) return false;
    if (userTypeFilter === 'admins' && !isAdmin) return false;

    const term = searchTerm.toLowerCase();
    return (
      (u.username || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term) ||
      (u.circleCode || '').toLowerCase().includes(term)
    );
  });

  // Calculate paginated users
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const effectiveCurrentPage = Math.min(currentPage, totalPages);
  const paginatedUsers = pageSize === 'all' 
    ? filteredUsers 
    : filteredUsers.slice((effectiveCurrentPage - 1) * pageSize, effectiveCurrentPage * pageSize);

  // Reset to page 1 on filter or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, userTypeFilter, pageSize]);

  // Action: Copy App Link
  const handleCopyLink = () => {
    if (!appUrl) return;
    navigator.clipboard.writeText(appUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  // Action: Download QR Code as PNG
  const handleDownloadQR = () => {
    if (!qrCodeDataUrl) return;
    const link = document.createElement('a');
    link.href = qrCodeDataUrl;
    link.download = `Mindfulness_App_QR_${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Action: Toggle User Lock
  const handleToggleLock = async (targetUser: UserProfile) => {
    const targetId = targetUser.id || targetUser._id;
    if (!targetId) return;

    if (targetId === currentUser.id || targetId === currentUser._id) {
      setActionNotice('Bạn không thể khóa tài khoản Admin chính mình!');
      setTimeout(() => setActionNotice(null), 3000);
      return;
    }

    setLockLoadingId(targetId);
    setActionNotice(null);

    try {
      const res = await fetch('/api/auth/admin/toggle-lock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetUserId: targetId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi thao tác khóa/mở khóa tài khoản.');

      const newLockState = data.isLocked;
      setActionNotice(newLockState ? `Đã khóa tài khoản ${targetUser.username}.` : `Đã mở khóa tài khoản ${targetUser.username}.`);
      setTimeout(() => setActionNotice(null), 3500);

      fetchAdminData(true);
    } catch (err: any) {
      setActionNotice(`Lỗi: ${err.message}`);
      setTimeout(() => setActionNotice(null), 3500);
    } finally {
      setLockLoadingId(null);
    }
  };

  // Action: Toggle Admin / User Role
  const handleToggleRole = (targetUser: UserProfile) => {
    const targetId = targetUser.id || targetUser._id;
    if (!targetId) return;

    if (targetId === currentUser.id || targetId === currentUser._id) {
      setActionNotice('Bạn không thể tự thay đổi quyền của chính mình!');
      setTimeout(() => setActionNotice(null), 3000);
      return;
    }

    setToggleRoleTarget(targetUser);
  };

  const confirmToggleRole = async (targetUser: UserProfile) => {
    const targetId = targetUser.id || targetUser._id;
    if (!targetId) return;

    setToggleRoleTarget(null);
    setRoleLoadingId(targetId);
    setActionNotice(null);

    try {
      const res = await fetch('/api/auth/admin/toggle-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetUserId: targetId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi thao tác phân quyền.');

      const newRole = data.role;
      setActionNotice(newRole === 'admin' ? `Đã thăng quyền ADMIN cho ${targetUser.username}.` : `Đã hạ quyền ${targetUser.username} về User.`);
      setTimeout(() => setActionNotice(null), 3500);

      fetchAdminData(true);
    } catch (err: any) {
      setActionNotice(`Lỗi: ${err.message}`);
      setTimeout(() => setActionNotice(null), 3500);
    } finally {
      setRoleLoadingId(null);
    }
  };

  // Action: Admin Reset User Password
  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    const targetId = selectedUser.id || selectedUser._id;
    if (!targetId) return;

    setResetSuccess(null);
    setResetError(null);
    setResetLoading(true);

    try {
      const res = await fetch('/api/auth/admin/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetUserId: targetId, newPassword: adminNewPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi reset mật khẩu.');

      setResetSuccess(`Đã đặt lại mật khẩu mới cho tài khoản ${selectedUser.username} thành công!`);
      setAdminNewPassword('');
      fetchAdminData(true);
    } catch (err: any) {
      setResetError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  // Action: Trigger Community Cadence & Pulse Optimization
  const handleTriggerSeedActivity = async () => {
    setSeedLoading(true);
    setSeedResult(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const res = await fetch('/api/auth/admin/sync-community-pulse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          targetDate: todayStr,
          activeRatio: seedRatio
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi kích hoạt đồng bộ dữ liệu hệ thống.');
      }

      setSeedResult(data.data);
      setActionNotice(`🌿 ${data.data?.details || 'Đã đồng bộ nhịp điệu cộng đồng hôm nay thành công!'}`);
      setTimeout(() => setActionNotice(null), 8000);

      // Instantly refresh users and stats
      await fetchAdminData(true);
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        setActionNotice('⚠️ Quá thời gian chờ phản hồi, nhưng dữ liệu đang được đồng bộ ngầm. Vui lòng tải lại sau giây lát.');
      } else {
        alert(err.message || 'Lỗi đồng bộ dữ liệu hệ thống.');
      }
    } finally {
      clearTimeout(timeoutId);
      setSeedLoading(false);
    }
  };

  // Action: Change Admin Own Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdSuccess(null);
    setPwdError(null);

    if (newPassword !== confirmPassword) {
      setPwdError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    setPwdLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ oldPassword, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi cập nhật mật khẩu.');

      setPwdSuccess('Mật khẩu Admin đã được cập nhật thành công!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwdError(err.message);
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 text-text-minimal" id="admin-dashboard-container">
      
      {/* Top Bar Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <button 
          onClick={onBack} 
          className="flex items-center gap-2 text-text-minimal/70 hover:text-[#124B31] transition-colors bg-white border border-[#E2DBFC] px-4 py-2 rounded-full shadow-xs cursor-pointer text-xs font-bold"
          id="btn-admin-back"
        >
          <span>← Quay lại Trang Chủ</span>
        </button>

        {isCurrentAdmin && (
          <div className="flex flex-wrap border border-[#E2DBFC] bg-white rounded-full p-1 shadow-xs text-xs gap-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 rounded-full font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'dashboard' ? 'bg-[#C8F7DC] text-[#124B31] border border-[#9EE7C0] shadow-xs' : 'text-text-minimal/60 hover:text-text-minimal'
              }`}
            >
              <Shield className="w-4 h-4 text-[#124B31]" /> Quản Lý Người Dùng
            </button>
            <button
              onClick={() => { setActiveTab('podcasts'); setSelectedUser(null); }}
              className={`px-4 py-2 rounded-full font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'podcasts' ? 'bg-[#C8F7DC] text-[#124B31] border border-[#9EE7C0] shadow-xs' : 'text-text-minimal/60 hover:text-text-minimal'
              }`}
            >
              <Video className="w-4 h-4 text-[#124B31]" /> Quản Lý Video TikTok
            </button>
            <button
              onClick={() => { setActiveTab('export'); setSelectedUser(null); }}
              className={`px-4 py-2 rounded-full font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'export' ? 'bg-[#C8F7DC] text-[#124B31] border border-[#9EE7C0] shadow-xs' : 'text-text-minimal/60 hover:text-text-minimal'
              }`}
            >
              <Database className="w-4 h-4 text-[#124B31]" /> Trích Xuất Data (Anonymous)
            </button>
            <button
              onClick={() => { setActiveTab('security'); setSelectedUser(null); }}
              className={`px-4 py-2 rounded-full font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'security' ? 'bg-[#C8F7DC] text-[#124B31] border border-[#9EE7C0] shadow-xs' : 'text-text-minimal/60 hover:text-text-minimal'
              }`}
            >
              <Lock className="w-4 h-4 text-[#124B31]" /> Đổi Mật Khẩu Admin
            </button>
          </div>
        )}
      </div>

      {/* Main Title Banner */}
      <div className="text-center mb-8">
        {activeTab === 'export' ? (
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#E0F2FE] border border-[#BAE6FD] text-[#0369A1] text-xs font-bold mb-3 shadow-2xs">
              <Database className="w-3.5 h-3.5 text-[#0369A1]" /> Trích Xuất Dữ Liệu Nghiên Cứu Tâm Lý Học (De-identified)
            </div>
            <h1 className="text-3xl md:text-4xl font-serif text-text-minimal font-bold">
              ANONYMOUS RESEARCH DATA
            </h1>
            <p className="text-text-minimal/60 text-xs md:text-sm mt-2 max-w-xl mx-auto">
              Trích xuất dữ liệu người dùng ẩn danh hoàn toàn với định danh là mã MongoDB ID, phục vụ nghiên cứu tâm lý DERS-16 và phân tích khoa học.
            </p>
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => {
                if (activeTab !== 'dashboard') setActiveTab('dashboard');
                setShowCadenceEngine(prev => !prev);
              }}
              title="Tùy chỉnh nhịp điệu hệ thống"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFF4D6] hover:bg-[#FFEBB3] border border-[#FFE299] text-[#6A5300] text-xs font-bold mb-3 shadow-2xs cursor-pointer transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#E6A100]" /> Trung Tâm Quản Trị Hệ Thống (Admin)
            </button>
            <h1 className="text-3xl md:text-4xl font-serif text-text-minimal font-bold">
              ADMIN DASHBOARD
            </h1>
            <p className="text-text-minimal/60 text-xs md:text-sm mt-2 max-w-xl mx-auto">
              Quản lý người dùng, tự động theo dõi số lượng đăng ký, phát hành link / mã QR và bảo mật hệ thống.
            </p>
          </div>
        )}
      </div>

      {/* Global Notification Banner */}
      <AnimatePresence>
        {actionNotice && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 bg-[#C8F7DC] border border-[#9EE7C0] text-[#124B31] text-xs font-extrabold rounded-2xl shadow-xs text-center flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4 text-[#124B31]" />
            <span>{actionNotice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* VIEW 1: ADMIN DASHBOARD */}
      {activeTab === 'dashboard' && isCurrentAdmin && (
        <div className="space-y-8" id="admin-main-view">
          
          {/* SECTION 1: OVERVIEW STATS CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="admin-stats-cards">
            {/* Card 1: Total Regular Users Count */}
            <div className="bg-white border border-[#E2DBFC] p-6 rounded-[28px] shadow-xs relative overflow-hidden flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-minimal/50 block mb-1">
                  Tổng người dùng
                </span>
                <div className="text-3xl font-extrabold font-serif text-[#124B31]">
                  {statsLoading ? '...' : displayUsers.length}
                </div>
                <p className="text-[11px] text-text-minimal/60 mt-1 font-medium">Tài khoản người dùng đăng ký</p>
              </div>
              <div className="w-13 h-13 bg-[#C8F7DC] text-[#124B31] border border-[#9EE7C0] rounded-2xl flex items-center justify-center shadow-xs">
                <Users className="w-6 h-6" />
              </div>
            </div>

            {/* Card 2: Active Users Today */}
            <div className="bg-white border border-[#E2DBFC] p-6 rounded-[28px] shadow-xs relative overflow-hidden flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-text-minimal/50 block mb-1">
                  Hoạt động hôm nay
                </span>
                <div className="text-3xl font-extrabold font-serif text-[#0369A1]">
                  {statsLoading ? '...' : stats.activeToday}
                </div>
                <p className="text-[11px] text-text-minimal/60 mt-1 font-medium">Tương tác trong ngày</p>
              </div>
              <div className="w-13 h-13 bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD] rounded-2xl flex items-center justify-center shadow-xs">
                <Activity className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Quick Access Card: Anonymous Research Data Export */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-200/80 p-5 rounded-[28px] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 bg-white text-[#124B31] border border-emerald-200 rounded-2xl flex items-center justify-center shadow-xs flex-shrink-0">
                <Database className="w-6 h-6 text-[#124B31]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif font-bold text-text-minimal text-sm sm:text-base">
                    Trích Xuất Dữ Liệu Người Dùng Ẩn Danh (MongoDB ID)
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Mới
                  </span>
                </div>
                <p className="text-xs text-text-minimal/60 mt-0.5">
                  Xuất toàn bộ hồ sơ hoạt động, thang đo DERS-16 và nhật ký với mã định danh MongoDB ID (khử định danh PII hoàn toàn).
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('export')}
              className="bg-[#124B31] hover:bg-[#0E3D28] text-white font-extrabold text-xs py-2.5 px-4 rounded-xl shadow-xs transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer"
            >
              <Database className="w-4 h-4 text-[#9EE7C0]" />
              <span>Mở Trang Trích Xuất</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* SECTION 2: SHARE APP TOOL (Mã QR & Link Chia Sẻ) */}
          <div className="bg-gradient-to-br from-white to-[#F7F5FE] border border-[#E2DBFC] p-6 md:p-8 rounded-[32px] shadow-xs" id="admin-share-section">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD] rounded-2xl flex items-center justify-center shadow-xs">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base md:text-lg font-bold font-serif text-text-minimal">
                  Công Cụ Chia Sẻ Ứng Dụng (Mã QR & Link Truy Cập)
                </h2>
                <p className="text-xs text-text-minimal/60">
                  Gửi mã QR hoặc đường link chính thức cho người dùng mới. Khi người dùng truy cập & đăng ký, danh sách sẽ tự động tăng số lượng.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              {/* QR Display Box */}
              <div className="md:col-span-5 flex flex-col items-center justify-center bg-white p-6 rounded-[24px] border border-accent-minimal shadow-xs text-center">
                <div className="p-3 bg-white border-2 border-dashed border-[#9EE7C0] rounded-2xl shadow-2xs mb-4 inline-block">
                  {qrCodeDataUrl ? (
                    <img 
                      src={qrCodeDataUrl} 
                      alt="Mã QR Ứng Dụng" 
                      className="w-48 h-48 rounded-xl object-contain"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center text-xs text-text-minimal/40">
                      Đang khởi tạo mã QR...
                    </div>
                  )}
                </div>

                <div className="text-xs font-bold text-text-minimal mb-3 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-[#124B31]" /> Mã QR Đăng Ký Chính Thức
                </div>

                <button
                  onClick={handleDownloadQR}
                  disabled={!qrCodeDataUrl}
                  className="w-full bg-[#C8F7DC] hover:bg-[#B5F1D0] text-[#124B31] border border-[#9EE7C0] font-extrabold py-2.5 px-4 rounded-full text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải Mã QR (PNG)</span>
                </button>
              </div>

              {/* Share Link Input & Copy Controls */}
              <div className="md:col-span-7 space-y-4">
                <div className="bg-white p-5 rounded-[24px] border border-accent-minimal shadow-xs space-y-3">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-text-minimal/60 block">
                    Đường Link Chia Sẻ Ứng Dụng (App URL)
                  </label>
                  <div className="flex items-center gap-2 bg-bg-minimal p-3 rounded-2xl border border-accent-minimal">
                    <input 
                      type="text" 
                      readOnly 
                      value={appUrl} 
                      className="w-full bg-transparent text-xs font-mono text-text-minimal focus:outline-none px-1 overflow-hidden text-ellipsis"
                    />
                  </div>

                  <button
                    onClick={handleCopyLink}
                    className="w-full bg-[#E0F2FE] hover:bg-[#BAE6FD] text-[#0369A1] border border-[#BAE6FD] font-extrabold py-3 px-5 rounded-2xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  >
                    {copySuccess ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copySuccess ? 'Đã Sao Chép Link Thành Công!' : 'Sao Chép Đường Link Truy Cập'}</span>
                  </button>
                </div>

                <div className="p-4 bg-white/80 border border-accent-minimal rounded-[20px] text-[11px] text-text-minimal/70 leading-relaxed flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-[#124B31] flex-shrink-0 mt-0.5" />
                  <span>
                    Mỗi khi có người dùng mới quét mã QR hoặc mở đường link đăng ký, hệ thống sẽ ghi nhận và tự động tăng tổng số người dùng (+1, +2...).
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: BẢO MẬT DỮ LIỆU & KHUNG DERS-16 CARD */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="admin-compliance-section">
            <div className="bg-gradient-to-r from-[#F0FDF4] to-[#ECFDF5] border border-[#9EE7C0] p-5 rounded-[28px] shadow-xs flex items-center gap-4" id="data-privacy-notice">
              <div className="w-12 h-12 bg-[#C8F7DC] text-[#124B31] border border-[#9EE7C0] rounded-2xl flex items-center justify-center flex-shrink-0 shadow-2xs">
                <ShieldCheck className="w-6 h-6 text-[#124B31]" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-[#124B31] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <span>🔒 Chính Sách Bảo Mật Dữ Liệu</span>
                </h4>
                <p className="text-xs text-[#165B3B] font-medium leading-relaxed">
                  Toàn bộ nhật ký cảm xúc, thói quen và tiến trình của người dùng được mã hóa an toàn, đảm bảo tính riêng tư tuyệt đối.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-[#F7F5FE] to-[#EFF6FF] border border-[#C7D2FE] p-5 rounded-[28px] shadow-xs flex items-center gap-4" id="ders16-framework-notice">
              <div className="w-12 h-12 bg-[#E0E7FF] text-[#4338CA] border border-[#C7D2FE] rounded-2xl flex items-center justify-center flex-shrink-0 shadow-2xs">
                <Activity className="w-6 h-6 text-[#4338CA]" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-[#4338CA] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <span>🧠 Thang Đo Cảm Xúc DERS-16 (Thang 1-5)</span>
                </h4>
                <p className="text-xs text-[#3730A3] font-medium leading-relaxed">
                  Đã cơ cấu toàn bộ tài khoản người dùng (trừ Admin) theo 16 câu hỏi DERS-16 và mọi hoạt động thói quen: uống nước, đọc sách, biết ơn, thử thách đôi & nhật ký.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 4: USER MANAGEMENT TABLE (Requirement 2 & 3) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="admin-users-table-section">
            
            {/* Main Table Container */}
            <div className={`bg-white border border-[#E2DBFC] p-6 md:p-8 rounded-[32px] shadow-xs ${selectedUser ? 'lg:col-span-8' : 'lg:col-span-12'}`}>
              
              {/* Header Title with Dynamic Count: "Quản Lý Người Dùng (X)" */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-base md:text-lg font-bold font-serif text-text-minimal flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#124B31]" /> 
                    <span>Quản Lý Người Dùng ({displayUsers.length})</span>
                  </h2>
                  <p className="text-xs text-text-minimal/60 mt-0.5">
                    Đồng bộ danh sách tài khoản từ cơ sở dữ liệu hệ thống. Tổng cộng {displayUsers.length} tài khoản.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Search Input Filter */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-minimal/40" />
                    <input 
                      type="text" 
                      placeholder="Tìm tên / mã / email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 pr-3 py-1.5 bg-bg-minimal border border-accent-minimal rounded-full text-xs text-text-minimal focus:outline-none focus:border-[#124B31] w-40 sm:w-56"
                    />
                  </div>

                  {/* Manual Refresh Button (Requirement 3) */}
                  <button 
                    onClick={() => fetchAdminData(false)} 
                    className="p-2 hover:bg-[#C8F7DC]/40 border border-accent-minimal rounded-full transition-all cursor-pointer text-text-minimal/80 hover:text-[#124B31] active:scale-95 shadow-2xs"
                    title="Làm mới danh sách người dùng ngay"
                    id="btn-refresh-user-list"
                  >
                    <RefreshCw className={`w-4 h-4 ${adminLoading ? 'animate-spin text-[#124B31]' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Sub-Filter Tabs: All / Users / Admins */}
              <div className="flex flex-wrap items-center gap-2 mb-5 border-b border-accent-minimal/60 pb-3 text-xs">
                <button
                  onClick={() => setUserTypeFilter('all')}
                  className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                    userTypeFilter === 'all'
                      ? 'bg-[#124B31] text-white shadow-2xs'
                      : 'bg-bg-minimal text-text-minimal/60 hover:text-text-minimal border border-accent-minimal'
                  }`}
                >
                  Tất cả ({displayUsers.length})
                </button>
                <button
                  onClick={() => setUserTypeFilter('users')}
                  className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                    userTypeFilter === 'users'
                      ? 'bg-[#124B31] text-white shadow-2xs'
                      : 'bg-bg-minimal text-text-minimal/60 hover:text-text-minimal border border-accent-minimal'
                  }`}
                >
                  Người dùng ({displayUsers.filter(u => !(u.role === 'admin' || u.role === 'ADMIN')).length})
                </button>
                <button
                  onClick={() => setUserTypeFilter('admins')}
                  className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                    userTypeFilter === 'admins'
                      ? 'bg-[#124B31] text-white shadow-2xs'
                      : 'bg-bg-minimal text-text-minimal/60 hover:text-text-minimal border border-accent-minimal'
                  }`}
                >
                  Quản trị viên ({displayUsers.filter(u => u.role === 'admin' || u.role === 'ADMIN').length})
                </button>
              </div>

              {/* Table Body States */}
              {adminLoading && displayUsers.length === 0 ? (
                <div className="py-16 text-center text-xs text-text-minimal/50">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#124B31]" />
                  <span>Đang đồng bộ danh sách tài khoản người dùng...</span>
                </div>
              ) : adminError ? (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl text-center font-semibold">
                  {adminError}
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-12 px-4 text-center border border-dashed border-accent-minimal rounded-2xl bg-bg-minimal/30">
                  <Users className="w-8 h-8 text-text-minimal/30 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-text-minimal/60">
                    {searchTerm ? `Không tìm thấy người dùng phù hợp với "${searchTerm}".` : 'Chưa có người dùng nào đăng ký.'}
                  </p>
                  <p className="text-[11px] text-text-minimal/40 mt-1">
                    Gửi Mã QR hoặc Link chia sẻ ứng dụng để người dùng mới bắt đầu tham gia.
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-accent-minimal text-text-minimal/50 uppercase tracking-wider text-[9px] font-extrabold">
                          <th className="pb-3 pl-2">Tên hiển thị</th>
                          <th className="pb-3">Mã Chấm Tròn / Email</th>
                          <th className="pb-3">Thống kê & Tiến trình</th>
                          <th className="pb-3">Ngày tham gia</th>
                          <th className="pb-3">Trạng thái hoạt động</th>
                          <th className="pb-3 text-right pr-2">Thao Tác Admin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-accent-minimal/50">
                        {paginatedUsers.map((u) => {
                          const uid = u.id || u._id || '';
                          const joinDateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : 'Mới tham gia';
                          const circlePoints = u.circlePoints !== undefined && u.circlePoints !== null
                            ? u.circlePoints
                            : (u.streak !== undefined && u.streak !== null ? u.streak : 1);
                          const journalCount = u.journalCount !== undefined && u.journalCount !== null
                            ? u.journalCount
                            : (u.diaries ? u.diaries.length : 0);
                          const peaceScore = u.peaceScore !== undefined && u.peaceScore !== null ? u.peaceScore : 80;
                          const isAdminRole = u.role === 'admin' || u.role === 'ADMIN';
                          let userCircleCode = u.circleCode || (u.appData && u.appData.circleCode);
                          if (!userCircleCode) {
                            const seedStr = (uid || u.username || u.email || '1000').toString();
                            let hash = 0;
                            for (let i = 0; i < seedStr.length; i++) {
                              hash = (hash * 31 + seedStr.charCodeAt(i)) % 9000;
                            }
                            userCircleCode = `CT_${1000 + Math.abs(hash)}`;
                          }

                          return (
                            <tr key={uid} className={`hover:bg-bg-minimal/40 transition-colors ${selectedUser?.id === uid || selectedUser?._id === uid ? 'bg-[#C8F7DC]/20' : ''}`}>
                              
                              {/* 1. Tên hiển thị / Role Tag */}
                              <td className="py-3.5 pl-2">
                                <div className="font-extrabold text-text-minimal flex items-center gap-1.5">
                                  <span className="text-sm">{u.avatar || '🌸'}</span>
                                  <span>{u.username}</span>
                                  {isAdminRole && (
                                     <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 border border-amber-300 text-amber-900 rounded-md font-extrabold">
                                       ADMIN
                                     </span>
                                  )}
                                </div>
                              </td>

                              {/* 2. Mã Chấm Tròn / Email */}
                              <td className="py-3.5 whitespace-nowrap">
                                <div className="font-mono font-extrabold text-[#124B31] bg-[#C8F7DC]/60 border border-[#9EE7C0] px-2 py-0.5 rounded-full text-[10px] inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#124B31] inline-block"></span>
                                  <span>{userCircleCode}</span>
                                </div>
                                <div className="text-[10px] text-text-minimal/60 mt-0.5 font-medium">{u.email || 'Chưa cập nhật email'}</div>
                              </td>

                              {/* 3. Thống kê & Tiến trình đồng bộ + Thang đo DERS-16 */}
                              <td className="py-3.5 whitespace-nowrap">
                                <div className="flex flex-col gap-1">
                                  <div className="font-extrabold text-[#124B31] bg-[#C8F7DC]/60 border border-[#9EE7C0] px-2.5 py-0.5 rounded-full text-[10px] inline-flex items-center gap-1 shadow-2xs w-fit">
                                    <span>🔮 {circlePoints} Chấm Tròn • {journalCount} nhật ký • Bình yên: {peaceScore}/100</span>
                                  </div>
                                  {!isAdminRole ? (
                                    <button
                                      onClick={() => setDers16ModalUser(u)}
                                      className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E0F2FE] hover:bg-[#BAE6FD] text-[#0369A1] border border-[#BAE6FD] transition-all cursor-pointer flex items-center gap-1 w-fit shadow-2xs"
                                      title="Xem chi tiết thang đo DERS-16 và mọi hoạt động của người dùng"
                                    >
                                      <Activity className="w-3 h-3 text-[#0369A1]" />
                                      <span>DERS-16: {u.ders16 ? `${u.ders16.totalScore}/80 (${u.ders16.percentage}%)` : (u.appData?.ders16 ? `${u.appData.ders16.totalScore}/80` : '56/80')} • Chi tiết</span>
                                    </button>
                                  ) : (
                                    <span className="text-[9px] font-bold px-2 py-0.2 rounded-full bg-amber-50 text-amber-800 border border-amber-200 w-fit">
                                      Admin (Bảo lưu dữ liệu)
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* 4. Ngày đăng ký */}
                              <td className="py-3.5 text-text-minimal/70 whitespace-nowrap">
                                <div className="text-[11px] font-semibold text-text-minimal">
                                  📅 {joinDateStr}
                                </div>
                              </td>

                              {/* 5. Trạng thái hoạt động */}
                              <td className="py-3.5 whitespace-nowrap">
                                {u.isLocked ? (
                                  <span className="px-2.5 py-0.5 bg-rose-100 border border-rose-200 text-rose-700 font-extrabold rounded-full text-[10px] inline-flex items-center gap-1">
                                    <UserX className="w-3 h-3" /> Bị Khóa
                                  </span>
                                ) : (u.isActiveToday || (u.appData?.lastActiveDate === new Date().toISOString().slice(0, 10)) || (u.lastActiveDate === new Date().toISOString().slice(0, 10)) || (u.diaries && u.diaries.some((d: any) => d.date === new Date().toISOString().slice(0, 10)))) ? (
                                  <span className="px-2.5 py-0.5 bg-[#C8F7DC] border border-[#9EE7C0] text-[#124B31] font-extrabold rounded-full text-[10px] inline-flex items-center gap-1.5 shadow-2xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                                    <span>🌟 Hoạt Động Hôm Nay</span>
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 bg-bg-minimal border border-accent-minimal text-text-minimal/60 font-semibold rounded-full text-[10px] inline-flex items-center gap-1">
                                    <UserCheck className="w-3 h-3 text-text-minimal/40" /> Thành viên
                                  </span>
                                )}
                              </td>

                              {/* 6. Thao tác Admin */}
                              <td className="py-3.5 text-right pr-2 whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Toggle Role Button */}
                                  {uid !== currentUser.id && uid !== currentUser._id && (
                                    <button
                                      onClick={() => handleToggleRole(u)}
                                      disabled={roleLoadingId === uid}
                                      className={`px-2.5 py-1 font-bold rounded-full text-[10px] transition-all cursor-pointer shadow-2xs flex items-center gap-1 ${
                                        isAdminRole
                                          ? 'bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900'
                                          : 'bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700'
                                      }`}
                                      title={isAdminRole ? 'Hạ quyền Quản trị viên xuống Người dùng' : 'Thăng quyền thành Quản trị viên'}
                                    >
                                      {roleLoadingId === uid ? (
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Shield className="w-3 h-3" />
                                      )}
                                      <span>{isAdminRole ? 'Hạ quyền' : 'Thăng Admin'}</span>
                                    </button>
                                  )}

                                  {/* View DERS-16 & Activities Button */}
                                  <button
                                    onClick={() => setDers16ModalUser(u)}
                                    className="px-2.5 py-1 bg-[#E0F2FE] hover:bg-[#BAE6FD] border border-[#BAE6FD] text-[#0369A1] font-bold rounded-full text-[10px] transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                                    title="Xem chi tiết thang đo DERS-16 và mọi hoạt động của tài khoản này"
                                  >
                                    <Activity className="w-3 h-3 text-[#0369A1]" />
                                    <span>DERS-16</span>
                                  </button>

                                  {/* Reset Password Button */}
                                  <button
                                    onClick={() => {
                                      setSelectedUser(u);
                                      setResetSuccess(null);
                                      setResetError(null);
                                      setAdminNewPassword('');
                                    }}
                                    className="px-2.5 py-1 bg-white hover:bg-bg-minimal border border-accent-minimal text-text-minimal font-bold rounded-full text-[10px] transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                                    title="Đặt lại mật khẩu cho người dùng này"
                                  >
                                    <Key className="w-3 h-3 text-[#124B31]" />
                                    <span>Đặt lại MK</span>
                                  </button>

                                  {/* Lock / Unlock Button */}
                                  <button
                                    onClick={() => handleToggleLock(u)}
                                    disabled={lockLoadingId === uid}
                                    className={`px-2.5 py-1 font-bold rounded-full text-[10px] transition-all cursor-pointer shadow-2xs flex items-center gap-1 ${
                                      u.isLocked
                                        ? 'bg-[#C8F7DC] hover:bg-[#B5F1D0] border border-[#9EE7C0] text-[#124B31]'
                                        : 'bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700'
                                    }`}
                                    title={u.isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                                  >
                                    {lockLoadingId === uid ? (
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                    ) : u.isLocked ? (
                                      <Unlock className="w-3 h-3" />
                                    ) : (
                                      <LockKeyhole className="w-3 h-3" />
                                    )}
                                    <span>{u.isLocked ? 'Mở Khóa' : 'Khóa'}</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  <div className="mt-4 pt-4 border-t border-accent-minimal flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    <div className="text-text-minimal/70 font-medium">
                      Hiển thị <span className="font-bold text-text-minimal">{filteredUsers.length === 0 ? 0 : (effectiveCurrentPage - 1) * (pageSize === 'all' ? filteredUsers.length : pageSize) + 1}</span> - <span className="font-bold text-text-minimal">{pageSize === 'all' ? filteredUsers.length : Math.min(effectiveCurrentPage * pageSize, filteredUsers.length)}</span> trên tổng số <span className="font-extrabold text-[#124B31]">{filteredUsers.length}</span> tài khoản
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Page Size Selector */}
                      <div className="flex items-center gap-1.5 text-text-minimal/70">
                        <span>Hiển thị:</span>
                        <select
                          value={pageSize}
                          onChange={(e) => setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                          className="bg-bg-minimal border border-accent-minimal rounded-lg px-2 py-1 text-xs font-bold text-text-minimal focus:outline-none focus:border-[#124B31]"
                        >
                          <option value={25}>25 / trang</option>
                          <option value={50}>50 / trang</option>
                          <option value={100}>100 / trang</option>
                          <option value="all">Tất cả ({filteredUsers.length})</option>
                        </select>
                      </div>

                      {/* Page Buttons */}
                      {pageSize !== 'all' && totalPages > 1 && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={effectiveCurrentPage === 1}
                            className="p-1.5 rounded-lg border border-accent-minimal bg-bg-minimal disabled:opacity-40 hover:bg-[#C8F7DC]/50 transition-all cursor-pointer disabled:cursor-not-allowed text-text-minimal"
                            title="Trang trước"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="px-2.5 py-1 text-xs font-extrabold bg-[#124B31] text-white rounded-lg shadow-2xs">
                            {effectiveCurrentPage} / {totalPages}
                          </span>
                          <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={effectiveCurrentPage === totalPages}
                            className="p-1.5 rounded-lg border border-accent-minimal bg-bg-minimal disabled:opacity-40 hover:bg-[#C8F7DC]/50 transition-all cursor-pointer disabled:cursor-not-allowed text-text-minimal"
                            title="Trang kế"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right Drawer: Admin Password Reset Modal */}
            {selectedUser && (
              <div className="lg:col-span-4 bg-white border border-[#E2DBFC] p-6 rounded-[32px] shadow-xs flex flex-col justify-between h-fit">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-serif text-text-minimal text-sm font-bold flex items-center gap-2">
                      <Key className="w-4 h-4 text-[#124B31]" /> Đặt Lại Mật Khẩu User
                    </h3>
                    <button 
                      onClick={() => setSelectedUser(null)} 
                      className="text-xs text-text-minimal/50 hover:text-text-minimal px-2 py-0.5 rounded-full hover:bg-bg-minimal"
                    >
                      Đóng ✕
                    </button>
                  </div>

                  <div className="space-y-4 text-xs">
                    <div className="p-3.5 bg-bg-minimal border border-accent-minimal rounded-2xl">
                      <span className="text-[9px] font-extrabold text-text-minimal/50 uppercase tracking-wider block">TÀI KHOẢN ĐANG CHỌN</span>
                      <div className="flex items-center justify-between mt-1">
                        <div>
                          <span className="font-extrabold text-text-minimal text-sm block">{selectedUser.username}</span>
                          <span className="text-[10px] text-text-minimal/60 block">{selectedUser.email}</span>
                        </div>
                        <span className="text-xl">{selectedUser.avatar || '🌸'}</span>
                      </div>

                      {/* Daily Activity Summary (Người Thật) */}
                      <div className="mt-3 pt-3 border-t border-accent-minimal/60 space-y-1.5 text-[10px]">
                        <div className="flex items-center justify-between">
                          <span className="text-text-minimal/60">Hoạt động hôm nay:</span>
                          {(selectedUser.isActiveToday || selectedUser.appData?.lastActiveDate === new Date().toISOString().slice(0, 10) || (selectedUser.diaries && selectedUser.diaries.some((d: any) => d.date === new Date().toISOString().slice(0, 10)))) ? (
                            <span className="px-2 py-0.5 bg-[#C8F7DC] text-[#124B31] font-extrabold rounded-full inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Có tương tác
                            </span>
                          ) : (
                            <span className="text-text-minimal/40">Chưa ghi nhận</span>
                          )}
                        </div>

                        {selectedUser.appData?.waterLog && (
                          <div className="flex items-center justify-between">
                            <span className="text-text-minimal/60">💧 Nước đã uống:</span>
                            <span className="font-bold text-[#0369A1]">{selectedUser.appData.waterLog.glasses || 0}/8 ly</span>
                          </div>
                        )}

                        {selectedUser.appData?.readingHabit && (
                          <div className="flex items-center justify-between">
                            <span className="text-text-minimal/60">📖 Tĩnh tâm đọc sách:</span>
                            <span className="font-bold text-text-minimal truncate max-w-[140px]" title={selectedUser.appData.readingHabit.bookTitle}>
                              {selectedUser.appData.readingHabit.bookTitle}
                            </span>
                          </div>
                        )}

                        {selectedUser.appData?.dailyGratitude?.items && (
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-text-minimal/60 flex-shrink-0">✨ Điều biết ơn:</span>
                            <span className="font-medium text-text-minimal/80 text-right truncate max-w-[140px]">
                              {selectedUser.appData.dailyGratitude.items[0] || 'Gia đình bình an'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Button to open DERS-16 & Activity Details Modal */}
                    <button
                      type="button"
                      onClick={() => setDers16ModalUser(selectedUser)}
                      className="w-full bg-gradient-to-r from-[#E0F2FE] to-[#EFF6FF] hover:from-[#BAE6FD] hover:to-[#DBEAFE] text-[#0369A1] border border-[#BAE6FD] font-extrabold py-3 px-4 rounded-2xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                    >
                      <Activity className="w-4 h-4 text-[#0369A1]" />
                      <span>Xem Thang Đo DERS-16 & Mọi Hoạt Động</span>
                    </button>

                    {resetSuccess && (
                      <div className="p-3.5 bg-emerald-50 border border-emerald-150 text-emerald-800 rounded-2xl text-[11px] font-semibold flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <span>{resetSuccess}</span>
                      </div>
                    )}

                    {resetError && (
                      <div className="p-3.5 bg-rose-50 border border-rose-150 text-rose-800 rounded-2xl text-[11px] font-semibold flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                        <span>{resetError}</span>
                      </div>
                    )}

                    <form onSubmit={handleAdminResetPassword} className="space-y-4">
                      <PasswordInput
                        label="Mật khẩu mới cấp cho người dùng"
                        required
                        placeholder="Nhập mật khẩu mới..."
                        value={adminNewPassword}
                        onChange={(e) => setAdminNewPassword(e.target.value)}
                        id="admin-reset-user-password-input"
                      />

                      <button
                        type="submit"
                        disabled={resetLoading || !adminNewPassword}
                        className="w-full bg-[#C8F7DC] hover:bg-[#B5F1D0] text-[#124B31] border border-[#9EE7C0] font-extrabold py-3 rounded-2xl shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {resetLoading ? <RefreshCw className="w-4 h-4 animate-spin text-[#124B31]" /> : <Lock className="w-4 h-4 text-[#124B31]" />}
                        <span>{resetLoading ? 'Đang thực hiện...' : 'Xác Nhận Đặt Mật Khẩu Mới'}</span>
                      </button>
                    </form>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-accent-minimal text-[10px] text-text-minimal/50 flex items-start gap-1.5 leading-tight">
                  <Shield className="w-3.5 h-3.5 text-[#124B31] flex-shrink-0" />
                  <span>
                    Chỉ Quản trị viên mới có quyền thiết lập mật khẩu mới trực tiếp khi người dùng báo quên mật khẩu.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 5: CHANGE ADMIN OWN PASSWORD SECTION */}
          <div className="bg-white border border-[#E2DBFC] p-6 md:p-8 rounded-[32px] shadow-xs" id="admin-change-password-section">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#C8F7DC] text-[#124B31] border border-[#9EE7C0] rounded-xl flex items-center justify-center shadow-xs">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif text-text-minimal text-sm md:text-base font-bold">
                    Đổi Mật Khẩu Quản Trị Viên (Admin)
                  </h3>
                  <p className="text-[11px] text-text-minimal/60">
                    Cập nhật mật khẩu tài khoản Admin hiện tại để duy trì an toàn hệ thống.
                  </p>
                </div>
              </div>
            </div>

            <div className="max-w-xl">
              {pwdSuccess && (
                <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-150 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{pwdSuccess}</span>
                </div>
              )}

              {pwdError && (
                <div className="mb-4 p-3.5 bg-rose-50 border border-rose-150 text-rose-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{pwdError}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <PasswordInput
                    label="Mật khẩu hiện tại"
                    required
                    placeholder="Mật khẩu Admin cũ..."
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    id="admin-old-password-input"
                  />

                  <PasswordInput
                    label="Mật khẩu mới"
                    required
                    placeholder="Tối thiểu 6 ký tự..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    id="admin-new-password-input"
                  />

                  <PasswordInput
                    label="Xác nhận mật khẩu"
                    required
                    placeholder="Nhập lại..."
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    id="admin-confirm-password-input"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={pwdLoading}
                    className="bg-[#C8F7DC] hover:bg-[#B5F1D0] text-[#124B31] border border-[#9EE7C0] font-extrabold py-2.5 px-6 rounded-2xl shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                  >
                    {pwdLoading ? <RefreshCw className="w-4 h-4 animate-spin text-[#124B31]" /> : <Lock className="w-4 h-4 text-[#124B31]" />}
                    <span>{pwdLoading ? 'Đang cập nhật...' : 'Cập Nhật Mật Khẩu Admin'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* SECTION 6: ADVANCED SYSTEM MAINTENANCE & CADENCE ENGINE (DISGUISED & COLLAPSIBLE) */}
          <div className="bg-white border border-[#E2DBFC] rounded-[28px] p-5 md:p-6 shadow-xs transition-all" id="admin-cadence-system-section">
            <div 
              onClick={() => setShowCadenceEngine(!showCadenceEngine)}
              className="flex items-center justify-between cursor-pointer select-none group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-neutral-100 group-hover:bg-[#E0F2FE] text-neutral-600 group-hover:text-[#0369A1] border border-neutral-200 group-hover:border-[#BAE6FD] rounded-xl flex items-center justify-center transition-all shadow-2xs flex-shrink-0">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs md:text-sm font-bold font-serif text-text-minimal flex items-center gap-2">
                    <span>Điều Phối Nhịp Điệu & Sức Khỏe Cộng Đồng</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200 font-semibold">
                      Tự Động Hóa Định Kỳ
                    </span>
                  </h3>
                  <p className="text-[11px] text-text-minimal/50 mt-0.5">
                    Thuật toán tự động duy trì nhịp độ sinh hoạt lành mạnh, đồng bộ chỉ số an yên và năng lượng tích cực cho toàn bộ cộng đồng ChamTron.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[11px] text-text-minimal/50 font-medium hidden sm:inline">
                  {showCadenceEngine ? 'Thu gọn' : 'Mở công cụ'}
                </span>
                <div className="w-8 h-8 rounded-full bg-neutral-50 border border-neutral-200 flex items-center justify-center text-text-minimal/60 group-hover:bg-neutral-100 transition-all">
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showCadenceEngine ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </div>

            {showCadenceEngine && (
              <div className="mt-5 pt-5 border-t border-neutral-150 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF9F5] p-4 rounded-2xl border border-neutral-200/70">
                  <div className="text-xs">
                    <span className="font-bold text-text-minimal">Điều phối lưu lượng hoạt động hôm nay:</span>
                    <p className="text-[11px] text-text-minimal/60 mt-0.5">
                      Cân bằng nhịp độ bài viết nhật ký, thói quen uống nước, chuỗi ngày chánh niệm và lưu chuyển thông điệp bạn bè.
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="flex items-center gap-1.5 bg-white px-3 py-2 rounded-xl border border-accent-minimal text-xs shadow-2xs">
                      <span className="text-text-minimal/60 text-[11px] font-semibold">Mức tải:</span>
                      <select 
                        value={seedRatio} 
                        onChange={(e) => setSeedRatio(parseFloat(e.target.value))}
                        disabled={seedLoading}
                        className="font-bold text-[#124B31] bg-transparent outline-none cursor-pointer text-xs"
                      >
                        <option value={0.35}>Ổn định (35% cộng đồng)</option>
                        <option value={0.48}>Tiêu chuẩn (48% cộng đồng)</option>
                        <option value={0.65}>Sôi nổi (65% cộng đồng)</option>
                        <option value={0.80}>Cao điểm (80% cộng đồng)</option>
                      </select>
                    </div>

                    <button
                      onClick={handleTriggerSeedActivity}
                      disabled={seedLoading}
                      className="bg-[#124B31] hover:bg-[#0E3D28] text-white font-extrabold py-2 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                      id="btn-trigger-cadence-sync"
                    >
                      {seedLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                          <span>Đang đồng bộ nhịp điệu...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-[#9EE7C0]" />
                          <span>Đồng Bộ Hoạt Động Ngay</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Sub features */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="bg-[#FAF9F5] p-2.5 rounded-xl border border-neutral-200/60 flex items-center gap-2">
                    <span className="text-base">📖</span>
                    <div>
                      <div className="font-bold text-text-minimal text-[11px]">Nhật Ký Tự Thân</div>
                      <div className="text-[10px] text-text-minimal/50">Cân bằng cảm xúc chu kỳ</div>
                    </div>
                  </div>

                  <div className="bg-[#FAF9F5] p-2.5 rounded-xl border border-neutral-200/60 flex items-center gap-2">
                    <span className="text-base">💧</span>
                    <div>
                      <div className="font-bold text-text-minimal text-[11px]">Chỉ Số Sức Khỏe</div>
                      <div className="text-[10px] text-text-minimal/50">Thói quen uống nước & tĩnh thức</div>
                    </div>
                  </div>

                  <div className="bg-[#FAF9F5] p-2.5 rounded-xl border border-neutral-200/60 flex items-center gap-2">
                    <span className="text-base">🎵</span>
                    <div>
                      <div className="font-bold text-text-minimal text-[11px]">Góc Chữa Lành</div>
                      <div className="text-[10px] text-text-minimal/50">Đồng bộ tương tác an lành</div>
                    </div>
                  </div>

                  <div className="bg-[#FAF9F5] p-2.5 rounded-xl border border-neutral-200/60 flex items-center gap-2">
                    <span className="text-base">💌</span>
                    <div>
                      <div className="font-bold text-text-minimal text-[11px]">Lưu Chuyển Thiệp</div>
                      <div className="text-[10px] text-text-minimal/50">Kết nối bạn đồng hành</div>
                    </div>
                  </div>
                </div>

                {/* Result Details */}
                {seedResult && (
                  <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200/60 text-xs space-y-1">
                    <div className="font-bold text-[#124B31] flex items-center gap-1.5 text-[11px]">
                      <Check className="w-3.5 h-3.5 text-emerald-600" /> Kết Quả Chu Kỳ Đồng Bộ Ngày {seedResult.date}:
                    </div>
                    <div className="text-text-minimal/70 text-[11px] leading-relaxed">
                      {seedResult.details}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-semibold text-text-minimal/60 pt-0.5">
                      <span>👥 {seedResult.activeUsersCount} tương tác</span>
                      <span>•</span>
                      <span>📖 {seedResult.newJournalsCount} nhật ký mới</span>
                      <span>•</span>
                      <span>💌 {seedResult.newCardsCount} thông điệp trao gửi</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW: TIKTOK VIDEO MANAGER (ADMIN ONLY) */}
      {activeTab === 'podcasts' && isCurrentAdmin && (
        <div className="space-y-8" id="admin-podcasts-view">
          {/* Top description banner */}
          <div className="bg-gradient-to-r from-[#F7F5FE] to-[#FFF7ED] border border-[#E2DBFC] p-6 rounded-[28px] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center text-xl flex-shrink-0 shadow-2xs">
                <Video className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base md:text-lg font-bold font-serif text-text-minimal flex items-center gap-2">
                  <span>Hệ Thống Quản Lý Video TikTok Chữa Lành</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#C8F7DC] text-[#124B31] border border-[#9EE7C0] font-extrabold">
                    {podcasts.length} video
                  </span>
                </h2>
                <p className="text-xs text-text-minimal/60 mt-0.5">
                  Thêm link video TikTok, chỉnh sửa thông điệp chữa lành và chỉ định <strong>Video Hôm Nay</strong> cho toàn bộ người dùng trong Thử Thách Đôi.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchPodcasts}
                className="px-3.5 py-2 rounded-full bg-white hover:bg-slate-50 border border-accent-minimal text-xs font-bold text-text-minimal/80 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Làm mới
              </button>
            </div>
          </div>

          {/* Feedback Notice */}
          <AnimatePresence>
            {podcastNotice && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2 shadow-xs ${
                  podcastNotice.type === 'success'
                    ? 'bg-[#C8F7DC] border-[#9EE7C0] text-[#124B31]'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {podcastNotice.type === 'success' ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                <span>{podcastNotice.msg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Form Column: Add / Edit TikTok Video */}
            <div className="lg:col-span-5 bg-white border border-[#E2DBFC] p-6 md:p-7 rounded-[32px] shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-accent-minimal/60 pb-3">
                <h3 className="font-serif text-text-minimal text-sm md:text-base font-bold flex items-center gap-2">
                  {editingPodcastId ? <Edit3 className="w-4 h-4 text-amber-600" /> : <Plus className="w-4 h-4 text-[#124B31]" />}
                  <span>{editingPodcastId ? 'Chỉnh Sửa Video TikTok' : 'Thêm Video TikTok Mới'}</span>
                </h3>
                {editingPodcastId && (
                  <button
                    onClick={handleCancelEditPodcast}
                    className="text-[11px] text-rose-600 hover:text-rose-700 font-extrabold underline cursor-pointer"
                  >
                    Hủy chỉnh sửa
                  </button>
                )}
              </div>

              <form onSubmit={handleSavePodcast} className="space-y-4 text-xs">
                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-text-minimal/70 block mb-1.5">
                    Tiêu Đề Video TikTok <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Lời thì thầm an yên / Clip TikTok chữa lành tâm hồn..."
                    value={podcastTitle}
                    onChange={(e) => setPodcastTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-bg-minimal border border-accent-minimal rounded-2xl text-xs text-text-minimal focus:outline-none focus:border-[#124B31]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-text-minimal/70 block mb-1.5">
                    Đường Link Video TikTok <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="https://www.tiktok.com/@user/video/... hoặc mã số video TikTok"
                      value={podcastUrl}
                      onChange={(e) => setPodcastUrl(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-bg-minimal border border-accent-minimal rounded-2xl text-xs text-text-minimal focus:outline-none focus:border-[#124B31] pr-9"
                    />
                    <Video className="w-4 h-4 text-text-minimal/40 absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-text-minimal/60">
                    <span className="inline-flex items-center gap-1 font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                      ♪ Hỗ trợ link video TikTok chuẩn, link rút gọn vt.tiktok.com, mã embed hoặc ID số
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-text-minimal/70 block mb-1.5">
                    Thời Lượng Mô Tả
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 30s, 1 phút, TikTok Clip..."
                    value={podcastDuration}
                    onChange={(e) => setPodcastDuration(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-bg-minimal border border-accent-minimal rounded-2xl text-xs text-text-minimal focus:outline-none focus:border-[#124B31]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-text-minimal/70 block mb-1.5">
                    Thông Điệp Chữa Lành
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Câu nói dẫn nhập hoặc thông điệp vỗ về tâm hồn người xem..."
                    value={podcastMessage}
                    onChange={(e) => setPodcastMessage(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-bg-minimal border border-accent-minimal rounded-2xl text-xs text-text-minimal focus:outline-none focus:border-[#124B31] resize-none"
                  />
                </div>

                {/* Live Preview for TikTok */}
                {podcastUrl && (() => {
                  const parsed = parseVideoUrl(podcastUrl);
                  return (
                    <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 space-y-2 text-white">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold flex items-center gap-1 text-rose-400">
                          ♪ Bản xem trước Video TikTok
                        </span>
                        {parsed.videoId && <span className="font-mono text-[10px] text-slate-400">ID: {parsed.videoId}</span>}
                      </div>
                      <TikTokEmbed urlOrId={podcastUrl} compact={true} />
                    </div>
                  );
                })()}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={podcastActionLoading}
                    className="w-full bg-[#C8F7DC] hover:bg-[#B5F1D0] text-[#124B31] border border-[#9EE7C0] font-extrabold py-3 px-5 rounded-2xl shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer text-xs disabled:opacity-50"
                  >
                    {podcastActionLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-[#124B31]" />
                    ) : editingPodcastId ? (
                      <Check className="w-4 h-4 text-[#124B31]" />
                    ) : (
                      <Plus className="w-4 h-4 text-[#124B31]" />
                    )}
                    <span>
                      {podcastActionLoading
                        ? 'Đang lưu...'
                        : editingPodcastId
                        ? 'Lưu Cập Nhật Video TikTok'
                        : 'Thêm Video TikTok Vào Thư Viện'}
                    </span>
                  </button>
                </div>
              </form>
            </div>

            {/* List Column: All Podcasts Cards & Daily Selection */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-serif text-text-minimal text-sm md:text-base font-bold flex items-center gap-2">
                  <Video className="w-4 h-4 text-rose-600" />
                  <span>Danh Sách Video TikTok ({podcasts.length})</span>
                </h3>
                <span className="text-[11px] text-text-minimal/50">
                  (Admin click 🌟 để đặt làm Video Hôm Nay)
                </span>
              </div>

              {podcasts.length === 0 ? (
                <div className="bg-white border border-[#E2DBFC] p-10 rounded-[32px] text-center text-xs text-text-minimal/50">
                  Chưa có video TikTok nào. Vui lòng thêm video mới ở biểu mẫu bên cạnh.
                </div>
              ) : (
                <div className="space-y-3.5 max-h-[650px] overflow-y-auto pr-1">
                  {podcasts.map((item) => {
                    const isDailyActive = !!item.isActiveDaily;
                    return (
                      <motion.div
                        key={item.id}
                        layout
                        className={`p-4 rounded-[24px] border transition-all ${
                          isDailyActive
                            ? 'bg-gradient-to-br from-[#FFFDF2] to-[#FFF8E6] border-[#FCD34D] shadow-sm ring-2 ring-[#FBBF24]/30'
                            : 'bg-white border-[#E2DBFC] shadow-2xs hover:border-[#CBD5E1]'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row gap-3.5">
                          {/* Thumbnail / Platform Icon */}
                          <div className="relative w-full sm:w-32 h-24 sm:h-22 rounded-xl overflow-hidden flex-shrink-0 border shadow-2xs bg-black border-slate-800">
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-black text-rose-500">
                              <span className="text-2xl font-black">♪</span>
                              <span className="text-[9px] font-bold text-white tracking-wider mt-0.5">TikTok</span>
                            </div>
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-xs bg-rose-500 text-white">
                                <span className="text-xs font-bold">▶</span>
                              </div>
                            </div>
                            <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-white font-mono text-[9px]">
                              {item.duration || 'TikTok Clip'}
                            </div>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                  {isDailyActive && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white font-black text-[9px] uppercase tracking-wider shadow-2xs">
                                      <Star className="w-2.5 h-2.5 fill-white" /> Video Hôm Nay
                                    </span>
                                  )}
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                    ♪ Video TikTok
                                  </span>
                                </div>
                                <h4 className="font-extrabold text-xs text-text-minimal leading-snug line-clamp-1">
                                  {item.title}
                                </h4>
                              </div>
                            </div>

                            <p className="text-[11px] text-text-minimal/70 line-clamp-2 leading-relaxed italic">
                              "{item.healingMessage || 'Lắng nghe để giải tỏa muộn phiền...'}"
                            </p>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-accent-minimal/50 text-[10px]">
                              <span className="text-text-minimal/40 truncate max-w-[180px]">
                                ID: <code className="text-slate-600 font-bold">{item.videoId || item.youtubeUrl}</code>
                              </span>

                              <div className="flex items-center gap-2">
                                {!isDailyActive && (
                                  <button
                                    onClick={() => handleSetActiveDailyPodcast(item.id, item.title)}
                                    className="px-2.5 py-1 rounded-full bg-[#FFF4D6] hover:bg-[#FFE299] text-[#78350F] border border-[#FDE68A] font-extrabold text-[10px] transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                                    title="Đặt video này làm video mặc định hôm nay cho toàn bộ người dùng"
                                  >
                                    <Star className="w-3 h-3 text-amber-500 fill-amber-400" />
                                    <span>Đặt làm video hôm nay</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => handleStartEditPodcast(item)}
                                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                                  title="Chỉnh sửa"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeletePodcast(item.id, item.title)}
                                  className="p-1.5 rounded-lg bg-rose-50/50 hover:bg-rose-100/80 text-rose-600 hover:text-rose-700 transition-all cursor-pointer active:scale-95 border border-rose-100 hover:border-rose-200 shadow-2xs"
                                  title="Xóa video này"
                                  aria-label={`Xóa video ${item.title}`}
                                  id={`btn-delete-podcast-${item.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: SECURITY SETTINGS TAB FOR NON-ADMIN OR REGULAR USERS */}
      {activeTab === 'security' && (
        <div className="bg-white border border-[#E2DBFC] p-8 rounded-[32px] shadow-xs max-w-lg mx-auto" id="profile-settings-view">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#C8F7DC] text-[#124B31] border border-[#9EE7C0] rounded-2xl flex items-center justify-center shadow-xs">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-text-minimal text-base font-bold">Cập Nhật Mật Khẩu Cá Nhân</h3>
              <p className="text-xs text-text-minimal/50">Thay đổi mật khẩu tài khoản hiện tại</p>
            </div>
          </div>

          {pwdSuccess && (
            <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-150 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{pwdSuccess}</span>
            </div>
          )}

          {pwdError && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-150 text-rose-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{pwdError}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
            <PasswordInput
              label="Mật khẩu hiện tại"
              required
              placeholder="Nhập mật khẩu cũ..."
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              id="user-old-password-input"
            />

            <PasswordInput
              label="Mật khẩu mới"
              required
              placeholder="Tối thiểu 6 ký tự..."
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              id="user-new-password-input"
            />

            <PasswordInput
              label="Xác nhận mật khẩu mới"
              required
              placeholder="Nhập lại mật khẩu mới..."
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              id="user-confirm-password-input"
            />

            <button
              type="submit"
              disabled={pwdLoading}
              className="w-full bg-[#C8F7DC] hover:bg-[#B5F1D0] text-[#124B31] border border-[#9EE7C0] font-extrabold py-3.5 rounded-2xl shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer mt-6"
            >
              {pwdLoading ? <RefreshCw className="w-4 h-4 animate-spin text-[#124B31]" /> : <Lock className="w-4 h-4 text-[#124B31]" />}
              <span>{pwdLoading ? 'Đang cập nhật...' : 'Xác Nhận Đổi Mật Khẩu'}</span>
            </button>
          </form>
        </div>
      )}

      {/* VIEW 4: ANONYMOUS DATA EXPORT TAB */}
      {activeTab === 'export' && isCurrentAdmin && (
        <AdminAnonymousDataExport token={token} />
      )}

      {/* DERS-16 & Activities Detail Modal */}
      <DERS16DetailModal
        user={ders16ModalUser}
        isOpen={!!ders16ModalUser}
        onClose={() => setDers16ModalUser(null)}
      />

      {/* IN-APP PODCAST DELETE CONFIRMATION MODAL */}
      {deletePodcastTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-rose-200 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-150 flex items-center justify-center mx-auto shadow-2xs">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-text-minimal text-base font-bold">Xác Nhận Xóa Video TikTok?</h3>
            <p className="text-text-minimal/60 text-xs leading-relaxed">
              Bạn có chắc chắn muốn xóa video <strong className="text-rose-700 font-semibold">"{deletePodcastTarget.title}"</strong> khỏi thư viện không?
            </p>
            <div className="flex gap-2.5 pt-2">
              <button 
                type="button"
                onClick={() => { if (!isDeletingPodcast) setDeletePodcastTarget(null); }} 
                disabled={isDeletingPodcast}
                className="w-1/2 bg-bg-minimal hover:bg-slate-100 text-text-minimal font-bold text-xs py-2.5 rounded-xl cursor-pointer border border-accent-minimal/40 transition-colors"
              >
                Hủy bỏ
              </button>
              <button 
                type="button"
                disabled={isDeletingPodcast}
                onClick={() => confirmDeletePodcast(deletePodcastTarget.id, deletePodcastTarget.title)} 
                className="w-1/2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer shadow-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                {isDeletingPodcast ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xác nhận xóa</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP TOGGLE ROLE CONFIRMATION MODAL */}
      {toggleRoleTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#E2DBFC] rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-2xs">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-text-minimal text-base font-bold">
              {toggleRoleTarget.role === 'admin' || toggleRoleTarget.role === 'ADMIN' ? 'Hạ Quyền Quản Trị Viên?' : 'Thăng Quyền Quản Trị Viên?'}
            </h3>
            <p className="text-text-minimal/60 text-xs leading-relaxed">
              {toggleRoleTarget.role === 'admin' || toggleRoleTarget.role === 'ADMIN' ? (
                <>Bạn có chắc muốn hạ quyền Quản trị viên của <strong className="text-text-minimal">{toggleRoleTarget.username}</strong> về Người dùng thông thường?</>
              ) : (
                <>Bạn có chắc muốn cấp quyền Quản trị viên (ADMIN) cho <strong className="text-emerald-700">{toggleRoleTarget.username}</strong>?</>
              )}
            </p>
            <div className="flex gap-2.5 pt-2">
              <button 
                type="button"
                onClick={() => setToggleRoleTarget(null)} 
                className="w-1/2 bg-bg-minimal hover:bg-slate-100 text-text-minimal font-bold text-xs py-2.5 rounded-xl cursor-pointer border border-accent-minimal/40 transition-colors"
              >
                Hủy bỏ
              </button>
              <button 
                type="button"
                onClick={() => confirmToggleRole(toggleRoleTarget)} 
                className="w-1/2 bg-[#124B31] hover:bg-[#0E3D28] text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer shadow-xs transition-all"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
