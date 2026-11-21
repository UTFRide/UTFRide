# UTFRide

UTFRide é um aplicativo de caronas universitárias, que conecta estudantes que desejam ir para a universidade no mesmo trajeto, visando reduzir o custo com transporte e melhorar a qualidade de vida.

## Autores

- Eduardo kowalczyk - [GitHub](https://github.com/kowalczykedu)
- Geovane Galan - [GitHub](https://github.com/geovanegalan)
- Luis Felipe Ramos - [GitHub](https://github.com/fehliperamos4)

## Documentação Técnica

- [PRD](docs/prd.md) · [Architecture/SSD](docs/architecture.md) · [Checklist](docs/checklist.md)
- **Protótipo (Stitch/Figma/Repo):** [Link](https://www.figma.com/design/QWpCo1rfJqA466WFe8khU2/Sem-t%25C3%25ADtulo?node-id=0-1&p=f&t=vU1DkUN95OiedBgn-0) ou [Link](https://kowalczykedu.github.io/Prototipo-UTFRide/)

## Stack

- **Frontend:** Angular, TypeScript e RxJS
- **Framework CSS:** Tailwind CSS
- **Dados locais (Entrega 2):** json-server e Lowdb
- **BaaS previsto (Entrega 3):** Supabase
- **Testes:** Vitest e Node.js Test Runner
- **Qualidade de código:** ESLint e Prettier

## Em produção

A partir da Entrega 3.

## Instruções de Execução

### Pré-requisitos

- Git.
- Node.js compatível com o Angular CLI do projeto: `^22.22.3`, `^24.15.0` ou `>=26.0.0`.
- npm instalado com o Node.js.
- Acesso à internet para instalar dependências e consultar as sugestões de municípios do IBGE.

### Clonar e instalar

```sh
git clone https://github.com/UTFRide/UTFRide.git
cd UTFRide
git switch develop
npm install
```

Os comandos abaixo devem ser executados na raiz do repositório. A instalação da raiz atende também ao frontend por meio dos npm workspaces.

### Iniciar a API local

Em um terminal, execute:

```sh
npm run api
```

Mantenha esse terminal aberto. A API fica disponível em `http://localhost:3000`, e os dados são persistidos em `apps/api/db.json`.

### Iniciar o frontend

Em outro terminal, na raiz do mesmo clone, execute:

```sh
npm start
```

Acesse `http://localhost:4200` no navegador. Mantenha a API e o frontend em execução durante o uso do aplicativo.

A base inicial não contém alunos nem caronas. Cadastre uma conta com e-mail `@alunos.utfpr.edu.br` e faça login; a confirmação de e-mail é simulada no MVP. Publique uma oferta como motorista e use outra conta de aluno para pesquisar e solicitar uma vaga. Retorne à conta do motorista para gerenciar as solicitações. Os cadastros e envios alteram o arquivo de dados local.

### Executar testes e lint

Em um terceiro terminal, na raiz do repositório:

```sh
npm test
npm run lint
```

`npm test` executa os testes de layout e a suíte do frontend uma vez, sem modo de observação. `npm run lint` verifica o código do frontend com ESLint.

Para executar também os testes HTTP da API com dados isolados:

```sh
node --test apps/api/server.test.mjs
```

### Gerar o build

```sh
npm run build
```

O build do frontend é gerado em `apps/web/dist/`.

## Telas da Aplicação

Capturas reais do MVP, organizadas pelas histórias implementadas. As versões desktop e celular mostram a adaptação do layout; clique nas imagens para ampliar.

### US01 — Cadastro e Autenticação Institucional

Apresentação do UTFRide, criação de conta com e-mail institucional e acesso à plataforma.

| Tela | Desktop | Celular |
| --- | --- | --- |
| **Landing page** | <img src="docs/screenshots/landing-desktop.png" alt="Landing page do UTFRide no desktop" width="600"> | <img src="docs/screenshots/landing-mobile.png" alt="Landing page do UTFRide no celular" width="240"> |
| **Cadastro** | <img src="docs/screenshots/cadastro-desktop.png" alt="Formulário de cadastro institucional no desktop" width="600"> | <img src="docs/screenshots/cadastro-mobile.png" alt="Formulário de cadastro institucional no celular" width="240"> |
| **Login** | <img src="docs/screenshots/login-desktop.png" alt="Tela de login no desktop" width="600"> | <img src="docs/screenshots/login-mobile.png" alt="Tela de login no celular" width="240"> |

### US02 — Publicação e Gestão de Oferta de Carona

Publicação de ofertas com trajeto, data, horário, vagas e contribuição; gerenciamento dos pedidos recebidos pelo motorista.

| Tela | Desktop | Celular |
| --- | --- | --- |
| **Oferecer carona** | <img src="docs/screenshots/oferecer-carona-desktop.png" alt="Formulário de oferta de carona no desktop" width="600"> | <img src="docs/screenshots/oferecer-carona-mobile.png" alt="Formulário de oferta de carona no celular" width="240"> |
| **Gerenciar solicitações** | <img src="docs/screenshots/minhas-ofertas-desktop.png" alt="Oferta com solicitação pendente e ações de aceitar ou recusar no desktop" width="600"> | <img src="docs/screenshots/minhas-ofertas-mobile.png" alt="Gerenciamento de solicitação pendente no celular" width="240"> |

<details>
<summary><strong>Após aceitar uma solicitação</strong> — passageiro confirmado e ocupação atualizada</summary>

A oferta passa a exibir um passageiro confirmado, duas vagas restantes e ocupação de 33%.

<img src="docs/screenshots/minhas-ofertas-passageiro-confirmado-mobile.png" alt="Oferta no celular após aceitar um passageiro, com ocupação de 33% e duas vagas disponíveis" width="320">

</details>

### US03 — Pesquisa e Solicitação de Vaga em Carona

Pesquisa de ofertas disponíveis, consulta dos detalhes e acompanhamento das solicitações do passageiro.

| Tela | Desktop | Celular |
| --- | --- | --- |
| **Buscar caronas** | <img src="docs/screenshots/buscar-caronas-desktop.png" alt="Busca de caronas com uma oferta disponível no desktop" width="600"> | <img src="docs/screenshots/buscar-caronas-mobile.png" alt="Busca de caronas com uma oferta disponível no celular" width="240"> |
| **Minhas viagens — estado vazio** | <img src="docs/screenshots/minhas-viagens-desktop.png" alt="Minhas viagens sem solicitações pendentes no desktop" width="600"> | <img src="docs/screenshots/minhas-viagens-mobile.png" alt="Minhas viagens sem solicitações pendentes no celular" width="240"> |

<details>
<summary><strong>Detalhes da carona e solicitação de vaga</strong> — fluxo no desktop</summary>

**Confirmação:** o passageiro consulta os dados da oferta e abre o painel para confirmar ou desistir da solicitação.

<img src="docs/screenshots/detalhe-confirmar-solicitacao-desktop.png" alt="Detalhes da carona com painel de confirmação da solicitação de vaga aberto" width="900">

**Solicitação enviada:** a tela passa a informar que o pedido está aguardando aprovação do motorista.

<img src="docs/screenshots/detalhe-solicitacao-pendente-desktop.png" alt="Detalhes da carona após envio da solicitação, aguardando aprovação do motorista" width="900">

</details>
