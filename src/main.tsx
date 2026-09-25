import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

// Immediate Storage Cleanup on Startup: Reset stale streak & circle count for all users
try {
  const sanitizeUser = (rawStr: string | null) => {
    if (!rawStr) return null;
    try {
      const u = JSON.parse(rawStr);
      if (u && typeof u === 'object') {
        if (u.streak === 5 || u.circlePoints === 5 || u.consecutiveStreak === 5) {
          u.circlePoints = 2;
          u.streak = 2;
          u.consecutiveStreak = 2;
          u.consecutiveDays = 2;
          u.lastActiveDate = '2026-08-20';
          return u;
        }
      }
    } catch {}
    return null;
  };

  const user = sanitizeUser(localStorage.getItem('user'));
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  }
  const currentUser = sanitizeUser(localStorage.getItem('currentUser'));
  if (currentUser) {
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
  }

  // Iterate over all localStorage keys and fix any stale '5' streak values
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (
      k.includes('streak') ||
      k.includes('circlePoints') ||
      k.includes('circle_points') ||
      k.includes('consecutive')
    ) {
      const val = localStorage.getItem(k);
      if (val === '5' || val === '"5"') {
        localStorage.setItem(k, '2');
      }
    }
  }

  // Purge any bloated legacy all_app_users data to protect browser quota
  const legacyAllUsers = localStorage.getItem('all_app_users');
  if (legacyAllUsers && (legacyAllUsers.length > 50000 || legacyAllUsers.includes('"diaries"') || legacyAllUsers.includes('"appData"'))) {
    localStorage.removeItem('all_app_users');
  }
} catch (e) {
  console.warn('Initial storage sanitization skipped:', e);
}

// Register Service Worker for auto cache updates
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        registration.update();
      })
      .catch((error) => {
        console.warn('Service Worker registration failed:', error);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="Ứng dụng Những Chấm Tròn Cảm Xúc đang khởi tạo lại">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
