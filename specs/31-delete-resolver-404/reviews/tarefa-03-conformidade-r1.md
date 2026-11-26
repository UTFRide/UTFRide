<Parecer de Conformidade — Tarefa 3>
**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA4 — `rideDetailResolver` funcional na rota filha protegida `/rides/:id` entrega `initialDetail` via `withComponentInputBinding()` | atendido | `apps/web/src/app/app.routes.ts:27-32`, `apps/web/src/app/app.config.ts:13`, `apps/web/src/app/core/resolvers/ride-detail-resolver.ts:5-6`, `apps/web/src/app/features/rides/ride-detail/ride-detail.ts:20` |
| CA4 — Pré-carregamento da oferta e do resumo do motorista via `RideData` antes da ativação de `RideDetail`, sem repetir a leitura HTTP inicial | atendido | `apps/web/src/app/core/services/ride-data.ts:411-517`, `apps/web/src/app/core/resolvers/ride-detail-resolver.spec.ts:254-282`, `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:1254-1273` |
| CA4 — Retorna `not-found` (inclusive para UUID inválido `22P02`) e exibe "Oferta de carona não encontrada" com retorno a `/rides` | atendido | `apps/web/src/app/core/services/ride-data.ts:411-441,519-533`, `apps/web/src/app/features/rides/ride-detail/ride-detail.html:39-49`, `apps/web/src/app/core/resolvers/ride-detail-resolver.spec.ts:239-252,284-306` |
| CA4 — Retorna `error` em falha de conexão/HTTP mantendo o alerta e botão "Tentar novamente" no `RideDetail` | atendido | `apps/web/src/app/core/services/ride-data.ts:103-107,438`, `apps/web/src/app/features/rides/ride-detail/ride-detail.html:22-38`, `apps/web/src/app/core/resolvers/ride-detail-resolver.spec.ts:308-340` |
| CA4 — Respostas `401` encerram a sessão via `errorInterceptor` sem ativar a tela nem emitir resultado falso | atendido | `apps/web/src/app/core/interceptors/error-interceptor.ts:21-41`, `apps/web/src/app/core/services/ride-data.ts:421,439,523,580`, `apps/web/src/app/core/resolvers/ride-detail-resolver.spec.ts:342-357` |
| CA6 — Isolamento de trocas de rota e trocas de sessão durante `rideDetailResolver` e em `RideDetail` com `initialDetail` | atendido | `apps/web/src/app/core/services/ride-data.ts:416-489`, `apps/web/src/app/features/rides/ride-detail/ride-detail.ts:25-42`, `apps/web/src/app/core/resolvers/ride-detail-resolver.spec.ts:359-420`, `apps/web/src/app/core/services/ride-data.spec.ts:516-605`, `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:309-350` |
| CA6 — Cobertura em testes automatizados Vitest sem chamadas de rede reais | atendido | `npm test` (2/2 `layout.spec.mjs` + 23 arquivos / 299 testes Vitest passando) |
| CA1, CA2, CA3 — Exclusão definitiva em `RideData.deleteRide` e `MyRides` | fora desta tarefa | — |
| CA5 — Página `NotFound` (`404`) e rota curinga `**` | fora desta tarefa | — |

## Apontamentos

</Parecer de Conformidade — Tarefa 3>