import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileNode } from '../shared/api';

const ignored = new Set(['.git', 'node_modules', '.DS_Store']);

export async function readTree(root: string): Promise<FileNode[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const nodes = await Promise.all(entries.filter((entry) => !ignored.has(entry.name)).map(async (entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) return { name: entry.name, path: fullPath, kind: 'folder' as const, children: await readTree(fullPath) };
    return { name: entry.name, path: fullPath, kind: 'file' as const };
  }));
  return nodes.sort((a, b) => Number(b.kind === 'folder') - Number(a.kind === 'folder') || a.name.localeCompare(b.name));
}

export const fileSystem = {
  read: (filePath: string) => fs.readFile(filePath, 'utf8'),
  write: (filePath: string, content: string) => fs.writeFile(filePath, content, 'utf8'),
  create: async (filePath: string, kind: 'file' | 'folder') => kind === 'folder' ? fs.mkdir(filePath, { recursive: true }) : fs.writeFile(filePath, '', 'utf8'),
  remove: (filePath: string) => fs.rm(filePath, { recursive: true, force: true }),
  rename: (oldPath: string, newPath: string) => fs.rename(oldPath, newPath)
};
