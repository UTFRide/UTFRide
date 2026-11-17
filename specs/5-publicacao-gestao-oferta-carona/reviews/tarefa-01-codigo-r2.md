# Parecer de Código — Tarefa 1 (Rodada 2)

**Veredito:** APROVADO

## Verificação da Rodada 1
- **Apontamento #1 (recusado em `tarefa-01-decisoes-r1.md`):** Mantido fora do escopo desta tarefa conforme justificativa registrada (CA9 na Tarefa 7 e CA10 na Tarefa 8).
- **Apontamento #2 (aceito em `tarefa-01-decisoes-r1.md`):** Corrigido adequadamente. Foi criado o pipe puro `CurrencyBrlPipe` (`currencyBrl`) em `apps/web/src/app/shared/pipes/currency-brl-pipe.ts` com cobertura unitária em `apps/web/src/app/shared/pipes/currency-brl-pipe.spec.ts`, e `OfferRide` (`apps/web/src/app/features/driver/offer-ride/offer-ride.ts:57` e `offer-ride.html:275`) passou a utilizá-lo no lugar de método no componente, em conformidade com `docs/architecture.md` (seções 1.2 e 4.2) e `.agents/rules/01-angular-strict-rules.md`.

## Apontamentos (bloqueiam)
Nenhum.

## Sugestões (não bloqueiam)
- Em `apps/web/src/app/features/driver/offer-ride/offer-ride.spec.ts` e `apps/web/src/app/core/services/auth-data.spec.ts:57` (no diff), substituir a URL literal `'http://localhost:3000/...'` por `${environment.apiUrl}/...`, seguindo o padrão adotado em `apps/web/src/app/core/services/ride-data.spec.ts`.
- Em `apps/web/src/app/core/services/auth-data.ts:20-35`, usar desestruturação omitindo `password` em `currentUser` para manter o contrato alinhado a `Omit<User, 'password'>` automaticamente caso `User` ganhe novos campos.
- Em `apps/web/src/app/features/driver/offer-ride/offer-ride.ts:158`, após `this.form.updateValueAndValidity()` e `if (this.form.invalid || this.loading()) return;`, `futureDepartureValidator` já garante que a data é futura; manter apenas `!departure` para *type narrowing* evita duplicar a condição `<= Date.now()`.
- Em `apps/web/src/app/features/driver/offer-ride/offer-ride.html:76`, considerar substituir `pl-12` por uma composição alinhada aos tokens de espaçamento de `docs/design-tokens.md`.

## Observações fora do escopo deste diff
- Testes pré-existentes (`apps/web/src/app/core/services/auth-data.spec.ts`, `apps/web/src/app/features/auth/login/login.spec.ts` e `apps/web/src/app/features/auth/register/register.spec.ts`) também referenciam `'http://localhost:3000/...'` diretamente em vez de `environment.apiUrl`.
- `apps/web/src/app/features/auth/layout.spec.mjs` verifica tokens e largura máxima apenas das telas públicas (`landing` e `register`), não cobrindo telas autenticadas.

## Verificações executadas
- `npm test`: passou (2/2 testes em `apps/web/src/app/features/auth/layout.spec.mjs`; 9 arquivos / 40 testes no Vitest, incluindo `currency-brl-pipe.spec.ts`, `ride-data.spec.ts` e `offer-ride.spec.ts`).
- `npm run lint`: passou (`All files pass linting.`).
