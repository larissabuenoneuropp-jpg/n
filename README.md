# NeuroPlanner

Plataforma SaaS de **gestão clínica + planejamento terapêutico com IA + financeiro** para Neuropsicopedagogas (expansível para psicopedagogos, psicólogos, fonoaudiólogos e terapeutas).

Stack: **Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Supabase (Auth, Postgres, Storage) · OpenAI API**.

---

## Começando

```bash
npm install
cp .env.example .env.local   # opcional — veja abaixo
npm run dev                  # http://localhost:3000
```

### Modo demonstração (sem configuração)

Sem as variáveis do Supabase, o app abre em **modo demonstração**: dados fictícios salvos apenas no navegador (localStorage), sem login. Sem `OPENAI_API_KEY`, a IA devolve **respostas de exemplo** (sinalizadas na tela). Use para conhecer o produto — **não insira dados reais de pacientes nesse modo**.

### Produção (Supabase + OpenAI)

1. Crie um projeto no [Supabase](https://supabase.com).
2. No **SQL Editor**, execute em ordem `supabase/migrations/0001_init.sql` (tabelas, RLS, auditoria, bucket privado `documents`) e `0002_instruments_records.sql` (biblioteca de testes e registros de aplicação).
3. Em *Authentication › URL Configuration*, adicione `https://SEU_DOMINIO/auth/callback` às URLs de redirecionamento.
4. Preencha `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   OPENAI_API_KEY=...
   OPENAI_MODEL=gpt-4o-mini   # confira os modelos disponíveis na sua conta OpenAI
   ```
5. `npm run build && npm start` (ou deploy na Vercel com as mesmas variáveis).

No primeiro acesso, as bibliotecas de atividades e de testes/protocolos são copiadas para a conta da profissional.

### Identidade visual e fonte Neulis

As cores seguem a identidade visual Larissa Bueno (terracota, areia, sálvia, mostarda e azul-água). Os títulos usam a **Neulis**, que é uma fonte comercial e **não está incluída no projeto** — enquanto ela não for ativada, os títulos usam a Outfit (Google Fonts) como substituta. Para ativar:

- **Adobe Fonts:** crie um kit Web com a Neulis e defina `NEXT_PUBLIC_ADOBE_FONTS_KIT=<id do kit>`. Confira no kit o nome CSS da família; o app tenta `Neulis`, `Neulis Sans`, `neulis-sans`, `Neulis Neue` e `neulis-neue`. Se o nome for outro, ajuste `fontFamily.display` em `tailwind.config.ts`.
- **Arquivos próprios (se a licença permitir uso web):** coloque `Neulis-Regular/Medium/SemiBold.woff2` em `public/fonts/` e defina `NEXT_PUBLIC_NEULIS_SELF_HOSTED=1`.

---

## Módulos

| Módulo | O que faz |
|---|---|
| **Dashboard** | Agenda do dia, próximos atendimentos, aniversariantes, pendências financeiras, avaliações em andamento, planos ativos, pacientes ativos, faturamento do mês, ocupação da agenda, atalhos rápidos |
| **Pacientes** | Prontuário completo (foto, idade automática, responsáveis, escola, diagnóstico/hipóteses, convênio/particular, valor, frequência…) com abas: Informações gerais/anamnese · Avaliações · Plano de intervenção · Sessões e evolução · Documentos |
| **Avaliações** | Objetivo, hipóteses, instrumentos (Planejado → Aplicado → Corrigido → No relatório), checklist, datas, anotações. **Plano de avaliação por IA** (instrumentos, ordem, nº de sessões, justificativa, objetivos por sessão) — tudo editável. Em cada instrumento: **roteiro de aplicação** e **registro clínico** com sugestão da IA, revisados antes de salvar no prontuário |
| **Evolução quantitativa** | Pontuações de cada aplicação (inicial, intermediária, reavaliação) em gráfico e tabela com variação e leitura de melhora/piora conforme o sentido de cada medida |
| **Testes e protocolos** | Biblioteca por área: o que avalia, quem pode aplicar (privativo de psicólogos / neuro e psicopedagogos / a confirmar), roteiro base e campos de pontuação personalizáveis |
| **Plano de intervenção** | Objetivo geral, específicos, metas, critérios de evolução e **cronograma automático** de sessões (datas pela frequência semanal). Geração por IA considerando idade, diagnóstico, hipóteses, habilidades, dificuldades e perfis |
| **Registro de sessões** | Todos os campos pedidos, escalas de progresso (1–5), anexos; ao salvar, a IA sugere próximo objetivo, atividades, estratégias, dificuldades, habilidades emergentes, alertas e encaminhamentos. Gráfico de evolução + **análise de padrões por IA** |
| **Banco de atividades** | 24 atividades iniciais; filtros por idade, área, diagnóstico, nível, busca por habilidade; favoritos; cadastro próprio |
| **Documentos** | Upload vinculado ao paciente (relatórios, anamneses, termos, contratos, laudos, encaminhamentos, fotos, PDF, vídeos) em bucket privado |
| **Agenda** | Dia/semana/mês, arrastar para reagendar (com aviso de conflito), recorrência semanal/quinzenal, bloqueios, status, lembretes |
| **Financeiro** | Receitas, despesas, mensalidades (geração automática), sessões de convênio realizadas, pago/pendente/atrasado, fluxo de caixa, gráfico mensal, lucro, inadimplência, **exportação Excel (.xlsx)** e PDF (impressão) |
| **Relatórios** | Relatório neuropsicopedagógico, encaminhamento, declaração, atestado de comparecimento, plano de intervenção e resumo de evolução — pré-preenchidos, editáveis, com redação assistida por IA e PDF com logo/assinatura |
| **Configurações** | Clínica, logo, assinatura (imagem), CRNPP, CPF/CNPJ, PIX, valores, expediente, modelos de documentos, segurança/LGPD |
| **Assistente IA** | Chat com assistente clínica, com contexto opcional de paciente |

## Inteligência Artificial

- Rota única de servidor `src/app/api/ai/route.ts` — a chave da OpenAI nunca vai ao navegador.
- Prompt de sistema (`src/lib/ai/prompts.ts`) define a IA como assistente de Neuropsicopedagogia: sugestões revisáveis, sem diagnóstico médico, baseadas em evidências, respeitando o escopo profissional (não sugere aplicar instrumentos privativos de psicólogos).
- **Minimização de dados (LGPD):** a IA recebe só idade, ano escolar e dados clínicos — nunca nome, contatos, escola ou responsáveis. Em relatórios, o nome é trocado por `[PACIENTE]` antes do envio.
- Limite de 20 requisições/minuto por usuária (em memória, por instância).

## Segurança

- Autenticação Supabase (e-mail/senha, confirmação por e-mail, recuperação de senha); middleware valida a sessão em toda rota.
- **Row Level Security** em todas as tabelas: cada profissional só acessa os próprios dados.
- Storage em bucket **privado**, pastas por usuária, links assinados de 10 min.
- **Logs de auditoria** via trigger (criar/alterar/excluir), visíveis em Configurações.
- Sessão encerrada após 30 min de inatividade; cabeçalhos HSTS, X-Frame-Options, nosniff etc.
- Criptografia em trânsito (TLS) e em repouso (provida pela infraestrutura do Supabase).
- Exportação completa dos dados em JSON (portabilidade/backup manual).

## Limitações conhecidas (seja transparente com as usuárias)

- **Confirmação automática e lembretes:** hoje são *semiautomáticos* — o sistema agenda o lembrete e gera um link de WhatsApp com a mensagem pronta; o envio é feito pela profissional. Envio 100% automático exige integração com WhatsApp Business API / e-mail transacional (não incluída).
- **Backup automático:** depende do plano do Supabase (backups diários existem em planos pagos — verifique na documentação atual do Supabase). O app oferece exportação manual.
- **Assinatura digital:** é uma imagem da assinatura nos PDFs; não é assinatura certificada ICP-Brasil.
- **Testes e protocolos:** a classificação de quem pode aplicar é uma referência. WISC, BPA, SON-R, Bender e Figuras de Rey estão como privativos de psicólogos; vários itens estão como "a confirmar" por falta de certeza. Faixas etárias e subtestes não foram preenchidos: confira no manual e personalize. A lista oficial é a do SATEPSI/CFP.
- **Roteiros por IA** são genéricos de organização da sessão: por regra, a IA não reproduz itens, instruções literais nem tabelas normativas (material protegido por direitos autorais).
- **Criptografia de campo** (além da criptografia em repouso do provedor) não foi implementada; avaliar `pgsodium`/Vault para campos específicos.
- Não há testes automatizados no repositório ainda (os fluxos foram verificados manualmente no navegador).
- A conformidade com a LGPD depende também de processos (termos, DPO, contrato com operadores como Supabase e OpenAI) — o software dá suporte, não garante conformidade sozinho.

## Arquitetura

```
src/
  app/(app)/…          telas autenticadas (dashboard, pacientes, agenda, …)
  app/api/ai/          rota de IA (servidor)
  app/login, auth/     autenticação
  components/          UI, gráficos, abas do paciente
  lib/data/store.ts    contrato DataStore (único ponto de acesso a dados)
  lib/data/*-store.ts  implementações Supabase e demonstração
  lib/ai/              prompts, cliente, respostas de demonstração
supabase/migrations/   esquema SQL + RLS + storage
```

O contrato `DataStore` isola a persistência, facilitando expansões futuras (portal da família, integração com escolas, teleatendimento, assinatura eletrônica, app mobile iOS/Android via API ou React Native reutilizando os tipos de `src/lib/types.ts`).
