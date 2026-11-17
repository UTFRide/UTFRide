# Parecer de Conformidade — Tarefa 7

**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA9 — Outro aluno (não autor) é impedido de editar oferta | atendido | `apps/web/src/app/core/services/ride-data.ts:168-170`, `apps/web/src/app/core/services/ride-data.ts:238-260`, `apps/web/src/app/features/driver/offer-ride/offer-ride.ts:147-184`, `apps/web/src/app/features/driver/my-rides/my-rides.ts:212-226`, `apps/web/src/app/core/services/ride-data.spec.ts:472-519`, `apps/web/src/app/features/driver/offer-ride/offer-ride.spec.ts:461-572` |
| CA9 — Outro aluno (não autor) é impedido de cancelar oferta | atendido | `apps/web/src/app/core/services/ride-data.ts:301-312`, `apps/web/src/app/core/services/ride-request-data.ts:209-216`, `apps/web/src/app/features/driver/my-rides/my-rides.ts:228-259`, `apps/web/src/app/core/services/ride-request-data.spec.ts:465-471`, `apps/web/src/app/features/driver/my-rides/my-rides.spec.ts:543-549` |
| CA9 — Outro aluno (não autor) é impedido de decidir solicitações | atendido | `apps/web/src/app/core/services/ride-data.ts:328-331`, `apps/web/src/app/core/services/ride-request-data.ts:71-115`, `apps/web/src/app/features/driver/my-rides/my-rides.ts:261-283`, `apps/web/src/app/core/services/ride-request-data.spec.ts:446-464`, `apps/web/src/app/features/driver/my-rides/my-rides.spec.ts:551-563` |
| CA9 — Alunos bloqueados não podem ofertar caronas | atendido | `apps/web/src/app/core/services/auth-data.ts:37-58`, `apps/web/src/app/core/services/ride-data.ts:63`, `apps/web/src/app/core/services/ride-data.ts:132-135`, `apps/web/src/app/features/driver/offer-ride/offer-ride.ts:98-112`, `apps/web/src/app/core/services/auth-data.spec.ts:67-146`, `apps/web/src/app/core/services/ride-data.spec.ts:416-447`, `apps/web/src/app/features/driver/offer-ride/offer-ride.spec.ts:404-459` |
| Decisão R1 — Centralização da elegibilidade em `AuthData.canOffer` com delegação em `RideData` | atendido | `apps/web/src/app/core/services/auth-data.ts:38-41`, `apps/web/src/app/core/services/ride-data.ts:63`, `apps/web/src/app/core/services/ride-data.ts:234-246`, `apps/web/src/app/core/services/ride-data.spec.ts:616-683` |
| Suíte de testes automatizados (`npm test`) | atendido | `npm test` executado com sucesso: 2/2 testes de `pretest` e 15 arquivos (87/87 testes) no Vitest em `apps/web` |

## Apontamentos
