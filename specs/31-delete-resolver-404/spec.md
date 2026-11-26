---
issue: 31
status: rascunho   # rascunho | aprovada
---

# US02 / US03 — Exclusão de Oferta Cancelada (DELETE), Resolver em /rides/:id e Rota 404

## O problema

Após a migração dos serviços para a API REST do Supabase, o sistema realiza leitura (`GET`), criação (`POST`) e atualização (`PATCH`), mas ainda não executa nenhuma operação real de exclusão (`DELETE`) na interface de usuário, impedindo motoristas de removerem ofertas já canceladas da sua listagem. Além disso, a rota dinâmica `/rides/:id` inicia o carregamento dos dados da carona somente após a ativação do componente `RideDetail` (sem pré-carregamento via `Resolver` funcional), e URLs desconhecidas não possuem uma rota curinga (`**`) dedicada com página `404`, prejudicando a experiência de navegação SPA.

## A história

**Como** aluno autenticado (motorista ou passageiro) ou visitante navegando no UTFRide, **eu quero** poder excluir definitivamente ofertas de carona já canceladas, ter o detalhe da carona (`/rides/:id`) pré-carregado antes da transição de tela e visualizar uma página amigável de `404` em rotas desconhecidas, **para que** o ciclo completo de dados (incluindo `DELETE`) fique disponível e a navegação da plataforma seja previsível em qualquer endereço acessado.

Base de negócio no `docs/prd.md`: US02 (Publicação e Gestão de Oferta de Carona — exclusão definitiva de oferta cancelada), US03 (Pesquisa e Solicitação de Vaga em Carona — detalhe de carona) e RNF05 (página `404` em rotas inexistentes), além dos critérios de roteamento e integração CRUD em BaaS do `docs/checklist.md` (ID19 e ID22).

## Critérios de aceite

- [ ] **CA1 — Dado** um motorista autor autenticado com conta ativa visualizando uma oferta própria com status `cancelled` em `/driver/my-rides`, **quando** aciona **"Excluir Oferta"**, abre o modal de confirmação acessível (`role="dialog"`, fundo marcado com `[inert]`) e confirma em **"Sim, Excluir Oferta"**, **então** o `RideData` executa `DELETE /rest/v1/rides?id=eq.<rideId>` no Supabase, remove a oferta de `driverRides` (com cascata em solicitações/notificações associadas no banco), fecha o modal, limpa a seleção/solicitações da oferta removida e exibe feedback acessível de exclusão concluída (ou o estado vazio se não restarem ofertas).
- [ ] **CA2 — Dado** uma oferta própria em estado `active`, `full` ou `completed`, ou uma conta bloqueada, perfil `support` ou motorista não autor (`driverId !== currentUser.id`), **quando** a tela `/driver/my-rides` é renderizada ou ocorre tentativa direta no componente/serviço, **então** a exclusão permanece bloqueada (ação indisponível/desabilitada), nenhuma requisição `DELETE` é enviada ao servidor e chamadas diretas exibem aviso acessível de operação não permitida.
- [ ] **CA3 — Dado** o modal de confirmação de exclusão aberto em `/driver/my-rides`, **quando** o motorista clica em **"Voltar"** ou pressiona `Escape`, **então** o modal fecha sem enviar `DELETE` e devolve o foco ao botão disparador; **quando** ocorre falha de conexão (`status === 0`) ou erro do servidor no `DELETE`, **então** o indicador de envio encerra, o alerta (`role="alert"`) é exibido dentro do modal aberto e o motorista pode tentar novamente ou cancelar.
- [ ] **CA4 — Dado** um passageiro autenticado navegando para `/rides/:id`, **quando** o roteador avalia a rota filha protegida, **então** o `rideDetailResolver` funcional pré-carrega a oferta e o resumo do motorista via `RideData` antes da transição para `RideDetail` (entregando `initialDetail` via `withComponentInputBinding()` sem repetir a leitura HTTP inicial para a mesma oferta e sessão); quando a oferta não existe (incluindo UUID inválido `22P02`) ou ocorre falha de conexão/HTTP no `Resolver`, o `Resolver` retorna o estado (`not-found` ou `error`) para que `RideDetail` exiba **"Oferta de carona não encontrada"** com retorno a `/rides` ou o alerta com **"Tentar novamente"**, enquanto respostas `401` encerram a sessão via `errorInterceptor`.
- [ ] **CA5 — Dado** um visitante ou usuário autenticado acessando qualquer rota inexistente (ex.: `/nao-existe`, `/driver/desconhecida`), **quando** o roteador resolve a rota curinga (`path: '**'`), **então** carrega sob demanda (`loadComponent`) a página standalone `NotFound`, estruturada segundo o layout de cartão centralizado da tela `403` do protótipo com os tokens semânticos de `docs/design-tokens.md`, exibindo selo `404`, mensagem clara de página não encontrada e ação de retorno seguro (`/rides` se autenticado, `/` se visitante).
- [ ] **CA6 — Dado** abandono no meio (fechar/navegar durante o modal de exclusão ou trocar de rota/sessão durante o `Resolver` em `/rides/:id`), **quando** o abandono ou troca de usuário ocorre, **então** nenhuma requisição pendente sobrescreve o estado de outra sessão ou outra rota, estados transitórios de modal/erro são limpos ao sair de `MyRides` e todos os fluxos de `RideData.deleteRide`, `MyRides`, `rideDetailResolver`, `RideDetail` e `NotFound` possuem testes automatizados Vitest com dublês/mocks HTTP sem chamadas de rede reais.

## Telas do protótipo

| Tela | Arquivo em `docs/prototipo/` |
| --- | --- |
| Minhas Ofertas e Gerenciar Solicitações | `models/7._minhas_ofertas_e_gerenciar_solicita_es.html` |
| Detalhe da Oferta e Solicitar Vaga | `models/5._detalhe_da_oferta_e_solicitar_vaga.html` |
| Página Não Encontrada (404) — adaptada do cartão 403 conforme alinhamento prévio com o usuário | `models/14._acesso_negado_403_forbidden.html` |

## Fora de escopo

- Exclusão em lote de ofertas ou histórico de notificações/solicitações em outras telas (`NotificationBell`, `MyTrips`).
- Implementação de novas telas de histórias futuras (`US04 — Mural de Buscas`, `US05 — Avaliação`, `US06 — Suporte/403`).
- Criação ou alteração de tabelas, políticas RLS ou migrações no Supabase (a tabela `rides` já possui política RLS de `DELETE` para `driver_id = auth.uid()` e `ON DELETE CASCADE` em `ride_requests` e `notifications`).
- PWA offline / Service Worker e deploy em produção (escopo da Atividade 16).

## Abandono no meio

Se o motorista abrir o modal de confirmação de exclusão em `/driver/my-rides` e clicar em **"Voltar"**, pressionar `Escape` ou navegar para outra rota antes de confirmar, nenhuma requisição `DELETE` é enviada e o modal/estado de erro transitório é descartado ao sair da tela (CA3, CA6). Se a conexão cair (`status === 0`) durante o `DELETE`, o modal permanece aberto com alerta acessível e botão habilitado para nova tentativa (CA3). Na rota `/rides/:id`, se o `rideDetailResolver` sofrer falha de conexão ou demorar enquanto o usuário muda de rota/sessão, `RideDetail` preserva o botão **"Tentar novamente"** sem travar o roteamento e isola resultados de sessões anteriores (CA4, CA6). Em qualquer URL inválida ou digitada incorretamente, a rota curinga `**` evita tela em branco oferecendo retorno seguro à aplicação (CA5).

## Assume que

| Premissa | Issue que fecha |
| --- | --- |
| Nenhuma premissa provisória pendente (persistência e RLS já ativas no Supabase) | — |

## Depende de

- Issue #29 / PR #30 (`chore/29-dados-no-supabase`), já integrado à `develop`, com os serviços migrados para o Supabase REST e as regras de `DELETE` e cascata ativas em `supabase/schema.sql`.

## Dúvidas em aberto

| # | Dúvida | Quem responde |
| --- | ------ | ------------- |
