# Parecer de Conformidade — Tarefa 6

**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA8 — Sino de notificações no cabeçalho, à esquerda da foto do aluno, no mesmo padrão dos demais ícones, sem menção a SMS | atendido | `apps/web/src/app/shared/components/notification-bell/notification-bell.html:1-84`, `apps/web/src/app/shared/pipes/initials-pipe.ts:1-22`, `apps/web/src/app/features/rides/ride-list/ride-list.html:2-24`, `apps/web/src/app/features/driver/offer-ride/offer-ride.html:2-25`, `apps/web/src/app/features/driver/my-rides/my-rides.html:2-27`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:36-62,155-218` |
| CA8 — Ao abrir o sino, o passageiro autenticado visualiza avisos de ofertas canceladas em que estava confirmado ou tinha solicitação pendente | atendido | `apps/web/src/app/core/services/notification-data.ts:39-106,154-160`, `apps/web/src/app/shared/components/notification-bell/notification-bell.ts:15-35`, `apps/web/src/app/features/rides/ride-list/ride-list.ts:13-23`, `apps/web/src/app/features/driver/offer-ride/offer-ride.ts:82-84,255-257`, `apps/web/src/app/features/driver/my-rides/my-rides.ts:40-42,159-161`, `apps/web/src/app/shared/components/notification-bell/notification-bell.spec.ts:18-62`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:66-153` |
| CA8 — Um aluno não visualiza avisos de outros alunos pelo aplicativo (inclusive após troca ou encerramento de sessão) | atendido | `apps/web/src/app/core/services/notification-data.ts:39-47,55-68,82-86,100-106,154-160`, `apps/web/src/app/core/services/notification-data.spec.ts:118-179,274-283`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:84-153` |
| Decisões R1 e restrições de escopo — propagação de falhas de carregamento sem falso estado vazio, remoção da duplicação de iniciais em `shared/pipes/` e manutenção da pesquisa US03 / extração geral de cabeçalho e navegação fora de escopo | atendido | `apps/web/src/app/core/services/notification-data.ts:49-106,136-152`, `apps/web/src/app/shared/components/notification-bell/notification-bell.html:46-61`, `apps/web/src/app/shared/pipes/initials-pipe.ts:1-22`, `apps/web/src/app/features/rides/ride-list/ride-list.html:26-61`, `apps/web/src/app/core/services/notification-data.spec.ts:181-284`, `apps/web/src/app/shared/components/notification-bell/notification-bell.spec.ts:116-158`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:220-359` |
| CA1, CA2, CA3, CA4, CA5, CA6, CA7 | fora desta tarefa (cobertos nas Tarefas 1 a 5) | `specs/5-publicacao-gestao-oferta-carona/plan.md:14-37` |
| CA9, CA10, CA11 | fora desta tarefa (cobertos nas Tarefas 7 a 9) | `specs/5-publicacao-gestao-oferta-carona/plan.md:44-57` |

## Apontamentos

Evidências verificadas na Rodada 2:
- Diff inspecionado na íntegra contra o commit base `e8f34d47642cfe1348274df352321ffdcb37e82c` (`HEAD` / `e8f34d4`, `tarefa 5: cancelar oferta e registrar avisos`; nota: o comando do despacho trazia `e8f34d47642cfe1348274df52321ffdcb37e82c`, sem o dígito `3` em `4df352321`).
- `npm test`:
  - `pretest` (`apps/web/src/app/features/auth/layout.spec.mjs`): 2 passed (2).
  - `ng test --watch=false` (Vitest): 15 test files passed (15), 72 tests passed (72).
