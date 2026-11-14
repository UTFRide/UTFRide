# Parecer de Conformidade — Manutenção de tokens

**Veredito:** APROVADO

## Critérios verificados

| Critério | Situação | Onde |
| --- | --- | --- |
| Usar o prefixo `space-` nos cinco tokens de espaçamento | atendido | `docs/design-tokens.md:41`, `apps/web/src/styles.css:46` |
| Preservar os valores de 4, 8, 12, 16 e 24 px | atendido | `apps/web/src/styles.css:46`, `apps/web/src/app/features/auth/layout.spec.mjs:35` |
| Preservar as telas e seus fluxos durante a troca das classes | atendido | `apps/web/src/app/features/auth/landing/landing.html:1`, `apps/web/src/app/features/auth/login/login.html:1`, `apps/web/src/app/features/auth/register/register.html:1`, `apps/web/src/app/features/rides/ride-list/ride-list.html:1` |
| Verificar os valores resolvidos e a largura de contêiner, conforme decisão da rodada 1 | atendido | `apps/web/src/app/features/auth/layout.spec.mjs:11` |
| Critérios funcionais de cadastro e autenticação da spec | fora desta tarefa | `specs/4-cadastro-autenticacao-institucional/spec.md:16` |

Os dois testes específicos de layout passaram. A suíte Angular também passou: 12 testes em 5 arquivos.

## Apontamentos
