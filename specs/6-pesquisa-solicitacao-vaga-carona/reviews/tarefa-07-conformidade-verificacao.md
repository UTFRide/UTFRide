# Parecer de Conformidade — Tarefa 7

**Veredito:** APROVADO

## Critérios verificados

| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA9 — Se a gravação do cancelamento falhar, a API responde `500` e a solicitação permanece `pending` tanto nas leituras quanto na fonte de dados | atendido | `apps/api/server.mjs:16`, `apps/api/server.mjs:96`, `apps/api/server.test.mjs:258` |
| CA9 — Após a recuperação da gravação, o passageiro consegue repetir o `PATCH` e persistir `cancelled` sem alterar pedidos de outros passageiros | atendido | `apps/api/server.mjs:84`, `apps/api/server.test.mjs:274` |
| CA9 — Em conflito entre cancelamento e aceite ou rejeição, prevalece a primeira transição gravada e a operação concorrente recebe `409` | atendido | `apps/api/server.mjs:91`, `apps/api/server.test.mjs:312` |
| CA9 — Uma gravação concorrente em outra coleção preserva os pedidos e não incorpora o cancelamento que falhou | atendido | `apps/api/server.mjs:175`, `apps/api/server.test.mjs:282` |
| CA9 — A API retorna somente as viagens do passageiro consultado e disponibiliza o WhatsApp do motorista exclusivamente nas Confirmadas | atendido | `apps/api/server.mjs:105`, `apps/api/server.test.mjs:59` |

Os 12 testes da API passaram na verificação complementar da segunda rodada.

## Apontamentos
