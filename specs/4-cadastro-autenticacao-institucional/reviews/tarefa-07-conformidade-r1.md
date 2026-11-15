# Parecer de Conformidade — Tarefa 7

**Veredito:** APROVADO

## Critérios verificados

| Critério da spec | Situação | Onde |
| --- | --- | --- |
| CA9 — informar falha de conexão e permitir nova tentativa no cadastro | atendido | `auth-data.ts:32`, `register.ts:42`, `register.html:24`, `register.spec.ts:231` |
| CA9 — informar falha de conexão e permitir nova tentativa no login | atendido | `auth-data.ts:20`, `login.ts:27`, `login.html:16`, `login.spec.ts:88` |
| CA1, CA4–CA8 | fora desta tarefa | `spec.md` |

## Apontamentos

`npm test` passou: 2 testes de layout e 19 testes em 5 arquivos. Os protótipos de cadastro e login foram consultados, sem divergência visual relevante para os estados acrescentados.

O teste de cadastro simula falha na verificação inicial; a captura de erro também abrange a requisição de criação. A revisão foi somente leitura.
