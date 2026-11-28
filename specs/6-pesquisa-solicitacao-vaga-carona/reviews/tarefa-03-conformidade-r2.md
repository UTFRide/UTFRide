# Parecer de Conformidade — Tarefa 3

**Veredito:** APROVADO

## Critérios verificados

| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA1 — O botão Filtros revela origem, destino e data acima da lista. Os três campos usam binding bidirecional por `model()`, e os campos de texto oferecem sugestões de localidades. A visibilidade do painel é controlada separadamente da injeção de `LocationData`. | atendido | `apps/web/src/app/features/rides/ride-list/ride-list.html:14`, `apps/web/src/app/features/rides/ride-list/ride-list.ts:18`, `apps/web/src/app/features/rides/ride-filters/ride-filters.ts:12`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:550` |
| CA1 — A consulta reativa agrupa mudanças rápidas, ignora filtros equivalentes e cancela consultas anteriores. Os resultados incluem apenas ofertas ativas, futuras, com vagas e de outros motoristas. | atendido | `apps/web/src/app/core/services/ride-data.ts:259`, `apps/web/src/app/core/services/ride-data.ts:299`, `apps/web/src/app/core/services/ride-data.spec.ts:839`, `apps/web/src/app/core/services/ride-data.spec.ts:904` |
| CA1 — Conforme o plano e a triagem, o corpo HTTP da busca contém somente o identificador usado para associar a oferta ao motorista, o nome e a avaliação média. O teste HTTP confirma a projeção com registros que contêm também dados privados. | atendido | `apps/web/src/app/core/services/ride-data.ts:329`, `apps/web/src/app/core/services/ride-data.spec.ts:877`, `apps/api/server.mjs:8`, `apps/api/server.test.mjs:22` |
| CA3 — Uma consulta concluída sem ofertas elegíveis exibe mensagem clara e permite limpar os três filtros. | atendido | `apps/web/src/app/features/rides/ride-list/ride-list.html:99`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:585` |
| CA11 — Sair da busca cancela a consulta em andamento. Ao retornar, os três filtros começam vazios e nenhuma solicitação é criada. | atendido | `apps/web/src/app/features/rides/ride-list/ride-list.ts:15`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:649` |

Os 30 testes direcionados do front-end e os 2 testes da API passaram.

## Apontamentos
