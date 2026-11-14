# Parecer de Conformidade — Tarefa 3

**Veredito:** APROVADO

## Critérios verificados

| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA5 — Bloquear o envio de cadastro com e-mail não institucional | atendido | `apps/web/src/app/features/auth/register/register.ts:31`, `register.ts:47` |
| CA5 — Informar a exigência do domínio `@alunos.utfpr.edu.br` | atendido | `apps/web/src/app/features/auth/register/register.html:27` |
| Teste do bloqueio, da mensagem e da correção do e-mail | atendido | `apps/web/src/app/features/auth/register/register.spec.ts:9` |
| CA1, CA4, CA6, CA7, CA8 e CA9 | fora desta tarefa | `specs/4-cadastro-autenticacao-institucional/spec.md` |

O teste solicitado passou: 6 testes em 1 arquivo. O alerta abaixo do campo segue a posição expressamente aprovada pelo usuário. As demais alterações informadas como pré-existentes foram distinguidas do escopo desta tarefa.

## Apontamentos
