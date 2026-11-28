# Parecer de Conformidade — Tarefa 3

**Veredito:** APONTAMENTOS

## Critérios verificados

| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA1 — Origem, destino e data usam binding bidirecional por `model()` e os campos de texto recebem sugestões de localidades. | atendido | `apps/web/src/app/features/rides/ride-filters/ride-filters.ts:11`, `apps/web/src/app/features/rides/ride-list/ride-list.html:26`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:550` |
| CA1 — A consulta reativa aplica debounce, ignora filtros equivalentes, cancela consultas anteriores e exibe apenas ofertas ativas, futuras, com vagas e de outros motoristas. | atendido | `apps/web/src/app/core/services/ride-data.ts:259`, `apps/web/src/app/core/services/ride-data.ts:299`, `apps/web/src/app/core/services/ride-data.spec.ts:835`, `apps/web/src/app/core/services/ride-data.spec.ts:902` |
| CA1 — O enriquecimento da listagem usa somente dados públicos do motorista, conforme a decisão técnica do plano. | não atendido | `specs/6-pesquisa-solicitacao-vaga-carona/plan.md:7`, `apps/web/src/app/core/services/ride-data.ts:335` |
| CA3 — Uma busca concluída sem ofertas elegíveis mostra uma mensagem e permite limpar os três filtros. | atendido | `apps/web/src/app/features/rides/ride-list/ride-list.html:100`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:550` |
| CA11 — Ao sair da busca e voltar, os filtros começam vazios sem registrar uma solicitação. | atendido | `apps/web/src/app/features/rides/ride-list/ride-list.ts:17`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:614` |

## Apontamentos

1. **A busca envia dados privados dos motoristas ao navegador** — `apps/web/src/app/core/services/ride-data.ts:335`
   Critério violado: `specs/6-pesquisa-solicitacao-vaga-carona/plan.md:7` limita o enriquecimento aos dados públicos `name` e `ratingAverage`. `specs/6-pesquisa-solicitacao-vaga-carona/spec.md:26` prevê revelar o WhatsApp do motorista nas solicitações confirmadas.
   Evidência: O `GET /users` filtra os IDs, mas recebe os registros completos no navegador antes de selecionar nome e nota. Uma verificação com dados sintéticos confirmou que a consulta também retorna `email`, `whatsapp` e `password`. Os 29 testes direcionados passaram. A asserção em `apps/web/src/app/core/services/ride-data.spec.ts:879` cobre os campos do resultado já transformado, depois que a resposta HTTP chegou ao navegador.
