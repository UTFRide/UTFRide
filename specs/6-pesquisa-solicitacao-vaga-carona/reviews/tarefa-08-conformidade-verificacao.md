# Parecer de Conformidade — Tarefa 8

**Veredito:** APROVADO

## Critérios verificados

| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA4 e CA6 — Após falha na atualização da oferta ao retornar ao detalhe, a nova tentativa lê primeiro o pedido e só exibe a confirmação junto com o estado e a quantidade de vagas atualizados | atendido | `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:881` |
| CA4, CA6 e CA10 — Após falha na leitura auxiliar de um conflito 409, a retentativa lê o pedido e depois a oferta. Nova falha exibe um aviso e mantém a ação de tentar novamente, sem outro POST | atendido | `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:948` |
| CA10 — Sair do detalhe durante a recuperação preserva a nova tentativa para a mesma oferta e sessão | atendido | `apps/web/src/app/core/services/ride-request-data.ts:376`, `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:1005` |
| CA10 — Um 404 da oferta apresenta retorno à busca. Um 401 da sessão atual redireciona para o login, e um 401 da sessão anterior preserva o novo login do mesmo passageiro | atendido | `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:1041` |

## Apontamentos
