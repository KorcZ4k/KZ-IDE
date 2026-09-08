import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { registerIpc } from './ipc';
import { setupAutoUpdater } from './updater';

function createWindow() {
  const window = new BrowserWindow({ width:1280, height:800, minWidth:900, minHeight:600, title:'KZ-IDE', backgroundColor:'#0b0e12', webPreferences:{ contextIsolation:true, nodeIntegration:false, sandbox:true, preload:path.join(__dirname,'../preload/index.js') } });
  void window.loadFile(path.join(__dirname,'../renderer/index.html'));
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  setupAutoUpdater();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
