# Parecer de Conformidade — Tarefa 5

**Veredito:** APROVADO

## Critérios verificados

| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA7 — Alertar quando o e-mail já está cadastrado | atendido em tentativas sequenciais | `apps/api/server.mjs:18`; `apps/web/src/app/features/auth/register/register.html:18` |
| CA7 — Alertar quando a matrícula já está cadastrada | atendido em tentativas sequenciais | `apps/api/server.mjs:18`; `apps/web/src/app/features/auth/register/register.html:18` |
| Impedir a criação de nova conta quando a consulta identifica duplicidade | atendido | `apps/web/src/app/core/services/auth-data.ts:31`; `apps/web/src/app/features/auth/register/register.spec.ts:175` |
| CA1, CA4, CA5, CA6, CA8 e CA9 | fora desta tarefa | `specs/4-cadastro-autenticacao-institucional/plan.md` |

Os testes executaram com sucesso: **16 testes da aplicação**, **2 testes de layout** e **1 teste da API**. A concorrência foi recusada na triagem da rodada anterior.

## Apontamentos
