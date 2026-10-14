# Site institucional — Larissa Bueno · Neuropsicopedagogia

Site de apresentação para famílias, separado do NeuroPlanner (o sistema clínico na raiz deste repositório).
Os dois não compartilham código, dados nem publicação: o site é estático e não tem acesso a nenhuma informação de pacientes.

- **Sem dependências:** HTML, CSS e um JavaScript pequeno (menu do celular). O build usa só Node 22.
- **Tudo o que é dado pessoal ou ainda não confirmado fica em `config.json`**, e não espalhado pelo HTML.
- **Fontes hospedadas no próprio site** (Fraunces nos títulos, Livvic nos textos; licença OFL em `src/fonts/`). Nenhuma chamada ao Google.

## Como gerar e ver

```bash
cd site
node build.mjs --preview      # pré-visualização: mostra no topo o que falta configurar e não é indexada
python3 -m http.server -d dist 8000   # abra http://localhost:8000
node build.mjs                # produção: falha se não houver canal de contato configurado
```

## O que preencher em `config.json`

| Campo | Para que serve | Situação |
| --- | --- | --- |
| `whatsapp` | Botões de contato. DDI + DDD + número, só dígitos. A mensagem inicial está em `mensagemWhatsapp`. Sem ele, o build de produção não roda. | (47) 99692-1817 |
| `url` | Domínio final (`https://…`). Gera canonical, imagem de compartilhamento, sitemap e dados estruturados. | **Pendente** |
| `cidades` / `uf` | Região de atendimento (aparece no texto e na descrição para o Google). | Balneário Camboriú (SC) |
| `atendimentoDomiciliar` | `true` passa a dizer que há atendimento em domicílio. | `false` (não há) |
| `formacao` | Lista exibida em “Formação”. `detalhe` aceita instituição/ano ou “em andamento”. | “Pedagogia” — **confirmar** |
| `cbo` | Código da ocupação na Classificação Brasileira de Ocupações (aparece na apresentação e no rodapé). Não é registro profissional. | 2394-40 |
| `instagram`, `email` | Canais extras (aparecem no contato e no rodapé). | vazios |
| `adobeFontsKit` | ID de um kit do Adobe Fonts com a **Neulis**; ela passa a ser usada nos títulos. | opcional |

## Fotos

As três fotos já estão no site, sem edição: os JPGs são os originais (sem metadados de localização) e as versões WebP de 800 e 1400 px são cópias mais leves para celular. Se alguma foto for removida, o início volta a mostrar a composição com os elementos da marca e as outras seções se reorganizam sem foto.

| Espaço | Arquivo esperado em `src/img/fotos/` | Foto |
| --- | --- | --- |
| Início | `larissa-atividade-pecas.jpg` | Larissa de frente, à mesa, com o jogo de peças coloridas (criança de costas) |
| Apresentação | `larissa-letra-vermelha.jpg` | Larissa mostrando a letra vermelha, com estantes ao fundo |
| Avaliação | `letras-mesa-vista-de-cima.jpg` | Vista de cima, letras de madeira na mesa verde-água |

Para otimizar (corrigir rotação, **remover localização GPS e outros metadados**, reduzir tamanho e gerar WebP), coloque as originais em `site/fotos-originais/` com esses nomes e rode `./otimizar-fotos.sh` (requer ImageMagick).
A pasta `fotos-originais/` é ignorada pelo Git de propósito. **Este repositório é público:** não envie fotos originais de celular/câmera para ele sem remover os metadados.

Antes de publicar, confirme que há **autorização por escrito dos responsáveis** para o uso de imagem das crianças que aparecem.

## Publicação (Netlify)

Crie um **site novo** no Netlify a partir deste repositório, com *Base directory* = `site`. O `site/netlify.toml` define o build (`node build.mjs`) e a pasta publicada (`dist`).
O build também gera `_headers` com política de segurança de conteúdo (CSP) e cache para fontes e imagens.

## Estrutura

```
site/
  config.json          dados configuráveis
  build.mjs            monta dist/ a partir de src/ + config.json
  otimizar-fotos.sh    prepara as fotos para a web
  src/
    index.html         página principal (marcadores {{…}} preenchidos no build)
    privacidade.html   política de privacidade
    404.html
    styles.css         paleta, tipografia e layout
    main.js            menu do celular e borda do cabeçalho
    fonts/  img/
```
