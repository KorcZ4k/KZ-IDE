import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as monaco from 'monaco-editor';
import type { FileNode, GitStatus, KZSettings, SearchMatch } from '../shared/api';
import './styles.css';

type OpenFile = { path: string; name: string; content: string; dirty: boolean };
type MenuName = 'file' | 'edit' | 'view' | 'run' | 'terminal' | 'preferences' | null;
type Dialog = { kind: 'file' | 'folder' | 'rename'; node?: FileNode } | null;
type ContextMenu = { x: number; y: number; node: FileNode } | null;

const languageFor = (name: string) => ({ ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', json: 'json', css: 'css', html: 'html', md: 'markdown', py: 'python', rs: 'rust', go: 'go', java: 'java', cpp: 'cpp', c: 'cpp' } as Record<string, string>)[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'plaintext';
const fileIcon = (name: string, kind: FileNode['kind']) => kind === 'folder' ? '⌄' : ({ ts: '◇', tsx: '◇', js: '◆', jsx: '◆', json: '{}', css: '#', html: '<>', md: 'M', py: 'P', rs: 'R', go: 'G', java: 'J' } as Record<string, string>)[name.split('.').pop()?.toLowerCase() ?? ''] ?? '•';
const joinPath = (root: string, name: string) => `${root.replace(/[\\/]$/, '')}/${name}`;

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
  const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [command, setCommand] = useState('');
  const [terminalTab, setTerminalTab] = useState<'terminal' | 'problems' | 'output'>('terminal');
  const [menu, setMenu] = useState<MenuName>(null);
  const [palette, setPalette] = useState(false);
  const [fileSearch, setFileSearch] = useState(false);
  const [contentSearch, setContentSearch] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [contentResults, setContentResults] = useState<SearchMatch[]>([]);
  const [notice, setNotice] = useState('Pronto');
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [gitPanel, setGitPanel] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [settings, setSettings] = useState<KZSettings>({ fontSize: 13, minimap: false, wordWrap: 'off', autoSave: false, confirmDelete: true });
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(localStorage.getItem('aurora.sidebarWidth')) || 286);
  const [terminalHeight, setTerminalHeight] = useState(() => Number(localStorage.getItem('aurora.terminalHeight')) || 235);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [dialog, setDialog] = useState<Dialog>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
  const active = openFiles.find(f => f.path === activePath) ?? null;

  const refresh = async (workspace = root) => {
    if (!workspace) return;
    try { setTree(await window.kz.workspace.readTree(workspace)); setGitStatus(await window.kz.git.status(workspace)); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Erro ao atualizar workspace.'); }
  };
  const closeMenus = () => setMenu(null);
  const closeOverlays = () => { setPalette(false); setFileSearch(false); setContentSearch(false); setSettingsOpen(false); setDialog(null); setContextMenu(null); setMenu(null); };

  const openWorkspace = async () => {
    closeMenus();
    try {
      const selected = await window.kz.workspace.open();
      if (!selected) return;
      setRoot(selected); setRecent(r => [selected, ...r.filter(x => x !== selected)].slice(0, 8));
      setOpenFiles([]); setActivePath(null); setExpanded(new Set()); await refresh(selected); setNotice(`Workspace: ${selected.split(/[\\/]/).pop()}`);
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Não foi possível abrir a pasta.'); }
  };
  const openRecent = async (path: string) => { setRoot(path); setOpenFiles([]); setActivePath(null); setExpanded(new Set()); await refresh(path); setNotice(path); };
  const openFile = async (node: FileNode, line?: number) => {
    if (node.kind !== 'file') return;
    const existing = openFiles.find(f => f.path === node.path);
    if (existing) { setActivePath(node.path); setNotice(line ? `Linha ${line}` : 'Arquivo ativo'); return; }
    try { const content = await window.kz.file.read(node.path); setOpenFiles(f => [...f, { path: node.path, name: node.name, content, dirty: false }]); setActivePath(node.path); setNotice(line ? `Linha ${line}` : node.name); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Erro ao abrir arquivo.'); }
  };
  const saveActive = async () => {
    if (!active) return;
    try { await window.kz.file.write(active.path, active.content); setOpenFiles(fs => fs.map(f => f.path === active.path ? { ...f, dirty: false } : f)); setNotice('Arquivo salvo'); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Erro ao salvar.'); }
  };
  const closeFile = (file: OpenFile) => {
    if (file.dirty && !window.confirm(`Salvar alterações em ${file.name} antes de fechar?`)) return;
    const remaining = openFiles.filter(f => f.path !== file.path); setOpenFiles(remaining);
    if (file.path === activePath) setActivePath(remaining[Math.max(0, remaining.length - 1)]?.path ?? null);
  };
  const createEntry = async (kind: 'file' | 'folder', name: string) => {
    if (!root || !name.trim()) return;
    const cleanName = name.trim();
    try {
      const target = joinPath(root, cleanName); await window.kz.file.create(target, kind); await refresh();
      if (kind === 'file') { setOpenFiles(fs => [...fs, { path: target, name: cleanName, content: '', dirty: false }]); setActivePath(target); }
      setDialog(null); setNotice(`${kind === 'file' ? 'Arquivo' : 'Pasta'} criado: ${cleanName}`);
    } catch (e) { setNotice(e instanceof Error ? e.message : `Não foi possível criar ${kind === 'file' ? 'o arquivo' : 'a pasta'}.`); }
  };
  const renameEntry = async (node: FileNode, name: string) => {
    const cleanName = name.trim(); if (!cleanName || cleanName === node.name) { setDialog(null); return; }
    try {
      const parent = node.path.slice(0, Math.max(node.path.lastIndexOf('/'), node.path.lastIndexOf('\\')));
      const target = joinPath(parent || root || '', cleanName); await window.kz.file.rename(node.path, target);
      setOpenFiles(fs => fs.map(f => f.path === node.path ? { ...f, path: target, name: cleanName } : f));
      if (activePath === node.path) setActivePath(target); await refresh(); setDialog(null); setNotice(`Renomeado: ${cleanName}`);
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Não foi possível renomear.'); }
  };
  const removeEntry = async (node: FileNode) => {
    if (settings.confirmDelete && !window.confirm(`Excluir ${node.name}?`)) return;
    try { await window.kz.file.remove(node.path); setOpenFiles(fs => fs.filter(f => f.path !== node.path)); if (activePath === node.path) setActivePath(null); await refresh(); setContextMenu(null); setNotice(`Excluído: ${node.name}`); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Não foi possível excluir.'); }
  };
  const runCommand = async (value: string) => {
    const trimmed = value.trim(); if (!trimmed) return;
    try {
      const cwd = root ?? await window.kz.terminal.cwd(); setTerminalLines(l => [...l, `› ${trimmed}`]); setCommand(''); setHistoryIndex(-1); setTerminalHistory(h => [trimmed, ...h.filter(x => x !== trimmed)].slice(0, 100));
      const result = await window.kz.terminal.run(trimmed, cwd); const output = `${result.stdout}${result.stderr}`.trimEnd();
      setTerminalLines(l => [...l, ...(output ? output.split('\n') : ['Concluído.']), result.code === 0 ? '✓ processo concluído' : `✕ código ${result.code}`]);
    } catch (e) { setTerminalLines(l => [...l, `✕ ${e instanceof Error ? e.message : 'Erro no terminal'}`]); }
  };
  const saveSettings = async (patch: Partial<KZSettings>) => { try { const next = await window.kz.settings.save(patch); setSettings(next); setNotice('Configurações salvas'); } catch (e) { setNotice(e instanceof Error ? e.message : 'Erro ao salvar configurações.'); } };
  const searchContent = async () => { if (!root || !searchText.trim()) { setContentResults([]); return; } try { setContentResults(await window.kz.search.workspace(root, searchText)); } catch (e) { setNotice(e instanceof Error ? e.message : 'Erro na pesquisa.'); } };

  useEffect(() => { void Promise.all([window.kz.workspace.last(), window.kz.settings.get()]).then(([state, saved]) => { setRecent(state.recent); setSettings(saved); if (state.workspace) { setRoot(state.workspace); void refresh(state.workspace); } }).catch(e => setNotice(e instanceof Error ? e.message : 'Erro ao carregar preferências.')); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); void saveActive(); }
      else if (mod && e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); setPalette(true); closeMenus(); }
      else if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); setFileSearch(true); closeMenus(); }
      else if (mod && e.key.toLowerCase() === 'f') { e.preventDefault(); setContentSearch(true); closeMenus(); }
      else if (mod && e.key === ',') { e.preventDefault(); setSettingsOpen(true); closeMenus(); }
      else if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); if (root) setDialog({ kind: 'file' }); }
      else if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); setTerminalOpen(o => !o); }
      else if (mod && e.key.toLowerCase() === 'w' && active) { e.preventDefault(); closeFile(active); }
      else if (e.key === 'F5') { e.preventDefault(); window.dispatchEvent(new Event('kz-open-debug')); }
      else if (e.key === 'Escape') { closeOverlays(); }
      else if (mod && e.key === '`') { e.preventDefault(); setTerminalOpen(o => !o); }
    };
    const outside = () => setContextMenu(null);
    window.addEventListener('keydown', h); window.addEventListener('click', outside);
    return () => { window.removeEventListener('keydown', h); window.removeEventListener('click', outside); };
  }, [active, root, settings]);

  const flatFiles = useMemo(() => flatten(tree), [tree]);
  const filtered = searchText ? flatFiles.filter(n => n.name.toLowerCase().includes(searchText.toLowerCase())) : flatFiles;
  const gitAction = async (args: string[]) => { if (!root) return; try { const result = await window.kz.git.run(root, args); setTerminalLines(l => [...l, `$ git ${args.join(' ')}`, ...(result.stdout + result.stderr).trim().split('\n').filter(Boolean), result.code === 0 ? '✓' : '✕']); await refresh(); } catch (e) { setNotice(e instanceof Error ? e.message : 'Erro no Git.'); } };
  const startResize = (kind: 'sidebar' | 'terminal', event: React.MouseEvent) => {
    event.preventDefault(); const startX = event.clientX, startY = event.clientY, initial = kind === 'sidebar' ? sidebarWidth : terminalHeight;
    const move = (e: MouseEvent) => { if (kind === 'sidebar') { const value = Math.min(520, Math.max(210, initial + e.clientX - startX)); setSidebarWidth(value); localStorage.setItem('aurora.sidebarWidth', String(value)); } else { const value = Math.min(520, Math.max(140, initial - (e.clientY - startY))); setTerminalHeight(value); localStorage.setItem('aurora.terminalHeight', String(value)); } };
    const up = () => { document.body.classList.remove('resizing'); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    document.body.classList.add('resizing'); window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };
  const toggleFolder = (node: FileNode) => setExpanded(s => { const n = new Set(s); n.has(node.path) ? n.delete(node.path) : n.add(node.path); return n; });
  const menuButton = (name: Exclude<MenuName, null>, label: string) => <button className={menu === name ? 'menu-button active' : 'menu-button'} onClick={e => { e.stopPropagation(); setMenu(menu === name ? null : name); }}>{label}</button>;

  return <div className="app" onClick={() => { setMenu(null); setContextMenu(null); }}>
    <header className="titlebar">
      <div className="brand"><span className="brand-mark">A</span><strong>Aurora</strong><span className="brand-sub">KORCZAK IDE</span></div>
      <nav className="menu" onClick={e => e.stopPropagation()}>{menuButton('file', 'File')}{menuButton('edit', 'Edit')}{menuButton('view', 'View')}{menuButton('run', 'Run')}{menuButton('terminal', 'Terminal')}{menuButton('preferences', 'Preferences')}{menu && <MenuDropdown menu={menu} root={root} active={active} onOpen={() => void openWorkspace()} onNew={() => setDialog({ kind: 'file' })} onNewFolder={() => setDialog({ kind: 'folder' })} onSave={() => void saveActive()} onClose={() => active && closeFile(active)} onSearch={() => setContentSearch(true)} onFileSearch={() => setFileSearch(true)} onPalette={() => setPalette(true)} onTerminal={() => setTerminalOpen(o => !o)} onDebug={() => window.dispatchEvent(new Event('kz-open-debug'))} onSettings={() => setSettingsOpen(true)} onRename={() => active && setDialog({ kind: 'rename', node: { name: active.name, path: active.path, kind: 'file' } })} />}</nav>
      <div className="command-center" onClick={() => setPalette(true)}><span>⌕</span><span>Pesquisar arquivos, comandos e símbolos...</span><kbd>Ctrl P</kbd></div>
      <div className="workspace-name">{root ? root.split(/[\\/]/).pop() : 'sem workspace'}</div>
    </header>
    <main className="workspace">
      <aside className="activitybar"><button className="activity active" title="Explorer">▤</button><button className="activity" title="Pesquisar no projeto" onClick={() => setContentSearch(true)}>⌕</button><button className={`activity ${gitPanel ? 'active' : ''}`} title="Source Control" onClick={() => setGitPanel(p => !p)}>⑂{gitStatus && !gitStatus.clean && <i>{gitStatus.files.length}</i>}</button><button className="activity" title="Run and Debug" onClick={() => window.dispatchEvent(new Event('kz-open-debug'))}>▷</button><button className="activity" title="Configurações" onClick={() => setSettingsOpen(true)}>⚙</button></aside>
      <aside className="sidebar" style={{ width: sidebarWidth }}><div className="sidebar-head"><span>{gitPanel ? 'SOURCE CONTROL' : 'EXPLORER'}</span>{!gitPanel && <div className="sidebar-actions"><button title="Abrir pasta" onClick={() => void openWorkspace()}>⌂</button><button title="Novo arquivo" onClick={() => setDialog({ kind: 'file' })}>＋</button><button title="Nova pasta" onClick={() => setDialog({ kind: 'folder' })}>▰</button><button title="Atualizar" onClick={() => void refresh()}>↻</button></div>}</div>
        {gitPanel ? <GitPanel status={gitStatus} onAction={gitAction} /> : <>{root ? <div className="section-title"><span>WORKSPACE</span><strong>{root.split(/[\\/]/).pop()}</strong></div> : <div className="section-title">ABRA UM WORKSPACE</div>}{root ? <FileTree nodes={tree} expanded={expanded} onToggle={toggleFolder} onOpen={openFile} onContext={node => setContextMenu({ x: Math.min(window.innerWidth - 230, sidebarWidth + 58), y: 105, node })} /> : <div className="empty"><p>Um ambiente de desenvolvimento profissional para código, Git, terminal e debug.</p>{recent.length > 0 && <div className="recent"><small>RECENTES</small>{recent.slice(0, 6).map(p => <button key={p} onClick={() => void openRecent(p)}>{p.split(/[\\/]/).pop()}<span>{p}</span></button>)}</div>}<button className="primary" onClick={() => void openWorkspace()}>Abrir pasta</button></div>}</>}
      </aside>
      <div className="resize-handle vertical" onMouseDown={e => startResize('sidebar', e)} title="Arraste para redimensionar Explorer" />
      <section className="main-area">
        <div className="tabs" onWheel={e => { if (e.deltaY) e.currentTarget.scrollLeft += e.deltaY; }}>{openFiles.map(file => <button key={file.path} className={`tab ${file.path === activePath ? 'active' : ''}`} onClick={() => setActivePath(file.path)}><span className="file-dot">{fileIcon(file.name, 'file')}</span><span className="tab-name">{file.name}</span>{file.dirty && <span className="dirty-dot">●</span>}<span className="close" onClick={e => { e.stopPropagation(); closeFile(file); }}>×</span></button>)}<button className="new-tab" title="Novo arquivo" onClick={() => setDialog({ kind: 'file' })}>＋</button></div>
        <div className="editor">{active ? <MonacoEditor file={active} settings={settings} onChange={content => setOpenFiles(fs => fs.map(f => f.path === active.path ? { ...f, content, dirty: true } : f))} onNotice={setNotice} /> : <Welcome onOpen={openWorkspace} onCreate={() => root ? setDialog({ kind: 'file' }) : void openWorkspace()} />}</div>
        {terminalOpen && <><div className="resize-handle horizontal" onMouseDown={e => startResize('terminal', e)} title="Arraste para redimensionar terminal" /><section className="terminal" style={{ height: terminalHeight }}><div className="panel-tabs"><button className={terminalTab === 'terminal' ? 'panel-active' : ''} onClick={() => setTerminalTab('terminal')}>TERMINAL</button><button className={terminalTab === 'problems' ? 'panel-active' : ''} onClick={() => setTerminalTab('problems')}>PROBLEMS</button><button className={terminalTab === 'output' ? 'panel-active' : ''} onClick={() => setTerminalTab('output')}>OUTPUT</button><span className="terminal-cwd">{root ? root.split(/[\\/]/).pop() : 'home'}</span><button className="terminal-tool" title="Limpar terminal" onClick={() => setTerminalLines([])}>⌫</button><button className="terminal-tool" title="Fechar terminal" onClick={() => setTerminalOpen(false)}>×</button></div>{terminalTab === 'problems' ? <Problems openFiles={openFiles} /> : terminalTab === 'output' ? <div className="terminal-output output-muted">Saída das ferramentas aparecerá aqui.</div> : <div className="terminal-output">{terminalLines.map((line, i) => <div key={`${i}-${line}`} className={line.startsWith('›') ? 'command-line' : line.startsWith('✕') ? 'error-line' : line.startsWith('✓') ? 'success-line' : ''}>{line}</div>)}<div className="terminal-input"><span className="prompt">›</span><input value={command} onChange={e => { setCommand(e.target.value); setHistoryIndex(-1); }} onKeyDown={e => { if (e.key === 'Enter') void runCommand(command); if (e.key === 'ArrowUp') { e.preventDefault(); const next = Math.min(historyIndex + 1, terminalHistory.length - 1); setHistoryIndex(next); setCommand(terminalHistory[next] ?? ''); } if (e.key === 'ArrowDown') { e.preventDefault(); const next = Math.max(-1, historyIndex - 1); setHistoryIndex(next); setCommand(next < 0 ? '' : terminalHistory[next] ?? ''); } }} placeholder="Digite um comando..." /><span className="terminal-shortcut">Enter</span></div></div>}</section></>}
      </section>
    </main>
    <footer className="statusbar"><span className="status-product">AURORA</span><span>{root ? 'workspace' : 'standalone'}</span><span>{active ? languageFor(active.name) : 'KZ'}</span><span className="status-spacer" /><span>{gitStatus?.branch ?? 'sem git'}</span><span>{gitStatus && !gitStatus.clean ? `${gitStatus.files.length} alterações` : 'limpo'}</span><span className="status-notice">{notice}</span><button onClick={() => setSettingsOpen(true)}>⚙</button><button onClick={() => setTerminalOpen(o => !o)}>Terminal</button></footer>
    {palette && <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) setPalette(false); }}><div className="palette" onMouseDown={e => e.stopPropagation()}><CommandPaletteContent onClose={() => setPalette(false)} actions={[["Abrir pasta", openWorkspace, 'Ctrl+O'], ["Novo arquivo", () => root && setDialog({ kind: 'file' }), 'Ctrl+N'], ["Nova pasta", () => root && setDialog({ kind: 'folder' }), ''], ["Salvar arquivo", saveActive, 'Ctrl+S'], ["Pesquisar arquivos", () => setFileSearch(true), 'Ctrl+P'], ["Pesquisar no projeto", () => setContentSearch(true), 'Ctrl+F'], ["Alternar terminal", () => setTerminalOpen(o => !o), 'Ctrl+`'], ["Run & Debug", () => window.dispatchEvent(new Event('kz-open-debug')), 'F5'], ["Configurações", () => setSettingsOpen(true), 'Ctrl+,']]}/></div></div>}
    {fileSearch && <FileSearch value={searchText} setValue={setSearchText} files={filtered} onOpen={openFile} onClose={() => { setFileSearch(false); setSearchText(''); }} />}
    {contentSearch && <ContentSearch value={searchText} setValue={setSearchText} results={contentResults} onSearch={searchContent} onOpen={async m => { const node = findNode(tree, m.path); if (node) await openFile(node, m.line); setContentSearch(false); }} onClose={() => { setContentSearch(false); setSearchText(''); setContentResults([]); }} />}
    {settingsOpen && <SettingsDialog settings={settings} onChange={saveSettings} onClose={() => setSettingsOpen(false)} sidebarWidth={sidebarWidth} terminalHeight={terminalHeight} />}
    {dialog && <EntryDialog dialog={dialog} onClose={() => setDialog(null)} onSubmit={value => dialog.kind === 'rename' && dialog.node ? renameEntry(dialog.node, value) : createEntry(dialog.kind, value)} />}
    {contextMenu && <FileContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} onOpen={node => void openFile(node)} onNewFile={() => setDialog({ kind: 'file' })} onNewFolder={() => setDialog({ kind: 'folder' })} onRename={node => setDialog({ kind: 'rename', node })} onDelete={removeEntry} />}
  </div>;
}

function MenuDropdown({ menu, root, active, onOpen, onNew, onNewFolder, onSave, onClose, onSearch, onFileSearch, onPalette, onTerminal, onDebug, onSettings, onRename }: { menu: Exclude<MenuName, null>; root: string | null; active: OpenFile | null; onOpen: () => void; onNew: () => void; onNewFolder: () => void; onSave: () => void; onClose: () => void; onSearch: () => void; onFileSearch: () => void; onPalette: () => void; onTerminal: () => void; onDebug: () => void; onSettings: () => void; onRename: () => void }) {
  const item = (label: string, action: () => void, shortcut = '', disabled = false) => <button className="menu-item" disabled={disabled} onClick={action}><span>{label}</span><kbd>{shortcut}</kbd></button>;
  const groups: Record<Exclude<MenuName, null>, React.ReactNode> = {
    file: <>{item('Abrir pasta', onOpen, 'Ctrl+O')}{item('Novo arquivo', onNew, 'Ctrl+N', !root)}{item('Nova pasta', onNewFolder, '', !root)}{item('Salvar', onSave, 'Ctrl+S', !active)}{item('Fechar editor', onClose, 'Ctrl+W', !active)}</>,
    edit: <>{item('Command Palette', onPalette, 'Ctrl+Shift+P')}{item('Pesquisar arquivos', onFileSearch, 'Ctrl+P')}{item('Pesquisar no projeto', onSearch, 'Ctrl+F')}{item('Renomear ativo', onRename, '', !active)}</>,
    view: <>{item('Pesquisar', onSearch)}{item('Pesquisar arquivos', onFileSearch, 'Ctrl+P')}{item('Command Palette', onPalette, 'Ctrl+Shift+P')}{item('Configurações', onSettings, 'Ctrl+,')}</>,
    run: <>{item('Run & Debug', onDebug, 'F5')}{item('Terminal', onTerminal, 'Ctrl+`')}</>,
    terminal: <>{item('Mostrar/ocultar terminal', onTerminal, 'Ctrl+`')}{item('Limpar terminal', () => window.dispatchEvent(new Event('kz-clear-terminal')))}</>,
    preferences: <>{item('Configurações', onSettings, 'Ctrl+,')}</>
  };
  return <div className="dropdown">{groups[menu]}</div>;
}

function flatten(nodes: FileNode[]): FileNode[] { return nodes.flatMap(n => n.kind === 'folder' ? flatten(n.children ?? []) : [n]); }
function findNode(nodes: FileNode[], path: string): FileNode | null { for (const n of nodes) { if (n.path === path) return n; if (n.kind === 'folder') { const found = findNode(n.children ?? [], path); if (found) return found; } } return null; }
function FileTree({ nodes, expanded, onToggle, onOpen, onContext, depth = 0 }: { nodes: FileNode[]; expanded: Set<string>; onToggle: (n: FileNode) => void; onOpen: (n: FileNode) => void; onContext: (n: FileNode) => void; depth?: number }) { return <div>{nodes.map(n => <div key={n.path}><button className="tree-item" style={{ paddingLeft: `${9 + depth * 15}px` }} onClick={() => n.kind === 'folder' ? onToggle(n) : onOpen(n)} onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onContext(n); }}><span className={`tree-chevron ${n.kind === 'folder' && expanded.has(n.path) ? 'expanded' : ''}`}>{n.kind === 'folder' ? '›' : ''}</span><span className="tree-icon">{fileIcon(n.name, n.kind)}</span><span className="tree-name">{n.name}</span></button>{n.kind === 'folder' && expanded.has(n.path) && <FileTree nodes={n.children ?? []} expanded={expanded} onToggle={onToggle} onOpen={onOpen} onContext={onContext} depth={depth + 1} />}</div>)}</div>; }
function MonacoEditor({ file, settings, onChange, onNotice }: { file: OpenFile; settings: KZSettings; onChange: (content: string) => void; onNotice: (s: string) => void }) {
  const ref = useRef<HTMLDivElement>(null); const change = useRef(onChange); change.current = onChange;
  useEffect(() => {
    if (!ref.current) return;
    const model = monaco.editor.createModel(file.content, languageFor(file.name), monaco.Uri.file(file.path));
    const editor = monaco.editor.create(ref.current, { model, theme: 'kz-dark', automaticLayout: true, minimap: { enabled: settings.minimap }, fontSize: settings.fontSize, wordWrap: settings.wordWrap, tabSize: 2, padding: { top: 14 }, smoothScrolling: true, scrollBeyondLastLine: false, renderLineHighlight: 'all', cursorSmoothCaretAnimation: 'on', fontLigatures: true, stickyScroll: { enabled: true }, guides: { indentation: true, bracketPairs: true } });
    const validate = () => {
      const markers: monaco.editor.IMarkerData[] = []; const text = editor.getValue();
      const pairs: Array<[string, string]> = [['(', ')'], ['[', ']'], ['{', '}']];
      for (const [open, close] of pairs) { const balance = (text.match(new RegExp(`\\${open}`, 'g')) ?? []).length - (text.match(new RegExp(`\\${close}`, 'g')) ?? []).length; if (balance !== 0) markers.push({ severity: monaco.MarkerSeverity.Error, message: `Delimitadores desbalanceados: ${open}${close}`, startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 2 }); }
      text.split(/\r?\n/).forEach((line, i) => { const col = line.indexOf('TODO'); if (col >= 0) markers.push({ severity: monaco.MarkerSeverity.Warning, message: 'TODO pendente', startLineNumber: i + 1, startColumn: col + 1, endLineNumber: i + 1, endColumn: col + 5 }); });
      monaco.editor.setModelMarkers(model, 'aurora', markers); onNotice(markers.length ? `${markers.length} problema(s)` : 'Sem problemas');
    };
    const d = editor.onDidChangeModelContent(() => { change.current(editor.getValue()); validate(); }); validate();
    const completion = monaco.languages.registerCompletionItemProvider(languageFor(file.name), { provideCompletionItems: () => ({ suggestions: (keywords[languageFor(file.name)] ?? []).map((label, i) => ({ label, kind: monaco.languages.CompletionItemKind.Keyword, insertText: label, sortText: String(i).padStart(3, '0') })) }) });
    editor.addAction({ id: 'aurora.format', label: 'Formatar documento', keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF], run: () => onNotice('Formatação disponível pelo language service.') });
    return () => { d.dispose(); completion.dispose(); monaco.editor.setModelMarkers(model, 'aurora', []); model.dispose(); editor.dispose(); };
  }, [file.path, settings.fontSize, settings.minimap, settings.wordWrap]);
  return <div ref={ref} className="monaco-host" />;
}
function Problems({ openFiles }: { openFiles: OpenFile[] }) { return <div className="problems"><div className="problem-title">DIAGNÓSTICOS LOCAIS</div>{openFiles.length === 0 ? <div className="empty-text">Abra um arquivo para ver diagnósticos.</div> : openFiles.map(f => <div className="problem-file" key={f.path}><span>●</span>{f.name}<small>Validação sintática básica ativa</small></div>)}</div>; }
function CommandPaletteContent({ actions, onClose }: { actions: Array<[string, () => void | Promise<void>, string]>; onClose: () => void }) { const [q, setQ] = useState(''); const items = actions.filter(([n]) => n.toLowerCase().includes(q.toLowerCase())); return <><div className="palette-heading"><span>COMMAND PALETTE</span><kbd>ESC</kbd></div><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Digite um comando..." onKeyDown={e => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter' && items[0]) { void items[0][1](); onClose(); } }} />{items.map(([n, a, s]) => <button key={n} onClick={() => { void a(); onClose(); }}><span>{n}</span><kbd>{s}</kbd></button>)}</>; }
function FileSearch({ value, setValue, files, onOpen, onClose }: { value: string; setValue: (v: string) => void; files: FileNode[]; onOpen: (n: FileNode) => void; onClose: () => void }) { return <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="palette search-dialog" onMouseDown={e => e.stopPropagation()}><div className="palette-heading"><span>QUICK OPEN</span><kbd>ESC</kbd></div><input autoFocus value={value} onChange={e => setValue(e.target.value)} placeholder="Pesquisar arquivo..." onKeyDown={e => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter' && files[0]) { onOpen(files[0]); onClose(); } }} />{files.slice(0, 40).map(f => <button key={f.path} onClick={() => { onOpen(f); onClose(); }}><span><b>{fileIcon(f.name, 'file')}</b> {f.name}</span><small>{f.path}</small></button>)}</div></div>; }
function ContentSearch({ value, setValue, results, onSearch, onOpen, onClose }: { value: string; setValue: (v: string) => void; results: SearchMatch[]; onSearch: () => void; onOpen: (m: SearchMatch) => void; onClose: () => void }) { return <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="palette search-dialog content-search" onMouseDown={e => e.stopPropagation()}><div className="palette-heading"><span>PROJECT SEARCH</span><kbd>ESC</kbd></div><input autoFocus value={value} onChange={e => setValue(e.target.value)} placeholder="Pesquisar texto no projeto..." onKeyDown={e => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter') void onSearch(); }} />{results.map((m, i) => <button key={`${m.path}-${m.line}-${i}`} onClick={() => void onOpen(m)}><strong>{m.path.split(/[\\/]/).pop()}:{m.line}</strong><small>{m.text}</small></button>)}{value && results.length === 0 && <div className="empty-text">Pressione Enter para pesquisar no workspace.</div>}</div></div>; }
function GitPanel({ status, onAction }: { status: GitStatus | null; onAction: (args: string[]) => void }) { return <div className="git-panel"><div className="git-branch">⑂ {status?.branch ?? 'sem branch'}</div>{!status ? <p className="empty-text">Abra um workspace Git para começar.</p> : <><div className="git-section">{status.clean ? 'Nenhuma alteração' : `${status.files.length} alteração(ões)`}</div>{status.files.map(f => <div className="git-file" key={f.path}><span>{f.status}</span>{f.path}</div>)}{!status.clean && <button className="primary" onClick={() => onAction(['diff'])}>Ver diff</button>}<div className="git-actions"><button onClick={() => onAction(['pull'])}>Pull</button><button onClick={() => onAction(['push'])}>Push</button><button onClick={() => onAction(['status'])}>Status</button></div></>}</div>; }
function SettingsDialog({ settings, onChange, onClose, sidebarWidth, terminalHeight }: { settings: KZSettings; onChange: (p: Partial<KZSettings>) => void; onClose: () => void; sidebarWidth: number; terminalHeight: number }) { return <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="settings" onMouseDown={e => e.stopPropagation()}><div className="settings-head"><div><small>EDITOR</small><strong>Aurora Settings</strong></div><button onClick={onClose}>×</button></div><label>Fonte <input type="number" min="10" max="24" value={settings.fontSize} onChange={e => void onChange({ fontSize: Number(e.target.value) })} /></label><label>Minimap <input type="checkbox" checked={settings.minimap} onChange={e => void onChange({ minimap: e.target.checked })} /></label><label>Quebra de linha <select value={settings.wordWrap} onChange={e => void onChange({ wordWrap: e.target.value as 'off' | 'on' })}><option value="off">Desligada</option><option value="on">Ligada</option></select></label><label>Auto save <input type="checkbox" checked={settings.autoSave} onChange={e => void onChange({ autoSave: e.target.checked })} /></label><label>Confirmar exclusão <input type="checkbox" checked={settings.confirmDelete} onChange={e => void onChange({ confirmDelete: e.target.checked })} /></label><div className="layout-info"><span>Explorer <b>{Math.round(sidebarWidth)}px</b></span><span>Terminal <b>{Math.round(terminalHeight)}px</b></span></div><div className="settings-note">Arraste as divisórias para ajustar o layout. As posições são salvas automaticamente.</div></div></div>; }
function EntryDialog({ dialog, onClose, onSubmit }: { dialog: Exclude<Dialog, null>; onClose: () => void; onSubmit: (value: string) => void }) { const [value, setValue] = useState(dialog.node?.name ?? (dialog.kind === 'folder' ? 'nova-pasta' : 'novo.ts')); const title = dialog.kind === 'rename' ? 'Renomear' : dialog.kind === 'folder' ? 'Nova pasta' : 'Novo arquivo'; return <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><form className="entry-dialog" onMouseDown={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); onSubmit(value); }}><div className="dialog-icon">{dialog.kind === 'folder' ? '▰' : '◇'}</div><div><small>WORKSPACE</small><h2>{title}</h2></div><label>Nome<input autoFocus value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') onClose(); }} /></label><div className="dialog-actions"><button type="button" onClick={onClose}>Cancelar</button><button className="primary" type="submit">{dialog.kind === 'rename' ? 'Renomear' : 'Criar'}</button></div></form></div>; }
function FileContextMenu({ menu, onClose, onOpen, onNewFile, onNewFolder, onRename, onDelete }: { menu: ContextMenu; onClose: () => void; onOpen: (n: FileNode) => void; onNewFile: () => void; onNewFolder: () => void; onRename: (n: FileNode) => void; onDelete: (n: FileNode) => void }) { if (!menu) return null; return <div className="context-menu" style={{ left: Math.min(menu.x, window.innerWidth - 220), top: Math.min(menu.y, window.innerHeight - 280) }} onMouseDown={e => e.stopPropagation()}>{menu.node.kind === 'file' && <button onClick={() => { onOpen(menu.node); onClose(); }}>Abrir</button>}<button onClick={onNewFile}>Novo arquivo</button><button onClick={onNewFolder}>Nova pasta</button><div /><button onClick={() => onRename(menu.node)}>Renomear</button><button className="danger" onClick={() => void onDelete(menu.node)}>Excluir</button></div>; }
function Welcome({ onOpen, onCreate }: { onOpen: () => void; onCreate: () => void }) { return <div className="welcome"><div className="welcome-orbit"><span>A</span></div><div className="welcome-eyebrow">KORCZAK TECHNOLOGIES</div><h1>Aurora</h1><p>Ambiente de desenvolvimento profissional para criar, executar e depurar.</p><div className="welcome-actions"><button className="primary" onClick={onOpen}>Abrir pasta</button><button onClick={onCreate}>Novo arquivo</button></div><div className="welcome-grid"><div><b>Ctrl + P</b><span>Abrir arquivo</span></div><div><b>Ctrl + Shift + P</b><span>Comandos</span></div><div><b>Ctrl + F</b><span>Pesquisar</span></div><div><b>Ctrl + `</b><span>Terminal</span></div></div></div>; }

monaco.editor.defineTheme('kz-dark', { base: 'vs-dark', inherit: true, rules: [{ token: 'comment', foreground: '6A7882', fontStyle: 'italic' }, { token: 'keyword', foreground: 'D8E8F0' }, { token: 'string', foreground: 'A9C8D8' }, { token: 'number', foreground: 'C8DCE6' }, { token: 'type', foreground: 'DCE8ED' }, { token: 'identifier', foreground: 'D4DDE2' }, { token: 'delimiter', foreground: '758691' }, { token: 'operator', foreground: 'B8CBD5' }], colors: { 'editor.background': '#070A0E', 'editor.foreground': '#DCE5EB', 'editorLineNumber.foreground': '#46545E', 'editorLineNumber.activeForeground': '#C2D0D8', 'editorCursor.foreground': '#DDECF3', 'editor.selectionBackground': '#23333D', 'editor.inactiveSelectionBackground': '#162129', 'editor.lineHighlightBackground': '#0D141A', 'editorIndentGuide.background1': '#17222A', 'editorIndentGuide.activeBackground1': '#30414C', 'editorBracketHighlight.foreground1': '#A9C7D6', 'editorBracketHighlight.foreground2': '#8DAFBE', 'editorBracketHighlight.foreground3': '#6F91A2', 'editorWidget.background': '#0D1318', 'editorWidget.border': '#354550', 'editorSuggestWidget.background': '#0D1318', 'editorSuggestWidget.border': '#354550', 'editorHoverWidget.background': '#0D1318', 'editorHoverWidget.border': '#354550', 'editorGutter.background': '#070A0E', 'scrollbarSlider.background': '#2C3B4588', 'scrollbarSlider.hoverBackground': '#415560AA', 'scrollbarSlider.activeBackground': '#5A717DCC' } });
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
