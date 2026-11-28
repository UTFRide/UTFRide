# Parecer de Código — Tarefa 1

**Veredito:** APONTAMENTOS

## Apontamentos (bloqueiam)

1. **O teste de largura ignora as regras responsivas** — `apps/web/src/app/features/auth/layout.spec.mjs:26`  
   Regra violada: as instruções de revisão exigem testes sustentáveis que verifiquem o comportamento pretendido.  
   Prejuízo concreto: o teste descarta todas as regras dentro de `@media`, embora as duas telas usem uma largura diferente em `lg`. Assim, uma alteração que torne o conteúdo largo demais em telas grandes pode passar no teste, que afirma verificar a largura legível das telas públicas.

## Sugestões (não bloqueiam)

- O cancelamento da requisição ao sair impede que sua resposta antiga redirecione uma visita posterior, mas não garante que o servidor não tenha criado a conta: ele pode ter processado o POST antes do cancelamento. Considere essa possibilidade ao implementar a detecção de duplicidade na tarefa 5.

## Observações fora do escopo deste diff

- Nenhuma.

A instância adicional do serviço foi removida. A limpeza do estado na entrada e na saída evita o redirecionamento por resultado anterior, e o teste cobre o cancelamento da resposta pendente. O tratamento de falhas continua previsto para a tarefa 7, conforme a decisão registrada.

**Atenção ao commit:** `apps/api/db.json` está no índice e contém alterações locais que, segundo o despacho, não devem ser incluídas. Os dados não foram divulgados. Não executei novamente os testes; considerei os resultados informados no despacho.
