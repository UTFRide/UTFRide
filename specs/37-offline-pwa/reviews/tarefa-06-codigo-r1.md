# Parecer de Código — Tarefa 6
**Veredito:** APONTAMENTOS

(Lint: passou. Não rodei a suíte Vitest. Li o diff de produção inteiro e fiz uma busca por padrões frágeis nos specs, que não achou nenhum.)

## Apontamentos (bloqueiam)
1. **`retryDetail()` ganhou um efeito colateral que não é desta tarefa: agora também reexecuta a leitura da solicitação do passageiro.** — `apps/web/src/app/features/rides/ride-detail/ride-detail.ts` (método `retryDetail`, trecho `if (this.passengerRequest().status === 'error') this.requestRetry.update(...)`)
   Regra violada: texto da Tarefa 6 e seus arquivos previstos. A tarefa só pede desabilitar a ação offline. A regra de revisão também diz que se julga o que está no diff e que uma abstração ou comportamento sem ganho reprova.
   Prejuízo concreto: é uma mudança de comportamento online não pedida. Um clique em "Tentar novamente" do detalhe passa a disparar duas requisições. `retryRequestRead()` já existe para a segunda. Se a leitura da solicitação falhar por outro motivo, o botão do detalhe a reexecuta sem o usuário perceber. Isso não é coberto pela tarefa nem pelos CAs que ela cita (CA4, CA5, CA7). Remova a mudança ou, se for necessária, justifique-a no spec e cubra-a com teste.

## Sugestões (não bloqueiam)
- O bloco do aviso offline (`<p role="status">` + ícone `wifi_off` + `{{ offlineMessage }}`) está copiado 8 vezes nos 3 templates. Os pares `[disabled]` + `[attr.aria-describedby]` também se repetem. Um componente burro em `shared/components` com `input()` da mensagem, ou um `@if` único por tela, evitaria mexer em 8 lugares quando o texto ou o estilo mudar. A regra da Tarefa já está centralizada em `OFFLINE_ACTION_MESSAGE`, então é só a marcação que se repete.
- Em `ride-detail.ts`, a guarda `!this.network.isOffline()` está repetida em `retryDetail`, `retryRequestRead`, `toggleConfirmation` e `confirmRequest`. Em `ride-list.ts` e `my-trips.ts` ela também aparece nos handlers. As guardas nos handlers são defesa em profundidade válida. Um `computed` (`actionsBlocked`) reutilizado no template e nos handlers reduziria o risco de os dois divergirem.
- O `linkedSignal` de `confirmationOpen` ficou mais complexo, com `source` em objeto e `previous`. Um comentário curto do porquê (fechar o painel ao ficar offline, preservar o estado ao voltar online) ajuda daqui a três semanas.

## Observações fora do escopo deste diff
- Nenhuma.
