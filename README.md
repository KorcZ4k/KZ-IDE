# KZ-IDE

> Um IDE desktop leve, funcional, tecnológico, moderno e **autoral**.

## Etapa 4 — Adaptação para escala

A quarta etapa prepara o núcleo do KZ-IDE para crescer sem perder leveza. O foco é persistência, estabilidade, isolamento e capacidade de evolução.

### Entregue

- persistência do último workspace;
- lista de até 8 workspaces recentes;
- restauração automática do workspace ao iniciar;
- armazenamento de estado no diretório de dados do Electron;
- separação clara entre renderer, preload e processo principal;
- filesystem, terminal e Git isolados atrás do IPC;
- CI no GitHub Actions para validar `npm install` + `npm run build` em cada push/PR para `main`;
- estrutura preparada para indexação, cache e serviços especializados nas próximas evoluções;
- manutenção da política Electron com `contextIsolation`, `nodeIntegration: false` e sandbox.

### Estado persistente

O KZ-IDE grava apenas informações operacionais do workspace: caminho atual e histórico recente. O arquivo fica no `userData` do Electron, sem depender de arquivos dentro do projeto.

### CI

O workflow `.github/workflows/ci.yml` usa Node 22, instala as dependências e executa o build. Isso cria uma barreira automática contra regressões de compilação antes de avançar para a Etapa 5.

### Arquitetura

```text
                 KZ-IDE
                    │
        ┌───────────┴───────────┐
        │                       │
     Renderer               Electron Main
        │                       │
     Preload                    ├── Filesystem
        │                       ├── Terminal
        │                       ├── Git
        │                       └── Workspace State
        │
        └─────── IPC seguro ────┘
```

## Comandos

```bash
npm install
npm run build
npm start
```

## Próxima etapa

A Etapa 5 será a consolidação do KZ-IDE: LSP real, autocomplete semântico, diagnósticos, debugger, extensões, configurações avançadas, pesquisa de conteúdo, refatoração, testes e uma UX capaz de competir diretamente com IDEs estabelecidos — sem abandonar a identidade autoral.
