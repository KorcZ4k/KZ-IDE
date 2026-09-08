import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { registerIpc } from './ipc';
import { setupAutoUpdater } from './updater';

const APP_NAME = 'Aurora - Korczak IDE';

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 650,
    title: APP_NAME,
    backgroundColor: '#07090b',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, '../preload/index.js')
    }
  });

  window.setMenuBarVisibility(false);
  void window.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.setName(APP_NAME);

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  setupAutoUpdater();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
