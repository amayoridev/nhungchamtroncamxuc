import { PodcastItem } from '../types';
import { extractYouTubeId, extractTikTokVideoId, parseVideoUrl } from './videoEmbed';

export { extractYouTubeId, extractTikTokVideoId, parseVideoUrl };

// Absolute NO sample seed dummy data
export const DEFAULT_PODCASTS: PodcastItem[] = [];

const LOCAL_STORAGE_PODCASTS_KEY = 'custom_podcasts_list';
const LOCAL_STORAGE_ACTIVE_PODCAST_KEY = 'active_daily_podcast_id';

export function getLocalPodcasts(): PodcastItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PODCASTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {}
  return [];
}

export function saveLocalPodcasts(podcasts: PodcastItem[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_PODCASTS_KEY, JSON.stringify(podcasts));
    window.dispatchEvent(new Event('daily-podcast-updated'));
  } catch (e) {}
}

export function getActiveDailyPodcast(): PodcastItem | null {
  const podcasts = getLocalPodcasts();
  if (podcasts.length === 0) return null;

  try {
    const activeId = localStorage.getItem(LOCAL_STORAGE_ACTIVE_PODCAST_KEY);
    if (activeId) {
      const found = podcasts.find(p => p.id === activeId);
      if (found) return found;
    }
  } catch (e) {}
  
  const explicitlyActive = podcasts.find(p => p.isActiveDaily);
  if (explicitlyActive) return explicitlyActive;
  
  return podcasts[0] || null;
}

export function setActiveDailyPodcastLocal(podcastId: string) {
  const podcasts = getLocalPodcasts();
  const updated = podcasts.map(p => ({
    ...p,
    isActiveDaily: p.id === podcastId
  }));
  saveLocalPodcasts(updated);
  try {
    localStorage.setItem(LOCAL_STORAGE_ACTIVE_PODCAST_KEY, podcastId);
  } catch (e) {}
  window.dispatchEvent(new Event('daily-podcast-updated'));
}

export async function syncPodcastsFromServer(): Promise<{ podcasts: PodcastItem[]; daily: PodcastItem | null }> {
  try {
    const res = await fetch('/api/podcasts');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.podcasts)) {
        saveLocalPodcasts(data.podcasts);
        const daily = data.podcasts.find((p: PodcastItem) => p.isActiveDaily) || data.podcasts[0] || null;
        if (daily) {
          try {
            localStorage.setItem(LOCAL_STORAGE_ACTIVE_PODCAST_KEY, daily.id);
          } catch (e) {}
        }
        return { podcasts: data.podcasts, daily };
      }
    }
  } catch (e) {
    console.warn("Could not sync podcasts from server:", e);
  }
  const local = getLocalPodcasts();
  return { podcasts: local, daily: getActiveDailyPodcast() };
}
