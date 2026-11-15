# Parecer de Conformidade — Tarefa 4

**Veredito:** APONTAMENTOS

## Critérios verificados

| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA6 — Mensagem amigável e genérica para credenciais inválidas | não atendido: o teste falha e não comprova o critério | `apps/web/src/app/features/auth/login/login.spec.ts:29` |
| Retorno ao login sem exibir a falha anterior | atendido | `apps/web/src/app/features/auth/login/login.ts:22`, `apps/web/src/app/features/auth/login/login.spec.ts:37` |
| CA1, CA4, CA5, CA7, CA8 e CA9 | fora desta tarefa | `specs/4-cadastro-autenticacao-institucional/spec.md:18` |

## Apontamentos

1. **O teste da mensagem genérica falha antes de verificar todos os casos** — `apps/web/src/app/features/auth/login/login.spec.ts:29`

   Critério violado: CA6, em `spec.md:21`, exige uma mensagem amigável sem detalhes específicos de segurança.

   Evidência: conforme a execução informada pelo orquestrador, o teste falha na comparação de `textContent`: os textos dos elementos são concatenados sem espaços entre eles, e a normalização não insere esses espaços. A falha na primeira iteração impede a comparação do caso de senha incorreta e as verificações posteriores. A implementação apresenta uma mensagem genérica, mas o teste exigido ainda não a comprova.
