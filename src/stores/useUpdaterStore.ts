import { create } from "zustand";
import type { UpdateStatus } from "@/hooks/useUpdater";
import type { UpdateInfo, DownloadProgress } from "@/types/electron";

interface UpdaterStore {
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  downloadProgress: DownloadProgress | null;
  errorMessage: string | null;
  checkForUpdates: () => void;
  downloadUpdate: () => void;
  installUpdate: () => void;
  dismiss: () => void;
  init: () => void;
}

let updaterInitialized = false;

export const useUpdaterStore = create<UpdaterStore>((set) => ({
  status: "idle",
  updateInfo: null,
  downloadProgress: null,
  errorMessage: null,

  checkForUpdates: () => {
    if (!window.electronAPI) return;
    set({ status: "checking", errorMessage: null });
    window.electronAPI.checkForUpdates();
  },

  downloadUpdate: () => {
    if (!window.electronAPI) return;
    set({ status: "downloading" });
    window.electronAPI.downloadUpdate();
  },

  installUpdate: () => {
    window.electronAPI?.installUpdate();
  },

  dismiss: () => {
    set({ status: "idle", errorMessage: null });
  },

  init: () => {
    if (updaterInitialized) return;
    updaterInitialized = true;
    const api = window.electronAPI;
    if (!api) return;

    api.onUpdateAvailable((info) => {
      set({ updateInfo: info, status: "available" });
    });

    api.onUpdateNotAvailable(() => {
      set({ status: "not-available" });
    });

    api.onDownloadProgress((progress) => {
      set({ downloadProgress: progress, status: "downloading" });
    });

    api.onUpdateDownloaded((info) => {
      set({ updateInfo: info, downloadProgress: null, status: "downloaded" });
    });

    api.onUpdateError((error) => {
      set((state) => {
        if (state.status === "downloading") {
          return { errorMessage: error, status: "error" };
        }
        return { status: "idle" };
      });
    });
  },
}));
