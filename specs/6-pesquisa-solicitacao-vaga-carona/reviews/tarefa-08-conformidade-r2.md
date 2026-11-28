# Parecer de Conformidade — Tarefa 8

**Veredito:** APONTAMENTOS

## Critérios verificados

| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA10 — A busca informa falhas e permite repetir a consulta com os mesmos filtros | atendido | `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:813` |
| CA10 — O detalhe permite repetir leituras que falharam e voltar à busca quando a oferta não existe | atendido | `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:721`, `:752`, `:771`, `:792` |
| CA4 e CA10 — As consultas do detalhe e o tratamento de 401 respeitam a sessão que iniciou a operação, inclusive após novo login com o mesmo ID | atendido | `apps/web/src/app/core/services/ride-data.ts:330`, `apps/web/src/app/core/services/ride-request-data.ts:357`, `apps/web/src/app/core/interceptors/error-interceptor.ts:19`, `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:214`, `:241`, `:648` |
| CA4, CA6, CA7 e CA10 — A confirmação recupera o pedido por releitura ou após 409, atualiza a oferta e impede duplicidade | atendido | `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:809`, `:849`, `:917`, `apps/api/server.test.mjs:354`, `:386`, `:410` |
| CA4 e CA6 — A nova tentativa após retornar ao detalhe atualiza a disponibilidade junto com o pedido recuperado | não atendido | `apps/web/src/app/features/rides/ride-detail/ride-detail.ts:131` |
| CA10 — Minhas Viagens informa falhas de leitura e permite tentar novamente ou voltar à busca | atendido | `apps/web/src/app/features/rides/my-trips/my-trips.spec.ts:353` |
| CA10 — Após falha no cancelamento, o passageiro pode verificar o estado e tentar novamente se o pedido continuar pendente | atendido | `apps/web/src/app/features/rides/my-trips/my-trips.spec.ts:378` |

## Apontamentos

1. **A nova tentativa após voltar ao detalhe pode recuperar a confirmação e exibir a disponibilidade anterior** — `apps/web/src/app/features/rides/ride-detail/ride-detail.ts:131`  
   Critério violado: CA4 e CA6, `specs/6-pesquisa-solicitacao-vaga-carona/spec.md:21` e `:23`, e a decisão de atualizar a oferta junto com o pedido recuperado, `specs/6-pesquisa-solicitacao-vaga-carona/reviews/tarefa-08-decisoes-r1.md:6`.  
   Evidência: se o passageiro voltar ao detalhe durante uma recuperação e a atualização da oferta falhar, o botão “Tentar novamente” dispara leituras independentes da oferta e do pedido. A API pode ler a oferta ainda com uma vaga, depois o motorista confirmar o pedido e ocupar a última vaga, e só então a leitura do pedido retornar `accepted`. A tela combina essas respostas e exibe “Solicitação confirmada” com “Carona ativa” e a contagem anterior. O teste em `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:881` já fornece uma oferta lotada na nova tentativa, deixando essa ordem de eventos sem cobertura.
