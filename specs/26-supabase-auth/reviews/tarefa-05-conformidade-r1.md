# Parecer de Conformidade — Tarefa 5

**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA5 — Restauração de sessão persistida (`getSession`) e JWT (`accessToken`) antes do `authGuard` liberar rotas protegidas no `F5`, incluindo chamadas simultâneas ao guard | atendido | `apps/web/src/app/core/services/auth-data.ts:320-349`, `apps/web/src/app/core/guards/auth-guard.ts:5-13`, `apps/web/src/app/core/services/auth-data.spec.ts:271-426`, `apps/web/src/app/core/guards/auth-guard.spec.ts:135-195` |
| CA6 — Rotas públicas (`/`, `/login`, `/register`) acessíveis sem sessão; rotas protegidas (`/rides`, `/rides/my-trips`, `/rides/:id`, `/driver/offer`, `/driver/my-rides`) redirecionam para `/login` sem sessão válida | atendido | `apps/web/src/app/core/guards/auth-guard.ts:5-13`, `apps/web/src/app/core/guards/auth-guard.spec.ts:125-133,163-210`, `apps/web/src/app/core/services/auth-data.spec.ts:428-447` |
| CA9 e Abandono no meio — Falha/erro de rede em `getSession()` ou no `json-server` e conta bloqueada durante restauração limpam estado local sem rejeitar/travar e redirecionam para `/login` | atendido | `apps/web/src/app/core/services/auth-data.ts:172-208,328-349`, `apps/web/src/app/core/services/auth-data.spec.ts:449-526`, `apps/web/src/app/core/guards/auth-guard.spec.ts:212-240` |
| CA1, CA2, CA3, CA4, CA7, CA8 — Demais critérios da história | fora desta tarefa | — |

## Apontamentos
