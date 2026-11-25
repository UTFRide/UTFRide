# Parecer de Conformidade — Tarefa 4

**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA3 — Autenticação via `signInWithPassword`, armazenamento de `accessToken` e `currentUser`, sincronização/busca do perfil no `json-server` (`// TODO` Atividade 15), bloqueio `isBlocked: true` (RN07 com `signOut`) e redirecionamento para `/rides` | atendido | `apps/web/src/app/core/services/auth-data.ts:147-232`, `apps/web/src/app/features/auth/login/login.ts:29-43`, `apps/web/src/app/core/services/auth-data.spec.ts:194-420`, `apps/web/src/app/features/auth/login/login.spec.ts:126-227` |
| CA4 — Credenciais inválidas e erro/indisponibilidade do Supabase Auth ou `json-server` encerram `loading`, exibem mensagem amigável em português sem vazar detalhes em inglês nem manter sessão parcial | atendido | `apps/web/src/app/core/services/auth-data.ts:32-55,112-203,295-314`, `apps/web/src/app/features/auth/login/login.ts:29-43`, `apps/web/src/app/features/auth/login/login.html:25-34`, `apps/web/src/app/core/services/auth-data.spec.ts:438-603`, `apps/web/src/app/features/auth/login/login.spec.ts:90-161,236-365` |
| CA9 (parte de login/abandono e queda de rede) — Sair e voltar de `/login` descarta estado anterior; falha de rede durante login/sincronização/rollback não trava `loading`, limpa sessão parcial e permite nova tentativa | atendido | `apps/web/src/app/core/services/auth-data.ts:112-169,192,295-314`, `apps/web/src/app/features/auth/login/login.ts:24-43`, `apps/web/src/app/features/auth/login/login.spec.ts:163-187,236-365`, `apps/web/src/app/core/interceptors/error-interceptor.spec.ts:53-120` |
| Tarefa 4 (adaptação de testes e protótipo) — Suítes `.spec.ts` adaptadas com dublê de `SupabaseClientService` (`SUPABASE_AUTH_CLIENT`) sem chamadas reais ao Supabase; `npm test` (20 arquivos, 237 testes + 2 testes de layout) passando; layout de `/login` preservado conforme `spec.md` | atendido | `apps/web/src/app/core/interceptors/error-interceptor.spec.ts`, `apps/web/src/app/core/services/notification-data.spec.ts`, `apps/web/src/app/core/services/ride-data.spec.ts`, `apps/web/src/app/core/services/ride-request-data.spec.ts`, `apps/web/src/app/features/driver/my-rides/my-rides.spec.ts`, `apps/web/src/app/features/driver/offer-ride/offer-ride.spec.ts`, `apps/web/src/app/features/rides/my-trips/my-trips.spec.ts`, `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts` |
| CA5, CA6, CA8, CA9 (`logout()` com `signOut` e restauração de sessão no `F5`) | fora desta tarefa | Previstos nas Tarefas 5 e 6 |

## Apontamentos
