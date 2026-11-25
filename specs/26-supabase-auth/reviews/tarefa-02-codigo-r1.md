# Parecer de Código — Tarefa 2

**Veredito:** APROVADO

## Apontamentos (bloqueiam)
Nenhum.

## Sugestões (não bloqueiam)
- Em `apps/web/src/app/core/interceptors/auth-interceptor.spec.ts:94-109`, o teste que valida o registro em `appConfig.providers` fornece um dublê parcial de `AuthData` (`accessToken`, `currentUser`, `logout`). Caso futuros interceptores ou provedores ligados ao `appConfig` passem a consultar outros membros de `AuthData` (como `isAuthenticated` ou `ensureSessionRestored`), esse mock parcial pode quebrar por propriedade ausente. Considerar injetar um dublê completo tipado ou espionar `accessToken` diretamente na instância real.

## Observações fora do escopo deste diff
- Nenhuma pendência adicional fora do escopo já planejado para as tarefas seguintes da Issue #26 (`auth-data.ts` ainda manterá o fluxo legado até as Tarefas 3–6).

---
Validação executada no workspace atual (somente leitura):
- `git diff 7564f9f0b7eb802fd074c13c432b27c9868f6218` revisado integralmente (`app.config.ts`, `auth-data.ts`, `auth-interceptor.ts`, `auth-interceptor.spec.ts`).
- `npm test`: passou (2 testes em `layout.spec.mjs` + 20 arquivos / 213 testes no Vitest).
- `npm run lint`: passou (`All files pass linting.`).
