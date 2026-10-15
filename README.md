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

Sem Supabase o site abre sem login (veja "Uso pessoal" abaixo). Com `NEXT_PUBLIC_DEMO_MODE=1`, aparece a demonstração:

No modo demonstração: dados fictícios salvos apenas no navegador (localStorage), sem login. Sem `OPENAI_API_KEY`, a IA devolve **respostas de exemplo** (sinalizadas na tela). Use para conhecer o produto — **não insira dados reais de pacientes nesse modo**.

### Produção (Supabase + OpenAI)

1. Crie um projeto no [Supabase](https://supabase.com).
2. No **SQL Editor**, execute em ordem `supabase/migrations/0001_init.sql` (tabelas, RLS, auditoria, bucket privado `documents`) `0002_instruments_records.sql` (biblioteca de testes e registros de aplicação) `0003_contracts_receipts.sql` (dados do contrato e recibos) `0004_tasks_objectives_attachments.sql` (tarefas, resultados por objetivo e anexos em avaliações) `0005_social_posts.sql` (conteúdos de Instagram) `0006_areas_ran_import.sql` (áreas de intervenção, RAN, importação e cobranças) `0007_security_hardening.sql` (reforço contra mass assignment, sem acesso anônimo, limites do bucket) e `0008_gestao_financeira.sql` (módulo de gestão financeira) — ou tudo de uma vez com `supabase/instalacao-completa.sql`.
3. Em *Authentication › Providers › Email*, mantenha **"Confirm email" ativado**: o NeuroPlanner só libera o acesso depois que o e-mail é confirmado pelo link enviado.
4. Em *Authentication › URL Configuration*, adicione `https://SEU_DOMINIO/auth/callback` às URLs de redirecionamento.
5. Preencha `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   OPENAI_API_KEY=...
   OPENAI_MODEL=gpt-4o-mini   # confira os modelos disponíveis na sua conta OpenAI
   ```
6. `npm run build && npm start` (ou deploy na Vercel com as mesmas variáveis).

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
| **Intervenção por área** | O plano é dividido em áreas (Consciência fonológica, Alfabetização, Leitura, Escrita, Matemática, Atenção, Funções executivas, Memória, Linguagem, Motricidade, Habilidades sociais, Regulação emocional, Autonomia…). Escolhe-se a área e depois o objetivo dentro dela, a partir de um banco de objetivos (ampliável: o botão de marcador salva novos objetivos no seu banco). Sessões e registros usam o mesmo seletor área → objetivo, e o plano mostra o progresso por área |
| **Relatório (RAN)** | Modelo baseado no RAN da profissional: identificação, queixa, histórico, antecedentes, jeito de ser, vida escolar, comportamento na avaliação, instrumentos com referências, síntese dos resultados por domínio com quadros gerados a partir dos registros de aplicação, aspectos comportamentais (escalas e observação escolar), conclusão e indicações; pré-visualização, impressão em papel timbrado e IA para redigir as seções |
| **Importar do Drive** | Envie .docx, PDF com texto, .txt, .xlsx ou .csv (vários de uma vez). Documentos (anamnese, RAN, ficha) são lidos por rótulos e seções; planilhas têm as colunas mapeadas automaticamente. Revisão antes de salvar; pacientes com o mesmo nome são completados sem apagar dados; o arquivo original vai para Documentos e novos pacientes ganham o contrato em rascunho. IA opcional, só com consentimento (envia o texto à OpenAI) |
| **Cobranças com aprovação** | Pelas datas de vencimento do Financeiro, o sistema prepara lembretes (antes), aviso no dia e cobranças em atraso para WhatsApp e e-mail dos responsáveis. **Nada é enviado sem aprovação**: a tela Cobranças mostra a fila para editar, aprovar ou rejeitar. Pagamento registrado cancela o que estava pendente. Regras e textos em Configurações › Cobranças |
| **Objetivos e atividades por sessão** | Avaliação e intervenção: vários objetivos (sem limite) e várias atividades por sessão, cada atividade com materiais e tempo; atividades inseridas da biblioteca; resultado por objetivo (atingido / parcial / não atingido) no registro da sessão, levado automaticamente ao plano. IA sugere de 3 a 5 objetivos e de 2 a 4 atividades por sessão |
| **Anexos** | Em cada avaliação, sessão do plano e registro de sessão; todos aparecem também na aba Documentos do paciente |
| **Tarefas da clínica** | Lista com prioridade (urgente/alta/média/baixa), categoria, prazo, repetição e paciente; rotina de gestão sugerida (inclui prazos do contrato: reunião semestral, revisão do plano, reajuste IGPM em julho); pendências detectadas automaticamente (atrasos, contratos, sessões sem registro, confirmações, correções, revisões); destaque no Início |
| **Instagram** | Criador de carrosséis, posts, reels (roteiro por cena) e stories a partir das demandas atendidas (apenas temas e contagens), com foco em captação ética; exemplos sempre fictícios; checagem automática contra nomes de pacientes/responsáveis e escolas; artes 1080×1350 nas cores da marca (PNG); calendário editorial; métricas do Instagram (API da Meta) ou digitadas, usadas para orientar a IA |
| **Contrato** | Gerado automaticamente ao cadastrar o paciente, no modelo da profissional: responsável (nome, CPF, RG, endereço, contatos), criança, sessões por semana (com extenso), duração, valores de avaliação e intervenção (com extenso), cidade/foro e data. Rascunho editável; botão para atualizar com o cadastro; impressão em papel timbrado |
| **Recibo** | Emitido automaticamente quando uma entrada é marcada como paga, no layout do modelo da profissional (A4), com dados do pagante, valor, datas dos atendimentos do período e dados da prestadora. Numeração sequencial, edição, PDF e envio por WhatsApp. Não é nota fiscal |
| **Financeiro por paciente** | Aba no prontuário com total pago, a vencer, em atraso, gráfico mensal, lançamentos, cobrança rápida de sessão/avaliação e recibos |
| **Testes e protocolos** | Biblioteca por área: o que avalia, quem pode aplicar (privativo de psicólogos / neuro e psicopedagogos / a confirmar), roteiro base e campos de pontuação personalizáveis |
| **Plano de intervenção** | Objetivo geral, específicos, metas, critérios de evolução e **cronograma automático** de sessões (datas pela frequência semanal). Geração por IA considerando idade, diagnóstico, hipóteses, habilidades, dificuldades e perfis |
| **Registro de sessões** | Todos os campos pedidos, escalas de progresso (1–5), anexos; ao salvar, a IA sugere próximo objetivo, atividades, estratégias, dificuldades, habilidades emergentes, alertas e encaminhamentos. Gráfico de evolução + **análise de padrões por IA** |
| **Banco de atividades** | 24 atividades iniciais; filtros por idade, área, diagnóstico, nível, busca por habilidade; favoritos; cadastro próprio |
| **Documentos** | Upload vinculado ao paciente (relatórios, anamneses, termos, contratos, laudos, encaminhamentos, fotos, PDF, vídeos) em bucket privado |
| **Agenda** | Dia/semana/mês, arrastar para reagendar (com aviso de conflito), recorrência semanal/quinzenal, bloqueios, status, lembretes |
| **Gestão financeira** | 11 seções: visão geral, receitas e contratos, despesas e recorrentes, fluxo de caixa, pró-labore e retiradas, orçamento disponível ("quanto posso gastar?"), reservas, projeções e cenários até dez/2027 com simulador de crescimento, planejamento tributário (Carnê-Leão, regras com fonte e validade, comparação PF × PJ), relatórios (DRE, impostos, inadimplência, orçado × realizado…) e configurações (importação da planilha de sessões, extratos CSV/Excel/OFX com conciliação, backup, histórico de alterações). Detalhes em `docs/financeiro/` |
| **Relatórios** | Relatório neuropsicopedagógico, encaminhamento, declaração, atestado de comparecimento, plano de intervenção e resumo de evolução — pré-preenchidos, editáveis, com redação assistida por IA e PDF com logo/assinatura |
| **Configurações** | Clínica, logo, assinatura (imagem), CRNPP, CPF/CNPJ, PIX, valores, expediente, modelos de documentos, segurança/LGPD |
| **Assistente IA** | Chat com assistente clínica, com contexto opcional de paciente |

## Inteligência Artificial

- Rota única de servidor `src/app/api/ai/route.ts` — a chave da OpenAI nunca vai ao navegador.
- Prompt de sistema (`src/lib/ai/prompts.ts`) define a IA como assistente de Neuropsicopedagogia: sugestões revisáveis, sem diagnóstico médico, baseadas em evidências, respeitando o escopo profissional (não sugere aplicar instrumentos privativos de psicólogos).
- **Minimização de dados (LGPD):** a IA recebe só idade, ano escolar e dados clínicos — nunca nome, contatos, escola ou responsáveis. Em relatórios, o nome é trocado por `[PACIENTE]` antes do envio.
- Limite de 20 requisições/minuto por usuária (em memória, por instância).

## Segurança

Resumo do que está implementado (e do que **não** está), item por item:

| Item | Como está |
|---|---|
| Chaves de API escondidas | OpenAI, Instagram, Resend e WhatsApp ficam **só no servidor** (variáveis sem `NEXT_PUBLIC_`). Nenhuma chave no código. |
| Segredos fora do Git | `.env*` no `.gitignore`; `node scripts/check-secrets.mjs` (também no GitHub Actions) procura chaves nos arquivos. O histórico foi verificado: sem chaves nem dados reais. Ative também o *Secret scanning* do GitHub (Settings › Code security). |
| Chave pública do banco | A `anon key` do Supabase é pública por natureza; a proteção vem do RLS. A `service_role` **nunca** é usada no app. |
| RLS | Ativado em todas as tabelas (`owner_id = auth.uid()`), bucket privado com pastas por usuária; visitantes sem login (`anon`) sem nenhuma permissão (migração 0007). |
| Criptografia de dados | Uso pessoal: **cofre local** AES-256-GCM (dados + arquivos + backups), chave derivada da senha com **Argon2id** (64 MiB, 3 passadas — parâmetros da RFC 9106; cofres antigos em PBKDF2 são convertidos no desbloqueio). Supabase: TLS + criptografia em repouso do provedor. |
| Autenticação no servidor | Supabase: middleware e rotas validam a sessão com `getUser()` e exigem e-mail confirmado. Uso pessoal: rotas exigem `APP_ACCESS_KEY` (comparação em tempo constante). |
| Restringir acessos | IA e Instagram reais **bloqueados** no uso pessoal publicado enquanto `APP_ACCESS_KEY` não estiver configurada. |
| Mass assignment | `id`, `owner_id`, `created_at` e `updated_at` são descartados no app **e** forçados por trigger no banco; registros só apontam para pacientes da mesma conta (migração 0007). Rotas copiam só os campos esperados. |
| Cookies | Sessão do Supabase com `Secure` (produção), `SameSite=Lax`, `path=/`. *Não* são `HttpOnly` porque o cliente do Supabase no navegador precisa lê-los — a CSP reduz o risco. |
| Hash de senhas | Contas: o Supabase Auth guarda as senhas com hash (bcrypt, segundo a documentação do Supabase — confira a versão atual); o app nunca armazena senhas. Cofre: a senha não é guardada em lugar nenhum; só a chave de dados embrulhada pela chave derivada dela. |
| Rate limit | Todas as rotas `/api` (por usuária/chave e por IP), compartilhado entre instâncias quando `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` estão configuradas (senão, em memória por instância); IP bloqueado por 15 min após 8 chaves de acesso erradas; no máximo 4 chamadas simultâneas à OpenAI por instância; corpos grandes recusados antes da leitura. Não substitui um WAF. |
| Proteção contra robôs | Rotas só aceitam chamadas do próprio site (`Origin`/`Sec-Fetch-Site`), exigem sessão ou chave, `robots.txt` e `X-Robots-Tag: noindex`. **Sem CAPTCHA** — no Supabase dá para ativar em Authentication › Bot and Abuse Protection (confira a documentação atual). |
| Queries parametrizadas | Todo acesso ao banco é pelo supabase-js (PostgREST, parâmetros escapados); nenhum SQL montado com texto do usuário. Identificadores nas migrações usam `format('%I')`. |
| Validação de entradas | Rotas validam tipo, tamanho e formato (tarefa de IA por lista, e-mail/telefone, tamanho de textos, assinatura binária de .docx/.xlsx/.pdf). |
| Vazamento de conteúdo | Erros genéricos para o usuário (detalhes só no log do servidor, truncados), `Cache-Control: no-store` nas APIs, sem source maps no navegador, sem `X-Powered-By`, `Referrer-Policy: no-referrer`; a IA recebe dados pseudonimizados. |
| Uploads | Lista de formatos permitidos (documentos, imagens, áudio, vídeo MP4), até 25 MB, conferência de extensão × tipo; **HTML, SVG, scripts e executáveis recusados**. No Supabase, o bucket também limita tamanho e tipos (migração 0007). |
| Respostas enxutas | APIs devolvem só os campos necessários; textos externos truncados. |
| Cabeçalhos de segurança | CSP (produção), HSTS, X-Frame-Options, nosniff, COOP, CORP, Permissions-Policy, Referrer-Policy. |
| HTTPS | Redirecionamento para HTTPS no middleware + HSTS (o Netlify já serve com HTTPS). |
| Scan de dependências | `npm audit` no GitHub Actions (toda segunda e a cada push) + Dependabot semanal. **0 vulnerabilidades conhecidas** em todas as dependências, inclusive as de compilação e de testes (out/2026). |

Também: logs de auditoria (criar/alterar/excluir) e exportação completa dos dados. O banco tem testes automáticos em PostgreSQL real (`scripts/test-db.sh`, também no GitHub Actions): RLS, mass assignment, paciente de outra conta, acesso anônimo e storage.

Navegadores: o Tailwind 4 exige versões atuais (Chrome/Edge 111+, Safari 16.4+, Firefox 128+).

## Limitações conhecidas (seja transparente com as usuárias)

- **Confirmação automática e lembretes:** hoje são *semiautomáticos* — o sistema agenda o lembrete e gera um link de WhatsApp com a mensagem pronta; o envio é feito pela profissional. Envio 100% automático exige integração com WhatsApp Business API / e-mail transacional (não incluída).
- **Backup automático:** depende do plano do Supabase (backups diários existem em planos pagos — verifique na documentação atual do Supabase). O app oferece exportação manual.
- **Assinatura digital:** é uma imagem da assinatura nos PDFs; não é assinatura certificada ICP-Brasil.
- **Testes e protocolos:** a classificação de quem pode aplicar é uma referência. WISC, BPA, SON-R, Bender e Figuras de Rey estão como privativos de psicólogos; vários itens estão como "a confirmar" por falta de certeza. Faixas etárias e subtestes não foram preenchidos: confira no manual e personalize. A lista oficial é a do SATEPSI/CFP.
- **Roteiros por IA** são genéricos de organização da sessão: por regra, a IA não reproduz itens, instruções literais nem tabelas normativas (material protegido por direitos autorais).
- **Criptografia de campo no Supabase** (além da criptografia em repouso do provedor) não foi implementada; avaliar `pgsodium`/Vault para campos específicos. No uso pessoal, tudo é criptografado no navegador (cofre local).
- Testes automatizados cobrem o núcleo financeiro e os importadores (`npm test`); as demais telas foram verificadas manualmente no navegador.
- **Gestão financeira:** cálculos gerenciais, não substituem o contador nem o Carnê-Leão Web. Regras sem confirmação do contador aparecem marcadas e, por padrão, usam a opção conservadora.
- A conformidade com a LGPD depende também de processos (termos, DPO, contrato com operadores como Supabase e OpenAI) — o software dá suporte, não garante conformidade sozinho.

## Usar só no meu computador, em HTTPS (recomendado para dados reais)

O sistema roda no seu próprio computador, sem site publicado, no endereço **https://localhost:3000**. O servidor só aceita conexões do próprio computador — nenhum outro aparelho, nem na mesma rede Wi-Fi, consegue abrir. Os dados continuam criptografados no navegador.

1. Instale o **Node.js 22 (LTS)** em https://nodejs.org (uma vez).
2. Baixe o projeto (GitHub › Code › Download ZIP) e descompacte numa pasta sua.
3. **Windows:** dois cliques em `Abrir-NeuroPlanner.bat`. **Mac:** clique com o botão direito em `Abrir-NeuroPlanner.command` › Abrir (na primeira vez o macOS pede confirmação). Ou, no Terminal, dentro da pasta: `npm run local`.
4. Na primeira vez ele instala, prepara o sistema (alguns minutos) e cria o **certificado HTTPS deste computador**:
   - **Windows:** aparece um aviso “Você está prestes a instalar um certificado… NeuroPlanner - certificado local” — clique em **Sim**.
   - **Mac:** o sistema pede a senha do seu usuário para confiar no certificado.
   Depois abre https://localhost:3000 com o cadeado. Para fechar, feche a janela preta.

Sobre o certificado (pasta `.local-https`, criada no seu computador e fora do Git):
- Ele vale só para `localhost` e é assinado por uma autoridade criada na hora cuja **chave privada é descartada imediatamente** — ela nunca é gravada, então não pode ser usada para falsificar outros sites.
- Validade de cerca de 2 anos; perto do fim, o atalho gera e instala um novo sozinho (e remove o antigo).
- Navegadores recomendados: Chrome, Edge ou Safari. No Firefox pode aparecer um aviso, porque ele pode usar uma lista de certificados própria.
- Se o certificado não puder ser criado, o atalho abre em `http://localhost:3000` (ainda só neste computador). Para forçar sem HTTPS: `npm run local -- --http`.

Observações:
- Use sempre o **mesmo navegador** e o mesmo endereço: os dados ficam guardados para `https://localhost:3000`. Dados de outro endereço (um site publicado no Netlify, ou `http://localhost:3000`) **não aparecem** aqui automaticamente — exporte o backup lá (Configurações › Segurança › Exportar meus dados) e restaure aqui (Configurações › Segurança › Restaurar backup).
- A IA funciona localmente sem a chave `APP_ACCESS_KEY`; para a IA real, crie um arquivo `.env.local` na pasta com `OPENAI_API_KEY=...` (opcional — sem ela, respostas de exemplo).
- Atualizar o sistema: baixe a versão nova e abra pelo mesmo atalho (ele recompila sozinho). Seus dados ficam no navegador, não na pasta.
- Faça backup semanal: se o navegador for limpo ou o computador trocado, só o backup recupera os dados.

## Uso pessoal, sem login (padrão sem Supabase)

Sem as variáveis do Supabase, o NeuroPlanner **não pede conta nem e-mail**: no primeiro acesso você cria a **senha do cofre**, que criptografa os dados neste computador. O sistema começa vazio para você colocar os próprios dados.

Como funciona:
- **Os dados ficam só no navegador do seu computador**, criptografados (AES-256). Não vão para servidor nenhum; quem abrir o link em outro aparelho vê apenas a tela de criar senha, sem nenhum dado.
- **Bloqueio:** botão de cadeado (barra lateral); automático após 5, 10 (padrão), 15 ou 30 min sem uso; ao minimizar ou trocar de aba (na hora, após 1 min — padrão — ou desligado); e ao recarregar a página (F5) ou fechar a aba — a chave só existe na memória enquanto o cofre está aberto. A tela fica desfocada sempre que você sai da aba.
- **Senha forte obrigatória:** mínimo de 12 caracteres e medidor de força que recusa nomes, “senha”, datas, sequências e repetições. Quem tinha senha fraca recebe um aviso para trocar. Após 3 senhas erradas, espera crescente (5 s, 10 s, 20 s… até 5 min), mesmo recarregando a página.
- **Esqueceu a senha? Não há recuperação.** Anote a senha em lugar seguro. A única saída é apagar o cofre e restaurar um backup.
- **Backup semanal** em Configurações › Segurança › Exportar meus dados: o arquivo sai **criptografado** (inclui os arquivos) e abre com a senha do cofre que valia na data do backup. Guarde uma cópia fora do computador.
- Dados de versões anteriores (sem criptografia) são migrados para o cofre e apagados da forma aberta no primeiro acesso. Backups antigos (sem criptografia) ainda podem ser restaurados — depois apague esses arquivos.
- Use sempre o mesmo navegador e computador; limpar os dados do navegador apaga tudo. Não sincroniza com o celular.

### Proteger a IA e o Instagram (obrigatório para usar a IA real)

Como não há login, o servidor precisa de outra forma de saber que é você:
1. Em Configurações › Segurança › **Chave de acesso do servidor**, clique em **Gerar uma chave forte** e copie.
2. No Netlify: Site configuration › Environment variables (o caminho pode mudar no painel) › `APP_ACCESS_KEY` = essa chave (mínimo 24 caracteres). Faça um novo deploy.
3. No NeuroPlanner, cole a mesma chave e clique em **Salvar chave** (fica guardada dentro do cofre).

Sem `APP_ACCESS_KEY`, a IA real e as métricas do Instagram ficam bloqueadas no site publicado (a IA responde com exemplos). Mesmo assim, defina um limite de gastos na sua conta OpenAI.

### Limites do cofre (seja realista)
- Protege contra quem pega o computador desligado/bloqueado, contra outra pessoa abrindo o site e contra cópia dos arquivos do navegador. **Não protege** contra vírus/keylogger no computador nem contra alguém usando o computador com o cofre aberto — bloqueie ao se afastar.
- A força depende da senha: o Argon2id deixa cada tentativa cara (memória + tempo), mas uma senha adivinhável continua adivinhável. Use 3 ou 4 palavras sem relação, com números ou símbolos.
- A espera após senhas erradas vale para quem usa a tela do site; quem copiar os arquivos do navegador pode tentar fora dele — por isso o que protege de verdade é a senha forte + Argon2id.
- LGPD exige também processos (consentimento, guarda, descarte, contrato com a OpenAI se usar a IA) — o software ajuda, não garante conformidade sozinho.

## Publicar no Netlify

> **Importante:** o NeuroPlanner é um app Next.js com rotas de servidor (IA, Instagram, login). Ele **não funciona arrastando a pasta ou o ZIP** para o Netlify Drop — essa opção só publica sites estáticos. O Netlify precisa **compilar** o projeto. O arquivo `netlify.toml` já está configurado.

**Opção A — pelo GitHub (recomendada):**
1. No Netlify: *Add new site → Import an existing project → GitHub* e escolha o repositório (branch `claude/funny-bardeen-wq2gyr` ou a principal, depois do merge).
2. O Netlify lê o `netlify.toml` (build `npm run build`, Node 22, plugin Next.js).
3. Em *Site configuration → Environment variables*, cadastre as variáveis do `.env.example` (Supabase, OpenAI e, se quiser, Instagram).
4. Deploy. No Supabase, adicione `https://SEU-SITE.netlify.app/auth/callback` nas URLs de redirecionamento.

**Opção B — a partir do ZIP, com a Netlify CLI:**
```bash
unzip neuroplanner.zip && cd neuroplanner
npm install
npx netlify-cli login
npx netlify-cli deploy --build --prod
```

**Site publicado sem Supabase:** abre sem login (uso pessoal, dados no navegador). Com `NEXT_PUBLIC_DEMO_MODE=1`, vira demonstração com dados fictícios e a IA real fica desligada.

## Cobranças: envio automático após aprovação

Sem configuração, ao aprovar uma mensagem o sistema **abre o WhatsApp ou o seu e-mail com o texto pronto** (envio assistido, 1 clique). Para envio automático após a aprovação:
- **E-mail:** crie uma conta no Resend, verifique o domínio do remetente e defina `RESEND_API_KEY` e `EMAIL_FROM` (ex.: `Larissa Bueno <cobranca@seudominio.com.br>`).
- **WhatsApp:** a Meta só permite mensagens iniciadas pela empresa com **modelos aprovados** pela API oficial (WhatsApp Cloud API). Crie um modelo de utilidade com 4 variáveis (responsável, paciente, valor, vencimento) e defina `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TEMPLATE`. Nesse modo é enviado o texto do modelo aprovado (não o texto editado na tela).

As mensagens são preparadas quando você abre o sistema (não há servidor rodando sozinho de madrugada). Confira as regras e custos atuais do Resend e da Meta.

## Conectar o Instagram (métricas)

Requer conta **Profissional** (Empresa ou Criador de conteúdo). Pela API oficial da Meta:
1. Crie um app em *developers.facebook.com* e adicione o produto do Instagram.
2. Conecte sua conta e gere um **token de acesso de longa duração** com permissão de leitura de insights.
3. Copie o **ID da conta do Instagram** e defina no servidor (Netlify → Environment variables): `INSTAGRAM_ACCESS_TOKEN` e `INSTAGRAM_USER_ID`.
4. Opcional: `INSTAGRAM_GRAPH_BASE` e `INSTAGRAM_INSIGHT_METRICS`.

> A Meta muda com frequência versões da API, nomes de métricas e o processo de geração de token (e tokens de longa duração expiram e precisam ser renovados). **Confira a documentação atual da Meta** — os valores padrão do app podem precisar de ajuste. O app não publica no Instagram: ele lê métricas; a publicação continua sendo feita por você (as artes e a legenda ficam prontas para baixar e copiar). Sem token, você pode digitar as métricas de cada post no Calendário.

## Identidade visual nos documentos

Os arquivos em `public/brand/` (logo, ícones e cabeçalho) foram extraídos dos modelos de recibo e contrato enviados pela profissional e são usados no recibo e no papel timbrado. Os dados pessoais (CPF, endereço, contatos) **não** ficam no código: preencha em **Configurações** — o CPF da profissional é deixado em branco no modo demonstração de propósito.

## Gestão financeira

- Análise das planilhas enviadas (inconsistências, premissas): `docs/financeiro/01-analise-das-planilhas.md`.
- Modelo, fórmulas e regras: `docs/financeiro/02-modelo-financeiro.md`.
- Núcleo de cálculo puro e testado: `src/lib/finance/` (`npm test`). Para testar a importação com a planilha real sem versioná-la: `NP_SHEET=/caminho/planilha.xlsx npm test`.
- As planilhas com dados de pacientes **não** ficam no repositório: a importação acontece no navegador, em Gestão financeira › Configurações › Importar.

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
