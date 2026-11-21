# Parecer de Código — Tarefa 8

**Veredito:** APONTAMENTOS

## Apontamentos (bloqueiam)

1. **Ao retornar ao detalhe, a retentativa pode mostrar o pedido confirmado com a disponibilidade antiga** — [ride-detail.ts](/C:/Users/Geovane/Desktop/UTFRide/apps/web/src/app/features/rides/ride-detail/ride-detail.ts:134), [ride-request-data.ts](/C:/Users/Geovane/Desktop/UTFRide/apps/web/src/app/core/services/ride-request-data.ts:401)

   Regra violada: `docs/architecture.md` §5 define `status` e `availableSeats` como os campos de referência para o estado e a disponibilidade da oferta. A triagem da primeira rodada exige que a oferta seja atualizada junto com o pedido recuperado.

   Prejuízo concreto: ao retornar durante uma retentativa, se a atualização da oferta falhar, o botão de nova tentativa consulta a oferta e o pedido em paralelo. Se a leitura da oferta terminar antes de o motorista confirmar e ocupar a última vaga, a leitura do pedido pode retornar `accepted` quando a oferta já está lotada. Após um `409 active-ride-request`, se a leitura auxiliar falhar, a tela reaberta repete somente a consulta do pedido e também pode combinar a confirmação com a oferta antiga. Reproduzi os dois caminhos com os serviços e o componente reais. O resultado final exibiu o pedido confirmado e a oferta ativa com uma vaga, embora ela já estivesse lotada.

   Verificação: passaram os 201 testes Angular, os dois testes do pré-teste, os 15 testes da API e o lint. A fila de gravação do MVP protege contra a duplicidade. Também confirmei que um 401 de uma consulta anterior do motorista preserva a nova sessão do mesmo passageiro.

## Sugestões (não bloqueiam)

- Automatizar a verificação do 401 do resumo do motorista quando a consulta já estava pendente antes da troca de sessão para o mesmo ID.

## Observações fora do escopo deste diff

- O `git diff --check` passou nos arquivos de `apps/`. A verificação geral sinalizou apenas os espaços de quebra de linha Markdown nos dois pareceres arquivados da primeira rodada.
