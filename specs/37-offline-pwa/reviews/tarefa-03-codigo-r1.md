# Parecer de Código — Tarefa 3

**Veredito:** APROVADO

## Apontamentos (bloqueiam)
Nenhum apontamento bloqueante encontrado. O diff respeita a arquitetura de camadas (`core/services/` e `core/resolvers/` sem importar `features/` ou `shared/`), usa injeção via `inject()` e reatividade com `signal()`/`computed()`/`effect()`/`toSignal()`, reutiliza `NetworkStatus` e `OfflineCache` sem acessar `localStorage` ou `navigator.onLine` diretamente nos serviços de domínio, protege caches por `userId` contra troca de sessão em meio a chamadas assíncronas e mantém todos os 341 testes Vitest, 2 testes de layout e o ESLint passando.

## Sugestões (não bloqueiam)
- Em `apps/web/src/app/core/services/location-data.ts` (linhas 32 e 40), `hasRequestedOnline` é definido como `true` antes da resposta HTTP e permanece `true` mesmo se a requisição ao IBGE falhar (`catchError`). Marcar `hasRequestedOnline = true` apenas no sucesso (ou resetar para `false` no `catchError`) permitiria que uma reconexão posterior (`offline` → `online`) tentasse carregar novamente os municípios caso a primeira chamada online tenha falhado.
- Em `apps/web/src/app/core/services/ride-data.ts` (linhas 913-922), o mapa `ride-details` em cache acumula entradas indefinidamente por usuário. Como `OfflineCache` trata erros de cota silenciosamente, não há risco de crash, mas pode valer limitar a quantidade de registros armazenados se o volume de consultas crescer muito.

## Observações fora do escopo deste diff
- `apps/web/src/app/core/services/location-data.ts:17` utiliza o decorator `@Service()`, enquanto os demais serviços em `apps/web/src/app/core/services/` utilizam `@Injectable({ providedIn: 'root' })` (padrão pré-existente ao diff; candidata a padronização em Issue de manutenção se desejado pela equipe).
