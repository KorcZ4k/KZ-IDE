import { execFile } from 'node:child_process';

function git(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    execFile('git', args, { cwd, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ stdout: String(stdout), stderr: String(stderr), code: error?.code && typeof error.code === 'number' ? error.code : error ? 1 : 0 });
    });
  });
}

export async function gitStatus(cwd: string) {
  const branch = await git(cwd, ['branch', '--show-current']);
  const status = await git(cwd, ['status', '--short']);
  return {
    branch: branch.stdout.trim() || 'detached',
    clean: status.stdout.trim().length === 0,
    files: status.stdout.split('\n').filter(Boolean).map((line) => ({ path: line.slice(3), status: line.slice(0, 2).trim() }))
  };
}

export const gitDiff = (cwd: string, file?: string) => git(cwd, file ? ['diff', '--', file] : ['diff']);
export { git };
