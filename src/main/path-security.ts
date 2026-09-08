import path from 'node:path';

export function resolveInside(root: string, target: string): string {
  const base = path.resolve(root);
  const resolved = path.resolve(target);
  if (resolved !== base && !resolved.startsWith(`${base}${path.sep}`)) {
    throw new Error('Operação fora do workspace não permitida.');
  }
  return resolved;
}
