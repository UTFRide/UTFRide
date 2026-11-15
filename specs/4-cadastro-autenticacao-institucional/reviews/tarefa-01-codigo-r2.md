# Parecer de Código — Tarefa 1

**Veredito:** APONTAMENTOS

## Apontamentos (bloqueiam)

1. **O serviço de dados recebe uma instância local adicional** — `apps/web/src/app/features/auth/register/register.ts:16`  
   Regra violada: a arquitetura, seção 4.1, define `core/` como a camada de serviços singleton. `AuthData` já é fornecido na raiz, mas o componente o fornece novamente.  
   Prejuízo concreto: o cadastro usa uma instância diferente daquela recebida por consumidores que injetam o serviço global. O estado `result()` fica separado entre elas, dificultando o compartilhamento do estado de autenticação previsto no plano.

2. **O teste de largura depende da estrutura textual do template** — `apps/web/src/app/features/auth/layout.spec.mjs:20`  
   Regra violada: as instruções do revisor de código reprovam testes acoplados a detalhes de implementação que quebram em refatorações.  
   Prejuízo concreto: a expressão regular exige que `class` seja o primeiro atributo de `<main>`. Acrescentar um atributo como `id` ou `role` antes dele faz o teste falhar, mesmo que a largura e o comportamento visual permaneçam iguais. O teste também depende da estrutura interna dos seletores gerados pelo Tailwind.

## Sugestões (não bloqueiam)

- Nenhuma.

## Observações fora do escopo deste diff

- Nenhuma.

A conversão de RxJS para signal foi movida para o serviço, conforme o apontamento aceito na rodada 1. Os apontamentos recusados não foram reapresentados.

**Verificação:** `npm test` passou com 7 testes; o teste de layout passou; `npm run build` passou. O diff solicitado foi examinado sem divulgar os dados do cadastro manual.
