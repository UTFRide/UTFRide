# Parecer de Conformidade — Tarefa 3

**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA4 — `LocationData` salva municípios online em cache local e não dispara buscas remotas ao IBGE quando offline | atendido | `apps/web/src/app/core/services/location-data.ts:25-59`, `apps/web/src/app/core/services/location-data.spec.ts:73-110` |
| CA4 — `RideData` persiste e lê offline ofertas disponíveis, `driverRides` (e edição) e detalhe da oferta sem chamadas HTTP | atendido | `apps/web/src/app/core/services/ride-data.ts:166-241,492-524,620-654,874-962`, `apps/web/src/app/core/services/ride-data.spec.ts:327-511` |
| CA4 — `resolveRideDetail` retorna oferta em cache offline e `{ status: 'error', connectionError: true }` sem HTTP quando ausente no cache | atendido | `apps/web/src/app/core/services/ride-data.ts:475-503`, `apps/web/src/app/core/resolvers/ride-detail-resolver.spec.ts:333-377` |
| CA5 — `RideData` bloqueia sem HTTP operações de escrita offline (`publish`, `update`, `deleteRide`, `cancel$`, `occupySeat$`) | atendido | `apps/web/src/app/core/services/ride-data.ts:259-261,311-313,389-391,781-783,810-812`, `apps/web/src/app/core/services/ride-data.spec.ts:513-561` |
| CA7 — Reabilitação automática ao voltar `online` (`LocationData` e `RideData`), isolamento de cache por `userId` após logout/troca de conta e testes Vitest simulando `offline`/`online` sem rede real (`npm test`: 26 arquivos, 341 testes passando + 2 testes de layout) | atendido | `apps/web/src/app/core/services/location-data.ts:47-51`, `apps/web/src/app/core/services/ride-data.ts:886-955`, `apps/web/src/app/core/services/location-data.spec.ts:92-110`, `apps/web/src/app/core/services/ride-data.spec.ts:390-405,563-574` |

## Apontamentos
