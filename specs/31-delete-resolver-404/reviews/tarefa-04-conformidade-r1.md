<Parecer de Conformidade — Tarefa 4>
**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA5 — Rota curinga (`path: '**'`) ao final das rotas carregando `NotFound` standalone sob demanda (`loadComponent`), sem redirecionar visitante ao login | atendido | `apps/web/src/app/app.routes.ts:37`, `apps/web/src/app/features/not-found/not-found.ts:5-10` |
| CA5 — Layout adaptado do cartão centralizado `403` do protótipo (`docs/prototipo/models/14._acesso_negado_403_forbidden.html`) usando tokens semânticos de `docs/design-tokens.md`, exibindo selo `404` e mensagem de página não encontrada | atendido | `apps/web/src/app/features/not-found/not-found.html:1-93`, `apps/web/src/styles.css:4-56` |
| CA5 — Ação de retorno seguro direcionada a `/rides` quando autenticado e `/` quando visitante | atendido | `apps/web/src/app/features/not-found/not-found.ts:13-17`, `apps/web/src/app/features/not-found/not-found.html:60-69` |
| CA6 — Testes automatizados Vitest para `NotFound` com dublês/mocks HTTP sem chamadas de rede reais (cobrindo visitante, autenticado e encerramento de sessão) | atendido | `apps/web/src/app/features/not-found/not-found.spec.ts:80-175` |

## Apontamentos

</Parecer de Conformidade — Tarefa 4>