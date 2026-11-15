# Parecer de Conformidade — Tarefa 1

**Veredito:** APROVADO

## Critérios verificados

| Critério | Situação | Onde |
| --- | --- | --- |
| CA1 — Enviar dados válidos e criar conta com confirmação simulada | atendido, considerando a verificação manual de persistência registrada na decisão da rodada 1 | `apps/web/src/app/core/services/auth-data.ts:15`; `apps/web/src/app/features/auth/register/register.spec.ts:29`; `specs/4-cadastro-autenticacao-institucional/reviews/tarefa-01-decisoes-r1.md:5` |
| CA1 — Direcionar para `/login` após o cadastro | atendido; a tela de login foi reservada para a tarefa 2 | `apps/web/src/app/features/auth/register/register.ts:39`; `apps/web/src/app/app.routes.ts:7` |
| WhatsApp enviado no cadastro | atendido | `apps/web/src/app/features/auth/register/register.ts:49`; `apps/web/src/app/features/auth/register/register.spec.ts:41` |
| Confirmação de senha e aceite dos termos obrigatórios | atendido | `apps/web/src/app/features/auth/register/register.ts:6`; `apps/web/src/app/features/auth/register/register.ts:34` |
| Elementos da landing e do cadastro aceitos na triagem visual | atendido | `apps/web/src/app/features/auth/landing/landing.html:17`; `apps/web/src/app/features/auth/landing/landing.html:26`; `apps/web/src/app/features/auth/register/register.html:29` |
| Retorno ao cadastro após envio e saída durante uma requisição pendente | atendido pelos testes | `apps/web/src/app/features/auth/register/register.spec.ts` |
| CA4, CA5, CA6, CA7, CA8 e CA9 | fora desta tarefa, conforme o plano e as decisões da rodada 1 | `specs/4-cadastro-autenticacao-institucional/plan.md` |

O teste automatizado simula a resposta do servidor; a persistência real foi verificada manualmente pelo usuário, conforme a decisão registrada. Nesta revisão, `npm test` passou com 9 testes e o teste de layout passou.

## Apontamentos
