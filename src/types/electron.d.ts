export interface UpdateInfo {
  version: string;
  releaseNotes?: string;
}

export interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface TtsConfig {
  region: string;
  hasKey: boolean;
}

export interface ElectronAPI {
  openExternal: (url: string) => void;
  checkForUpdates: () => void;
  downloadUpdate: () => void;
  installUpdate: () => void;
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => void;
  onUpdateNotAvailable: (callback: (info: UpdateInfo) => void) => void;
  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => void;
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => void;
  onUpdateError: (callback: (error: string) => void) => void;
  removeUpdateListeners: () => void;

  synthesizeTts: (text: string) => Promise<Uint8Array>;
  getTtsConfig: () => Promise<TtsConfig>;
  setTtsConfig: (key: string, region: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
