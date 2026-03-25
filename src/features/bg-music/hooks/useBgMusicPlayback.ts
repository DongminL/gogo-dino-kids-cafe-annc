import { useState, useRef, useCallback, useEffect } from "react";
import type { BgMusicSettings } from "@/features/bg-music/bgMusicSettings";
import { getTrackBlob } from "@/db/trackStorage";

interface UsePlaybackOptions {
  settingsRef: React.MutableRefObject<BgMusicSettings>;
  volumeRef: React.MutableRefObject<number>;
  isFadedRef: React.MutableRefObject<boolean>;
  initialPlaylistId: string | null;
  initialTrackIndex: number;
}

export function usePlayback({
  settingsRef,
  volumeRef,
  isFadedRef,
  initialPlaylistId,
  initialTrackIndex,
}: UsePlaybackOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingPlaylistId, setPlayingPlaylistId] = useState<string | null>(initialPlaylistId);
  const [playingTrackIndex, setPlayingTrackIndex] = useState(initialTrackIndex);
  const [progress, setProgress] = useState({ current: 0, duration: 0 });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const playingTrackIndexRef = useRef(playingTrackIndex);
  const playGenerationRef = useRef(0);

  useEffect(() => {
    playingTrackIndexRef.current = playingTrackIndex;
  }, [playingTrackIndex]);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const stopInternal = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.ontimeupdate = null;
      audioRef.current.onloadedmetadata = null;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    revokeObjectUrl();
    setIsPlaying(false);
    setProgress({ current: 0, duration: 0 });
  }, [revokeObjectUrl]);

  const playAtIndex = useCallback(
    async (index: number, playlistIdOverride?: string | null) => {
      const generation = ++playGenerationRef.current;

      const targetPlaylistId =
        playlistIdOverride !== undefined ? playlistIdOverride : playingPlaylistId;
      const s = settingsRef.current;
      const playlist =
        targetPlaylistId === null
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
        setProgress({ current: audio.currentTime, duration: audio.duration || 0 });
      };
      audio.onloadedmetadata = () => {
        setProgress({ current: 0, duration: audio.duration || 0 });
      };

      setPlayingPlaylistId(targetPlaylistId);
      setPlayingTrackIndex(index);
      playingTrackIndexRef.current = index;

      audio.onended = () => {
        const sCurrent = settingsRef.current;
        const pl =
          targetPlaylistId === null
            ? null
            : sCurrent.playlists.find((p) => p.id === targetPlaylistId) ?? null;

        const currentTrackIds = pl ? pl.trackIds : sCurrent.trackMeta.map((t) => t.id);
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
    [playingPlaylistId, stopInternal, revokeObjectUrl, settingsRef, volumeRef, isFadedRef]
  );

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

  const play = useCallback(
    (index?: number) => {
      if (index !== undefined) {
        playAtIndex(index, settingsRef.current.currentPlaylistId);
      } else {
        playAtIndex(playingTrackIndexRef.current, playingPlaylistId);
      }
    },
    [playAtIndex, playingPlaylistId, settingsRef]
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
    const pl =
      playingPlaylistId === null
        ? null
        : s.playlists.find((p) => p.id === playingPlaylistId) ?? null;

    const trackIds = pl ? pl.trackIds : s.trackMeta.map((t) => t.id);
    if (trackIds.length === 0) return;

    const nextIndex = (playingTrackIndexRef.current + 1) % trackIds.length;
    playAtIndex(nextIndex, playingPlaylistId);
  }, [playingPlaylistId, playAtIndex, settingsRef]);

  const prev = useCallback(() => {
    const s = settingsRef.current;
    const pl =
      playingPlaylistId === null
        ? null
        : s.playlists.find((p) => p.id === playingPlaylistId) ?? null;

    const trackIds = pl ? pl.trackIds : s.trackMeta.map((t) => t.id);
    if (trackIds.length === 0) return;

    const prevIndex =
      (playingTrackIndexRef.current - 1 + trackIds.length) % trackIds.length;
    playAtIndex(prevIndex, playingPlaylistId);
  }, [playingPlaylistId, playAtIndex, settingsRef]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress((prev) => ({ ...prev, current: time }));
    }
  }, []);

  return {
    audioRef,
    isPlaying,
    playingPlaylistId,
    playingTrackIndex,
    playingTrackIndexRef,
    progress,
    stopInternal,
    play,
    pause,
    togglePlay,
    next,
    prev,
    seek,
  };
}
