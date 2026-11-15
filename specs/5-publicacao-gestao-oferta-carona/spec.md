---
issue: 5
status: aprovada
---

# US02 — Publicação e Gestão de Oferta de Carona

## O problema

Alunos que dirigem até a universidade precisam divulgar vagas e administrar os pedidos de outros alunos. Sem esse gerenciamento, combinar trajetos, horários e custos depende de contatos dispersos e dificulta avisar os passageiros quando uma viagem é cancelada.

## A história

**Como** motorista, **eu quero** publicar uma oferta de carona informando origem, destino, data, horário, número de vagas e o valor a ser cobrado, **para que** outros alunos possam encontrar e solicitar uma carona.

## Critérios de aceite

- [ ] **CA1 — Dado** um Aluno autenticado e não bloqueado, **quando** informa origem, destino, data e horário futuros, de 1 a 4 vagas e valor por vaga válido, e confirma a publicação, **então** a Oferta de Carona é publicada com status ativa. O motorista é responsável por não oferecer mais vagas do que a capacidade do veículo; o aplicativo não verifica essa capacidade individual.
- [ ] **CA2 — Dado** um formulário de publicação com campos obrigatórios vazios ou número de vagas fora dos limites permitidos, **quando** o Aluno tenta publicar, **então** o envio é bloqueado e os erros são apontados.
- [ ] **CA3 — Dado** uma data e horário que não são futuros no momento da publicação, **quando** o Aluno tenta salvar a oferta, **então** a operação é rejeitada com aviso de data inválida.
- [ ] **CA4 — Dado** o autor de uma oferta com solicitações pendentes, **quando** consulta a oferta antes da viagem, **então** pode aceitar ou rejeitar cada solicitação individualmente. Ao aceitar uma solicitação, a vaga é ocupada; ao atingir o total de vagas, a oferta passa a esgotada e não aceita novos pedidos. Solicitações ainda pendentes permanecem nesse estado, mas não podem ser aceitas enquanto não houver vagas disponíveis.
- [ ] **CA5 — Dado** o autor de uma oferta sem passageiros confirmados, antes da viagem, **quando** edita seus dados e salva valores válidos, **então** a oferta é atualizada. As regras de campos obrigatórios, vagas e data e horário futuros também são respeitadas na edição.
- [ ] **CA6 — Dado** o autor de uma oferta com passageiros confirmados, antes da viagem, **quando** consulta a edição, **então** não pode alterar origem, destino, data, horário ou valor, nem reduzir o número de vagas; pode aumentá-lo dentro dos limites permitidos. Se a oferta estiver esgotada e o aumento disponibilizar vagas, ela volta ao status ativa.
- [ ] **CA7 — Dado** o autor de uma oferta antes da viagem, **quando** confirma seu cancelamento, **então** a oferta é cancelada, as solicitações pendentes passam para canceladas e cada passageiro confirmado ou com solicitação anteriormente pendente recebe um aviso interno de cancelamento.
- [ ] **CA8 — Dado** um passageiro autenticado com aviso de cancelamento, **quando** abre o sino de notificações no cabeçalho, **então** visualiza o aviso da oferta cancelada para a qual estava confirmado ou tinha solicitação pendente. Um aluno não visualiza avisos de outros alunos pelo aplicativo.
- [ ] **CA9 — Dado** um Aluno que não é o autor da oferta, **quando** tenta editá-la, cancelá-la ou decidir sobre suas solicitações, **então** a operação é impedida. Alunos bloqueados não podem ofertar caronas.
- [ ] **CA10 — Dado** uma falha de conexão ao publicar, editar ou cancelar uma oferta, **quando** a operação falha, **então** o Aluno é informado e pode tentar novamente; os dados preenchidos permanecem disponíveis enquanto a tela estiver aberta.
- [ ] **CA11 — Dado** um formulário de oferta com alterações ainda não salvas, **quando** o Aluno sai sem salvar e retorna, **então** os dados não salvos podem ser descartados.

## Telas do protótipo

| Tela                                    | Arquivo em `docs/prototipo/`                            |
| --------------------------------------- | ------------------------------------------------------- |
| Oferecer Carona (Motorista)             | `models/6._oferecer_carona_motorista.html`              |
| Minhas Ofertas e Gerenciar Solicitações | `models/7._minhas_ofertas_e_gerenciar_solicita_es.html` |

O sino de notificações fica no cabeçalho, à esquerda da foto do aluno, no mesmo padrão dos demais ícones. A lista de avisos internos foi autorizada pelo usuário como complemento ao protótipo; não há tela de notificações no índice. A referência do protótipo a SMS não faz parte desta história.

## Fora de escopo

- Pesquisa de ofertas e criação ou cancelamento de solicitações pelo passageiro: US03.
- Notificações por SMS ou push no celular com o aplicativo fechado.
- Pagamento integrado, chat em tempo real e rastreamento por GPS.
- Extração geral de cabeçalhos e navegação existentes em componentes compartilhados.
- Tratamento robusto de falhas entre o cancelamento e a geração dos avisos, a ser discutido posteriormente com o grupo.
- Proteção definitiva dos dados na fonte de dados, prevista para a Entrega 3.

## Abandono no meio

Ao sair de um formulário sem salvar, o Aluno pode perder os dados não salvos (CA11). Se a conexão falhar durante publicação, edição ou cancelamento, o aplicativo informa a falha e permite nova tentativa, mantendo o preenchimento enquanto a tela estiver aberta (CA10).

## Assume que

No MVP, a base simulada prevista na arquitetura contém ofertas, solicitações e avisos. As verificações de acesso no aplicativo demonstram os fluxos, mas a API simulada não oferece proteção equivalente à prevista para a Entrega 3. Solicitações de exemplo, ligadas a uma oferta e a um passageiro de teste, podem ser inseridas para demonstrar aceite e rejeição antes da US03; não constituem uma funcionalidade de criação de pedidos fictícios no aplicativo. A US03 criará pedidos pelo fluxo do passageiro.

| Premissa | Issue que fecha |
| -------- | --------------- |

## Depende de

- Issue #4 — Cadastro e Autenticação Institucional, já integrada à `develop`.

## Dúvidas em aberto

| #   | Dúvida | Quem responde |
| --- | ------ | ------------- |
