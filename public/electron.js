const { app, BrowserWindow, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const Store = require('electron-store');

// 단일 인스턴스 잠금: 두 번째 실행 시 첫 번째 창을 앞으로 가져오고 종료
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

const store = new Store();

let win;
let tray;
let saveTimer = null;

function loadWindowBounds() {
  const bounds = store.get('windowBounds');
  if (!bounds) return null;
  // 저장된 위치가 현재 연결된 모니터 안에 있는지 검증
  const valid = screen.getAllDisplays().some(d => {
    const b = d.bounds;
    return bounds.x >= b.x && bounds.y >= b.y &&
      bounds.x + bounds.width <= b.x + b.width &&
      bounds.y + bounds.height <= b.y + b.height;
  });
  return valid ? bounds : null;
}

function saveWindowBounds() {
  if (!win || win.isMinimized() || win.isMaximized()) return;
  store.set('windowBounds', win.getBounds());
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveWindowBounds(); saveTimer = null; }, 500);
}

function createWindow() {
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
    },
    title: '고고 다이노 안내 방송',
    icon: path.join(__dirname, 'logo.png'),
    autoHideMenuBar: true,
  });

  if (!app.isPackaged) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, '../build/index.html'));
  }

  win.on('resize', scheduleSave);
  win.on('move', scheduleSave);

  // 닫기 버튼: 종료 대신 트레이로 숨김
  win.on('close', (e) => {
    e.preventDefault();
    saveWindowBounds();
    win.hide();
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'logo.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('고고 다이노 안내 방송');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '열기',
      click: () => {
        win.show();
        win.focus();
      },
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        saveWindowBounds();
        app.exit(0);
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
      win.focus();
    }
  });
}

// 두 번째 인스턴스 실행 시 첫 번째 인스턴스의 창을 앞으로 가져옴
app.on('second-instance', () => {
  if (win) {
    if (!win.isVisible()) win.show();
    win.focus();
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();
});

// 트레이로 실행 중이므로 모든 창이 닫혀도 앱을 종료하지 않음
app.on('window-all-closed', () => { });

app.on('activate', () => {
  if (win) {
    win.show();
    win.focus();
  }
});
