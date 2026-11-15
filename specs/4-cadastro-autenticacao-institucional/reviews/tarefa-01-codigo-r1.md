# Parecer de Código — Tarefa 1

**Veredito: APONTAMENTOS**

## Apontamentos (bloqueiam)

1. **URL da API fixada no serviço** — `apps/web/src/app/core/services/auth-data.ts:11`  
   Regra violada: o papel de revisão reprova URL de ambiente escrita no código. A arquitetura §2.1 define `localhost:3000` para o MVP.  
   Prejuízo concreto: ao acessar o frontend em outro dispositivo ou hospedar a API em outro endereço, as requisições continuam apontando para o próprio navegador, exigindo alteração no código para mudar o ambiente.

2. **Conversão de RxJS para signal está no componente** — `apps/web/src/app/features/auth/register/register.ts:19`  
   Regra violada: a arquitetura §2.4 determina a conversão de chamadas assíncronas em signals nos Services.  
   Prejuízo concreto: a tela fica responsável por coordenar o fluxo assíncrono da fonte de dados; mudanças nessa fronteira exigem alterar o componente e dificultam manter a integração concentrada no Service, como previsto para a migração de dados.

## Sugestões (não bloqueiam)

- Nenhuma.

## Observações fora do escopo deste diff

- Nenhuma. A validação do domínio institucional e o tratamento de falhas de conexão estão previstos, respectivamente, nas tarefas 3 e 7 do plano.
