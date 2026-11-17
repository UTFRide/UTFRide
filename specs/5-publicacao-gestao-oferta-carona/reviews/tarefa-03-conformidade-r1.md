# Parecer de Conformidade — Tarefa 3

**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA5 — Autor de uma oferta sem passageiros confirmados, antes da viagem, inicia a edição a partir de Minhas Ofertas e carrega os dados atuais no formulário | atendido | `apps/web/src/app/features/driver/my-rides/my-rides.ts:75-83,109-114`, `apps/web/src/app/features/driver/my-rides/my-rides.html:173-184`, `apps/web/src/app/features/driver/offer-ride/offer-ride.ts:106-165`, `apps/web/src/app/features/driver/my-rides/my-rides.spec.ts:183-225` |
| CA5 — Autor edita os dados de uma oferta sem passageiros confirmados antes da viagem e salva valores válidos, atualizando a oferta | atendido | `apps/web/src/app/core/services/ride-data.ts:130-181`, `apps/web/src/app/features/driver/offer-ride/offer-ride.ts:212-246`, `apps/web/src/app/features/driver/offer-ride/offer-ride.html:244-294`, `apps/web/src/app/core/services/ride-data.spec.ts:133-227`, `apps/web/src/app/features/driver/offer-ride/offer-ride.spec.ts:199-298` |
| CA5 — Regras de campos obrigatórios, limite de vagas (1 a 4) e data e horário futuros são novamente validadas na edição | atendido | `apps/web/src/app/features/driver/offer-ride/offer-ride.ts:89-104,212-228`, `apps/web/src/app/core/services/ride-data.ts:150-152,248-264`, `apps/web/src/app/core/services/ride-data.spec.ts:163-193`, `apps/web/src/app/features/driver/offer-ride/offer-ride.spec.ts:240-261` |

## Apontamentos
