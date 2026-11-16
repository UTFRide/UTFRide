# Parecer de Código — Tarefa 2

**Veredito:** APROVADO

## Apontamentos (bloqueiam)
Nenhum apontamento bloqueante. O código respeita integralmente o `docs/architecture.md`, o `.agents/rules/01-angular-strict-rules.md` e o `docs/design-tokens.md`, com testes (`npm test`) e linter (`npm run lint`) passando sem falhas.

## Sugestões (não bloqueiam)
- **Extração de `mapError` compartilhado entre serviços de domínio** — [`ride-data.ts`](file:///c:/Users/duduk/Documents/UTFRide/apps/web/src/app/core/services/ride-data.ts#L132-L142) e [`ride-request-data.ts`](file:///c:/Users/duduk/Documents/UTFRide/apps/web/src/app/core/services/ride-request-data.ts#L182-L192) possuem a mesma lógica privada `mapError(error: unknown): RideErrorResult`. Caso novos serviços de domínio precisem do mesmo mapeamento nas próximas tarefas, vale centralizá-lo (por exemplo, em `ErrorNotice` ou em um utilitário em `core/services/`).
- **Consistência no cálculo de iniciais do passageiro** — [`ride-request-card.ts`](file:///c:/Users/duduk/Documents/UTFRide/apps/web/src/app/features/driver/my-rides/ride-request-card.ts#L17-L25) extrai as iniciais considerando nome e sobrenome (`Mariana Silva` → `MS`), enquanto [`my-rides.html`](file:///c:/Users/duduk/Documents/UTFRide/apps/web/src/app/features/driver/my-rides/my-rides.html#L79) usa `confirmed.passengerId.slice(0, 2).toUpperCase()` (`Mariana Silva` → `MA`). Unificar essa formatação deixará os avatares de confirmados e pendentes visualmente consistentes.

## Observações fora do escopo deste diff
- Nenhuma.
