<Parecer de Código — Tarefa 4>
**Veredito:** APROVADO

O diff da Tarefa 4 (`apps/web/src/app/app.routes.ts`, `apps/web/src/app/features/not-found/not-found.ts`, `apps/web/src/app/features/not-found/not-found.html` e `apps/web/src/app/features/not-found/not-found.spec.ts`) respeita integralmente as regras de arquitetura (`docs/architecture.md`) e de código Angular (`.agents/rules/01-angular-strict-rules.md`):
- Rota curinga `**` posicionada ao final de `routes` em `apps/web/src/app/app.routes.ts:37`, com `loadComponent` (lazy loading) e sem `authGuard`.
- Componente `NotFound` (`apps/web/src/app/features/not-found/not-found.ts:6-18`) standalone implícito (sem `standalone: true`), sem arquivo CSS próprio, usando `inject(AuthData)` e estado derivado via `computed()`.
- Dependências de camada respeitadas (`features/not-found` importa apenas de `core/services/auth-data` e `@angular/router`).
- Template `apps/web/src/app/features/not-found/not-found.html` utiliza `@if` / `@else` (linhas 71-75), classes utilitárias Tailwind e exclusivamente tokens semânticos de cor, espaçamento (`space-*`) e tipografia definidos em `docs/design-tokens.md` / `apps/web/src/styles.css`, sem cores hexadecimais ou `style="..."`.
- Suíte executada: `npm test` (2/2 testes de `layout.spec.mjs` e 24 arquivos / 306 testes Vitest passando, incluindo os 7 de `not-found.spec.ts`) e `npm run lint` (`All files pass linting.`).

## Apontamentos (bloqueiam)
Nenhum apontamento bloqueante.

## Sugestões (não bloqueiam)
- `apps/web/src/app/features/not-found/not-found.spec.ts:235` e `:259`: a asserção `expect(fakeAuth.getSession).not.toHaveBeenCalled()` acopla o teste ao fato de nenhuma restauração automática de sessão ocorrer antes da ativação da rota curinga; caso o bootstrap da aplicação passe a restaurar sessão globalmente no futuro, essa asserção falhará mesmo com a rota `404` comportando-se corretamente (o `Router.url === unknownRoute` e a renderização do `404` já comprovam a ausência de redirecionamento ao login).
- `apps/web/src/app/features/not-found/not-found.html:47` e `:98`: na linha 47, `text-display-currency` reutiliza um token semântico destinado a valores monetários para dimensionar um ícone (`wrong_location`); na linha 98, `font-mono` usa a família monoespaçada padrão fora da família `Inter` (`font-sans`) registrada em `docs/design-tokens.md`.

## Observações fora do escopo deste diff
- `docs/architecture.md:82-95`: a tabela do Mapa de Rotas (§3.2) ainda não documenta a rota curinga `**` (`NotFound`); candidata a atualização documental de manutenção.
</Parecer de Código — Tarefa 4>