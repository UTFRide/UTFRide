# Parecer de Conformidade — Tarefa 6

**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA8 — Sino de notificações no cabeçalho, à esquerda da foto do aluno, no mesmo padrão dos demais ícones, sem menção a SMS | atendido | `apps/web/src/app/shared/components/notification-bell/notification-bell.html:1-75`, `apps/web/src/app/features/rides/ride-list/ride-list.html:2-23`, `apps/web/src/app/features/driver/offer-ride/offer-ride.html:8-23`, `apps/web/src/app/features/driver/my-rides/my-rides.html:8-25`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:36-62,152-216` |
| CA8 — Ao abrir o sino, o passageiro autenticado visualiza avisos de ofertas canceladas em que estava confirmado ou tinha solicitação pendente | atendido | `apps/web/src/app/core/services/notification-data.ts:36-87,122-128`, `apps/web/src/app/shared/components/notification-bell/notification-bell.ts:25-44`, `apps/web/src/app/features/rides/ride-list/ride-list.ts:15-25`, `apps/web/src/app/shared/components/notification-bell/notification-bell.spec.ts:18-62`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:64-106` |
| CA8 — Um aluno não visualiza avisos de outros alunos pelo aplicativo (inclusive após troca ou encerramento de sessão) | atendido | `apps/web/src/app/core/services/notification-data.ts:36-44,51-65,81-87,122-128`, `apps/web/src/app/core/services/notification-data.spec.ts:117-178`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:82-150` |
| Telas autenticadas e navegação sem implementar pesquisa da US03 e sem extração geral de cabeçalho/navegação | atendido | `apps/web/src/app/features/rides/ride-list/ride-list.html:25-60`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:152-216` |
| CA1, CA2, CA3, CA4, CA5, CA6, CA7 | fora desta tarefa (cobertos nas Tarefas 1 a 5) | `specs/5-publicacao-gestao-oferta-carona/plan.md:14-37` |
| CA9, CA10, CA11 | fora desta tarefa (cobertos nas Tarefas 7 a 9) | `specs/5-publicacao-gestao-oferta-carona/plan.md:44-57` |

## Apontamentos

Evidência de testes (`npm test`):
- `pretest` (`apps/web/src/app/features/auth/layout.spec.mjs`): 2 passed (2).
- `ng test --watch=false` (Vitest): 14 test files passed (14), 64 tests passed (64).
