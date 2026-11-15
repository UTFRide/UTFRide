# Parecer de Conformidade — Tarefa 5

**Veredito:** APONTAMENTOS

## Critérios verificados

| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA7 — Alertar quando o e-mail já está cadastrado | atendido para cadastro sequencial | `apps/web/src/app/core/services/auth-data.ts:32`; `apps/web/src/app/features/auth/register/register.html:18` |
| CA7 — Alertar quando a matrícula já está cadastrada | atendido para cadastro sequencial | `apps/web/src/app/core/services/auth-data.ts:32`; `apps/web/src/app/features/auth/register/register.spec.ts:175` |
| Impedir a criação de contas duplicadas | não atendido em tentativas simultâneas | `apps/web/src/app/core/services/auth-data.ts:31` |
| CA1, CA4, CA5, CA6, CA8 e CA9 | fora desta tarefa | `specs/4-cadastro-autenticacao-institucional/plan.md` |

Os testes solicitados executaram com sucesso: **8 testes passaram**.

## Apontamentos

1. **A verificação não impede cadastros simultâneos duplicados** — `apps/web/src/app/core/services/auth-data.ts:31`

   Critério violado: CA7 — “Dado um e-mail ou matrícula já cadastrados, quando o visitante tenta criar outro cadastro com os mesmos dados, então é alertado sobre o cadastro existente”; a tarefa também exige impedir a criação de nova conta.

   Evidência: a consulta e a criação são requisições separadas. Duas tentativas simultâneas podem consultar a lista antes de qualquer criação e, em seguida, ambas enviar o `POST` com o mesmo e-mail ou matrícula. Os testes cobrem apenas respostas em que o registro já aparece na consulta.
