# Decisões — Tarefa 1, rodada 1

| # | Apontamento (resumo) | Parecer | Decisão | Justificativa |
| --- | --- | --- | --- | --- |
| 1 | O teste não comprova que a conta foi persistida | conformidade | recusado | Foi testado manualmente a persistência dos dados, foi gravado com sucesso. Rodando `npm run server`. |
| 2 | Falha de conexão deixa o cadastro sem mensagem e sem nova tentativa | conformidade | recusado | Será tratado a mensagem de erro na Task 7. Foi testado manualmente, dados não foram persistidos, como devido, por ora a tela fica presa por falha na conexão. |
| 3 | As telas omitem elementos relevantes dos protótipos indicados | conformidade | aceito | Usar apenas os links de ícones e imagens que estão no protótipo em `docs/prototipo/models`. |
| 4 | URL da API fixada no serviço | código | recusado | Para a entrega 2, conforme MVP será usado JSONSERVER. Futuramente, para a entrega 3, será alterado o endereço da API para o Supabase. |
| 5 | Conversão de RxJS para signal está no componente | código | aceito | — |
