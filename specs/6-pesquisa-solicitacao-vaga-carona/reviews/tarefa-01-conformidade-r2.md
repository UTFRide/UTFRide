# Parecer de Conformidade — Tarefa 1

**Veredito:** APROVADO

## Critérios verificados

| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA1 — `/rides` renderiza `RidesLayout` com `<router-outlet />`. O teste verifica que `RideList` ocupa o outlet e que as filhas `'my-trips'` e `':id'` são ativadas sem colisão, preservando a mesma instância do layout. | atendido | `apps/web/src/app/app.routes.ts:9`, `apps/web/src/app/features/rides/rides-layout/rides-layout.html:29`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:88` |
| CA1 — `authGuard` protege as três rotas e revalida a autenticação na troca de rota filha. | atendido | `apps/web/src/app/app.routes.ts:10`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:129` |
| CA1 — O cabeçalho exibe o sino à esquerda do avatar com iniciais. A navegação inferior contém Buscar, Oferecer, Ofertas e Viagens, com ativação de Minhas Viagens pelo link. | atendido | `apps/web/src/app/features/rides/rides-layout/rides-layout.html:10`, `apps/web/src/app/features/rides/rides-layout/rides-layout.html:32`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:97`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:170` |
| CA1 — Os testes de avisos internos da US02 seguem passando. A execução de `ride-list.spec.ts` passou nos 10 testes. | atendido | `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:154` |
| CA4 — `appConfig` habilita `withComponentInputBinding()` em `provideRouter`. O teste usa a configuração real e substitui apenas os carregadores de `'my-trips'` e `':id'`. Confirma a rota ativa e o valor `ride-123` recebido pelo `input.required<string>()` do componente de teste, com template vazio. | atendido | `apps/web/src/app/app.config.ts:12`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:21`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:49`, `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:119` |
| CA1 e CA4 — Os destinos de produção de Minhas Viagens e do detalhe permanecem provisórios. As telas completas ficam nas Tarefas 4 e 7. | atendido | `apps/web/src/app/app.routes.ts:21`, `specs/6-pesquisa-solicitacao-vaga-carona/plan.md:29`, `specs/6-pesquisa-solicitacao-vaga-carona/plan.md:44` |

## Apontamentos
