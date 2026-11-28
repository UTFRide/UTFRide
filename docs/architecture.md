# 🏗️ Especificação de Arquitetura Técnica (Architecture / SSD)

**Projeto:** UTFRide  
**Versão:** 1.0.4<br>
**Data:** 2026-11-27<br>
**Status:** Aprovado  

> 🤖 **Este documento é a régua arquitetural e técnica do UTFRide.** Ele estabelece os padrões estruturais, a organização do código, o modelo de dados e os contratos de integração que o `/utf-setup`, os implementadores e os revisores devem seguir rigorosamente durante todo o ciclo de desenvolvimento.

---

## 💻 1. Stack Tecnológica e Padrões do Frontend (IDs 4 a 19)

### 1.1 Stack Principal
- **Framework Frontend:** **Angular 22** (setup com Angular 22.2.3 e Angular CLI 22.2.4; versões resolvidas no `package-lock.json`).
- **Paradigma de Componentização:** Arquitetura 100% **Standalone** (sem nenhum `NgModule`).
- **Framework CSS:** **Tailwind CSS** com sistema de tokens semânticos definido em [`docs/design-tokens.md`](file:///c:/Users/duduk/Documents/UTFRide/docs/design-tokens.md).
- **Gerenciamento de Estado:** **Signals** nativos do Angular (`signal()`, `computed()`, `model()`, `effect()`).
- **Cliente BaaS e Autenticação:** **`@supabase/supabase-js`** (Supabase Auth, sessão persistente e integração com o projeto Supabase).
- **Testes Unitários:** **Vitest** com TDD estrito, integrado ao builder `@angular/build:unit-test` do Angular CLI.
- **Linter:** **ESLint** (`@angular-eslint`).

### 1.2 Padrões de Código e UI Declarativa
- **Sintaxe de Controle de Fluxo:** Uso obrigatório de `@if`, `@switch` e `@for` com a diretiva de rastreamento `track` obrigatória (ex.: `@for (ride of rides(); track ride.id)`). Proibido o uso de `*ngIf` e `*ngFor`.
- **Carregamento Otimizado (@defer):** Aplicação de `@defer (on viewport / on interaction)` para carregar componentes sob demanda (ex.: modal de detalhes da oferta, formulário de avaliação e painel de moderação).
- **Comunicação Hierárquica:** Uso estrito das funções funcionais `input()`, `input.required()` e `output()` para comunicação tipada entre componentes pai e filho (sem decorators `@Input`/`@Output`).
- **Two-Way Data Binding:** Uso da função reativa `model()` para sincronização bidirecional de componentes de formulário/controles.
- **Injeção de Dependências:** Uso exclusivo da função `inject(ServiceName)` diretamente na inicialização de campos da classe (sem injeção via construtor).
- **Pipes:** Uso de pipes para formatação de dados monetários (`currencyBrl`), datas relativas e status de carona.

---

## 🗄️ 2. Persistência de Dados e Integrações por Fase (IDs 20 a 23, 25)

A persistência do UTFRide evolui em duas fases bem demarcadas:

### 2.1 Fase MVP e Decisão de Integração REST — `json-server` → Supabase (`/rest/v1/...`)
- **Fase transitória (MVP / Atividade 14):** o cadastro e o login usaram o **Supabase Auth** (`@supabase/supabase-js`), enquanto as coleções de domínio (`users`, `rides`, `ride_requests`, `notifications`) permaneceram temporariamente no `json-server` (`apps/api/db.json` na porta `3000`).
- **Decisão arquitetural da Entrega 3 (Atividade 15):** os Services de dados (`AuthData`, `RideData`, `RideRequestData`, `NotificationData`) falam com o PostgreSQL do Supabase pelo **`HttpClient` do Angular direto na API REST (`/rest/v1/…`)**. A biblioteca `@supabase/supabase-js` continua cuidando **exclusivamente do login, cadastro e sessão** (`signUp`, `signInWithPassword`, `signOut`, `getSession`). Fazendo assim, **toda requisição de dados passa obrigatoriamente pelos interceptors funcionais** (`authInterceptor` na ida, injetando `apikey` e `Authorization: Bearer <token>`, e `errorInterceptor` na volta, tratando `401` e falhas de servidor).
- **Consultas com projeção e validação de privacidade:**
  - Verificação de duplicidade de e-mail ou matrícula antes do login: função RPC no PostgreSQL (`check_registration_exists`) retornando apenas booleano, sem expor a tabela `users` a visitantes anônimos.
  - Resumo público de motorista (`get_driver_summaries`): função RPC retornando apenas `id`, `name` e `rating_average` para usuários autenticados.
  - Resumo de viagens do passageiro (`get_passenger_trip_summaries`): função RPC filtrada por `auth.uid()` que inclui o `whatsapp` do motorista **somente** quando a solicitação está `accepted` e a carona está `active` ou `full`.

### 2.2 Fase Completa (Entrega 3) — Backend-as-a-Service (**Supabase**)
- **Banco de Dados:** PostgreSQL hospedado no Supabase (`supabase/schema.sql`).
- **Autenticação:** Supabase Auth (`@supabase/supabase-js`) com gerenciamento de sessão via tokens **JWT** e validação de domínio institucional `@alunos.utfpr.edu.br`.
- **Segurança:** Políticas de **Row Level Security (RLS)** habilitadas em todas as tabelas, protegendo dados privados e restringindo alterações aos respectivos donos dos registros.
- **Cliente de Dados:** Angular `HttpClient` consumindo `${supabaseUrl}/rest/v1/...` dentro dos Services de `core/services/`, com `@supabase/supabase-js` encapsulado em `SupabaseClientService` apenas para identidade/sessão.

### 2.3 Regra Fundamental da Camada de Dados
> **Componente nunca fala com a rede ou com o banco.**  
> Todo acesso a dados passa exclusivamente por Services dedicados localizados em `apps/web/src/app/core/services/`. A migração do `json-server` para o **Supabase** na Entrega 3 ocorre **estritamente dentro dos Services**, mantendo os componentes de tela e templates completamente inalterados.

### 2.4 Interceptors e Reatividade Assíncrona
- **Functional Interceptors:**
  - `authInterceptor`: Identifica requisições destinadas ao `environment.supabaseUrl`, injeta o cabeçalho `apikey` (`supabasePublishableKey`) e, quando há sessão ativa em `AuthData`, injeta `Authorization: Bearer <token>`. Requisições a serviços externos (como a API do IBGE em `LocationData`) **não** recebem `apikey` nem `Authorization`.
  - `errorInterceptor`: Trata globalmente erros `401` (encerra a sessão no `AuthData` e redireciona para `/login`), `403` (acesso proibido), `500` e servidor fora do ar / falha de rede (`status === 0`, exibindo mensagem amigável no `ErrorNotice`), respeitando os tokens de contexto `SKIP_GLOBAL_ERROR_HANDLING` e `HANDLE_SESSION_EXPIRATION_ONLY`.
- **Ponte RxJS ↔ Signals:** Conversão de chamadas assíncronas em Signals reativos nos Services através dos utilitários `toSignal()` e `toObservable()`.

### 2.5 Ambientes e Segredos (Supabase)
- **Projeto Supabase da equipe:** Projeto compartilhado pela organização da equipe na plataforma `supabase.com`, criado na região **São Paulo**, com referência `qeoenmfkfrhabznkekjp` (`https://qeoenmfkfrhabznkekjp.supabase.co`).
- **Configuração no Painel (Desenvolvimento):** `Site URL` configurada para `http://localhost:4200` em *Authentication → URL Configuration*, e confirmação automática de e-mail (*Confirm email*) desabilitada durante o desenvolvimento no plano gratuito.
- **Arquivos de Ambiente (`apps/web/src/environments/`):**
  - `environment.ts` (produção) e `environment.development.ts` (desenvolvimento local), expondo apenas `supabaseUrl` e `supabasePublishableKey` (`apiUrl` e o servidor local `json-server` foram removidos na Entrega 3).
- **Política de Chaves (Pública vs. Secreta):**
  - **Chave Publicável (`sb_publishable_...`):** **pode** ser versionada no Git dentro de `environments/` e enviada no código cliente (`createClient(supabaseUrl, supabasePublishableKey)`), pois identifica apenas o projeto na borda pública; a proteção real dos dados é garantida pelo JWT do usuário autenticado e pelas políticas de **Row Level Security (RLS)** no servidor.
  - **Chave Secreta (`sb_secret_...` / `service_role`):** **nunca** deve ser colocada no código frontend, nos arquivos `environments/` ou em qualquer commit do repositório, pois contorna o RLS e concede acesso administrativo irrestrito ao projeto.
- **Isolamento em Testes Automatizados:** os testes unitários (Vitest) **nunca** executam chamadas reais ao Supabase; o cliente `@supabase/supabase-js` é encapsulado em `core/services/` e substituído por dublês/mocks em memória nos testes.

### 2.6 Resiliência Offline e Cache Local (US07 / RNF02)
- **Monitoramento de Rede (`NetworkStatus`):** serviço singleton em `core/services/network-status.ts` que expõe os signals reativos `isOnline` e `isOffline` (sincronizados com `navigator.onLine` e os eventos `online`/`offline` do navegador) e a constante `OFFLINE_ACTION_MESSAGE`. O componente raiz (`App`) exibe o banner global persistente no topo enquanto `isOffline()` estiver ativo.
- **Cache Local Isolado por Usuário (`OfflineCache`):** serviço singleton em `core/services/offline-cache.ts` sobre `localStorage`, com chaves globais (`utfride:offline:...`) e escopo por usuário (`utfride:offline:user:<userId>:...`). Permite que `AuthData`, `LocationData`, `RideData` (inclusive `rideDetailResolver`), `RideRequestData` e `NotificationData` sirvam os últimos dados salvos em modo somente leitura sem vazar dados entre sessões ou após logout (`clearUser` / `clearAllUsers`).
- **Bloqueio de Operações Remotas e Isolamento de Camadas:** quando offline, os Services impedem chamadas HTTP remotas de leitura externa/escrita e as telas autenticadas/públicas desabilitam ações dependentes de servidor com explicação clara, reabilitando-as automaticamente ao retornar ao estado online. Componentes reutilizáveis em `shared/` (como `NotificationBell`) recebem o estado offline por `input()`, preservando a regra de não importar de `core/`.

---

## 🛣️ 3. Roteamento, Navegação e Proteção de Rotas (IDs 16 a 19)

### 3.1 Configuração de Rotas
- Roteamento configurado funcionalmente via `provideRouter(routes, withComponentInputBinding())`.
- **Vinculação Automática de Parâmetros:** Parâmetros de rota (ex.: `:id`) e query params são consumidos diretamente nos componentes de página via `id = input.required<string>()`.

### 3.2 Mapa de Rotas e Lazy Loading
Todas as rotas de funcionalidades utilizam carregamento sob demanda (`loadComponent` ou `loadChildren`):

| Rota | Componente / Feature | Acesso | Descrição |
| :--- | :--- | :--- | :--- |
| `/` | `LandingComponent` | Público (Visitante) | Apresentação institucional do UTFRide |
| `/login` | `LoginComponent` | Público | Autenticação de aluno/suporte |
| `/register` | `RegisterComponent` | Público | Cadastro com e-mail institucional |
| `/rides` | `RidesLayout` → `RideList` | Autenticado | Busca reativa de ofertas de carona e sugestões de municípios do IBGE |
| `/rides/my-trips` | `RidesLayout` → `MyTrips` | Autenticado | Solicitações do passageiro, contato nas confirmadas e cancelamento das pendentes |
| `/rides/:id` | `RidesLayout` → `RideDetail` | Autenticado (`rideDetailResolver`) | Dados da oferta pré-carregados pelo `rideDetailResolver` (`initialDetail` via `withComponentInputBinding()`) e painel de confirmação de vaga carregado sob demanda |
| `/driver/offer` | `OfferRideComponent` | Autenticado (Motorista) | Formulário de publicação e edição de oferta de carona (`?rideId=`) |
| `/driver/my-rides`| `MyRidesComponent` | Autenticado (Motorista) | Gestão de ofertas (edição, cancelamento e exclusão `DELETE` de ofertas canceladas) e solicitações de passageiros |
| `/searches` | `RideSearchesComponent`| Autenticado (Passageiro) | Mural de pedidos ativos de carona *(US04)* |
| `/reviews/history`| `ReviewHistoryComponent`| Autenticado | Histórico de viagens e formulário de avaliação *(US05)* |
| `/support` | `SupportDashboardComponent`| Restrito (`support`) | Moderação de denúncias e suspensão de contas *(US06)* |
| `**` | `NotFound` | Público (sem `authGuard`) | Rota curinga de erro `404` carregada sob demanda para endereços desconhecidos, com retorno seguro para `/rides` (autenticado) ou `/` (visitante) |

`RidesLayout` mantém o cabeçalho e a navegação inferior. O `router-outlet` exibe a rota filha. O `authGuard` protege a entrada e a ativação das filhas. `my-trips` é declarada antes de `:id` para que o endereço fixo seja resolvido primeiro, e `**` é declarada por último para capturar apenas rotas desconhecidas.

```mermaid
flowchart TD
    Layout["/rides · RidesLayout"] --> Outlet["router-outlet"]
    Outlet --> List["/rides · RideList"]
    Outlet --> Trips["/rides/my-trips · MyTrips"]
    Outlet -->|"rideDetailResolver (initialDetail)"| Detail["/rides/:id · RideDetail"]
    Detail -->|Solicitar vaga| Confirm["RideRequestConfirmPanel · @defer"]
    Wildcard["** · Rota inexistente"] --> NotFound["NotFound (404)"]
```

### 3.3 Functional Guards e Resolvers
- `authGuard`: Impede que visitantes não autenticados acessem rotas protegidas (redireciona para `/login`).
- `supportGuard`: Restringe o acesso ao painel `/support` exclusivamente para usuários com `role === 'support'`.
- `rideDetailResolver` (`apps/web/src/app/core/resolvers/ride-detail-resolver.ts`): `ResolveFn<RideDetailResult>` funcional que injeta `RideData` e pré-carrega a oferta e o resumo do motorista em `/rides/:id` antes da ativação de `RideDetail`, entregando `initialDetail` via `withComponentInputBinding()` e preservando os estados `not-found` e `error`.

---

## 📂 4. Estrutura de Pastas e Regras de Dependência (IDs 4, 15, 18)

### 4.1 Árvore do Monorepo
```text
UTFRide/
├── apps/
│   └── web/                     # Frontend Angular 22 Standalone
│       ├── public/              # Assets estáticos, manifest.webmanifest e ícones PWA
│       └── src/
│           ├── app/
│           │   ├── core/        # Singleton: Services de dados, Guards, Resolvers, Interceptors, Models
│           │   │   ├── guards/
│           │   │   ├── interceptors/
│           │   │   ├── models/
│           │   │   ├── resolvers/
│           │   │   └── services/
│           │   ├── shared/      # UI Reutilizável: Componentes burros, Pipes, Diretivas
│           │   │   ├── components/
│           │   │   ├── pipes/
│           │   │   └── ui/
│           │   ├── features/    # Módulos por domínio de negócio (Rotas Lazy)
│           │   │   ├── auth/
│           │   │   ├── rides/
│           │   │   │   ├── rides-layout/
│           │   │   │   ├── ride-list/
│           │   │   │   ├── ride-filters/
│           │   │   │   ├── ride-detail/
│           │   │   │   │   └── ride-request-confirm-panel/
│           │   │   │   └── my-trips/
│           │   │   ├── driver/
│           │   │   ├── not-found/
│           │   │   ├── searches/
│           │   │   ├── reviews/
│           │   │   └── support/
│           │   ├── app.config.ts # Provedores funcionais (provideRouter, provideHttpClient)
│           │   ├── app.routes.ts # Definição central de rotas com lazy loading e rota curinga **
│           │   ├── app.ts        # Componente raiz (nomes padrão do Angular CLI atual)
│           │   ├── app.html      # Template do componente raiz
│           │   └── app.css       # Estilos do componente raiz
│           ├── environments/     # Configurações de ambiente (environment.ts / development)
│           ├── index.html
│           ├── main.ts
│           └── styles.css       # Configurações do Tailwind CSS e Design Tokens
├── docs/                        # Documentação técnica e governança da Fase 0
│   ├── prd.md
│   ├── design-tokens.md
│   ├── architecture.md
│   └── checklist.md
├── supabase/
│   └── schema.sql               # DDL, índices, RLS e RPCs aplicadas no Supabase
└── package.json                 # Scripts raiz unificados
```

### 4.2 Regras Estritas de Dependência
1. `features/` pode importar de `core/` e de `shared/`.
2. `shared/` **nunca** importa de `features/` nem de `core/` (componentes puramente reutilizáveis).
3. `core/` **nunca** importa de `features/` nem de `shared/`.
4. Features **nunca** importam diretamente código de outras features (comunicação via serviços do `core/` ou via navegação de rotas).

---

## 📖 5. Glossário Técnico e Modelo de Domínio (PT → EN)

Para garantir consistência e evitar ambiguidades conceituais, todos os termos ubíquos definidos no [`docs/prd.md`] possuem correspondência direta no código (as colunas de dono no banco e as regras RLS por linha estão detalhadas na **§6**):

| Termo PRD (PT) | Equivalente Técnico (EN) | Natureza no Código | Atributos e Tipos TypeScript / Detalhes |
| :--- | :--- | :--- | :--- |
| **Aluno** | `User` (`role: 'student'`) | Entidade / Modelo | `id: string`<br>`name: string`<br>`email: string`<br>`registrationNumber: string`<br>`role: 'student' \| 'support'`<br>`isBlocked: boolean`<br>`ratingAverage: number`<br>`createdAt: string` |
| **Motorista** | `driverId` | Papel contextual do `User` | Identificador do aluno autor de uma oferta (`driverId: string` em `Ride`) |
| **Passageiro** | `passengerId` | Papel contextual do `User` | Identificador do aluno solicitante (`passengerId: string` em `RideRequest` e `RideSearch`) |
| **Oferta de Carona** / **Carona** | `Ride` | Entidade / Ciclo de vida | `id: string`<br>`driverId: string`<br>`origin: string`<br>`destination: string`<br>`departureTime: string`<br>`availableSeats: number`<br>`totalSeats: number`<br>`pricePerSeat: number`<br>`status: 'active' \| 'full' \| 'completed' \| 'cancelled'`<br>`notes?: string`<br>`createdAt: string`<br>*Nota: "Oferta de Carona" (anúncio aberto com vagas) evolui para "Carona" (viagem confirmada) através da máquina de estados do atributo `status`.* |
| **Vaga** | `availableSeats` / `totalSeats` | Atributos de capacidade | Controlam assentos individuais disponíveis e totais no objeto `Ride` |
| **Solicitação de Carona** | `RideRequest` | Entidade | `id: string`<br>`rideId: string`<br>`passengerId: string`<br>`status: 'pending' \| 'accepted' \| 'rejected' \| 'cancelled'`<br>`createdAt: string` |
| **Busca de Carona** | `RideSearch` | Entidade | `id: string`<br>`passengerId: string`<br>`origin: string`<br>`destination: string`<br>`desiredTime: string`<br>`status: 'active' \| 'fulfilled' \| 'cancelled'`<br>`contactInfo: string`<br>`createdAt: string` |
| **Feedback** | `Review` | Entidade | `id: string`<br>`rideId: string`<br>`reviewerId: string`<br>`reviewedId: string`<br>`rating: number` *(1 a 5)*<br>`comment?: string`<br>`createdAt: string` |
| **Denúncia** | `Report` | Entidade | `id: string`<br>`reporterId: string`<br>`reportedUserId: string`<br>`rideId?: string`<br>`reason: string`<br>`status: 'pending' \| 'resolved' \| 'dismissed'`<br>`resolutionNotes?: string`<br>`createdAt: string` |
| **Aviso interno** | `Notification` | Entidade | `id: string`<br>`recipientId: string`<br>`rideId: string`<br>`message: string`<br>`createdAt: string` |
| **Suporte** | `role: 'support'` | Perfil / Permissão | Representado pelo valor de `role` no `User`, protegido por `supportGuard` na rota `/support` |

---

## 📊 6. Diagrama Entidade-Relacionamento (Mermaid), Donos e Regras RLS

As **4 tabelas ativas** implementadas no Supabase (`supabase/schema.sql`) nesta fase são `users`, `rides`, `ride_requests` e `notifications`. As demais tabelas do domínio (`ride_searches`, `reviews`, `reports`) permanecem mapeadas no diagrama ER para as próximas User Stories (US04, US05 e US06), quando serão criadas com suas respectivas políticas RLS.

> **Mapeamento `snake_case` ↔ `camelCase`:** no PostgreSQL, todas as tabelas e colunas utilizam `snake_case`. Os Services (`core/services/`) convertem entre os registros do banco e os models `camelCase` do Angular, preservando os componentes inalterados. A senha do usuário é gerenciada exclusivamente pelo `auth.users` do Supabase Auth e **não** é armazenada na tabela `users`.

```mermaid
erDiagram
    USERS ||--o{ RIDES : "publishes as driver"
    USERS ||--o{ RIDE_REQUESTS : "submits as passenger"
    USERS ||--o{ RIDE_SEARCHES : "posts as passenger"
    USERS ||--o{ REVIEWS : "writes or receives"
    USERS ||--o{ REPORTS : "files or is reported"
    USERS ||--o{ NOTIFICATIONS : "receives"
    
    RIDES ||--o{ RIDE_REQUESTS : "receives"
    RIDES ||--o{ REVIEWS : "evaluated in"
    RIDES ||--o{ REPORTS : "associated with"
    RIDES ||--o{ NOTIFICATIONS : "generates on cancellation"

    USERS {
        uuid id PK "Dono - auth.uid"
        text name
        text email
        text registration_number
        text whatsapp
        boolean is_email_confirmed
        text role
        boolean is_blocked
        numeric rating_average
        timestamptz created_at
    }

    RIDES {
        uuid id PK
        uuid driver_id FK "Dono - auth.uid"
        text origin
        text destination
        timestamptz departure_time
        integer available_seats
        integer total_seats
        numeric price_per_seat
        text status
        text notes
        timestamptz created_at
    }

    RIDE_REQUESTS {
        uuid id PK
        uuid ride_id FK
        uuid passenger_id FK "Dono - auth.uid"
        text status
        timestamptz created_at
    }

    NOTIFICATIONS {
        uuid id PK
        uuid recipient_id FK "Dono - auth.uid"
        uuid ride_id FK
        text message
        timestamptz created_at
    }

    RIDE_SEARCHES {
        uuid id PK
        uuid passenger_id FK "Dono - US04 futura"
        text origin
        text destination
        timestamptz desired_time
        text status
        text contact_info
        timestamptz created_at
    }

    REVIEWS {
        uuid id PK
        uuid ride_id FK
        uuid reviewer_id FK "Dono - US05 futura"
        uuid reviewed_id FK
        integer rating
        text comment
        timestamptz created_at
    }

    REPORTS {
        uuid id PK
        uuid reporter_id FK "Dono - US06 futura"
        uuid reported_user_id FK
        uuid ride_id FK
        text reason
        text status
        text resolution_notes
        timestamptz created_at
    }
```

### 6.1 Coluna de Dono e Regras por Linha (RLS) em Português

Todas as tabelas nascem com **Row Level Security (RLS) ativado** (`ENABLE ROW LEVEL SECURITY`). Visitantes sem login não leem nem alteram nenhuma linha de nenhuma tabela.

| Tabela | Coluna de dono | Regras de acesso por operação (decisão da equipe) |
| :--- | :--- | :--- |
| **`users`** | `id` (`= auth.uid()`) | **Leitura (`SELECT`):** apenas o próprio aluno vê sua linha completa (protegendo `email`, matrícula e `whatsapp` contra leitura aberta por terceiros). Dados públicos mínimos do motorista (`id`, `name`, `rating_average`) e o `whatsapp` liberado após aceite são servidos por *views*/consultas seguras.<br>**Criação (`INSERT`):** apenas o próprio usuário autenticado (`id = auth.uid()`) pode criar seu perfil, obrigatoriamente com `role = 'student'` e `is_blocked = false`.<br>**Edição (`UPDATE`):** apenas o próprio usuário altera seus dados cadastrais, sem poder alterar `role` nem `is_blocked`.<br>**Exclusão (`DELETE`):** bloqueada pelo aplicativo. |
| **`rides`** | `driver_id` (`= auth.uid()`) | **Leitura (`SELECT`):** qualquer pessoa autenticada pode consultar as caronas (visitantes sem login não veem nada).<br>**Criação (`INSERT`):** apenas alunos autenticados, não bloqueados e com `role <> 'support'` podem publicar uma oferta, e sempre com `driver_id = auth.uid()`.<br>**Edição (`UPDATE`):** apenas o motorista dono da carona (`driver_id = auth.uid()`) pode editar dados, ocupar vaga ou cancelar.<br>**Exclusão (`DELETE`):** apenas o motorista dono (`driver_id = auth.uid()`) pode apagar a própria carona. |
| **`ride_requests`** | `passenger_id` (`= auth.uid()`) | **Leitura (`SELECT`):** o passageiro dono da solicitação (`passenger_id = auth.uid()`) **ou** o motorista dono da carona vinculada (`rides.driver_id = auth.uid()`).<br>**Criação (`INSERT`):** apenas o passageiro autenticado e não bloqueado (`passenger_id = auth.uid()`), desde que não seja o motorista da própria carona e que a carona não seja duplicada em estado ativo (`pending` ou `accepted`).<br>**Edição (`UPDATE`):** o passageiro dono pode cancelar a própria solicitação enquanto ela estiver `pending`; o motorista dono da carona vinculada pode aceitar, rejeitar ou cancelar solicitações recebidas.<br>**Exclusão (`DELETE`):** apenas o passageiro dono (`passenger_id = auth.uid()`). |
| **`notifications`** | `recipient_id` (`= auth.uid()`) | **Leitura (`SELECT`):** apenas o destinatário da notificação (`recipient_id = auth.uid()`).<br>**Criação (`INSERT`):** apenas o motorista dono da carona referenciada (`rides.driver_id = auth.uid()`) pode criar avisos de cancelamento para os passageiros daquela viagem.<br>**Edição (`UPDATE`) e Exclusão (`DELETE`):** apenas o próprio destinatário (`recipient_id = auth.uid()`). |

> **Consultas auxiliares seguras (substituindo rotas customizadas do antigo `json-server`):**
> - `check_registration_exists(p_email, p_registration_number)` (função RPC `SECURITY DEFINER`): permite validar antes do `signUp` se o e-mail ou matrícula já existem em `users`, retornando apenas `boolean` sem expor dados pessoais a visitantes anônimos.
> - `get_driver_summaries(p_driver_ids)` (função RPC `SECURITY DEFINER` com exigência de `auth.uid() IS NOT NULL`): expõe apenas `id`, `name` e `rating_average` de motoristas para usuários autenticados.
> - `get_passenger_trip_summaries()` (função RPC `SECURITY DEFINER` filtrada por `auth.uid()`): retorna as viagens do passageiro autenticado e só inclui o `whatsapp` do motorista quando `ride_requests.status = 'accepted'` e `rides.status IN ('active', 'full')`.

---

## 📋 7. Formulários e Validações (ID 24)

- **Abordagem:** **Formulários Reativos (`ReactiveFormsModule`)**.
- **Regras de Validação:**
  - `RegisterForm`: Validação estrita de e-mail institucional terminando em `@alunos.utfpr.edu.br`, matrícula preenchida, senha com mínimo de 6 caracteres.
  - `OfferRideForm`: Origem e destino obrigatórios, data/horário obrigatoriamente futuros em relação ao momento atual, vagas entre 1 e 4, valor maior ou igual a 0.
  - `RideSearchForm`: Origem, destino e data/hora futuros obrigatórios, telefone/WhatsApp de contato.
  - `ReportForm`: Motivo com mínimo de 15 caracteres.
- **Comportamento Visual:** Mensagens de erro contextuais e botão de submit com estado `[disabled]="form.invalid || loading()"`.

---

## 🧪 8. Testes Automatizados, Linters e Comandos de Execução (IDs 28, 33)

Todos os comandos são padronizados e executados a partir da raiz do monorepo:

| Comando | Descrição da Ação |
| :--- | :--- |
| `npm run dev` / `npm start` | Inicia o servidor frontend Angular local (`http://localhost:4200`) |
| `npm test` | Executa os testes de layout (`layout.spec.mjs`) e a suíte **Vitest** pelo Angular CLI (`ng test --watch=false` no workspace `apps/web`) |
| `npm run lint` | Executa a validação estática de código com **ESLint** |
| `npm run build` | Gera o build de produção otimizado em `apps/web/dist` |

---

## 🚀 9. Gitflow e Deploy Contínuo (IDs 26 a 28)

- **Estratégia de Branching:** Gitflow estrito.
  - `main`: Reflete o ambiente de produção.
  - `develop`: Integração contínua da equipe.
  - `feature/<numero-da-issue>-<slug>`: Ramos de histórias gerados a partir da `develop`.
  - `chore/<slug>`: Tarefas de manutenção e infraestrutura.
- **Deploy de Produção:** Deploy automatizado na **Vercel** ou **Render** conectado à branch `main`.

---

## 🔍 10. Garantia do Setup (Quatro Declarações Obrigatórias do Passo 0)

1. **Framework do Frontend:** Angular 22 Standalone, Signals, Tailwind CSS, sintaxe de templates moderna.
2. **Fonte de Dados:** **Supabase** (PostgreSQL + RLS + PostgREST + JWT Auth em `supabase/schema.sql`, consumido via `HttpClient` e `@supabase/supabase-js`).
3. **Estrutura de Pastas:** Monorepo com `apps/web` (Angular), `supabase/` (`schema.sql`) e separação `core/`, `shared/` e `features/`.
4. **Comandos de Teste e Lint:** `npm test` (Vitest) e `npm run lint` (ESLint) a partir da raiz.
