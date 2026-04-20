import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import type { ElectronAPI, UpdateInfo, DownloadProgress } from "@/types/electron";

const api: ElectronAPI = {
  openExternal: (url: string) => ipcRenderer.send("open-external", url),
  checkForUpdates: () => ipcRenderer.send("check-for-updates"),
  downloadUpdate: () => ipcRenderer.send("download-update"),
  installUpdate: () => ipcRenderer.send("install-update"),

  onUpdateAvailable: (callback: (info: UpdateInfo) => void) =>
    ipcRenderer.on("update-available", (_event: IpcRendererEvent, info: UpdateInfo) => callback(info)),
  onUpdateNotAvailable: (callback: (info: UpdateInfo) => void) =>
    ipcRenderer.on("update-not-available", (_event: IpcRendererEvent, info: UpdateInfo) => callback(info)),
  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) =>
    ipcRenderer.on("update-downloaded", (_event: IpcRendererEvent, info: UpdateInfo) => callback(info)),
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) =>
    ipcRenderer.on("download-progress", (_event: IpcRendererEvent, progress: DownloadProgress) => callback(progress)),
  onUpdateError: (callback: (error: string) => void) =>
    ipcRenderer.on("update-error", (_event: IpcRendererEvent, error: string) => callback(error)),

  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners("update-available");
    ipcRenderer.removeAllListeners("update-not-available");
    ipcRenderer.removeAllListeners("update-downloaded");
    ipcRenderer.removeAllListeners("download-progress");
    ipcRenderer.removeAllListeners("update-error");
  },
};

contextBridge.exposeInMainWorld("electronAPI", api);
