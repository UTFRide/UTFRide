# Parecer de Código — Tarefa 1

**Veredito:** APONTAMENTOS

## Apontamentos (bloqueiam)
1. **Falhas de publicação engolidas silenciosamente no componente** — `apps/web/src/app/features/driver/offer-ride/offer-ride.ts:96-103`
   Regra violada: Tratamento de erro que engole a falha silenciosamente (em desacordo com o contrato de `errorInterceptor` em `docs/architecture.md` seção 2.4 e com o padrão do próprio projeto em `login.ts`/`register.ts`).
   Prejuízo concreto: `RideData.publishResult` (`apps/web/src/app/core/services/ride-data.ts:10-14`) retorna `{ ride } | { unauthorized: true } | { connectionError: true } | { requestError: true }`. Como o `errorInterceptor` (`apps/web/src/app/core/interceptors/error-interceptor.ts:22`) não preenche `ErrorNotice` quando `error.status === 0` e `RideData` não preenche `ErrorNotice` para `{ unauthorized: true }`, o `effect` `handlePublishResult` em `OfferRide` apenas zera `loading` e trata `'ride' in result`. Em caso de falha de conexão (`status === 0`) ou usuário bloqueado/sem sessão (`unauthorized`), a falha é descartada sem qualquer feedback visual ao motorista.

2. **Formatação monetária implementada como método no componente em vez de Pipe** — `apps/web/src/app/features/driver/offer-ride/offer-ride.ts:133-135` e `apps/web/src/app/features/driver/offer-ride/offer-ride.html:275`
   Regra violada: `docs/architecture.md`, seção 1.2 ("Pipes: Uso de pipes para formatação de dados monetários (`currencyBrl`), datas relativas e status de carona").
   Prejuízo concreto: Além de fugir do padrão arquitetural acordado (que já prevê `apps/web/src/app/shared/pipes/`), chamar `formatCurrency(ride.pricePerSeat)` no template reexecuta o método a cada ciclo de detecção de mudanças e impede o reuso imediato da formatação BRL nas próximas telas da história e de busca (`my-rides`, `ride-list`, `ride-detail`), incentivando duplicação.

## Sugestões (não bloqueiam)
- Em `apps/web/src/app/features/driver/offer-ride/offer-ride.spec.ts:13,98,143,187` e `apps/web/src/app/core/services/auth-data.spec.ts:32`, substituir a URL literal `'http://localhost:3000/...'` por `${environment.apiUrl}/...`, seguindo o padrão já adotado em `apps/web/src/app/core/services/ride-data.spec.ts`.
- Em `apps/web/src/app/core/services/auth-data.ts:20-35`, copiar os campos manualmente em `currentUser` exige lembrar de atualizar o `computed` se novos atributos forem adicionados a `User`; usar desestruturação omitindo `password` mantém o contrato alinhado ao `Omit<User, 'password'>` automaticamente.
- Em `apps/web/src/app/features/driver/offer-ride/offer-ride.ts:161`, após `this.form.updateValueAndValidity()` e `if (this.form.invalid || this.loading()) return;`, o validador `futureDepartureValidator` já garantiu que `departure` existe e é futuro; manter apenas `!departure` para *type narrowing* evita repetir a regra `<= Date.now()`.
- Em `apps/web/src/app/features/driver/offer-ride/offer-ride.html:76`, considerar substituir `pl-12` por uma composição alinhada ao ritmo de tokens de `docs/design-tokens.md`.

## Observações fora do escopo deste diff
- Testes pré-existentes (`apps/web/src/app/core/services/auth-data.spec.ts:14,17`, `apps/web/src/app/features/auth/login/login.spec.ts` e `apps/web/src/app/features/auth/register/register.spec.ts`) também referenciam `'http://localhost:3000/...'` diretamente em vez de `environment.apiUrl`.
- `apps/web/src/app/features/auth/layout.spec.mjs` cobre a resolução de tokens e largura máxima apenas das telas `landing` e `register`, não verificando telas autenticadas.

## Verificações executadas
- `npm test`: passou (2/2 testes em `apps/web/src/app/features/auth/layout.spec.mjs`; 8 arquivos / 38 testes no Vitest, incluindo `ride-data.spec.ts` e `offer-ride.spec.ts`).
- `npm run lint`: passou (`All files pass linting.`).
