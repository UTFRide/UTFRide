# Decisões — Tarefa 5, rodada 1

| # | Apontamento (resumo) | Parecer | Decisão | Justificativa |
| --- | --- | --- | --- | --- |
| 1 | Cadastros simultâneos podem criar duplicatas | conformidade | recusado | Concorrência será tratada na entrega 3, com banco de dados. O domínio institucional é externo ao sistema, e os e-mails já serão cadastrados no UTFRide sendo únicos. |
| 2 | Verificação e criação não são atômicas | código | recusado | Concorrência será tratada na entrega 3, com banco de dados. O domínio institucional é externo ao sistema, e os e-mails já serão cadastrados no UTFRide sendo únicos. |
| 3 | Cadastro transfere todos os registros de usuários | código | aceito | Criar uma operação que responda apenas se existe duplicidade. |
| 4 | Teste existente do serviço falha após a mudança | código | aceito | Atualizar o teste para acompanhar a sequência de operações. |
