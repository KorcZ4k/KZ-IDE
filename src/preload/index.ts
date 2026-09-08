import { contextBridge, ipcRenderer } from 'electron';
import type { KZApi } from '../shared/api';

const api: KZApi = {
  workspace: { open: () => ipcRenderer.invoke('workspace:open'), last: () => ipcRenderer.invoke('workspace:last'), readTree: root => ipcRenderer.invoke('workspace:tree', root) },
  file: {
    read: filePath => ipcRenderer.invoke('file:read', filePath),
    write: (filePath, content) => ipcRenderer.invoke('file:write', filePath, content),
    create: (filePath, kind) => ipcRenderer.invoke('file:create', filePath, kind),
    remove: filePath => ipcRenderer.invoke('file:remove', filePath),
    rename: (oldPath, newPath) => ipcRenderer.invoke('file:rename', oldPath, newPath)
  },
  terminal: { cwd: () => ipcRenderer.invoke('terminal:cwd'), run: (command, cwd) => ipcRenderer.invoke('terminal:run', command, cwd) },
  git: { status: cwd => ipcRenderer.invoke('git:status', cwd), diff: (cwd, file) => ipcRenderer.invoke('git:diff', cwd, file), run: (cwd, args) => ipcRenderer.invoke('git:run', cwd, args) },
  search: { workspace: (root, query) => ipcRenderer.invoke('search:workspace', root, query) },
  settings: { get: () => ipcRenderer.invoke('settings:get'), save: patch => ipcRenderer.invoke('settings:save', patch) },
  update: {
    status: () => ipcRenderer.invoke('update:status'),
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => { void ipcRenderer.invoke('update:install'); },
    onStatus: callback => {
      const listener = (_event: Electron.IpcRendererEvent, status: Parameters<typeof callback>[0]) => callback(status);
      ipcRenderer.on('update:status', listener);
      return () => ipcRenderer.removeListener('update:status', listener);
    }
  }
};

contextBridge.exposeInMainWorld('kz', api);
