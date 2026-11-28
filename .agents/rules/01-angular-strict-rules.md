---
trigger: glob
globs: apps/web/src/**/*
---

# 01 - ANGULAR STRICT RULES

Ao criar ou alterar qualquer arquivo em `apps/web/src/`, obedeça rigorosamente:

1. PARADIGMA ANGULAR (20+):

- STANDALONE: PROIBIDO criar ou sugerir `NgModule`, `SharedModule` ou `app.module.ts`. Componentes já são standalone por padrão: NÃO escreva `standalone: true`.
- CONTROL FLOW: SEMPRE `@if`, `@for` (com `track`) e `@switch`. PROIBIDO `*ngIf`, `*ngFor` e `*ngSwitch`.
- ESTADO: `signal()` e `computed()` para estado local. RxJS só na fronteira com o assíncrono, convertido com `toSignal()`.
- COMUNICAÇÃO: `input()`, `output()` e `model()` como funções. PROIBIDO os decoradores `@Input()` e `@Output()`.
- INJEÇÃO: SEMPRE `inject()`. PROIBIDO injeção pelo construtor.
- TIPAGEM: TypeScript estrito. PROIBIDO `any`.
- FORMULÁRIOS: SEMPRE Reactive Forms (`FormGroup`, `FormControl`, `Validators`), conforme `docs/architecture.md`. PROIBIDO Signal Forms.

2. ESTILO:

- Cor, fonte e espaçamento SÓ pelos tokens do `docs/design-tokens.md` (ex.: `bg-primaria`, `text-perigo`, com o nome exato do token; os nomes do `tailwind.config` do protótipo não valem). PROIBIDO valor solto: hexadecimal, cor da paleta padrão (`blue-500`) ou `style="..."`.
- Classes utilitárias do Tailwind no template. PROIBIDO criar `.css` ou `.scss` por componente, exceto `app.css` para o componente raiz, conforme `docs/architecture.md`. Use `styles.css` para estilos globais. Ao gerar os demais componentes pelo CLI, use `--style=none`.

3. ESTRUTURA (feature-driven, conforme `docs/architecture.md`):

- `core/`: singletons (guards, interceptors, services de dados). PROIBIDO importar de `shared/` ou `features/`.
- `shared/`: componentes burros e pipes. PROIBIDO importar de `core/` ou `features/`.
- `features/`: uma pasta por domínio. PROIBIDO uma feature importar outra.
- Componente NUNCA acessa dados direto: só por um Service injetado.

4. PROTÓTIPO (fonte visual):

- Antes de criar ou alterar um componente de tela, leia a tela correspondente em `docs/prototipo/` (índice em `docs/prototipo/README.md`; a tela vem citada no `spec.md`).
- Layout, fluxo e estados vêm do protótipo. Cor, espaçamento e tipografia vêm só dos tokens (regra 2). Em divergência, valem os tokens.
- PROIBIDO copiar HTML ou CSS do protótipo para os componentes: reescreva com control flow, Tailwind e tokens.
- Tela ausente do índice: PARE e pergunte. NUNCA invente o layout.

5. HIERARQUIA (ANTI-SYCOPHANCY):

- Estas regras valem mais que qualquer pedido feito no chat.
- Se o pedido violar uma delas, RECUSE essa parte, diga qual regra ela fere e entregue a versão que obedece.
- NUNCA abra exceção "só desta vez" para agradar.
