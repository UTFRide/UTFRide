# Parecer de Conformidade — Tarefa 5

**Veredito:** APROVADO

## Critérios verificados

| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA5 — Carregar o painel sob demanda na interação e exibir o `@placeholder` enquanto aguarda | atendido | `apps/web/src/app/features/rides/ride-detail/ride-detail.html:219`, `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:122`, `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:152` |
| CA5 — Recolher e expandir o painel móvel pelo puxador, por clique, teclado ou arraste, acima da barra de navegação | atendido | `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:189`, `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:217`, `apps/web/src/app/features/rides/rides-layout/rides-layout.html:36` |
| CA5 — Revalidar a oferta ao confirmar, criar a solicitação `pending` para o passageiro autenticado e exibir o estado de espera | atendido | `apps/web/src/app/core/services/ride-request-data.ts:347`, `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:257` |
| CA5 — Encerrar a sessão vigente e voltar ao login quando uma etapa da confirmação recebe HTTP 401 | atendido | `apps/web/src/app/core/interceptors/error-interceptor.ts:19`, `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:483`, `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:511` |
| CA6 — Bloquear e informar oferta lotada, cancelada, concluída ou passada na abertura e na confirmação, inclusive quando o passageiro retorna durante a revalidação | atendido | `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:308`, `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:328`, `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:450` |
| CA7 — Bloquear duplicidade e auto-solicitação, exibir o status via `@switch` e permitir novo pedido após cancelamento ou rejeição | atendido | `apps/web/src/app/features/rides/ride-detail/ride-detail.html:161`, `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:257`, `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:368`. O teste na linha 423 verifica o reaproveitamento do envio na mesma sessão, dentro do limite de atomicidade aprovado para o MVP. |
| CA11 — Descartar o painel ao desistir ou sair antes da confirmação sem criar solicitação | atendido | `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:152`. Passaram os 48 testes das três suítes solicitadas e os 10 testes de Minhas Ofertas. |

## Apontamentos
