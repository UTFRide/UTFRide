# Plano — Issue #5

## Decisões técnicas

- Usar as rotas autenticadas `/driver/offer` e `/driver/my-rides`, com componentes de funcionalidade em `features/driver/`; a edição e a gestão partem das ofertas do motorista. A navegação deve permitir chegar às duas telas sem implementar a pesquisa da US03.
- Usar formulários reativos e estado reativo para os formulários, a lista de ofertas, as solicitações e os avisos. A identidade do aluno autenticado deve ser disponibilizada pela camada de autenticação existente, sem expor credenciais.
- Centralizar acesso à API em serviços de `core/services/` e modelos em `core/models/`. No `json-server`, usar `rides` e `ride_requests` conforme os modelos `Ride` e `RideRequest` da arquitetura. Criar coleção `notifications` para avisos internos, com identificador, `recipientId`, `rideId`, mensagem e data de criação; filtrar os avisos pelo aluno da sessão.
- Manter `totalSeats`, `availableSeats` e `status` da oferta coerentes com as solicitações aceitas. Usar dados de teste associados a alunos e ofertas para demonstrar solicitações antes da US03, sem botão de criação fictícia e sem preencher a base normal com dados de exemplo.
- Usar o sino no cabeçalho e uma lista de avisos acessível ao aluno autenticado; seguir os protótipos indicados na spec e os tokens do projeto. Não realizar extração geral de cabeçalho ou navegação.
- A API e a sessão do MVP são simuladas: verificações no aplicativo demonstram os fluxos, mas não substituem proteção na fonte de dados. A recuperação robusta de falhas entre cancelamento e avisos fica fora do escopo aprovado; falhas de conexão e nova tentativa continuam cobertas pelo CA10.

## Tarefas

- [x] **Tarefa 1 — Publicar oferta válida**
  - Cobre: CA1, CA2 e CA3.
  - Teste primeiro: verificar a publicação de uma oferta ativa pelo aluno autenticado, os erros para campos obrigatórios e vagas fora de 1 a 4, e a rejeição de data e horário não futuros no momento de salvar. Verificar valor não negativo e a responsabilidade do motorista pela capacidade do veículo.
  - Arquivos previstos: `apps/web/src/app/features/driver/offer-ride/`, `apps/web/src/app/core/models/ride.model.ts`, `apps/web/src/app/core/services/ride-data*`, `apps/web/src/app/core/services/auth-data*` e `apps/web/src/app/app.routes.ts`.

- [x] **Tarefa 2 — Gerenciar solicitações**
  - Cobre: CA4.
  - Teste primeiro: com solicitações de exemplo, verificar aceite e rejeição individual, atualização de vagas e status esgotada, manutenção dos pedidos pendentes e impedimento de novos aceites sem vaga; verificar que a oferta esgotada não aceita novos pedidos.
  - Arquivos previstos: `apps/web/src/app/features/driver/my-rides/`, `apps/web/src/app/core/models/ride-request.model.ts`, `apps/web/src/app/core/services/ride-data*`, `apps/web/src/app/core/services/ride-request-data*` e `apps/web/src/app/app.routes.ts`.

- [x] **Tarefa 3 — Editar oferta sem passageiros confirmados**
  - Cobre: CA5.
  - Teste primeiro: verificar que o autor edita os campos e salva dados válidos antes da viagem, e que campos obrigatórios, vagas e data futura são novamente validados.
  - Arquivos previstos: `apps/web/src/app/features/driver/offer-ride/`, `apps/web/src/app/features/driver/my-rides/` e `apps/web/src/app/core/services/ride-data*`.

- [x] **Tarefa 4 — Restringir edição com passageiros confirmados**
  - Cobre: CA6.
  - Teste primeiro: verificar bloqueio de alterações de trajeto, data, horário, valor e redução de vagas; permitir aumento dentro dos limites e verificar que uma oferta esgotada retorna a ativa quando há vaga disponível.
  - Arquivos previstos: `apps/web/src/app/features/driver/offer-ride/`, `apps/web/src/app/features/driver/my-rides/` e `apps/web/src/app/core/services/ride-data*`.

- [x] **Tarefa 5 — Cancelar oferta e registrar avisos**
  - Cobre: CA7.
  - Teste primeiro: verificar o cancelamento antes da viagem, a mudança dos pedidos pendentes para cancelados e a criação de um aviso interno para cada passageiro confirmado ou com pedido anteriormente pendente.
  - Arquivos previstos: `apps/web/src/app/features/driver/my-rides/`, `apps/web/src/app/core/models/notification.model.ts`, `apps/web/src/app/core/services/ride-data*`, `apps/web/src/app/core/services/ride-request-data*`, `apps/web/src/app/core/services/notification-data*` e `apps/api/db.json`.

- [x] **Tarefa 6 — Exibir avisos internos**
  - Cobre: CA8.
  - Teste primeiro: verificar que o sino abre os avisos do aluno autenticado, incluindo cancelamentos como passageiro confirmado ou com pedido anteriormente pendente, sem exibir avisos de outro aluno.
  - Arquivos previstos: componentes do cabeçalho e avisos em `apps/web/src/app/`, `apps/web/src/app/core/services/notification-data*` e rotas ou telas autenticadas necessárias para acessar os avisos.

- [ ] **Tarefa 7 — Restringir operações por aluno**
  - Cobre: CA9.
  - Teste primeiro: verificar que outro aluno não consegue editar, cancelar ou decidir solicitações da oferta, e que um aluno bloqueado não consegue publicar; testar as operações e não apenas a visibilidade dos controles.
  - Arquivos previstos: `apps/web/src/app/features/driver/`, `apps/web/src/app/core/services/ride-data*`, `apps/web/src/app/core/services/ride-request-data*` e `apps/web/src/app/core/services/auth-data*`.

- [ ] **Tarefa 8 — Tratar falhas de conexão**
  - Cobre: CA10.
  - Teste primeiro: simular falha ao publicar, editar e cancelar; verificar mensagem, nova tentativa e preservação dos dados preenchidos enquanto a tela permanece aberta.
  - Arquivos previstos: `apps/web/src/app/features/driver/`, serviços de dados envolvidos e seus testes.

- [ ] **Tarefa 9 — Descartar alterações não salvas**
  - Cobre: CA11.
  - Teste primeiro: preencher ou alterar uma oferta sem salvar, sair e voltar, e verificar que o formulário não restaura as alterações descartadas nem publica ou altera a oferta.
  - Arquivos previstos: `apps/web/src/app/features/driver/offer-ride/` e seus testes.

## Critérios sem tarefa
