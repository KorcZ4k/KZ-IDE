import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as monaco from 'monaco-editor';
import type { FileNode, GitStatus, KZSettings, SearchMatch } from '../shared/api';
import './styles.css';

type OpenFile = { path: string; name: string; content: string; dirty: boolean };
const languageFor = (name: string) => ({ ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', json: 'json', css: 'css', html: 'html', md: 'markdown', py: 'python', rs: 'rust', go: 'go', java: 'java', cpp: 'cpp', c: 'cpp' } as Record<string, string>)[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'plaintext';

const keywords: Record<string, string[]> = {
  typescript: ['const', 'let', 'function', 'interface', 'type', 'class', 'async', 'await', 'import', 'export', 'return'],
  javascript: ['const', 'let', 'function', 'class', 'async', 'await', 'import', 'export', 'return'],
  python: ['def', 'class', 'import', 'from', 'async', 'await', 'return', 'yield', 'with', 'lambda'],
  rust: ['fn', 'struct', 'enum', 'impl', 'trait', 'let', 'mut', 'use', 'pub', 'async', 'await'],
  go: ['func', 'struct', 'interface', 'package', 'import', 'defer', 'go', 'chan', 'return'],
  java: ['class', 'interface', 'public', 'private', 'static', 'final', 'void', 'new', 'return'],
  cpp: ['class', 'struct', 'namespace', 'template', 'const', 'auto', 'void', 'return'],
  c: ['struct', 'typedef', 'const', 'static', 'void', 'int', 'char', 'return']
};

function App() {
  const [root, setRoot] = useState<string | null>(null);
  const [tree, setTree] = useState<FileNode[]>([]);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [terminalLines, setTerminalLines] = useState<string[]>(['Aurora Terminal', 'Pronto para comandos.']);
  const [command, setCommand] = useState('');
  const [palette, setPalette] = useState(false);
  const [fileSearch, setFileSearch] = useState(false);
  const [contentSearch, setContentSearch] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [contentResults, setContentResults] = useState<SearchMatch[]>([]);
  const [notice, setNotice] = useState('Pronto');
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [gitPanel, setGitPanel] = useState(false);
  const [problemsOpen, setProblemsOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [settings, setSettings] = useState<KZSettings>({ fontSize: 13, minimap: false, wordWrap: 'off', autoSave: false, confirmDelete: true });
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(localStorage.getItem('aurora.sidebarWidth')) || 286);
  const [terminalHeight, setTerminalHeight] = useState(() => Number(localStorage.getItem('aurora.terminalHeight')) || 235);
  const active = openFiles.find(f => f.path === activePath) ?? null;

  const refresh = async (workspace = root) => {
    if (!workspace) return;
    try { setTree(await window.kz.workspace.readTree(workspace)); setGitStatus(await window.kz.git.status(workspace)); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Erro ao atualizar workspace.'); }
  };

  const openWorkspace = async () => {
    try {
      const selected = await window.kz.workspace.open();
      if (!selected) return;
      setRoot(selected); setRecent(r => [selected, ...r.filter(x => x !== selected)].slice(0, 8));
      setOpenFiles([]); setActivePath(null); await refresh(selected); setNotice(selected);
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Não foi possível abrir a pasta.'); }
  };

  const openRecent = async (path: string) => { setRoot(path); setOpenFiles([]); setActivePath(null); await refresh(path); setNotice(path); };

  const openFile = async (node: FileNode, line?: number) => {
    if (node.kind !== 'file') return;
    const existing = openFiles.find(f => f.path === node.path);
    if (existing) { setActivePath(node.path); setNotice(line ? `Linha ${line}` : 'Arquivo ativo'); return; }
    try { const content = await window.kz.file.read(node.path); setOpenFiles(f => [...f, { path: node.path, name: node.name, content, dirty: false }]); setActivePath(node.path); setNotice(line ? `Linha ${line}` : node.name); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Erro ao abrir arquivo.'); }
  };

  const saveActive = async () => {
    if (!active) return;
    try { await window.kz.file.write(active.path, active.content); setOpenFiles(fs => fs.map(f => f.path === active.path ? { ...f, dirty: false } : f)); setNotice('Salvo'); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Erro ao salvar.'); }
  };

  const createFile = async () => {
    if (!root) { await openWorkspace(); return; }
    const name = window.prompt('Nome do novo arquivo:', 'novo.ts');
    if (!name?.trim()) return;
    const fileName = name.trim();
    try {
      const target = `${root}/${fileName}`;
      await window.kz.file.create(target, 'file');
      await refresh();
      const node: FileNode = { name: fileName, path: target, kind: 'file' };
      setOpenFiles(fs => [...fs, { path: target, name: fileName, content: '', dirty: false }]);
      setActivePath(target);
      setNotice(`Criado: ${fileName}`);
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Não foi possível criar o arquivo.'); }
  };

  const removeActive = async () => {
    if (!active) return;
    if (settings.confirmDelete && !window.confirm(`Excluir ${active.name}?`)) return;
    try { await window.kz.file.remove(active.path); setOpenFiles(fs => fs.filter(f => f.path !== active.path)); setActivePath(null); await refresh(); setNotice('Arquivo removido'); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Não foi possível excluir o arquivo.'); }
  };

  const runCommand = async (value: string) => {
    const trimmed = value.trim(); if (!trimmed) return;
    try {
      const cwd = root ?? await window.kz.terminal.cwd(); setTerminalLines(l => [...l, `$ ${trimmed}`]); setCommand('');
      const result = await window.kz.terminal.run(trimmed, cwd); const output = `${result.stdout}${result.stderr}`.trimEnd();
      setTerminalLines(l => [...l, ...(output ? output.split('\n') : ['Concluído.']), result.code === 0 ? '✓ processo concluído' : `✕ código ${result.code}`]);
    } catch (e) { setTerminalLines(l => [...l, `✕ ${e instanceof Error ? e.message : 'Erro no terminal'}`]); }
  };

  const saveSettings = async (patch: Partial<KZSettings>) => { const next = await window.kz.settings.save(patch); setSettings(next); setNotice('Configurações salvas'); };
  const searchContent = async () => { if (!root || !searchText.trim()) { setContentResults([]); return; } setContentResults(await window.kz.search.workspace(root, searchText)); };

  useEffect(() => { void Promise.all([window.kz.workspace.last(), window.kz.settings.get()]).then(([state, saved]) => { setRecent(state.recent); setSettings(saved); if (state.workspace) { setRoot(state.workspace); void refresh(state.workspace); } }).catch(e => setNotice(e instanceof Error ? e.message : 'Erro ao carregar preferências.')); }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); void saveActive(); }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); setPalette(true); }
      if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); setFileSearch(true); }
      if (mod && e.key.toLowerCase() === 'f') { e.preventDefault(); setContentSearch(true); }
      if (mod && e.key === ',') { e.preventDefault(); setSettingsOpen(true); }
      if (e.key === 'Escape') { setPalette(false); setFileSearch(false); setContentSearch(false); setSettingsOpen(false); }
      if (mod && e.key === '`') { e.preventDefault(); setTerminalOpen(o => !o); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [active]);

  const flatFiles = useMemo(() => flatten(tree), [tree]);
  const filtered = searchText ? flatFiles.filter(n => n.name.toLowerCase().includes(searchText.toLowerCase())) : flatFiles;
  const gitAction = async (args: string[]) => { if (!root) return; const result = await window.kz.git.run(root, args); setTerminalLines(l => [...l, `$ git ${args.join(' ')}`, ...(result.stdout + result.stderr).trim().split('\n').filter(Boolean), result.code === 0 ? '✓' : '✕']); await refresh(); };

  const startResize = (kind: 'sidebar' | 'terminal', event: React.MouseEvent) => {
    event.preventDefault();
    const startX = event.clientX, startY = event.clientY;
    const initial = kind === 'sidebar' ? sidebarWidth : terminalHeight;
    const move = (e: MouseEvent) => {
      if (kind === 'sidebar') { const value = Math.min(520, Math.max(210, initial + e.clientX - startX)); setSidebarWidth(value); localStorage.setItem('aurora.sidebarWidth', String(value)); }
      else { const value = Math.min(520, Math.max(140, initial - (e.clientY - startY))); setTerminalHeight(value); localStorage.setItem('aurora.terminalHeight', String(value)); }
    };
    const up = () => { document.body.classList.remove('resizing'); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    document.body.classList.add('resizing'); window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };

  const closeAllOverlays = (e: React.MouseEvent<HTMLDivElement>) => { if (e.target === e.currentTarget) { setPalette(false); setFileSearch(false); setContentSearch(false); setSettingsOpen(false); } };

  return <div className="app">
    <header className="titlebar"><div className="brand"><span className="brand-mark">A</span><strong>Aurora</strong><span className="brand-sub">KORCZAK IDE</span></div><nav className="menu"><button onClick={() => void openWorkspace()}>File</button><button onClick={() => setPalette(true)}>Edit</button><button onClick={() => setFileSearch(true)}>View</button><button onClick={() => setTerminalOpen(o => !o)}>Run</button><button onClick={() => setTerminalOpen(o => !o)}>Terminal</button><button onClick={() => setSettingsOpen(true)}>Preferences</button></nav><div className="workspace-name">{root ? root.split(/[\\/]/).pop() : 'sem workspace'}</div></header>
    <main className="workspace">
      <aside className="activitybar"><button className="activity active" title="Explorer">▤</button><button className="activity" title="Pesquisar no projeto" onClick={() => setContentSearch(true)}>⌕</button><button className={`activity ${gitPanel ? 'active' : ''}`} title="Source Control" onClick={() => setGitPanel(p => !p)}>⑂{gitStatus && !gitStatus.clean && <i>{gitStatus.files.length}</i>}</button><button className={`activity ${problemsOpen ? 'active' : ''}`} title="Problemas" onClick={() => setProblemsOpen(p => !p)}>⚠</button><button className="activity" title="Run and Debug" onClick={() => window.dispatchEvent(new Event('kz-open-debug'))}>▷</button><button className="activity" title="Configurações" onClick={() => setSettingsOpen(true)}>⚙</button></aside>
      <aside className="sidebar" style={{ width: sidebarWidth }}><div className="sidebar-head"><span>{gitPanel ? 'SOURCE CONTROL' : 'EXPLORER'}</span>{!gitPanel && <div><button title="Abrir pasta" onClick={() => void openWorkspace()}>⌂</button><button title="Novo arquivo" onClick={() => void createFile()}>＋</button></div>}</div>{gitPanel ? <GitPanel status={gitStatus} onAction={gitAction} /> : <><div className="section-title">{root ? root.split(/[\\/]/).pop() : 'ABRA UM WORKSPACE'}</div>{root ? <FileTree nodes={tree} onOpen={openFile} /> : <div className="empty"><p>Um ambiente de desenvolvimento profissional para código, Git, terminal e debug.</p>{recent.length > 0 && <div className="recent"><small>RECENTES</small>{recent.slice(0, 5).map(p => <button key={p} onClick={() => void openRecent(p)}>{p.split(/[\\/]/).pop()}<span>{p}</span></button>)}</div>}<button className="primary" onClick={() => void openWorkspace()}>Abrir pasta</button></div>}</>}</aside>
      <div className="resize-handle vertical" onMouseDown={e => startResize('sidebar', e)} title="Arraste para redimensionar" />
      <section className="main-area"><div className="tabs">{openFiles.map(file => <button key={file.path} className={`tab ${file.path === activePath ? 'active' : ''}`} onClick={() => setActivePath(file.path)}><span className="file-dot">{file.dirty ? '●' : '•'}</span>{file.name}<span className="close" onClick={e => { e.stopPropagation(); setOpenFiles(fs => fs.filter(f => f.path !== file.path)); if (file.path === activePath) setActivePath(null); }}>×</span></button>)}<button className="new-tab" onClick={() => setPalette(true)}>＋</button></div><div className="editor">{active ? <MonacoEditor file={active} settings={settings} onChange={content => setOpenFiles(fs => fs.map(f => f.path === active.path ? { ...f, content, dirty: true } : f))} onNotice={setNotice} /> : <Welcome onOpen={openWorkspace} onCreate={createFile} />}</div>{terminalOpen && <><div className="resize-handle horizontal" onMouseDown={e => startResize('terminal', e)} title="Arraste para redimensionar terminal" /><section className="terminal" style={{ height: terminalHeight }}><div className="panel-tabs"><span className="panel-active">TERMINAL</span><span className={problemsOpen ? '' : 'clickable'} onClick={() => setProblemsOpen(true)}>PROBLEMS</span><span>OUTPUT</span><span className="terminal-hint">⌘↵ executar</span><button onClick={() => setTerminalOpen(false)}>×</button></div>{problemsOpen ? <Problems openFiles={openFiles} /> : <div className="terminal-output">{terminalLines.map((line, i) => <div key={`${i}-${line}`} className={line.startsWith('$') ? 'command-line' : line.startsWith('✕') ? 'error-line' : line.startsWith('✓') ? 'success-line' : ''}>{line}</div>)}<div className="terminal-input"><span className="prompt">›</span><input value={command} onChange={e => setCommand(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void runCommand(command); }} placeholder="Digite um comando..." /></div></div>}</section></>}</section>
    </main>
    <footer className="statusbar"><span className="status-product">AURORA</span><span>{root ? 'workspace' : 'standalone'}</span><span>{active ? languageFor(active.name) : 'KZ'}</span><span className="status-spacer" /><span>{gitStatus?.branch ?? 'sem git'}</span><span>{gitStatus && !gitStatus.clean ? `${gitStatus.files.length} alterações` : 'limpo'}</span><span>{notice}</span><button onClick={() => setSettingsOpen(true)}>⚙</button><button onClick={() => setTerminalOpen(o => !o)}>Terminal</button></footer>
    {palette && <div className="overlay" onMouseDown={closeAllOverlays}><div className="palette" onMouseDown={e => e.stopPropagation()}><CommandPaletteContent actions={[["Abrir pasta", openWorkspace], ["Novo arquivo", createFile], ["Salvar arquivo", saveActive], ["Pesquisar no projeto", () => setContentSearch(true)], ["Alternar terminal", () => setTerminalOpen(o => !o)], ["Problemas", () => setProblemsOpen(true)], ["Configurações", () => setSettingsOpen(true)], ["Excluir arquivo ativo", removeActive], ["Source Control", () => setGitPanel(true)]]} onClose={() => setPalette(false)} /></div></div>}
    {fileSearch && <FileSearch value={searchText} setValue={setSearchText} files={filtered} onOpen={openFile} onClose={() => { setFileSearch(false); setSearchText(''); }} />}
    {contentSearch && <ContentSearch value={searchText} setValue={setSearchText} results={contentResults} onSearch={searchContent} onOpen={async m => { const node = findNode(tree, m.path); if (node) await openFile(node, m.line); setContentSearch(false); }} onClose={() => { setContentSearch(false); setSearchText(''); setContentResults([]); }} />}
    {settingsOpen && <SettingsDialog settings={settings} onChange={saveSettings} onClose={() => setSettingsOpen(false)} />}
  </div>;
}

function flatten(nodes: FileNode[]): FileNode[] { return nodes.flatMap(n => n.kind === 'folder' ? flatten(n.children ?? []) : [n]); }
function findNode(nodes: FileNode[], path: string): FileNode | null { for (const n of nodes) { if (n.path === path) return n; if (n.kind === 'folder') { const found = findNode(n.children ?? [], path); if (found) return found; } } return null; }
function FileTree({ nodes, onOpen, depth = 0 }: { nodes: FileNode[]; onOpen: (n: FileNode) => void; depth?: number }) { return <div>{nodes.map(n => <div key={n.path}><button className="tree-item" style={{ paddingLeft: `${10 + depth * 15}px` }} onClick={() => n.kind === 'file' && onOpen(n)}><span className="tree-icon">{n.kind === 'folder' ? '▸' : '•'}</span><span>{n.name}</span></button>{n.kind === 'folder' && <FileTree nodes={n.children ?? []} onOpen={onOpen} depth={depth + 1} />}</div>)}</div>; }

function MonacoEditor({ file, settings, onChange, onNotice }: { file: OpenFile; settings: KZSettings; onChange: (content: string) => void; onNotice: (s: string) => void }) {
  const ref = useRef<HTMLDivElement>(null); const change = useRef(onChange); change.current = onChange;
  useEffect(() => {
    if (!ref.current) return;
    const model = monaco.editor.createModel(file.content, languageFor(file.name), monaco.Uri.file(file.path));
    const editor = monaco.editor.create(ref.current, { model, theme: 'kz-dark', automaticLayout: true, minimap: { enabled: settings.minimap }, fontSize: settings.fontSize, wordWrap: settings.wordWrap, tabSize: 2, padding: { top: 14 }, smoothScrolling: true, scrollBeyondLastLine: false, renderLineHighlight: 'all', cursorSmoothCaretAnimation: 'on' });
    const validate = () => {
      const markers: monaco.editor.IMarkerData[] = []; const text = editor.getValue();
      const pairs: Array<[string, string]> = [['(', ')'], ['[', ']'], ['{', '}']];
      for (const [open, close] of pairs) { const balance = (text.match(new RegExp(`\\${open}`, 'g')) ?? []).length - (text.match(new RegExp(`\\${close}`, 'g')) ?? []).length; if (balance !== 0) markers.push({ severity: monaco.MarkerSeverity.Error, message: `Delimitadores desbalanceados: ${open}${close}`, startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 2 }); }
      text.split(/\r?\n/).forEach((line, i) => { const col = line.indexOf('TODO'); if (col >= 0) markers.push({ severity: monaco.MarkerSeverity.Warning, message: 'TODO pendente', startLineNumber: i + 1, startColumn: col + 1, endLineNumber: i + 1, endColumn: col + 5 }); });
      monaco.editor.setModelMarkers(model, 'kzide', markers); onNotice(markers.length ? `${markers.length} problema(s)` : 'Sem problemas');
    };
    const d = editor.onDidChangeModelContent(() => { change.current(editor.getValue()); validate(); }); validate();
    const completion = monaco.languages.registerCompletionItemProvider(languageFor(file.name), { provideCompletionItems: () => ({ suggestions: (keywords[languageFor(file.name)] ?? []).map((label, i) => ({ label, kind: monaco.languages.CompletionItemKind.Keyword, insertText: label, sortText: String(i).padStart(3, '0') })) }) });
    return () => { d.dispose(); completion.dispose(); monaco.editor.setModelMarkers(model, 'kzide', []); model.dispose(); editor.dispose(); };
  }, [file.path, settings.fontSize, settings.minimap, settings.wordWrap]);
  return <div ref={ref} className="monaco-host" />;
}

function Problems({ openFiles }: { openFiles: OpenFile[] }) { return <div className="problems"><div className="problem-title">DIAGNÓSTICOS LOCAIS</div>{openFiles.length === 0 ? <div className="empty-text">Abra um arquivo para ver diagnósticos.</div> : openFiles.map(f => <div className="problem-file" key={f.path}><span>●</span>{f.name}<small>Validação sintática básica ativa</small></div>)}</div>; }
function CommandPaletteContent({ actions, onClose }: { actions: Array<[string, () => void | Promise<void>]>; onClose: () => void }) { const [q, setQ] = useState(''); const items = actions.filter(([n]) => n.toLowerCase().includes(q.toLowerCase())); return <><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Digite um comando..." onKeyDown={e => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter' && items[0]) { void items[0][1](); onClose(); } }} />{items.map(([n, a]) => <button key={n} onClick={() => { void a(); onClose(); }}>{n}</button>)}</>; }
function FileSearch({ value, setValue, files, onOpen, onClose }: { value: string; setValue: (v: string) => void; files: FileNode[]; onOpen: (n: FileNode) => void; onClose: () => void }) { return <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="palette search-dialog" onMouseDown={e => e.stopPropagation()}><input autoFocus value={value} onChange={e => setValue(e.target.value)} placeholder="Pesquisar arquivo..." onKeyDown={e => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter' && files[0]) { onOpen(files[0]); onClose(); } }} />{files.slice(0, 30).map(f => <button key={f.path} onClick={() => { onOpen(f); onClose(); }}>{f.name}<small>{f.path}</small></button>)}</div></div>; }
function ContentSearch({ value, setValue, results, onSearch, onOpen, onClose }: { value: string; setValue: (v: string) => void; results: SearchMatch[]; onSearch: () => void; onOpen: (m: SearchMatch) => void; onClose: () => void }) { return <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="palette search-dialog content-search" onMouseDown={e => e.stopPropagation()}><input autoFocus value={value} onChange={e => setValue(e.target.value)} placeholder="Pesquisar texto no projeto..." onKeyDown={e => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter') void onSearch(); }} />{results.map((m, i) => <button key={`${m.path}-${m.line}-${i}`} onClick={() => void onOpen(m)}><strong>{m.path.split(/[\\/]/).pop()}:{m.line}</strong><small>{m.text}</small></button>)}{value && results.length === 0 && <div className="empty-text">Enter para pesquisar no workspace.</div>}</div></div>; }
function GitPanel({ status, onAction }: { status: GitStatus | null; onAction: (args: string[]) => void }) { return <div className="git-panel"><div className="git-branch">⑂ {status?.branch ?? 'sem branch'}</div>{!status ? <p className="empty-text">Abra um workspace Git para começar.</p> : <><div className="git-section">{status.clean ? 'Nenhuma alteração' : `${status.files.length} alteração(ões)`}</div>{status.files.map(f => <div className="git-file" key={f.path}><span>{f.status}</span>{f.path}</div>)}{!status.clean && <button className="primary" onClick={() => onAction(['diff'])}>Ver diff</button>}<div className="git-actions"><button onClick={() => onAction(['pull'])}>Pull</button><button onClick={() => onAction(['push'])}>Push</button><button onClick={() => onAction(['status'])}>Status</button></div></>}</div>; }
function SettingsDialog({ settings, onChange, onClose }: { settings: KZSettings; onChange: (p: Partial<KZSettings>) => void; onClose: () => void }) { return <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="settings" onMouseDown={e => e.stopPropagation()}><div className="settings-head"><strong>Aurora Settings</strong><button onClick={onClose}>×</button></div><label>Fonte <input type="number" min="10" max="24" value={settings.fontSize} onChange={e => void onChange({ fontSize: Number(e.target.value) })} /></label><label>Minimap <input type="checkbox" checked={settings.minimap} onChange={e => void onChange({ minimap: e.target.checked })} /></label><label>Quebra de linha <select value={settings.wordWrap} onChange={e => void onChange({ wordWrap: e.target.value as 'off' | 'on' })}><option value="off">Desligada</option><option value="on">Ligada</option></select></label><label>Auto save <input type="checkbox" checked={settings.autoSave} onChange={e => void onChange({ autoSave: e.target.checked })} /></label><label>Confirmar exclusão <input type="checkbox" checked={settings.confirmDelete} onChange={e => void onChange({ confirmDelete: e.target.checked })} /></label><div className="settings-note">Preferências persistem no perfil do Aurora. Arraste as divisórias para ajustar Explorer e Terminal.</div></div></div>; }
function Welcome({ onOpen, onCreate }: { onOpen: () => void; onCreate: () => void }) { return <div className="welcome"><div className="welcome-mark">A</div><div className="welcome-eyebrow">KORCZAK TECHNOLOGIES</div><h1>Aurora</h1><p>Um ambiente de desenvolvimento profissional, rápido e autoral.</p><div className="welcome-actions"><button onClick={onOpen}>Abrir pasta</button><button onClick={onCreate}>Novo arquivo</button></div><div className="shortcuts"><span><b>Ctrl + P</b> Arquivo</span><span><b>Ctrl + Shift + P</b> Comandos</span><span><b>Ctrl + F</b> Pesquisar</span><span><b>Ctrl + `</b> Terminal</span></div></div>; }

monaco.editor.defineTheme('kz-dark', { base: 'vs-dark', inherit: true, rules: [{ token: 'comment', foreground: '666666', fontStyle: 'italic' }, { token: 'keyword', foreground: 'E8E8E8' }, { token: 'string', foreground: 'AFAFAF' }, { token: 'number', foreground: 'C9C9C9' }, { token: 'type', foreground: 'DCDCDC' }, { token: 'identifier', foreground: 'D6D6D6' }, { token: 'delimiter', foreground: '777777' }, { token: 'operator', foreground: 'BDBDBD' }], colors: { 'editor.background': '#050505', 'editor.foreground': '#E8E8E8', 'editorLineNumber.foreground': '#4A4A4A', 'editorLineNumber.activeForeground': '#B5B5B5', 'editorCursor.foreground': '#F4F4F4', 'editor.selectionBackground': '#242424', 'editor.inactiveSelectionBackground': '#171717', 'editor.lineHighlightBackground': '#0C0C0C', 'editorIndentGuide.background1': '#171717', 'editorIndentGuide.activeBackground1': '#2A2A2A', 'editorWidget.background': '#0D0D0D', 'editorWidget.border': '#353535', 'editorSuggestWidget.background': '#0D0D0D', 'editorSuggestWidget.border': '#353535', 'editorHoverWidget.background': '#0D0D0D', 'editorHoverWidget.border': '#353535', 'editorGutter.background': '#050505', 'scrollbarSlider.background': '#29292988', 'scrollbarSlider.hoverBackground': '#444444AA', 'scrollbarSlider.activeBackground': '#5A5A5AAA' } });
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
