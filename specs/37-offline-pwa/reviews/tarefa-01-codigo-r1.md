# Parecer de Código — Tarefa 1

**Veredito:** APROVADO

## Apontamentos (bloqueiam)
Nenhum.

- **Camadas e dependências (`architecture.md` §2.3 e §4.2):** `NetworkStatus` e `OfflineCache` estão em `apps/web/src/app/core/services/`, sem importar de `shared/` ou `features/`. O componente raiz `App` consome `NetworkStatus` via `inject(NetworkStatus)`, sem acessar `navigator` ou `localStorage` diretamente no componente/template.
- **Padrões Angular 22 e Tokens (`architecture.md` §1.1, §1.2 e `design-tokens.md`):** Uso exclusivo de `inject()`, `signal()` e `computed()` para estado reativo em `NetworkStatus`, `@if (network.isOffline())` no template `app.html`, tipagem estrita sem `any` e classes baseadas apenas nos tokens semânticos (`bg-primaria`, `text-texto`, `border-borda`, `px-space-lg`, `py-space-sm`, `gap-space-sm`, `text-label-md`, `text-body-lg`).
- **Ciclo de vida e resiliência:** `NetworkStatus` remove os listeners de `online` e `offline` via `DestroyRef.onDestroy`. `OfflineCache` isola chaves por `userId` com prefixo delimitado por `:` (`utfride:offline:user:<userId>:<key>`), impedindo vazamento ou colisão entre contas, e degrada com segurança diante de JSON inválido ou indisponibilidade/cota do `localStorage`.
- **Verificação:** `npm test` passou integralmente (2 testes de layout + 26 suítes / 319 testes Vitest) e `npm run lint` passou sem erros.

## Sugestões (não bloqueiam)
- Em `apps/web/src/app/core/services/offline-cache.ts`, caso venha a existir um `userId` contendo `:` no futuro, normalizar ou codificar o segmento evitaria colisão de prefixo (hoje seguro porque os IDs vêm como UUID do Supabase Auth).

## Observações fora do escopo deste diff
- Nenhuma observação estrutural encontrada nos arquivos tocados por este diff.
