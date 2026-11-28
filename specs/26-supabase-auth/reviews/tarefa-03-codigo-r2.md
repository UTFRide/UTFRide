# Parecer de Código — Tarefa 3

**Veredito:** APROVADO

## Apontamentos (bloqueiam)
Nenhum apontamento bloqueante. O ajuste da rodada 2 (`clearAutoSession` em `apps/web/src/app/core/services/auth-data.ts:215-222` e o encadeamento após `POST /users` em `apps/web/src/app/core/services/auth-data.ts:198-209`) passou a propagar falhas e erros retornados pelo `signOut()`, evitando concluir o cadastro com sucesso caso a sessão automática não seja encerrada.

## Sugestões (não bloqueiam)
- **Tipagem de `RegisterResult` e payload de `/users` sem `password`** — `apps/web/src/app/core/services/auth-data.ts:15` e `apps/web/src/app/core/services/auth-data.ts:180-192`: `profile` omite propositalmente `password`, mas é enviado em `this.http.post<User>(...)` e tipado em `RegisterResult` como `user: User` (que exige `password: string` em `apps/web/src/app/core/models/user.model.ts:9`). Alinhar para `AuthenticatedUser` (`Omit<User, 'password'>`) torna o contrato de tipos fiel ao objeto real.
- **Reuso de dublê Supabase nos testes** — `apps/web/src/app/core/services/auth-data.spec.ts:9-53` e `apps/web/src/app/features/auth/register/register.spec.ts:11-57`: `fakeSupabaseUser`, `fakeSession`, `createFakeAuthClient` e `flushMicrotasks` replicam a estrutura de `apps/web/src/app/core/services/supabase-client.spec.ts:11-41`. Vale considerar um helper compartilhado de dublê em memória nas próximas tarefas para evitar triplicação.
- **Acoplamento do teste de componente aos detalhes internos de `AuthData`** — `apps/web/src/app/features/auth/register/register.spec.ts:183-218`: o teste de `Register` verifica os argumentos exatos enviados por `AuthData` ao `signUp` e ao `POST /users`, comportamento já coberto em `apps/web/src/app/core/services/auth-data.spec.ts:77-106`.

## Observações fora do escopo deste diff
- `AuthData.loginResult` e `AuthData.logout()` (`apps/web/src/app/core/services/auth-data.ts:100-128` e `224-226`) ainda autenticam contra `GET /users` no `json-server` e não limpam `sessionAccessToken` nem chamam `supabase.signOut()` (o que também impacta `errorInterceptor` em `apps/web/src/app/core/interceptors/error-interceptor.ts:27` ao tratar 401); aguardando as tarefas seguintes da spec.
- Risco transitório de inconsistência entre Supabase Auth e `json-server`: se `signUp` concluir no Supabase e `POST /users` falhar (ex.: 500 ou indisponibilidade do `json-server`), o usuário permanece no Supabase Auth sem existir em `db.json`, fazendo novas tentativas caírem em `duplicate: true` no `signUp` até a migração da coleção `users` na Atividade 15.

---
Validações executadas: `npm test` (2/2 em `layout.spec.mjs` e 20 arquivos / 229 testes Vitest aprovados) e `npm run lint` (sem erros).
