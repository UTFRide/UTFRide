# Parecer de Conformidade — Tarefa 6
**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA4: `/rides`, `/rides/:id` e `/rides/my-trips` exibem os dados em cache offline sem nova chamada HTTP | atendido | `ride-detail.spec.ts` (1º teste: `http.expectNone` ao reabrir `/rides/007` offline); `ride-list.spec.ts` e `my-trips.spec.ts` (+163 e +191 linhas) |
| CA4: oferta ausente do cache em `/rides/:id` mostra aviso específico de indisponibilidade sem internet, com retorno a `/rides` | atendido | `ride-detail.html` (bloco `@case ('error')` com texto "não está salva em cache e está indisponível sem internet" e link "Voltar para a busca"); 2º teste do `ride-detail.spec.ts` |
| CA5: "Solicitar vaga" desabilitado com `OFFLINE_ACTION_MESSAGE` (`aria-describedby`) | atendido | `ride-detail.html` (`[disabled]="submitting() \|\| network.isOffline()"`); `ride-detail.ts` (guards em `toggleConfirmation` e `confirmRequest`) |
| CA5: "Cancelar solicitação" pendente desabilitado com a mensagem | atendido | `my-trips.html`; `my-trips.ts` (`cancelTrip` bloqueia offline) |
| CA5: "Tentar novamente" e "Atualizar viagens" desabilitados e bloqueados offline | atendido | `ride-list.html/.ts`, `ride-detail.html/.ts` (`retryDetail`, `retryRequestRead`), `my-trips.html/.ts` (`refreshTrips`) |
| CA7: reabilitação automática ao voltar `online`; painel de confirmação fechado ao ficar offline | atendido | `ride-detail.ts` (`linkedSignal` de `confirmationOpen` considera `offline`); testes que simulam `offline` e `online` |
| CA7: testes Vitest sem rede real | atendido | `HttpTestingController`, `expectNoPost`, `http.expectNone`. 3 arquivos, 98 testes, todos passando |

## Apontamentos
Nenhum.
