# Parecer de Conformidade — Tarefa 6 (rodada 2)
**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA4: dados em cache aparecem offline em `/rides` sem requisição HTTP nem chamada ao IBGE | atendido | `ride-list.spec.ts` (novo teste offline: `expectNone` de rides, summaries e municípios, cards e opções do filtro vindos do cache) |
| CA4: `/rides/:id` ausente do cache sem internet mostra aviso específico e volta com segurança a `/rides` | atendido | `ride-detail.html` (mensagem de indisponibilidade sem internet e link "Voltar para a busca" para `/rides`); coberto em `ride-detail.spec.ts` |
| CA5: "Solicitar vaga" desabilitado com `OFFLINE_ACTION_MESSAGE` | atendido | `ride-detail.html` (`[disabled]`, `aria-describedby`, hint com `role=status`); `ride-detail.ts` (`toggleConfirmation` e `confirmRequest` barram offline; `confirmationOpen` fecha ao ficar offline) |
| CA5: "Cancelar solicitação" desabilitado com a mensagem, e o handler `cancelTrip` bloqueia offline | atendido | `my-trips.html` e `my-trips.ts` |
| CA5: "Tentar novamente" e "Atualizar viagens" desabilitados com a mensagem, e os handlers de retry bloqueiam offline | atendido | `ride-list.ts`, `ride-detail.ts` (`retryDetail` e `retryRequestRead`), `my-trips.ts` (`refreshTrips`) e os `.html` correspondentes |
| CA7: as ações reabilitam automaticamente ao voltar `online` | atendido | Teste de `ride-list.spec.ts` dispara `online`, confirma `retryButton.disabled === false`, mensagem removida e GET disparado; `isOffline()` é reativo |
| CA7: testes Vitest simulam offline/online sem rede real | atendido | Os três specs usam `HttpTestingController`. Resultado: 3 arquivos, 98 testes passando. |

## Apontamentos
Nenhum. O diff ficou restrito aos 9 arquivos previstos na tarefa. O link "Voltar para a busca" em `ride-detail.html` atende ao "retorno seguro a `/rides`" do CA4 e não conta como escopo inflado.
