# Parecer de Conformidade — Tarefa 4

**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA1 — Publicação de oferta válida | fora desta tarefa | — |
| CA2 — Bloqueio de campos obrigatórios vazios e vagas fora de 1..4 | fora desta tarefa | — |
| CA3 — Rejeição de data/horário não futuros | fora desta tarefa | — |
| CA4 — Aceite e rejeição individual de solicitações pendentes e transição para esgotada | fora desta tarefa | — |
| CA5 — Edição de oferta sem passageiros confirmados antes da viagem | fora desta tarefa | — |
| CA6 — Restrição de edição com passageiros confirmados antes da viagem (bloqueio de trajeto, data, horário, valor e redução de vagas; permissão de aumento até 4 vagas; retorno de esgotada para ativa ao disponibilizar vaga) | atendido | `apps/web/src/app/core/services/ride-data.ts:149-192`, `apps/web/src/app/core/services/ride-data.ts:277-298`, `apps/web/src/app/features/driver/my-rides/my-rides.ts:75-79`, `apps/web/src/app/features/driver/offer-ride/offer-ride.ts:88-98`, `apps/web/src/app/features/driver/offer-ride/offer-ride.ts:176-260`, `apps/web/src/app/features/driver/offer-ride/offer-ride.html:38-133`, `apps/web/src/app/features/driver/offer-ride/offer-ride.html:153-225`, `apps/web/src/app/features/driver/offer-ride/offer-ride.html:276-278`, `apps/web/src/app/core/services/ride-data.spec.ts:229-360`, `apps/web/src/app/features/driver/my-rides/my-rides.spec.ts:234-292`, `apps/web/src/app/features/driver/offer-ride/offer-ride.spec.ts:443-545` |
| CA7 — Cancelamento de oferta e geração de avisos | fora desta tarefa | — |
| CA8 — Visualização de avisos de cancelamento no sino | fora desta tarefa | — |
| CA9 — Impedimento de operações por não-autor ou aluno bloqueado | fora desta tarefa | — |
| CA10 — Tratamento de falha de conexão preservando dados preenchidos | fora desta tarefa | — |
| CA11 — Descarte de alterações não salvas ao sair e retornar | fora desta tarefa | — |

## Apontamentos
