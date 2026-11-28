# Parecer de Conformidade — Tarefa 1

**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA1 — Fluxo completo de cadastro (`/register`) com `AuthData` e `signUp` | fora desta tarefa | — |
| CA2 — Validações e bloqueio de duplicidade no cadastro (`/register`) | fora desta tarefa | — |
| CA3 — Fluxo de login (`/login`) com `signInWithPassword` e JWT | fora desta tarefa | — |
| CA4 — Tratamento de erro e estado de carregamento no login (`/login`) | fora desta tarefa | — |
| CA5 — Restauração de sessão (`getSession`) no recarregamento (`F5`) | fora desta tarefa | — |
| CA6 — `authGuard` funcional permitindo rotas públicas e bloqueando protegidas | fora desta tarefa | — |
| CA7 — `authInterceptor` anexando `Authorization: Bearer <access_token>` apenas para `environment.apiUrl` | fora desta tarefa | — |
| CA8 — Ação **Sair** nos cabeçalhos autenticados executando `signOut` | fora desta tarefa | — |
| CA9 — Tratamento de abandono, queda de rede e HTTP `401` | fora desta tarefa | — |
| CA10 — Ambientes (`environment.ts` e `environment.development.ts`) contêm apenas `apiUrl`, `supabaseUrl` e `supabasePublishableKey` (`sb_publishable_...`), sem `sb_secret_...` | atendido | `apps/web/src/environments/environment.ts:1-5`, `apps/web/src/environments/environment.development.ts:1-5`, `apps/web/angular.json:55-60` |
| CA10 — Cliente `@supabase/supabase-js` encapsulado em `core/services/` com suporte a dublês/mocks via DI | atendido | `apps/web/package.json:22`, `apps/web/src/app/core/services/supabase-client.ts:1-57` |
| CA10 — Testes unitários executam integralmente com dublês/mocks sem chamadas reais ao Supabase (`npm test -- --include src/app/core/services/supabase-client.spec.ts`: 3/3; `npm test`: 19 arquivos, 209/209) | atendido | `apps/web/src/app/core/services/supabase-client.spec.ts:1-98` |

## Apontamentos
