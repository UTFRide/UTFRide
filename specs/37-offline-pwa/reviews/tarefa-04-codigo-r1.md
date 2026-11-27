# Parecer de Código — Tarefa 4

**Veredito:** APROVADO

## Apontamentos (bloqueiam)
Nenhum.

As alterações em `NotificationData`, `RideRequestData` e suas suítes de teste seguem integralmente o `docs/architecture.md` e `.agents/rules/01-angular-strict-rules.md`:
- **Camadas e dependências:** toda persistência em cache (`OfflineCache`), bloqueio offline (`NetworkStatus`) e comunicação REST/RPC com Supabase permanece encapsulada nos Services de `apps/web/src/app/core/services/`, sem acoplamento com `shared/` ou `features/`.
- **Padrões Angular e TypeScript:** injeção via `inject()`, estado reativo com `signal()`, `computed()` e `toSignal()`/`toObservable()`, tipagem estrita sem `any` (validando leituras do cache com `unknown` + guards de array/objeto antes do uso).
- **Segurança, isolamento e tratamento de erros:** chaves privadas escopadas por `userId` (`utfride:offline:user:<id>:...`) limpas automaticamente no `logout()` / troca de conta pelo `AuthData`; falhas sem cache ou tentativas de escrita offline retornam estados explícitos de erro de conexão (`connectionError` / `connection-error` / `HttpErrorResponse` com `status: 0`) sem engolir falhas nem disparar requisições HTTP.
- **Testes e lint:** `npm test` (2 testes de layout + 26 arquivos / 347 testes Vitest) e `npm run lint` executados após a última edição, todos passando sem mocks acoplados a métodos privados.

## Sugestões (não bloqueiam)
- Em `apps/web/src/app/core/services/ride-request-data.ts:1056-1068` (`syncCachedDriverRideRequests`), o método atual filtra `this.requestsState()` por `rideId` para regravar o cache. Passar diretamente o `updatedRequest` retornado pelo `PATCH` (linhas `286` e `312`) e mapear o array em cache (`cached.map((item) => (item.id === updatedRequest.id ? updatedRequest : item))`), seguindo o mesmo padrão de `RideData.syncCachedDriverRide` (`apps/web/src/app/core/services/ride-data.ts:941-954`), evita depender do estado atual de `requestsState()` caso o cache tenha sido populado anteriormente e a lista em memória esteja vazia ou com outra carona.
- Em `apps/web/src/app/core/services/ride-request-data.ts:1021-1036` (`syncCancelledPassengerCaches`), quando uma solicitação de viagem é cancelada, o item correspondente em `passenger-trips` atualiza `status: 'cancelled'`, mas continua mantendo os demais campos antigos (como `whatsapp`, se houver). Se em alguma evolução da RPC de viagens o cancelamento mudar campos adicionais, considerar invalidar ou documentar que apenas o `status` é sincronizado localmente até a próxima leitura online.

## Observações fora do escopo deste diff
- Nenhuma observação fora do escopo encontrada nos arquivos inspecionados.
