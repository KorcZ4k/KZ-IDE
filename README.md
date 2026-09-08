# KZ-IDE

> **Aurora - Korczak IDE** — um IDE desktop leve, funcional, tecnológico, moderno e autoral.

## Aurora 0.9 — Cloud & Collaboration

A 0.9 transforma a colaboração em uma camada de tempo real integrada ao IDE, mantendo o renderer isolado do Node e concentrando rede e filesystem no processo principal.

### Entregue

- sessões hospedadas pelo próprio Aurora;
- conexão `ws://` e `wss://`;
- relay WebSocket standalone em `relay/server.mjs` para publicação na internet;
- autenticação por token criptograficamente aleatório;
- até 16 participantes por sessão;
- chat em tempo real;
- presença com nickname, papel e cor de colaborador;
- papéis `owner`, `editor` e `viewer`;
- kick e alteração de permissão pelo host;
- sincronização inicial de workspace;
- edição de arquivos em tempo real;
- versão por arquivo e detecção de conflitos por `baseVersion`;
- cursores/selections preparados para presença de edição;
- reconexão automática do cliente após queda da conexão;
- limites de payload e tamanho de arquivo;
- proteção contra path traversal;
- exclusão de `node_modules`, `.git`, `dist` e `release` da sincronização;
- limite de 200 arquivos e 1 MB por arquivo no snapshot;
- painel visual de Collaboration integrado ao Aurora;
- bridge IPC tipada para host, join, sync, edição, cursor, presença, permissões e chat;
- testes de source audit da camada 0.9;
- packaging Linux exclusivamente em `.deb`.

### Arquitetura

```text
Aurora Renderer
   │
   ▼
Preload / contextBridge
   │
   ▼
Electron Main
   ├── Workspace boundary
   ├── Filesystem
   ├── Git
   ├── Terminal
   ├── Debugger
   ├── Updater
   └── Collaboration WebSocket
              │
              └── opcional: relay/server.mjs → wss://
```

### Relay

O relay é stateless em relação ao workspace: ele apenas autentica a sala, controla presença/permissões e encaminha mensagens. O conteúdo dos arquivos continua sendo tratado pelos clientes/host. Para produção, execute atrás de TLS/reverse proxy e use `wss://`.

```bash
npm run relay
```

Variáveis opcionais: `PORT` (padrão `8787`) e `MAX_CLIENTS` (padrão `1000`).

### Segurança

O token da sessão é criado no processo principal com aleatoriedade criptográfica. Mensagens têm limite de payload, nomes e chat são limitados, sessões são limitadas a 16 peers, snapshots limitam arquivos/tamanho, caminhos recebidos são resolvidos dentro do workspace e edições concorrentes são rejeitadas quando a versão-base diverge.

## Qualidade

A auditoria da 0.9 cobre:

- engine de colaboração e reconexão;
- operações de edição, versionamento e conflitos;
- presença, cursores e permissões;
- bridge IPC/preload;
- relay independente e limites de segurança;
- packaging Linux `.deb`.

Pipeline:

```bash
npm install --no-audit --no-fund
npm run build
node --test tests/*.test.mjs
```

## Configurações

As preferências ficam no perfil de dados do Electron:

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
npm run relay
```

## Roadmap

1. **Rascunho** — identidade, arquitetura e interface inicial.
2. **Funcionamento** — filesystem real, tabs, Monaco, terminal e atalhos.
3. **Aprimoramento** — Git, Source Control e base profissional.
4. **Adaptação para escala** — persistência, recentes e CI.
5. **Mesmo nível para VS Code** — serviços, busca, diagnósticos, autocomplete e configurações persistentes.
5.1. **Hardening profissional** — segurança de filesystem, settings robustos, testes e CI.
0.8. **Professional IDE UX** — Explorer, terminal, menus, palette, busca, resize, Run & Debug e refinamento visual.
0.9. **Cloud & Collaboration** — tempo real, presença, permissões, conflitos, reconexão, relay e sincronização multi-peer.
1.0. **Advanced IDE** — AI, debugger avançado, banco de dados, Docker, profiling, remote development, auto-update e expansão multiplataforma.
