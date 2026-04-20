import { app, BrowserWindow, Tray, Menu, nativeImage, screen, ipcMain, shell } from "electron";
import path from "path";
import Store from "electron-store";
import { autoUpdater } from "electron-updater";
import type { Rectangle } from "electron";
import type { UpdateInfo, ProgressInfo } from "electron-updater";

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
    win?.webContents.send("update-available", info);
  });

  autoUpdater.on("update-not-available", (info: UpdateInfo) => {
    win?.webContents.send("update-not-available", info);
  });

  autoUpdater.on("download-progress", (progress: ProgressInfo) => {
    win?.webContents.send("download-progress", progress);
  });

  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    win?.webContents.send("update-downloaded", info);
  });

  autoUpdater.on("error", (error: Error) => {
    win?.webContents.send("update-error", error.message);
  });

  ipcMain.on("open-external", (_event, url: unknown) => {
    if (
      typeof url === "string" &&
      (url.startsWith("https://github.com") || url.startsWith("https://forms.gle"))
    ) {
      shell.openExternal(url);
    }
  });
  ipcMain.on("check-for-updates", () => autoUpdater.checkForUpdates());
  ipcMain.on("download-update", () => autoUpdater.downloadUpdate());
  ipcMain.on("install-update", () => {
    saveWindowBounds();
    autoUpdater.quitAndInstall(true, true);
  });

  if (app.isPackaged) {
    setTimeout(() => autoUpdater.checkForUpdates(), 3000);
  }
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
});

app.on("window-all-closed", () => {});

app.on("activate", () => {
  if (win) {
    win.show();
    win.focus();
  }
});
