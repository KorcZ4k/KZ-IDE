import { app } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type KZSettings = {
  fontSize: number;
  minimap: boolean;
  wordWrap: 'off' | 'on';
  autoSave: boolean;
  confirmDelete: boolean;
};

const defaults: KZSettings = {
  fontSize: 13,
  minimap: false,
  wordWrap: 'off',
  autoSave: false,
  confirmDelete: true
};

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

export async function loadSettings(): Promise<KZSettings> {
  try {
    const parsed = JSON.parse(await readFile(settingsPath(), 'utf8')) as Partial<KZSettings>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export async function saveSettings(patch: Partial<KZSettings>): Promise<KZSettings> {
  const next = { ...(await loadSettings()), ...patch };
  await mkdir(path.dirname(settingsPath()), { recursive: true });
  await writeFile(settingsPath(), JSON.stringify(next, null, 2), 'utf8');
  return next;
}
