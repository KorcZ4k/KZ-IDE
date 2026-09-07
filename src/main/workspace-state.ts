import { app } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type State = { workspace: string | null; recent: string[] };
const statePath = () => path.join(app.getPath('userData'), 'workspace.json');
const empty: State = { workspace: null, recent: [] };

export async function loadWorkspaceState(): Promise<State> {
  try { return { ...empty, ...JSON.parse(await readFile(statePath(), 'utf8')) }; }
  catch { return empty; }
}

export async function saveWorkspaceState(workspace: string | null) {
  const current = await loadWorkspaceState();
  const recent = workspace ? [workspace, ...current.recent.filter(x => x !== workspace)].slice(0, 8) : current.recent;
  await mkdir(path.dirname(statePath()), { recursive: true });
  await writeFile(statePath(), JSON.stringify({ workspace, recent }, null, 2), 'utf8');
  return { workspace, recent };
}
