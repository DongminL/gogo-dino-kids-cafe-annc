import { saveTrackBlob, deleteTrackBlob } from "@/db/trackStorage";
import { stripExtension } from "@/utils";
import type { BgMusicSettings } from "@/features/bg-music/bgMusicSettings";
import type { Track } from "@/features/bg-music/types/bgMusic";

type LibraryCtx = {
  playingTrackIndexRef: { current: number };
  saveSettings: (settings: BgMusicSettings, index: number) => void;
};

type LibraryGet = () => {
  settings: BgMusicSettings;
  playingPlaylistId: string | null;
  playingTrackIndex: number;
  stopInternal: () => void;
};

type LibrarySet = (partial: any) => void;

export interface LibrarySlice {
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
}

export function createLibrarySlice(
  set: LibrarySet,
  get: LibraryGet,
  ctx: LibraryCtx,
): LibrarySlice {
  const updateSettings = (updater: (prev: BgMusicSettings) => BgMusicSettings) => {
    const newSettings = updater(get().settings);
    set({ settings: newSettings });
    ctx.saveSettings(newSettings, get().playingTrackIndex);
    return newSettings;
  };

  return {
    addTrack: async (file, playlistId, onProgress) => {
      const id = `track-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const name = stripExtension(file.name);

      await new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onprogress = (e) => {
          if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 75));
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
          ? prev.playlists.map((p) => p.id === playlistId ? { ...p, trackIds: [...p.trackIds, id] } : p)
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
      if (trackIds[ctx.playingTrackIndexRef.current] === trackId) state.stopInternal();

      updateSettings((prev) => ({
        ...prev,
        trackMeta: prev.trackMeta.filter((t) => t.id !== trackId),
        playlists: prev.playlists.map((p) => ({ ...p, trackIds: p.trackIds.filter((id) => id !== trackId) })),
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
      if (state.settings.currentPlaylistId === id) state.stopInternal();
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
          playlists: prev.playlists.map((p) => p.id === playlistId ? { ...p, loop } : p),
        };
      });
    },

    removeTrackFromPlaylist: (playlistId, index) => {
      const state = get();
      const targetPlaylist = state.settings.playlists.find((p) => p.id === playlistId);
      if (!targetPlaylist) return;
      if (playlistId === state.playingPlaylistId && ctx.playingTrackIndexRef.current === index) {
        state.stopInternal();
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
  };
}
