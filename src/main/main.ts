import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { registerIpc } from './ipc';
import { setupAutoUpdater } from './updater';

const APP_NAME = 'Aurora - Korczak IDE';

function resolveAppIcon() {
  const packaged = path.join(process.resourcesPath, 'Aurora-IDE.png');
  const development = path.join(app.getAppPath(), 'build', 'Aurora-IDE.png');
  return app.isPackaged ? packaged : development;
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 650,
    title: APP_NAME,
    icon: resolveAppIcon(),
    frame: false,
    backgroundColor: '#07090b',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, '../preload/index.js')
    }
  });

  window.setMenuBarVisibility(false);
  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Aurora] Renderer failed to load (${errorCode}): ${errorDescription} — ${validatedURL}`);
  });
  window.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[Aurora] Renderer process gone: ${details.reason} (exit ${details.exitCode})`);
  });
  window.webContents.on('console-message', (_event, level, message, _line, _sourceId) => {
    if (level >= 2) console.error(`[Aurora renderer] ${message}`);
  });

  void window.loadFile(path.join(__dirname, '../renderer/index.html')).catch(error => {
    console.error('[Aurora] Could not load renderer:', error);
  });
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
