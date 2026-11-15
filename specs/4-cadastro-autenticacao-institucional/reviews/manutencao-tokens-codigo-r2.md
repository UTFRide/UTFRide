# Parecer de Código — Manutenção de tokens, rodada 2

**Veredito: APONTAMENTOS**

## Apontamentos (bloqueiam)

1. **O novo teste de regressão não integra a suíte padrão** — [layout.spec.mjs](C:/Users/Geovane/Desktop/UTFRIDE/UTFRide/apps/web/src/app/features/auth/layout.spec.mjs:21)

   A arquitetura, nas seções 1.1 e 8, define testes com Vitest pelo Angular CLI, executados por `npm test`. O novo teste usa `node:test` em um arquivo `.mjs`; a configuração padrão do builder inclui apenas arquivos `.spec.ts` e `.test.ts`.

   **Prejuízo concreto:** uma futura colisão entre tokens e larguras de contêiner não será detectada pelo comando padrão de testes.

## Sugestões (não bloqueiam)

Nenhuma. O ajuste da rodada anterior removeu a dependência dos nomes internos das variáveis CSS.

## Observações fora do escopo deste diff

O teste de largura já existente no mesmo arquivo também ficava fora da suíte padrão antes desta alteração.

O comando solicitado, `node --test apps/web/src/app/features/auth/layout.spec.mjs`, passou com **2 testes e nenhuma falha**. Nenhum arquivo foi alterado.
