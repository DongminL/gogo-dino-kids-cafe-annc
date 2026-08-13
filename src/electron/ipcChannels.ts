export const IPC = {
  UPDATE_AVAILABLE: "update-available",
  UPDATE_NOT_AVAILABLE: "update-not-available",
  DOWNLOAD_PROGRESS: "download-progress",
  UPDATE_DOWNLOADED: "update-downloaded",
  UPDATE_ERROR: "update-error",
  OPEN_EXTERNAL: "open-external",
  CHECK_FOR_UPDATES: "check-for-updates",
  DOWNLOAD_UPDATE: "download-update",
  INSTALL_UPDATE: "install-update",
  TTS_SYNTHESIZE: "tts-synthesize",
  TTS_GET_CONFIG: "tts-get-config",
  TTS_SET_CONFIG: "tts-set-config",
} as const;
