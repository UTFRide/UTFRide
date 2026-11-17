# Parecer de Código — Tarefa 6

**Veredito:** APROVADO

Verificações executadas (Rodada 2):
- `git diff e8f34d47642cfe1348274df352321ffdcb37e82c -- apps/web` inspecionado na íntegra (16 arquivos modificados/criados em `core/`, `shared/` e `features/`).
- Conferência dos 2 apontamentos aceitos na triagem (`specs/5-publicacao-gestao-oferta-carona/reviews/tarefa-06-decisoes-r1.md`):
  1. **Falhas ao carregar avisos internos:** corrigido adequadamente em `apps/web/src/app/core/services/notification-data.ts:31,35,49-106,142-152`, `apps/web/src/app/shared/components/notification-bell/notification-bell.ts:19`, `apps/web/src/app/shared/components/notification-bell/notification-bell.html:46-54` e integrado nas telas `RideList` (`ride-list.ts:18`, `ride-list.html:11`), `OfferRide` (`offer-ride.ts:83`, `offer-ride.html:12`) e `MyRides` (`my-rides.ts:41`, `my-rides.html:14`). `NotificationData` agora limpa avisos antigos e `ErrorNotice.message` ao iniciar o carregamento, propaga erro de rede (`status === 0`) e falha inesperada não-HTTP para `ErrorNotice` (preservando a política do `errorInterceptor` para HTTP 4xx/5xx), isola `loadError` por `lastLoadUserId` para não vazar erro entre sessões e exibe alerta acessível (`role="alert"`) no painel em vez de estado vazio falso.
  2. **Duplicação de regra de formatação de iniciais:** corrigido adequadamente com a remoção de `formatUserInitials` de `notification-bell.ts` e de `formatPassengerInitials` de `ride-request-card.ts` (e `passengerInitials` de `my-rides.ts`), centralizando a regra em `apps/web/src/app/shared/pipes/initials-pipe.ts:1-22` (`InitialsPipe`, coberto em `initials-pipe.spec.ts`) e reutilizando o pipe em `ride-list.html:20`, `offer-ride.html:21`, `my-rides.html:23,108,163` e `ride-request-card.html:5`.
- Conformidade com `docs/architecture.md`, `.agents/rules/01-angular-strict-rules.md` e `docs/design-tokens.md`: arquitetura standalone sem `standalone: true`, control flow (`@if`/`@else`/`@for` com `track`), `inject()`, Signals (`signal()`, `computed()`, `input()`, `output()`, `viewChild()`, `toSignal()`), sem `any`, sem CSS por componente, tokens semânticos válidos e respeito estrito às regras de dependência entre `core/`, `shared/` e `features/`.
- `npm test`: `apps/web/src/app/features/auth/layout.spec.mjs` (2/2) e Vitest (15 arquivos, 72/72 testes) passaram sem regressões.
- `npm run lint`: `All files pass linting.`

## Apontamentos (bloqueiam)
Nenhum.

## Sugestões (não bloqueiam)
- **Estreitar `NotificationItem` em `shared/`** — `apps/web/src/app/shared/components/notification-bell/notification-bell.ts:3-9` e `notification-bell.html:64-78`: `NotificationItem` replica `recipientId`, `rideId` e `createdAt`, que não são renderizados no template. Reduzir a interface a `{ id: string; message: string }` (ou exibir `createdAt` formatado) evita campos ociosos no componente visual.
- **Correspondência por `user.name` em `NotificationData.isRecipient`** — `apps/web/src/app/core/services/notification-data.ts:154-160`: aceitar `recipient === user.name.trim()` acomoda os dados de exemplo pré-US03, mas pode colidir entre homônimos quando a US03 persistir IDs reais em `RideRequest.passengerId`; vale restringir exclusivamente a `user.id` nessa etapa.
- **Estado de carregamento, fechamento externo, responsividade e limpeza no logout** — `apps/web/src/app/core/services/notification-data.ts:82-106` e `apps/web/src/app/shared/components/notification-bell/notification-bell.html:31,55-61`: enquanto `GET /notifications` está em voo após limpar `notificationsState`, o painel exibe momentaneamente `"Você não possui avisos no momento."`; o dropdown com `w-80 max-w-xs` ancorado em `right-0` à esquerda do avatar pode extrapolar a borda esquerda em telas muito estreitas (~320px) e não fecha ao clicar fora; além disso, se o mesmo usuário fizer logout e entrar novamente sem reabrir o sino, `lastLoadUserId` só é renovado ao chamar `loadForCurrentUser()` ou `reset()`.
- **Reuso de `mapError` no `core/`** — `apps/web/src/app/core/services/notification-data.ts:142-152`: `mapLoadError` repete a classificação de `HttpErrorResponse` (`status === 0` vs erro não-HTTP) de `RideData.mapError` e `RideRequestData.mapError`; vale extrair um helper compartilhado em `core/services/`.

## Observações fora do escopo deste diff
- `docs/architecture.md` (seções 2.1, 5 e 6) ainda não lista a coleção/entidade `notifications` (introduzida na Tarefa 5 conforme `plan.md`).
- `RideList`, `OfferRide` e `MyRides` repetem a estrutura de `<header>` e `<nav>` inferior; a extração geral de cabeçalhos e navegação foi mantida fora de escopo em `spec.md`, ficando como candidata a Issue de manutenção futura.
- `apps/web/src/app/core/services/ride-data.ts:322-332` e `apps/web/src/app/core/services/ride-request-data.ts:291-301` mantêm a duplicação pré-existente de `mapError`.
