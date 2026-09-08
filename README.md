# KZ-IDE

> Um IDE desktop leve, funcional, tecnológico, moderno e **autoral**.

## Etapa 5.1 — Hardening profissional

A base da Etapa 5 foi endurecida para tornar o projeto mais confiável antes de avançar para recursos pesados de IDE.

### Entregue

- filesystem protegido contra operações fora do workspace;
- bloqueio de exclusão da raiz do workspace;
- limite de 10 MB para leitura de arquivos no editor;
- criação de arquivos sem sobrescrita acidental;
- validação e normalização das configurações persistidas;
- ferramenta de segurança de paths isolada e testável;
- testes automatizados de segurança do workspace;
- CI com instalação, build e testes;
- dependências diretas com versões fixadas, evitando `latest` imprevisível;
- IPC de filesystem mantém compatibilidade com o renderer e resolve o workspace autorizado no processo principal.

### Segurança do filesystem

Operações de leitura, escrita, criação, remoção e rename passam por uma validação de caminho no processo principal. Caminhos absolutos ou relativos que escapem do workspace são rejeitados.

O renderer continua sem acesso direto ao Node. O modelo permanece:

```text
Renderer
   │
   ▼
Preload / contextBridge
   │
   ▼
Electron Main
   │
   ├── Workspace boundary
   ├── Filesystem
   ├── Git
   ├── Terminal
   └── Services
```

### Qualidade

O pipeline executa:

```bash
npm install --no-audit --no-fund
npm run build
node --test tests/*.test.mjs
```

O projeto ainda não afirma paridade funcional total com VS Code. Os próximos saltos de qualidade são LSP real, diagnostics semânticos, Go to Definition/Hover/Rename, DAP/debugger, extension host, indexação incremental e packaging multiplataforma.

## Configurações

As preferências ficam no perfil de dados do Electron e são normalizadas ao carregar/salvar:

- tamanho da fonte: 8–32;
- minimap;
- quebra de linha;
- auto save;
- confirmação antes de excluir.

Atalho: `Ctrl/Cmd + ,`.

## Comandos

```bash
npm install
npm run build
npm test
npm start
```

## Roadmap

1. **Rascunho** — identidade, arquitetura e interface inicial.
2. **Funcionamento** — filesystem real, tabs, Monaco, terminal e atalhos.
3. **Aprimoramento** — Git, Source Control e base profissional.
4. **Adaptação para escala** — persistência, recentes e CI.
5. **Mesmo nível para VS Code** — serviços, busca, diagnósticos, autocomplete e configurações persistentes.
5.1. **Hardening profissional** — segurança de filesystem, settings robustos, testes e CI.
