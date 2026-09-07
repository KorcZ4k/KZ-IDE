# KZ-IDE

> Um IDE desktop leve, funcional, tecnológico, moderno e **autoral**.

## Etapa 1 — Rascunho

A primeira etapa estabelece a identidade e a fundação do KZ-IDE sem tentar copiar a interface do VS Code.

### Objetivos

- aplicação desktop com Electron;
- frontend em React + TypeScript;
- arquitetura preparada para IPC seguro;
- editor inspirado em fluxos modernos de código;
- Explorer, abas, editor, terminal e status bar;
- identidade visual própria, minimalista e escura;
- base preparada para workspace, filesystem, Git, LSP e extensões nas próximas etapas.

### Stack

- Electron
- React
- TypeScript
- Vite
- Monaco Editor (dependência planejada para o editor completo)
- Node.js

## Princípios

1. **Leve:** evitar complexidade e dependências desnecessárias.
2. **Funcional:** cada recurso deve resolver um problema real.
3. **Tecnológico:** arquitetura moderna e extensível.
4. **Autoral:** identidade, UX e decisões próprias; inspiração não significa cópia.
5. **Evolutivo:** a Etapa 1 deve permitir chegar às etapas seguintes sem reescrever o núcleo.

## Estrutura inicial

```text
src/
├── main/       # Processo Electron
├── renderer/   # Interface React
├── core/       # Serviços do IDE (próximas etapas)
└── shared/     # Tipos compartilhados
```

## Próxima etapa

A Etapa 2 transforma o protótipo visual em um IDE funcional: filesystem real, workspace, terminal integrado, operações de arquivos, atalhos, busca e Command Palette.
