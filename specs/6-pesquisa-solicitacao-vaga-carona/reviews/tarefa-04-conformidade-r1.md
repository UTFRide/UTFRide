# Parecer de Conformidade — Tarefa 4

**Veredito:** APROVADO

## Critérios verificados

| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA4 — Seleção da oferta na listagem abre o componente real em `/rides/:id`, com o parâmetro vinculado automaticamente a `input.required<string>()`. | atendido | `apps/web/src/app/features/rides/ride-list/ride-list.html:97`, `apps/web/src/app/app.routes.ts:29`, `apps/web/src/app/app.config.ts:12`, `apps/web/src/app/features/rides/ride-detail/ride-detail.ts:15` |
| CA4 — O detalhe carrega a oferta real e mostra trajeto, data e horário, ponto de referência quando informado, vagas disponíveis e totais e valor por vaga formatado. | atendido | `apps/web/src/app/core/services/ride-data.ts:305`, `apps/web/src/app/features/rides/ride-detail/ride-detail.html:29` |
| CA4 — O detalhe apresenta nome, iniciais e avaliação média do motorista a partir da projeção pública do servidor. | atendido | `apps/api/server.mjs:8`, `apps/web/src/app/core/services/ride-data.ts:358`, `apps/web/src/app/features/rides/ride-detail/ride-detail.html:114`. A projeção passou na verificação em memória. A conexão local do teste HTTP adicional foi bloqueada pelo ambiente. |
| CA4 — Os estados da oferta e da solicitação do aluno autenticado são exibidos com `@switch`, `@case` e `@default`. A consulta é somente leitura e filtra pela oferta e pelo aluno da sessão. | atendido | `apps/web/src/app/features/rides/ride-detail/ride-detail.html:55`, `apps/web/src/app/features/rides/ride-detail/ride-detail.html:159`, `apps/web/src/app/core/services/ride-request-data.ts:259`, `apps/web/src/app/core/services/ride-request-data.ts:314` |
| CA4 — O fluxo do cartão ao detalhe segue as telas 4 e 5 do protótipo. O teste exercita a rota real, os dados renderizados e a mudança de estados. | atendido | `docs/prototipo/models/4._buscar_caronas_home.html:439`, `docs/prototipo/models/5._detalhe_da_oferta_e_solicitar_vaga.html:9`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:680`. Os 41 testes das três suítes indicadas passaram. |

## Apontamentos
