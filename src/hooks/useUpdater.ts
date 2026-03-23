import { useEffect, useState, useCallback } from 'react';

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
}

interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UseUpdaterResult {
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  downloadProgress: DownloadProgress | null;
  errorMessage: string | null;
  checkForUpdates: () => void;
  downloadUpdate: () => void;
  installUpdate: () => void;
  dismiss: () => void;
}

declare global {
  interface Window {
    electronAPI?: {
      checkForUpdates: () => void;
      downloadUpdate: () => void;
      installUpdate: () => void;
      onUpdateAvailable: (callback: (info: UpdateInfo) => void) => void;
      onUpdateNotAvailable: (callback: (info: UpdateInfo) => void) => void;
      onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => void;
      onDownloadProgress: (callback: (progress: DownloadProgress) => void) => void;
      onUpdateError: (callback: (error: string) => void) => void;
      removeUpdateListeners: () => void;
    };
  }
}

export function useUpdater(): UseUpdaterResult {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    api.onUpdateAvailable((info) => {
      setUpdateInfo(info);
      setStatus('available');
    });

    api.onUpdateNotAvailable(() => {
      setStatus('not-available');
    });

    api.onDownloadProgress((progress) => {
      setDownloadProgress(progress);
      setStatus('downloading');
    });

    api.onUpdateDownloaded((info) => {
      setUpdateInfo(info);
      setDownloadProgress(null);
      setStatus('downloaded');
    });

    api.onUpdateError((error) => {
      setErrorMessage(error);
      setStatus('error');
    });

    return () => {
      api.removeUpdateListeners();
    };
  }, []);

  const checkForUpdates = useCallback(() => {
    if (!window.electronAPI) return;
    setStatus('checking');
    setErrorMessage(null);
    window.electronAPI.checkForUpdates();
  }, []);

  const downloadUpdate = useCallback(() => {
    if (!window.electronAPI) return;
    setStatus('downloading');
    window.electronAPI.downloadUpdate();
  }, []);

  const installUpdate = useCallback(() => {
    window.electronAPI?.installUpdate();
  }, []);

  const dismiss = useCallback(() => {
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  return { status, updateInfo, downloadProgress, errorMessage, checkForUpdates, downloadUpdate, installUpdate, dismiss };
}
