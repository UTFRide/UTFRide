# Plano — Issue #26

## Decisões técnicas

- **Dependência e ambientes (`apps/web/`):** instalar `@supabase/supabase-js` em `apps/web/package.json`; criar `apps/web/src/environments/environment.development.ts` junto de `apps/web/src/environments/environment.ts` (com `apiUrl`, `supabaseUrl` e `supabasePublishableKey` apenas — nenhuma `sb_secret_`) e configurar `fileReplacements` na configuração `development` de `apps/web/angular.json`.
- **Encapsulamento do cliente Supabase (`core/services/supabase-client.ts`):** criar `SupabaseClientService` (`@Injectable({ providedIn: 'root' })`) que instancia `createClient(environment.supabaseUrl, environment.supabasePublishableKey)` e expõe a interface de autenticação (`signUp`, `signInWithPassword`, `signOut`, `getSession`, `onAuthStateChange`), permitindo injetar dublês em memória nos testes Vitest sem nenhuma chamada de rede real ao Supabase.
- **Estado de sessão no `AuthData` (`core/services/auth-data.ts`):** além de `currentUser` (`computed`), `isAuthenticated`, `isBlocked`, `canOffer` e `passengerRestriction`, manter `accessToken` (`signal<string | null>(null)` exposto como leitura para o `authInterceptor`) e método `ensureSessionRestored(): Promise<boolean>` memoizado que consulta `getSession()` uma vez ao recarregar a página e restaura o perfil no `json-server`.
- **Integração transitória com `json-server` (`// TODO` Atividade 15):**
  - No cadastro (`register`), validar duplicidade em `POST /registration-exists`, chamar `supabase.auth.signUp` com `options.data` (`name`, `registrationNumber`, `whatsapp`, `role: 'student'`, `isBlocked: false`), criar o registro espelho em `POST /users` (usando o `id` do Supabase quando disponível e sem depender de senha para login) e encerrar a sessão automática do `signUp` via `signOut` antes de redirecionar para `/login`.
  - No login (`login`) e na restauração (`ensureSessionRestored`), autenticar/ler a sessão do Supabase Auth e buscar o perfil por e-mail em `GET /users?email=...` (criando o espelho a partir dos metadados do Supabase se a conta ainda não existir no `db.json`, respeitando `isBlocked: true`).
- **Interceptor funcional (`core/interceptors/auth-interceptor.ts`):** registrar em `apps/web/src/app/app.config.ts` antes do `errorInterceptor` (`withInterceptors([authInterceptor, errorInterceptor])`), injetando `Authorization: Bearer <token>` apenas quando `AuthData.accessToken()` não for nulo e `request.url.startsWith(environment.apiUrl)` (não enviando token para APIs públicas externas como IBGE).
- **Guard assíncrono (`core/guards/auth-guard.ts`):** retornar `true` imediatamente se `auth.isAuthenticated()` já estiver ativo; caso contrário aguardar `auth.ensureSessionRestored()` e redirecionar para `router.parseUrl('/login')` quando falso.
- **Logout na UI:** adicionar botão **Sair** (estilizado exclusivamente com tokens semânticos de `docs/design-tokens.md`) ao lado do avatar nos cabeçalhos de `RidesLayout`, `MyRides` e `OfferRide`, chamando `AuthData.logout()` (`signOut` + limpeza de `authenticatedUser` e `accessToken`) e navegando para `/login`.

## Tarefas

- [ ] **Tarefa 1 — Configurar `@supabase/supabase-js`, ambientes e `SupabaseClientService`**
  - Cobre: CA10
  - Teste primeiro: criar `apps/web/src/app/core/services/supabase-client.spec.ts` verificando que `environment` e `environment.development` expõem `apiUrl`, `supabaseUrl` e `supabasePublishableKey` (sem `sb_secret_`), e que `SupabaseClientService` encapsula o cliente de autenticação e aceita dublê via DI sem chamadas reais ao Supabase; falha inicialmente porque os arquivos de ambiente de desenvolvimento e o serviço ainda não existem.
  - Arquivos previstos: `apps/web/package.json`, `package-lock.json`, `apps/web/angular.json`, `apps/web/src/environments/environment.ts`, `apps/web/src/environments/environment.development.ts`, `apps/web/src/app/core/services/supabase-client.ts`, `apps/web/src/app/core/services/supabase-client.spec.ts`.

- [ ] **Tarefa 2 — Implementar `authInterceptor` funcional e registrar em `app.config.ts`**
  - Cobre: CA7
  - Teste primeiro: criar `apps/web/src/app/core/interceptors/auth-interceptor.spec.ts` provando que requisições para `environment.apiUrl` recebem `Authorization: Bearer <access_token>` quando há sessão ativa, não recebem o header quando não há token e nunca enviam `Authorization` para APIs públicas externas (ex.: IBGE); falha inicialmente porque `auth-interceptor.ts` e `accessToken` ainda não existem.
  - Arquivos previstos: `apps/web/src/app/core/services/auth-data.ts`, `apps/web/src/app/core/interceptors/auth-interceptor.ts`, `apps/web/src/app/core/interceptors/auth-interceptor.spec.ts`, `apps/web/src/app/app.config.ts`.

- [ ] **Tarefa 3 — Migrar cadastro (`register`) para Supabase Auth e exibir aviso em `/login`**
  - Cobre: CA1, CA2
  - Teste primeiro: atualizar `auth-data.spec.ts`, `register.spec.ts` e `login.spec.ts` para exigir checagem de duplicidade, chamada a `signUp` com metadados do aluno, espelhamento em `POST /users` (`// TODO` Atividade 15), chamada a `signOut` para não manter sessão automática, navegação para `/login` com aviso de conta criada em português e tratamento de e-mail/matrícula duplicados ou erro do Supabase em português; falha inicialmente porque `AuthData.register` ainda usa apenas `json-server`.
  - Arquivos previstos: `apps/web/src/app/core/services/auth-data.ts`, `apps/web/src/app/core/services/auth-data.spec.ts`, `apps/web/src/app/features/auth/register/register.ts`, `apps/web/src/app/features/auth/register/register.spec.ts`, `apps/web/src/app/features/auth/login/login.ts`, `apps/web/src/app/features/auth/login/login.html`, `apps/web/src/app/features/auth/login/login.spec.ts`.

- [ ] **Tarefa 4 — Migrar login (`login`) para Supabase Auth e adaptar testes existentes com dublês**
  - Cobre: CA3, CA4, CA9
  - Teste primeiro: atualizar `auth-data.spec.ts` e `login.spec.ts` provando login via `signInWithPassword`, armazenamento de `accessToken` e `currentUser`, sincronização/busca do perfil no `json-server` (`// TODO` Atividade 15), bloqueio de usuário `isBlocked: true` (RN07 com `signOut`), mensagens em português para credenciais inválidas e falha de conexão sem travar `loading`; adaptar os helpers de login nas demais suítes `.spec.ts` para usar dublê de `SupabaseClientService` sem chamadas reais.
  - Arquivos previstos: `apps/web/src/app/core/services/auth-data.ts`, `apps/web/src/app/core/services/auth-data.spec.ts`, `apps/web/src/app/features/auth/login/login.ts`, `apps/web/src/app/features/auth/login/login.spec.ts`, `apps/web/src/app/core/interceptors/error-interceptor.spec.ts`, `apps/web/src/app/core/services/notification-data.spec.ts`, `apps/web/src/app/core/services/ride-data.spec.ts`, `apps/web/src/app/core/services/ride-request-data.spec.ts`, `apps/web/src/app/features/driver/my-rides/my-rides.spec.ts`, `apps/web/src/app/features/driver/offer-ride/offer-ride.spec.ts`, `apps/web/src/app/features/rides/my-trips/my-trips.spec.ts`, `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts`.

- [ ] **Tarefa 5 — Restaurar sessão persistida no `F5` e tornar `authGuard` assíncrono**
  - Cobre: CA5, CA6, CA9
  - Teste primeiro: criar `apps/web/src/app/core/guards/auth-guard.spec.ts` e acrescentar testes em `auth-data.spec.ts` provando que `ensureSessionRestored()` lê `getSession()`, restaura `currentUser` e `accessToken` antes do `authGuard` liberar rotas protegidas, redireciona para `/login` quando não há sessão ou quando `getSession()` falha, e mantém rotas públicas (`/`, `/login`, `/register`) acessíveis; falha inicialmente porque `authGuard` é síncrono e `AuthData` não restaura sessão.
  - Arquivos previstos: `apps/web/src/app/core/services/auth-data.ts`, `apps/web/src/app/core/services/auth-data.spec.ts`, `apps/web/src/app/core/guards/auth-guard.ts`, `apps/web/src/app/core/guards/auth-guard.spec.ts`.

- [ ] **Tarefa 6 — Adicionar botão Sair nos cabeçalhos autenticados e integrar `signOut` no `logout()`**
  - Cobre: CA8, CA9
  - Teste primeiro: criar `apps/web/src/app/features/rides/rides-layout/rides-layout.spec.ts` e adicionar testes em `my-rides.spec.ts`, `offer-ride.spec.ts`, `auth-data.spec.ts` e `error-interceptor.spec.ts` provando que clicar em **Sair** chama `AuthData.logout()` (invocando `signOut`, limpando `currentUser` e `accessToken` mesmo se a rede falhar) e navega para `/login`, voltando a bloquear rotas pelo `authGuard`, e que `401` no `errorInterceptor` também limpa a sessão; falha inicialmente porque o botão **Sair** ainda não existe nos cabeçalhos e `logout()` ainda não chama `signOut`.
  - Arquivos previstos: `apps/web/src/app/core/services/auth-data.ts`, `apps/web/src/app/core/services/auth-data.spec.ts`, `apps/web/src/app/core/interceptors/error-interceptor.spec.ts`, `apps/web/src/app/features/rides/rides-layout/rides-layout.ts`, `apps/web/src/app/features/rides/rides-layout/rides-layout.html`, `apps/web/src/app/features/rides/rides-layout/rides-layout.spec.ts`, `apps/web/src/app/features/driver/my-rides/my-rides.ts`, `apps/web/src/app/features/driver/my-rides/my-rides.html`, `apps/web/src/app/features/driver/my-rides/my-rides.spec.ts`, `apps/web/src/app/features/driver/offer-ride/offer-ride.ts`, `apps/web/src/app/features/driver/offer-ride/offer-ride.html`, `apps/web/src/app/features/driver/offer-ride/offer-ride.spec.ts`.

## Critérios sem tarefa

-
