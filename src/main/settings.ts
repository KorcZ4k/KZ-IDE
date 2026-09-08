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

const defaults: KZSettings = { fontSize: 13, minimap: false, wordWrap: 'off', autoSave: false, confirmDelete: true };
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

function normalize(value: Partial<KZSettings>): KZSettings {
  return {
    fontSize: Number.isFinite(value.fontSize) ? Math.min(32, Math.max(8, Math.round(value.fontSize!))) : defaults.fontSize,
    minimap: typeof value.minimap === 'boolean' ? value.minimap : defaults.minimap,
    wordWrap: value.wordWrap === 'on' ? 'on' : 'off',
    autoSave: typeof value.autoSave === 'boolean' ? value.autoSave : defaults.autoSave,
    confirmDelete: typeof value.confirmDelete === 'boolean' ? value.confirmDelete : defaults.confirmDelete
  };
}

export async function loadSettings(): Promise<KZSettings> {
  try { return normalize(JSON.parse(await readFile(settingsPath(), 'utf8')) as Partial<KZSettings>); }
  catch { return defaults; }
}

export async function saveSettings(patch: Partial<KZSettings>): Promise<KZSettings> {
  const next = normalize({ ...(await loadSettings()), ...patch });
  await mkdir(path.dirname(settingsPath()), { recursive: true });
  await writeFile(settingsPath(), JSON.stringify(next, null, 2), 'utf8');
  return next;
}
