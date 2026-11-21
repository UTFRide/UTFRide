# Parecer de Código — Tarefa 5

**Veredito:** APONTAMENTOS

Os 45 testes dos três arquivos selecionados passaram.

## Apontamentos (bloqueiam)

1. **A confirmação ignora o tratamento global de sessão expirada** — `apps/web/src/app/core/services/ride-request-data.ts:332`  
   Regra violada: `docs/architecture.md` §2.4 exige que o interceptor encerre a sessão e redirecione para `/login` ao receber HTTP 401.  
   Prejuízo concreto: o contexto desativa o interceptor nas duas consultas e no envio. Se qualquer uma dessas chamadas devolver 401 para a sessão atual, a tela exibe um erro genérico, mantém o passageiro autenticado e permite repetir a operação com a mesma sessão inválida.

2. **Ao voltar à oferta durante o envio, a tela descarta o estado revalidado da carona** — `apps/web/src/app/core/services/ride-request-data.ts:256`  
   Regra violada: `docs/architecture.md` §§2.3–2.4 atribuem ao serviço a integração dos dados e sua exposição reativa à tela.  
   Prejuízo concreto: se o passageiro confirmar, sair e voltar enquanto a operação ainda está em andamento, o detalhe pode carregar a oferta ativa antes de a última vaga ser preenchida. Quando a revalidação encontra a oferta lotada, o serviço descarta a oferta atualizada e recarrega apenas o pedido. A tela mantém a disponibilidade antiga e volta a oferecer o botão de solicitação.

3. **O painel móvel usa um deslocamento fixo acoplado à altura atual da barra de navegação** — `apps/web/src/app/features/rides/ride-detail/ride-request-confirm-panel/ride-request-confirm-panel.html:4`  
   Regra violada: `docs/architecture.md` §1.1 e `.agents/rules/01-angular-strict-rules.md` item 2 determinam o uso dos tokens semânticos de espaçamento.  
   Prejuízo concreto: `bottom-16` usa um valor da escala padrão do Tailwind e repete, em outro componente, a altura atual da barra. Uma mudança nessa altura pode cobrir parte do painel ou deixar um vão entre as duas superfícies.

## Sugestões (não bloqueiam)

- Verificar também o estado do `@placeholder` no teste de abertura. As asserções atuais continuam passando se o `@defer` for removido e o `@if (confirmationOpen())` for mantido. `apps/web/src/app/features/rides/ride-detail/ride-detail.spec.ts:120`

## Observações fora do escopo deste diff

- Nenhuma.
