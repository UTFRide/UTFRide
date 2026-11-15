# Parecer de Código — Tarefa 4

**Veredito:** APONTAMENTOS

## Apontamentos (bloqueiam)

1. **O resultado de uma tentativa anterior reaparece ao retornar ao login** — `apps/web/src/app/core/services/auth-data.ts:21` e `apps/web/src/app/features/auth/login/login.ts:23`  
   Regra violada: `docs/architecture.md`, seções 1.1 e 7, que estabelecem estado reativo e mensagens de erro contextuais.  
   Prejuízo concreto: o serviço singleton conserva o resultado `{ user: null }`. Depois de uma tentativa inválida, se o aluno navegar para o cadastro e voltar ao login, o novo componente exibe a falha anterior mesmo com o formulário vazio e sem uma nova tentativa.

## Sugestões (não bloqueiam)

- Acrescentar um teste de navegação para fora do login e retorno após uma tentativa inválida.

## Observações fora do escopo deste diff

- Nenhuma identificada.

Os testes não foram executados nesta revisão, conforme o despacho.
