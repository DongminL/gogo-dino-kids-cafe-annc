import { useEffect } from "react";
import { loadSettings } from "@/features/bg-music/bgMusicSettings";
import { useBgMusicStore } from "@/features/bg-music/stores/useBgMusicStore";

export function useBgMusic() {
  const store = useBgMusicStore();

  useEffect(() => {
    // 마운트 시 localStorage에서 최신 설정을 읽어 스토어와 동기화한 뒤 초기화
    const freshSettings = loadSettings();
    useBgMusicStore.setState({ settings: freshSettings });
    useBgMusicStore.getState().init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { settings, playingPlaylistId, playingTrackIndex } = store;

  const currentPlaylist = settings.playlists.find((p) => p.id === playingPlaylistId) ?? null;
  const currentTrack = currentPlaylist
    ? (settings.trackMeta.find((t) => t.id === currentPlaylist.trackIds[playingTrackIndex]) ?? null)
    : playingPlaylistId === null
    ? (settings.trackMeta[playingTrackIndex] ?? null)
    : null;

  return {
    tracks: settings.trackMeta,
    playlists: settings.playlists,
    currentPlaylistId: settings.currentPlaylistId,
    playingPlaylistId,
    currentPlaylist,
    currentTrack,
    currentTrackIndex: playingTrackIndex,
    isPlaying: store.isPlaying,
    progress: store.progress,
    volume: settings.volume,
    autoplay: settings.autoplay,
    loopAll: settings.loopAll,
    addTrack: store.addTrack,
    removeTrack: store.removeTrack,
    createPlaylist: store.createPlaylist,
    deletePlaylist: store.deletePlaylist,
    setCurrentPlaylist: store.setCurrentPlaylist,
    addTrackToPlaylist: store.addTrackToPlaylist,
    setLoop: store.setLoop,
    removeTrackFromPlaylist: store.removeTrackFromPlaylist,
    setPlaylistTracks: store.setPlaylistTracks,
    reorderTrack: store.reorderTrack,
    play: store.play,
    togglePlay: store.togglePlay,
    next: store.next,
    prev: store.prev,
    seek: store.seek,
    setVolume: store.setVolume,
    setAutoplay: store.setAutoplay,
    fadeOut: store.fadeOut,
    fadeIn: store.fadeIn,
  };
}
