# Parecer de Código — Tarefa 8

**Veredito:** APONTAMENTOS

## Apontamentos (bloqueiam)

1. **Uma leitura antiga do detalhe pode encerrar a sessão nova** — [ride-data.ts](/C:/Users/Geovane/Desktop/UTFRide/apps/web/src/app/core/services/ride-data.ts:330)  
   O `docs/architecture.md` §2.1 mantém a sessão do MVP no frontend e o §2.4 atribui ao interceptor o encerramento da sessão em caso de 401. A seleção do detalhe usa apenas o ID da oferta e o contador de retentativas. Se o `GET /rides/:id` da sessão A responder após o login da sessão B, a resposta ainda dispara `GET /driver-summaries`. O interceptor associa essa consulta à sessão B quando ela é disparada. Um 401 nessa consulta então pode encerrar a sessão B e redirecioná-la ao login. A busca já verifica a identidade da sessão antes de disparar a mesma consulta auxiliar.

2. **A retentativa pode recuperar a solicitação e deixar a disponibilidade da oferta desatualizada** — [ride-request-data.ts](/C:/Users/Geovane/Desktop/UTFRide/apps/web/src/app/core/services/ride-request-data.ts:550)  
   O `docs/architecture.md` §5 define `availableSeats` e `status` como os campos que representam vagas disponíveis e estado da oferta. Os critérios CA4 e CA6 exigem que o detalhe exiba esses dados e informe a lotação. Se o POST for gravado, a resposta se perder e o motorista confirmar a solicitação ocupando a última vaga antes da retentativa, a leitura encontra o pedido `accepted` e encerra a operação sem revalidar a oferta. O detalhe passa a mostrar “Solicitação confirmada” junto de “Carona ativa” e da contagem de vagas anterior.

## Sugestões (não bloqueiam)

- Cobrir a falha da consulta auxiliar após o `409 active-ride-request`. O teste atual cobre a leitura bem-sucedida após o conflito. Um caso adicional pode verificar o aviso e a recuperação sem novo POST enquanto a consulta da solicitação falha.

## Verificação

Passaram os 118 testes dos cinco arquivos Angular, os dois testes do pré-teste e os 15 testes da API. A suíte HTTP passou com autorização para a conexão local. `git diff --check` passou.

## Observações fora do escopo deste diff

Nenhuma.
