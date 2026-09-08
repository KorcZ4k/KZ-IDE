type ToolResult = { stdout: string; stderr: string; code: number | null };
type ProjectInfo = { root: string; kind: string; packageManager?: string; testCommand?: string; runCommand?: string; debugCommand?: string };
type Diagnostic = { line: number; column: number; message: string; severity: 'error' | 'warning' | 'info'; source?: string };

declare global { interface Window { kz: any } }

const style = document.createElement('style');
style.textContent = `
#kz-dev-toggle{position:fixed;right:10px;top:7px;z-index:9999;border:1px solid #555;background:#0b0b0b;color:#aaa;font:9px monospace;padding:5px 8px;cursor:pointer}#kz-dev-toggle:hover{color:#fff;border-color:#888}
#kz-dev-overlay{position:fixed;inset:38px 0 25px 0;z-index:9998;background:rgba(0,0,0,.72);display:none;font:11px monospace;color:#ddd}#kz-dev-overlay.open{display:flex;justify-content:flex-end}
#kz-dev-panel{width:min(760px,92vw);height:100%;background:#0a0a0a;border-left:1px solid #444;display:flex;flex-direction:column}
.kz-dev-head{height:38px;border-bottom:1px solid #292929;display:flex;align-items:center;padding:0 12px;gap:16px}.kz-dev-head strong{font-size:10px}.kz-dev-head button{margin-left:auto;border:0;background:transparent;color:#777;cursor:pointer}.kz-dev-head button:hover{color:#fff}
.kz-dev-toolbar{display:flex;gap:6px;padding:9px 12px;border-bottom:1px solid #292929}.kz-dev-toolbar button,.kz-dev-command button{border:1px solid #444;background:#111;color:#bbb;padding:6px 9px;font:10px monospace;cursor:pointer}.kz-dev-toolbar button:hover,.kz-dev-command button:hover{background:#222;color:#fff}
.kz-dev-info{padding:9px 12px;color:#777;border-bottom:1px solid #222;line-height:18px}.kz-dev-info b{color:#ccc}.kz-dev-output{flex:1;overflow:auto;padding:10px 12px;white-space:pre-wrap;color:#aaa}.kz-dev-command{display:flex;gap:6px;padding:9px 12px;border-top:1px solid #292929}.kz-dev-command input{flex:1;background:#080808;border:1px solid #333;color:#ddd;padding:6px;font:10px monospace;outline:none}.kz-dev-diag{padding:7px 0;border-bottom:1px solid #222;cursor:pointer}.kz-dev-diag:hover{background:#151515}.kz-dev-diag.error{color:#ddd}.kz-dev-diag.warning{color:#aaa}.kz-dev-diag small{display:block;color:#666;margin-top:3px}
`;
document.head.appendChild(style);

const toggle = document.createElement('button');
toggle.id = 'kz-dev-toggle';
toggle.textContent = 'DEV';
document.body.appendChild(toggle);

const overlay = document.createElement('div');
overlay.id = 'kz-dev-overlay';
overlay.innerHTML = `<section id="kz-dev-panel"><header class="kz-dev-head"><strong>RUN & DEBUG</strong><span id="kz-dev-status">idle</span><button id="kz-dev-close">×</button></header><div class="kz-dev-toolbar"><button data-action="run">F5 RUN</button><button data-action="debug">F6 DEBUG</button><button data-action="test">TEST</button><button data-action="diag">DIAGNOSTICS</button><button data-action="clear">CLEAR</button></div><div class="kz-dev-info" id="kz-dev-info">Detectando projeto...</div><div class="kz-dev-output" id="kz-dev-output"></div><div class="kz-dev-command"><input id="kz-dev-command" placeholder="comando opcional..."/><button id="kz-dev-exec">EXEC</button></div></section>`;
document.body.appendChild(overlay);

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const output = $('kz-dev-output');
const info = $('kz-dev-info');
const status = $('kz-dev-status');
let root: string | null = null;
let project: ProjectInfo | null = null;

function print(text: string) { output.textContent += `${text}\n`; output.scrollTop = output.scrollHeight; }
function setStatus(text: string) { status.textContent = text; }

async function loadProject() {
  const state = await window.kz.workspace.last();
  root = state.workspace;
  if (!root) { project = null; info.textContent = 'Nenhum workspace aberto.'; return; }
  project = await window.kz.dev.project(root);
  info.innerHTML = `<b>${project.kind}</b> · ${escapeHtml(project.root)}<br>run: ${escapeHtml(project.runCommand ?? '—')} · test: ${escapeHtml(project.testCommand ?? '—')} · debug: ${escapeHtml(project.debugCommand ?? '—')}`;
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!)); }

async function execute(kind: 'run' | 'debug' | 'test', command?: string) {
  if (!root) await loadProject();
  if (!root) return;
  setStatus(kind);
  const result = await window.kz.dev[kind === 'test' ? 'tests' : kind](root, command?.trim() || undefined) as { command?: string | null; result: ToolResult };
  print(`$ ${result.command ?? '(nenhum comando)'}`);
  print(result.result.stdout || result.result.stderr || 'Concluído.');
  print(result.result.code === 0 ? '✓ sucesso' : `✕ código ${result.result.code}`);
  setStatus('idle');
}

async function showDiagnostics() {
  if (!root) await loadProject();
  if (!root) return;
  setStatus('diagnostics');
  const diagnostics = await window.kz.dev.diagnostics(root) as Diagnostic[];
  output.innerHTML = '';
  if (!diagnostics.length) { output.textContent = '✓ Nenhum diagnóstico encontrado.'; setStatus('clean'); return; }
  diagnostics.forEach(d => { const el = document.createElement('div'); el.className = `kz-dev-diag ${d.severity}`; el.innerHTML = `${escapeHtml(d.message)}<small>${escapeHtml(d.source ?? 'tool')} · linha ${d.line}, coluna ${d.column}</small>`; output.appendChild(el); });
  setStatus(`${diagnostics.length} problemas`);
}

toggle.onclick = () => { overlay.classList.toggle('open'); if (overlay.classList.contains('open')) void loadProject(); };
$('kz-dev-close').onclick = () => overlay.classList.remove('open');
$('kz-dev-exec').onclick = () => void execute('run', ($('kz-dev-command') as HTMLInputElement).value);
($('kz-dev-command') as HTMLInputElement).onkeydown = e => { if (e.key === 'Enter') void execute('run', (e.currentTarget as HTMLInputElement).value); };
overlay.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => button.onclick = () => {
  const action = button.dataset.action;
  if (action === 'clear') output.textContent = '';
  else if (action === 'diag') void showDiagnostics();
  else if (action === 'run' || action === 'debug' || action === 'test') void execute(action);
});
window.addEventListener('keydown', e => {
  if (e.key === 'F5') { e.preventDefault(); overlay.classList.add('open'); void execute('run'); }
  if (e.key === 'F6') { e.preventDefault(); overlay.classList.add('open'); void execute('debug'); }
  if (e.key === 'F8') { e.preventDefault(); overlay.classList.add('open'); void showDiagnostics(); }
});
