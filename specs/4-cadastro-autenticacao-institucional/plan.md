# Plano — Issue #4

## Decisões técnicas

- Usar as telas do protótipo indicadas na spec para a landing page, cadastro, login e acesso negado, com rotas públicas `/`, `/register` e `/login` conforme a arquitetura.
- Criar os componentes da história em `apps/web/src/app/features/auth/` e manter a comunicação com a fonte de dados em serviços de `apps/web/src/app/core/services/`. Definir rotas em `app.routes.ts` e usar formulários reativos.
- Para o MVP, usar a coleção `users` de `apps/api/db.json` pelo `json-server`. O contrato de cadastro deve contemplar os campos `User` definidos na arquitetura, os dados necessários para a autenticação simulada e o estado de confirmação automática. A representação das credenciais e o estado da sessão são limitados ao ambiente simulado: o `json-server` não fornece autenticação segura. Não tratar essa simulação como prova de segurança real.
- Manter o estado de envio, autenticação e erros na camada apropriada; proteger o acesso autenticado conforme a arquitetura. A implementação não envia e-mail nem verifica externamente a matrícula.

## Tarefas

- [ ] **Tarefa 1 — Criar o cadastro e a confirmação simulada**
  - Cobre: CA1.
  - Teste primeiro: enviar dados válidos, verificar a criação da conta com confirmação automática e a navegação para `/login`; o teste falha enquanto esse fluxo não existir.
  - Arquivos previstos: testes e componentes de cadastro e landing em `apps/web/src/app/features/auth/`; serviço e modelo em `apps/web/src/app/core/`; `apps/web/src/app/app.routes.ts`; `apps/api/db.json`.

- [ ] **Tarefa 2 — Autenticar o aluno**
  - Cobre: CA4.
  - Teste primeiro: informar credenciais corretas de conta ativa e confirmada e verificar a entrada no sistema e o estado autenticado; o teste falha enquanto o login não existir.
  - Arquivos previstos: testes e componente de login em `apps/web/src/app/features/auth/`; serviço e guarda em `apps/web/src/app/core/`; `apps/web/src/app/app.routes.ts`.

- [ ] **Tarefa 3 — Validar o domínio institucional**
  - Cobre: CA5.
  - Teste primeiro: informar e-mail fora de `@alunos.utfpr.edu.br` e verificar bloqueio do envio e mensagem sobre o domínio exigido; o teste falha enquanto a validação ou mensagem não estiver completa.
  - Arquivos previstos: testes e componente de cadastro em `apps/web/src/app/features/auth/`.

- [ ] **Tarefa 4 — Informar credenciais inválidas**
  - Cobre: CA6.
  - Teste primeiro: tentar entrar com credenciais inválidas e verificar mensagem amigável sem revelar qual credencial falhou; o teste falha enquanto o tratamento não existir.
  - Arquivos previstos: testes e componente de login em `apps/web/src/app/features/auth/`; serviço em `apps/web/src/app/core/services/`.

- [ ] **Tarefa 5 — Impedir cadastros duplicados**
  - Cobre: CA7.
  - Teste primeiro: tentar cadastrar com e-mail existente e, em outro caso, matrícula existente; verificar alerta e ausência de nova conta em ambos. Os testes falham enquanto a verificação não existir.
  - Arquivos previstos: testes e componente de cadastro em `apps/web/src/app/features/auth/`; serviço em `apps/web/src/app/core/services/`.

- [ ] **Tarefa 6 — Descartar o formulário não enviado**
  - Cobre: CA8.
  - Teste primeiro: preencher o formulário, sair sem enviar e retornar; verificar que os dados podem ser descartados e nenhuma conta foi criada. O teste falha enquanto o comportamento de navegação não estiver implementado.
  - Arquivos previstos: testes e componente de cadastro em `apps/web/src/app/features/auth/`; `apps/web/src/app/app.routes.ts`, se necessário.

- [ ] **Tarefa 7 — Tratar falhas de conexão**
  - Cobre: CA9.
  - Teste primeiro: simular falhas de rede no cadastro e no login, verificar mensagem e nova tentativa em ambos; os testes falham enquanto o tratamento não existir.
  - Arquivos previstos: testes e componentes de cadastro e login em `apps/web/src/app/features/auth/`; serviço em `apps/web/src/app/core/services/`.

## Critérios sem tarefa
