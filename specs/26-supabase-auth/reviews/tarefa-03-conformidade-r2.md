# Parecer de Conformidade — Tarefa 3

**Veredito:** APROVADO

## Critérios verificados
| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA1 — Checagem de duplicidade no `json-server` (`/registration-exists`) antes de cadastrar | atendido | `apps/web/src/app/core/services/auth-data.ts:132-135`, `apps/web/src/app/core/services/auth-data.spec.ts:59-61` |
| CA1 — Criação de conta no Supabase Auth (`signUp`) com metadados (`name`, `registrationNumber`, `whatsapp`, `role: 'student'`, `isBlocked: false`) | atendido | `apps/web/src/app/core/services/auth-data.ts:152-164`, `apps/web/src/app/core/services/auth-data.spec.ts:65-77` |
| CA1 / Assume que — Espelhamento em `POST /users` no `json-server` sem senha e com `// TODO` Atividade 15 | atendido | `apps/web/src/app/core/services/auth-data.ts:179-192`, `apps/web/src/app/core/services/auth-data.spec.ts:79-95` |
| CA1 — Encerramento de sessão automática criada pelo `signUp` (`signOut` + limpeza de estado sem engolir falhas) | atendido | `apps/web/src/app/core/services/auth-data.ts:198-222`, `apps/web/src/app/core/services/auth-data.spec.ts:99-102`, `apps/web/src/app/core/services/auth-data.spec.ts:264-337`, `apps/web/src/app/features/auth/register/register.spec.ts:425-453` |
| CA1 / Protótipo — Redirecionamento para `/login` exibindo aviso em português de conta criada com sucesso com tokens semânticos | atendido | `apps/web/src/app/features/auth/register/register.ts:53`, `apps/web/src/app/features/auth/login/login.ts:17`, `apps/web/src/app/features/auth/login/login.ts:47`, `apps/web/src/app/features/auth/login/login.html:10-18`, `apps/web/src/app/features/auth/login/login.spec.ts:139-168` |
| CA2 — Bloqueio de envio para e-mail fora de `@alunos.utfpr.edu.br`, senha < 6 caracteres e senhas divergentes | atendido | `apps/web/src/app/features/auth/register/register.ts:32-40`, `apps/web/src/app/features/auth/register/register.spec.ts:110-160`, `apps/web/src/app/features/auth/register/register.spec.ts:241-261` |
| CA2 — Tratamento de duplicidade no `json-server` ou usuário já registrado no Supabase Auth (erro ou `identities: []`) sem espelhar em `/users` nem redirecionar | atendido | `apps/web/src/app/core/services/auth-data.ts:20-25`, `apps/web/src/app/core/services/auth-data.ts:167-169`, `apps/web/src/app/core/services/auth-data.spec.ts:106-156`, `apps/web/src/app/features/auth/register/register.spec.ts:305-354` |
| CA2 — Tradução de erros do Supabase Auth para português em `/register` sem vazar mensagens internas e permitindo nova tentativa | atendido | `apps/web/src/app/core/services/auth-data.ts:45-59`, `apps/web/src/app/core/services/auth-data.ts:174`, `apps/web/src/app/features/auth/register/register.html:27-29`, `apps/web/src/app/features/auth/register/register.ts:48-49`, `apps/web/src/app/features/auth/register/register.spec.ts:356-395` |
| CA9 / Abandono e falha de rede — Descarte ao sair do formulário e tratamento de falha de conexão em `signUp`, `POST /users` e `signOut` | atendido | `apps/web/src/app/core/services/auth-data.ts:27-43`, `apps/web/src/app/core/services/auth-data.ts:171-173`, `apps/web/src/app/core/services/auth-data.ts:193-209`, `apps/web/src/app/features/auth/register/register.spec.ts:74-103`, `apps/web/src/app/features/auth/register/register.spec.ts:397-453` |
| CA10 / Suíte de testes — Execução integral com mocks (`SUPABASE_AUTH_CLIENT`) sem chamadas reais (`npm test`: 2/2 em `layout.spec.mjs` e 20 arquivos / 229 testes Vitest aprovados) | atendido | `apps/web/src/app/core/services/auth-data.spec.ts`, `apps/web/src/app/features/auth/register/register.spec.ts`, `apps/web/src/app/features/auth/login/login.spec.ts` |

## Apontamentos
