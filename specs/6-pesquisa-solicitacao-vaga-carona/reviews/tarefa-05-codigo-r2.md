# Parecer de Código — Tarefa 5

**Veredito:** APONTAMENTOS

Os 48 testes das três suítes solicitadas passaram. Os 10 testes de `my-rides` também passaram. A cobertura verifica o tratamento de HTTP 401 nas três etapas da confirmação, a preservação da nova sessão diante de um 401 do envio anterior e a atualização da disponibilidade ao retornar à oferta. O CSS gerado usa a mesma variável, derivada dos tokens, na altura da navegação e no deslocamento do painel.

## Apontamentos (bloqueiam)

1. **O puxador do painel móvel pode ficar fora da área visível** — `apps/web/src/app/features/rides/ride-detail/ride-request-confirm-panel/ride-request-confirm-panel.html:4`  
   Regra violada: `docs/architecture.md` §1.1 e `.agents/rules/01-angular-strict-rules.md` item 4 remetem ao layout mobile-first do protótipo. A tela 5 limita a altura do painel e permite rolagem interna em `docs/prototipo/models/5._detalhe_da_oferta_e_solicitar_vaga.html:276`.  
   Prejuízo concreto: em uma janela baixa ou com zoom elevado, o painel fixo cresce para cima e o cabeçalho pode encobrir o puxador e o título que recebe foco. A rolagem da página não move o painel fixo, deixando o puxador inacessível por toque nessa situação.

## Sugestões (não bloqueiam)

- Aplicar a proteção por sessão também à leitura do histórico disparada ao voltar à oferta durante uma confirmação. Essa leitura usa o contexto padrão do interceptor. Se a sessão mudar com o detalhe montado, um 401 pode chegar antes de o `switchMap` cancelar a leitura anterior. No fluxo atual, navegar para o login desmonta o detalhe. `apps/web/src/app/core/services/ride-request-data.ts:254`

## Observações fora do escopo deste diff

- Nenhuma.
