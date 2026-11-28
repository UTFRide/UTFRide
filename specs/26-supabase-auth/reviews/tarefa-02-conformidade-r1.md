# Parecer de Conformidade — Tarefa 2

**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA7 — `AuthData` expõe token JWT (`accessToken`) para o interceptor | atendido | `apps/web/src/app/core/services/auth-data.ts:21-22` |
| CA7 — `authInterceptor` funcional acrescenta `Authorization: Bearer <access_token>` para requisições à API em `environment.apiUrl` quando há sessão ativa | atendido | `apps/web/src/app/core/interceptors/auth-interceptor.ts:6-27`, `apps/web/src/app/core/interceptors/auth-interceptor.spec.ts:11-35` |
| CA7 — `authInterceptor` não envia `Authorization` quando não há sessão ativa | atendido | `apps/web/src/app/core/interceptors/auth-interceptor.ts:7-10`, `apps/web/src/app/core/interceptors/auth-interceptor.spec.ts:37-57` |
| CA7 — `authInterceptor` não envia `Authorization` para APIs externas públicas (ex.: `servicodados.ibge.gov.br`) ou URLs fora de `environment.apiUrl` | atendido | `apps/web/src/app/core/interceptors/auth-interceptor.ts:8,21-27`, `apps/web/src/app/core/interceptors/auth-interceptor.spec.ts:59-92` |
| CA7 — `authInterceptor` funcional registrado em `app.config.ts` | atendido | `apps/web/src/app/app.config.ts:12`, `apps/web/src/app/core/interceptors/auth-interceptor.spec.ts:94-120` |

## Apontamentos
