# Parecer de Código — Tarefa 2

**Veredito:** APROVADO

## Apontamentos (bloqueiam)
Nenhum apontamento bloqueante encontrado.

- **Arquitetura e camadas (`docs/architecture.md` §2.3 e §4.2):** `AuthData` (`core/services/`) permanece encapsulando `HttpClient`, `SupabaseClientService`, `NetworkStatus` e `OfflineCache`; `Login` e `Register` (`features/auth/`) consomem apenas `AuthData` e `NetworkStatus` (de `core/`), sem acesso direto a rede ou `localStorage`.
- **Padrões Angular 22 e Tokens (`docs/architecture.md` §1.2 e `docs/design-tokens.md`):** Uso consistente de `inject()` nos campos da classe, estado reativo baseado em Signals (`network.isOffline()`), control flow `@if`, Reactive Forms e tokens semânticos (`bg-fundo`, `border-borda`, `text-texto-suave`, `p-space-sm`, `gap-space-xs`, `text-body-sm`, `text-body-lg`).
- **Segurança e sustentabilidade:** `toAuthenticatedUser()` centraliza a projeção sem `password` tanto para o `computed()` `currentUser` quanto para o cache em `OfflineCache`, e `saveAuthenticatedSession()` / `clearLocalSession()` / `restoreOfflineSession()` isolam os dados por `userId` sem vazar sessão entre contas.
- **Testes e Lint:** `npm test` (2 testes de layout + 26 suítes / 334 testes Vitest) e `npm run lint` executados com sucesso após as alterações; testes exercitam comportamento pela borda pública (DOM, `RouterTestingHarness`, `HttpTestingController` e dublês em memória do Supabase) sem acoplar a detalhes privados.

## Sugestões (não bloqueiam)
- Se outras telas mutáveis nas próximas tarefas repetirem o mesmo bloco visual de aviso offline vinculado por `aria-describedby` (`login.html` linhas 31–36 e `register.html` linhas 78–83), vale extrair um componente burro em `shared/components/` para evitar replicação do markup e das classes.
- Em `AuthData.restoreSession()`, quando `navigator.onLine` estiver `true` em rede instável ("lie-fi") e `loadOrMirrorProfile` falhar por erro de conexão, o bloco `catch` chama `clearLocalSession()` e apaga o cache offline do usuário. Como comportamento offline explícito (`network.isOffline()`) já é tratado antes da chamada HTTP, isso não bloqueia esta tarefa, mas pode ser refinado caso queiram preservar o fallback em cache diante de falha `status === 0`.

## Observações fora do escopo deste diff
- Em `apps/web/src/app/features/auth/login/login.html` (linha 43, pré-existente fora do diff), o alerta de credenciais inválidas usa `bg-perigo/10`, enquanto o restante do app (como `register.html` linha 25) utiliza o token semântico `bg-perigo-fundo`. Candidato a padronização em manutenção futura.
