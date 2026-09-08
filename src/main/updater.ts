import { BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';

export type UpdateStatus = {
  state: 'disabled' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  percent?: number;
  message?: string;
};

let status: UpdateStatus = { state: 'disabled' };

function publish(next: UpdateStatus) {
  status = next;
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('update:status', status);
  }
}

export function getUpdateStatus() {
  return status;
}

export function setupAutoUpdater() {
  if (!process.env.KZ_IDE_ENABLE_UPDATES && !process.defaultApp) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => publish({ state: 'checking' }));
    autoUpdater.on('update-available', info => publish({ state: 'available', version: info.version }));
    autoUpdater.on('update-not-available', () => publish({ state: 'not-available' }));
    autoUpdater.on('download-progress', progress => publish({ state: 'downloading', percent: progress.percent }));
    autoUpdater.on('update-downloaded', info => publish({ state: 'downloaded', version: info.version }));
    autoUpdater.on('error', error => publish({ state: 'error', message: error.message }));

    void autoUpdater.checkForUpdates().catch(error => {
      publish({ state: 'error', message: error instanceof Error ? error.message : String(error) });
    });
  } else {
    publish({ state: 'disabled', message: 'Atualizações automáticas desativadas neste ambiente.' });
  }
}

export async function checkForUpdates() {
  if (process.defaultApp && !process.env.KZ_IDE_ENABLE_UPDATES) return status;
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    publish({ state: 'error', message: error instanceof Error ? error.message : String(error) });
  }
  return status;
}

export async function downloadUpdate() {
  await autoUpdater.downloadUpdate();
  return status;
}

export function installUpdate() {
  autoUpdater.quitAndInstall(false, true);
}
