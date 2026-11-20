# Parecer de Código — Tarefa 7

**Veredito:** APONTAMENTOS

Passaram os 82 testes das quatro suítes Angular e os três testes da API. A consulta usa o ID da sessão Angular, descarta leituras de sessões anteriores e recebe apenas os campos usados na tela. A API inclui o WhatsApp apenas para solicitações aceitas em caronas ativas ou lotadas. A rota filha mantém o carregamento sob demanda e a proteção do layout de caronas.

## Apontamentos (bloqueiam)

1. **Sair da tela pode interromper um cancelamento já confirmado** — `apps/web/src/app/features/rides/my-trips/my-trips.ts:67`  
   Regra violada: `docs/architecture.md` §§2.3–2.4 atribuem aos Services as operações de dados e a ponte assíncrona para Signals. A execução do cancelamento fica vinculada à inscrição do `toSignal()` do componente.  
   Prejuízo concreto: se o passageiro confirmar o cancelamento e tocar em **Buscar** enquanto o `GET` de revalidação estiver em andamento, a destruição do componente encerra a inscrição. O `PATCH` não é enviado e, ao voltar, a solicitação permanece pendente sem explicação. A criação de solicitação já preserva uma operação confirmada durante a navegação em `apps/web/src/app/core/services/ride-request-data.ts:383`.

## Sugestões (não bloqueiam)

- Reconsultar o resumo quando o cancelamento retornar `invalid-state`. Se o motorista aceitar o pedido depois que o passageiro abrir a tela, a revalidação impede o `PATCH`, mas a tela continua exibindo o pedido em Pendentes e mantém o botão de cancelamento ativo. `apps/web/src/app/features/rides/my-trips/my-trips.ts:102`

## Observações fora do escopo deste diff

- A operação da Tarefa 6 verifica que o pedido está pendente em um `GET` e envia o `PATCH` em outra requisição. Uma decisão do motorista entre as duas etapas pode ser sobrescrita pelo cancelamento. `apps/web/src/app/core/services/ride-request-data.ts:402`
