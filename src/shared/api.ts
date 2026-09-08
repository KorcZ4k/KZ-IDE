export type FileNode = { name: string; path: string; kind: 'file' | 'folder'; children?: FileNode[] };
export type Diagnostic = { line: number; column: number; message: string; severity: 'error' | 'warning' | 'info' };
export type GitStatus = { branch: string; clean: boolean; files: { path: string; status: string }[] };
export type WorkspaceState = { workspace: string | null; recent: string[] };
export type SearchMatch = { path: string; line: number; text: string };
export type KZSettings = { fontSize: number; minimap: boolean; wordWrap: 'off' | 'on'; autoSave: boolean; confirmDelete: boolean };
export type KZApi = {
  workspace: { open: () => Promise<string | null>; last: () => Promise<WorkspaceState>; readTree: (root: string) => Promise<FileNode[]> };
  file: { read: (path: string) => Promise<string>; write: (path: string, content: string) => Promise<void>; create: (path: string, kind: 'file' | 'folder') => Promise<void>; remove: (path: string) => Promise<void>; rename: (oldPath: string, newPath: string) => Promise<void> };
  terminal: { cwd: () => Promise<string>; run: (command: string, cwd?: string) => Promise<{ stdout: string; stderr: string; code: number | null }> };
  git: { status: (cwd: string) => Promise<GitStatus>; diff: (cwd: string, file?: string) => Promise<string>; run: (cwd: string, args: string[]) => Promise<{ stdout: string; stderr: string; code: number | null }> };
  search: { workspace: (root: string, query: string) => Promise<SearchMatch[]> };
  settings: { get: () => Promise<KZSettings>; save: (patch: Partial<KZSettings>) => Promise<KZSettings> };
};
