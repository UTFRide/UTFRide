<Parecer de Código — Tarefa 6>
**Veredito:** APROVADO

## Apontamentos (bloqueiam)
Nenhum apontamento bloqueante encontrado no diff inspecionado (`git diff c3da3d80932e6d7d12a6d31434fd60f28cbae419`).

Resumo da conformidade verificada:
- **Camadas e encapsulamento (`docs/architecture.md` §§ 2.2, 2.3, 4.2):** `AuthData.logout()` em `apps/web/src/app/core/services/auth-data.ts` encapsula `this.supabase.signOut()`, limpa `authenticatedUser` e `sessionAccessToken` de forma síncrona via `clearLocalSession()` e zera `sessionRestorePromise`. Os componentes `RidesLayout`, `MyRides` e `OfferRide` comunicam-se exclusivamente via `AuthData` e `Router` injetados com `inject()`, sem acesso direto a `HttpClient` ou `SupabaseClientService` e sem imports cruzados entre features.
- **Padrões Angular 22 (`01-angular-strict-rules.md` § 1):** Componentes standalone sem `standalone: true`, estado local reativo com `signal(false)` (`loggingOut`), injeção via `inject()`, tipagem estrita sem `any` e uso de `try/finally` garantindo o reset de `loggingOut` e proteção contra duplo clique.
- **Design Tokens (`docs/design-tokens.md` / `01-angular-strict-rules.md` § 2):** O botão `Sair` em `rides-layout.html`, `my-rides.html` e `offer-ride.html` usa exclusivamente os tokens semânticos definidos em `styles.css` (`border-borda`, `bg-superficie`, `hover:bg-fundo`, `text-label-md`, `text-body-md`, `text-texto-suave`, `hover:text-texto`, `focus-visible:ring-secundaria`, `disabled:bg-desabilitado`, `gap-space-xs`, `px-space-sm`), sem valores soltos, sem `style="..."` e sem `.css` por componente.
- **Tratamento de erro assíncrono/rede:** `AuthData.logout()` limpa a sessão local antes de aguardar `this.supabase.signOut()` e captura falhas de rede no `catch`, garantindo que a saída e o redirecionamento para `/login` não travem offline nem gerem rejeição não tratada no `errorInterceptor`.
- **Suficiência e isolamento dos testes:** Todos os cenários (fluxo normal, falha de rede em `signOut`, retorno de `{ error }` do Supabase, bloqueio de rota após saída pelo `authGuard` e tratamento 401 no `errorInterceptor`) são cobertos com dublês em memória (`SUPABASE_AUTH_CLIENT` + `provideHttpClientTesting()`), sem chamadas reais ao Supabase. Verificado com `npm test` (22 arquivos, 271 testes passando, além dos 2 testes de layout do `pretest`) e `npm run lint` (0 erros).

## Sugestões (não bloqueiam)
- **Reduzir repetição do botão e método de logout entre os três cabeçalhos:** `RidesLayout` (`rides-layout.ts`/`rides-layout.html`), `MyRides` (`my-rides.ts`/`my-rides.html`) e `OfferRide` (`offer-ride.ts`/`offer-ride.html`) repetem o mesmo bloco de botão `Sair` e a função `logout()`/`loggingOut`. Como `shared/` não pode importar de `core/`, considerar no futuro extrair um componente burro em `shared/components/` (recebendo `loggingOut` via `input()` e emitindo evento via `output()`) ou um cabeçalho autenticado reutilizável antes de replicá-lo nas próximas telas autenticadas.
- **Centralizar o dublê de `SupabaseAuthClient` nos testes:** `apps/web/src/app/features/rides/rides-layout/rides-layout.spec.ts` replica `createFakeAuthClient` e `flushMicrotasks` já presentes em outros `.spec.ts`; em futuras histórias vale considerar um helper de teste compartilhado para evitar manutenção duplicada do dublê.

## Observações fora do escopo deste diff
- Em `apps/web/src/app/core/interceptors/error-interceptor.ts:27`, a chamada `auth.logout()` agora retorna `Promise<void>` (antes era `void`); embora segura porque `clearLocalSession()` ocorre de forma síncrona e exceções são tratadas internamente, vale anotar `void auth.logout();` em manutenção futura para manter consistência com `void router.navigateByUrl('/login');` na linha 29.
- Os cabeçalhos autenticados completos de `RidesLayout`, `MyRides` e `OfferRide` já duplicavam logo, `app-notification-bell` e `student-avatar`; candidata a Issue de manutenção caso novas telas autenticadas (`/searches`, `/reviews/history`, `/support`) precisem do mesmo cabeçalho.
</Parecer de Código — Tarefa 6>
