# Parecer de Código — Tarefa 3

**Veredito:** APROVADO

## Apontamentos (bloqueiam)
Nenhum.

## Sugestões (não bloqueiam)
- **`apps/web/src/app/features/driver/offer-ride/offer-ride.ts:109-121`** — O query param `rideId` é lido apenas no construtor via `this.route.snapshot.queryParamMap.get('rideId')`, e a condição `if (initialEditing && (!routeRideId || initialEditing.id === routeRideId))` preserva `editingRide` mesmo sem `rideId` na URL. Caso o motorista esteja em `/driver/offer?rideId=...` e clique no item "Oferecer" (`/driver/offer`) da barra de navegação inferior, o Angular reutiliza a instância do componente e mantém o formulário em modo de edição. Reagir a mudanças de `queryParamMap` (via `toSignal(this.route.queryParamMap)`) limpando a edição quando `rideId` não estiver presente evita esse estado residual.
- **`apps/web/src/app/core/services/ride-data.ts:99-123` e `248-264`** — A validação `isValidDraft(draft)` adicionada para o fluxo de atualização (`updateResult`) também pode ser aplicada em `publishResult`, mantendo a mesma guarda de integridade nos dois fluxos de escrita do serviço.

## Observações fora do escopo deste diff
- **`apps/web/src/app/app.config.ts:12`** — `provideRouter(routes)` está configurado sem `withComponentInputBinding()`, previsto na seção 3.1 do `docs/architecture.md` para consumo de parâmetros de rota e query params diretamente via `input()`.
