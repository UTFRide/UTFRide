# Parecer de Conformidade — Tarefa 7

**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA9 — Aluno que não é o autor da oferta é impedido de editá-la | atendido | `apps/web/src/app/core/services/ride-data.ts:65-97`, `162-170`, `238-259`; `apps/web/src/app/features/driver/offer-ride/offer-ride.ts:145-200`, `218-232`, `373-382`; `apps/web/src/app/features/driver/my-rides/my-rides.ts:212-226`; `apps/web/src/app/core/services/ride-data.spec.ts:468-555`; `apps/web/src/app/features/driver/offer-ride/offer-ride.spec.ts:461-572`; `apps/web/src/app/features/driver/my-rides/my-rides.spec.ts:468-565` |
| CA9 — Aluno que não é o autor da oferta é impedido de cancelá-la | atendido | `apps/web/src/app/core/services/ride-data.ts:300-325`; `apps/web/src/app/core/services/ride-request-data.ts:204-235`; `apps/web/src/app/features/driver/my-rides/my-rides.ts:228-259`; `apps/web/src/app/core/services/ride-data.spec.ts:488-513`; `apps/web/src/app/core/services/ride-request-data.spec.ts:465-470`; `apps/web/src/app/features/driver/my-rides/my-rides.spec.ts:532-550` |
| CA9 — Aluno que não é o autor da oferta é impedido de decidir sobre suas solicitações | atendido | `apps/web/src/app/core/services/ride-request-data.ts:67-168`; `apps/web/src/app/core/services/ride-data.ts:327-343`; `apps/web/src/app/features/driver/my-rides/my-rides.ts:99-108`, `261-283`; `apps/web/src/app/features/driver/my-rides/ride-request-card.html:29-59`; `apps/web/src/app/core/services/ride-request-data.spec.ts:402-504`; `apps/web/src/app/features/driver/my-rides/my-rides.spec.ts:533-564` |
| CA9 — Alunos bloqueados não podem ofertar caronas | atendido | `apps/web/src/app/core/services/auth-data.ts:37-58`; `apps/web/src/app/core/services/ride-data.ts:63`, `126-135`, `234-245`; `apps/web/src/app/features/driver/offer-ride/offer-ride.ts:98-112`, `202-216`; `apps/web/src/app/features/driver/offer-ride/offer-ride.html:39-63`, `287-291`; `apps/web/src/app/features/driver/my-rides/my-rides.html:256-271`; `apps/web/src/app/core/services/auth-data.spec.ts:67-146`; `apps/web/src/app/core/services/ride-data.spec.ts:416-466`; `apps/web/src/app/features/driver/offer-ride/offer-ride.spec.ts:404-459`; `apps/web/src/app/features/driver/my-rides/my-rides.spec.ts:567-597` |
| CA1–CA8, CA10, CA11 | fora desta tarefa | `specs/5-publicacao-gestao-oferta-carona/spec.md:18-28` (cobertos nas Tarefas 1–6, 8 e 9; CA1 permanece coerente quanto à restrição a aluno não bloqueado) |

## Apontamentos

*Observações de verificação:*
- Suíte executada via `npm test`: 2 testes em `pretest` (`apps/web/src/app/features/auth/layout.spec.mjs`) e 83 testes Vitest em 15 arquivos de `apps/web` aprovados sem falhas ou testes ignorados.
- Layout, fluxo e estados de `offer-ride.html`, `my-rides.html` e `ride-request-card.html` conferidos com `docs/prototipo/models/6._oferecer_carona_motorista.html` e `docs/prototipo/models/7._minhas_ofertas_e_gerenciar_solicita_es.html`, sem divergências visuais.
- Termos do código conferidos com o glossário do `docs/architecture.md` (`User`, `driverId`, `Ride`, `RideRequest`, `isBlocked`, `role: 'support'`).
