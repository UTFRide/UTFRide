# Parecer de Conformidade — Tarefa 1

**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA1 — Publicação de oferta ativa por aluno autenticado e não bloqueado, com 1 a 4 vagas, valor válido (não negativo) e responsabilidade do motorista pela capacidade do veículo | atendido | `apps/web/src/app/app.routes.ts:9`, `apps/web/src/app/core/models/ride.model.ts:1-18`, `apps/web/src/app/core/services/auth-data.ts:9,20-35`, `apps/web/src/app/core/services/ride-data.ts:30-55`, `apps/web/src/app/features/driver/offer-ride/offer-ride.ts:82-87,149-171`, `apps/web/src/app/features/driver/offer-ride/offer-ride.html:187-192,250-296`, `apps/web/src/app/shared/pipes/currency-brl-pipe.ts:1-18`, `apps/web/src/app/core/services/ride-data.spec.ts:38-92`, `apps/web/src/app/features/driver/offer-ride/offer-ride.spec.ts:56-120`, `apps/web/src/app/shared/pipes/currency-brl-pipe.spec.ts:1-18` |
| CA2 — Bloqueio de envio e apontamento de erros para campos obrigatórios vazios, vagas fora de 1 a 4 e valor negativo | atendido | `apps/web/src/app/features/driver/offer-ride/offer-ride.ts:8-15,75-90,118-121,149-153`, `apps/web/src/app/features/driver/offer-ride/offer-ride.html:45-50,67-72,134-139,194-199,221-226,239-246`, `apps/web/src/app/features/driver/offer-ride/offer-ride.spec.ts:122-157` |
| CA3 — Rejeição com aviso de data inválida quando data e horário não são futuros no momento de salvar | atendido | `apps/web/src/app/features/driver/offer-ride/offer-ride.ts:36-45,123-132,149-162`, `apps/web/src/app/features/driver/offer-ride/offer-ride.html:141-146`, `apps/web/src/app/features/driver/offer-ride/offer-ride.spec.ts:159-194` |
| CA4–CA11 — Gestão de solicitações, edição, cancelamento, notificações, restrição por autoria, falhas de conexão e descarte ao sair | fora desta tarefa | Cobertos pelas Tarefas 2 a 9 em `specs/5-publicacao-gestao-oferta-carona/plan.md` |

## Apontamentos

*(Sem apontamentos. Decisões da Rodada 1 observadas: substituição do método de formatação pelo `CurrencyBrlPipe` em `shared/pipes/` mantendo conformidade visual com `docs/prototipo/models/6._oferecer_carona_motorista.html` e sem inflar escopo com os CAs 9 e 10. Suíte executada com `npm test`: 2/2 em `layout.spec.mjs` e 9 arquivos / 40 testes aprovados no Vitest.)*
