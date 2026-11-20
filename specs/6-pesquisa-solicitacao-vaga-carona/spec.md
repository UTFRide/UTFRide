---
issue: 6
status: rascunho
---

# US03 — Pesquisa e Solicitação de Vaga em Carona

## O problema

Alunos da UTFPR que dependem de transporte para chegar ao campus precisam encontrar caronas compatíveis com seu trajeto e horário sem recorrer a grupos dispersos ou tarifas imprevisíveis de aplicativos comerciais. Sem uma busca filtrada por trajeto e data, detalhes claros da oferta e controle de solicitações pelo passageiro, fica difícil reservar uma vaga com segurança, evitar pedidos duplicados ou em caronas já lotadas e desistir de uma solicitação antes da confirmação do motorista.

## A história

**Como** passageiro, **eu quero** pesquisar caronas disponíveis e solicitar uma vaga, **para que** eu possa encontrar uma carona compatível com meu trajeto e horário.

## Critérios de aceite

- [ ] **CA1 — Dado** um Aluno autenticado na tela de busca (`/rides`), organizada sob navegação aninhada (`RidesLayout` com `<router-outlet />` e rotas filhas em `children`: `''`, `'my-trips'` e `':id'`), **quando** informa filtros de origem, destino ou data através do componente filho de filtros sincronizado por two-way data binding com `model()` (`[(...)]`), **então** os Signals de filtro disparam consulta reativa ao `HttpClient` via `toObservable()` -> `debounceTime` -> `distinctUntilChanged` -> `switchMap` -> `toSignal()` em Service de `core/services/`, exibindo apenas Ofertas de Carona com status ativa (`active`), horário futuro, pelo menos uma vaga disponível (`availableSeats > 0`) e cujo motorista não seja o próprio aluno autenticado.
- [ ] **CA2 — Dado** um Aluno autenticado utilizando os campos de filtro de origem ou destino na busca, **quando** o Service dedicado em `core/services/` consulta assincronamente via `GET` a API pública de Localidades do IBGE (municípios do Paraná), **então** as localidades retornadas são oferecidas como sugestões de preenchimento nos filtros; caso a API pública falhe ou o dispositivo esteja offline, o erro é tratado silenciosamente sem bloquear a busca nem a digitação em texto livre.
- [ ] **CA3 — Dado** que nenhuma Oferta de Carona ativa com vagas disponíveis atende aos filtros pesquisados (ou não existem ofertas elegíveis), **quando** a consulta é concluída, **então** o sistema exibe um estado de lista vazia com mensagem clara e ação para limpar os filtros.
- [ ] **CA4 — Dado** um Aluno autenticado na listagem de caronas, **quando** seleciona uma oferta para visualizar detalhes ou reservar, **então** navega para a rota dinâmica `/rides/:id` (com `withComponentInputBinding()` habilitado em `provideRouter` no `app.config.ts`), o componente de detalhe recebe `id` diretamente via `input.required<string>()`, carrega os dados reais da oferta e do motorista (origem, destino, data/horário, ponto de referência quando informado, vagas disponíveis e totais, valor por vaga formatado com pipe, nome/iniciais/avaliação média do motorista) e exibe o status condicional da oferta/solicitação usando `@switch` com `@case` e `@default`.
- [ ] **CA5 — Dado** um Passageiro autenticado e não bloqueado visualizando em `/rides/:id` uma oferta ativa, futura, de outro motorista, com vagas disponíveis e sem solicitação ativa prévia, **quando** aciona a solicitação de vaga, **então** o painel de confirmação da solicitação é carregado sob demanda usando `@defer (on interaction)` com `@placeholder`; ao confirmar, o Service revalida o estado atual da oferta na fonte de dados, cria uma Solicitação de Carona com status pendente (`pending`) vinculada ao passageiro autenticado e atualiza a tela para o estado aguardando aprovação do motorista.
- [ ] **CA6 — Dado** que todas as vagas de uma oferta foram preenchidas (`availableSeats <= 0` ou status `full`) — seja ao abrir diretamente `/rides/:id` ou entre a abertura da tela e o clique de confirmação —, **quando** o Passageiro visualiza ou tenta confirmar a solicitação, **então** o sistema impede a criação da solicitação e informa claramente que a carona está lotada (RN05). Ofertas canceladas, concluídas ou com horário passado também bloqueiam solicitação com aviso correspondente.
- [ ] **CA7 — Dado** um Passageiro que já possui uma solicitação ativa (`pending` ou `accepted`) para aquela mesma Oferta de Carona, **quando** acessa `/rides/:id` ou tenta solicitar novamente, **então** o sistema bloqueia a duplicidade e exibe o status atual da solicitação via `@switch` (RN04). Se o aluno autenticado for o próprio motorista da oferta, a solicitação é bloqueada informando que ele é o autor da oferta. Caso uma solicitação anterior do passageiro na mesma oferta tenha sido cancelada ou rejeitada, uma nova solicitação volta a ser permitida enquanto a oferta estiver ativa com vagas.
- [ ] **CA8 — Dado** um usuário com conta bloqueada (`isBlocked: true`) ou com perfil administrativo (`role: 'support'`), **quando** tenta solicitar uma vaga ou cancelar uma solicitação pela tela ou pelo Service, **então** a operação é bloqueada com aviso de restrição de acesso (RN07 / RN08).
- [ ] **CA9 — Dado** um Passageiro autenticado com solicitações registradas, **quando** acessa Minhas Viagens (`/rides/my-trips`, rota filha no layout aninhado de `rides`), **então** visualiza suas próprias solicitações organizadas por estado (Pendentes, Confirmadas e Histórico/Encerradas — incluindo canceladas, rejeitadas e concluídas, sem formulário de avaliação) com badges condicionais via `@switch`. Nas solicitações confirmadas (`accepted`), o WhatsApp do motorista fica visível; nas solicitações pendentes (`pending`), o passageiro pode cancelar a solicitação voluntariamente, alterando seu status para `cancelled` na fonte de dados sem afetar solicitações de outros passageiros.
- [ ] **CA10 — Dado** uma falha de conexão ao carregar a listagem de ofertas, o detalhe `/rides/:id`, a tela de Minhas Viagens, ao confirmar uma solicitação ou ao cancelar uma solicitação pendente — ou o acesso a um `:id` inexistente —, **quando** a operação falha, **então** o sistema informa a falha com clareza, não cria registros duplicados e oferece opção de tentar novamente ou voltar para a busca.
- [ ] **CA11 — Dado** que o Passageiro preencheu filtros na busca ou abriu o painel de confirmação da solicitação sem confirmar, **quando** sai da tela ou fecha a aba e retorna, **então** os filtros preenchidos e o estado não confirmado podem ser descartados sem registrar nenhuma solicitação.

## Telas do protótipo

| Tela                                              | Arquivo em `docs/prototipo/`                          |
| ------------------------------------------------- | ----------------------------------------------------- |
| Buscar Caronas (Home)                             | `models/4._buscar_caronas_home.html`                  |
| Detalhe da Oferta e Solicitar Vaga (Bottom Sheet) | `models/5._detalhe_da_oferta_e_solicitar_vaga.html`   |
| Minhas Viagens (Passageiro)                       | `models/8._minhas_viagens_passageiro.html`            |

**Alinhamento com o PRD e `docs/architecture.md`:** o PRD prevalece sobre elementos demonstrativos do protótipo. A listagem de busca exibe apenas ofertas ativas com vagas disponíveis (o estado de carona lotada da RN05 aparece em `/rides/:id`). O painel de "Simulação de Cenários" da tela 5 é meramente demonstrativo do protótipo e não entra na aplicação. Campos ausentes do modelo de domínio (`docs/architecture.md` §5) — como mapa/distância estimada, curso/departamento, modelo/placa do veículo e fotos externas — não são inventados; o avatar utiliza iniciais (`InitialsPipe`) e as observações da oferta usam o campo `notes`. Na tela 8, a aba de viagens encerradas/concluídas é apenas de visualização, sem os botões de avaliação e denúncia (escopo de US05 e US06).

## Fora de escopo

- Publicação de Busca Ativa de Carona no mural de buscas: US04.
- Avaliação mútua pós-viagem e denúncia ao suporte a partir de viagens concluídas: US05 e US06.
- Unificação do layout/cabeçalho das rotas de motorista (`/driver/offer`, `/driver/my-rides`) sob o layout aninhado (permanecem como entregues na US02).
- Pagamento integrado, chat em tempo real, mapa/GPS, compartilhamento externo e alerta "Avise-me se surgir vaga".
- Campos de veículo, curso/departamento ou foto externa não definidos em `docs/architecture.md`.
- Proteção definitiva na camada de dados por Row Level Security (RLS) e sessão JWT no Supabase, previstas para a Entrega 3.

## Abandono no meio

Se o Passageiro preencher filtros na busca e sair ou fechar a aba, os filtros podem ser descartados ao retornar (CA11). Se abrir o painel de confirmação de solicitação sob demanda (`@defer`) e desistir antes de confirmar, nenhuma solicitação é criada (CA11). Se a conexão cair durante a busca, carregamento de `/rides/:id`, listagem de Minhas Viagens, criação ou cancelamento de solicitação, a tela informa o erro e permite tentar novamente sem travar nem duplicar pedidos (CA10). Se o `:id` da URL não existir, a tela de detalhe informa oferta não encontrada com link de retorno para `/rides` (CA10). Se a última vaga for ocupada enquanto o passageiro analisa o detalhe, a revalidação no momento da confirmação impede a criação do pedido e informa carona lotada (CA6). Se a API pública do IBGE estiver indisponível ou offline, a busca continua funcionando normalmente em texto livre (CA2).

## Assume que

No MVP (Entrega 2), as coleções `rides`, `ride_requests` e `users` continuam persistidas no `json-server` (`apps/api/db.json`) e o acesso permanece isolado em Services de `core/services/`, para migração transparente ao Supabase na Entrega 3. Esta história substitui a tela provisória `RideList` (`// TODO #4`) e fecha a criação provisória de solicitações da US02 (`// TODO #6` em `RideRequestData.createRequest`), conectando-a ao fluxo completo do passageiro com validações de duplicidade (RN04), esgotamento (RN05), auto-solicitação e restrições de usuário bloqueado/suporte (RN07/RN08).

| Premissa | Issue que fecha |
| -------- | --------------- |

## Depende de

- Issue #4 — Cadastro e Autenticação Institucional, já integrada à `develop`.
- Issue #5 — Publicação e Gestão de Oferta de Carona, já integrada à `develop`.

## Dúvidas em aberto

| #   | Dúvida | Quem responde |
| --- | ------ | ------------- |
