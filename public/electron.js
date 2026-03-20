const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let win;
let tray;

function createWindow() {
  win = new BrowserWindow({
    width: 1060,
    height: 700,
    minWidth: 820,
    minHeight: 560,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
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

  // 닫기 버튼: 종료 대신 트레이로 숨김
  win.on('close', (e) => {
    e.preventDefault();
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
