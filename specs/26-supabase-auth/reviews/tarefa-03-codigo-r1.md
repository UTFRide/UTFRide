# Parecer de Código — Tarefa 3

**Veredito:** APONTAMENTOS

## Apontamentos (bloqueiam)
1. **Encerramento de sessão automática após `signUp` engole falhas silenciosamente** — `apps/web/src/app/core/services/auth-data.ts:202-206`
   Regra violada: `docs/architecture.md`, seção 2.1 (*Autenticação e sessão (Supabase Auth na fase transitória)*), que exige gerenciamento consistente da sessão via `@supabase/supabase-js` (`signUp`, `signOut` e restauração de sessão persistida em navegador), combinada ao critério de revisão de não engolir falhas silenciosamente.
   Prejuízo concreto: `clearAutoSession()` executa `await this.supabase.signOut().catch(() => undefined)` sem verificar o campo `error` retornado pelo SDK (`Promise<{ error: AuthError | null }>`) e descartando qualquer exceção lançada. Como `signUp` cria sessão persistida no navegador quando a confirmação de e-mail está desabilitada (seção 2.5), uma falha no `signOut()` (por rede no logout global ou erro de storage) faz com que `AuthData` zere apenas os signals em memória (`authenticatedUser` e `sessionAccessToken`), retorne sucesso e navegue para `/login` enquanto a sessão do Supabase Auth pode permanecer ativa/persistida no navegador — dessincronizando o estado de autenticação assim que a sessão persistida for restaurada. (Mesmo que o rollback no `catchError` de `POST /users` precise preservar o `httpError` original, o caminho de sucesso após criar a conta não deve ignorar falha de `signOut()`).

## Sugestões (não bloqueiam)
- **Tipagem de `RegisterResult` e payload de `/users` sem `password`** — `apps/web/src/app/core/services/auth-data.ts:15` e `apps/web/src/app/core/services/auth-data.ts:178-190`: `profile` omite propositalmente `password`, mas é enviado em `this.http.post<User>(...)` e exposto em `RegisterResult` como `user: User` (que exige `password: string` em `user.model.ts`). Usar `AuthenticatedUser` (`Omit<User, 'password'>`) alinha o contrato de tipos ao objeto real sem senha.
- **Reuso de dublê Supabase nos testes** — `apps/web/src/app/core/services/auth-data.spec.ts:9-48` e `apps/web/src/app/features/auth/register/register.spec.ts:11-57`: `fakeSupabaseUser`, `fakeSession`, `createFakeAuthClient` e `flushMicrotasks` repetem a estrutura já presente em `supabase-client.spec.ts`. Caso a Tarefa 4 amplie os testes de sessão/login, vale extrair um helper compartilhado de dublê em memória para evitar manutenção triplicada.
- **Acoplamento do teste de componente aos detalhes internos de `AuthData`** — `apps/web/src/app/features/auth/register/register.spec.ts:183-218`: o teste do componente `Register` valida argumentos internos enviados por `AuthData` (`fakeAuth.signUp` e corpo exato de `POST /users`), o que já é coberto por `auth-data.spec.ts`. Em futuras refatorações do payload/metadados do serviço, esse teste de componente pode quebrar sem mudança de comportamento da tela.

## Observações fora do escopo deste diff
- `AuthData.loginResult` e `AuthData.logout()` (`apps/web/src/app/core/services/auth-data.ts:98-126` e `208-210`) ainda autenticam contra `GET /users` no `json-server` e não limpam `sessionAccessToken` nem chamam `supabase.signOut()` (o que também impacta `errorInterceptor` em `apps/web/src/app/core/interceptors/error-interceptor.ts:27` ao tratar 401); aguardando a migração planejada nas tarefas seguintes da spec.
- Risco transitório de inconsistência entre Supabase Auth e `json-server`: se `signUp` concluir no Supabase e `POST /users` falhar (ex.: 500 ou queda do `json-server`), o usuário passa a existir no Supabase Auth mas não em `db.json`, fazendo novas tentativas caírem em `duplicate: true` no `signUp` até a migração completa de `users` na Atividade 15.

---
Validações executadas: `npm test` (2/2 em `layout.spec.mjs` e 20 arquivos / 224 testes Vitest aprovados) e `npm run lint` (sem erros).
