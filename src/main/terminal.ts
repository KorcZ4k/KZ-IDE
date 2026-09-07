import { exec } from 'node:child_process';
import process from 'node:process';

export function runCommand(command: string, cwd?: string) {
  return new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve) => {
    exec(command, { cwd, shell: true, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ stdout, stderr, code: error ? (error.code ?? 1) : 0 });
    });
  });
}

export const defaultCwd = () => process.cwd();
