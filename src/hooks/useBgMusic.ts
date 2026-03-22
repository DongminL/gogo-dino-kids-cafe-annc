import { useState, useRef, useCallback, useEffect } from "react";
import type { Track, Playlist } from "../types/bgMusic";
import { saveTrackBlob, getTrackBlob, deleteTrackBlob, requestPersistentStorage } from "../db/trackStorage";

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
  loopAll: boolean;
}

function defaultSettings(): BgMusicSettings {
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

function loadSettings(): BgMusicSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...defaultSettings(), ...JSON.parse(saved) };
  } catch {}
  return defaultSettings();
}

export function useBgMusic() {
  const [settings, setSettings] = useState<BgMusicSettings>(loadSettings);
  const [playingPlaylistId, setPlayingPlaylistId] = useState<string | null>(
    () => loadSettings().currentPlaylistId
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingTrackIndex, setPlayingTrackIndex] = useState(
    () => loadSettings().currentTrackIndex
  );
  const [progress, setProgress] = useState({ current: 0, duration: 0 });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const volumeRef = useRef(settings.volume);
  const isFadedRef = useRef(false);
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playingTrackIndexRef = useRef(playingTrackIndex);
  const settingsRef = useRef(settings);
  const playGenerationRef = useRef(0);

  useEffect(() => {
    settingsRef.current = settings;
    volumeRef.current = settings.volume;
  }, [settings]);

  useEffect(() => {
    playingTrackIndexRef.current = playingTrackIndex;
  }, [playingTrackIndex]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...settings, currentTrackIndex: playingTrackIndex })
    );
  }, [settings, playingTrackIndex]);

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


  const playAtIndex = useCallback(
    async (index: number, playlistIdOverride?: string | null) => {
      const generation = ++playGenerationRef.current;
      
      // 만약 playlistIdOverride가 주어지면 해당 플레이리스트를 사용하고, 
      // 아니면 현재 재생 중인 플레이리스트를 사용합니다.
      const targetPlaylistId = playlistIdOverride !== undefined ? playlistIdOverride : playingPlaylistId;
      const s = settingsRef.current;
      const playlist = targetPlaylistId === null 
        ? null 
        : s.playlists.find((p) => p.id === targetPlaylistId) ?? null;

      // 전체 목록 재생 지원을 위해 playlist가 null인 경우(전체 목록)도 고려
      const trackIds = playlist ? playlist.trackIds : s.trackMeta.map(t => t.id);
      
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

      audio.addEventListener("timeupdate", () => {
        setProgress({ current: audio.currentTime, duration: audio.duration || 0 });
      });
      audio.addEventListener("loadedmetadata", () => {
        setProgress({ current: 0, duration: audio.duration || 0 });
      });

      setPlayingPlaylistId(targetPlaylistId);
      setPlayingTrackIndex(index);
      playingTrackIndexRef.current = index;

      audio.onended = () => {
        const sCurrent = settingsRef.current;
        const pl = targetPlaylistId === null 
          ? null 
          : sCurrent.playlists.find((p) => p.id === targetPlaylistId) ?? null;
        
        const currentTrackIds = pl ? pl.trackIds : sCurrent.trackMeta.map(t => t.id);
        const nextIndex = index + 1;
        
        if (nextIndex < currentTrackIds.length) {
          playAtIndex(nextIndex, targetPlaylistId);
        } else if (pl ? pl.loop : sCurrent.loopAll) {
          playAtIndex(0, targetPlaylistId);
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
    [playingPlaylistId, stopInternal, revokeObjectUrl]
  );

  // Request persistent storage on mount to prevent browser eviction of large data
  useEffect(() => {
    requestPersistentStorage();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Autoplay on mount
  const autoplayDoneRef = useRef(false);
  useEffect(() => {
    if (autoplayDoneRef.current) return;
    autoplayDoneRef.current = true;
    const s = settingsRef.current;
    if (s.autoplay) {
      if (s.currentPlaylistId) {
        const playlist = s.playlists.find((p) => p.id === s.currentPlaylistId);
        if (playlist && playlist.trackIds.length > 0) {
          const idx = Math.min(s.currentTrackIndex, playlist.trackIds.length - 1);
          playAtIndex(idx);
        }
      } else if (s.trackMeta.length > 0) {
        const idx = Math.min(s.currentTrackIndex, s.trackMeta.length - 1);
        playAtIndex(idx);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Watchdog: 재생 중인데 오디오가 예기치 않게 멈춘 경우 자동으로 재개
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      if (audioRef.current && audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearFadeTimer();
      stopInternal();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const play = useCallback(
    (index?: number) => {
      // index가 명시적으로 주어지면, 현재 '선택된' 플레이리스트에서 재생합니다.
      if (index !== undefined) {
        playAtIndex(index, settingsRef.current.currentPlaylistId);
      } else {
        // index가 없으면(바텀 바 등에서 재생 시), 현재 재생 중인 컨텍스트를 유지합니다.
        playAtIndex(playingTrackIndexRef.current, playingPlaylistId);
      }
    },
    [playAtIndex, playingPlaylistId]
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
    const s = settingsRef.current;
    const pl = playingPlaylistId === null 
      ? null 
      : s.playlists.find((p) => p.id === playingPlaylistId) ?? null;
    
    const trackIds = pl ? pl.trackIds : s.trackMeta.map(t => t.id);
    if (trackIds.length === 0) return;
    
    const nextIndex = (playingTrackIndexRef.current + 1) % trackIds.length;
    playAtIndex(nextIndex, playingPlaylistId);
  }, [playingPlaylistId, playAtIndex]);

  const prev = useCallback(() => {
    const s = settingsRef.current;
    const pl = playingPlaylistId === null 
      ? null 
      : s.playlists.find((p) => p.id === playingPlaylistId) ?? null;
    
    const trackIds = pl ? pl.trackIds : s.trackMeta.map(t => t.id);
    if (trackIds.length === 0) return;
    
    const prevIndex = (playingTrackIndexRef.current - 1 + trackIds.length) % trackIds.length;
    playAtIndex(prevIndex, playingPlaylistId);
  }, [playingPlaylistId, playAtIndex]);

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
      const s = settingsRef.current;
      const pl = playingPlaylistId === null 
        ? null 
        : s.playlists.find((p) => p.id === playingPlaylistId) ?? null;
      
      const trackIds = pl ? pl.trackIds : s.trackMeta.map(t => t.id);
      const currentTrackId = trackIds[playingTrackIndexRef.current];
      
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
    [playingPlaylistId, stopInternal]
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
      // 재생을 중단하지 않습니다. 인덱스도 초기화하지 않습니다.
      // 인덱스는 재생이 시작될 때 0으로 리셋하면 됩니다.
      setSettings((prev) => ({ ...prev, currentPlaylistId: id }));
    },
    []
  );

  const addTrackToPlaylist = useCallback((playlistId: string, trackId: string) => {
    setSettings((prev) => ({
      ...prev,
      playlists: prev.playlists.map((p) =>
        p.id === playlistId ? { ...p, trackIds: [...p.trackIds, trackId] } : p
      ),
    }));
  }, []);

  const setLoop = useCallback((playlistId: string | null, loop: boolean) => {
    setSettings((prev) => {
      if (playlistId === null) {
        return { ...prev, loopAll: loop };
      }
      return {
        ...prev,
        playlists: prev.playlists.map((p) =>
          p.id === playlistId ? { ...p, loop } : p
        ),
      };
    });
  }, []);

  const removeTrackFromPlaylist = useCallback(
    (playlistId: string, index: number) => {
      const s = settingsRef.current;
      const targetPlaylist = s.playlists.find((p) => p.id === playlistId);
      if (!targetPlaylist) return;

      if (playlistId === playingPlaylistId && playingTrackIndexRef.current === index) {
        stopInternal();
      }

      setSettings((prev) => ({
        ...prev,
        playlists: prev.playlists.map((p) => {
          if (p.id !== playlistId) return p;
          const newTrackIds = [...p.trackIds];
          newTrackIds.splice(index, 1);
          return { ...p, trackIds: newTrackIds };
        }),
      }));
    },
    [playingPlaylistId, stopInternal]
  );

  const setPlaylistTracks = useCallback(
    (playlistId: string | null, trackIds: string[]) => {
      setSettings((prev) => {
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
    []
  );

  const reorderTrack = useCallback(
    (playlistId: string | null, fromIndex: number, toIndex: number) => {
      setSettings((prev) => {
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

  const playingPlaylist =
    settings.playlists.find((p) => p.id === playingPlaylistId) ?? null;
  const currentTrack = playingPlaylist
    ? (settings.trackMeta.find(
        (t) => t.id === playingPlaylist.trackIds[playingTrackIndex]
      ) ?? null)
    : (playingPlaylistId === null 
        ? (settings.trackMeta[playingTrackIndex] ?? null)
        : null);

  return {
    tracks: settings.trackMeta,
    playlists: settings.playlists,
    currentPlaylistId: settings.currentPlaylistId, // 선택된 플레이리스트 ID (기존 테스트 호환성)
    playingPlaylistId: playingPlaylistId,           // 실제로 재생 중인 플레이리스트 ID
    currentPlaylist: playingPlaylist,
    currentTrack,
    currentTrackIndex: playingTrackIndex,
    isPlaying,
    progress,
    volume: settings.volume,
    autoplay: settings.autoplay,
    loopAll: settings.loopAll,
    addTrack,
    removeTrack,
    createPlaylist,
    deletePlaylist,
    setCurrentPlaylist,
    setLoop,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    reorderTrack,
    setPlaylistTracks,
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
