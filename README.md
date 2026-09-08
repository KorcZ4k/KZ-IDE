# KZ-IDE

> Um IDE desktop leve, funcional, tecnológico, moderno e **autoral**.

## Etapa 5 — Mesmo nível para VS Code

A quinta etapa consolida o KZ-IDE como uma IDE desktop de verdade. O objetivo não é copiar o VS Code, mas atingir o mesmo patamar de fluxo diário mantendo uma interface própria, compacta e direta.

### Entregue

- editor Monaco com preferências persistentes de fonte, minimap e word wrap;
- Command Palette ampliada para operações centrais;
- busca rápida de arquivos com `Ctrl/Cmd + P`;
- busca de conteúdo em todo o workspace com `Ctrl/Cmd + F`;
- resultados de busca com arquivo e linha para navegação rápida;
- diagnósticos locais no editor com markers Monaco;
- painel Problems integrado ao terminal;
- autocomplete contextual básico por linguagem para TypeScript, JavaScript, Python, Rust, Go, Java, C/C++;
- Source Control Git mantido como serviço isolado;
- terminal integrado e fluxo Run/Debug preparado para evolução;
- configurações persistentes no perfil do KZ-IDE (`userData` do Electron);
- IPC tipado entre renderer, preload e processo principal;
- arquitetura de serviços separada para workspace, busca e configurações;
- versão do produto atualizada para `0.5.0`.

### O que mudou na arquitetura

```text
                         KZ-IDE 0.5
                              │
             ┌────────────────┼────────────────┐
             │                │                │
          Renderer          Preload        Electron Main
             │                │                │
      ┌──────┼──────┐         │       ┌────────┼─────────┐
      │      │      │         │       │        │         │
   Monaco  Panels  UX    contextBridge Filesystem Git  Services
      │      │      │         │       │        │         │
      └──────┴──────┴─────────┴───────┴────────┴─────────┘
                         IPC seguro

Services:
  • Workspace State
  • Settings
  • Content Search
  • Terminal
  • Git
```

### Configurações

As preferências ficam fora do projeto, no perfil de dados do Electron. O usuário pode controlar:

- tamanho da fonte;
- minimap;
- quebra de linha;
- auto save (preferência persistida para a próxima evolução);
- confirmação antes de excluir arquivos.

Atalho: `Ctrl/Cmd + ,`.

### Pesquisa e diagnóstico

A busca de conteúdo percorre os formatos de código e documentação mais comuns, ignora `.git`, `node_modules`, `dist` e `build`, e limita resultados para manter a interface responsiva.

Os diagnósticos atuais são deliberadamente leves: o editor detecta problemas estruturais simples, como delimitadores desbalanceados, e marca `TODO` como aviso. A arquitetura fica pronta para substituir essa camada por LSP real sem acoplar o renderer a processos externos.

### Segurança e evolução

O processo de UI continua sem acesso direto ao Node: `contextIsolation` permanece ativo, `nodeIntegration` continua desativado e o sandbox do renderer é preservado. Recursos do sistema passam pelo preload e por handlers IPC tipados.

A próxima evolução natural é conectar servidores LSP reais, DAP/debuggers, extensões em sandbox, refatoração semântica e testes automatizados de integração.

## Comandos

```bash
npm install
npm run build
npm start
```

## Roadmap concluído

1. **Rascunho** — identidade, arquitetura e interface inicial.
2. **Funcionamento** — filesystem real, tabs, Monaco, terminal e atalhos.
3. **Aprimoramento** — Git, Source Control e base profissional.
4. **Adaptação para escala** — persistência, recentes e CI.
5. **Mesmo nível para VS Code** — serviços, busca, diagnósticos, autocomplete e configurações persistentes.
