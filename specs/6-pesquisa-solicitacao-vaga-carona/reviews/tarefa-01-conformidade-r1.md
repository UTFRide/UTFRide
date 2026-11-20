# Parecer de Conformidade — Tarefa 1

**Veredito:** APROVADO

## Critérios verificados

| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA1 — `/rides` usa `RidesLayout` com `<router-outlet />` e as rotas filhas `''`, `'my-trips'` e `':id'` são resolvidas sem colisão. | atendido | `apps/web/src/app/app.routes.ts:9`, `apps/web/src/app/features/rides/rides-layout/rides-layout.html:28`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:48` |
| CA1 — `authGuard` protege as três rotas e volta a verificar a autenticação ao trocar de rota filha. | atendido | `apps/web/src/app/app.routes.ts:10`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:99` |
| CA1 — O layout apresenta o sino à esquerda do avatar com iniciais e a navegação inferior com Buscar, Oferecer, Ofertas e Viagens. | atendido | `apps/web/src/app/features/rides/rides-layout/rides-layout.html:10`, `apps/web/src/app/features/rides/rides-layout/rides-layout.html:32`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:65`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:140` |
| CA1 — Os testes de avisos internos da US02 continuam passando. A execução de `ride-list.spec.ts` passou nos 10 testes. | atendido | `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:124` |
| CA4 — `appConfig` habilita `withComponentInputBinding()` em `provideRouter`. | atendido | `apps/web/src/app/app.config.ts:12`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:44` |

## Apontamentos
