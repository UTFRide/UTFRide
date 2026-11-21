# Decisões — Tarefa 7, rodada 1

| # | Apontamento (resumo) | Parecer | Decisão | Justificativa |
| --- | --- | --- | --- | --- |
| 1 | O cancelamento pode sobrescrever uma confirmação do motorista. | conformidade | aceito | O cancelamento só deve gravar se o pedido ainda estiver pendente. |
| 2 | Sair de Minhas Viagens pode interromper um cancelamento já confirmado. | código | aceito | O cancelamento deve continuar mesmo se o passageiro sair de Minhas Viagens. |
