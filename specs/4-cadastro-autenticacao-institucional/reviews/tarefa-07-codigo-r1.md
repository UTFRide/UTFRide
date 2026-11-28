# Parecer de Código — Tarefa 7

**Veredito: APONTAMENTOS**

## Apontamentos que bloqueiam

1. **Erros distintos são classificados como falha de conexão** — [auth-data.ts](C:/Users/Geovane/Desktop/UTFRIDE/UTFRide/apps/web/src/app/core/services/auth-data.ts:24) e linha 43.  
   Os dois `catchError` convertem qualquer exceção no mesmo resultado, incluindo respostas HTTP 4xx/5xx e erros de processamento. A arquitetura prevê tratamento diferenciado para erros HTTP em `docs/architecture.md`, seção 2.4. Com o código atual, uma falha do servidor ou uma resposta malformada pode ser apresentada ao aluno como problema na própria conexão, ocultando a causa real.

## Sugestões que não bloqueiam

- Acrescentar um teste para falha no `POST /users`: o teste de cadastro adicionado cobre a falha na verificação inicial, mas não na criação da conta.

## Observações fora do escopo deste diff

- Nenhuma.

**Verificação:** `npm test` passou, com 19 testes e duas verificações de layout.
