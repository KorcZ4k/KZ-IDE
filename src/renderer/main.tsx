import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as monaco from 'monaco-editor';
import type { FileNode } from '../shared/api';
import './styles.css';

type OpenFile = { path: string; name: string; content: string; dirty: boolean };

const languageFor = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'ts' || ext === 'tsx') return 'typescript';
  if (ext === 'js' || ext === 'jsx') return 'javascript';
  if (ext === 'json') return 'json';
  if (ext === 'css') return 'css';
  if (ext === 'html') return 'html';
  if (ext === 'md') return 'markdown';
  if (ext === 'py') return 'python';
  return 'plaintext';
};

function App() {
  const [root, setRoot] = useState<string | null>(null);
  const [tree, setTree] = useState<FileNode[]>([]);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [terminalLines, setTerminalLines] = useState<string[]>(['KZ-IDE Terminal', 'Digite um comando e pressione Enter.']);
  const [command, setCommand] = useState('');
  const [palette, setPalette] = useState(false);
  const [search, setSearch] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [notice, setNotice] = useState('Pronto');

  const active = openFiles.find((file) => file.path === activePath) ?? null;

  const refresh = async (workspace = root) => {
    if (!workspace) return;
    try { setTree(await window.kz.workspace.readTree(workspace)); } catch (error) { setNotice(error instanceof Error ? error.message : 'Não foi possível ler o workspace.'); }
  };

  const openWorkspace = async () => {
    const selected = await window.kz.workspace.open();
    if (!selected) return;
    setRoot(selected);
    setOpenFiles([]);
    setActivePath(null);
    await refresh(selected);
    setNotice(selected);
  };

  const openFile = async (node: FileNode) => {
    if (node.kind !== 'file') return;
    const existing = openFiles.find((file) => file.path === node.path);
    if (existing) { setActivePath(node.path); return; }
    try {
      const content = await window.kz.file.read(node.path);
      setOpenFiles((files) => [...files, { path: node.path, name: node.name, content, dirty: false }]);
      setActivePath(node.path);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Erro ao abrir arquivo.'); }
  };

  const saveActive = async () => {
    if (!active) return;
    try {
      await window.kz.file.write(active.path, active.content);
      setOpenFiles((files) => files.map((file) => file.path === active.path ? { ...file, dirty: false } : file));
      setNotice('Salvo');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Erro ao salvar.'); }
  };

  const createFile = async () => {
    if (!root) { await openWorkspace(); return; }
    const name = window.prompt('Nome do novo arquivo:', 'novo.ts');
    if (!name?.trim()) return;
    await window.kz.file.create(`${root}/${name.trim()}`, 'file');
    await refresh();
    setNotice(`Criado: ${name.trim()}`);
  };

  const removeActive = async () => {
    if (!active || !window.confirm(`Excluir ${active.name}?`)) return;
    await window.kz.file.remove(active.path);
    setOpenFiles((files) => files.filter((file) => file.path !== active.path));
    setActivePath(null);
    await refresh();
    setNotice('Arquivo removido');
  };

  const runCommand = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const cwd = root ?? await window.kz.terminal.cwd();
    setTerminalLines((lines) => [...lines, `$ ${trimmed}`]);
    setCommand('');
    const result = await window.kz.terminal.run(trimmed, cwd);
    const output = `${result.stdout}${result.stderr}`.trimEnd();
    setTerminalLines((lines) => [...lines, ...(output ? output.split('\n') : ['Concluído.']), result.code === 0 ? '✓' : `✕ código ${result.code}`]);
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void saveActive(); }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'p') { event.preventDefault(); setPalette(true); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') { event.preventDefault(); setSearch(true); }
      if (event.key === 'Escape') { setPalette(false); setSearch(false); }
      if ((event.ctrlKey || event.metaKey) && event.key === '`') { event.preventDefault(); setTerminalOpen((open) => !open); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active]);

  const flatFiles = useMemo(() => flatten(tree), [tree]);
  const filteredFiles = searchText ? flatFiles.filter((node) => node.name.toLowerCase().includes(searchText.toLowerCase())) : flatFiles;

  return <div className="app">
    <header className="titlebar">
      <div className="brand"><span className="brand-mark">KZ</span><strong>KZ-IDE</strong></div>
      <nav className="menu"><button>File</button><button>Edit</button><button>View</button><button>Run</button><button onClick={() => setTerminalOpen((open) => !open)}>Terminal</button><button>Help</button></nav>
      <div className="workspace-name">{root ? root.split(/[\\/]/).pop() : 'sem workspace'}</div>
    </header>

    <main className="workspace">
      <aside className="activitybar">
        <button className="activity active" title="Explorer">▤</button><button className="activity" title="Search" onClick={() => setSearch(true)}>⌕</button><button className="activity" title="Source Control">⑂</button><button className="activity" title="Run and Debug">▷</button><button className="activity" title="Extensions">◇</button>
      </aside>
      <aside className="sidebar">
        <div className="sidebar-head"><span>EXPLORER</span><div><button title="Abrir pasta" onClick={() => void openWorkspace()}>⌂</button><button title="Novo arquivo" onClick={() => void createFile()}>＋</button></div></div>
        <div className="section-title">{root ? root.split(/[\\/]/).pop() : 'ABRA UM WORKSPACE'}</div>
        {root ? <FileTree nodes={tree} onOpen={openFile} /> : <div className="empty"><p>O KZ-IDE trabalha com pastas reais.</p><button className="primary" onClick={() => void openWorkspace()}>Abrir pasta</button></div>}
      </aside>

      <section className="main-area">
        <div className="tabs">{openFiles.map((file) => <button key={file.path} className={`tab ${file.path === activePath ? 'active' : ''}`} onClick={() => setActivePath(file.path)}><span className="file-dot">{file.dirty ? '●' : '•'}</span>{file.name}<span className="close" onClick={(event) => { event.stopPropagation(); setOpenFiles((files) => files.filter((item) => item.path !== file.path)); if (file.path === activePath) setActivePath(null); }}>×</span></button>)}<button className="new-tab" onClick={() => setPalette(true)}>＋</button></div>
        <div className="editor">{active ? <MonacoEditor file={active} onChange={(content) => setOpenFiles((files) => files.map((file) => file.path === active.path ? { ...file, content, dirty: true } : file))} /> : <Welcome onOpen={openWorkspace} onCreate={createFile} />}</div>
        {terminalOpen && <section className="terminal"><div className="panel-tabs"><span className="panel-active">TERMINAL</span><span>OUTPUT</span><span>PROBLEMS</span><button onClick={() => setTerminalOpen(false)}>×</button></div><div className="terminal-output">{terminalLines.map((line, index) => <div key={`${index}-${line}`}>{line}</div>)}<div className="terminal-input"><span>$</span><input value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void runCommand(command); }} placeholder="comando..." autoFocus /></div></div></section>}
      </section>
    </main>

    <footer className="statusbar"><span>{root ? 'workspace' : 'standalone'}</span><span>{active ? languageFor(active.name) : 'KZ'}</span><span className="status-spacer" /><span>{notice}</span><button onClick={() => setTerminalOpen((open) => !open)}>Terminal</button>{active?.dirty && <button onClick={() => void saveActive()}>Salvar</button>}</footer>

    {palette && <CommandPalette onClose={() => setPalette(false)} actions={[['Abrir pasta', openWorkspace], ['Novo arquivo', createFile], ['Salvar arquivo', saveActive], ['Alternar terminal', () => setTerminalOpen((open) => !open)], ['Excluir arquivo ativo', removeActive]]} />}
    {search && <SearchDialog value={searchText} setValue={setSearchText} files={filteredFiles} onOpen={openFile} onClose={() => { setSearch(false); setSearchText(''); }} />}
  </div>;
}

function flatten(nodes: FileNode[]): FileNode[] { return nodes.flatMap((node) => node.kind === 'folder' ? flatten(node.children ?? []) : [node]); }

function FileTree({ nodes, onOpen, depth = 0 }: { nodes: FileNode[]; onOpen: (node: FileNode) => void; depth?: number }) {
  return <div>{nodes.map((node) => <div key={node.path}><button className="tree-item" style={{ paddingLeft: `${10 + depth * 15}px` }} onClick={() => node.kind === 'file' ? onOpen(node) : undefined}><span className="tree-icon">{node.kind === 'folder' ? '▸' : '•'}</span><span>{node.name}</span></button>{node.kind === 'folder' && <FileTree nodes={node.children ?? []} onOpen={onOpen} depth={depth + 1} />}</div>)}</div>;
}

function MonacoEditor({ file, onChange }: { file: OpenFile; onChange: (content: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    if (!ref.current) return;
    const editor = monaco.editor.create(ref.current, { value: file.content, language: languageFor(file.name), theme: 'kz-dark', automaticLayout: true, minimap: { enabled: false }, fontSize: 13, tabSize: 2, padding: { top: 14 }, smoothScrolling: true, scrollBeyondLastLine: false });
    const disposable = editor.onDidChangeModelContent(() => onChangeRef.current(editor.getValue()));
    return () => { disposable.dispose(); editor.dispose(); };
  }, [file.path]);
  return <div ref={ref} className="monaco-host" />;
}

function CommandPalette({ actions, onClose }: { actions: Array<[string, () => void | Promise<void>]>; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const items = actions.filter(([name]) => name.toLowerCase().includes(query.toLowerCase()));
  return <div className="overlay"><div className="palette"><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Digite um comando..." onKeyDown={(event) => { if (event.key === 'Escape') onClose(); if (event.key === 'Enter' && items[0]) { void items[0][1](); onClose(); } }} />{items.map(([name, action]) => <button key={name} onClick={() => { void action(); onClose(); }}>{name}</button>)}</div></div>;
}

function SearchDialog({ value, setValue, files, onOpen, onClose }: { value: string; setValue: (value: string) => void; files: FileNode[]; onOpen: (node: FileNode) => void; onClose: () => void }) {
  return <div className="overlay"><div className="palette search-dialog"><input autoFocus value={value} onChange={(event) => setValue(event.target.value)} placeholder="Pesquisar arquivo..." onKeyDown={(event) => { if (event.key === 'Escape') onClose(); if (event.key === 'Enter' && files[0]) { onOpen(files[0]); onClose(); } }} />{files.slice(0, 20).map((file) => <button key={file.path} onClick={() => { onOpen(file); onClose(); }}>{file.name}<small>{file.path}</small></button>)}</div></div>;
}

function Welcome({ onOpen, onCreate }: { onOpen: () => void; onCreate: () => void }) { return <div className="welcome"><div className="welcome-mark">KZ</div><h1>KZ-IDE</h1><p>Leve. Tecnológico. Autoral.</p><div className="welcome-actions"><button onClick={onOpen}>Abrir pasta</button><button onClick={onCreate}>Novo arquivo</button></div><div className="shortcuts"><span><b>Ctrl + P</b> Abrir arquivo</span><span><b>Ctrl + Shift + P</b> Comandos</span><span><b>Ctrl + `</b> Terminal</span></div></div>; }

monaco.editor.defineTheme('kz-dark', { base: 'vs-dark', inherit: true, rules: [], colors: { 'editor.background': '#0b0e12', 'editor.foreground': '#dbe2ea', 'editorLineNumber.foreground': '#4e5967', 'editorLineNumber.activeForeground': '#aab4c1', 'editorCursor.foreground': '#e5ebf2', 'editor.selectionBackground': '#26313d' } });
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
