# Parecer de Conformidade — Tarefa 1

**Veredito:** APONTAMENTOS

## Critérios verificados

| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA1 — Enviar dados válidos e criar conta com confirmação simulada | não atendido pelo teste: a persistência não é verificada | `apps/web/src/app/core/services/auth-data.ts:10`; `apps/web/src/app/features/auth/register/register.spec.ts:29` |
| CA1 — Navegar para `/login` após o cadastro | atendido, considerando a decisão informada de deixar a tela de login para a tarefa 2 | `apps/web/src/app/features/auth/register/register.ts:27`; `apps/web/src/app/features/auth/register/register.spec.ts:44` |
| CA9 — Informar falha de conexão e permitir nova tentativa | não atendido; previsto na tarefa 7 | `apps/web/src/app/features/auth/register/register.ts:18` |
| CA4, CA5, CA6, CA7 e CA8 | fora desta tarefa | `specs/4-cadastro-autenticacao-institucional/plan.md` |
| Referências visuais da landing e do cadastro | não atendido | `apps/web/src/app/features/auth/landing/landing.html:13`; `apps/web/src/app/features/auth/register/register.html:18` |

Os comandos `npm test` e `npm run build` passaram; a suíte executou três testes.

## Apontamentos

1. **O teste não comprova que a conta foi persistida** — `apps/web/src/app/features/auth/register/register.spec.ts:29`  
   Critério violado: CA1 exige que “sua conta é criada” (`specs/4-cadastro-autenticacao-institucional/spec.md:18`).  
   Evidência: o teste verifica o corpo do POST e simula uma resposta de sucesso com `request.flush`; ele não verifica a criação de um registro na fonte de dados.

2. **Uma falha de conexão deixa o cadastro sem mensagem e sem nova tentativa** — `apps/web/src/app/features/auth/register/register.ts:18`  
   Critério violado: CA9 exige que, quando a operação falha, “o aluno é informado e pode tentar novamente” (`specs/4-cadastro-autenticacao-institucional/spec.md:24`).  
   Evidência: não há tratamento de erro na requisição; `loading` é ativado no envio e só é desativado no caminho de sucesso. O tratamento está previsto para a tarefa 7.

3. **As telas omitem elementos relevantes dos protótipos indicados** — `apps/web/src/app/features/auth/landing/landing.html:13`; `apps/web/src/app/features/auth/register/register.html:18`  
   Critério violado: a spec indica a landing e o cadastro como telas de referência (`specs/4-cadastro-autenticacao-institucional/spec.md:26`).  
   Evidência: a landing não apresenta a imagem do campus nem a marca no destaque principal. O cadastro omite os campos visíveis de WhatsApp e confirmação de senha, a declaração de termos e o aviso de confirmação automática presentes no protótipo.
