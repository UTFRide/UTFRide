# Parecer de Conformidade — Tarefa 2

**Veredito:** APONTAMENTOS

## Critérios verificados

| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA4 — Conta ativa e confirmada entra com credenciais corretas | atendido | `apps/web/src/app/features/auth/login/login.spec.ts:10`; `apps/web/src/app/core/services/auth-data.ts:16` |
| CA9 — Falha de conexão no login é informada e permite nova tentativa | não atendido | `apps/web/src/app/core/services/auth-data.ts:16`; `apps/web/src/app/features/auth/login/login.ts:27` |
| CA1, CA5, CA7 e CA8 — Cadastro | fora desta tarefa | `specs/4-cadastro-autenticacao-institucional/spec.md:18` |
| CA6 — Mensagem para credenciais inválidas | fora desta tarefa | `specs/4-cadastro-autenticacao-institucional/spec.md:21` |

`npm test` passou: 5 arquivos e 11 testes.

## Apontamentos

1. **Falha de conexão no login não é informada e impede nova tentativa** — `apps/web/src/app/core/services/auth-data.ts:16`
   Critério violado: “Se a conexão falhar durante o cadastro ou o login, o sistema informa a falha e permite outra tentativa” (`spec.md:43`).
   Evidência: a requisição de login não trata erro HTTP. O componente mantém `loading` como verdadeiro após a falha, deixando o botão desabilitado, sem mensagem ao aluno.
