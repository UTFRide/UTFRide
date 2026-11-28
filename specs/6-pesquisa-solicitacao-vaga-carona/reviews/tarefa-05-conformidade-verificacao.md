# Parecer de Conformidade — Tarefa 5

**Veredito:** APROVADO

## Critérios verificados

| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA5 e tela 5 do protótipo — Limitar o painel móvel ao espaço entre o cabeçalho e a navegação inferior, manter o puxador visível e permitir acesso às ações por rolagem interna em janelas baixas ou com zoom. No desktop, o painel continua no fluxo da página. | atendido | `docs/prototipo/models/5._detalhe_da_oferta_e_solicitar_vaga.html:276`, `apps/web/src/app/features/rides/rides-layout/rides-layout.html:2`, `apps/web/src/app/features/rides/ride-detail/ride-request-confirm-panel/ride-request-confirm-panel.html:4`. O teste em `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:256` verifica o limite declarado, o foco inicial e a posição do puxador e das ações em relação à área rolável. Segundo o relato do implementador, a geometria foi verificada no Chrome headless em cinco dimensões móveis e uma desktop. |
| CA5 — Abrir o painel sob demanda, revalidar a oferta ao confirmar, criar a solicitação `pending` e exibir o estado de espera. | atendido | `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:122`, `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:152`, `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:278`. Os 35 testes da suíte passaram na verificação complementar. |
| CA11 — Desistir ou sair antes de confirmar sem registrar solicitação. | atendido | `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:152`. |

## Apontamentos
