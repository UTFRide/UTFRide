# Protótipo — fonte da verdade das telas

Esta pasta guarda as telas do protótipo em estado final. **É o que o agente lê** para
saber como cada tela deve ser. O link do Figma/Stitch no README e no
`docs/design-tokens.md` existe só como evidência pública (ID1) e **o agente não o consulta**.

## Hierarquia de fontes

1. **Esta pasta (`docs/prototipo/`)** manda em layout, fluxo, hierarquia visual, estados e navegação.
2. **`docs/design-tokens.md`** manda em cor, espaçamento e tipografia. Se uma tela daqui usar
   um valor que não está nos tokens, vale o token e o desvio vira dúvida para o usuário.
3. **Link do Figma/Stitch**: apenas evidência pública. Nunca consultado.

## Como usar

- O protótipo é **referência visual e de fluxo, não código para copiar**. O HTML/CSS daqui não
  entra nos componentes: as telas Angular seguem `.agents/rules/01-angular-strict-rules.md`.
- Toda tela do `spec.md` aponta para um arquivo deste índice (seção "Telas do protótipo").
- Tela que não está no índice não existe para o agente: se faltar, ele pergunta, não inventa.

## Índice de telas

<!-- Preencha ao colocar os arquivos. Uma linha por tela (ou por estado relevante dela).
     O caminho é relativo a esta pasta. -->

| Tela | Story (US) | Arquivo | Observações (estados, versão mobile/desktop) |
| --- | --- | --- | --- |
| Landing Page (Visitante) | US01 | `models/1._landing_page_visitante.html` | |
| Cadastro de Aluno (Institucional) | US01 | `models/2._cadastro_de_aluno.html` | |
| Login e Estados de Erro | US01 | `models/3._login_e_estados_de_erro.html` | |
| Buscar Caronas (Home) | US03 | `models/4._buscar_caronas_home.html` | |
| Detalhe da Oferta e Solicitar Vaga (Bottom Sheet) | US03 | `models/5._detalhe_da_oferta_e_solicitar_vaga.html` | |
| Oferecer Carona (Motorista) | US02 | `models/6._oferecer_carona_motorista.html` | |
| Minhas Ofertas e Gerenciar Solicitações | US02 | `models/7._minhas_ofertas_e_gerenciar_solicita_es.html` | |
| Minhas Viagens (Passageiro) | US03 / US05 | `models/8._minhas_viagens_passageiro.html` | |
| Mural de Buscas (Passageiro) | US04 | `models/9._mural_de_buscas_passageiro.html` | |
| Avaliar Participantes | US05 | `models/10._avaliar_participantes.html` | |
| Denúncia ao Suporte | US06 | `models/11._den_ncia_ao_suporte.html` | |
| Perfil do Aluno | (sem story própria) | `models/12._perfil_do_aluno.html` | Liga US05 (histórico) e US06 |
| Painel de Suporte (Desktop) | US06 | `models/13._painel_de_suporte_desktop.html` | Só desktop |
| Acesso Negado (403) | US01 / US06 | `models/14._acesso_negado_403_forbidden.html` | |

## Origem e versão

- Origem: `https://kowalczykedu.github.io/Prototipo-UTFRide/`
- O `index.html` exportado foi renomeado para `1._landing_page_visitante.html` para os links entre telas funcionarem.
- Os HTMLs usam Tailwind via CDN, fontes do Google e imagens externas (Stitch); precisam de rede para abrir completos.
- Os nomes de cor do `tailwind.config` do protótipo (`primary`, `surface`…) **não** valem no projeto: as classes seguem os nomes do `docs/design-tokens.md`.
- Commit/data da cópia: _preencher_

