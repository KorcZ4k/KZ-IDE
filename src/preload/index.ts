import { contextBridge, ipcRenderer } from 'electron';
import type { KZApi } from '../shared/api';

const api: KZApi = {
  workspace: {
    open: () => ipcRenderer.invoke('workspace:open'),
    last: () => ipcRenderer.invoke('workspace:last'),
    readTree: (root) => ipcRenderer.invoke('workspace:tree', root)
  },
  file: {
    read: (filePath) => ipcRenderer.invoke('file:read', filePath),
    write: (filePath, content) => ipcRenderer.invoke('file:write', filePath, content),
    create: (filePath, kind) => ipcRenderer.invoke('file:create', filePath, kind),
    remove: (filePath) => ipcRenderer.invoke('file:remove', filePath),
    rename: (oldPath, newPath) => ipcRenderer.invoke('file:rename', oldPath, newPath)
  },
  terminal: { cwd: () => ipcRenderer.invoke('terminal:cwd'), run: (command, cwd) => ipcRenderer.invoke('terminal:run', command, cwd) },
  git: { status: (cwd) => ipcRenderer.invoke('git:status', cwd), diff: (cwd, file) => ipcRenderer.invoke('git:diff', cwd, file), run: (cwd, args) => ipcRenderer.invoke('git:run', cwd, args) },
  search: { workspace: (root, query) => ipcRenderer.invoke('search:workspace', root, query) },
  settings: { get: () => ipcRenderer.invoke('settings:get'), save: (patch) => ipcRenderer.invoke('settings:save', patch) }
};

contextBridge.exposeInMainWorld('kz', api);
