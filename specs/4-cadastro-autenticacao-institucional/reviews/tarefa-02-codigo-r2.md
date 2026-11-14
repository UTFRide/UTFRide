# Parecer de Código — Tarefa 2

**Veredito:** APONTAMENTOS

## Apontamentos (bloqueiam)

1. **Teste de login depende da URL fixa do ambiente** — `apps/web/src/app/features/auth/login/login.spec.ts:21`  
   Regra violada: a arquitetura, nas seções 2.1 e 2.3, centraliza a integração na camada de serviços; o mandato desta revisão reprova testes acoplados a detalhes de implementação.  
   Prejuízo concreto: ao alterar `environment.apiUrl`, o login pode continuar correto, mas o teste falhará porque espera `http://localhost:3000/users`.

## Sugestões (não bloqueiam)

- Nenhuma.

## Observações fora do escopo deste diff

- Nenhuma.

A suíte `npm test` passou: **5 arquivos e 12 testes**. Os apontamentos recusados na rodada anterior não foram reapresentados.
