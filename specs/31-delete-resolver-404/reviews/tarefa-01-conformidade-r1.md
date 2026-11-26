<Parecer de Conformidade — Tarefa 1>
**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA1 — `RideData` executa `DELETE /rest/v1/rides?id=eq.<rideId>` para oferta `cancelled` do motorista autor ativo e remove a oferta de `driverRides` (e limpa `editingRide` correspondente); parte de UI/modal fica para a Tarefa 2 | atendido | `apps/web/src/app/core/services/ride-data.ts:315-355`, `apps/web/src/app/core/services/ride-data.ts:602-613`, `apps/web/src/app/core/services/ride-data.spec.ts:945-999` |
| CA2 — Bloqueio sem HTTP para ofertas `active`, `full` ou `completed`, conta bloqueada, perfil `support`, usuário não autenticado ou não autor (`driverId !== currentUser.id`) via `canDelete` e `deleteRide` (`{ invalidState: true }` / `{ unauthorized: true }`) | atendido | `apps/web/src/app/core/services/ride-data.ts:321-327`, `apps/web/src/app/core/services/ride-data.ts:531-539`, `apps/web/src/app/core/services/ride-data.ts:602-604`, `apps/web/src/app/core/services/ride-data.spec.ts:1001-1138` |
| CA3 — Tratamento de falha de conexão (`status === 0` → `{ connectionError: true }`) e erro do servidor (`{ requestError: true }`) preservando estado para nova tentativa ou cancelamento (`resetDelete`) | atendido | `apps/web/src/app/core/services/ride-data.ts:346-348`, `apps/web/src/app/core/services/ride-data.ts:703-713`, `apps/web/src/app/core/services/ride-data.spec.ts:1140-1210` |
| CA4 — Pré-carregamento em `/rides/:id` com `rideDetailResolver` | fora desta tarefa | — |
| CA5 — Rota curinga `**` e página standalone `NotFound` | fora desta tarefa | — |
| CA6 — Abandono no meio / troca de sessão isolada sem sobrescrever estado (`resetDelete` cancela `DELETE` pendente; `filter` e `catchError` checam `driver === this.auth.currentUser()`) e testes Vitest sem chamadas de rede reais (282/282 testes passando em `npm test`, sendo 24 em `ride-data.spec.ts`) | atendido | `apps/web/src/app/core/services/ride-data.ts:315-355`, `apps/web/src/app/core/services/ride-data.spec.ts:1212-1262` |

## Apontamentos

</Parecer de Conformidade — Tarefa 1>