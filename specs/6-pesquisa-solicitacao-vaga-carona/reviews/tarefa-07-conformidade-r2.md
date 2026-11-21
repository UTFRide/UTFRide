# Parecer de Conformidade — Tarefa 7

**Veredito:** APROVADO

## Critérios verificados

| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA9 — Abrir Minhas Viagens como rota filha de `/rides` e exibir somente as solicitações do passageiro da sessão simulada | atendido | `apps/web/src/app/app.routes.ts:22`, `apps/web/src/app/core/services/ride-request-data.ts:299`, `apps/api/server.test.mjs:59` |
| CA9 — Agrupar solicitações em Pendentes, Confirmadas e Histórico, com badges via `@switch` e Histórico sem ações de avaliação ou denúncia | atendido | `apps/web/src/app/features/rides/my-trips/my-trips.ts:82`, `apps/web/src/app/features/rides/my-trips/my-trips.html:67`, `apps/web/src/app/features/rides/my-trips/my-trips.spec.ts:94` |
| CA9 — Exibir o WhatsApp do motorista exclusivamente em Confirmadas | atendido | `apps/api/server.mjs:93`, `apps/api/server.test.mjs:59`, `apps/web/src/app/features/rides/my-trips/my-trips.html:201` |
| CA9 — Persistir o cancelamento voluntário via `PATCH` somente enquanto o pedido estiver pendente na fonte, preservando as solicitações de outros passageiros | atendido | `apps/api/server.mjs:49`, `apps/api/server.test.mjs:173`, `apps/api/server.test.mjs:194` |
| CA9 — Concluir o cancelamento já confirmado ao sair de Minhas Viagens e atualizar a lista ao retornar ou quando o motorista confirmar primeiro | atendido | `apps/web/src/app/core/services/ride-request-data.ts:429`, `apps/web/src/app/features/rides/my-trips/my-trips.spec.ts:212`, `apps/web/src/app/features/rides/my-trips/my-trips.spec.ts:248` |
| CA8 — Impedir cancelamento na interface e no serviço para conta bloqueada ou perfil de suporte, com aviso de restrição | atendido | `apps/web/src/app/features/rides/my-trips/my-trips.html:49`, `apps/web/src/app/features/rides/my-trips/my-trips.spec.ts:305`, `apps/web/src/app/core/services/ride-request-data.spec.ts:60` |
| CA10 — Oferecer nova tentativa ou retorno à busca em caso de falha | fora desta tarefa | `specs/6-pesquisa-solicitacao-vaga-carona/plan.md:49` |

## Apontamentos
