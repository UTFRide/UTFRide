# Parecer de Conformidade — Tarefa 6

**Veredito:** APROVADO

## Critérios verificados

| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA8 — Impedir que contas bloqueadas e perfis de suporte solicitem vagas pela tela, exibindo o aviso correspondente e sem enviar `POST` | atendido | `apps/web/src/app/features/rides/ride-detail/ride-detail.html:185`, `apps/web/src/app/features/rides/ride-detail/ride-detail.ts:84`, `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:152` |
| CA8 — Bloquear a criação pelo serviço para os dois perfis, retornando o motivo da restrição sem enviar `POST` | atendido | `apps/web/src/app/core/services/auth-data.ts:39`, `apps/web/src/app/core/services/ride-request-data.ts:328`, `apps/web/src/app/core/services/ride-request-data.spec.ts:78` |
| CA8 — Bloquear o cancelamento pelo serviço para os dois perfis, retornando o motivo da restrição sem enviar `PATCH`, e permitir que o aluno elegível cancele uma solicitação própria pendente | atendido | `apps/web/src/app/core/services/ride-request-data.ts:351`, `apps/web/src/app/core/services/ride-request-data.spec.ts:88`, `apps/web/src/app/core/services/ride-request-data.spec.ts:98`. As cinco suítes solicitadas passaram, com 97 testes aprovados. |
| CA8 — Aplicar a restrição na ação de cancelamento em Minhas Viagens | fora desta tarefa | `specs/6-pesquisa-solicitacao-vaga-carona/plan.md:44`. A ação na interface foi reservada à Tarefa 7 conforme aprovação do usuário. |

## Apontamentos
