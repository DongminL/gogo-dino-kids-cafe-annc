import { useState, useRef, useCallback, useEffect } from "react";
import type { Track, Playlist } from "../types/bgMusic";
import { saveTrackBlob, getTrackBlob, deleteTrackBlob } from "../db/trackStorage";

const STORAGE_KEY = "bg-music-settings";
const FADE_DURATION_MS = 1500;
const FADE_STEPS = 30;

interface BgMusicSettings {
  playlists: Playlist[];
  trackMeta: Track[];
  currentPlaylistId: string | null;
  currentTrackIndex: number;
  autoplay: boolean;
  volume: number;
}

function defaultSettings(): BgMusicSettings {
  return {
    playlists: [],
    trackMeta: [],
    currentPlaylistId: null,
    currentTrackIndex: 0,
    autoplay: false,
    volume: 0.7,
  };
}

function loadSettings(): BgMusicSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...defaultSettings(), ...JSON.parse(saved) };
  } catch {}
  return defaultSettings();
}

export function useBgMusic() {
  const [settings, setSettings] = useState<BgMusicSettings>(loadSettings);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndexState] = useState(
    () => loadSettings().currentTrackIndex
  );
  const [progress, setProgress] = useState({ current: 0, duration: 0 });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const volumeRef = useRef(settings.volume);
  const isFadedRef = useRef(false);
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentTrackIndexRef = useRef(currentTrackIndex);
  const settingsRef = useRef(settings);
  const playGenerationRef = useRef(0);

  useEffect(() => {
    settingsRef.current = settings;
    volumeRef.current = settings.volume;
  }, [settings]);

  useEffect(() => {
    currentTrackIndexRef.current = currentTrackIndex;
  }, [currentTrackIndex]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...settings, currentTrackIndex })
    );
  }, [settings, currentTrackIndex]);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const stopInternal = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    revokeObjectUrl();
    setIsPlaying(false);
    setProgress({ current: 0, duration: 0 });
  }, [revokeObjectUrl]);

  const clearFadeTimer = useCallback(() => {
    if (fadeTimerRef.current !== null) {
      clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const getCurrentPlaylist = useCallback((): Playlist | null => {
    const s = settingsRef.current;
    if (!s.currentPlaylistId) return null;
    return s.playlists.find((p) => p.id === s.currentPlaylistId) ?? null;
  }, []);

  const playAtIndex = useCallback(
    async (index: number) => {
      const generation = ++playGenerationRef.current;
      const playlist = getCurrentPlaylist();
      if (!playlist || playlist.trackIds.length === 0) return;

      const trackId = playlist.trackIds[index];
      if (!trackId) return;

      stopInternal();

      const blob = await getTrackBlob(trackId);
      if (!blob || generation !== playGenerationRef.current) return;

      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const audio = new Audio(url);
      audio.volume = isFadedRef.current ? 0 : volumeRef.current;
      audioRef.current = audio;

      audio.addEventListener("timeupdate", () => {
        setProgress({ current: audio.currentTime, duration: audio.duration || 0 });
      });
      audio.addEventListener("loadedmetadata", () => {
        setProgress({ current: 0, duration: audio.duration || 0 });
      });

      setCurrentTrackIndexState(index);
      currentTrackIndexRef.current = index;

      audio.onended = () => {
        const pl = getCurrentPlaylist();
        if (!pl) return;
        const nextIndex = index + 1;
        if (nextIndex < pl.trackIds.length) {
          playAtIndex(nextIndex);
        } else if (pl.loop) {
          playAtIndex(0);
        } else {
          setIsPlaying(false);
          audioRef.current = null;
          revokeObjectUrl();
        }
      };

      audio.onerror = () => {
        setIsPlaying(false);
        audioRef.current = null;
        revokeObjectUrl();
      };

      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        setIsPlaying(false);
        audioRef.current = null;
        revokeObjectUrl();
      });
    },
    [getCurrentPlaylist, stopInternal, revokeObjectUrl]
  );

  // Autoplay on mount
  const autoplayDoneRef = useRef(false);
  useEffect(() => {
    if (autoplayDoneRef.current) return;
    autoplayDoneRef.current = true;
    const s = settingsRef.current;
    if (s.autoplay && s.currentPlaylistId) {
      const playlist = s.playlists.find((p) => p.id === s.currentPlaylistId);
      if (playlist && playlist.trackIds.length > 0) {
        const idx = Math.min(s.currentTrackIndex, playlist.trackIds.length - 1);
        playAtIndex(idx);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearFadeTimer();
      stopInternal();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const play = useCallback(
    (index?: number) => {
      playAtIndex(index ?? currentTrackIndexRef.current);
    },
    [playAtIndex]
  );

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else if (audioRef.current) {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  const next = useCallback(() => {
    const playlist = getCurrentPlaylist();
    if (!playlist || playlist.trackIds.length === 0) return;
    const nextIndex = (currentTrackIndexRef.current + 1) % playlist.trackIds.length;
    playAtIndex(nextIndex);
  }, [getCurrentPlaylist, playAtIndex]);

  const prev = useCallback(() => {
    const playlist = getCurrentPlaylist();
    if (!playlist || playlist.trackIds.length === 0) return;
    const prevIndex =
      (currentTrackIndexRef.current - 1 + playlist.trackIds.length) %
      playlist.trackIds.length;
    playAtIndex(prevIndex);
  }, [getCurrentPlaylist, playAtIndex]);

  const setVolume = useCallback((v: number) => {
    volumeRef.current = v;
    if (audioRef.current && !isFadedRef.current) {
      audioRef.current.volume = v;
    }
    setSettings((prev) => ({ ...prev, volume: v }));
  }, []);

  const fadeOut = useCallback(() => {
    if (!audioRef.current || isFadedRef.current) return;
    isFadedRef.current = true;
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
  }, [clearFadeTimer]);

  const fadeIn = useCallback(() => {
    if (!audioRef.current || !isFadedRef.current) return;
    isFadedRef.current = false;
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
  }, [clearFadeTimer]);

  // Track management
  const addTrack = useCallback(async (file: File, playlistId?: string) => {
    const id = `track-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const name = file.name.replace(/\.[^.]+$/, "");
    await saveTrackBlob(id, file);
    setSettings((prev) => {
      const newTrack: Track = { id, name };
      const newPlaylists = playlistId
        ? prev.playlists.map((p) =>
            p.id === playlistId ? { ...p, trackIds: [...p.trackIds, id] } : p
          )
        : prev.playlists;
      return { ...prev, trackMeta: [...prev.trackMeta, newTrack], playlists: newPlaylists };
    });
  }, []);

  const removeTrack = useCallback(
    async (trackId: string) => {
      await deleteTrackBlob(trackId);
      const currentPlaylist = getCurrentPlaylist();
      const currentTrackId = currentPlaylist?.trackIds[currentTrackIndexRef.current];
      if (currentTrackId === trackId) stopInternal();
      setSettings((prev) => ({
        ...prev,
        trackMeta: prev.trackMeta.filter((t) => t.id !== trackId),
        playlists: prev.playlists.map((p) => ({
          ...p,
          trackIds: p.trackIds.filter((id) => id !== trackId),
        })),
      }));
    },
    [getCurrentPlaylist, stopInternal]
  );

  // Playlist management
  const createPlaylist = useCallback((name: string) => {
    const id = `playlist-${Date.now()}`;
    const newPlaylist: Playlist = { id, name, trackIds: [], loop: false };
    setSettings((prev) => ({
      ...prev,
      playlists: [...prev.playlists, newPlaylist],
      currentPlaylistId: prev.currentPlaylistId ?? id,
    }));
  }, []);

  const deletePlaylist = useCallback(
    (id: string) => {
      if (settingsRef.current.currentPlaylistId === id) stopInternal();
      setSettings((prev) => {
        const remaining = prev.playlists.filter((p) => p.id !== id);
        const newCurrentId =
          prev.currentPlaylistId === id
            ? (remaining[0]?.id ?? null)
            : prev.currentPlaylistId;
        return { ...prev, playlists: remaining, currentPlaylistId: newCurrentId };
      });
    },
    [stopInternal]
  );

  const setCurrentPlaylist = useCallback(
    (id: string | null) => {
      stopInternal();
      setCurrentTrackIndexState(0);
      setSettings((prev) => ({ ...prev, currentPlaylistId: id }));
    },
    [stopInternal]
  );

  const addTrackToPlaylist = useCallback((playlistId: string, trackId: string) => {
    setSettings((prev) => ({
      ...prev,
      playlists: prev.playlists.map((p) =>
        p.id === playlistId ? { ...p, trackIds: [...p.trackIds, trackId] } : p
      ),
    }));
  }, []);

  const setLoop = useCallback((playlistId: string, loop: boolean) => {
    setSettings((prev) => ({
      ...prev,
      playlists: prev.playlists.map((p) =>
        p.id === playlistId ? { ...p, loop } : p
      ),
    }));
  }, []);

  const removeTrackFromPlaylist = useCallback(
    (playlistId: string, trackId: string) => {
      const currentPlaylist = getCurrentPlaylist();
      const currentTrackId = currentPlaylist?.trackIds[currentTrackIndexRef.current];
      if (playlistId === currentPlaylist?.id && currentTrackId === trackId) {
        stopInternal();
      }
      setSettings((prev) => ({
        ...prev,
        playlists: prev.playlists.map((p) =>
          p.id === playlistId
            ? { ...p, trackIds: p.trackIds.filter((id) => id !== trackId) }
            : p
        ),
      }));
    },
    [getCurrentPlaylist, stopInternal]
  );

  const reorderTrack = useCallback(
    (playlistId: string, fromIndex: number, toIndex: number) => {
      setSettings((prev) => ({
        ...prev,
        playlists: prev.playlists.map((p) => {
          if (p.id !== playlistId) return p;
          const ids = [...p.trackIds];
          const [removed] = ids.splice(fromIndex, 1);
          ids.splice(toIndex, 0, removed);
          return { ...p, trackIds: ids };
        }),
      }));
    },
    []
  );

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress((prev) => ({ ...prev, current: time }));
    }
  }, []);

  const setAutoplay = useCallback((v: boolean) => {
    setSettings((prev) => ({ ...prev, autoplay: v }));
  }, []);

  const currentPlaylist =
    settings.playlists.find((p) => p.id === settings.currentPlaylistId) ?? null;
  const currentTrack = currentPlaylist
    ? (settings.trackMeta.find(
        (t) => t.id === currentPlaylist.trackIds[currentTrackIndex]
      ) ?? null)
    : null;

  return {
    tracks: settings.trackMeta,
    playlists: settings.playlists,
    currentPlaylistId: settings.currentPlaylistId,
    currentPlaylist,
    currentTrack,
    currentTrackIndex,
    isPlaying,
    progress,
    volume: settings.volume,
    autoplay: settings.autoplay,
    addTrack,
    removeTrack,
    createPlaylist,
    deletePlaylist,
    setCurrentPlaylist,
    setLoop,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    reorderTrack,
    play,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
    setAutoplay,
    fadeOut,
    fadeIn,
  };
}
