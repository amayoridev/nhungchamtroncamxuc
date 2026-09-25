import { DERS16Assessment } from './lib/ders16';

export type EmotionType = 'vui_ve' | 'binh_yen' | 'met_moi' | 'buon_ba' | 'lo_lang' | 'co_don' | 'tuc_gian';

export interface EmotionInfo {
  type: EmotionType;
  label: string;
  emoji: string;
  color: string; // pastel background class
  border: string; // border color class
  text: string; // text color class
}

export const EMOTIONS: Record<EmotionType, EmotionInfo> = {
  vui_ve: { type: 'vui_ve', label: 'Vui vẻ', emoji: '😊', color: 'bg-[#C2D772]/70 hover:bg-[#C2D772]', border: 'border-[#A8BD55]', text: 'text-[#2B4212]' },
  binh_yen: { type: 'binh_yen', label: 'Bình yên', emoji: '😌', color: 'bg-[#F6FFD3] hover:bg-[#EEFAAA]', border: 'border-[#DDEB8B]', text: 'text-[#384E18]' },
  met_moi: { type: 'met_moi', label: 'Mệt mỏi', emoji: '😪', color: 'bg-stone-100 hover:bg-stone-200', border: 'border-stone-300', text: 'text-stone-700' },
  buon_ba: { type: 'buon_ba', label: 'Buồn bã', emoji: '😢', color: 'bg-[#F6DBE2]/80 hover:bg-[#F6DBE2]', border: 'border-[#E4B5C1]', text: 'text-[#7A2432]' },
  lo_lang: { type: 'lo_lang', label: 'Lo lắng', emoji: '😰', color: 'bg-[#F6C5C1]/80 hover:bg-[#F6C5C1]', border: 'border-[#E59E98]', text: 'text-[#78272B]' },
  co_don: { type: 'co_don', label: 'Cô đơn', emoji: '🥺', color: 'bg-[#FAF0D8] hover:bg-[#F5E2B8]', border: 'border-[#E2C78E]', text: 'text-[#5C3D10]' },
  tuc_gian: { type: 'tuc_gian', label: 'Tức giận', emoji: '😡', color: 'bg-[#F8AEA7]/80 hover:bg-[#F8AEA7]', border: 'border-[#E68880]', text: 'text-[#61161A]' },
};

export interface UserProfile {
  id?: string;
  _id?: string;
  username: string;
  email: string;
  role?: string;
  avatar?: string;
  motto?: string;
  circleCode?: string;
  streak?: number;
  circlePoints?: number;
  emotionalCircles?: number;
  stars?: number;
  isLocked?: boolean;
  createdAt?: string;
  journalCount?: number;
  peaceScore?: number;
  lastActive?: string;
  lastActiveDate?: string;
  isActiveToday?: boolean;
  status?: string;
  diaries?: JournalEntry[];
  appData?: Record<string, any>;
  ders16?: DERS16Assessment;
}

export type { DERS16Assessment };

export type CompanionMode = 'chi_dan_lang_nghe' | 'goc_nhin_khac' | 'goi_y_bai_hoc' | 'loi_khuyen_nho';

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  emotion: EmotionType;
  text: string;
  isFavorite: boolean;
  companionMode?: CompanionMode;
  voiceUrl?: string;
  photoUrl?: string;
  videoUrl?: string;
  videoPlatform?: 'tiktok' | 'youtube' | 'generic';
  videoId?: string;
  aiInsight?: {
    reflection: string;
    reassurance: string;
    lessonId: string;
    suggestion: string;
    quote: string;
  };
}

export interface WaterLog {
  glasses: number;
  goal: number;
  streak: number;
  lastUpdated: string;
}

export interface GratitudeCard {
  id: string;
  text1: string;
  text2: string;
  text3: string;
  date: string;
}

export interface ReadingSession {
  id: string;
  date: string;
  bookTitle: string;
  durationMinutes: number;
  quote?: string;
}

export interface ConnectionChallenge {
  id: string;
  title: string;
  isCompleted: boolean;
  streakAdded: boolean;
}

export interface Lesson {
  id: string;
  title: string;
  category: 'hieu_chinh_minh' | 'gia_dinh' | 'ban_be' | 'giao_tiep' | 'chua_lanh';
  readingTime: string;
  intro: string;
  explanation: string;
  example: string;
  action: string;
  takeaway: string;
  isFavorite?: boolean;
  isCompleted?: boolean;
}

export interface FriendProfile {
  id: string; // Mã Chấm Tròn
  userId?: string;
  circleCode?: string;
  name: string;
  avatar: string;
  bio: string;
  favoriteQuote: string;
  streak: number;
  emotionalCircles: number;
  treeLevel: number;
  favoriteEmotion: EmotionType;
}

export interface EncouragementCard {
  id: string;
  title: string;
  content: string;
  emoji: string;
}

export interface CompanionRequest {
  id: string;
  fromId: string;
  fromName: string;
  fromAvatar: string;
  fromCircleCode?: string;
  toId: string;
  toName?: string;
  status: 'pending' | 'accepted' | 'declined';
  date: string;
}

export interface SweetCard {
  id: string;
  cardTitle: string;
  message: string;
  emoji: string;
  senderName: string;
  senderCode: string;
  senderUserId?: string;
  senderAvatar: string;
  timestamp: string;
  isRead: boolean;
}

export interface PodcastItem {
  id: string;
  title: string;
  youtubeUrl: string;
  videoId: string;
  platform?: 'youtube' | 'tiktok';
  duration: string;
  healingMessage: string;
  isActiveDaily?: boolean;
  author?: string;
  createdAt: string;
}

export interface AnonymousDERS16Item {
  id: number;
  question: string;
  subscale: string;
  subscaleName: string;
  score: number;
  scaleLabel: string;
}

export interface AnonymousDERS16Summary {
  totalScore: number;
  maxScore: number;
  percentage: number;
  level: string;
  summary: string;
  assessedAt: string;
  subscales: {
    clarity: { score: number; maxScore: number; level: string; percentage: number };
    goals: { score: number; maxScore: number; level: string; percentage: number };
    impulse: { score: number; maxScore: number; level: string; percentage: number };
    nonacceptance: { score: number; maxScore: number; level: string; percentage: number };
    strategies: { score: number; maxScore: number; level: string; percentage: number };
  };
  answers: AnonymousDERS16Item[];
}

export interface AnonymousUserSubject {
  mongoId: string; // The primary name/ID in MongoDB
  subjectCode?: string;
  peaceScore: number;
  streakDays: number;
  circlePoints: number;
  starsCount: number;
  registeredDate?: string;
  lastActiveDate?: string;
  isActiveToday: boolean;
  ders16?: AnonymousDERS16Summary;
  activities: {
    waterLog: {
      glassesConsumed: number;
      dailyGoal: number;
      streak: number;
      lastUpdated?: string;
    };
    readingSessions: {
      totalSessions: number;
      totalMinutes: number;
      sessions: Array<{
        bookTitle: string;
        durationMinutes: number;
        quote?: string;
        date: string;
      }>;
    };
    gratitudeCards: {
      totalCards: number;
      cards: Array<{
        date: string;
        items: string[];
      }>;
    };
    pairChallenges: {
      totalChallenges: number;
      completedCount: number;
      challenges: Array<{
        id: string;
        title: string;
        complete: boolean;
      }>;
    };
    journals: {
      totalEntries: number;
      emotionCounts: Record<string, number>;
      entries: Array<{
        journalId: string;
        date: string;
        time: string;
        emotion: string;
        contentLength: number;
        wordCount: number;
        textSnippet: string;
        hasAiInsight: boolean;
      }>;
    };
  };
}

export interface AnonymousDataExportResponse {
  exportedAt: string;
  anonymizationStandard: string;
  totalSubjects: number;
  overview: {
    averageDers16Score: number;
    averagePeaceScore: number;
    averageWaterGlasses: number;
    totalReadingMinutes: number;
    totalGratitudeCards: number;
    totalJournals: number;
    subscaleAverages: {
      clarity: number;
      goals: number;
      impulse: number;
      nonacceptance: number;
      strategies: number;
    };
    emotionDistribution: Record<string, number>;
  };
  subjects: AnonymousUserSubject[];
}
