import type { Track, Playlist } from "@/features/bg-music/types/bgMusic";

export const STORAGE_KEY = "bg-music-settings";

export interface BgMusicSettings {
  playlists: Playlist[];
  trackMeta: Track[];
  currentPlaylistId: string | null;
  currentTrackIndex: number;
  autoplay: boolean;
  volume: number;
  loopAll: boolean;
}

export function defaultSettings(): BgMusicSettings {
  return {
    playlists: [],
    trackMeta: [],
    currentPlaylistId: null,
    currentTrackIndex: 0,
    autoplay: false,
    volume: 0.7,
    loopAll: false,
  };
}

export function loadSettings(): BgMusicSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...defaultSettings(), ...JSON.parse(saved) };
  } catch {}
  return defaultSettings();
}
