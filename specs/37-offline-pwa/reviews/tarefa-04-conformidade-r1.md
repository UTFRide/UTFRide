# Parecer de Conformidade — Tarefa 4

**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA4 — Persistência e leitura offline de `passengerTrips` (`/rides/my-trips`) sem HTTP quando há cache e erro de conexão quando ausente | atendido | `apps/web/src/app/core/services/ride-request-data.ts:383-416`, `apps/web/src/app/core/services/ride-request-data.spec.ts:351-497` |
| CA4 — Persistência e leitura offline de solicitação do passageiro por oferta (`/rides/:id`), incluindo `null` em cache e erro de conexão para oferta nunca consultada | atendido | `apps/web/src/app/core/services/ride-request-data.ts:455-473`, `apps/web/src/app/core/services/ride-request-data.ts:884-888`, `apps/web/src/app/core/services/ride-request-data.spec.ts:377-461` |
| CA4 — Persistência e leitura offline de solicitações recebidas por oferta do motorista (`/driver/my-rides`) sem HTTP | atendido | `apps/web/src/app/core/services/ride-request-data.ts:202-210`, `apps/web/src/app/core/services/ride-request-data.ts:892-924`, `apps/web/src/app/core/services/ride-request-data.spec.ts:499-559` |
| CA4 — Persistência e leitura offline de notificações do usuário (`NotificationData`) sem HTTP quando há cache e erro de conexão quando ausente | atendido | `apps/web/src/app/core/services/notification-data.ts:73-101`, `apps/web/src/app/core/services/notification-data.spec.ts:53-149` |
| CA5 — Bloqueio sem HTTP de `createRequest`, `cancelPassengerRequest`, `accept`, `reject`, `cancelRide` (cascata) e `createCancellationNotifications$` quando offline | atendido | `apps/web/src/app/core/services/ride-request-data.ts:265-267`, `apps/web/src/app/core/services/ride-request-data.ts:296-298`, `apps/web/src/app/core/services/ride-request-data.ts:338-340`, `apps/web/src/app/core/services/ride-request-data.ts:543`, `apps/web/src/app/core/services/ride-request-data.ts:575`, `apps/web/src/app/core/services/notification-data.ts:152-154` |
| CA7 — Isolamento de cache por `userId`, limpeza no logout, reabilitação após evento `online` e cobertura Vitest sem chamadas reais de rede | atendido | `apps/web/src/app/core/services/ride-request-data.spec.ts:462-690`, `apps/web/src/app/core/services/notification-data.spec.ts:131-213` |
| CA1, CA2, CA3, CA6 (telas, banner, login/registro, `authGuard` e diálogo de saída) | fora desta tarefa | — |

## Apontamentos
