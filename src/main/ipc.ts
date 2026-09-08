import { dialog, ipcMain } from 'electron';
import { readTree, fileSystem } from './filesystem';
import { defaultCwd, runCommand } from './terminal';
import { git, gitDiff, gitStatus } from './git';
import { loadWorkspaceState, saveWorkspaceState } from './workspace-state';
import { loadSettings, saveSettings } from './settings';
import { searchWorkspace } from './search';
import { checkForUpdates, downloadUpdate, getUpdateStatus, installUpdate } from './updater';
import { debugProject, detectProject, diagnostics, runProject, runTests } from './development';
import { debugCommand, debugSnapshot, setBreakpoint, startNodeDebug } from './debugger';
import type { KZSettings } from './settings';
async function workspaceRoot(){const root=(await loadWorkspaceState()).workspace;if(!root)throw new Error('Nenhum workspace aberto.');return root;}
export function registerIpc(){
 ipcMain.handle('workspace:open',async()=>{const r=await dialog.showOpenDialog({properties:['openDirectory','createDirectory']});if(r.canceled||!r.filePaths[0])return null;await saveWorkspaceState(r.filePaths[0]);return r.filePaths[0];});
 ipcMain.handle('workspace:last',()=>loadWorkspaceState()); ipcMain.handle('workspace:tree',(_e,root:string)=>readTree(root));
 ipcMain.handle('file:read',async(_e,p:string)=>fileSystem.read(await workspaceRoot(),p)); ipcMain.handle('file:write',async(_e,p:string,c:string)=>fileSystem.write(await workspaceRoot(),p,c)); ipcMain.handle('file:create',async(_e,p:string,k:'file'|'folder')=>fileSystem.create(await workspaceRoot(),p,k)); ipcMain.handle('file:remove',async(_e,p:string)=>fileSystem.remove(await workspaceRoot(),p)); ipcMain.handle('file:rename',async(_e,a:string,b:string)=>fileSystem.rename(await workspaceRoot(),a,b));
 ipcMain.handle('terminal:cwd',()=>defaultCwd()); ipcMain.handle('terminal:run',(_e,c:string,cwd?:string)=>runCommand(c,cwd));
 ipcMain.handle('git:status',(_e,cwd:string)=>gitStatus(cwd)); ipcMain.handle('git:diff',(_e,cwd:string,f?:string)=>gitDiff(cwd,f)); ipcMain.handle('git:run',(_e,cwd:string,args:string[])=>git(cwd,args));
 ipcMain.handle('search:workspace',(_e,root:string,q:string)=>searchWorkspace(root,q)); ipcMain.handle('settings:get',()=>loadSettings()); ipcMain.handle('settings:save',(_e,p:Partial<KZSettings>)=>saveSettings(p));
 ipcMain.handle('dev:project',async(_e,root:string)=>detectProject(root)); ipcMain.handle('dev:tests',async(_e,root:string,c?:string)=>runTests(root,c)); ipcMain.handle('dev:run',async(_e,root:string,c?:string)=>runProject(root,c)); ipcMain.handle('dev:debug',async(_e,root:string,c?:string)=>debugProject(root,c)); ipcMain.handle('dev:diagnostics',async(_e,root:string)=>diagnostics(root));
 ipcMain.handle('debug:start',async(_e,root:string,c?:string)=>startNodeDebug(root,c)); ipcMain.handle('debug:breakpoint',async(_e,id:string,file:string,line:number)=>setBreakpoint(id,file,line)); ipcMain.handle('debug:command',async(_e,id:string,c:'continue'|'pause'|'next'|'stepIn'|'stepOut'|'stop')=>debugCommand(id,c)); ipcMain.handle('debug:snapshot',(_e,id:string)=>debugSnapshot(id));
 ipcMain.handle('update:status',()=>getUpdateStatus()); ipcMain.handle('update:check',()=>checkForUpdates()); ipcMain.handle('update:download',()=>downloadUpdate()); ipcMain.handle('update:install',()=>installUpdate());
}