# Parecer de Código — Tarefa 3

**Veredito:** APONTAMENTOS

## Apontamentos (bloqueiam)

1. **A busca recebe senhas e dados privados dos motoristas** — `apps/web/src/app/core/services/ride-data.ts:335`  
   Regra violada: `docs/architecture.md` §2.1 identifica os campos da autenticação simulada em `users`. O contrato da busca no `plan.md` prevê apenas o nome e a avaliação média do motorista, em linha com a matriz de acesso do `docs/prd.md`.  
   Prejuízo concreto: ao abrir a busca com ofertas elegíveis, o navegador do passageiro recebe os registros completos dos motoristas, incluindo senha, WhatsApp e matrícula. O parâmetro `_where` filtra registros. A projeção ocorre no cliente depois da transferência. Confirmei os campos retornados pelo `json-server` com registros sintéticos.

2. **O componente resolve `LocationData` manualmente ao abrir os filtros** — `apps/web/src/app/features/rides/ride-list/ride-list.ts:32`  
   Regra violada: `docs/architecture.md` §1.2 exige `inject(ServiceName)` diretamente na inicialização de um campo da classe.  
   Prejuízo concreto: a mesma referência representa a abertura do painel e fornece as sugestões. Com isso, o controle de visibilidade depende da resolução do serviço e fica acoplado ao seu ciclo de vida.

## Sugestões (não bloqueiam)

- Nos testes da tela, verifique as sugestões em cada campo pelo conteúdo disponível. Exigir a mesma instância de `datalist` torna o teste sensível a mudanças de implementação que preservam o comportamento.
- Os 29 testes direcionados passaram. O lint passou.

## Observações fora do escopo deste diff

- O endpoint genérico de `users` já devolvia registros completos no MVP. O apontamento desta tarefa é a nova consulta feita automaticamente pela busca do passageiro.
