---
issue: 37
status: rascunho   # rascunho | aprovada
---

# US07 — Aviso e Comportamento Offline (PWA)

## O problema

Embora o UTFRide já possua `manifest.webmanifest`, ícones e Service Worker configurados para entrega dos arquivos estáticos da interface, o aplicativo ainda não detecta nem comunica ao aluno ou visitante quando o dispositivo perde conexão com a internet. Hoje, ao ficar offline ou abrir o PWA instalado em modo avião, a restauração de sessão tenta consultar o servidor e redireciona o usuário para `/login`, as listagens exibem falhas genéricas sem aproveitar os últimos dados consultados e botões de cadastro, login, publicação, gestão ou solicitação de vagas continuam habilitados até falharem na rede.

## A história

**Como** aluno ou visitante acessando o aplicativo, **eu quero** visualizar um aviso claro quando o dispositivo estiver sem conexão com a internet, consultar os últimos dados salvos localmente e ver as ações que dependem do servidor desabilitadas com explicação, **para que** eu saiba imediatamente por que operações remotas estão bloqueadas e possa acompanhar minhas informações já carregadas mesmo sem rede.

Base de negócio no `docs/prd.md`: US07 (Aviso e Comportamento Offline PWA), RNF02 (Arquitetura PWA), `docs/design-tokens.md` (seção *Identidade PWA — ID3*) e `docs/checklist.md` (ID3).

## Critérios de aceite

- [ ] **CA1 — Dado** que o visitante ou aluno acessa qualquer tela do aplicativo (`/`, `/login`, `/register`, `/rides`, `/rides/my-trips`, `/rides/:id`, `/driver/offer`, `/driver/my-rides` ou rota `404`), **quando** `navigator.onLine` é falso ou ocorre o evento `offline` do navegador, **então** um banner persistente no topo da aplicação (`role="status"`, estilo **Opção C** com fundo `bg-primaria`, texto `text-texto` e borda `border-b border-borda`) exibe o texto **"Você está offline. Visualizando dados salvos"**; **quando** ocorre o evento `online` (`navigator.onLine` verdadeiro), **então** o banner desaparece automaticamente sem recarregar a página.
- [ ] **CA2 — Dado** que o aplicativo está offline nas telas públicas (`/login` e `/register`), **quando** o visitante visualiza os formulários de autenticação ou cadastro (ou tenta submeter via teclado/Enter), **então** os botões de envio permanecem desabilitados, a explicação **"Conecte-se à internet novamente para habilitar todas as funções do app UTFRide novamente"** é exibida de forma acessível junto à ação e nenhuma chamada de rede ao Supabase ou RPC é disparada.
- [ ] **CA3 — Dado** que um aluno já possuía sessão autenticada no dispositivo enquanto estava conectado, **quando** o aplicativo perde rede ou é reaberto do zero em modo offline (`restoreSession()`), **então** o `AuthData` restaura o acesso somente-leitura a partir do perfil salvo em cache local (sem senha, vinculado ao usuário da sessão local do Supabase) para que o `authGuard` libere `/rides`, `/rides/my-trips` e `/driver/my-rides` sem redirecionar para `/login`; **quando** não existe sessão nem perfil em cache offline, rotas protegidas continuam redirecionando para `/login`.
- [ ] **CA4 — Dado** que o aluno conectado carregou previamente ofertas disponíveis (`/rides`), seus detalhes (`/rides/:id`), suas viagens (`/rides/my-trips`), suas ofertas/solicitações (`/driver/my-rides`) ou notificações (`NotificationBell`), **quando** o aplicativo fica offline ou é reaberto sem rede com a mesma sessão em cache, **então** os serviços de dados exibem os últimos registros salvos em cache local em vez de falhar em branco, `LocationData` não dispara buscas remotas ao IBGE e em `/rides/:id` uma oferta ausente no cache exibe aviso claro de indisponibilidade sem internet (com retorno seguro a `/rides`).
- [ ] **CA5 — Dado** que o aluno está offline em `/rides`, `/rides/:id`, `/rides/my-trips`, `/driver/offer`, `/driver/my-rides` ou no `NotificationBell`, **quando** visualiza ações ou formulários que dependem do servidor (solicitar vaga, cancelar solicitação pendente, publicar ou editar oferta, cancelar ou excluir oferta, aceitar ou rejeitar solicitação, atualizar/buscar notificações ou tentar novamente carregamento remoto), **então** todas essas ações ficam desabilitadas/bloqueadas acompanhadas da explicação **"Conecte-se à internet novamente para habilitar todas as funções do app UTFRide novamente"**, exibindo em `NotificationBell` apenas as notificações já em cache e impedindo requisições HTTP de escrita.
- [ ] **CA6 — Dado** que o aluno está offline no cabeçalho autenticado (`RidesLayout`) e aciona o botão **"Sair"**, **quando** confirma no diálogo acessível de confirmação (*"Você realmente deseja sair? Até se conectar novamente, você não terá acesso ao UTFRide."*), **então** a sessão local e os caches privados do usuário são limpos localmente sem travar na ausência de rede e o aluno é redirecionado para `/login`; se cancelar ou pressionar `Escape`, permanece autenticado visualizando os dados salvos.
- [ ] **CA7 — Dado** abandono no meio (tentativa de submissão no momento exato da queda de rede, troca de usuário entre sessões ou reconexão enquanto está em uma tela autenticada), **quando** a conexão volta (`online`) ou a rota/sessão muda, **então** o estado reativo reabilita automaticamente as ações e formulários (respeitando validade e permissões), nenhum cache de um usuário vaza para outra conta após logout/troca de sessão, e todos os serviços, guard, resolver e componentes alterados possuem testes automatizados Vitest simulando `offline`/`online` sem chamadas reais de rede.

## Telas do protótipo

Não há tela dedicada exclusivamente ao estado offline em `docs/prototipo/README.md`. Conforme alinhado com o usuário, o banner global no topo (Opção C: `bg-primaria`, `text-texto`, `border-b border-borda`) e os estados desabilitados com explicação aplicam-se sobre as telas já mapeadas no índice usando os tokens de `docs/design-tokens.md`:

| Tela | Arquivo em `docs/prototipo/` |
| --- | --- |
| Landing Page (Visitante) | `models/1._landing_page_visitante.html` |
| Cadastro de Aluno (Institucional) | `models/2._cadastro_de_aluno.html` |
| Login e Estados de Erro | `models/3._login_e_estados_de_erro.html` |
| Buscar Caronas (Home) | `models/4._buscar_caronas_home.html` |
| Detalhe da Oferta e Solicitar Vaga | `models/5._detalhe_da_oferta_e_solicitar_vaga.html` |
| Oferecer Carona (Motorista) | `models/6._oferecer_carona_motorista.html` |
| Minhas Ofertas e Gerenciar Solicitações | `models/7._minhas_ofertas_e_gerenciar_solicita_es.html` |
| Minhas Viagens (Passageiro) | `models/8._minhas_viagens_passageiro.html` |
| Página Não Encontrada (`404`, adaptada do cartão `403`) | `models/14._acesso_negado_403_forbidden.html` |

## Fora de escopo

- Fila de sincronização em segundo plano (*Background Sync*) para enfileirar publicações, edições, cancelamentos ou solicitações feitas offline e enviá-las depois.
- Cache offline de páginas de histórias ainda não implementadas (`US04` Mural de Buscas, `US05` Avaliações e `US06` Moderação/Suporte).
- Alteração de tabelas, políticas RLS, RPCs ou configurações do Supabase e do Service Worker de build estático (`ngsw-config.json`), já tratados no setup/manutenção.

## Abandono no meio

- **Queda de rede durante uso ou tentativa de envio:** o banner persistente aparece imediatamente e bloqueia novos envios; tentativas disparadas via teclado ou exatamente na transição offline são barradas antes de chamar a rede, exibindo a explicação configurada (CA1, CA2, CA5, CA7).
- **Reabertura do PWA instalado em modo avião:** o usuário autenticado anteriormente não é expulso para `/login` por falha de `GET /rest/v1/users`; o `AuthData` restaura o usuário a partir do cache local validado pela sessão local e entrega as últimas listagens em cache para consulta somente-leitura (CA3, CA4).
- **Saída voluntária offline (`Sair`):** como sair offline impede novo login até a conexão voltar, o diálogo de confirmação previne saída acidental; se o aluno cancelar (`Escape` ou botão de voltar), continua na sessão em cache, e se confirmar, limpa sessão e cache privado sem travar em `signOut` de rede (CA6, CA7).
- **Troca de conta no mesmo dispositivo:** ao encerrar sessão ou trocar de conta, o cache local privado da sessão anterior é limpo ou isolado por `userId`, evitando exibir dados de outro aluno offline (CA6, CA7).

## Assume que

| Premissa | Issue que fecha |
| --- | --- |
| Nenhuma premissa temporária; toda a detecção de conectividade e persistência em cache local é entregue nesta história. | — |

## Dúvidas em aberto

| # | Dúvida | Quem responde |
| --- | --- | --- |
| — | Nenhuma dúvida em aberto. | — |
