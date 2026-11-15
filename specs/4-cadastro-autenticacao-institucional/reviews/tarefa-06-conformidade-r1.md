# Parecer de Conformidade — Tarefa 6

**Veredito:** APONTAMENTOS

## Critérios verificados

| Critério da spec | Situação | Onde |
| --- | --- | --- |
| CA8 — dados do formulário não enviado podem ser descartados ao sair e retornar | Não comprovado | `apps/web/src/app/features/auth/register/register.spec.ts:9` |

## Apontamentos

1. **A execução do teste não foi verificada** — `apps/web/src/app/features/auth/register/register.spec.ts:9`  
   Critério: CA8. O teste cobre o preenchimento, a saída, o retorno, os campos vazios e a ausência de requisição POST. Porém, não foi executado por instrução explícita do usuário; portanto, seu resultado e o atendimento do critério permanecem sem comprovação. Não identifiquei outra falha concreta no diff revisado.
