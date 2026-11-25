---
issue: 26
status: aprovada
---

# US01 — Login e Cadastro com Supabase Auth, Guard e AuthInterceptor

## O problema

No MVP (Entrega 2), o cadastro e o login do UTFRide são simulados no `json-server` com sessão mantida apenas em memória no navegador: ao recarregar a página (`F5`), o aluno perde a sessão imediatamente; não há emissão real de token JWT para autenticar chamadas HTTP; e não existe ação de saída ("Sair") disponível na interface. Sem migrar a identidade para o Supabase Auth com restauração de sessão, guard de rota compatível com sessão assíncrona e `authInterceptor` enviando `Authorization: Bearer <token>`, a aplicação não possui autenticação real nem prepara a base segura para a migração das tabelas com RLS na etapa seguinte.

## A história

**Como** aluno visitante da UTFPR, **eu quero** realizar meu cadastro e autenticar meu acesso usando uma matrícula ativa e um e-mail institucional, **para que** eu possa acessar as funcionalidades do sistema em um ambiente seguro e restrito à comunidade acadêmica.

## Critérios de aceite

- [ ] **CA1 — Dado** um visitante na tela de cadastro (`/register`) preenchendo nome, e-mail institucional (`@alunos.utfpr.edu.br`), matrícula, WhatsApp opcional, senha válida (mínimo 6 caracteres), confirmação igual e aceite dos termos, **quando** submete o formulário, **então** o `AuthData` verifica duplicidade no `json-server`, cria a conta no Supabase Auth (`signUp`) gravando os metadados (`name`, `registrationNumber`, `whatsapp`, `role: 'student'`, `isBlocked: false`), sincroniza o perfil correspondente em `users` no `json-server` sem persistir senha em texto puro quando dispensável, encerra qualquer sessão automática criada pelo `signUp` (`signOut`) e redireciona para `/login` exibindo aviso em português de conta criada com sucesso.
- [ ] **CA2 — Dado** um visitante em `/register` informando e-mail fora do domínio `@alunos.utfpr.edu.br`, senha com menos de 6 caracteres, senhas divergentes, ou e-mail/matrícula já cadastrados (no `json-server` ou retornando usuário já registrado pelo Supabase Auth), **quando** tenta submeter, **então** o formulário bloqueia o envio ou exibe mensagem clara em português sem criar conta nem redirecionar.
- [ ] **CA3 — Dado** um aluno com conta ativa cadastrada no Supabase Auth na tela de login (`/login`), **quando** informa e-mail institucional e senha corretos e submete, **então** o `AuthData` autentica via `signInWithPassword`, armazena o token JWT (`access_token`) e o usuário autenticado (sincronizando/carregando o perfil correspondente no `json-server` para manter compatibilidade com caronas e solicitações, bloqueando acesso se `isBlocked: true` conforme RN07) e redireciona para `/rides`.
- [ ] **CA4 — Dado** um visitante em `/login` informando credenciais inválidas ou enfrentando erro/indisponibilidade do Supabase Auth ou do `json-server`, **quando** submete o login, **então** o sistema encerra o estado de carregamento (`loading` volta a `false`) e exibe mensagem amigável em português (_"E-mail ou senha incorretos."_ ou aviso de falha de conexão) sem expor detalhes internos de segurança nem manter sessão parcial.
- [ ] **CA5 — Dado** um aluno previamente autenticado com sessão persistida no navegador pelo Supabase Auth, **quando** recarrega a página (`F5`) diretamente em uma rota protegida (`/rides`, `/rides/my-trips`, `/rides/:id`, `/driver/offer` ou `/driver/my-rides`), **então** o `AuthData` restaura a sessão ativa (`getSession`) e o token JWT antes de o `authGuard` bloquear o acesso, mantendo o aluno autenticado na rota solicitada.
- [ ] **CA6 — Dado** um visitante não autenticado (ou após recarregar sem sessão válida no Supabase Auth), **quando** acessa `/`, `/login` ou `/register`, **então** a navegação é permitida; **quando** tenta acessar qualquer rota protegida (`/rides`, `/rides/my-trips`, `/rides/:id`, `/driver/offer` ou `/driver/my-rides`), **então** o `authGuard` funcional bloqueia a entrada e redireciona para `/login`.
- [ ] **CA7 — Dado** um aluno autenticado com token JWT (`access_token`) ativo no `AuthData`, **quando** o `HttpClient` envia requisições para a API configurada em `environment.apiUrl` (`http://localhost:3000`), **então** o `authInterceptor` funcional registrado em `app.config.ts` acrescenta o cabeçalho `Authorization: Bearer <access_token>`; **quando** não há sessão ativa ou a requisição aponta para uma API externa pública (como a API de localidades do IBGE em `servicodados.ibge.gov.br`), **então** o cabeçalho `Authorization` **não** é enviado.
- [ ] **CA8 — Dado** um aluno autenticado visualizando qualquer tela com cabeçalho autenticado (`RidesLayout`, `MyRides` ou `OfferRide`), **quando** aciona o botão **Sair** posicionado no cabeçalho ao lado do avatar do aluno, **então** o sistema executa `signOut` no Supabase Auth, limpa o estado da sessão e o token JWT no `AuthData` e redireciona para `/login`, voltando a bloquear rotas protegidas pelo `authGuard`.
- [ ] **CA9 — Dado** um visitante ou aluno que abandona o formulário de cadastro/login antes de enviar, sofre queda de rede durante cadastro/login/logout/restauração de sessão ou recebe HTTP `401` pelo `errorInterceptor`, **quando** o evento ocorre, **então** dados não enviados podem ser descartados ao retornar, falhas de rede não deixam a interface travada em carregamento e o `401` encerra a sessão via `AuthData.logout()` redirecionando para `/login`.
- [ ] **CA10 — Dado** os arquivos de ambiente (`apps/web/src/environments/environment.ts` e `environment.development.ts`) e a suíte de testes unitários (Vitest), **quando** inspecionados e executados, **então** os ambientes contêm apenas `apiUrl`, `supabaseUrl` e `supabasePublishableKey` (`sb_publishable_...`) — sem nenhuma chave secreta (`sb_secret_...`) no repositório —, o cliente `@supabase/supabase-js` permanece encapsulado em `core/services/` e todos os testes executam integralmente com dublês/mocks sem chamadas de rede reais ao Supabase.

## Telas do protótipo

| Tela                                                              | Arquivo em `docs/prototipo/`                            |
| ----------------------------------------------------------------- | ------------------------------------------------------- |
| Landing Page (Visitante)                                          | `models/1._landing_page_visitante.html`                 |
| Cadastro de Aluno (Institucional)                                 | `models/2._cadastro_de_aluno.html`                      |
| Login e Estados de Erro                                           | `models/3._login_e_estados_de_erro.html`                |
| Buscar Caronas (Home) — cabeçalho com ação Sair                   | `models/4._buscar_caronas_home.html`                    |
| Oferecer Carona (Motorista) — cabeçalho com ação Sair             | `models/6._oferecer_carona_motorista.html`              |
| Minhas Ofertas e Gerenciar Solicitações — cabeçalho com ação Sair | `models/7._minhas_ofertas_e_gerenciar_solicita_es.html` |

**Alinhamento com o PRD e `docs/design-tokens.md`:** as telas de Landing, Cadastro e Login já existem implementadas seguindo os tokens semânticos de `docs/design-tokens.md`. Nesta história, preserva-se o layout atual, adicionando apenas o aviso de conta criada em `/login` (quando vindo de `/register`) e o botão discreto **Sair** ao lado do avatar nos cabeçalhos autenticados (`RidesLayout`, `MyRides` e `OfferRide`), estritamente com tokens semânticos do Design System.

## Fora de escopo

- Recuperação de senha ("Esqueci minha senha") e confirmação real de e-mail via link (explicitamente fora do escopo da US01 no `docs/prd.md`; `Confirm email` permanece desabilitado no Supabase em desenvolvimento).
- Migração das coleções de domínio (`users`, `rides`, `ride_requests`, `notifications`) para tabelas PostgreSQL no Supabase, políticas de Row Level Security (RLS), `Resolver` de rota e página 404 (escopo da Atividade 15).
- Painel administrativo de suporte (`/support`) e `supportGuard` (escopo da US06).
- Recursos de PWA offline e deploy público na `main` (escopo da Atividade 16).
- Login social (Google/GitHub) ou integração com SIGA da UTFPR.

## Abandono no meio

Se o visitante preencher parcialmente `/register` ou `/login` e navegar para fora ou fechar a aba antes de enviar, os dados não submetidos podem ser descartados sem criar conta nem iniciar sessão (CA9). Se a conexão cair no meio do `signUp`, `signInWithPassword`, `signOut` ou na sincronização do perfil com o `json-server`, a operação encerra o estado de carregamento (`loading = false`), exibe mensagem em português e permite nova tentativa sem deixar sessão meio autenticada (CA4, CA9). Se o aluno recarregar a página (`F5`) enquanto está em uma rota protegida, a inicialização aguarda a leitura da sessão persistida (`getSession`) antes de o `authGuard` decidir, evitando falsos redirecionamentos para `/login`; caso a sessão tenha expirado ou sido limpa, o `authGuard` redireciona para `/login` (CA5, CA6). Se o backend responder `401`, o `errorInterceptor` aciona `AuthData.logout()` e leva para `/login` (CA9).

## Assume que

Durante esta etapa transitória (Atividade 14), os dados de domínio (`rides`, `ride_requests`, `notifications` e perfis espelhados em `users` para consultas como `/driver-summaries` e `/passenger-trip-summaries`) continuam persistidos no `json-server` (`apps/api/db.json`), enquanto identidade, senha e emissão do JWT passam para o Supabase Auth. Os trechos de sincronização provisória do perfil autenticado com `users` no `json-server` devem levar `// TODO` referenciando a migração das tabelas para o Supabase na Atividade 15.

| Premissa                                                                                                                                                                   | Issue que fecha                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Coleções de domínio (`users`, `rides`, `ride_requests`, `notifications`) continuam no `json-server` com espelhamento do perfil autenticado até a migração de tabelas e RLS | Issue da Atividade 15 (a abrir após fechamento da #26) |

## Depende de

- PR #25 (`chore/supabase-auth`) com atualização de `docs/architecture.md`, já integrado à `develop`.
- Issues #4, #5 e #6 (US01 MVP, US02 e US03), já integradas à `develop`.

## Dúvidas em aberto

| #   | Dúvida | Quem responde |
| --- | ------ | ------------- |
