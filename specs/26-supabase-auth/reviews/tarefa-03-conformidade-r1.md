# Parecer de Conformidade — Tarefa 3

**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA1 — Checagem de duplicidade no `json-server` (`/registration-exists`) antes de cadastrar | atendido | `apps/web/src/app/core/services/auth-data.ts:130-133`, `apps/web/src/app/core/services/auth-data.spec.ts:59-61` |
| CA1 — Criação de conta no Supabase Auth (`signUp`) com metadados (`name`, `registrationNumber`, `whatsapp`, `role: 'student'`, `isBlocked: false`) | atendido | `apps/web/src/app/core/services/auth-data.ts:149-162`, `apps/web/src/app/core/services/auth-data.spec.ts:65-77` |
| CA1 / Assume que — Espelhamento em `POST /users` no `json-server` sem senha e com `// TODO` Atividade 15 | atendido | `apps/web/src/app/core/services/auth-data.ts:177-190`, `apps/web/src/app/core/services/auth-data.spec.ts:79-94` |
| CA1 — Encerramento de sessão automática criada pelo `signUp` (`signOut` + limpeza do estado local) | atendido | `apps/web/src/app/core/services/auth-data.ts:191-206`, `apps/web/src/app/core/services/auth-data.spec.ts:99-102` |
| CA1 / Protótipo — Redirecionamento para `/login` exibindo aviso em português de conta criada com sucesso com tokens semânticos | atendido | `apps/web/src/app/features/auth/register/register.ts:53`, `apps/web/src/app/features/auth/login/login.ts:17`, `apps/web/src/app/features/auth/login/login.html:10-18`, `apps/web/src/app/features/auth/login/login.spec.ts:139-168` |
| CA2 — Bloqueio de envio para e-mail fora de `@alunos.utfpr.edu.br`, senha < 6 caracteres e senhas divergentes | atendido | `apps/web/src/app/features/auth/register/register.ts:34-40`, `apps/web/src/app/features/auth/register/register.spec.ts:110-170` |
| CA2 — Tratamento de duplicidade no `json-server` ou usuário já registrado no Supabase Auth (erro ou `identities: []`) sem espelhar em `/users` nem redirecionar | atendido | `apps/web/src/app/core/services/auth-data.ts:20-25`, `apps/web/src/app/core/services/auth-data.ts:165-167`, `apps/web/src/app/features/auth/register/register.spec.ts:316-369` |
| CA2 — Tradução de erros do Supabase Auth para português em `/register` sem vazar mensagens internas e permitindo nova tentativa | atendido | `apps/web/src/app/core/services/auth-data.ts:45-57`, `apps/web/src/app/features/auth/register/register.html:27-29`, `apps/web/src/app/features/auth/register/register.ts:48-49`, `apps/web/src/app/features/auth/register/register.spec.ts:371-410` |
| CA9 / Abandono e falha de rede — Tratamento de falha de conexão em `signUp` e `POST /users` (encerra `loading`, limpa eventual sessão e permite tentar novamente) | atendido | `apps/web/src/app/core/services/auth-data.ts:27-43`, `apps/web/src/app/core/services/auth-data.ts:169-171`, `apps/web/src/app/core/services/auth-data.ts:194-196`, `apps/web/src/app/core/services/auth-data.spec.ts:239-262` |
| CA10 / Suíte de testes — Execução integral com mocks de Supabase (`SUPABASE_AUTH_CLIENT`) sem chamadas de rede reais (`npm test`: 20 arquivos, 224 testes passando) | atendido | `apps/web/src/app/core/services/auth-data.spec.ts`, `apps/web/src/app/features/auth/register/register.spec.ts`, `apps/web/src/app/features/auth/login/login.spec.ts` |

## Apontamentos
