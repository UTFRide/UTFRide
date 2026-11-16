# Parecer de Conformidade — Tarefa 2

**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA1 — Publicação de oferta ativa com dados válidos (1 a 4 vagas, valor válido, data/hora futuras) | fora desta tarefa | — |
| CA2 — Bloqueio e exibição de erros para campos obrigatórios ou vagas fora dos limites | fora desta tarefa | — |
| CA3 — Rejeição de publicação com data e horário não futuros | fora desta tarefa | — |
| CA4 — Autor consulta oferta antes da viagem e aceita ou rejeita cada solicitação pendente individualmente | atendido | `apps/web/src/app/core/services/ride-request-data.ts:62-123`, `apps/web/src/app/features/driver/my-rides/my-rides.ts:96-106`, `apps/web/src/app/features/driver/my-rides/my-rides.spec.ts:44-181` |
| CA4 — Ao aceitar solicitação, vaga é ocupada e ao atingir o total de vagas a oferta passa a esgotada (`full`) e não aceita novos pedidos | atendido | `apps/web/src/app/core/services/ride-data.ts:185-205`, `apps/web/src/app/core/services/ride-request-data.ts:81-103`, `apps/web/src/app/core/services/ride-request-data.ts:125-153`, `apps/web/src/app/core/services/ride-request-data.spec.ts:116-167` |
| CA4 — Solicitações ainda pendentes permanecem pendentes, mas não podem ser aceitas enquanto não houver vagas disponíveis | atendido | `apps/web/src/app/core/services/ride-request-data.ts:81-84`, `apps/web/src/app/features/driver/my-rides/my-rides.html:161-171`, `apps/web/src/app/features/driver/my-rides/ride-request-card.html:26-58`, `apps/web/src/app/features/driver/my-rides/my-rides.spec.ts:164-175` |
| CA5 — Edição de oferta sem passageiros confirmados | fora desta tarefa | — |
| CA6 — Restrição de edição com passageiros confirmados e retorno de esgotada para ativa ao aumentar vagas | fora desta tarefa | — |
| CA7 — Cancelamento de oferta antes da viagem e geração de avisos internos | fora desta tarefa | — |
| CA8 — Exibição de avisos de cancelamento no sino de notificações apenas para o destinatário | fora desta tarefa | — |
| CA9 — Impedimento de operações por não autor e bloqueio de oferta por aluno bloqueado | fora desta tarefa | — |
| CA10 — Tratamento de falha de conexão com nova tentativa e preservação de dados | fora desta tarefa | — |
| CA11 — Descarte de alterações não salvas ao sair do formulário | fora desta tarefa | — |

## Apontamentos
