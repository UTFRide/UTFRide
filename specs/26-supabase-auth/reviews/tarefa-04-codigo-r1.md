# Parecer de Código — Tarefa 4

**Veredito:** APROVADO

## Resumo da verificação
- Diff inspecionado via `git diff 2073d342eba178e0b01634744ce1f4219a11e10a` (12 arquivos: `auth-data.ts` e 11 arquivos `.spec.ts`).
- `npm test`: passou (20 arquivos de teste, 237 testes no Vitest + 2 testes de layout).
- `npm run lint`: passou (`All files pass linting.`).
- Arquitetura e padrões (`docs/architecture.md`): `AuthData` encapsula `SupabaseClientService` e `HttpClient` em `core/services/`, usa `inject()`, `signal()`, `computed()` e `toSignal()`, não armazena segredos/URLs literais, classifica falhas de credenciais, rede e HTTP sem engolir erros e isola todos os `.spec.ts` com dublê via `SUPABASE_AUTH_CLIENT`.

## Apontamentos (bloqueiam)
Nenhum.

## Sugestões (não bloqueiam)
- **Extração opcional de dublê compartilhado nos testes:** Os 11 arquivos `.spec.ts` alterados no diff (além de `register.spec.ts` já existente) repetem `fakeSupabaseUser`, `fakeSession`, `createFakeAuthClient()` e `flushMicrotasks()`. Como `SupabaseAuthClient` pode ganhar novos métodos nas próximas tarefas (ex.: restauração de sessão/logout), extrair um helper compartilhado de teste evita editar dezenas de arquivos a cada mudança, caso a equipe prefira DRY em testes em vez de specs autocontidos.
- **Padronização do payload espelho de `users` (`apps/web/src/app/core/services/auth-data.ts:206-232`, `:264-275`):** `buildMirrorProfile` e `registerWithSupabase` montam o mesmo formato de objeto espelho para `POST /users` (`role`, `isBlocked`, `isEmailConfirmed`, `ratingAverage`, `createdAt`). Um helper único reduziria chance de divergência de defaults enquanto o `// TODO` da Atividade 15 permanecer ativo.

## Observações fora do escopo deste diff
- `apps/web/src/app/core/services/auth-data.ts:316-318`: `logout()` ainda limpa apenas `authenticatedUser` sem chamar `clearLocalSession()` (`sessionAccessToken`) nem `supabase.signOut()` (não alterado neste diff; previsto para a tarefa específica de logout/sessão).
- `apps/web/src/app/core/models/user.model.ts:9-16`: `User extends Registration` mantém `password: string` obrigatório no tipo de domínio, embora `auth-data.ts` já não envie `password` ao espelhar perfis em `/users`.
- `apps/web/src/app/features/auth/login/login.ts:24-27`: uso de `constructor()` apenas para ciclo de `resetLogin()` / `DestroyRef` (injeções permanecem via `inject()`), pré-existente e não alterado no diff.
