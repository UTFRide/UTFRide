# Parecer de Código — Tarefa 1

**Veredito:** APONTAMENTOS

## Apontamentos (bloqueiam)

1. **O teste de roteamento depende da estrutura dos destinos provisórios** — `apps/web/src/app/features/rides/ride-list/ride-list.spec.ts:92`  
   Regra violada: `docs/architecture.md` §§ 3.1–3.2 e 8 definem os contratos de roteamento e a cobertura automatizada. A régua do revisor reprova testes acoplados a detalhes de implementação.  
   Prejuízo concreto: os 10 testes passaram com as telas provisórias. A asserção do detalhe exige que `Detalhes da Viagem` esteja em um `h1` dentro do elemento imediatamente seguinte ao `router-outlet`. O protótipo já coloca esse texto em outro elemento. Na Tarefa 4, a navegação também passa a consultar a API para `ride-123`, e o teste encerra com `http.verify()` sem preparar resposta para essa consulta. Assim, a substituição prevista do destino pode quebrar o teste mesmo com o layout, a ativação da rota e o parâmetro corretos.

## Sugestões (não bloqueiam)

- Nenhuma.

## Observações fora do escopo deste diff

- Nenhuma.
