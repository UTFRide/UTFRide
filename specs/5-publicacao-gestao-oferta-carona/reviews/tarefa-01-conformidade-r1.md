# Parecer de Conformidade — Tarefa 1

**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA1 — Publicação de oferta ativa por aluno autenticado e não bloqueado, com 1 a 4 vagas, valor válido e responsabilidade do motorista pela capacidade do veículo | atendido | `apps/web/src/app/core/services/auth-data.ts:20-35`, `apps/web/src/app/core/services/ride-data.ts:30-50`, `apps/web/src/app/features/driver/offer-ride/offer-ride.ts:81-86,165-173`, `apps/web/src/app/features/driver/offer-ride/offer-ride.html:188-193,251-297`, `apps/web/src/app/features/driver/offer-ride/offer-ride.spec.ts:65-120`, `apps/web/src/app/core/services/ride-data.spec.ts:38-91` |
| CA2 — Bloqueio de envio e apontamento de erros para campos obrigatórios vazios, vagas fora de 1 a 4 e valor negativo | atendido | `apps/web/src/app/features/driver/offer-ride/offer-ride.ts:7-14,74-89,117-120`, `apps/web/src/app/features/driver/offer-ride/offer-ride.html:46-51,68-73,135-140,195-200,222-227,240-247`, `apps/web/src/app/features/driver/offer-ride/offer-ride.spec.ts:122-157` |
| CA3 — Rejeição com aviso de data inválida quando data e horário não são futuros no momento de salvar | atendido | `apps/web/src/app/features/driver/offer-ride/offer-ride.ts:35-44,122-131,152-163`, `apps/web/src/app/features/driver/offer-ride/offer-ride.html:142-147`, `apps/web/src/app/features/driver/offer-ride/offer-ride.spec.ts:159-194` |
| CA4–CA11 — Gestão de solicitações, edição, cancelamento, notificações, restrição por autoria, falhas de conexão e descarte ao sair | fora desta tarefa | Cobertos pelas Tarefas 2 a 9 em `specs/5-publicacao-gestao-oferta-carona/plan.md` |

## Apontamentos
