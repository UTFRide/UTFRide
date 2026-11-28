<Parecer de Conformidade — Tarefa 2>
**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA1 — Botão **Excluir Oferta** restrito a oferta `cancelled` própria, modal acessível (`role="dialog"`, `[inert]`), confirmação em **Sim, Excluir Oferta**, `DELETE /rest/v1/rides?id=eq.<rideId>`, remoção de `driverRides`, fechamento do modal, limpeza de seleção/solicitações, feedback acessível e estado vazio quando última oferta | atendido | `apps/web/src/app/features/driver/my-rides/my-rides.html:1,20-30,331-362,471-537`, `apps/web/src/app/features/driver/my-rides/my-rides.ts:131-180,438-446`, `apps/web/src/app/features/driver/my-rides/my-rides.spec.ts:1019-1234` |
| CA2 — Bloqueio de exclusão para ofertas `active`, `full` ou `completed`, conta bloqueada, perfil `support` ou motorista não autor (`driverId !== currentUser.id`), sem `DELETE` HTTP e com aviso acessível em chamadas diretas | atendido | `apps/web/src/app/features/driver/my-rides/my-rides.html:335`, `apps/web/src/app/features/driver/my-rides/my-rides.ts:131-134,162-176,399-430,438-446`, `apps/web/src/app/core/services/ride-data.ts:321-327,602-604`, `apps/web/src/app/features/driver/my-rides/my-rides.spec.ts:1391-1531` |
| CA3 — Desistência via **Voltar** ou `Escape` fecha o modal sem `DELETE` e devolve o foco ao botão disparador; falha de conexão (`status === 0`) ou erro do servidor encerra o envio, exibe `role="alert"` dentro do modal aberto e permite nova tentativa ou cancelamento | atendido | `apps/web/src/app/features/driver/my-rides/my-rides.html:478,501-533`, `apps/web/src/app/features/driver/my-rides/my-rides.ts:151,166-179,289-306,432-436`, `apps/web/src/app/features/driver/my-rides/my-rides.spec.ts:1236-1388` |
| CA4 — Pré-carregamento via `rideDetailResolver` em `/rides/:id` | fora desta tarefa | — |
| CA5 — Rota curinga `**` e página standalone `NotFound` (`404`) | fora desta tarefa | — |
| CA6 — Limpeza de estados transitórios de modal/erro ao trocar de oferta ou sair de `MyRides` (cancelamento de requisição pendente sem sobrescrever estado) e testes Vitest com mocks HTTP sem chamadas reais | atendido | `apps/web/src/app/features/driver/my-rides/my-rides.ts:136-146,308-316,418-424`, `apps/web/src/app/core/services/ride-data.ts:315-355,611-613`, `apps/web/src/app/features/driver/my-rides/my-rides.spec.ts:1533-1632` |

## Apontamentos
</Parecer de Conformidade — Tarefa 2>