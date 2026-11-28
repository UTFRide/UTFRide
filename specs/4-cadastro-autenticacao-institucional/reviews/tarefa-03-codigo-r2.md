# Parecer de Código — Tarefa 3

**Veredito:** APONTAMENTOS

## Apontamentos (bloqueiam)

1. **Teste acoplado à implementação visual do ícone** — `apps/web/src/app/features/auth/register/register.spec.ts:36`  
   Regra violada: o método de revisão de código reprova testes acoplados a detalhes de implementação; a arquitetura, seção 7, exige mensagem de erro contextual, mas não uma classe ou nome de ícone específico.  
   Prejuízo concreto: trocar a biblioteca de ícones ou sua marcação fará o teste falhar mesmo que o alerta continue visível e cumpra seu propósito.

## Sugestões (não bloqueiam)

- Nenhuma.

## Observações fora do escopo deste diff

- As alterações preexistentes nos demais arquivos informados no despacho não foram atribuídas à Tarefa 3.
- O teste solicitado passou: **6 testes em 1 arquivo**.
