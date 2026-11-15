# Parecer de Conformidade — Tarefa 4

**Veredito:** APONTAMENTOS

## Critérios verificados

| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA6 — Mensagem amigável para credenciais inválidas, sem identificar a credencial incorreta | atendido | `apps/web/src/app/features/auth/login/login.html:16` |
| CA6 — Teste comprova que não há detalhes adicionais revelando a credencial incorreta | não atendido | `apps/web/src/app/features/auth/login/login.spec.ts:28` |
| Tela de login e estado de erro conforme o protótipo | não atendido | `apps/web/src/app/features/auth/login/login.html:17` |
| CA1, CA4, CA5, CA7, CA8 e CA9 | fora desta tarefa | `specs/4-cadastro-autenticacao-institucional/spec.md:18` |

`npm test` passou: 2 verificações preliminares e 14 testes da aplicação.

## Apontamentos

1. **O teste não garante que a mensagem não revele qual credencial falhou** — `apps/web/src/app/features/auth/login/login.spec.ts:28`  
   Critério violado: `spec.md:21` — “vê uma mensagem amigável sem detalhes específicos de segurança”.  
   Evidência: a asserção usa `toContain`, portanto também passaria se o alerta incluísse a frase esperada seguida de uma identificação específica do e-mail ou da senha.

2. **O estado de erro não oferece o fechamento previsto no protótipo** — `apps/web/src/app/features/auth/login/login.html:17`  
   Critério violado: `spec.md:32` — tela “Login e Estados de Erro”.  
   Evidência: o cartão de falha do protótipo possui um botão para dispensá-lo; o cartão implementado não possui esse controle e só desaparece ao iniciar outra tentativa.
