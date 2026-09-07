import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type FileItem = { name: string; type: 'file' | 'folder'; children?: FileItem[] };

const initialFiles: FileItem[] = [
  { name: 'src', type: 'folder', children: [{ name: 'main.ts', type: 'file' }, { name: 'App.tsx', type: 'file' }] },
  { name: 'package.json', type: 'file' },
  { name: 'README.md', type: 'file' }
];

function App() {
  const [activeFile, setActiveFile] = useState('main.ts');
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [terminalText, setTerminalText] = useState('KZ-IDE Terminal\n\nReady.');
  const [saved, setSaved] = useState(true);

  const openFile = (name: string) => {
    if (name.includes('.')) {
      setActiveFile(name);
      setSaved(false);
    }
  };

  return (
    <div className="app">
      <header className="titlebar">
        <div className="brand"><span className="brand-mark">KZ</span><strong>KZ-IDE</strong></div>
        <nav className="menu"><span>File</span><span>Edit</span><span>View</span><span>Run</span><span>Terminal</span><span>Help</span></nav>
        <div className="window-state">●</div>
      </header>

      <main className="workspace">
        <aside className="activitybar">
          <button className="activity active" title="Explorer">▤</button>
          <button className="activity" title="Search">⌕</button>
          <button className="activity" title="Source Control">⑂</button>
          <button className="activity" title="Run and Debug">▷</button>
          <button className="activity" title="Extensions">◇</button>
        </aside>

        <aside className="sidebar">
          <div className="sidebar-title">EXPLORER</div>
          <div className="section-title">KZ-IDE</div>
          <FileTree items={initialFiles} onOpen={openFile} />
        </aside>

        <section className="main-area">
          <div className="tabs">
            <button className="tab active"><span className="file-dot">●</span>{activeFile}<span className="close">×</span></button>
            <button className="new-tab" onClick={() => setActiveFile('Welcome')}>+</button>
          </div>

          <div className="editor">
            {activeFile === 'Welcome' ? <Welcome /> : <CodeEditor file={activeFile} />}
          </div>

          {terminalOpen && (
            <section className="terminal">
              <div className="panel-tabs"><span className="panel-active">TERMINAL</span><span>OUTPUT</span><span>PROBLEMS</span><button onClick={() => setTerminalOpen(false)}>×</button></div>
              <textarea value={terminalText} onChange={(e) => setTerminalText(e.target.value)} aria-label="Terminal" />
            </section>
          )}
        </section>
      </main>

      <footer className="statusbar">
        <span>main</span><span>UTF-8</span><span>TypeScript</span><span>Ln 1, Col 1</span><span className="status-spacer" />
        <button onClick={() => setTerminalOpen(!terminalOpen)}>Terminal</button>
        <button onClick={() => setSaved(true)}>{saved ? '✓ Saved' : '● Unsaved'}</button>
      </footer>
    </div>
  );
}

function FileTree({ items, onOpen, depth = 0 }: { items: FileItem[]; onOpen: (name: string) => void; depth?: number }) {
  return <div>{items.map((item) => (
    <div key={item.name}>
      <button className="tree-item" style={{ paddingLeft: `${12 + depth * 16}px` }} onClick={() => onOpen(item.name)}>
        <span>{item.type === 'folder' ? '▸' : '•'}</span><span>{item.name}</span>
      </button>
      {item.children && <FileTree items={item.children} onOpen={onOpen} depth={depth + 1} />}
    </div>
  ))}</div>;
}

function CodeEditor({ file }: { file: string }) {
  const [code, setCode] = useState(file.endsWith('.json') ? '{\n  "name": "kz-ide",\n  "version": "0.1.0"\n}' : '// KZ-IDE\n\nfunction start() {\n  console.log("Hello from KZ-IDE");\n}\n\nstart();');
  return <div className="code-wrap"><div className="line-numbers">{code.split('\n').map((_, i) => <span key={i}>{i + 1}</span>)}</div><textarea className="code" value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} aria-label="Code editor" /></div>;
}

function Welcome() {
  return <div className="welcome"><div className="welcome-mark">KZ</div><h1>KZ-IDE</h1><p>Leve. Tecnológico. Autoral.</p><div className="welcome-grid"><div><b>Start</b><button>Abrir pasta</button><button>Novo arquivo</button></div><div><b>Explore</b><span>Ctrl + P · Abrir arquivo</span><span>Ctrl + Shift + P · Comandos</span><span>Ctrl + ` · Terminal</span></div></div></div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
