# Parecer de Código — Tarefa 7

**Veredito: APONTAMENTOS**

## Apontamentos que bloqueiam

1. **Erro 401 no login não é apresentado ao usuário** — [error-interceptor.ts](C:/Users/Geovane/Desktop/UTFRIDE/UTFRide/apps/web/src/app/core/interceptors/error-interceptor.ts:14) e [login.ts](C:/Users/Geovane/Desktop/UTFRIDE/UTFRide/apps/web/src/app/features/auth/login/login.ts:33).  
   O interceptor redireciona para `/login`, mas, se o usuário já estiver nessa tela, não há mudança visível. O componente recebe `requestError` e apenas encerra o carregamento. A falha fica silenciosa, contrariando a regra de revisão que proíbe engolir erros e o tratamento global previsto na seção 2.4 da arquitetura.

2. **Aviso global permanece depois de uma tentativa bem-sucedida** — [error-notice.ts](C:/Users/Geovane/Desktop/UTFRIDE/UTFRide/apps/web/src/app/core/services/error-notice.ts:5) e [app.html](C:/Users/Geovane/Desktop/UTFRIDE/UTFRide/apps/web/src/app/app.html:4).  
   A mensagem só é removida pelo botão de fechar. Após um erro 500 no cadastro ou login, uma nova tentativa pode ter sucesso e navegar para outra tela enquanto o aviso anterior continua visível.

## Sugestões

- Testar a integração do interceptor com os formulários, incluindo o resultado visível de um 401 e o comportamento do aviso após uma tentativa bem-sucedida.

## Observações fora do escopo deste diff

- Nenhuma.

**Verificação:** `npm test` passou, com 29 testes e duas verificações de layout. A revisão foi somente leitura.
