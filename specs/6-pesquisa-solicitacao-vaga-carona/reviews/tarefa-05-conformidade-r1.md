# Parecer de Conformidade — Tarefa 5

**Veredito:** APONTAMENTOS

## Critérios verificados

| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA5 — Revalidar a oferta ao confirmar, criar a solicitação `pending` para o passageiro autenticado e exibir o estado de espera | atendido | `apps/web/src/app/core/services/ride-request-data.ts:328`, `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:158` |
| CA5 — Carregar o painel sob demanda com `@defer (on interaction)` e `@placeholder`, com teste que comprove esse carregamento | não atendido | `apps/web/src/app/features/rides/ride-detail/ride-detail.html:219`, `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:120` |
| CA5 — Seguir o comportamento do painel móvel da tela 5 do protótipo | não atendido | `docs/prototipo/models/5._detalhe_da_oferta_e_solicitar_vaga.html:275`, `apps/web/src/app/features/rides/ride-detail/ride-request-confirm-panel/ride-request-confirm-panel.html:6` |
| CA6 — Bloquear e informar oferta lotada, cancelada, concluída ou passada, inclusive quando seu estado muda antes da confirmação | atendido | `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:209`, `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:229` |
| CA7 — Bloquear duplicidade e auto-solicitação, exibir o estado via `@switch` e permitir novo pedido após cancelamento ou rejeição | atendido | `apps/web/src/app/features/rides/ride-detail/ride-detail.html:161`, `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:158`, `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:250` |
| CA11 — Desistir ou sair com o painel aberto sem registrar solicitação | atendido | `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:120`. Os 45 testes das três suítes indicadas passaram. |

## Apontamentos

1. **O teste de CA5 não verifica o carregamento sob demanda nem o `@placeholder`** — `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:120`  
   Critério violado: `specs/6-pesquisa-solicitacao-vaga-carona/spec.md:22` exige o carregamento sob demanda por `@defer (on interaction)` com `@placeholder`. A Tarefa 5, em `specs/6-pesquisa-solicitacao-vaga-carona/plan.md:36`, requer que o teste o verifique.  
   Evidência: o teste consulta a presença do painel antes da interação e após o clique. A condição `@if (confirmationOpen())` por si só produz esses mesmos resultados. O teste passaria com o bloco `@defer` e o `@placeholder` removidos, mantendo apenas o `@if`.

2. **O puxador do painel móvel é decorativo e não permite recolher ou expandir o painel** — `apps/web/src/app/features/rides/ride-detail/ride-request-confirm-panel/ride-request-confirm-panel.html:6`  
   Critério violado: `specs/6-pesquisa-solicitacao-vaga-carona/spec.md:35` identifica a tela 5 como referência do painel de solicitação.  
   Evidência: o protótipo inclui um puxador acionável por clique ou arraste para recolher e expandir o painel em `docs/prototipo/models/5._detalhe_da_oferta_e_solicitar_vaga.html:374` e `docs/prototipo/models/5._detalhe_da_oferta_e_solicitar_vaga.html:387`. A implementação exibe o puxador como um `div` com `aria-hidden="true"` e sem interação. O botão «Desistir» fecha o painel, mas o puxador visível não responde ao toque nem ao arraste.
