import { dialog, ipcMain } from 'electron';
import { readTree, fileSystem } from './filesystem';
import { defaultCwd, runCommand } from './terminal';

export function registerIpc() {
  ipcMain.handle('workspace:open', async (event) => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    return result.canceled ? null : result.filePaths[0] ?? null;
  });
  ipcMain.handle('workspace:tree', (_event, root: string) => readTree(root));
  ipcMain.handle('file:read', (_event, filePath: string) => fileSystem.read(filePath));
  ipcMain.handle('file:write', (_event, filePath: string, content: string) => fileSystem.write(filePath, content));
  ipcMain.handle('file:create', (_event, filePath: string, kind: 'file' | 'folder') => fileSystem.create(filePath, kind));
  ipcMain.handle('file:remove', (_event, filePath: string) => fileSystem.remove(filePath));
  ipcMain.handle('file:rename', (_event, oldPath: string, newPath: string) => fileSystem.rename(oldPath, newPath));
  ipcMain.handle('terminal:cwd', () => defaultCwd());
  ipcMain.handle('terminal:run', (_event, command: string, cwd?: string) => runCommand(command, cwd));
}
