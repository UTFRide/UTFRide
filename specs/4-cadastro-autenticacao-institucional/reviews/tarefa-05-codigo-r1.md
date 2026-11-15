# Parecer de Código — Tarefa 5

**Veredito: APONTAMENTOS**

## Apontamentos (bloqueiam)

1. **A verificação e a criação não são atômicas** — `apps/web/src/app/core/services/auth-data.ts:31`  
   Regra aplicável: `docs/architecture.md`, seção 2.1, define o `json-server` como persistência do MVP.  
   Prejuízo concreto: dois visitantes podem consultar a coleção antes de qualquer criação ser concluída e, em seguida, ambos enviarem um `POST` com o mesmo e-mail ou matrícula. A verificação no cliente não garante unicidade entre operações concorrentes.

2. **O cadastro transfere todos os registros de usuários para o visitante** — `apps/web/src/app/core/services/auth-data.ts:31`  
   Regra aplicável: a arquitetura define a coleção `users` e dados privados dos usuários nas seções 2 e 5.  
   Prejuízo concreto: cada tentativa recebe a coleção inteira, inclusive senhas e outros dados presentes no modelo atual, além de transferir volumes crescentes de dados a cada cadastro.

3. **A alteração deixa um teste existente do serviço falhando** — `apps/web/src/app/core/services/auth-data.ts:32`  
   Regra aplicável: `docs/architecture.md`, seções 1.1 e 8, estabelece Vitest e a suíte automatizada.  
   Prejuízo concreto: `auth-data.spec.ts` ainda responde à primeira requisição como se fosse o cadastro anterior; agora ela é a consulta e causa `TypeError: users.some is not a function`. A suíte do serviço fica quebrada.

## Sugestões (não bloqueiam)

- Nenhuma.

## Observações fora do escopo deste diff

- O armazenamento e a consulta de senhas em texto claro já existiam antes desta alteração e merecem tratamento próprio.

O teste solicitado de cadastro passou: **8 testes**. A verificação adicional do serviço teve **1 falha em 2 testes**. Nenhum arquivo foi alterado.
