---
issue: 4
status: rascunho
---

# US01 — Cadastro e Autenticação Institucional

## O problema

Alunos da UTFPR precisam acessar um ambiente restrito à comunidade acadêmica para encontrar e oferecer caronas.

## A história

**Como** aluno visitante da UTFPR, **eu quero** realizar meu cadastro e autenticar meu acesso usando uma matrícula ativa e um e-mail institucional, **para que** eu possa acessar as funcionalidades do sistema em um ambiente seguro e restrito à comunidade acadêmica.

## Critérios de aceite

- [ ] **CA1 — Dado** um visitante no cadastro, **quando** informa nome, e-mail institucional, matrícula e senha válidos e envia o formulário, **então** é orientado a confirmar o e-mail antes de acessar a conta.
- [ ] **CA2 — Dado** que o e-mail ainda não foi confirmado, **quando** o aluno tenta entrar, **então** o acesso à conta é impedido.
- [ ] **CA3 — Dado** que o aluno concluiu a confirmação do e-mail, **quando** retorna ao aplicativo, **então** é direcionado à tela de login.
- [ ] **CA4 — Dado** um cadastro ativo e confirmado, **quando** o aluno informa e-mail institucional e senha corretos no login, **então** entra no sistema.
- [ ] **CA5 — Dado** um e-mail não institucional no cadastro, **quando** o visitante tenta enviar o formulário, **então** o envio é bloqueado e a exigência do domínio `@alunos.utfpr.edu.br` é informada.
- [ ] **CA6 — Dado** credenciais inválidas, **quando** o aluno tenta entrar, **então** vê uma mensagem amigável sem detalhes específicos de segurança.
- [ ] **CA7 — Dado** um e-mail ou matrícula já cadastrados, **quando** o visitante tenta criar outro cadastro com os mesmos dados, **então** é alertado sobre o cadastro existente.
- [ ] **CA8 — Dado** um formulário de cadastro ainda não enviado, **quando** o visitante sai e retorna, **então** os dados preenchidos podem ser descartados.
- [ ] **CA9 — Dado** uma falha de conexão durante o cadastro ou login, **quando** a operação falha, **então** o aluno é informado e pode tentar novamente.

## Telas do protótipo

| Tela | Arquivo em `docs/prototipo/` |
| --- | --- |
| Landing Page | `models/1._landing_page_visitante.html` |
| Cadastro de Aluno | `models/2._cadastro_de_aluno.html` |
| Login e Estados de Erro | `models/3._login_e_estados_de_erro.html` |
| Acesso Negado | `models/14._acesso_negado_403_forbidden.html` |

## Fora de escopo

- Recuperação de senha.
- Envio real de e-mail na primeira entrega.
- Verificação externa da validade do e-mail ou da situação da matrícula.

## Abandono no meio

Se o visitante sair antes de enviar o cadastro, os dados podem ser descartados (CA8). Se a conexão falhar durante o cadastro ou o login, o sistema informa a falha e permite outra tentativa (CA9). O acesso permanece impedido enquanto a confirmação não for concluída (CA2).

## Assume que

Na primeira entrega, a confirmação de e-mail é simulada e os e-mails informados e as matrículas são considerados válidos e ativos, respectivamente, conforme decisão do usuário. A validação do domínio institucional continua obrigatória.

| Premissa | Issue que fecha |
| --- | --- |
| A confirmação é simulada na primeira entrega. | A definir: migração para autenticação da Entrega 3. |

## Dúvidas em aberto

| # | Dúvida | Quem responde |
| --- | --- | --- |
| 1 | Como o aluno realiza a confirmação simulada na primeira entrega? | Usuário |
| 2 | Qual issue substituirá a confirmação simulada pela confirmação real? | Usuário |
