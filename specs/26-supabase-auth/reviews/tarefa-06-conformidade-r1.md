<Parecer de Conformidade — Tarefa 6>
**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA8 — Botão **Sair** discreto ao lado do avatar no cabeçalho de `RidesLayout`, com tokens semânticos, executando `signOut`, limpando sessão/JWT, redirecionando para `/login` e voltando a bloquear rotas protegidas | atendido | `apps/web/src/app/features/rides/rides-layout/rides-layout.html:26-35`, `apps/web/src/app/features/rides/rides-layout/rides-layout.ts:29-38`, `apps/web/src/app/features/rides/rides-layout/rides-layout.spec.ts:69-157` |
| CA8 — Botão **Sair** discreto ao lado do avatar no cabeçalho de `MyRides`, com tokens semânticos, executando `signOut`, limpando sessão/JWT, redirecionando para `/login` e voltando a bloquear `/driver/my-rides` | atendido | `apps/web/src/app/features/driver/my-rides/my-rides.html:25-34`, `apps/web/src/app/features/driver/my-rides/my-rides.ts:334-343`, `apps/web/src/app/features/driver/my-rides/my-rides.spec.ts:893-937` |
| CA8 — Botão **Sair** discreto ao lado do avatar no cabeçalho de `OfferRide`, com tokens semânticos, executando `signOut`, limpando sessão/JWT, redirecionando para `/login` e voltando a bloquear `/driver/offer` | atendido | `apps/web/src/app/features/driver/offer-ride/offer-ride.html:23-32`, `apps/web/src/app/features/driver/offer-ride/offer-ride.ts:489-498`, `apps/web/src/app/features/driver/offer-ride/offer-ride.spec.ts:1204-1245` |
| CA8/CA9 — `AuthData.logout()` invoca `signOut`, limpa `currentUser` e `accessToken` e não trava em caso de erro/queda de rede | atendido | `apps/web/src/app/core/services/auth-data.ts:307-310,351-359`, `apps/web/src/app/core/services/auth-data.spec.ts:1006-1082` |
| CA9 — HTTP `401` no `errorInterceptor` encerra sessão via `AuthData.logout()` (inclusive sob falha de rede no `signOut`) e redireciona para `/login` | atendido | `apps/web/src/app/core/interceptors/error-interceptor.ts:26-29`, `apps/web/src/app/core/interceptors/error-interceptor.spec.ts:62-95` |
| Escopo da Tarefa 6 — Apenas os 12 arquivos previstos no `plan.md` foram modificados/criados; suíte completa (`npm test`) executada com 22 arquivos / 271 testes passando (+ 2 testes de `layout.spec.mjs`) | atendido | `git diff --name-only c3da3d80932e6d7d12a6d31434fd60f28cbae419` |

## Apontamentos
</Parecer de Conformidade — Tarefa 6>
