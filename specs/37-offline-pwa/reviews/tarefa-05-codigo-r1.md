<Parecer de Código — Tarefa 5>
**Veredito:** APROVADO

## Apontamentos (bloqueiam)
Nenhum apontamento bloqueante encontrado.

## Sugestões (não bloqueiam)
- Em `apps/web/src/app/features/rides/rides-layout/rides-layout.html`, o diálogo modal fecha por `Escape` e pelo botão **Voltar**, o que já atende à acessibilidade e previne fechamento acidental; caso desejem futuramente, pode-se avaliar se clique no backdrop também deve fechar ou permanecer bloqueado intencionalmente para confirmação segura.

## Observações fora do escopo deste diff
- Nenhuma observação estrutural pendente identificada nos arquivos tocados por esta tarefa.

---

### Evidências verificadas (somente leitura)
- **Camadas e isolamento (`docs/architecture.md` §2.3 e §4.2):** `NotificationBell` (`apps/web/src/app/shared/components/notification-bell/notification-bell.ts`) permanece puramente apresentacional, recebendo `isOffline` e `offlineNotice` via `input()` sem importar nada de `core/` ou `features/`. `RidesLayout` (`apps/web/src/app/features/rides/rides-layout/rides-layout.ts`) atua como orquestrador em `features/`, consumindo `AuthData`, `NotificationData` e `NetworkStatus` via `inject()`.
- **Padrões Angular 20+/22 (`.agents/rules/01-angular-strict-rules.md`):** uso consistente de componentes standalone implícitos, `@if` nos templates, `signal()`, `computed()`, `effect()`, `viewChild()`, `input()`, `output()`, `inject()` sem construtor, sem `any` e sem `.css` por componente.
- **Design Tokens (`docs/design-tokens.md` e `apps/web/src/styles.css`):** todas as cores, tipografias e espaçamentos adicionados em `notification-bell.html` e `rides-layout.html` utilizam exclusivamente os tokens semânticos (`bg-fundo`, `bg-superficie`, `bg-perigo`, `bg-perigo-fundo`, `bg-secundaria/50`, `bg-borda`, `bg-desabilitado`, `border-borda`, `text-texto`, `text-texto-suave`, `text-perigo`, `text-superficie`, `ring-secundaria`, `space-xs/sm/md/lg`, `text-headline-sm/md`, `text-body-md/lg/sm`, `text-label-md/lg`).
- **Acessibilidade e sustentabilidade:** o diálogo offline em `rides-layout.html` usa `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`, `(keydown.escape)` e `[inert]="logoutConfirming()"` no contêiner principal; `syncLogoutDialogFocus` move o foco para o botão seguro **Voltar** ao abrir e restaura para `#logoutButton` ao cancelar (evitando restaurar foco durante navegação ao confirmar saída).
- **Testes e linter:**
  - `npm test`: passou integralmente (`2` testes de layout em `layout.spec.mjs` + `26` arquivos / `351` testes Vitest aprovados).
  - `npm run lint`: `All files pass linting.`
</Parecer de Código — Tarefa 5>