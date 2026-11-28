# Parecer de Código — Tarefa 7

**Veredito:** APROVADO

## Apontamentos (bloqueiam)
Nenhum apontamento bloqueante.

### Verificação da correção da Rodada 1 (`tarefa-07-decisoes-r1.md`)
- **Centralização em `AuthData.canOffer`:** `apps/web/src/app/core/services/auth-data.ts` (linhas 37–41) define `isBlocked` e `canOffer` (`user !== null && !user.isBlocked && user.role !== 'support'`), ambos efetivamente consumidos na aplicação e validados em `auth-data.spec.ts`.
- **Delegação sem duplicação em `RideData`:** `apps/web/src/app/core/services/ride-data.ts` expõe `readonly canOffer = this.auth.canOffer` (linha 63) e centraliza a checagem em `canOperateAsDriver()` (`return this.auth.canOffer()`), `getAuthorizedDriver()` e `canManageRide(ride)` (linhas 234–246), aplicados de forma consistente em `editRideLoadResult`, `driverRidesResult`, `publishResult`, `updateResult`, `startEditing`, `canCancel`, `cancel$` e `occupySeat$`.
- **Delegação em `RideRequestData` e componentes:** `apps/web/src/app/core/services/ride-request-data.ts` deixou de injetar `AuthData` e delega todas as verificações de motorista/autoria para `this.rideData.canOperateAsDriver()` e `this.rideData.canManageRide(ride)`. `OfferRide` e `MyRides` consomem `rideData.canOffer`, `rideData.canManageRide(...)` e `authData.isBlocked()` sem replicar a regra.
- **Conformidade arquitetural e verificação automatizada:** `core/` e `features/driver/` respeitam o isolamento de camadas do `docs/architecture.md`, usam exclusivamente `inject()`, signals (`computed()`, `signal()`, `effect()`, `toSignal()`), `@if`/`@for` com `track`, Reactive Forms e tokens de `docs/design-tokens.md`. `npm test` (2/2 no pretest de layout + 15 arquivos / 87 testes no Vitest) e `npm run lint` executados com sucesso após as alterações.

## Sugestões (não bloqueiam)
- Em `apps/web/src/app/features/driver/my-rides/my-rides.ts` (linhas 247–283), `confirmCancelRide()`, `acceptRequest()` e `rejectRequest()` repetem a chamada a `this.rideRequestData.*` em dois ramos (`if (!this.rideData.canManageRide(ride))` e após `canCancelSelectedRide()` / `canAcceptRequests()` / `canManageSelectedRide()`). Entende-se que isso garante que chamadas diretas sem autorização ainda cheguem ao service para emitir `{ unauthorized: true }` e exibir o alerta, mas no futuro pode ser simplificado caso o service também retorne `{ invalidState: true }` antes de precisar do guard de componente.

## Observações fora do escopo deste diff
- Conforme previsto em `docs/architecture.md` (seção 2.2) e no `spec.md`, a proteção na fonte de dados (RLS no Supabase) permanece pendente para a Entrega 3; no MVP com `json-server`, as restrições são aplicadas no frontend.
- A duplicação de cabeçalho e navegação inferior entre as telas de `features/driver/` permanece conforme registrado em `Fora de escopo` no `spec.md`.
