import { create } from "zustand";
import { STORAGE_KEY, loadSettings as loadBgMusicSettings } from "@/features/bg-music/bgMusicSettings";
import type { BgMusicSettings } from "@/features/bg-music/bgMusicSettings";
import type { Track, Playlist } from "@/features/bg-music/types/bgMusic";
import { createPlaybackSlice, type PlaybackSlice } from "@/features/bg-music/stores/createPlaybackSlice";
import { createFadeSlice, type FadeSlice } from "@/features/bg-music/stores/createFadeSlice";
import { createLibrarySlice, type LibrarySlice } from "@/features/bg-music/stores/createLibrarySlice";

export interface BgMusicStore extends PlaybackSlice, FadeSlice, LibrarySlice {
  settings: BgMusicSettings;
}

const audioRef = { current: null as HTMLAudioElement | null };
const objectUrlRef = { current: null as string | null };
const volumeRef = { current: 0.7 };
const isFadedRef = { current: false };
const playingTrackIndexRef = { current: 0 };
const playGenerationRef = { current: 0 };
const fadeTimerRef = { current: null as ReturnType<typeof setInterval> | null };
const watchdogRef = { current: null as ReturnType<typeof setInterval> | null };
const bgMusicInitializedRef = { current: false };

function revokeObjectUrl() {
  if (objectUrlRef.current) {
    URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  }
}

function saveSettings(settings: BgMusicSettings, playingTrackIndex: number) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...settings, currentTrackIndex: playingTrackIndex })
  );
}

function startWatchdog() {
  if (watchdogRef.current !== null) return;
  watchdogRef.current = setInterval(() => {
    if (audioRef.current?.paused) {
      audioRef.current.play().catch(() => {});
    }
  }, 10000);
}

function stopWatchdog() {
  if (watchdogRef.current !== null) {
    clearInterval(watchdogRef.current);
    watchdogRef.current = null;
  }
}

const initialSettings = loadBgMusicSettings();
volumeRef.current = initialSettings.volume;

const ctx = {
  audioRef, objectUrlRef, volumeRef, isFadedRef,
  playingTrackIndexRef, playGenerationRef,
  bgMusicInitializedRef, fadeTimerRef,
  revokeObjectUrl, saveSettings, startWatchdog, stopWatchdog,
};

export const useBgMusicStore = create<BgMusicStore>((set, get) => ({
  settings: initialSettings,
  ...createPlaybackSlice(set, get, ctx, initialSettings),
  ...createFadeSlice({ audioRef, volumeRef, isFadedRef, fadeTimerRef }),
  ...createLibrarySlice(set, get, ctx),
}));

export function selectBgMusicCurrentPlaylist(state: BgMusicStore): Playlist | null {
  return state.settings.playlists.find((p) => p.id === state.playingPlaylistId) ?? null;
}

export function selectBgMusicCurrentTrack(state: BgMusicStore): Track | null {
  const { settings, playingPlaylistId, playingTrackIndex } = state;
  const playlist = settings.playlists.find((p) => p.id === playingPlaylistId) ?? null;
  if (playlist) {
    return settings.trackMeta.find((t) => t.id === playlist.trackIds[playingTrackIndex]) ?? null;
  }
  return playingPlaylistId === null ? (settings.trackMeta[playingTrackIndex] ?? null) : null;
}

export function resetBgMusicStore() {
  bgMusicInitializedRef.current = false;
  isFadedRef.current = false;
  playingTrackIndexRef.current = 0;
  playGenerationRef.current = 0;
  volumeRef.current = 0.7;
  useBgMusicStore.getState().stopInternal();
  useBgMusicStore.getState().clearFadeTimer();
  useBgMusicStore.setState({
    settings: { playlists: [], trackMeta: [], currentPlaylistId: null, currentTrackIndex: 0, autoplay: false, volume: 0.7, loopAll: false },
    isPlaying: false,
    playingPlaylistId: null,
    playingTrackIndex: 0,
    progress: { current: 0, duration: 0 },
  });
}
