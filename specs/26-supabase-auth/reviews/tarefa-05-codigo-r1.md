# Parecer de Código — Tarefa 5

**Veredito:** APROVADO

## Apontamentos (bloqueiam)
Nenhum apontamento bloqueante encontrado.

## Sugestões (não bloqueiam)
- **`apps/web/src/app/core/guards/auth-guard.spec.ts:73-91`**: `waitForUsersRequest` faz polling com `setTimeout(..., 5)` por até 40 tentativas (200 ms). Em máquinas mais lentas ou sob carga no CI, esse teto pode causar flakiness; considerar um helper com timeout ligeiramente mais folgado ou aguardar o ciclo de microtasks/navegação antes de consultar o `HttpTestingController`.
- **`apps/web/src/app/core/guards/auth-guard.spec.ts:24-71`**: Os dublês `fakeSupabaseUser`, `fakeSession`, `createFakeAuthClient` e `flushMicrotasks` repetem a estrutura já existente em `apps/web/src/app/core/services/auth-data.spec.ts:10-48`. Se novos testes de autenticação surgirem, vale extrair um helper local de testes de `core/` para evitar divergência entre os dublês.
- **`apps/web/src/app/core/services/auth-data.ts:343-346`**: O bloco `catch` de `restoreSession()` limpa a sessão local e retorna `false` (comportamento adequado para impedir falha não tratada no roteador e redirecionar para `/login`). Quando houver necessidade de observabilidade, pode-se registrar ou distinguir falhas inesperadas sem quebrar o retorno booleano.

## Observações fora do escopo deste diff
- **`apps/web/src/app/core/services/auth-data.ts:351-353`**: `logout()` limpa apenas `authenticatedUser`, sem zerar `sessionAccessToken` nem chamar `supabase.signOut()` (pré-existente; candidata a verificação em tarefa de logout ou Issue de manutenção).
- **`apps/web/src/app/core/services/auth-data.spec.ts:64, 84`**: Testes anteriores do arquivo ainda usam a URL literal `http://localhost:3000/...` em vez de `environment.apiUrl`.

---
**Validações executadas após o diff:**
- `npm test`: 2/2 testes em `pretest` (`layout.spec.mjs`) e 21 arquivos / 262 testes passando no Vitest.
- `npm run lint`: aprovado sem erros (`All files pass linting.`).
