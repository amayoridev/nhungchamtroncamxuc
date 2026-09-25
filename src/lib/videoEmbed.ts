/**
 * Video Embed & Extraction Helper for TikTok & YouTube.
 */

export type VideoPlatform = 'tiktok' | 'youtube' | 'generic' | 'none';

export interface ParsedVideoInfo {
  platform: VideoPlatform;
  videoId: string;
  originalUrl: string;
  embedUrl: string;
  isValid: boolean;
}

/**
 * Extracts TikTok video ID from full URL, short link, embed code, or raw ID.
 */
export function extractTikTokVideoId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();

  // 1. Raw numeric ID (TikTok video IDs are usually 15-22 digits)
  if (/^\d{15,22}$/.test(trimmed)) {
    return trimmed;
  }

  // 2. Standard TikTok Web URL: https://www.tiktok.com/@username/video/7123456789012345678
  const standardMatch = trimmed.match(/\/video\/(\d{15,22})/i);
  if (standardMatch && standardMatch[1]) {
    return standardMatch[1];
  }

  // 3. TikTok Mobile URL: https://m.tiktok.com/v/7123456789012345678.html
  const mobileMatch = trimmed.match(/\/v\/(\d{15,22})/i);
  if (mobileMatch && mobileMatch[1]) {
    return mobileMatch[1];
  }

  // 4. TikTok Embed URL: https://www.tiktok.com/embed/v2/7123456789012345678 or /embed/7123456789012345678
  const embedMatch = trimmed.match(/\/embed\/(?:v2\/)?(\d{15,22})/i);
  if (embedMatch && embedMatch[1]) {
    return embedMatch[1];
  }

  // 5. HTML Embed Snippet (cite or data-video-id in blockquote)
  const dataIdMatch = trimmed.match(/data-video-id=["'](\d{15,22})["']/i);
  if (dataIdMatch && dataIdMatch[1]) {
    return dataIdMatch[1];
  }

  const citeMatch = trimmed.match(/cite=["'][^"']*\/video\/(\d{15,22})[^"']*["']/i);
  if (citeMatch && citeMatch[1]) {
    return citeMatch[1];
  }

  const iframeMatch = trimmed.match(/src=["'][^"']*tiktok\.com\/embed\/(?:v2\/)?(\d{15,22})[^"']*["']/i);
  if (iframeMatch && iframeMatch[1]) {
    return iframeMatch[1];
  }

  // 6. Generic digits in string if it looks like a TikTok link
  if (trimmed.toLowerCase().includes('tiktok.com')) {
    const genericDigits = trimmed.match(/\b(\d{18,20})\b/);
    if (genericDigits && genericDigits[1]) {
      return genericDigits[1];
    }
  }

  return '';
}

/**
 * Extracts YouTube video ID from URL or 11-char ID.
 */
export function extractYouTubeId(urlOrId: string): string {
  if (!urlOrId) return '';
  const trimmed = urlOrId.trim();

  // If already 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = trimmed.match(regExp);
  if (match && match[2] && match[2].length === 11) {
    return match[2];
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.includes('youtu.be')) {
      const pathId = parsed.pathname.replace('/', '');
      if (pathId.length === 11) return pathId;
    }
    const vParam = parsed.searchParams.get('v');
    if (vParam && vParam.length === 11) return vParam;
  } catch (e) {}

  return '';
}

/**
 * Detects the platform and extracts video info.
 */
export function parseVideoUrl(input: string): ParsedVideoInfo {
  if (!input) {
    return { platform: 'none', videoId: '', originalUrl: '', embedUrl: '', isValid: false };
  }

  const trimmed = input.trim();

  // Check TikTok first
  const isTikTokDomain = /tiktok\.com/i.test(trimmed);
  const tikTokId = extractTikTokVideoId(trimmed);
  if (tikTokId || isTikTokDomain) {
    const videoId = tikTokId;
    const embedUrl = videoId ? `https://www.tiktok.com/embed/v2/${videoId}` : trimmed;
    return {
      platform: 'tiktok',
      videoId,
      originalUrl: trimmed,
      embedUrl,
      isValid: !!videoId || isTikTokDomain
    };
  }

  // Check YouTube
  const isYouTubeDomain = /youtube\.com|youtu\.be/i.test(trimmed);
  const ytId = extractYouTubeId(trimmed);
  if (ytId || isYouTubeDomain) {
    const videoId = ytId;
    const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&rel=0` : trimmed;
    return {
      platform: 'youtube',
      videoId,
      originalUrl: trimmed,
      embedUrl,
      isValid: !!videoId
    };
  }

  // If starts with http and looks like a video URL
  if (/^https?:\/\//i.test(trimmed)) {
    return {
      platform: 'generic',
      videoId: '',
      originalUrl: trimmed,
      embedUrl: trimmed,
      isValid: true
    };
  }

  return { platform: 'none', videoId: '', originalUrl: trimmed, embedUrl: '', isValid: false };
}
