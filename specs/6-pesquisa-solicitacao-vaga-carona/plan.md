# Plano — Issue #6

## Decisões técnicas

- **Roteamento aninhado e binding automático (ID16, ID17, ID18):** habilitar `withComponentInputBinding()` em `provideRouter(routes, withComponentInputBinding())` no `apps/web/src/app/app.config.ts`. Estruturar o grupo `/rides` em `app.routes.ts` protegido por `authGuard` com o componente de layout `RidesLayout` (`features/rides/rides-layout/`, contendo cabeçalho com sino de notificações e avatar, `<router-outlet />` e barra de navegação inferior com Buscar, Oferecer, Ofertas e Viagens) e `children`: `''` (`RideList`), `'my-trips'` (`MyTrips`) e `':id'` (`RideDetail`). Declarar `'my-trips'` antes de `':id'` para evitar colisão de rota. As telas de motorista (`/driver/offer` e `/driver/my-rides`) permanecem intactas conforme entregues na US02.
- **API pública de localidades (ID20):** criar `LocationData` em `core/services/location-data.ts` realizando `GET` assíncrono na API pública do IBGE (`https://servicodados.ibge.gov.br/api/v1/localidades/estados/PR/municipios?orderBy=nome`) e expondo sugestões ordenadas via `toSignal()`. Marcar a requisição com `HttpContextToken` de erro silencioso (tratado no `errorInterceptor`) para que falhas ou estado offline retornem `[]` sem exibir alerta global nem impedir digitação em texto livre.
- **Filtros bidirecionais e busca reativa (ID12, ID25):** criar componente filho `RideFilters` (`features/rides/ride-filters/`) usando `model<string>('')` para `origin`, `destination` e `date` sincronizados por `[(...)]` com `RideList`, recebendo as sugestões do IBGE via `input<string[]>([])`. No `RideData` (`core/services/ride-data.ts`), integrar os Signals de filtro ao `HttpClient` via `toObservable()` -> `debounceTime` -> `distinctUntilChanged` -> `switchMap` -> `toSignal()`, retornando apenas ofertas `active`, futuras, com `availableSeats > 0` e `driverId !== currentUser.id`, enriquecidas com dados públicos do motorista (`name`, `ratingAverage`) a partir da coleção `users` do `json-server`.
- **Detalhe da oferta, status condicional e confirmação sob demanda (ID6, ID9, ID17):** criar `RideDetail` (`features/rides/ride-detail/`) recebendo `id = input.required<string>()`, renderizando status da oferta e da solicitação com `@switch` (`@case` / `@default`) e carregando o componente filho `RideRequestConfirmPanel` sob demanda com `@defer (on interaction)` e `@placeholder`. Usar exclusivamente campos existentes em `docs/architecture.md` (`Ride`, `RideRequest`, `User`) e tokens de `docs/design-tokens.md`.
- **Fluxo completo de solicitações do passageiro (RN04, RN05, RN07, RN08):** substituir o `// TODO #6` em `RideRequestData` (`core/services/ride-request-data.ts`) pelo fluxo real de criação de solicitação (`POST /ride_requests` com `status: 'pending'`), revalidando na fonte de dados que a oferta continua `active`, futura e com `availableSeats > 0`, que o solicitante é aluno ativo (não bloqueado e não `support`), não é o próprio motorista e não possui solicitação `pending` ou `accepted` na mesma oferta (permitindo nova solicitação após `cancelled` ou `rejected`). Implementar carregamento das solicitações do passageiro com resumo da oferta/motorista (expondo `whatsapp` apenas quando `status === 'accepted'`) e cancelamento voluntário de solicitação `pending` (`PATCH /ride_requests/:id` com `{ status: 'cancelled' }`).
- **Contrato com a fonte de dados (MVP):** reutilizar as coleções `rides`, `ride_requests` e `users` já definidas em `apps/api/db.json` mantendo todo acesso HTTP isolado em `core/services/`, sem alterar componentes na futura migração para o Supabase (Entrega 3).

## Tarefas

- [x] **Tarefa 1 — Configurar roteamento aninhado (`RidesLayout`) e `withComponentInputBinding()`**
  - Cobre: CA1 (estrutura aninhada com `children` e `<router-outlet />`) e CA4 (habilitação de `withComponentInputBinding()`).
  - Teste primeiro: verificar que `appConfig` registra `withComponentInputBinding()`, que `/rides` renderiza `RidesLayout` com cabeçalho (sino de notificações à esquerda do avatar com iniciais), `<router-outlet />` e navegação inferior (Buscar, Oferecer, Ofertas, Viagens), que as rotas filhas `''`, `'my-trips'` e `':id'` resolvem sem colisão e sob `authGuard`, mantendo os testes de avisos internos da US02 íntegros.
  - Arquivos previstos: `apps/web/src/app/app.config.ts`, `apps/web/src/app/app.routes.ts`, `apps/web/src/app/features/rides/rides-layout/` e `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts`.

- [ ] **Tarefa 2 — Integrar API pública de localidades do IBGE com fallback silencioso**
  - Cobre: CA2.
  - Teste primeiro: verificar que `LocationData` consulta `GET` na API de Localidades do IBGE (municípios do PR) e expõe os nomes via `toSignal()`; simular erro de rede (status 0) e erro HTTP (500/404) e confirmar que o retorno degrada silenciosamente para lista vazia sem preencher `ErrorNotice`.
  - Arquivos previstos: `apps/web/src/app/core/services/location-data.ts`, `apps/web/src/app/core/services/location-data.spec.ts`, `apps/web/src/app/core/interceptors/error-interceptor.ts`, `apps/web/src/app/core/interceptors/error-interceptor.spec.ts`.

- [ ] **Tarefa 3 — Implementar busca reativa de ofertas e componente de filtros com `model()`**
  - Cobre: CA1, CA3 e CA11.
  - Teste primeiro: testar two-way data binding via `model()` (`[(origin)]`, `[(destination)]`, `[(date)]`) entre `RideFilters` e `RideList` com sugestões de localidades; testar pipeline `toObservable()` -> `debounceTime` -> `distinctUntilChanged` -> `switchMap` -> `toSignal()` em `RideData`, exibindo apenas ofertas `active`, futuras, com `availableSeats > 0` e `driverId !== currentUser.id`; testar estado vazio com ação de limpar filtros (CA3) e descarte dos filtros ao sair e retornar à tela (CA11).
  - Arquivos previstos: `apps/web/src/app/core/models/ride.model.ts`, `apps/web/src/app/core/services/ride-data.ts`, `apps/web/src/app/core/services/ride-data.spec.ts`, `apps/web/src/app/features/rides/ride-filters/` e `apps/web/src/app/features/rides/ride-list/`.

- [ ] **Tarefa 4 — Construir detalhe da oferta (`/rides/:id`) com `input.required()` e `@switch`**
  - Cobre: CA4.
  - Teste primeiro: verificar navegação de `/rides` para `/rides/:id` recebendo o parâmetro automaticamente em `id = input.required<string>()`, carregando oferta e dados públicos do motorista (nome, iniciais, nota média, trajeto, data/horário, `notes`, vagas e `pricePerSeat | currencyBrl`), e exibindo o estado condicional da oferta/solicitação com `@switch` (`@case` / `@default`).
  - Arquivos previstos: `apps/web/src/app/core/services/ride-data.ts`, `apps/web/src/app/core/services/ride-data.spec.ts`, `apps/web/src/app/features/rides/ride-detail/` e `apps/web/src/app/app.routes.ts`.

- [ ] **Tarefa 5 — Implementar solicitação de vaga com `@defer` e validações de negócio (RN04/RN05)**
  - Cobre: CA5, CA6, CA7 e CA11.
  - Teste primeiro: verificar carregamento sob demanda do painel de confirmação com `@defer (on interaction)` e `@placeholder`, e que desistir/sair sem confirmar não cria solicitação (CA11); verificar revalidação da oferta na fonte de dados e criação de solicitação `pending` atualizando a tela (CA5); verificar bloqueio para oferta lotada (`availableSeats <= 0` ou `full`, inclusive em esgotamento concorrente), cancelada, concluída ou passada (CA6); verificar bloqueio de duplicidade com `pending`/`accepted`, bloqueio de auto-solicitação pelo motorista e permissão de nova solicitação após `cancelled`/`rejected` (CA7). Remover o `// TODO #6` em `RideRequestData`.
  - Arquivos previstos: `apps/web/src/app/core/services/ride-request-data.ts`, `apps/web/src/app/core/services/ride-request-data.spec.ts` e `apps/web/src/app/features/rides/ride-detail/`.

- [ ] **Tarefa 6 — Bloquear operações de passageiro para usuário bloqueado e perfil suporte**
  - Cobre: CA8.
  - Teste primeiro: verificar no `RideRequestData` e na interface que usuários com `isBlocked: true` (RN07) ou `role: 'support'` (RN08) são impedidos de solicitar vaga ou cancelar solicitação, com mensagem clara de restrição e sem disparo de `POST`/`PATCH` na API.
  - Arquivos previstos: `apps/web/src/app/core/services/auth-data.ts`, `apps/web/src/app/core/services/ride-request-data.ts`, `apps/web/src/app/core/services/ride-request-data.spec.ts` e `apps/web/src/app/features/rides/ride-detail/`.

- [ ] **Tarefa 7 — Implementar Minhas Viagens (`/rides/my-trips`) e cancelamento voluntário**
  - Cobre: CA9.
  - Teste primeiro: verificar exibição em `/rides/my-trips` apenas das solicitações do passageiro autenticado organizadas em Pendentes, Confirmadas e Histórico/Encerradas (sem formulário de avaliação), com badges condicionais via `@switch`; verificar exibição do WhatsApp do motorista exclusivamente nas Confirmadas (`accepted`); verificar cancelamento voluntário de solicitação `pending` atualizando status para `cancelled` via `PATCH` sem alterar pedidos de outros passageiros.
  - Arquivos previstos: `apps/web/src/app/core/services/ride-request-data.ts`, `apps/web/src/app/core/services/ride-request-data.spec.ts`, `apps/web/src/app/features/rides/my-trips/` e `apps/web/src/app/app.routes.ts`.

- [ ] **Tarefa 8 — Tratar falhas de conexão e oferta inexistente (404) no fluxo do passageiro**
  - Cobre: CA10.
  - Teste primeiro: simular falha de conexão (status 0) e erro HTTP/404 ao carregar a busca `/rides`, o detalhe `/rides/:id` (inclusive `:id` inexistente), o envio da solicitação, o carregamento de `/rides/my-trips` e o cancelamento de solicitação pendente; verificar aviso claro, ausência de duplicidade e funcionamento das ações de tentar novamente ou retornar à busca.
  - Arquivos previstos: `apps/web/src/app/features/rides/ride-list/`, `apps/web/src/app/features/rides/ride-detail/`, `apps/web/src/app/features/rides/my-trips/` e serviços em `apps/web/src/app/core/services/`.

## Critérios sem tarefa
