<Parecer de Conformidade — Tarefa 8>
**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA10 — Falha de conexão ao publicar oferta: informa o Aluno, permite nova tentativa e preserva os dados preenchidos enquanto a tela estiver aberta | atendido | `apps/web/src/app/core/services/ride-data.ts:387`, `apps/web/src/app/features/driver/offer-ride/offer-ride.ts:242`, `apps/web/src/app/features/driver/offer-ride/offer-ride.html:309`, `apps/web/src/app/features/driver/offer-ride/offer-ride.spec.ts:574` |
| CA10 — Falha de conexão ao editar oferta (carregamento via `rideId` e salvamento das alterações): informa o Aluno, permite nova tentativa e preserva os dados preenchidos | atendido | `apps/web/src/app/core/services/ride-data.ts:86`, `apps/web/src/app/features/driver/offer-ride/offer-ride.ts:209`, `apps/web/src/app/features/driver/offer-ride/offer-ride.ts:266`, `apps/web/src/app/features/driver/offer-ride/offer-ride.html:63`, `apps/web/src/app/features/driver/offer-ride/offer-ride.spec.ts:656`, `apps/web/src/app/features/driver/offer-ride/offer-ride.spec.ts:748` |
| CA10 — Falha de conexão ao cancelar oferta (e operações de carga/decisão na gestão): informa o Aluno, mantém a tela/modal aberto sem alterar o estado e permite nova tentativa | atendido | `apps/web/src/app/core/services/ride-request-data.ts:230`, `apps/web/src/app/features/driver/my-rides/my-rides.ts:212`, `apps/web/src/app/features/driver/my-rides/my-rides.html:399`, `apps/web/src/app/features/driver/my-rides/my-rides.spec.ts:599`, `apps/web/src/app/features/driver/my-rides/my-rides.spec.ts:697` |
| Escopo e "Fora de escopo" (sem invasão de outros módulos nem tratamento robusto entre cancelamento e avisos) | atendido | `apps/web/src/app/core/services/ride-request-data.ts:283` |
| Aderência ao glossário (`docs/architecture.md`) e telas do protótipo (`6._oferecer_carona_motorista.html` e `7._minhas_ofertas_e_gerenciar_solicita_es.html`) | atendido | `apps/web/src/app/features/driver/offer-ride/offer-ride.html:309`, `apps/web/src/app/features/driver/my-rides/my-rides.html:399` |

## Apontamentos

</Parecer de Conformidade — Tarefa 8>
