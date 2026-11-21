# Parecer de Conformidade — Tarefa 8

**Veredito:** APONTAMENTOS

## Critérios verificados

| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA10 — A busca informa falhas de conexão e HTTP e permite repetir a consulta com os mesmos filtros | atendido | `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:813` |
| CA10 — O detalhe permite repetir leituras que falharam e oferece retorno à busca quando a oferta não existe. Um 404 de leitura auxiliar é tratado separadamente | atendido | `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:673`, `:701`, `:720` |
| CA10 — A leitura do detalhe e o tratamento de falhas permanecem vinculados à sessão que iniciou a operação | não atendido | `apps/web/src/app/core/services/ride-data.ts:330` |
| CA10 — A confirmação informa falhas e recupera a solicitação quando a resposta do envio se perde, inclusive quando a primeira gravação ainda está na fila | atendido | `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:741`, `:759`, `:798`, `apps/api/server.test.mjs:354`, `:410` |
| CA10 — Minhas Viagens informa falhas de leitura e permite tentar novamente ou voltar à busca | atendido | `apps/web/src/app/features/rides/my-trips/my-trips.spec.ts:353` |
| CA10 — Após falha no cancelamento, o passageiro pode consultar o estado atualizado e tentar cancelar novamente se o pedido continuar pendente | atendido | `apps/web/src/app/features/rides/my-trips/my-trips.spec.ts:378` |

Passaram os 196 testes do frontend, incluindo os 118 testes selecionados para a tarefa, e os 15 testes da API.

## Apontamentos

1. **Uma leitura do detalhe iniciada na sessão anterior pode encerrar a sessão atual** — `apps/web/src/app/core/services/ride-data.ts:330`  
   Critério violado: CA10, `specs/6-pesquisa-solicitacao-vaga-carona/spec.md:27` e `:51`, em conjunto com o acesso autenticado do CA4, `:21`.  
   Evidência: a seleção do detalhe acompanha apenas o ID e a tentativa. Se o passageiro mudar enquanto `GET /rides/:id` está pendente e a instância da tela permanecer montada, a resposta anterior ainda pode iniciar `GET /driver-summaries`. O interceptor associa essa chamada auxiliar à sessão corrente no momento do envio. Se ela responder `401`, o interceptor encerra a nova sessão, embora a operação tenha começado na anterior. A busca já compara a sessão de origem antes de iniciar a mesma leitura auxiliar em `apps/web/src/app/core/services/ride-data.ts:399`.
