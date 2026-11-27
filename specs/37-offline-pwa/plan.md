# Plano — Issue #37

## Decisões técnicas

- **`NetworkStatus` (`apps/web/src/app/core/services/network-status.ts`):**
  - Singleton `@Injectable({ providedIn: 'root' })` monitorando `navigator.onLine` e os eventos `online` / `offline` de `window` (removendo listeners em `DestroyRef.onDestroy`).
  - Expõe `readonly isOnline = computed(...)`, `readonly isOffline = computed(...)` e a constante compartilhada `OFFLINE_ACTION_MESSAGE = 'Conecte-se à internet novamente para habilitar todas as funções do app UTFRide novamente'`.
- **`OfflineCache` (`apps/web/src/app/core/services/offline-cache.ts`):**
  - Serviço utilitário em `core/services/` para leitura, gravação e remoção segura em `localStorage` (com `try/catch` para indisponibilidade ou JSON inválido), centralizando chaves escopadas por `userId` e limpeza completa dos dados privados do usuário no logout ou troca de conta.
- **Banner global persistente no `App` (`apps/web/src/app/app.ts|html`):**
  - Injeta `NetworkStatus` e renderiza, acima do `<router-outlet />` (cobrindo `/`, `/login`, `/register`, `/rides/*`, `/driver/*` e `**`), quando `network.isOffline()` for verdadeiro, o banner `role="status"` (`data-testid="offline-banner"`) com estilo **Opção C** (`border-b border-borda bg-primaria px-space-lg py-space-sm text-label-md text-texto`), ícone `wifi_off` e o texto **"Você está offline. Visualizando dados salvos"**.
- **Sessão em cache e bloqueio de autenticação/cadastro (`AuthData`, `Login`, `Register`):**
  - `AuthData` salva um resumo seguro do perfil autenticado (`User`, sem senha) no `OfflineCache` ao autenticar/restaurar sessão online, e limpa o cache privado do usuário em `clearLocalSession()` / `logout()` ou ao trocar de usuário.
  - Quando `restoreSession()` executa com `network.isOffline()` verdadeiro, verifica `supabase.getSession()`; se houver sessão local válida e perfil correspondente em cache, restaura `authenticatedUser` e `sessionAccessToken` em modo somente-leitura para o `authGuard` liberar as rotas protegidas sem depender da rede.
  - `Login` e `Register` injetam `NetworkStatus`, desabilitam o envio e barram `submit()` quando offline, exibindo `OFFLINE_ACTION_MESSAGE` junto ao botão de submissão.
- **Cache local e bloqueio de rede nos Services de dados (`LocationData`, `RideData`, `RideRequestData`, `NotificationData`):**
  - `LocationData`: salva sugestões de municípios do IBGE em cache e, offline, devolve o cache (ou `[]`) sem disparar HTTP.
  - `RideData`: salva em cache escopado por `userId` as listagens de `rides` (`RideWithDriver[]`), `driverRides` (`Ride[]`) e detalhes consultados (`RideWithDriver`). Quando offline, entrega os dados em cache (incluindo `resolveRideDetail`, retornando `{ status: 'loaded', ride }` se existir no cache ou `{ status: 'error', connectionError: true }` se ausente) e bloqueia `publishRide`, `updateRide`, `deleteRide` e recarregamentos remotos antes de chamar `HttpClient`.
  - `RideRequestData`: salva em cache escopado por `userId` `passengerTrips`, solicitações por oferta (`requestsByRide`) e solicitação do passageiro por oferta; offline, lê do cache sem HTTP e bloqueia `createRequest`, `cancelPassengerRequest`, `acceptRequest`, `rejectRequest` e `cancelRideWithCascade`.
  - `NotificationData`: salva notificações do usuário em cache escopado por `userId`; offline, preenche `notificationsState` com o cache em `loadForCurrentUser()` sem disparar `GET /rest/v1/notifications`.
- **`NotificationBell` e confirmação de `Sair` offline (`NotificationBell`, `RidesLayout`):**
  - `NotificationBell` (em `shared/`, sem importar `core/`) recebe `isOffline = input<boolean>(false)` e `offlineNotice = input<string>('')` para exibir os avisos já carregados em cache e a explicação de atualização indisponível quando offline.
  - `RidesLayout` repassa o estado offline ao `NotificationBell` e, ao acionar **Sair** enquanto `network.isOffline()`, abre diálogo acessível de confirmação (*"Você realmente deseja sair? Até se conectar novamente, você não terá acesso ao UTFRide."*), limpando sessão e cache local apenas após confirmação (e permitindo cancelar com **Voltar** ou `Escape`).
- **Desabilitação com explicação nas telas autenticadas (`RideList`, `RideDetail`, `MyTrips`, `OfferRide`, `MyRides`):**
  - Cada tela desabilita ações e formulários dependentes do servidor quando `network.isOffline()` (solicitar vaga, cancelar solicitação, tentar novamente, publicar/editar oferta, cancelar/excluir oferta, aceitar/rejeitar solicitação), exibindo `OFFLINE_ACTION_MESSAGE` de forma acessível e consistente com os tokens de `docs/design-tokens.md`.

## Tarefas

- [x] **Tarefa 1 — Criar `NetworkStatus`, `OfflineCache` e banner global offline no `App`**
  - Cobre: CA1, CA7
  - Teste primeiro: criar `apps/web/src/app/core/services/network-status.spec.ts` e `apps/web/src/app/core/services/offline-cache.spec.ts`, e atualizar `apps/web/src/app/app.spec.ts` provando detecção reativa de `navigator.onLine` e eventos `offline`/`online`, gravação/leitura/limpeza isolada por usuário no `localStorage`, e exibição/remoção automática do banner global (`role="status"`, texto *"Você está offline. Visualizando dados salvos"* e classes da Opção C) no `App`; falha inicialmente porque `NetworkStatus`, `OfflineCache` e o banner em `app.ts|html` ainda não existem.
  - Arquivos previstos: `apps/web/src/app/core/services/network-status.spec.ts`, `apps/web/src/app/core/services/network-status.ts`, `apps/web/src/app/core/services/offline-cache.spec.ts`, `apps/web/src/app/core/services/offline-cache.ts`, `apps/web/src/app/app.spec.ts`, `apps/web/src/app/app.ts`, `apps/web/src/app/app.html`.

- [x] **Tarefa 2 — Persistir sessão offline em `AuthData` e bloquear envio em `Login` e `Register`**
  - Cobre: CA2, CA3, CA7
  - Teste primeiro: atualizar `auth-data.spec.ts`, `auth-guard.spec.ts`, `login.spec.ts` e `register.spec.ts` provando que `AuthData` salva e limpa o perfil em cache sem vazar entre contas, restaura sessão somente-leitura via `restoreSession()` quando offline com sessão local válida do Supabase (liberando `authGuard` sem HTTP), redireciona quando não há cache, e desabilita/bloqueia `Login` e `Register` offline com `OFFLINE_ACTION_MESSAGE` sem disparar chamadas de rede; falha inicialmente porque `AuthData`, `Login` e `Register` não tratam modo offline.
  - Arquivos previstos: `apps/web/src/app/core/services/auth-data.spec.ts`, `apps/web/src/app/core/services/auth-data.ts`, `apps/web/src/app/core/guards/auth-guard.spec.ts`, `apps/web/src/app/features/auth/login/login.spec.ts`, `apps/web/src/app/features/auth/login/login.ts`, `apps/web/src/app/features/auth/login/login.html`, `apps/web/src/app/features/auth/register/register.spec.ts`, `apps/web/src/app/features/auth/register/register.ts`, `apps/web/src/app/features/auth/register/register.html`.

- [x] **Tarefa 3 — Adicionar cache local e bloqueio de rede em `LocationData` e `RideData` (incluindo `resolveRideDetail`)**
  - Cobre: CA4, CA5, CA7
  - Teste primeiro: atualizar `location-data.spec.ts`, `ride-data.spec.ts` e `ride-detail-resolver.spec.ts` provando cache de municípios em `LocationData` sem HTTP offline, persistência e leitura offline de ofertas disponíveis, `driverRides` e detalhe da oferta em `RideData` (com retorno em cache ou erro offline em `resolveRideDetail` quando ausente), e bloqueio sem HTTP de `publishRide`, `updateRide` e `deleteRide` quando offline; falha inicialmente porque `LocationData` e `RideData` não usam `NetworkStatus` nem `OfflineCache`.
  - Arquivos previstos: `apps/web/src/app/core/services/location-data.spec.ts`, `apps/web/src/app/core/services/location-data.ts`, `apps/web/src/app/core/services/ride-data.spec.ts`, `apps/web/src/app/core/services/ride-data.ts`, `apps/web/src/app/core/resolvers/ride-detail-resolver.spec.ts`.

- [ ] **Tarefa 4 — Adicionar cache local e bloqueio de rede em `RideRequestData` e `NotificationData`**
  - Cobre: CA4, CA5, CA7
  - Teste primeiro: atualizar `ride-request-data.spec.ts` e `notification-data.spec.ts` provando persistência e leitura offline de `passengerTrips`, solicitações por oferta e notificações do usuário (isoladas por `userId` e limpas no logout), além do bloqueio sem HTTP de `createRequest`, `cancelPassengerRequest`, `acceptRequest`, `rejectRequest` e `cancelRideWithCascade` quando offline; falha inicialmente porque `RideRequestData` e `NotificationData` sempre tentam rede.
  - Arquivos previstos: `apps/web/src/app/core/services/ride-request-data.spec.ts`, `apps/web/src/app/core/services/ride-request-data.ts`, `apps/web/src/app/core/services/notification-data.spec.ts`, `apps/web/src/app/core/services/notification-data.ts`.

- [ ] **Tarefa 5 — Adaptar `NotificationBell` para cache offline e adicionar confirmação de `Sair` offline em `RidesLayout`**
  - Cobre: CA5, CA6, CA7
  - Teste primeiro: atualizar `notification-bell.spec.ts` e `rides-layout.spec.ts` provando que `NotificationBell` exibe avisos em cache e explicação de atualização indisponível quando offline (sem quebrar isolamento de `shared/`), e que o botão **Sair** em `RidesLayout` abre diálogo de confirmação acessível quando offline, mantém a sessão ao cancelar/`Escape` e limpa sessão e cache local ao confirmar; falha inicialmente porque `NotificationBell` e `RidesLayout` não diferenciam modo offline na saída nem no aviso do sino.
  - Arquivos previstos: `apps/web/src/app/shared/components/notification-bell/notification-bell.spec.ts`, `apps/web/src/app/shared/components/notification-bell/notification-bell.ts`, `apps/web/src/app/shared/components/notification-bell/notification-bell.html`, `apps/web/src/app/features/rides/rides-layout/rides-layout.spec.ts`, `apps/web/src/app/features/rides/rides-layout/rides-layout.ts`, `apps/web/src/app/features/rides/rides-layout/rides-layout.html`.

- [ ] **Tarefa 6 — Desabilitar ações remotas com explicação nas telas de passageiro (`RideList`, `RideDetail`, `MyTrips`)**
  - Cobre: CA4, CA5, CA7
  - Teste primeiro: atualizar `ride-list.spec.ts`, `ride-detail.spec.ts` e `my-trips.spec.ts` provando exibição dos dados em cache offline, aviso específico quando um detalhe `/rides/:id` não está em cache sem internet, desabilitação dos botões de solicitar vaga, cancelar solicitação pendente e tentar novamente com `OFFLINE_ACTION_MESSAGE`, e reabilitação automática ao voltar `online`; falha inicialmente porque essas telas não reagem ao estado offline.
  - Arquivos previstos: `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts`, `apps/web/src/app/features/rides/ride-list/ride-list.ts`, `apps/web/src/app/features/rides/ride-list/ride-list.html`, `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts`, `apps/web/src/app/features/rides/ride-detail/ride-detail.ts`, `apps/web/src/app/features/rides/ride-detail/ride-detail.html`, `apps/web/src/app/features/rides/my-trips/my-trips.spec.ts`, `apps/web/src/app/features/rides/my-trips/my-trips.ts`, `apps/web/src/app/features/rides/my-trips/my-trips.html`.

- [ ] **Tarefa 7 — Desabilitar ações remotas com explicação nas telas de motorista (`OfferRide`, `MyRides`)**
  - Cobre: CA4, CA5, CA7
  - Teste primeiro: atualizar `offer-ride.spec.ts` e `my-rides.spec.ts` provando exibição de `driverRides` e solicitações em cache offline, bloqueio/desabilitação de publicar ou editar oferta (`OfferRide`) e de editar, cancelar, excluir oferta ou aceitar/rejeitar solicitação (`MyRides`) com `OFFLINE_ACTION_MESSAGE`, e reabilitação automática quando a conexão retorna; falha inicialmente porque `OfferRide` e `MyRides` não consideram `NetworkStatus`.
  - Arquivos previstos: `apps/web/src/app/features/driver/offer-ride/offer-ride.spec.ts`, `apps/web/src/app/features/driver/offer-ride/offer-ride.ts`, `apps/web/src/app/features/driver/offer-ride/offer-ride.html`, `apps/web/src/app/features/driver/my-rides/my-rides.spec.ts`, `apps/web/src/app/features/driver/my-rides/my-rides.ts`, `apps/web/src/app/features/driver/my-rides/my-rides.html`.

## Critérios sem tarefa

-
