import { contextBridge, ipcRenderer } from 'electron';
import type { KZApi } from '../shared/api';

const api: KZApi = {
  workspace: { open: () => ipcRenderer.invoke('workspace:open'), last: () => ipcRenderer.invoke('workspace:last'), readTree: root => ipcRenderer.invoke('workspace:tree', root) },
  file: {
    read: (root, filePath) => ipcRenderer.invoke('file:read', root, filePath),
    write: (root, filePath, content) => ipcRenderer.invoke('file:write', root, filePath, content),
    create: (root, filePath, kind) => ipcRenderer.invoke('file:create', root, filePath, kind),
    remove: (root, filePath) => ipcRenderer.invoke('file:remove', root, filePath),
    rename: (root, oldPath, newPath) => ipcRenderer.invoke('file:rename', root, oldPath, newPath)
  },
  terminal: { cwd: () => ipcRenderer.invoke('terminal:cwd'), run: (command, cwd) => ipcRenderer.invoke('terminal:run', command, cwd) },
  git: { status: cwd => ipcRenderer.invoke('git:status', cwd), diff: (cwd, file) => ipcRenderer.invoke('git:diff', cwd, file), run: (cwd, args) => ipcRenderer.invoke('git:run', cwd, args) },
  search: { workspace: (root, query) => ipcRenderer.invoke('search:workspace', root, query) },
  settings: { get: () => ipcRenderer.invoke('settings:get'), save: patch => ipcRenderer.invoke('settings:save', patch) }
};

contextBridge.exposeInMainWorld('kz', api);
