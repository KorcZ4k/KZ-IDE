# KZ-IDE

> Um IDE desktop leve, funcional, tecnológico, moderno e **autoral**.

## Etapa 2 — Funcionamento

A segunda etapa transforma a fundação visual em um IDE desktop funcional para projetos reais.

### O que já funciona

- workspace real por seleção de pasta;
- Explorer alimentado pelo filesystem;
- navegação recursiva de diretórios;
- abertura de arquivos reais;
- abas com estado de arquivo;
- indicador de alterações não salvas;
- salvar com `Ctrl + S`;
- editor Monaco com linguagem detectada pela extensão;
- tema visual próprio do KZ-IDE;
- criação de arquivo;
- exclusão do arquivo ativo;
- busca rápida de arquivos com `Ctrl + P`;
- Command Palette com `Ctrl + Shift + P`;
- terminal integrado com execução de comandos reais;
- `Ctrl + \`` para abrir/fechar terminal;
- ponte segura Electron ↔ renderer via `contextBridge` e IPC;
- execução com `nodeIntegration: false` e `contextIsolation: true`;
- build separado para Electron e renderer.

### Estrutura

```text
src/
├── main/
│   ├── main.ts        # Janela Electron
│   ├── ipc.ts         # Handlers IPC
│   ├── filesystem.ts  # Workspace e arquivos
│   └── terminal.ts    # Execução de comandos
├── preload/
│   └── index.ts       # API segura exposta ao renderer
├── renderer/
│   ├── main.tsx       # Aplicação React
│   └── styles.css     # Identidade visual
└── shared/
    └── api.ts         # Contratos compartilhados
```

## Comandos

```bash
npm install
npm run build
npm start
```

Durante o desenvolvimento, o renderer pode ser executado com `npm run dev` para iteração rápida da interface.

## Princípios

1. **Leve:** evitar complexidade e dependências desnecessárias.
2. **Funcional:** cada recurso deve resolver um problema real.
3. **Tecnológico:** arquitetura moderna e extensível.
4. **Autoral:** identidade, UX e decisões próprias; inspiração não significa cópia.
5. **Evolutivo:** cada etapa prepara a próxima sem descartar o núcleo anterior.

## Próxima etapa

A Etapa 3 entra nos recursos profissionais: LSP, diagnósticos, autocomplete contextual, Git, debugger, configurações e arquitetura inicial de extensões.
