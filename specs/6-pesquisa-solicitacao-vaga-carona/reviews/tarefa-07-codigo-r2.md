# Parecer de Código — Tarefa 7

**Veredito:** APONTAMENTOS

Passaram os 85 testes Angular e os 5 testes da API. O cancelamento continua no serviço ao sair de Minhas Viagens, mantém o estado de execução ao voltar e descarta o resultado de uma sessão anterior. Quando a gravação funciona, a API bloqueia as duas ordens de conflito entre cancelamento e decisão do motorista. O fluxo existente do motorista só ocupa a vaga depois de receber sucesso no aceite.

## Apontamentos (bloqueiam)

1. **Falha de gravação deixa a solicitação em um estado que impede nova tentativa** — `apps/api/server.mjs:61`

   **Regra violada** — `docs/architecture.md` §2.1 define `apps/api/db.json` como fonte de persistência do MVP. A condição de transição deve refletir o estado persistido da solicitação.

   **Prejuízo concreto** — `patchById` altera a coleção em memória antes de aguardar a gravação. Com uma falha temporária de escrita, o cancelamento responde `500`, mas a API passa a ler `cancelled` enquanto o registro persistido continua `pending`. Confirmei com um adaptador de teste que, mesmo após a escrita voltar a funcionar, a repetição do cancelamento e o aceite do motorista recebem `409` pela condição em `apps/api/server.mjs:55`. Nenhuma das duas operações chega à gravação.

## Sugestões (não bloqueiam)

Nenhuma.

## Observações fora do escopo deste diff

Nenhuma.
