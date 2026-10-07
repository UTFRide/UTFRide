# 🎨 Tokens de Design

**Projeto:** UTFRide  
**Versão:** 1.0.0  
**Última atualização:** 2026-10-07  
**Framework CSS:** Tailwind CSS  

> 🤖 **Este documento existe para a IA parar de inventar um botão diferente a cada tela.** Não é um design system completo — é a régua semântica e visual à qual o código e os componentes obedecem rigorosamente.

---

## 🎨 Paleta de Cores (Tokens Semânticos)

Nome semântico, nunca `amarelo-1` ou `preto-2` — a cor pode mudar, o papel semântico permanece.

| Token | Valor (Hex) | Onde se usa |
| :--- | :--- | :--- |
| `primaria` | `#FFCC00` (texto: `#111111`) | Ação principal, botões de destaque, rota ativa, marcadores de embarque (Amarelo institucional UTFPR) |
| `primaria-hover` | `#F1C100` | Estado de hover/ativo da ação principal (`primary-fixed-dim`) |
| `primaria-escura` | `#745B00` | Texto ou ícones em amarelo sobre fundo claro |
| `secundaria` | `#111111` | Botões secundários, cabeçalhos, barra de navegação superior/inferior |
| `superficie` | `#FFFFFF` | Fundo de cards, bottom sheets, modais e inputs |
| `fundo` | `#F4F4F5` | Fundo geral da aplicação, campos de busca e controles segmentados |
| `borda` | `#E4E4E7` | Bordas de cards, inputs e divisores |
| `trilho` | `#D4D4D8` | Linha de conexão da rota e alça do bottom sheet |
| `texto` | `#111111` | Texto principal legível |
| `texto-suave` | `#71717A` | Legendas, apoios, metadados e abas inativas |
| `perigo` | `#DC2626` (fundo: `#FEE2E2`) | Cancelamentos, denúncias, vaga indisponível, ações destrutivas |
| `sucesso` | `#16A34A` (fundo: `#DCFCE7`) | Carona confirmada, motorista chegando, selo institucional validado |
| `pendente` | `#D97706` (fundo: `#FEF3C7`) | Reserva aguardando confirmação, buscando motorista, avisos de atraso |
| `desabilitado` | `#E4E4E7` (texto: `#71717A`) | Botões, inputs e controles inativos |

---

## 📏 Escala de Espaçamento

Ritmo proporcional de espaçamento usado em layouts, paddings e margens.

| Token | Valor | Onde se usa |
| :--- | :--- | :--- |
| `xs` | `4px` (`0.25rem`) | Espaçamento mínimo entre elementos, base do ritmo de 4px, tags |
| `sm` | `8px` (`0.5rem`) | Margem do topo da alça do bottom sheet, espaços compactos |
| `md` | `12px` (`0.75rem`) | Separação entre os cards de carona em uma lista |
| `lg` | `16px` (`1.0rem`) | Padding interno dos cards, margens de página (`margin`) e gutter |
| `xl` | `24px` (`1.5rem`) | Espaço entre seções e grupos de cards |

---

## 🔤 Tipografia

**Família principal:** `Inter`, sans-serif (em toda a escala da aplicação).

| Token / Papel | Tamanho | Peso | Onde se usa |
| :--- | :--- | :--- | :--- |
| `display-currency` | `26px` | Bold (`700`) | Valores monetários em destaque (ex.: `R$ 15,00`) |
| `headline-lg` | `24px` | Bold (`700`) | Título principal de página / cabeçalho de destaque |
| `headline-md` | `20px` | Bold (`700`) | Títulos de seções e modais |
| `headline-sm` | `18px` | SemiBold (`600`) | Títulos de cards de carona e rotas |
| `body-lg` | `16px` | Medium (`500`) | Texto de destaque, destaques de trajeto |
| `body-md` | `14px` | Regular (`400`) | Texto de corpo padrão, formulários |
| `body-sm` | `12px` | Regular (`400`) | Textos secundários, legendas de data/horário |
| `label-lg` | `14px` | SemiBold (`600`) | Botões principais e links de navegação |
| `label-md` | `12px` | SemiBold (`600`) | Botões secundários e controles de formulário |
| `label-pill` | `11px` | Bold (`700`) | Badges de status (Ativa, Lotada, Pendente, Cancelada) |

---

## 🔘 Estados de Botão

| Estado | Aparência |
| :--- | :--- |
| **Normal** | Fundo `#FFCC00`, Texto `#111111`, peso SemiBold, borda arredondada (`rounded-xl` ou `rounded-full`) |
| **Hover / Ativo** | Fundo `#F1C100` (`primaria-hover`), cursor pointer |
| **Foco (teclado / a11y)** | Anel de foco externo (`ring-2 ring-offset-2 ring-[#111111]`) |
| **Desabilitado** | Fundo `#E4E4E7`, Texto `#71717A`, cursor `not-allowed`, sem transição |
| **Carregando (`loading`)** | Fundo `#FFCC00`, spinner centralizado `#111111`, clique bloqueado |

---

## 📱 Breakpoints (Mobile-First)

O design nasce para a menor tela e cresce progressivamente (ID2). Toda tela do protótipo tem versão mobile antes da versão desktop.

| Token | Largura mínima | Comportamento e Adaptação |
| :--- | :--- | :--- |
| **Base (Mobile)** | `< 640px` | Bottom navigation bar, bottom sheets para detalhes de caronas, lista em coluna única |
| **`sm`** | `640px` | Mobile expandido / modo paisagem: ajustes de padding interno |
| **`md`** | `768px` | Tablets: transição para barra superior ou menu lateral colapsável |
| **`lg`** | `1024px` | Desktop: layout multi-colunas (filtros à esquerda, lista de caronas ao centro e mapa/detalhes) |
| **`xl`** | `1280px` | Desktop amplo: container centralizado com limite `max-w-6xl` |

---

## 📲 Identidade PWA (ID3)

Alimenta o arquivo `manifest.webmanifest` e as configurações de PWA no setup.

| Campo | Valor |
| :--- | :--- |
| **Nome (`name`)** | `UTFRide - Caronas Universitárias UTFPR` |
| **Nome Curto (`short_name`)** | `UTFRide` |
| **Cor de Tema (`theme_color`)** | `#FFCC00` |
| **Cor de Fundo (`background_color`)** | `#F4F4F5` |
| **Ícones** | `icons/icon-192x192.png`, `icons/icon-512x512.png` |
| **Modo de Exibição (`display`)** | `standalone` |
| **Orientação (`orientation`)** | `portrait-primary` |
| **Comportamento Visual Offline** | Exibição das últimas viagens e rotas salvas em cache; banner persistente no topo (*"Você está offline. Visualizando dados salvos"*); desabilitação de novas solicitações ou publicações até restabelecimento da conexão. |

---

## 🗺️ Protótipo Navegável (ID1)

- **Link Público do Figma:** [Protótipo UTFRide no Figma](https://www.figma.com/design/QWpCo1rfJqA466WFe8khU2/Sem-t%25C3%25ADtulo?node-id=0-1&p=f&t=MDkNtqCEA9Vef4nj-0)
- **Telas Mapeadas na Jornada:**
  1. *Landing Page (Visitante)*
  2. *Cadastro de Aluno (Institucional)*
  3. *Login e Estados de Erro*
  4. *Buscar Caronas (Home)*
  5. *Detalhe da Oferta e Solicitar Vaga (Bottom Sheet)*
  6. *Oferecer Carona (Motorista)*
  7. *Minhas Ofertas e Gerenciar Solicitações*
  8. *Mural de Buscas (Passageiro)*
