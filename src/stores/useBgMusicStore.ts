import { create } from "zustand";
import type { Track, Playlist } from "@/features/bg-music/types/bgMusic";
import type { BgMusicSettings } from "@/features/bg-music/bgMusicSettings";
import {
  STORAGE_KEY,
  loadSettings as loadBgMusicSettings,
} from "@/features/bg-music/bgMusicSettings";
import { getTrackBlob, saveTrackBlob, deleteTrackBlob, requestPersistentStorage } from "@/db/trackStorage";
import { stripExtension } from "@/utils";

// ─── Module-level mutable refs (not reactive) ────────────────────────────────
const audioRef = { current: null as HTMLAudioElement | null };
const objectUrlRef = { current: null as string | null };
const volumeRef = { current: 0.7 };
const isFadedRef = { current: false };
const playingTrackIndexRef = { current: 0 };
const playGenerationRef = { current: 0 };
const fadeTimerRef = { current: null as ReturnType<typeof setInterval> | null };
let watchdogInterval: ReturnType<typeof setInterval> | null = null;
let bgMusicInitialized = false;

const FADE_DURATION_MS = 1500;
const FADE_STEPS = 30;

// ─── Store interface ──────────────────────────────────────────────────────────
interface BgMusicStore {
  settings: BgMusicSettings;
  isPlaying: boolean;
  playingPlaylistId: string | null;
  playingTrackIndex: number;
  progress: { current: number; duration: number };
  // Playback actions
  play: (index?: number) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  stopInternal: () => void;
  setVolume: (v: number) => void;
  setAutoplay: (v: boolean) => void;
  fadeOut: () => void;
  fadeIn: () => void;
  clearFadeTimer: () => void;
  // Library actions
  addTrack: (file: File, playlistId?: string, onProgress?: (progress: number) => void) => Promise<void>;
  removeTrack: (trackId: string) => Promise<void>;
  createPlaylist: (name: string) => void;
  deletePlaylist: (id: string) => void;
  setCurrentPlaylist: (id: string | null) => void;
  addTrackToPlaylist: (playlistId: string, trackId: string) => void;
  setLoop: (playlistId: string | null, loop: boolean) => void;
  removeTrackFromPlaylist: (playlistId: string, index: number) => void;
  setPlaylistTracks: (playlistId: string | null, trackIds: string[]) => void;
  reorderTrack: (playlistId: string | null, fromIndex: number, toIndex: number) => void;
  // Init (call once on app mount)
  init: () => void;
}

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
  if (watchdogInterval !== null) return;
  watchdogInterval = setInterval(() => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play().catch(() => {});
    }
  }, 10000);
}

function stopWatchdog() {
  if (watchdogInterval !== null) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }
}

const initialSettings = loadBgMusicSettings();
volumeRef.current = initialSettings.volume;

export const useBgMusicStore = create<BgMusicStore>((set, get) => {
  // ─── Internal helpers ─────────────────────────────────────────────────────

  const stopInternal = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.ontimeupdate = null;
      audioRef.current.onloadedmetadata = null;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    revokeObjectUrl();
    stopWatchdog();
    set({ isPlaying: false, progress: { current: 0, duration: 0 } });
  };

  const playAtIndex = async (index: number, playlistIdOverride?: string | null) => {
    const generation = ++playGenerationRef.current;
    const state = get();
    const targetPlaylistId = playlistIdOverride !== undefined ? playlistIdOverride : state.playingPlaylistId;
    const s = state.settings;
    const playlist = targetPlaylistId === null
      ? null
      : s.playlists.find((p) => p.id === targetPlaylistId) ?? null;

    const trackIds = playlist ? playlist.trackIds : s.trackMeta.map((t) => t.id);
    if (trackIds.length === 0) return;

    const trackId = trackIds[index];
    if (!trackId) return;

    stopInternal();

    const blob = await getTrackBlob(trackId);
    if (!blob || generation !== playGenerationRef.current) return;

    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;

    const audio = new Audio(url);
    audio.volume = isFadedRef.current ? 0 : volumeRef.current;
    audioRef.current = audio;

    audio.ontimeupdate = () => {
      set({ progress: { current: audio.currentTime, duration: audio.duration || 0 } });
    };
    audio.onloadedmetadata = () => {
      set({ progress: { current: 0, duration: audio.duration || 0 } });
    };

    set({
      playingPlaylistId: targetPlaylistId,
      playingTrackIndex: index,
    });
    playingTrackIndexRef.current = index;

    audio.onended = () => {
      const sCurrent = get().settings;
      const pl = targetPlaylistId === null
        ? null
        : sCurrent.playlists.find((p) => p.id === targetPlaylistId) ?? null;

      const currentTrackIds = pl ? pl.trackIds : sCurrent.trackMeta.map((t) => t.id);
      const nextIndex = index + 1;

      if (nextIndex < currentTrackIds.length) {
        playAtIndex(nextIndex, targetPlaylistId);
      } else if (pl ? pl.loop : sCurrent.loopAll) {
        playAtIndex(0, targetPlaylistId);
      } else {
        stopWatchdog();
        set({ isPlaying: false });
        audioRef.current = null;
        revokeObjectUrl();
      }
    };

    audio.onerror = () => {
      stopWatchdog();
      set({ isPlaying: false });
      audioRef.current = null;
      revokeObjectUrl();
    };

    audio.play().then(() => {
      set({ isPlaying: true });
      startWatchdog();
    }).catch(() => {
      stopWatchdog();
      set({ isPlaying: false });
      audioRef.current = null;
      revokeObjectUrl();
    });
  };

  const clearFadeTimer = () => {
    if (fadeTimerRef.current !== null) {
      clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  };

  const updateSettings = (updater: (prev: BgMusicSettings) => BgMusicSettings) => {
    const newSettings = updater(get().settings);
    set({ settings: newSettings });
    saveSettings(newSettings, get().playingTrackIndex);
    return newSettings;
  };

  return {
    settings: initialSettings,
    isPlaying: false,
    playingPlaylistId: initialSettings.currentPlaylistId,
    playingTrackIndex: initialSettings.currentTrackIndex,
    progress: { current: 0, duration: 0 },

    stopInternal,

    play: (index?: number) => {
      const state = get();
      if (index !== undefined) {
        playAtIndex(index, state.settings.currentPlaylistId);
      } else {
        playAtIndex(playingTrackIndexRef.current, state.playingPlaylistId);
      }
    },

    togglePlay: () => {
      const state = get();
      if (state.isPlaying) {
        if (audioRef.current) {
          audioRef.current.pause();
          stopWatchdog();
          set({ isPlaying: false });
        }
      } else if (audioRef.current) {
        audioRef.current.play().then(() => {
          set({ isPlaying: true });
          startWatchdog();
        }).catch(() => {});
      } else {
        get().play();
      }
    },

    next: () => {
      const state = get();
      const s = state.settings;
      const pl = state.playingPlaylistId === null
        ? null
        : s.playlists.find((p) => p.id === state.playingPlaylistId) ?? null;

      const trackIds = pl ? pl.trackIds : s.trackMeta.map((t) => t.id);
      if (trackIds.length === 0) return;

      const nextIndex = (playingTrackIndexRef.current + 1) % trackIds.length;
      playAtIndex(nextIndex, state.playingPlaylistId);
    },

    prev: () => {
      const state = get();
      const s = state.settings;
      const pl = state.playingPlaylistId === null
        ? null
        : s.playlists.find((p) => p.id === state.playingPlaylistId) ?? null;

      const trackIds = pl ? pl.trackIds : s.trackMeta.map((t) => t.id);
      if (trackIds.length === 0) return;

      const prevIndex = (playingTrackIndexRef.current - 1 + trackIds.length) % trackIds.length;
      playAtIndex(prevIndex, state.playingPlaylistId);
    },

    seek: (time) => {
      if (audioRef.current) audioRef.current.currentTime = time;
      set((state) => ({ progress: { ...state.progress, current: time } }));
    },

    setVolume: (v) => {
      volumeRef.current = v;
      if (audioRef.current && !isFadedRef.current) {
        audioRef.current.volume = v;
      }
      updateSettings((prev) => ({ ...prev, volume: v }));
    },

    setAutoplay: (v) => {
      updateSettings((prev) => ({ ...prev, autoplay: v }));
    },

    clearFadeTimer,

    fadeOut: () => {
      if (isFadedRef.current) return;
      isFadedRef.current = true;
      if (!audioRef.current) return;
      clearFadeTimer();
      const audio = audioRef.current;
      const startVol = audio.volume;
      const delta = startVol / FADE_STEPS;
      const stepTime = FADE_DURATION_MS / FADE_STEPS;
      fadeTimerRef.current = setInterval(() => {
        if (!audio || audio !== audioRef.current) {
          clearFadeTimer();
          return;
        }
        const newVol = Math.max(0, audio.volume - delta);
        audio.volume = newVol;
        if (newVol <= 0) clearFadeTimer();
      }, stepTime);
    },

    fadeIn: () => {
      if (!isFadedRef.current) return;
      isFadedRef.current = false;
      if (!audioRef.current) return;
      clearFadeTimer();
      const audio = audioRef.current;
      const targetVol = volumeRef.current;
      const delta = targetVol / FADE_STEPS;
      const stepTime = FADE_DURATION_MS / FADE_STEPS;
      fadeTimerRef.current = setInterval(() => {
        if (!audio || audio !== audioRef.current) {
          clearFadeTimer();
          return;
        }
        const newVol = Math.min(targetVol, audio.volume + delta);
        audio.volume = newVol;
        if (newVol >= targetVol) clearFadeTimer();
      }, stepTime);
    },

    // ─── Library ─────────────────────────────────────────────────────────────

    addTrack: async (file, playlistId, onProgress) => {
      const id = `track-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const name = stripExtension(file.name);

      await new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress?.(Math.round((e.loaded / e.total) * 75));
          }
        };
        reader.onload = () => { onProgress?.(80); resolve(); };
        reader.onerror = () => reject(reader.error ?? new Error("파일 읽기 실패"));
        reader.readAsArrayBuffer(file);
      });

      onProgress?.(90);
      await saveTrackBlob(id, file);
      onProgress?.(100);

      updateSettings((prev) => {
        const newTrack: Track = { id, name };
        const newPlaylists = playlistId
          ? prev.playlists.map((p) =>
              p.id === playlistId ? { ...p, trackIds: [...p.trackIds, id] } : p
            )
          : prev.playlists;
        return { ...prev, trackMeta: [...prev.trackMeta, newTrack], playlists: newPlaylists };
      });
    },

    removeTrack: async (trackId) => {
      await deleteTrackBlob(trackId);
      const state = get();
      const pl = state.playingPlaylistId === null
        ? null
        : state.settings.playlists.find((p) => p.id === state.playingPlaylistId) ?? null;

      const trackIds = pl ? pl.trackIds : state.settings.trackMeta.map((t) => t.id);
      const currentTrackId = trackIds[playingTrackIndexRef.current];
      if (currentTrackId === trackId) stopInternal();

      updateSettings((prev) => ({
        ...prev,
        trackMeta: prev.trackMeta.filter((t) => t.id !== trackId),
        playlists: prev.playlists.map((p) => ({
          ...p,
          trackIds: p.trackIds.filter((id) => id !== trackId),
        })),
      }));
    },

    createPlaylist: (name) => {
      const id = `playlist-${Date.now()}`;
      updateSettings((prev) => ({
        ...prev,
        playlists: [...prev.playlists, { id, name, trackIds: [], loop: false }],
        currentPlaylistId: prev.currentPlaylistId ?? id,
      }));
    },

    deletePlaylist: (id) => {
      const state = get();
      if (state.settings.currentPlaylistId === id) stopInternal();
      updateSettings((prev) => {
        const remaining = prev.playlists.filter((p) => p.id !== id);
        const newCurrentId = prev.currentPlaylistId === id
          ? (remaining[0]?.id ?? null)
          : prev.currentPlaylistId;
        return { ...prev, playlists: remaining, currentPlaylistId: newCurrentId };
      });
    },

    setCurrentPlaylist: (id) => {
      updateSettings((prev) => ({ ...prev, currentPlaylistId: id }));
    },

    addTrackToPlaylist: (playlistId, trackId) => {
      updateSettings((prev) => ({
        ...prev,
        playlists: prev.playlists.map((p) =>
          p.id === playlistId ? { ...p, trackIds: [...p.trackIds, trackId] } : p
        ),
      }));
    },

    setLoop: (playlistId, loop) => {
      updateSettings((prev) => {
        if (playlistId === null) return { ...prev, loopAll: loop };
        return {
          ...prev,
          playlists: prev.playlists.map((p) => (p.id === playlistId ? { ...p, loop } : p)),
        };
      });
    },

    removeTrackFromPlaylist: (playlistId, index) => {
      const state = get();
      const targetPlaylist = state.settings.playlists.find((p) => p.id === playlistId);
      if (!targetPlaylist) return;

      if (playlistId === state.playingPlaylistId && playingTrackIndexRef.current === index) {
        stopInternal();
      }

      updateSettings((prev) => ({
        ...prev,
        playlists: prev.playlists.map((p) => {
          if (p.id !== playlistId) return p;
          const newTrackIds = [...p.trackIds];
          newTrackIds.splice(index, 1);
          return { ...p, trackIds: newTrackIds };
        }),
      }));
    },

    setPlaylistTracks: (playlistId, trackIds) => {
      updateSettings((prev) => {
        if (playlistId === null) {
          const newTrackMeta = trackIds
            .map((id) => prev.trackMeta.find((t) => t.id === id))
            .filter((t): t is Track => !!t);
          return { ...prev, trackMeta: newTrackMeta };
        }
        return {
          ...prev,
          playlists: prev.playlists.map((p) =>
            p.id === playlistId ? { ...p, trackIds: [...trackIds] } : p
          ),
        };
      });
    },

    reorderTrack: (playlistId, fromIndex, toIndex) => {
      updateSettings((prev) => {
        if (playlistId === null) {
          const ids = [...prev.trackMeta];
          const [removed] = ids.splice(fromIndex, 1);
          ids.splice(toIndex, 0, removed);
          return { ...prev, trackMeta: ids };
        }
        return {
          ...prev,
          playlists: prev.playlists.map((p) => {
            if (p.id !== playlistId) return p;
            const ids = [...p.trackIds];
            const [removed] = ids.splice(fromIndex, 1);
            ids.splice(toIndex, 0, removed);
            return { ...p, trackIds: ids };
          }),
        };
      });
    },

    init: () => {
      if (bgMusicInitialized) return;
      bgMusicInitialized = true;

      requestPersistentStorage();

      const s = get().settings;
      if (!s.autoplay) return;
      if (s.currentPlaylistId) {
        const playlist = s.playlists.find((p) => p.id === s.currentPlaylistId);
        if (playlist && playlist.trackIds.length > 0) {
          const idx = Math.min(s.currentTrackIndex, playlist.trackIds.length - 1);
          playAtIndex(idx, s.currentPlaylistId);
        }
      } else if (s.trackMeta.length > 0) {
        const idx = Math.min(s.currentTrackIndex, s.trackMeta.length - 1);
        playAtIndex(idx, null);
      }
    },
  };
});

// ─── Selector helpers ─────────────────────────────────────────────────────────

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
  bgMusicInitialized = false;
  useBgMusicStore.getState().stopInternal();
  useBgMusicStore.getState().clearFadeTimer();
  isFadedRef.current = false;
  playingTrackIndexRef.current = 0;
  playGenerationRef.current = 0;
  volumeRef.current = 0.7;
  useBgMusicStore.setState({
    settings: { playlists: [], trackMeta: [], currentPlaylistId: null, currentTrackIndex: 0, autoplay: false, volume: 0.7, loopAll: false },
    isPlaying: false,
    playingPlaylistId: null,
    playingTrackIndex: 0,
    progress: { current: 0, duration: 0 },
  });
}
