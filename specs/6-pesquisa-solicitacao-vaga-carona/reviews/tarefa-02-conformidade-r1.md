# Parecer de Conformidade — Tarefa 2

**Veredito:** APROVADO

## Critérios verificados

| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA2 — Consultar via `GET` os municípios do Paraná na API do IBGE e disponibilizar seus nomes como sugestões. | atendido | `apps/web/src/app/core/services/location-data.ts:18`, `apps/web/src/app/core/services/location-data.spec.ts:29` |
| CA2 — Retornar lista vazia sem preencher `ErrorNotice` quando o dispositivo estiver offline ou a API responder com erro HTTP 404 ou 500. | atendido | `apps/web/src/app/core/services/location-data.ts:25`, `apps/web/src/app/core/interceptors/error-interceptor.ts:11`, `apps/web/src/app/core/services/location-data.spec.ts:45`, `apps/web/src/app/core/services/location-data.spec.ts:54` |

## Apontamentos
