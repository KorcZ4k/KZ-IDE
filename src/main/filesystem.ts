import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileNode } from '../shared/api';

const ignored = new Set(['.git', 'node_modules', 'dist', 'build', '.DS_Store']);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function assertPath(root: string, target: string) {
  const base = path.resolve(root);
  const resolved = path.resolve(target);
  if (resolved !== base && !resolved.startsWith(`${base}${path.sep}`)) {
    throw new Error('Operação fora do workspace não permitida.');
  }
  return resolved;
}

export async function readTree(root: string): Promise<FileNode[]> {
  const base = path.resolve(root);
  const entries = await fs.readdir(base, { withFileTypes: true });
  const nodes = await Promise.all(entries.filter(e => !ignored.has(e.name)).map(async entry => {
    const fullPath = path.join(base, entry.name);
    if (entry.isDirectory()) return { name: entry.name, path: fullPath, kind: 'folder' as const, children: await readTree(fullPath) };
    return { name: entry.name, path: fullPath, kind: 'file' as const };
  }));
  return nodes.sort((a, b) => Number(b.kind === 'folder') - Number(a.kind === 'folder') || a.name.localeCompare(b.name));
}

export const fileSystem = {
  read: async (root: string, filePath: string) => {
    const safe = assertPath(root, filePath);
    const stat = await fs.stat(safe);
    if (!stat.isFile()) throw new Error('O caminho não é um arquivo.');
    if (stat.size > MAX_FILE_SIZE) throw new Error('Arquivo excede o limite de 10 MB.');
    return fs.readFile(safe, 'utf8');
  },
  write: async (root: string, filePath: string, content: string) => fs.writeFile(assertPath(root, filePath), content, 'utf8'),
  create: async (root: string, filePath: string, kind: 'file' | 'folder') => {
    const safe = assertPath(root, filePath);
    if (kind === 'folder') await fs.mkdir(safe, { recursive: true });
    else await fs.writeFile(safe, '', { encoding: 'utf8', flag: 'wx' });
  },
  remove: async (root: string, filePath: string) => {
    const safe = assertPath(root, filePath);
    if (safe === path.resolve(root)) throw new Error('Não é permitido excluir o workspace.');
    await fs.rm(safe, { recursive: true, force: true });
  },
  rename: async (root: string, oldPath: string, newPath: string) => {
    const oldSafe = assertPath(root, oldPath);
    const newSafe = assertPath(root, newPath);
    await fs.rename(oldSafe, newSafe);
  }
};
