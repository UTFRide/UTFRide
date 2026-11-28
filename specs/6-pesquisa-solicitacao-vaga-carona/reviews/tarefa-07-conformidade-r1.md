# Parecer de Conformidade — Tarefa 7

**Veredito:** APONTAMENTOS

## Critérios verificados

| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA9 — Abrir Minhas Viagens como rota filha de `/rides` e apresentar somente as solicitações do passageiro da sessão | atendido | `apps/web/src/app/app.routes.ts:22`, `apps/web/src/app/core/services/ride-request-data.ts:269`, `apps/api/server.test.mjs:107` |
| CA9 — Agrupar solicitações em Pendentes, Confirmadas e Histórico, com badges via `@switch` e Histórico sem ações de avaliação ou denúncia | atendido | `apps/web/src/app/features/rides/my-trips/my-trips.ts:122`, `apps/web/src/app/features/rides/my-trips/my-trips.html:67`, `apps/web/src/app/features/rides/my-trips/my-trips.spec.ts:131` |
| CA9 — Exibir WhatsApp somente nas Confirmadas e omitir o contato no Histórico | atendido | `apps/api/server.mjs:29`, `apps/api/server.test.mjs:113`, `apps/web/src/app/features/rides/my-trips/my-trips.spec.ts:124` |
| CA9 — Persistir o cancelamento voluntário via `PATCH` enquanto a solicitação ainda estiver pendente, preservando os pedidos de outros passageiros | não atendido | `apps/web/src/app/features/rides/my-trips/my-trips.ts:70`, `apps/web/src/app/core/services/ride-request-data.ts:408`, `apps/api/server.test.mjs:133` |
| CA8 — Bloquear a ação de cancelamento na interface para conta bloqueada ou perfil de suporte, com aviso de restrição | atendido | `apps/web/src/app/features/rides/my-trips/my-trips.html:40`, `apps/web/src/app/features/rides/my-trips/my-trips.spec.ts:226` |
| CA10 — Oferecer nova tentativa ou retorno à busca em caso de falha | fora desta tarefa | `specs/6-pesquisa-solicitacao-vaga-carona/plan.md:49` |

Os 82 testes web e os 3 testes da API passaram.

## Apontamentos

1. **O cancelamento pode sobrescrever uma confirmação do motorista** — `apps/web/src/app/features/rides/my-trips/my-trips.ts:70`  
   Critério violado: CA9 em `specs/6-pesquisa-solicitacao-vaga-carona/spec.md:26`. O cancelamento voluntário se aplica a solicitações pendentes.  
   Evidência: A nova tela chama o serviço que lê `pending` em um `GET` e envia o `PATCH` em outra requisição. Se o motorista confirmar entre essas operações, o `PATCH` genérico ainda grava `cancelled`. A vaga pode permanecer ocupada enquanto a solicitação aparece cancelada. O teste em `apps/api/server.test.mjs:133` cobre a solicitação que permanece pendente até a gravação.
