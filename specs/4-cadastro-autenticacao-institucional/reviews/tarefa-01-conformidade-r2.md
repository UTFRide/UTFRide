# Parecer de Conformidade — Tarefa 1

**Veredito:** APROVADO

## Critérios verificados

| Critério | Situação | Onde |
| --- | --- | --- |
| CA1 — Enviar dados válidos e criar conta com confirmação simulada | atendido, considerando a verificação manual de persistência registrada na decisão da rodada 1 | `apps/web/src/app/core/services/auth-data.ts:12`; `apps/web/src/app/features/auth/register/register.spec.ts:33`; `specs/4-cadastro-autenticacao-institucional/reviews/tarefa-01-decisoes-r1.md:5` |
| CA1 — Direcionar para `/login` após o cadastro | atendido; a tela de login está prevista para a tarefa 2 | `apps/web/src/app/features/auth/register/register.ts:34`; `apps/web/src/app/features/auth/register/register.spec.ts:52` |
| WhatsApp enviado no cadastro | atendido | `apps/web/src/app/features/auth/register/register.ts:44`; `apps/web/src/app/features/auth/register/register.spec.ts:41` |
| Senha e confirmação obrigatórias e coincidentes; aceitação obrigatória dos termos | atendido | `apps/web/src/app/features/auth/register/register.ts:6`; `apps/web/src/app/features/auth/register/register.ts:29` |
| Elementos da landing e do cadastro aceitos na triagem visual | atendido | `apps/web/src/app/features/auth/landing/landing.html:17`; `apps/web/src/app/features/auth/landing/landing.html:26`; `apps/web/src/app/features/auth/register/register.html:32` |
| CA4, CA5, CA6, CA7, CA8 e CA9 | fora desta tarefa, conforme o plano e as decisões da rodada 1 | `specs/4-cadastro-autenticacao-institucional/plan.md` |

O teste automatizado de cadastro simula a resposta do servidor; a verificação da persistência real foi registrada pelo usuário na decisão da rodada 1. `npm test` passou com 7 testes, o teste de layout passou e `npm run build` passou.

## Apontamentos
