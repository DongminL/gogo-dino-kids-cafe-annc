import { app, BrowserWindow, Tray, Menu, nativeImage, screen, ipcMain, shell } from "electron";
import path from "path";
import fs from "fs";
import Store from "electron-store";
import { autoUpdater } from "electron-updater";
import type { Rectangle } from "electron";
import type { UpdateInfo, ProgressInfo } from "electron-updater";
import { IPC } from "@/electron/ipcChannels";
import { synthesize, isValidRegion } from "@/electron/tts";

function logFatal(prefix: string, err: unknown): void {
  const line = `[${new Date().toISOString()}] ${prefix}: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`;
  console.error(line);
  try {
    fs.appendFileSync(path.join(app.getPath("userData"), "error.log"), line);
  } catch { /* ignore FS errors inside error handler */ }
}

// 데스크톱 앱 특성상 예외 시 강제 종료 대신 로그를 남기고 계속 동작한다.
process.on("uncaughtException", (err) => logFatal("uncaughtException", err));
process.on("unhandledRejection", (reason) => logFatal("unhandledRejection", reason));

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

const store = new Store();

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function loadWindowBounds(): Rectangle | null {
  const bounds = store.get("windowBounds") as Rectangle | undefined;
  if (!bounds) return null;
  const valid = screen.getAllDisplays().some((d) => {
    const b = d.bounds;
    return (
      bounds.x >= b.x &&
      bounds.y >= b.y &&
      bounds.x + bounds.width <= b.x + b.width &&
      bounds.y + bounds.height <= b.y + b.height
    );
  });
  return valid ? bounds : null;
}

function saveWindowBounds(): void {
  if (!win || win.isMinimized() || win.isMaximized()) return;
  store.set("windowBounds", win.getBounds());
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveWindowBounds();
    saveTimer = null;
  }, 500);
}

function createWindow(): void {
  const bounds = loadWindowBounds();
  win = new BrowserWindow({
    width: bounds ? bounds.width : 1060,
    height: bounds ? bounds.height : 700,
    x: bounds ? bounds.x : undefined,
    y: bounds ? bounds.y : undefined,
    minWidth: 820,
    minHeight: 560,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, "preload.js"),
    },
    title: "고고 다이노 안내 방송",
    icon: path.join(__dirname, "../logo.png"),
    autoHideMenuBar: true,
  });

  if (!app.isPackaged) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "../index.html"));
  }

  win.on("resize", scheduleSave);
  win.on("move", scheduleSave);

  win.on("close", (e) => {
    e.preventDefault();
    saveWindowBounds();
    win?.hide();
  });
}

function createTray(): void {
  const iconPath = path.join(__dirname, "../logo.png");
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip("고고 다이노 안내 방송");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "열기",
      click: () => {
        win?.show();
        win?.focus();
      },
    },
    { type: "separator" },
    {
      label: "종료",
      click: () => {
        saveWindowBounds();
        app.exit(0);
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (win?.isVisible()) {
      win.hide();
    } else {
      win?.show();
      win?.focus();
    }
  });
}

function setupAutoUpdater(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    win?.webContents.send(IPC.UPDATE_AVAILABLE, info);
  });

  autoUpdater.on("update-not-available", (info: UpdateInfo) => {
    win?.webContents.send(IPC.UPDATE_NOT_AVAILABLE, info);
  });

  autoUpdater.on("download-progress", (progress: ProgressInfo) => {
    win?.webContents.send(IPC.DOWNLOAD_PROGRESS, progress);
  });

  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    win?.webContents.send(IPC.UPDATE_DOWNLOADED, info);
  });

  autoUpdater.on("error", (error: Error) => {
    win?.webContents.send(IPC.UPDATE_ERROR, error.message);
  });

  ipcMain.on(IPC.OPEN_EXTERNAL, (_event, url: unknown) => {
    if (typeof url !== "string") return;
    
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "https:" && ["github.com", "forms.gle"].includes(parsed.hostname)) {
        shell.openExternal(url);
      }
    } catch { /* ignore malformed URL */ }
  });
  ipcMain.on(IPC.CHECK_FOR_UPDATES, () => autoUpdater.checkForUpdates());
  ipcMain.on(IPC.DOWNLOAD_UPDATE, () => autoUpdater.downloadUpdate());
  ipcMain.on(IPC.INSTALL_UPDATE, () => {
    saveWindowBounds();
    autoUpdater.quitAndInstall(true, true);
  });

  if (app.isPackaged) {
    setTimeout(() => autoUpdater.checkForUpdates(), 3000);
  }
}

function setupTts(): void {
  ipcMain.handle(IPC.TTS_GET_CONFIG, () => ({
    region: (store.get("azureTtsRegion") as string | undefined) ?? "",
    hasKey: !!store.get("azureTtsKey"),
  }));

  ipcMain.handle(IPC.TTS_SET_CONFIG, (_event, config: unknown) => {
    if (
      typeof config !== "object" || config === null ||
      typeof (config as { key?: unknown }).key !== "string" ||
      typeof (config as { region?: unknown }).region !== "string"
    ) {
      throw new Error("잘못된 설정 값입니다.");
    }
    const { key, region } = config as { key: string; region: string };
    if (key.trim().length === 0) {
      throw new Error("Azure 키를 입력해주세요.");
    }
    if (!isValidRegion(region)) {
      throw new Error("잘못된 Azure 리전입니다.");
    }
    store.set("azureTtsRegion", region);
    store.set("azureTtsKey", key);
  });

  ipcMain.handle(IPC.TTS_SYNTHESIZE, async (_event, text: unknown) => {
    if (typeof text !== "string" || text.length < 1 || text.length > 1000) {
      throw new Error("멘트는 1~1000자로 입력해주세요.");
    }
    const key = store.get("azureTtsKey") as string | undefined;
    const region = store.get("azureTtsRegion") as string | undefined;
    if (!key || !region) {
      throw new Error("Azure TTS 키와 리전을 먼저 설정해주세요.");
    }
    const buffer = await synthesize({ key, region, text });
    return buffer;
  });
}

app.on("second-instance", () => {
  if (win) {
    if (!win.isVisible()) win.show();
    win.focus();
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  setupAutoUpdater();
  setupTts();
});

app.on("window-all-closed", () => { /* prevent default quit — tray keeps app alive */ });

app.on("activate", () => {
  if (win) {
    win.show();
    win.focus();
  }
});
