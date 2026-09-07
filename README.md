# KZ-IDE

> Um IDE desktop leve, funcional, tecnológico, moderno e **autoral**.

## Etapa 3 — Aprimoramento

A terceira etapa adiciona recursos profissionais sem abandonar a proposta de simplicidade e identidade própria.

### Entregue

- editor Monaco como núcleo de edição;
- detecção de linguagem para várias linguagens comuns;
- tema KZ Dark autoral;
- Source Control com status Git;
- identificação de branch e arquivos alterados;
- execução segura de operações Git selecionadas;
- Pull, Push, Status e Diff pelo painel;
- Command Palette expandida;
- busca rápida de arquivos;
- terminal integrado conectado ao workspace;
- indicador de alterações do Git na Activity Bar;
- status bar com branch e estado do repositório;
- API compartilhada preparada para evoluir para LSP e debugger.

### Arquitetura

```text
Renderer
   │
   ▼
Preload / contextBridge
   │
   ▼
Electron IPC
   ├── Filesystem
   ├── Terminal
   └── Git
```

O frontend não recebe acesso direto ao Node. A comunicação continua passando pela API exposta pelo preload.

### Filosofia da Etapa 3

O KZ-IDE não deve ficar pesado apenas para acumular funcionalidades. Cada recurso deve justificar sua presença, permanecer modular e preservar a experiência autoral.

## Comandos

```bash
npm install
npm run build
npm start
```

## Próxima etapa

A Etapa 4 será dedicada a adaptação para escala: performance, isolamento de processos, persistência de workspace, indexação, cache, testes, observabilidade, segurança e empacotamento multiplataforma.
