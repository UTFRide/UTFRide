# Parecer de Conformidade — Tarefa 2

**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA2 — Botão de envio desabilitado em `/login` quando offline, com explicação acessível (`OFFLINE_ACTION_MESSAGE`) e bloqueio de submissão/Enter sem chamadas de rede | atendido | `apps/web/src/app/features/auth/login/login.html:22-36`, `apps/web/src/app/features/auth/login/login.ts:48-49`, `apps/web/src/app/core/services/auth-data.ts:157-159`, `apps/web/src/app/features/auth/login/login.spec.ts:411-436` |
| CA2 — Botão de envio desabilitado em `/register` quando offline, com explicação acessível (`OFFLINE_ACTION_MESSAGE`) e bloqueio de submissão/Enter sem RPC ou Supabase Auth | atendido | `apps/web/src/app/features/auth/register/register.html:69-83`, `apps/web/src/app/features/auth/register/register.ts:62-63`, `apps/web/src/app/core/services/auth-data.ts:124-126`, `apps/web/src/app/features/auth/register/register.spec.ts:497-523` |
| CA3 — `AuthData` persiste perfil sem senha em cache local e restaura acesso somente-leitura via `restoreSession()` quando offline com sessão local válida do Supabase, liberando `/rides`, `/rides/my-trips` e `/driver/my-rides` sem HTTP; sem sessão/cache redireciona para `/login` | atendido | `apps/web/src/app/core/services/auth-data.ts:333-359`, `apps/web/src/app/core/services/auth-data.ts:389-427`, `apps/web/src/app/core/services/auth-data.spec.ts:1187-1259`, `apps/web/src/app/core/services/auth-data.spec.ts:1394-1425`, `apps/web/src/app/core/guards/auth-guard.spec.ts:270-309` |
| CA7 — Isolamento de cache entre contas (sem vazamento em logout ou troca de sessão), reabilitação reativa em `Login`/`Register` ao voltar `online`, bloqueio na queda de rede e testes Vitest sem chamadas reais de rede (executados e aprovados: `npm test` — `layout.spec.mjs` 2/2 e Vitest 26 arquivos / 334 testes) | atendido | `apps/web/src/app/core/services/auth-data.ts:348-371`, `apps/web/src/app/core/services/auth-data.ts:429-437`, `apps/web/src/app/core/services/auth-data.spec.ts:1261-1457`, `apps/web/src/app/features/auth/login/login.spec.ts:438-485`, `apps/web/src/app/features/auth/register/register.spec.ts:525-562` |
| CA1, CA4, CA5, CA6 | fora desta tarefa | — |

## Apontamentos
