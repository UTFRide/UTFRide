# Parecer de Código — Tarefa 6

**Veredito:** APROVADO

Os 97 testes das cinco suítes passaram. A restrição em `AuthData` é compartilhada pela tela de detalhe e pelo serviço. Criação e cancelamento verificam a sessão antes da escrita. O cancelamento verifica também o ID, a titularidade e o estado `pending` antes do `PATCH`. O tratamento de HTTP 401 reutiliza o interceptor para encerrar apenas a sessão que iniciou a operação.

## Apontamentos (bloqueiam)

Nenhum.

## Sugestões (não bloqueiam)

- Cobrir HTTP 401 no `GET` e no `PATCH` do cancelamento, incluindo a resposta tardia de um `PATCH` após novo login. Os testes atuais de cancelamento cobrem a troca de sessão antes da escrita. `apps/web/src/app/core/services/ride-request-data.spec.ts:142`

## Observações fora do escopo deste diff

- A consulta de histórico no detalhe ainda usa o contexto padrão do interceptor. Se uma leitura antiga receber HTTP 401 após a troca de sessão e antes de o `switchMap` cancelá-la, o interceptor pode encerrar a nova sessão. O caso já foi registrado no parecer de código da Tarefa 5. `apps/web/src/app/core/services/ride-request-data.ts:268`
