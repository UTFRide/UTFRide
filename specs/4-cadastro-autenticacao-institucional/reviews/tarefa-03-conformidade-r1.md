# Parecer de Conformidade — Tarefa 3

**Veredito:** APONTAMENTOS

## Critérios verificados

| Critério (da spec) | Situação | Onde |
| --- | --- | --- |
| CA5 — bloquear o envio com e-mail não institucional | atendido | `register.ts:31`; `register.html:51` |
| CA5 — informar a exigência do domínio | atendido | `register.html:27` |
| Estado visual de erro da tela de cadastro | não atendido | `register.html:27` |

O teste solicitado passou: 6 testes em 1 arquivo.

## Apontamentos

1. **O estado de erro diverge visualmente do protótipo** — `apps/web/src/app/features/auth/register/register.html:27`  
   Critério violado: a spec indica `docs/prototipo/models/2._cadastro_de_aluno.html` como referência da tela de cadastro.  
   Evidência: o protótipo apresenta um alerta destacado acima do formulário, com ícone e título “Validação necessária”; a implementação apresenta uma mensagem pequena abaixo do campo de e-mail.
