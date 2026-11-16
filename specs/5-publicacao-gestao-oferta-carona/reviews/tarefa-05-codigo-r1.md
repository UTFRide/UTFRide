# Parecer de Código — Tarefa 5

**Veredito:** APROVADO

Verificações executadas:
- `git diff fd88846b12ba405a3f6c6e78225404de666aac5f` inspecionado na íntegra (`apps/api/db.json`, `notification.model.ts`, `notification-data*`, `ride-data*`, `ride-request-data*`, `my-rides*`).
- `npm test`: `apps/web/src/app/features/auth/layout.spec.mjs` (2/2) e Vitest (12 arquivos, 59/59 testes) passaram.
- `npm run lint`: todos os arquivos passaram no ESLint (`All files pass linting.`).

Aderência arquitetural:
- Separação de camadas respeitada (`MyRides` não acessa `HttpClient` diretamente e delega o fluxo para `RideRequestData`, `RideData` e `NotificationData` em `core/services/`).
- Padrões Angular 22 e regras estritas atendidos: componentes standalone sem `standalone: true`, `@if`/`@else if`/`@else`/`@for`, `inject()`, `signal()`, `computed()`, `effect()`, `viewChild()`, `toSignal()`, tipagem estrita sem `any` e uso exclusivo dos tokens semânticos de `docs/design-tokens.md` / `apps/web/src/styles.css`.
- Nenhuma URL ou credencial chumbada no código (`environment.apiUrl` utilizado em todas as chamadas).
- Tratamento de erro preserva propagação via `catchError` + `mapError` + `errorInterceptor` / `ErrorNotice`, e os testes cobrem comportamento observável sem acoplamento a detalhes internos.

## Apontamentos (bloqueiam)
Nenhum.

## Sugestões (não bloqueiam)
- **Acoplamento semântico e duplicação da regra de elegibilidade da oferta** — `apps/web/src/app/features/driver/my-rides/my-rides.ts:87-99` e `apps/web/src/app/core/services/ride-request-data.ts:97-105`: `MyRides` usa `rideData.canCancel(ride)` dentro de `canManageSelectedRide()` para controlar edição (`canEditSelectedRide`), rejeição (`rejectRequest`) e cancelamento, enquanto `RideRequestData.decisionResult` repete manualmente `ride.status === 'cancelled' || ride.status === 'completed' || new Date(ride.departureTime).getTime() <= Date.now()`. Se a janela ou critério específico de cancelamento divergir de edição/decisão no futuro, extrair um predicado dedicado em `RideData` (ex.: `canManageBeforeDeparture(ride)` reutilizado por `canCancel`, `decisionResult` e `updateResult`) evita regressões acidentais e elimina a duplicação.
- **Duplicação da regra de destinatários notificáveis** — `apps/web/src/app/features/driver/my-rides/my-rides.ts:61-67` e `apps/web/src/app/core/services/ride-request-data.ts:250-255`: `MyRides.notifiablePassengers` replica a extração de `passengerId` de pedidos aceitos e pendentes feita em `RideRequestData.cancelPendingAndNotify` (com uma diferença sutil de normalização: `NotificationData` aplica `.trim()` antes do `Set`, enquanto `MyRides` filtra `name.trim().length > 0` sem normalizar antes do `Set`). Centralizar essa derivação em um helper puro compartilhado no `core` garante consistência entre o texto do diálogo e os avisos gravados.
- **Visibilidade do alerta de erro durante o diálogo modal (relevante para Tarefa 8 / CA10)** — `apps/web/src/app/features/driver/my-rides/my-rides.html:267` e `apps/web/src/app/app.html:3-8`: quando o cancelamento falha, `handleCancelResult` mantém `cancelConfirming()` aberto para permitir nova tentativa, mas o overlay `fixed inset-0 z-50` do diálogo cobre o banner de erro global renderizado no topo de `app.html`. Exibir um feedback contextual dentro do próprio diálogo (ou ajustar a camada do alerta) na Tarefa 8 facilitará o retorno visual ao motorista em falhas de conexão.
- **Fechamento por clique no backdrop e método `NotificationData.reset()`** — `apps/web/src/app/features/driver/my-rides/my-rides.html:267` e `apps/web/src/app/core/services/notification-data.ts:43-45`: permitir fechar o bottom sheet ao clicar no backdrop (quando `!isCancelling()`) melhora a usabilidade em dispositivos móveis; já `NotificationData.reset()` ainda não tem chamadores nesta tarefa (deve ganhar uso na Tarefa 6).

## Observações fora do escopo deste diff
- `docs/architecture.md` (seções 2.1, 5 e 6) ainda não lista a coleção/entidade `notifications` (criada nesta tarefa conforme previsto no `specs/5-publicacao-gestao-oferta-carona/plan.md`).
- `apps/web/src/app/core/services/ride-data.ts:141-145` também contém a verificação inline de status e horário futuro em `updateResult`, candidata a compartilhar um predicado único em `RideData`.
- Controles de botão em `apps/web/src/app/features/driver/my-rides/my-rides.html` e `apps/web/src/app/features/driver/offer-ride/offer-ride.html` ainda não explicitam classes de anel de foco `focus-visible:ring-2` conforme a tabela de estados de botão de `docs/design-tokens.md`.
