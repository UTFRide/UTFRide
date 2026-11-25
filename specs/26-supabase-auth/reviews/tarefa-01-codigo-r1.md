# Parecer de Código — Tarefa 1

**Veredito:** APROVADO

## Apontamentos (bloqueiam)
Nenhum.

## Sugestões (não bloqueiam)
- **`apps/web/src/app/core/services/supabase-client.ts:50-56` (`onAuthStateChange`)**: o método envolve o `callback` em `async (event, session) => { await callback(event, session); }`. Caso a assinatura de `SupabaseAuthClient['onAuthStateChange']` permita repassar `callback` diretamente (`return this.auth.onAuthStateChange(callback)`), evita-se uma função `async` intermediária desnecessária (e se o wrapper for mantido, vale cobrir em `supabase-client.spec.ts` o repasse de `(event, session)` ao invocar o callback registrado).
- **`apps/web/src/app/core/services/supabase-client.ts:21-24`**: atualmente o serviço armazena apenas `.auth` em `this.authClient`. Na Entrega 3 (quando consultas ao Postgres via `@supabase/supabase-js` entrarem nos Services do `core/services/`), será mais direto armazenar a instância de `SupabaseClient` e derivar `.auth` dela — mudança simples e retrocompatível quando chegar a hora.
- **`apps/web/src/app/core/services/supabase-client.spec.ts:51`**: o teste verifica `expect(env.apiUrl).toBe('http://localhost:3000')` também sobre `prodEnvironment` (`environment.ts`). Isso acopla o teste ao valor provisório de `apiUrl` em produção enquanto os dados ainda usam `json-server`.

## Observações fora do escopo deste diff
- **`apps/web/src/environments/environment.ts:2`**: o ambiente de produção (`environment.ts`) já tinha `apiUrl: 'http://localhost:3000'` antes deste diff; quando houver deploy em produção antes da migração completa para o Supabase, será necessário parametrizar essa URL (ou remover `apiUrl` na Entrega 3).
- **Validação executada**: `npm test` (2/2 em `pretest` e 19 arquivos / 209 testes em Vitest, incluindo os 3 novos testes em `supabase-client.spec.ts`) e `npm run lint` (`All files pass linting`) passaram após o estado atual do diff.
