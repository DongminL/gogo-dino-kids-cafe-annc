import { useState, useRef, useCallback, useEffect } from "react";
import { STORAGE_KEY, loadSettings } from "@/features/bg-music/bgMusicSettings";
import { requestPersistentStorage } from "@/db/trackStorage";
import { useBgMusicFade } from "@/features/bg-music/hooks/useBgMusicFade";
import { usePlayback } from "@/features/bg-music/hooks/useBgMusicPlayback";
import { useLibrary } from "@/features/bg-music/hooks/useBgMusicLibrary";

export function useBgMusic() {
  const [settings, setSettings] = useState(loadSettings);
  const settingsRef = useRef(settings);
  const volumeRef = useRef(settings.volume);
  const isFadedRef = useRef(false);

  useEffect(() => {
    settingsRef.current = settings;
    volumeRef.current = settings.volume;
  }, [settings]);

  const {
    audioRef,
    isPlaying,
    playingPlaylistId,
    playingTrackIndex,
    playingTrackIndexRef,
    progress,
    stopInternal,
    play,
    togglePlay,
    next,
    prev,
    seek,
  } = usePlayback({
    settingsRef,
    volumeRef,
    isFadedRef,
    initialPlaylistId: settings.currentPlaylistId,
    initialTrackIndex: settings.currentTrackIndex,
  });

  const { clearFadeTimer, fadeOut, fadeIn } = useBgMusicFade(audioRef, volumeRef, isFadedRef);

  const library = useLibrary({
    settingsRef,
    setSettings,
    playingPlaylistId,
    playingTrackIndexRef,
    stopInternal,
  });

  // localStorage 동기화
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...settings, currentTrackIndex: playingTrackIndex })
    );
  }, [settings, playingTrackIndex]);

  // 마운트 시 persistent storage 요청
  useEffect(() => {
    requestPersistentStorage();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 자동 재생
  const autoplayDoneRef = useRef(false);
  useEffect(() => {
    if (autoplayDoneRef.current) return;
    autoplayDoneRef.current = true;
    const s = settingsRef.current;
    if (!s.autoplay) return;
    if (s.currentPlaylistId) {
      const playlist = s.playlists.find((p) => p.id === s.currentPlaylistId);
      if (playlist && playlist.trackIds.length > 0) {
        const idx = Math.min(s.currentTrackIndex, playlist.trackIds.length - 1);
        play(idx);
      }
    } else if (s.trackMeta.length > 0) {
      const idx = Math.min(s.currentTrackIndex, s.trackMeta.length - 1);
      play(idx);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      clearFadeTimer();
      stopInternal();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setVolume = useCallback(
    (v: number) => {
      volumeRef.current = v;
      if (audioRef.current && !isFadedRef.current) {
        audioRef.current.volume = v;
      }
      setSettings((prev) => ({ ...prev, volume: v }));
    },
    [audioRef]
  );

  const setAutoplay = useCallback((v: boolean) => {
    setSettings((prev) => ({ ...prev, autoplay: v }));
  }, []);

  const playingPlaylist = settings.playlists.find((p) => p.id === playingPlaylistId) ?? null;
  const currentTrack = playingPlaylist
    ? (settings.trackMeta.find(
        (t) => t.id === playingPlaylist.trackIds[playingTrackIndex]
      ) ?? null)
    : playingPlaylistId === null
    ? (settings.trackMeta[playingTrackIndex] ?? null)
    : null;

  return {
    tracks: settings.trackMeta,
    playlists: settings.playlists,
    currentPlaylistId: settings.currentPlaylistId,
    playingPlaylistId,
    currentPlaylist: playingPlaylist,
    currentTrack,
    currentTrackIndex: playingTrackIndex,
    isPlaying,
    progress,
    volume: settings.volume,
    autoplay: settings.autoplay,
    loopAll: settings.loopAll,
    ...library,
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
