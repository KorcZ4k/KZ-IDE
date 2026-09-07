import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export type SearchMatch = { path: string; line: number; text: string };

const ignored = new Set(['.git', 'node_modules', 'dist', 'build', '.DS_Store']);
const allowed = /\.(ts|tsx|js|jsx|json|css|html|md|py|rs|go|java|cpp|c|h|hpp|toml|yaml|yml|xml|sh)$/i;

export async function searchWorkspace(root: string, query: string): Promise<SearchMatch[]> {
  const matches: SearchMatch[] = [];
  if (!query.trim()) return matches;
  const needle = query.toLowerCase();

  async function walk(dir: string): Promise<void> {
    if (matches.length >= 200) return;
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (matches.length >= 200 || ignored.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { await walk(full); continue; }
      if (!entry.isFile() || !allowed.test(entry.name)) continue;
      let content = '';
      try { content = await readFile(full, 'utf8'); } catch { continue; }
      content.split(/\r?\n/).forEach((text, index) => {
        if (matches.length < 200 && text.toLowerCase().includes(needle)) matches.push({ path: full, line: index + 1, text: text.trim().slice(0, 240) });
      });
    }
  }

  await walk(root);
  return matches;
}
