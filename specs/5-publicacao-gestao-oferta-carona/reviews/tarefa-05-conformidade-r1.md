# Parecer de Conformidade — Tarefa 5

**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA7 — Cancelamento apenas pelo autor da oferta e somente antes da viagem | atendido | `apps/web/src/app/core/services/ride-data.ts:245-250`, `apps/web/src/app/core/services/ride-request-data.ts:185-193`, `apps/web/src/app/features/driver/my-rides/my-rides.ts:87-99` |
| CA7 — Confirmação explícita do cancelamento (fluxo alinhado ao protótipo `7._minhas_ofertas_e_gerenciar_solicita_es.html`, sem menção a SMS) | atendido | `apps/web/src/app/features/driver/my-rides/my-rides.ts:161-176`, `apps/web/src/app/features/driver/my-rides/my-rides.html:211-221,266-331`, `apps/web/src/app/features/driver/my-rides/my-rides.spec.ts:288-425` |
| CA7 — Oferta atualizada para `cancelled` e bloqueada para novas decisões/edições | atendido | `apps/web/src/app/core/services/ride-data.ts:252-265`, `apps/web/src/app/core/services/ride-request-data.ts:97-105,195-208`, `apps/web/src/app/features/driver/my-rides/my-rides.html:60-67,104-124` |
| CA7 — Solicitações `pending` passam para `cancelled` (preservando `accepted`, `rejected` e já `cancelled`) | atendido | `apps/web/src/app/core/services/ride-request-data.ts:246-276`, `apps/web/src/app/core/services/ride-request-data.spec.ts:170-305` |
| CA7 — Criação de um aviso interno (`notifications`) para cada passageiro confirmado (`accepted`) ou com solicitação anteriormente pendente (`pending`) | atendido | `apps/api/db.json:8`, `apps/web/src/app/core/models/notification.model.ts:1-7`, `apps/web/src/app/core/services/notification-data.ts:15-41`, `apps/web/src/app/core/services/ride-request-data.ts:250-288`, `apps/web/src/app/core/services/notification-data.spec.ts:10-92`, `apps/web/src/app/core/services/ride-request-data.spec.ts:272-305,345-399` |
| CA1, CA2, CA3, CA4, CA5, CA6 | fora desta tarefa (cobertos nas Tarefas 1 a 4) | `specs/5-publicacao-gestao-oferta-carona/plan.md:14-32` |
| CA8, CA9, CA10, CA11 | fora desta tarefa (cobertos nas Tarefas 6 a 9) | `specs/5-publicacao-gestao-oferta-carona/plan.md:39-57` |

## Apontamentos

Evidência de testes (`npm test`):
- `pretest` (`apps/web/src/app/features/auth/layout.spec.mjs`): 2 passed (2).
- `ng test --watch=false` (Vitest): 12 test files passed (12), 59 tests passed (59).
