# Parecer de Código — Tarefa 2

**Veredito:** APONTAMENTOS

## Apontamentos (bloqueiam)

1. **Resultado negativo mantém o formulário bloqueado** — `apps/web/src/app/features/auth/login/login.ts:20`  
   Regra violada: a arquitetura, na seção 7, determina mensagens de erro contextuais e controle do botão pelo estado de carregamento.  
   Prejuízo concreto: quando as credenciais não encontram uma conta elegível, o serviço retorna `null`, mas `loading` permanece `true`. O aluno não recebe uma mensagem e não consegue tentar novamente.

2. **Falha HTTP encerra o fluxo de login** — `apps/web/src/app/core/services/auth-data.ts:16`  
   Regra violada: a arquitetura prevê tratamento de erros na seção 2.4 e mensagens contextuais na seção 7.  
   Prejuízo concreto: uma falha de conexão propaga o erro pelo `toSignal` e encerra a inscrição que processa os envios. A tela não recupera o estado de carregamento e novas tentativas não são processadas.

3. **URL de ambiente literal e duplicada** — `apps/web/src/app/core/services/auth-data.ts:16`  
   Regra violada: o mandato desta revisão reprova URL de ambiente escrita no código; a arquitetura, nas seções 2.1 e 2.3, define a integração por serviços.  
   Prejuízo concreto: a URL já aparece na operação de cadastro. Uma mudança de ambiente exige atualizar múltiplos pontos, com risco de cadastro e login passarem a consultar serviços diferentes.

## Sugestões (não bloqueiam)

- Nenhuma.

## Observações fora do escopo deste diff

- A operação de cadastro já continha uma URL literal para o mesmo serviço; esse trecho é preexistente.

A suíte `npm test` passou: **5 arquivos e 11 testes**.
