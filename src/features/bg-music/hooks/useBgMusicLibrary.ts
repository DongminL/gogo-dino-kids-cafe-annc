import { useCallback } from "react";
import type { Track } from "@/features/bg-music/types/bgMusic";
import type { BgMusicSettings } from "@/features/bg-music/bgMusicSettings";
import { saveTrackBlob, deleteTrackBlob } from "@/db/trackStorage";

interface UseLibraryOptions {
  settingsRef: React.MutableRefObject<BgMusicSettings>;
  setSettings: React.Dispatch<React.SetStateAction<BgMusicSettings>>;
  playingPlaylistId: string | null;
  playingTrackIndexRef: React.MutableRefObject<number>;
  stopInternal: () => void;
}

export function useLibrary({
  settingsRef,
  setSettings,
  playingPlaylistId,
  playingTrackIndexRef,
  stopInternal,
}: UseLibraryOptions) {
  // ─── Track ───────────────────────────────────────────────────────────────────

  const addTrack = useCallback(async (
    file: File,
    playlistId?: string,
    onProgress?: (progress: number) => void,
  ) => {
    const id = `track-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const name = file.name.replace(/\.[^.]+$/, "");

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

    setSettings((prev) => {
      const newTrack: Track = { id, name };
      const newPlaylists = playlistId
        ? prev.playlists.map((p) =>
            p.id === playlistId ? { ...p, trackIds: [...p.trackIds, id] } : p
          )
        : prev.playlists;
      return { ...prev, trackMeta: [...prev.trackMeta, newTrack], playlists: newPlaylists };
    });
  }, [setSettings]);

  const removeTrack = useCallback(
    async (trackId: string) => {
      await deleteTrackBlob(trackId);
      const s = settingsRef.current;
      const pl =
        playingPlaylistId === null
          ? null
          : s.playlists.find((p) => p.id === playingPlaylistId) ?? null;

      const trackIds = pl ? pl.trackIds : s.trackMeta.map((t) => t.id);
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
    [settingsRef, playingPlaylistId, playingTrackIndexRef, stopInternal, setSettings]
  );

  // ─── Playlist ─────────────────────────────────────────────────────────────────

  const createPlaylist = useCallback(
    (name: string) => {
      const id = `playlist-${Date.now()}`;
      setSettings((prev) => ({
        ...prev,
        playlists: [...prev.playlists, { id, name, trackIds: [], loop: false }],
        currentPlaylistId: prev.currentPlaylistId ?? id,
      }));
    },
    [setSettings]
  );

  const deletePlaylist = useCallback(
    (id: string) => {
      if (settingsRef.current.currentPlaylistId === id) stopInternal();
      setSettings((prev) => {
        const remaining = prev.playlists.filter((p) => p.id !== id);
        const newCurrentId =
          prev.currentPlaylistId === id ? (remaining[0]?.id ?? null) : prev.currentPlaylistId;
        return { ...prev, playlists: remaining, currentPlaylistId: newCurrentId };
      });
    },
    [settingsRef, stopInternal, setSettings]
  );

  const setCurrentPlaylist = useCallback(
    (id: string | null) => {
      setSettings((prev) => ({ ...prev, currentPlaylistId: id }));
    },
    [setSettings]
  );

  const addTrackToPlaylist = useCallback(
    (playlistId: string, trackId: string) => {
      setSettings((prev) => ({
        ...prev,
        playlists: prev.playlists.map((p) =>
          p.id === playlistId ? { ...p, trackIds: [...p.trackIds, trackId] } : p
        ),
      }));
    },
    [setSettings]
  );

  const setLoop = useCallback(
    (playlistId: string | null, loop: boolean) => {
      setSettings((prev) => {
        if (playlistId === null) {
          return { ...prev, loopAll: loop };
        }
        return {
          ...prev,
          playlists: prev.playlists.map((p) => (p.id === playlistId ? { ...p, loop } : p)),
        };
      });
    },
    [setSettings]
  );

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
    [settingsRef, playingPlaylistId, playingTrackIndexRef, stopInternal, setSettings]
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
    [setSettings]
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
    [setSettings]
  );

  return {
    addTrack,
    removeTrack,
    createPlaylist,
    deletePlaylist,
    setCurrentPlaylist,
    addTrackToPlaylist,
    setLoop,
    removeTrackFromPlaylist,
    setPlaylistTracks,
    reorderTrack,
  };
}
