import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 120_000;
const MAX_BUFFER = 8 * 1024 * 1024;

export type ToolResult = { stdout: string; stderr: string; code: number | null };
export type ProjectInfo = {
  root: string;
  kind: string;
  packageManager?: string;
  testCommand?: string;
  runCommand?: string;
  debugCommand?: string;
};
export type Diagnostic = { line: number; column: number; message: string; severity: 'error' | 'warning' | 'info'; source: string };

type DevConfig = { command?: string; args?: string[]; cwd?: string; env?: Record<string, string> };

const exists = async (p: string) => { try { await fs.access(p); return true; } catch { return false; } };

async function run(program: string, args: string[], cwd: string, env?: Record<string, string>): Promise<ToolResult> {
  try {
    const r = await execFileAsync(program, args, {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      timeout: TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
      windowsHide: true,
    });
    return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', code: 0 };
  } catch (e: any) {
    return {
      stdout: String(e?.stdout ?? ''),
      stderr: String(e?.stderr ?? e?.message ?? ''),
      code: typeof e?.code === 'number' ? e.code : 1,
    };
  }
}

function splitCommand(s: string) {
  return (s.match(/(?:[^\s"]+|"[^"]*")+/g) ?? []).map(x => x.replace(/^"|"$/g, ''));
}

async function readConfig(root: string, name: string): Promise<DevConfig | null> {
  for (const file of [path.join(root, '.kzide', name), path.join(root, '.vscode', name)]) {
    if (!await exists(file)) continue;
    try {
      const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
      const candidate = Array.isArray(parsed?.configurations) ? parsed.configurations[0] : parsed;
      if (candidate?.command) return candidate as DevConfig;
    } catch { /* invalid optional config: ignore and use project defaults */ }
  }
  return null;
}

function configuredCommand(config: DevConfig | null, fallback?: string) {
  if (!config?.command) return fallback;
  return [config.command, ...(config.args ?? [])].map(x => /\s/.test(x) ? `"${x}"` : x).join(' ');
}

export async function detectProject(root: string): Promise<ProjectInfo> {
  const base = path.resolve(root);
  const launch = await readConfig(base, 'launch.json');
  const tasks = await readConfig(base, 'tasks.json');

  if (await exists(path.join(base, 'package.json'))) {
    let pkg: any = {};
    try { pkg = JSON.parse(await fs.readFile(path.join(base, 'package.json'), 'utf8')); } catch { /* diagnostics reports invalid JSON */ }
    const pm = await exists(path.join(base, 'pnpm-lock.yaml')) ? 'pnpm' : await exists(path.join(base, 'yarn.lock')) ? 'yarn' : await exists(path.join(base, 'bun.lock')) || await exists(path.join(base, 'bun.lockb')) ? 'bun' : 'npm';
    const script = (n: string) => pkg?.scripts?.[n] as string | undefined;
    return {
      root: base,
      kind: 'node',
      packageManager: pm,
      testCommand: script('test') ? `${pm} test` : undefined,
      runCommand: configuredCommand(tasks, script('start') ? `${pm} start` : script('dev') ? `${pm} run dev` : undefined),
      debugCommand: configuredCommand(launch, script('debug') ? `${pm} run debug` : undefined),
    };
  }

  if (await exists(path.join(base, 'Cargo.toml'))) return { root: base, kind: 'rust', testCommand: 'cargo test', runCommand: 'cargo run', debugCommand: 'rust-gdb' };
  if (await exists(path.join(base, 'go.mod'))) return { root: base, kind: 'go', testCommand: 'go test ./...', runCommand: 'go run .', debugCommand: 'dlv debug' };
  if (await exists(path.join(base, 'pyproject.toml')) || await exists(path.join(base, 'pytest.ini'))) return { root: base, kind: 'python', testCommand: 'python -m pytest', runCommand: undefined, debugCommand: 'python -m debugpy --wait-for-client' };
  if (await exists(path.join(base, 'Makefile'))) return { root: base, kind: 'make', testCommand: 'make test', runCommand: 'make run' };
  return { root: base, kind: 'generic' };
}

async function executeDetected(root: string, command: string | undefined, fallbackError: string) {
  if (!command) return { command: null, result: { stdout: '', stderr: fallbackError, code: 1 } as ToolResult };
  const [program, ...args] = splitCommand(command);
  return { command, result: await run(program, args, root) };
}

export async function runTests(root: string, command?: string) {
  const p = await detectProject(root);
  const executed = await executeDetected(p.root, command?.trim() || p.testCommand, 'Nenhum comando de testes detectado.');
  return { ...p, ...executed };
}

export async function runProject(root: string, command?: string) {
  const p = await detectProject(root);
  const executed = await executeDetected(p.root, command?.trim() || p.runCommand, 'Nenhum comando de execução detectado.');
  return { ...p, ...executed };
}

export async function debugProject(root: string, command?: string) {
  const p = await detectProject(root);
  const executed = await executeDetected(p.root, command?.trim() || p.debugCommand, 'Nenhum depurador configurado para este projeto.');
  return { ...p, ...executed };
}

function parseDiagnostics(text: string, source: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const line of text.split('\n')) {
    let m = line.match(/^(.*?)[(:](\d+)[,:](\d+)\)?[:\s-]+(?:error|warning)(?:\s+TS\d+)?[:\s-]*(.*)$/i);
    if (m) {
      out.push({ line: Number(m[2]), column: Number(m[3]), message: m[4].trim(), severity: /warning/i.test(line) ? 'warning' : 'error', source });
      continue;
    }
    m = line.match(/^(.*?):(\d+):(\d+):\s*(error|warning):\s*(.*)$/i);
    if (m) out.push({ line: Number(m[2]), column: Number(m[3]), message: m[5].trim(), severity: m[4].toLowerCase() === 'warning' ? 'warning' : 'error', source });
  }
  return out;
}

export async function diagnostics(root: string): Promise<Diagnostic[]> {
  const p = await detectProject(root);
  const out: Diagnostic[] = [];

  if (p.kind === 'node') {
    try { JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')); }
    catch (e) { out.push({ line: 1, column: 1, message: `package.json inválido: ${e instanceof Error ? e.message : String(e)}`, severity: 'error', source: 'json' }); }
    const tsc = path.join(root, 'node_modules', '.bin', 'tsc');
    if (await exists(tsc)) {
      const r = await run(tsc, ['--noEmit', '--pretty', 'false'], root);
      out.push(...parseDiagnostics(`${r.stdout}\n${r.stderr}`, 'tsc'));
    }
  }

  if (p.kind === 'rust') {
    const r = await run('cargo', ['check', '--message-format', 'short'], root);
    out.push(...parseDiagnostics(`${r.stderr}\n${r.stdout}`, 'cargo'));
  }

  if (p.kind === 'go') {
    const r = await run('go', ['test', './...', '-run', '^$'], root);
    out.push(...parseDiagnostics(`${r.stderr}\n${r.stdout}`, 'go'));
  }

  if (p.kind === 'python') {
    const r = await run('python', ['-m', 'compileall', '-q', '.'], root);
    if (r.code !== 0) out.push({ line: 1, column: 1, message: (r.stderr || r.stdout).trim() || 'Falha de sintaxe Python.', severity: 'error', source: 'python' });
  }

  return out;
}
