# Decisões — Tarefa 7, rodada 1

| # | Apontamento (resumo) | Parecer | Decisão | Justificativa |
| --- | --- | --- | --- | --- |
| 1 | Regra de elegibilidade para ofertar carona duplicada entre serviços e sinal ocioso em `AuthData` | código | aceito | Optado por centralizar a regra em `AuthData.canOffer` e fazer `RideData` delegar para `this.auth.canOffer()` sem duplicar a condição. |
