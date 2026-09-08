import { exec, type ExecException } from 'node:child_process';
import process from 'node:process';

const MAX_BUFFER = 4 * 1024 * 1024;
const TIMEOUT_MS = 60_000;

export function runCommand(command: string, cwd?: string) {
  const normalized = command.trim();
  if (!normalized) return Promise.resolve({ stdout: '', stderr: '', code: 0 });
  if (normalized.length > 16_384) return Promise.resolve({ stdout: '', stderr: 'Comando excede o limite de 16 KB.', code: 1 });

  return new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve) => {
    exec(normalized, { cwd, windowsHide: true, maxBuffer: MAX_BUFFER, timeout: TIMEOUT_MS }, (error: ExecException | null, stdout: string, stderr: string) => {
      const timedOut = error && 'killed' in error && error.killed;
      resolve({ stdout: String(stdout), stderr: timedOut ? `${String(stderr)}\nProcesso encerrado por timeout de 60s.`.trim() : String(stderr), code: error ? (typeof error.code === 'number' ? error.code : 1) : 0 });
    });
  });
}

export const defaultCwd = () => process.cwd();
