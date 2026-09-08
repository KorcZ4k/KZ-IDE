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

export function setupAutoUpdater() {
  if (!app.isPackaged && !process.env.KZ_IDE_ENABLE_UPDATES) {
    publish({ state: 'disabled', message: 'Atualizações automáticas desativadas no modo de desenvolvimento.' });
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;

  autoUpdater.on('checking-for-update', () => publish({ state: 'checking' }));
  autoUpdater.on('update-available', info => {
    publish({ state: 'available', version: info.version });
    if (promptOpen) return;
    promptOpen = true;
    void dialog.showMessageBox({
      type: 'info', title: 'KZ-IDE — atualização disponível',
      message: `A versão ${info.version} do KZ-IDE está disponível.`,
      detail: 'Você pode baixar agora e instalar quando fechar o aplicativo.',
      buttons: ['Baixar atualização', 'Agora não'], defaultId: 0, cancelId: 1
    }).then(result => { promptOpen = false; if (result.response === 0) void downloadUpdate(); });
  });
  autoUpdater.on('update-not-available', () => publish({ state: 'not-available' }));
  autoUpdater.on('download-progress', progress => publish({ state: 'downloading', percent: progress.percent }));
  autoUpdater.on('update-downloaded', info => {
    publish({ state: 'downloaded', version: info.version });
    void dialog.showMessageBox({
      type: 'info', title: 'KZ-IDE — atualização pronta',
      message: `A versão ${info.version} foi baixada.`,
      detail: 'A atualização será instalada quando você reiniciar o KZ-IDE.',
      buttons: ['Reiniciar agora', 'Depois'], defaultId: 0, cancelId: 1
    }).then(result => { if (result.response === 0) installUpdate(); });
  });
  autoUpdater.on('error', error => publish({ state: 'error', message: error.message }));
  void checkForUpdates();
}

export async function checkForUpdates() {
  if (!app.isPackaged && !process.env.KZ_IDE_ENABLE_UPDATES) return status;
  try { await autoUpdater.checkForUpdates(); }
  catch (error) { publish({ state: 'error', message: error instanceof Error ? error.message : String(error) }); }
  return status;
}

export async function downloadUpdate() {
  try { await autoUpdater.downloadUpdate(); }
  catch (error) { publish({ state: 'error', message: error instanceof Error ? error.message : String(error) }); }
  return status;
}

export function installUpdate() { autoUpdater.quitAndInstall(false, true); }
