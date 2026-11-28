# Parecer de Código — Tarefa 7

**Veredito:** APROVADO

## Apontamentos (bloqueiam)
Nenhum apontamento bloqueante.

- **Conformidade arquitetural (`docs/architecture.md` e `.agents/rules/01-angular-strict-rules.md`):**
  - **Camadas (§2.3, §4.2):** `OfferRide` e `MyRides` permanecem isolados em `features/driver/`, consumindo apenas serviços de `core/services/` (`NetworkStatus`, `RideData`, `RideRequestData`, `NotificationData`, `AuthData`) e componentes/pipes de `shared/`, sem chamadas diretas a `HttpClient` nem importações entre features.
  - **Padrões Angular 20+ (§1.2):** componentes standalone sem `standalone: true`, injeção via `inject()`, estado derivado com `computed()`, control flow `@if`/`@for` com `track`, Reactive Forms preservado em `OfferRide` e tipagem estrita sem `any`.
  - **Design Tokens (`docs/design-tokens.md`):** uso exclusivo de tokens semânticos (`bg-superficie`, `bg-fundo`, `border-borda`, `text-texto-suave`, `disabled:bg-desabilitado`, `disabled:text-texto-suave`, `space-xs`, `space-sm`, `body-sm`, `body-lg`), sem cores soltas, estilos inline ou arquivos `.css`.
  - **Bloqueio defensivo e testes:** além do `[disabled]` e `[attr.aria-describedby]` nos templates, todos os handlers remotos em `offer-ride.ts` (`retryLoadEdit`, `submit`) e `my-rides.ts` (`retryLoadRides`, `retryLoadRequests`, `editSelectedRide`, `openCancelConfirmation`, `confirmCancelRide`, `openDeleteConfirmation`, `confirmDeleteRide`, `acceptRequest`, `rejectRequest`) guardam contra `this.network.isOffline()`. Os testes em `offer-ride.spec.ts` e `my-rides.spec.ts` usam `HttpTestingController` e dublês em memória, validando comportamento via DOM e métodos públicos dos handlers sem acoplamento a estado privado.
- **Verificações executadas:**
  - `npm run test -w apps/web -- --watch=false --include=src/app/features/driver/offer-ride/offer-ride.spec.ts --include=src/app/features/driver/my-rides/my-rides.spec.ts`: 2 arquivos, 43 testes passando.
  - `npm test`: 2 testes de layout + 26 arquivos Vitest / 367 testes passando.
  - `npm run lint`: aprovado sem erros.

## Sugestões (não bloqueiam)
- **Extrair componente compartilhado para o aviso offline junto às ações:** o bloco `@if (network.isOffline()) { <p role="status" ...>wifi_off + {{ offlineMessage }}</p> }` se repete 6 vezes em `apps/web/src/app/features/driver/my-rides/my-rides.html` (linhas 89-98, 287-296, 328-338, 383-393, 509-518 e 589-598) e 2 vezes em `apps/web/src/app/features/driver/offer-ride/offer-ride.html` (linhas 98-107 e 365-375), além das telas de passageiro. Extrair um componente burro em `apps/web/src/app/shared/components/` (aceitando `id`, `message` e variante de fundo `superficie`/`fundo` via `input()`) reduziria duplicação de markup.
- **Associar `aria-describedby` aos botões dentro de `RideRequestCard`:** em `apps/web/src/app/features/driver/my-rides/ride-request-card.html` (linhas 39-59), os botões `Recusar` e `Aceitar Vaga` ficam desabilitados quando offline, mas o aviso `#my-rides-requests-offline-hint` está fora do card (`my-rides.html` linhas 328-338). Um `input<string | null>(null)` opcional com o id da explicação permitiria vincular `aria-describedby` diretamente aos dois botões quando offline.

## Observações fora do escopo deste diff
- **Cabeçalho duplicado e saída (`Sair`) sem confirmação offline em `OfferRide` e `MyRides`:** diferentemente de `RidesLayout` (atualizado na Tarefa 5 para o CA6), `apps/web/src/app/features/driver/offer-ride/offer-ride.ts` (linhas 355-364) e `apps/web/src/app/features/driver/my-rides/my-rides.ts` (linhas 342-351) mantêm cabeçalho próprio com botão `Sair` que executa `logout()` imediatamente mesmo quando `network.isOffline()` é verdadeiro. Candidata a Issue de manutenção para compartilhar o shell autenticado ou alinhar o diálogo de confirmação offline nessas duas rotas.
