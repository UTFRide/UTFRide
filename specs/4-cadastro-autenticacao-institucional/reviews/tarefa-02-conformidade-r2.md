# Parecer de Conformidade — Tarefa 2

**Veredito:** APROVADO

## Critérios verificados

| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA4 — Conta ativa e confirmada entra com credenciais corretas | atendido | `apps/web/src/app/core/services/auth-data.ts:16`; `apps/web/src/app/features/auth/login/login.ts:20`; `apps/web/src/app/features/auth/login/login.spec.ts:10` |
| CA1, CA5, CA7 e CA8 — Cadastro | fora desta tarefa | `specs/4-cadastro-autenticacao-institucional/spec.md:18` |
| CA6 — Credenciais inválidas | fora desta tarefa | `specs/4-cadastro-autenticacao-institucional/spec.md:21` |
| CA9 — Falha de conexão | fora desta tarefa, conforme decisão da rodada 1 | `specs/4-cadastro-autenticacao-institucional/reviews/tarefa-02-decisoes-r1.md:5` |

O teste verifica o estado autenticado e a navegação para `/rides`, cuja tela provisória foi autorizada. A comparação com o protótipo não revelou divergência visual relevante no escopo da tarefa.

`npm test` passou: 5 arquivos e 12 testes.

## Apontamentos
