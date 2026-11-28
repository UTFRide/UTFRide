# Parecer de Código — Tarefa 7

**Veredito:** APROVADO

A API retorna `500` quando a gravação do cancelamento falha, mantém o pedido `pending` nas leituras e no armazenamento e aceita uma nova tentativa. A fila compartilhada pela instância do servidor publica a nova versão do JSON após a gravação. Os testes confirmam que o primeiro estado gravado prevalece nas duas ordens de concorrência com o aceite e a recusa do motorista, e que a atualização de outra coleção preserva o pedido após a falha do cancelamento.

Os 12 testes da API passaram. A verificação em memória também confirmou as respostas de `POST`, `PUT`, `PATCH` e `DELETE` delegados ao `json-server`, incluindo a preservação dos registros dependentes quando a gravação de um `DELETE` falha.

## Apontamentos (bloqueiam)

Nenhum.

## Sugestões (não bloqueiam)

- Restringir a fila à decisão e à gravação. Em `apps/api/server.mjs:177`, a rota delegada entra na fila antes de ler o corpo HTTP. Em uma verificação em memória, um `POST` com corpo ainda em envio adiou um cancelamento já recebido até o fim desse envio.

## Observações fora do escopo deste diff

Nenhuma.
