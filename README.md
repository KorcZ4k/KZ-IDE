# KZ-IDE

> **Aurora - Korczak IDE** — um IDE desktop leve, funcional, tecnológico, moderno e autoral.

## Aurora 0.9 — Cloud & Collaboration

A 0.9 adiciona uma camada de colaboração integrada ao IDE, mantendo o renderer isolado do Node e concentrando rede e filesystem no processo principal.

### Entregue

- sessões de colaboração hospedadas pelo próprio Aurora;
- conexão por `ws://` ou `wss://`, preparada para relay/proxy na internet;
- token aleatório por sessão para autenticação dos participantes;
- múltiplos colaboradores na mesma sessão;
- chat de equipe em tempo real;
- sincronização de workspace sob demanda;
- proteção contra path traversal durante a aplicação de snapshots;
- limite de 200 arquivos e 1 MB por arquivo no snapshot colaborativo;
- exclusão de `node_modules`, `.git`, `dist` e `release` da sincronização;
- painel visual de Collaboration integrado ao Aurora;
- eventos de conexão, chat e sincronização enviados ao renderer via IPC;
- testes de integração/source audit para a camada 0.9;
- packaging Linux continua exclusivamente em `.deb`.

### Segurança da colaboração

O token da sessão é gerado no processo principal com bytes criptograficamente aleatórios. O cliente precisa apresentar o token para completar o handshake WebSocket. Snapshots recebidos também são validados para impedir escrita fora do workspace escolhido.

A arquitetura continua:

```text
Renderer
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
   └── Collaboration (WebSocket)
```

> Para colaboração pela internet, a sessão hospedada precisa ser publicada atrás de um relay/proxy WebSocket com TLS (`wss://`). O Aurora não depende de um servidor proprietário específico.

## Qualidade

O pipeline executa:

```bash
npm install --no-audit --no-fund
npm run build
node --test tests/*.test.mjs
```

Os testes da 0.9 verificam a autenticação por token, bridge IPC, UI de hospedagem/entrada, sincronização, chat e configuração de `.deb`.

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
0.8. **Professional IDE UX** — Explorer, terminal, menus, palette, busca, resize, Run & Debug e refinamento visual.
0.9. **Cloud & Collaboration** — sessões remotas, chat, sincronização de workspace e colaboração multi-peer.
1.0. **Advanced IDE** — AI, debugger avançado, banco de dados, Docker, profiling, remote development, auto-update e expansão multiplataforma.
