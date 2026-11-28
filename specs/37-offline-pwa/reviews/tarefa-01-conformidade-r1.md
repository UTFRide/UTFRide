# Parecer de Conformidade — Tarefa 1

**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA1 — Detecção reativa de `navigator.onLine` e eventos `offline`/`online` | atendido | `apps/web/src/app/core/services/network-status.ts:12-33`, `apps/web/src/app/core/services/network-status.spec.ts:10-60` |
| CA1 — Banner global persistente no topo (`role="status"`, Opção C `bg-primaria`, `text-texto`, `border-b border-borda`, texto *"Você está offline. Visualizando dados salvos"*) exibido ao ficar offline e removido ao voltar online | atendido | `apps/web/src/app/app.ts:14`, `apps/web/src/app/app.html:3-12`, `apps/web/src/app/app.spec.ts:41-85` |
| CA7 — Isolamento e limpeza de cache por `userId` evitando vazamento entre contas, com testes automatizados Vitest sem chamadas reais de rede | atendido | `apps/web/src/app/core/services/offline-cache.ts:29-59`, `apps/web/src/app/core/services/offline-cache.spec.ts:24-95` |
| CA2, CA3, CA4, CA5, CA6 — Comportamento offline de telas públicas, restauração de sessão/guard, cache de serviços de dados, bloqueio de ações e confirmação de saída | fora desta tarefa | — |

## Apontamentos
