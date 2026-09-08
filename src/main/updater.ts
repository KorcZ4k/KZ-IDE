import { app, BrowserWindow, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';

export type UpdateStatus = {
  state: 'disabled' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  percent?: number;
  message?: string;
};

let status: UpdateStatus = { state: 'disabled' };
let promptOpen = false;

function publish(next: UpdateStatus) {
  status = next;
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send('update:status', status);
}

export function getUpdateStatus() { return status; }

function updatesEnabled() { return app.isPackaged || process.env.KZ_IDE_ENABLE_UPDATES === '1'; }

export function setupAutoUpdater() {
  if (!updatesEnabled()) {
    publish({ state: 'disabled', message: 'Atualizações automáticas desativadas no modo de desenvolvimento.' });
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;

  autoUpdater.on('checking-for-update', () => publish({ state: 'checking' }));
  autoUpdater.on('update-available', info => {
    publish({ state: 'available', version: info.version });
  });
  autoUpdater.on('update-not-available', () => publish({ state: 'not-available' }));
  autoUpdater.on('download-progress', progress => publish({ state: 'downloading', percent: progress.percent }));
  autoUpdater.on('update-downloaded', info => {
    publish({ state: 'downloaded', version: info.version });
    if (promptOpen) return;
    promptOpen = true;
    void dialog.showMessageBox({
      type: 'info',
      title: 'Aurora — atualização pronta',
      message: `A versão ${info.version} foi baixada.`,
      detail: 'A atualização será aplicada ao reiniciar o Aurora.',
      buttons: ['Reiniciar agora', 'Depois'],
      defaultId: 0,
      cancelId: 1
    }).then(result => {
      promptOpen = false;
      if (result.response === 0) installUpdate();
    });
  });
  autoUpdater.on('error', error => publish({ state: 'error', message: error.message }));

  void checkForUpdates();
  const interval = setInterval(() => void checkForUpdates(), 6 * 60 * 60 * 1000);
  interval.unref();
}

export async function checkForUpdates() {
  if (!updatesEnabled()) return status;
  try {
    publish({ state: 'checking' });
    await autoUpdater.checkForUpdates();
  } catch (error) {
    publish({ state: 'error', message: error instanceof Error ? error.message : String(error) });
  }
  return status;
}

export async function downloadUpdate() {
  if (!updatesEnabled()) return status;
  try {
    publish({ state: 'downloading', percent: 0 });
    await autoUpdater.downloadUpdate();
  } catch (error) {
    publish({ state: 'error', message: error instanceof Error ? error.message : String(error) });
  }
  return status;
}

export function installUpdate() {
  if (!updatesEnabled()) return;
  autoUpdater.quitAndInstall(false, true);
}
