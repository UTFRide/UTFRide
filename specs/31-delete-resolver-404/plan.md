# Plano — Issue #31

## Decisões técnicas

- **Exclusão real de oferta no `RideData` (`apps/web/src/app/core/services/ride-data.ts`):**
  - Adicionar `DeleteRideResult = { deletedRideId: string } | { unauthorized: true } | { invalidState: true } | RideErrorResult`.
  - Adicionar `canDelete(ride: Ride): boolean` validando `this.canManageRide(ride) && ride.status === 'cancelled'`.
  - Expor `deleteResult = toSignal<DeleteRideResult | undefined>(...)` alimentado por `deleteSubmissions` (`exhaustMap`) e `deleteResets`, com métodos `deleteRide(ride: Ride)` e `resetDelete()`.
  - Enviar `DELETE ${supabaseRestUrl('rides')}` com `params: { id: 'eq.' + ride.id }` (alinhado à política RLS `driver_id = auth.uid()` e ao `ON DELETE CASCADE` em `ride_requests` e `notifications` já ativos no Supabase), removendo a oferta de `driverRidesState`, limpando `editingRideState` se corresponder e mapeando `status === 0` (`connectionError`) ou demais falhas (`requestError`).
- **Ação e modal de exclusão em `MyRides` (`apps/web/src/app/features/driver/my-rides/my-rides.ts|html`):**
  - Expor `canDeleteSelectedRide`, `deleteConfirming`, `isDeleting`, `deleteError` e `deleteSuccessMessage`.
  - Exibir o botão **Excluir Oferta** (`data-testid="delete-ride-button"`) habilitado apenas quando `canDeleteSelectedRide()` for verdadeiro e abrir modal de confirmação acessível (`role="dialog"`, `aria-modal="true"`, fundo `[inert]="cancelConfirming() || deleteConfirming()"`, foco gerenciado via `viewChild` e fechamento por `Escape` ou **Voltar**).
  - Limpar estados transitórios (`deleteConfirming`, `deleteError`, `deleteSuccessMessage`, `rideData.resetDelete()`) ao trocar de oferta (`selectRide`) ou destruir o componente (`DestroyRef.onDestroy`), limpando solicitações locais quando a oferta excluída deixar de existir.
- **Resolver funcional em `/rides/:id` (`apps/web/src/app/core/resolvers/ride-detail-resolver.ts`, `ride-data.ts`, `app.routes.ts`, `ride-detail.ts`):**
  - Expor `resolveRideDetail(rideId: string | null): Observable<RideDetailResult>` no `RideData`, reutilizando `readPassengerRide` e `enrichWithDrivers` com `HANDLE_SESSION_EXPIRATION_ONLY` (retornando `{ status: 'not-found' }` para ausência/UUID inválido `22P02`, `{ status: 'loaded', ride }` em sucesso e `passengerLoadError(error)` em erro de rede/HTTP; `401` encerra sessão via `errorInterceptor`).
  - Criar `rideDetailResolver: ResolveFn<RideDetailResult>` e registrar `resolve: { initialDetail: rideDetailResolver }` na rota `:id` de `apps/web/src/app/app.routes.ts`.
  - Receber `readonly initialDetail = input<RideDetailResult>()` em `RideDetail` (via `withComponentInputBinding()`) e consumi-lo como estado inicial daquela seleção `{ id, passenger }` sem duplicar a leitura HTTP inicial, mantendo reexecução em **Tentar novamente**, troca de `:id` ou mudança de sessão.
- **Página `404` na rota curinga `**` (`apps/web/src/app/features/not-found/not-found.ts|html`, `app.routes.ts`):**
  - Criar componente standalone `NotFound` (sem `standalone: true`, sem `.css`/`.scss`, estilizado apenas com tokens semânticos de `docs/design-tokens.md`, seguindo o layout de cartão centralizado de `docs/prototipo/models/14._acesso_negado_403_forbidden.html`).
  - Usar `AuthData` via `inject()` para computar o destino seguro do botão de retorno (`/rides` quando autenticado, `/` quando visitante).
  - Registrar `{ path: '**', loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound) }` ao final de `apps/web/src/app/app.routes.ts`, sem `authGuard`.

## Tarefas

- [ ] **Tarefa 1 — Implementar exclusão real de oferta cancelada (`DELETE`) no `RideData`**
  - Cobre: CA1, CA2, CA3, CA6
  - Teste primeiro: em `apps/web/src/app/core/services/ride-data.spec.ts`, adicionar testes que provam `canDelete` verdadeiro apenas para oferta `cancelled` do motorista autor ativo, envio de `DELETE /rest/v1/rides?id=eq.<id>` atualizando `driverRides` e `editingRide`, bloqueio sem HTTP para ofertas `active`/`full`/`completed` ou conta bloqueada/`support`/outro autor, e tratamento de `connectionError` (`status === 0`) e `requestError`; falha inicialmente porque `canDelete`, `deleteRide` e `deleteResult` ainda não existem.
  - Arquivos previstos: `apps/web/src/app/core/services/ride-data.spec.ts`, `apps/web/src/app/core/services/ride-data.ts`.

- [ ] **Tarefa 2 — Adicionar fluxo e modal de confirmação de exclusão em `MyRides`**
  - Cobre: CA1, CA2, CA3, CA6
  - Teste primeiro: em `apps/web/src/app/features/driver/my-rides/my-rides.spec.ts`, adicionar testes que verificam botão **Excluir Oferta** restrito a oferta `cancelled` própria, abertura do modal acessível (`role="dialog"`, `[inert]` no fundo), desistência via **Voltar** e `Escape` sem HTTP e com retorno de foco, confirmação disparando `DELETE /rest/v1/rides?id=eq.<id>` e removendo a oferta com feedback acessível, alerta no modal em falha de conexão permitindo nova tentativa, bloqueio para outro aluno/conta bloqueada e limpeza de estado ao sair ou trocar de oferta; falha inicialmente porque a ação e o modal de exclusão ainda não existem em `MyRides`.
  - Arquivos previstos: `apps/web/src/app/features/driver/my-rides/my-rides.spec.ts`, `apps/web/src/app/features/driver/my-rides/my-rides.ts`, `apps/web/src/app/features/driver/my-rides/my-rides.html`.

- [ ] **Tarefa 3 — Implementar `rideDetailResolver` funcional em `/rides/:id` e integrar `initialDetail` em `RideDetail`**
  - Cobre: CA4, CA6
  - Teste primeiro: criar `apps/web/src/app/core/resolvers/ride-detail-resolver.spec.ts` e atualizar `ride-data.spec.ts`, `ride-detail.spec.ts` e `ride-list.spec.ts` provando que `rideDetailResolver` pré-carrega oferta e resumo do motorista antes da ativação de `RideDetail`, retorna `not-found` (inclusive em erro `22P02`) ou `error` (mantendo **Tentar novamente**), respeita encerramento de sessão em `401`, evita requisição duplicada no carregamento inicial e isola trocas de rota ou sessão; falha inicialmente porque `rideDetailResolver` e `resolveRideDetail` ainda não existem nem estão registrados em `app.routes.ts`.
  - Arquivos previstos: `apps/web/src/app/core/resolvers/ride-detail-resolver.spec.ts`, `apps/web/src/app/core/resolvers/ride-detail-resolver.ts`, `apps/web/src/app/core/services/ride-data.ts`, `apps/web/src/app/core/services/ride-data.spec.ts`, `apps/web/src/app/app.routes.ts`, `apps/web/src/app/features/rides/ride-detail/ride-detail.ts`, `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts`.

- [ ] **Tarefa 4 — Criar página standalone `NotFound` (`404`) e registrar rota curinga `**`**
  - Cobre: CA5, CA6
  - Teste primeiro: criar `apps/web/src/app/features/not-found/not-found.spec.ts` provando que rotas desconhecidas (ex.: `/rota-inexistente`, `/driver/desconhecida`) ativam a rota curinga `**` sob demanda tanto para visitante quanto para aluno autenticado sem redirecionar ao login, exibem código `404` e mensagem de página não encontrada, e direcionam o botão de retorno para `/` (visitante) ou `/rides` (autenticado); falha inicialmente porque `NotFound` e a rota `**` não existem.
  - Arquivos previstos: `apps/web/src/app/features/not-found/not-found.spec.ts`, `apps/web/src/app/features/not-found/not-found.ts`, `apps/web/src/app/features/not-found/not-found.html`, `apps/web/src/app/app.routes.ts`.

## Critérios sem tarefa

-
