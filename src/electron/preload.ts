import { contextBridge, ipcRenderer } from "electron";
import type { ElectronAPI, UpdateInfo, DownloadProgress } from "@/types/electron";
import { IPC } from "./ipcChannels";

function makeListener<T>(channel: string) {
  return (callback: (data: T) => void) =>
    ipcRenderer.on(channel, (_event, data: T) => callback(data));
}

const UPDATE_CHANNELS = [
  IPC.UPDATE_AVAILABLE,
  IPC.UPDATE_NOT_AVAILABLE,
  IPC.UPDATE_DOWNLOADED,
  IPC.DOWNLOAD_PROGRESS,
  IPC.UPDATE_ERROR,
] as const;

const api: ElectronAPI = {
  openExternal: (url) => ipcRenderer.send(IPC.OPEN_EXTERNAL, url),
  checkForUpdates: () => ipcRenderer.send(IPC.CHECK_FOR_UPDATES),
  downloadUpdate: () => ipcRenderer.send(IPC.DOWNLOAD_UPDATE),
  installUpdate: () => ipcRenderer.send(IPC.INSTALL_UPDATE),

  onUpdateAvailable: makeListener<UpdateInfo>(IPC.UPDATE_AVAILABLE),
  onUpdateNotAvailable: makeListener<UpdateInfo>(IPC.UPDATE_NOT_AVAILABLE),
  onUpdateDownloaded: makeListener<UpdateInfo>(IPC.UPDATE_DOWNLOADED),
  onDownloadProgress: makeListener<DownloadProgress>(IPC.DOWNLOAD_PROGRESS),
  onUpdateError: makeListener<string>(IPC.UPDATE_ERROR),

  removeUpdateListeners: () =>
    UPDATE_CHANNELS.forEach((ch) => ipcRenderer.removeAllListeners(ch)),
};

contextBridge.exposeInMainWorld("electronAPI", api);
