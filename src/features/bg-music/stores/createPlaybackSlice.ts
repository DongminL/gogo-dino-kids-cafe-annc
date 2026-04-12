import { getTrackBlob, requestPersistentStorage } from "@/db/trackStorage";
import type { BgMusicSettings } from "@/features/bg-music/bgMusicSettings";

type PlaybackCtx = {
  audioRef: { current: HTMLAudioElement | null };
  objectUrlRef: { current: string | null };
  volumeRef: { current: number };
  isFadedRef: { current: boolean };
  playingTrackIndexRef: { current: number };
  playGenerationRef: { current: number };
  bgMusicInitializedRef: { current: boolean };
  revokeObjectUrl: () => void;
  saveSettings: (settings: BgMusicSettings, index: number) => void;
  startWatchdog: () => void;
  stopWatchdog: () => void;
};

type PlaybackGet = () => {
  settings: BgMusicSettings;
  playingPlaylistId: string | null;
  playingTrackIndex: number;
  isPlaying: boolean;
  play: () => void;
};

type PlaybackSet = (partial: any) => void;

export interface PlaybackSlice {
  isPlaying: boolean;
  playingPlaylistId: string | null;
  playingTrackIndex: number;
  progress: { current: number; duration: number };
  play: (index?: number) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  stopInternal: () => void;
  setVolume: (v: number) => void;
  setAutoplay: (v: boolean) => void;
  init: () => void;
}

export function createPlaybackSlice(
  set: PlaybackSet,
  get: PlaybackGet,
  ctx: PlaybackCtx,
  initialSettings: BgMusicSettings,
): PlaybackSlice {
  const updateSettings = (updater: (prev: BgMusicSettings) => BgMusicSettings) => {
    const newSettings = updater(get().settings);
    set({ settings: newSettings });
    ctx.saveSettings(newSettings, get().playingTrackIndex);
    return newSettings;
  };

  const stopInternal = () => {
    if (ctx.audioRef.current) {
      ctx.audioRef.current.pause();
      ctx.audioRef.current.ontimeupdate = null;
      ctx.audioRef.current.onloadedmetadata = null;
      ctx.audioRef.current.onended = null;
      ctx.audioRef.current.onerror = null;
      ctx.audioRef.current = null;
    }
    ctx.revokeObjectUrl();
    ctx.stopWatchdog();
    set({ isPlaying: false, progress: { current: 0, duration: 0 } });
  };

  const playAtIndex = async (index: number, playlistIdOverride?: string | null) => {
    const generation = ++ctx.playGenerationRef.current;
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
    if (!blob || generation !== ctx.playGenerationRef.current) return;

    const url = URL.createObjectURL(blob);
    ctx.objectUrlRef.current = url;

    const audio = new Audio(url);
    audio.volume = ctx.isFadedRef.current ? 0 : ctx.volumeRef.current;
    ctx.audioRef.current = audio;

    audio.ontimeupdate = () => {
      set({ progress: { current: audio.currentTime, duration: audio.duration || 0 } });
    };
    audio.onloadedmetadata = () => {
      set({ progress: { current: 0, duration: audio.duration || 0 } });
    };

    set({ playingPlaylistId: targetPlaylistId, playingTrackIndex: index });
    ctx.playingTrackIndexRef.current = index;

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
        ctx.stopWatchdog();
        set({ isPlaying: false });
        ctx.audioRef.current = null;
        ctx.revokeObjectUrl();
      }
    };

    audio.onerror = () => {
      ctx.stopWatchdog();
      set({ isPlaying: false });
      ctx.audioRef.current = null;
      ctx.revokeObjectUrl();
    };

    audio.play().then(() => {
      set({ isPlaying: true });
      ctx.startWatchdog();
    }).catch(() => {
      ctx.stopWatchdog();
      set({ isPlaying: false });
      ctx.audioRef.current = null;
      ctx.revokeObjectUrl();
    });
  };

  return {
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
        playAtIndex(ctx.playingTrackIndexRef.current, state.playingPlaylistId);
      }
    },

    togglePlay: () => {
      const state = get();
      if (state.isPlaying) {
        if (ctx.audioRef.current) {
          ctx.audioRef.current.pause();
          ctx.stopWatchdog();
          set({ isPlaying: false });
        }
      } else if (ctx.audioRef.current) {
        ctx.audioRef.current.play().then(() => {
          set({ isPlaying: true });
          ctx.startWatchdog();
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
      const nextIndex = (ctx.playingTrackIndexRef.current + 1) % trackIds.length;
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
      const prevIndex = (ctx.playingTrackIndexRef.current - 1 + trackIds.length) % trackIds.length;
      playAtIndex(prevIndex, state.playingPlaylistId);
    },

    seek: (time) => {
      const duration = ctx.audioRef.current?.duration || 0;
      if (ctx.audioRef.current) ctx.audioRef.current.currentTime = time;
      set({ progress: { current: time, duration } });
    },

    setVolume: (v) => {
      ctx.volumeRef.current = v;
      if (ctx.audioRef.current && !ctx.isFadedRef.current) {
        ctx.audioRef.current.volume = v;
      }
      updateSettings((prev) => ({ ...prev, volume: v }));
    },

    setAutoplay: (v) => {
      updateSettings((prev) => ({ ...prev, autoplay: v }));
    },

    init: () => {
      if (ctx.bgMusicInitializedRef.current) return;
      ctx.bgMusicInitializedRef.current = true;

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
}
