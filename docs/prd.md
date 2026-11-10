# 📄 Product Requirements Document (PRD)

**Projeto:** UTFRide
**Versão:** 1.0.0
**Última atualização:** 2026-09-18

> 🤖 **Este documento é a fonte da verdade sobre o QUE o produto faz.** Regra de
> negócio que não estiver aqui não existe — nem para a equipe, nem para a IA.
> Tecnologia **não** se discute aqui: isso é assunto do `architecture.md`.

---

## 🎯 1. Visão Geral e Objetivo

**O problema:** Alunos da UTFPR enfrentam dificuldade para chegar ao campus: o transporte público tem horários rígidos e limitados, e alternativas como carros de aplicativo (ex.: Uber) têm custo alto, preços oscilantes e risco constante de cancelamento. Esse problema afeta tanto estudantes que residem em cidades vizinhas quanto os que moram na própria região.

**A solução:** O UTFRide é uma plataforma web onde alunos da UTFPR com matrícula ativa e e-mail institucional se conectam. Sob uma mesma conta, o aluno pode agir como Motorista (publicando ofertas de carona com origem, destino, data/horário, vagas e valor) ou como Passageiro (pesquisando caronas disponíveis, solicitando vagas ou publicando buscas de carona ativas).

**Como saberemos que deu certo:** Alunos conseguem compartilhar trajetos até a universidade dividindo custos de transporte de forma combinada e previsível, sem dependência de tarifas abusivas ou cancelamentos repentinos de apps comerciais. Motoristas cobrem seus custos de deslocamento ou geram renda extra, e em viagens de média/longa distância o custo por aluno se torna inferior ao de passagens de ônibus convencionais.

---

## 📖 2. Glossário Ubíquo

| Termo | Significa | Não confundir com |
| :---- | :-------- | :---------------- |
| **Aluno** | Perfil base de qualquer pessoa com cadastro ativo na plataforma via e-mail institucional. Pode agir como Motorista ou Passageiro conforme o contexto. | "Usuário" (termo genérico de sistema) |
| **Motorista** | Aluno que possui veículo e cadastra uma Oferta de Carona disponibilizando vagas para outros estudantes. | Motorista de aplicativo profissional comercial |
| **Passageiro** | Aluno que solicita uma vaga em uma Oferta de Carona ou publica uma Busca de Carona. | Motorista da viagem |
| **Carona** | A viagem acordada e confirmada entre um Motorista e um ou mais Passageiros, contendo trajeto, horário e valor estabelecidos. | Oferta de Carona (que ainda não foi preenchida ou aceita) |
| **Oferta de Carona** | Publicação criada por um Motorista anunciando vagas disponíveis para determinado trajeto, data e horário com valor compartilhado. | Busca de Carona (iniciativa do passageiro) |
| **Solicitação de Carona**| Pedido enviado por um Passageiro interessado em ingressar em uma Oferta de Carona existente. Depende de aceite do Motorista. | Busca de Carona (solicitação é vinculada a uma oferta existente) |
| **Busca de Carona** | Publicação criada por um Passageiro comunicando sua necessidade de carona para determinado trajeto e horário. | Oferta de Carona |
| **Vaga** | Assento individual disponível em uma Oferta de Carona. | Oferta de carona inteira |
| **Suporte** | Perfil com acesso administrativo para moderação, resolução de denúncias, suporte a bugs e gestão de integridade da comunidade. | Aluno / Passageiro / Motorista (o Suporte não participa das caronas) |
| **Denúncia** | Comunicação formal de irregularidade, transtorno ou desrespeito enviada por um Aluno ao Suporte. | Feedback (avaliação de rotina) |
| **Feedback** | Avaliação qualitativa e nota sobre a experiência de viagem entre os participantes. | Denúncia |

---

## 👤 3. Atores e Permissões

| Ator | Quem é | Pode | Não pode |
| :--- | :----- | :--- | :------- |
| **Visitante** | Qualquer pessoa sem login ou sem e-mail institucional | Visualizar a Landing Page informativa do sistema | Visualizar caronas, ofertas, perfis de alunos ou usar a plataforma sem login com e-mail institucional |
| **Aluno / Motorista** | Aluno autenticado gerenciando ofertas de viagem | Publicar, editar e cancelar suas próprias Ofertas; aceitar ou rejeitar Solicitações de carona recebidas; alterar vagas (respeitando limite do veículo); concluir carona; avaliar passageiros pós-viagem; reportar denúncia; ver histórico próprio | Modificar ou cancelar ofertas de outros motoristas; aceitar solicitações de usuários bloqueados; acessar dados privados desnecessários de alunos; alterar avaliações de outros; acessar o painel de Suporte |
| **Aluno / Passageiro**| Aluno autenticado buscando ou participando de carona | Pesquisar ofertas com filtros; solicitar vagas em ofertas abertas; publicar Busca de Carona; cancelar solicitações pendentes próprias; avaliar motorista pós-viagem; reportar denúncia; ver histórico próprio | Modificar ou cancelar ofertas de carona; aceitar solicitações de terceiros; ocupar vagas indisponíveis/esgotadas; acessar dados privados ou histórico de outros; acessar o painel de Suporte |
| **Suporte** | Perfil administrativo independente do ecossistema de viagens | Acessar painel de moderação; visualizar e filtrar denúncias e feedbacks; banir/bloquear alunos infratores; consultar logs e dados de perfis; intervir em caronas em casos excepcionais (ex.: falha técnica) | Participar de caronas como motorista ou passageiro; alterar arbitrariamente notas ou dados cadastrais de terceiros sem motivo auditável |

---

## 📝 4. Escopo Funcional (User Stories)

### US01 — Cadastro e Autenticação Institucional · `Must Have` · `M` · Status: `Ready`

**Como** aluno visitante da UTFPR, **eu quero** realizar meu cadastro e autenticar meu acesso usando uma matrícula ativa e um e-mail institucional, **para que** eu possa acessar as funcionalidades do sistema em um ambiente seguro e restrito à comunidade acadêmica.

**Critérios de aceite:**
- [ ] **Dado** que sou um visitante na tela de cadastro, **quando** preencho nome, e-mail institucional (`@alunos.utfpr.edu.br`), matrícula e senha válidos e submeto, **então** sou orientado a confirmar o e-mail antes de acessar a conta.
- [ ] **Dado** que concluí a confirmação do e-mail institucional, **quando** retorno ao aplicativo, **então** sou direcionado à tela de login para entrar com minhas credenciais.
- [ ] **Dado** que ainda não confirmei o e-mail, **quando** tento entrar, **então** o acesso à conta é impedido.
- [ ] **Dado** que saio do formulário de cadastro antes de enviá-lo, **quando** retorno, **então** os dados preenchidos podem ser descartados.
- [ ] **Dado** que ocorre uma falha de conexão durante o cadastro ou login, **quando** a operação falha, **então** sou informado e posso tentar novamente.
- [ ] **Dado** que possuo cadastro ativo, **quando** informo e-mail institucional e senha corretos na tela de login, **então** meu login é efetuado com sucesso.
- [ ] **Dado** que informo um e-mail não institucional (ex.: `@gmail.com`) no cadastro, **quando** tento submeter, **então** o sistema bloqueia e exibe erro informando a exigência do e-mail da UTFPR.
- [ ] **Dado** que informo credenciais inválidas no login, **quando** tento entrar, **então** o sistema apresenta mensagem amigável de erro sem expor detalhes específicos de segurança.
- [ ] **Dado** que o e-mail ou matrícula já foram cadastrados previamente, **quando** tento novo cadastro com os mesmos dados, **então** o sistema alerta sobre a existência prévia do cadastro.

**Regras relacionadas:** RN01, RN07

Na primeira entrega, a confirmação de e-mail é simulada; considera-se que os e-mails informados são válidos e as matrículas estão ativas. A recuperação de senha está fora do escopo desta história.

---

### US02 — Publicação e Gestão de Oferta de Carona · `Must Have` · `M` · Status: `Ready`

**Como** motorista, **eu quero** publicar uma oferta de carona informando origem, destino, data, horário, número de vagas e o valor a ser cobrado, **para que** outros alunos possam encontrar e solicitar uma carona.

**Critérios de aceite:**
- [ ] **Dado** que sou um Aluno autenticado, **quando** preencho trajeto (origem/destino), data/horário futuros, número de vagas e valor por vaga e confirmo, **então** a Oferta de Carona é publicada com status ativa.
- [ ] **Dado** que sou o autor da Oferta de Carona e recebo solicitações de passageiros, **quando** consulto minha oferta, **então** posso aceitar ou rejeitar cada solicitação individualmente, bem como editar dados ou cancelar a oferta antes da viagem.
- [ ] **Dado** que deixo campos obrigatórios vazios ou informo número de vagas menor que 1, **quando** tento publicar, **então** o formulário bloqueia o envio apontando os erros de validação.
- [ ] **Dado** que tento cadastrar uma oferta com data ou horário no passado, **quando** clico em salvar, **então** o sistema rejeita a operação com aviso de data inválida.
- [ ] **Dado** que cancelo uma oferta que continha passageiros já confirmados, **quando** confirmo o cancelamento, **então** a carona é cancelada e os passageiros são notificados.

**Regras relacionadas:** RN02, RN03, RN05, RN07

---

### US03 — Pesquisa e Solicitação de Vaga em Carona · `Must Have` · `M` · Status: `Ready`

**Como** passageiro, **eu quero** pesquisar caronas disponíveis e solicitar uma vaga, **para que** eu possa encontrar uma carona compatível com meu trajeto e horário.

**Critérios de aceite:**
- [ ] **Dado** que sou um Passageiro autenticado, **quando** realizo busca por origem, destino ou data, **então** o sistema exibe apenas ofertas ativas com vagas disponíveis.
- [ ] **Dado** que escolho uma oferta disponível, **quando** clico em solicitar vaga, **então** uma solicitação pendente é registrada e enviada para aprovação do Motorista.
- [ ] **Dado** que possuo uma solicitação pendente não confirmada, **quando** acesso minhas viagens/solicitações, **então** posso cancelar a solicitação voluntariamente.
- [ ] **Dado** que não há caronas compatíveis com os filtros pesquisados, **quando** a pesquisa é executada, **então** o sistema exibe estado de lista vazia com mensagem clara.
- [ ] **Dado** que todas as vagas de uma oferta são preenchidas antes da minha confirmação, **quando** tento solicitar, **então** o sistema impede a solicitação informando carona lotada.
- [ ] **Dado** que já tenho uma solicitação ativa na mesma carona, **quando** tento solicitar novamente, **então** o sistema bloqueia a duplicidade.

**Regras relacionadas:** RN04, RN05, RN07

---

### US04 — Publicação de Busca Ativa de Carona · `Should Have` · `M` · Status: `Ready

**Como** passageiro, **eu quero** publicar uma busca de carona informando origem, destino, data e horário, **para que** motoristas interessados possam encontrar minha solicitação e oferecer uma carona.

**Critérios de aceite:**
- [ ] **Dado** que sou um Passageiro autenticado, **quando** preencho origem, destino, data e horário futuros e confirmo, **então** minha Busca de Carona é registrada no mural público de buscas.
- [ ] **Dado** que possuo uma busca cadastrada, **quando** acesso minhas publicações, **então** consigo visualizar o status ou encerrar a busca caso já tenha conseguido transporte.
- [ ] **Dado** que sou um Motorista navegando pelo mural, **quando** vejo uma Busca compatível com minha rota, **então** consigo visualizar as informações do trajeto e os meios de contato autorizados do aluno.
- [ ] **Dado** que tento publicar uma busca com data/horário no passado ou dados incompletos, **quando** submeto, **então** o sistema valida e bloqueia a ação com alertas descritivos.

**Regras relacionadas:** RN03, RN07

---

### US05 — Avaliação Mútua Pós-Viagem e Histórico · `Should Have` · `M` · Status: `Ready`

**Como** aluno participante de uma carona (motorista ou passageiro), **eu quero** avaliar os demais participantes após a conclusão da viagem e consultar meu histórico, **para que** eu possa registrar minha experiência, manter a confiança da comunidade e acompanhar minhas viagens passadas.

**Critérios de aceite:**
- [ ] **Dado** que uma Carona foi marcada como concluída pelo motorista, **quando** um participante confirmado acessa a viagem, **então** o formulário de avaliação (nota e comentário opcional) fica disponível para avaliar os outros integrantes.
- [ ] **Dado** que submeto uma avaliação válida, **quando** confirmo o envio, **então** a nota é computada no perfil do avaliado e a carona é exibida no histórico de viagens concluídas.
- [ ] **Dado** que a carona ainda não foi concluída ou cancelada, **quando** um aluno tenta avaliá-la, **então** o sistema bloqueia a avaliação e avisa que a viagem não está finalizada.
- [ ] **Dado** que já avaliei um participante daquela viagem, **quando** tento enviar nova avaliação, **então** o sistema impede duplicidade de avaliação.

**Regras relacionadas:** RN06, RN07

---

### US06 — Moderação de Denúncias e Suporte · `Must Have` · `M` · Status: `Ready`

**Como** suporte, **eu quero** receber e analisar denúncias sobre usuários e caronas, **para que** eu possa tomar medidas de moderação e manter a segurança da plataforma.

**Critérios de aceite:**
- [ ] **Dado** que um Aluno passou por um transtorno em uma carona, **quando** preenche e envia o formulário de denúncia com justificativa e referência da viagem/usuário, **então** o chamado é criado com status pendente para moderação.
- [ ] **Dado** que sou um usuário autenticado com perfil de Suporte, **quando** acesso o painel administrativo, **então** posso visualizar a listagem de denúncias pendentes, detalhes dos perfis envolvidos e histórico da carona.
- [ ] **Dado** que o Suporte conclui uma denúncia procedente com suspensão do usuário, **quando** aciona o bloqueio, **então** a conta do Aluno infrator passa para o status bloqueado e a denúncia é marcada como resolvida.
- [ ] **Dado** que um Aluno comum tenta acessar a URL ou rotas do painel de Suporte, **quando** tenta navegar, **então** o sistema bloqueia o acesso com erro de permissão (403 Forbidden / Redirecionamento).
- [ ] **Dado** que um Aluno bloqueado tenta realizar login ou operações no sistema, **quando** submete a ação, **então** o sistema recusa e informa suspensão da conta pelo suporte.

**Regras relacionadas:** RN07, RN08

---

## 🛡️ 5. Regras de Negócio (Constraints)

| ID | Regra |
| :-- | :---- |
| **RN01** | **E-mail Institucional Obrigatório:** O cadastro e login de alunos exigem estritamente e-mail com domínio institucional ativo da UTFPR (`@alunos.utfpr.edu.br`). |
| **RN02** | **Capacidade de Vagas:** Toda Oferta de Carona deve disponibilizar entre 1 vaga no mínimo e a capacidade máxima do veículo (máximo de 4 passageiros), não sendo permitidos valores nulos, negativos ou excedentes. |
| **RN03** | **Data Futura Obrigatória:** Ofertas e Buscas de Carona devem ser cadastradas obrigatoriamente para data e horário futuros em relação ao momento da publicação. |
| **RN04** | **Bloqueio de Duplicidade de Solicitação:** Um Passageiro não pode ter mais de uma solicitação ativa (pendente ou aceita) concorrente na mesma Oferta de Carona. |
| **RN05** | **Esgotamento Automático:** Ao atingir o número de solicitações aceitas igual ao total de vagas ofertadas, a Oferta de Carona passa para status esgotada e não aceita novos pedidos. |
| **RN06** | **Avaliação Exclusiva Pós-Conclusão:** Apenas participantes confirmados de uma carona finalizada podem se avaliar mutuamente, com limite estrito de uma avaliação por participante por carona. |
| **RN07** | **Restrição de Usuário Bloqueado:** Alunos com conta suspensa ou bloqueada pelo Suporte não podem autenticar, ofertar, solicitar ou buscar caronas. |
| **RN08** | **Isolamento de Perfil Suporte:** Perfis administrativos de Suporte operam exclusivamente no painel de moderação e resolução de problemas, sendo vedada sua participação direta no fluxo de viagens (oferta/solicitação). |

---

## 🚫 6. Fora de Escopo (Non-goals)

- **Gateway de Pagamento Online Integrado:** O app não processará transações financeiras digitais (Pix, cartão, boleto). A quitação e divisão de custos é acertada diretamente entre os participantes. *(Motivo: Não inflar a complexidade com integrações bancárias de terceiros no escopo acadêmico).*
- **Chat em Tempo Real Interno:** Não haverá chat instantâneo estilo WhatsApp dentro da aplicação. O contato entre motorista e passageiros confirmados ocorre pelos canais informados após a confirmação da carona. *(Motivo: Foco no gerenciamento de estado, rotas e CRUD).*
- **Rastreamento de Trajeto por GPS em Tempo Real:** Não haverá acompanhamento em mapa ao vivo (estilo Uber). Os trajetos e pontos de embarque/desembarque são descritos em texto/referência. *(Motivo: Alto custo e complexidade de integração contínua de geolocalização móvel no MVP).*
- **Integração com o SIGA / Portal Acadêmico UTFPR:** A validação institucional se dá por e-mail e autenticação com o BaaS, sem integração direta via API privada do sistema universitário. *(Motivo: Ausência de APIs públicas oficiais).*

---

## ⚙️ 7. Requisitos Não Funcionais (Qualidade)

- **RNF01 — Responsividade Mobile-First:** Todo o layout e fluxos da aplicação devem ser projetados prioritariamente para dispositivos móveis, adaptando-se com integridade visual e funcional a resoluções de tablets e desktops (atendendo ao ID2).
- **RNF02 — Arquitetura PWA:** A aplicação deve contemplar os requisitos de Progressive Web App (`manifest.webmanifest`, tema, splash screen, modo *standalone* e tratamento de indisponibilidade de rede/offline) (atendendo ao ID3).
- **RNF03 — Performance e Carregamento Rápido:** A listagem e filtros de caronas devem carregar de maneira ágil, utilizando estratégias modernas de carregamento sob demanda para não sobrecarregar planos de dados móveis.
- **RNF04 — Segurança e Integridade:** Controle rigoroso de sessões (JWT), senhas cifradas e políticas de segurança na camada de dados impedindo que passageiros ou motoristas acessem dados não autorizados de outros usuários (atendendo aos IDs 21 e 23).

---

## 🛠️ 8. Histórico

| Data | Versão | O que mudou |
| :--- | :----- | :---------- |
| 2026-09-18 | 1.0.0 | Versão inicial gerada a partir da entrevista guiada `/utf-prd` |
