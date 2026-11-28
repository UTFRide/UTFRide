# Parecer de Código — Tarefa 4

**Veredito:** APONTAMENTOS

## Apontamentos (bloqueiam)

1. **Teste depende de espaços que não existem entre elementos HTML** — [login.spec.ts:28](C:/Users/Geovane/Desktop/UTFRIDE/UTFRide/apps/web/src/app/features/auth/login/login.spec.ts:28)  
   **Regra violada:** a seção 8 de `docs/architecture.md` estabelece `npm test` como comando da suíte automatizada; o perfil do revisor reprova testes acoplados a detalhes de implementação.  
   **Prejuízo concreto:** `textContent` concatena o título e os parágrafos sem inserir espaços, e a normalização não os cria. Conforme a execução informada pelo orquestrador, o teste falha na primeira tentativa, mesmo com a mensagem presente, e não chega a verificar os cenários seguintes. A comparação integral também depende da estrutura dos nós do template.

## Sugestões (não bloqueiam)

- Nenhuma.

## Observações fora do escopo deste diff

- A falha de requisição HTTP no login já não era tratada antes deste diff e pode deixar a operação sem recuperação. A falha de conexão é coberta pelo CA9, previsto em outra etapa da história; não foi classificada como regressão desta alteração.

Não executei testes, conforme o despacho. O orquestrador informou 14 testes aprovados e um falho.
