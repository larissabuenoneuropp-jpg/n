import type { Instrument, RecordField } from "@/lib/types";

type Seed = Omit<Instrument, "id" | "favorite" | "owner_id" | "created_at" | "updated_at">;

/*
 * Biblioteca inicial de testes e protocolos.
 *
 * IMPORTANTE: a classificação de acesso é uma REFERÊNCIA e pode estar desatualizada.
 * A lista oficial de testes psicológicos (de uso privativo de psicólogos) é mantida pelo
 * SATEPSI/CFP e muda com o tempo. Itens marcados como "verificar" são aqueles sobre os quais
 * não há segurança suficiente — confirme antes de usar.
 * Faixas etárias e subtestes também devem ser conferidos no manual oficial de cada instrumento.
 * Os campos de registro são genéricos e podem ser personalizados pela profissional.
 */

const GENERIC: RecordField[] = [
  { key: "acertos", label: "Acertos", type: "number", higher_is_better: true },
  { key: "erros", label: "Erros", type: "number", higher_is_better: false },
  { key: "tempo_s", label: "Tempo (s)", type: "number", higher_is_better: false },
  { key: "classificacao", label: "Classificação (conforme manual)", type: "text" },
];
const SCORE: RecordField[] = [
  { key: "pontuacao", label: "Pontuação bruta", type: "number", higher_is_better: true },
  { key: "classificacao", label: "Classificação (conforme manual)", type: "text" },
];
const QUALI: RecordField[] = [
  { key: "nivel", label: "Nível observado (1–5)", type: "number", higher_is_better: true },
  { key: "sintese", label: "Síntese", type: "text" },
];

const PSI_NOTE = "Consta como teste psicológico (SATEPSI/CFP) — uso privativo de psicólogos. Quando pertinente, encaminhe.";
const VERIFY_NOTE = "Não há segurança sobre a classificação atual. Confirme no SATEPSI/CFP e no manual antes de aplicar.";

export const INSTRUMENT_LIBRARY: Seed[] = [
  // Rastreio do desenvolvimento e comportamento
  {
    name: "SNAP-IV", ran_domain: "Aspectos comportamentais em diferentes contextos", reference: "MATTOS, P.; SERRA-PINHEIRO, M. A.; ROHDE, L. A.; PINTO, D. Apresentação de uma versão em português para uso no Brasil do instrumento MTA-SNAP-IV de avaliação de sintomas de transtorno do déficit de atenção/hiperatividade e sintomas de transtorno desafiador e de oposição. Revista de Psiquiatria do Rio Grande do Sul, v. 28, n. 3, p. 290–297, 2006.", full_name: "Questionário SNAP-IV (pais e professores)", area: "Rastreio do comportamento",
    evaluates: "Rastreio de sintomas de desatenção, hiperatividade/impulsividade e comportamento opositor, a partir do relato de pais e professores. Não é diagnóstico.",
    access: "multiprofissional", access_note: "Questionário de rastreio de domínio público, amplamente usado por diferentes profissionais.",
    record_fields: [
      { key: "desatencao", label: "Desatenção (média)", type: "number", higher_is_better: false },
      { key: "hiperatividade", label: "Hiperatividade/impulsividade (média)", type: "number", higher_is_better: false },
      { key: "oposicao", label: "Oposição (média)", type: "number", higher_is_better: false },
      { key: "respondente", label: "Respondente", type: "text" },
    ],
  },
  {
    name: "M-CHAT", ran_domain: "Aspectos comportamentais em diferentes contextos", full_name: "Modified Checklist for Autism in Toddlers", area: "Rastreio do comportamento",
    evaluates: "Rastreio de sinais de risco para TEA na primeira infância, respondido pelos responsáveis. Não é diagnóstico.",
    access: "multiprofissional", access_note: "Instrumento de rastreio de uso livre. Confira a versão e faixa etária adequadas.",
    record_fields: [{ key: "itens_risco", label: "Itens de risco", type: "number", higher_is_better: false }, { key: "classificacao", label: "Faixa de risco", type: "text" }],
  },
  {
    name: "CARS", ran_domain: "Aspectos comportamentais em diferentes contextos", reference: "SCHOPLER, E.; VAN BOURGONDIEN, M. E.; WELLMAN, G. J.; LOVE, S. R. Childhood Autism Rating Scale – 2nd Edition (CARS-2). Los Angeles: Western Psychological Services, 2010.", full_name: "Childhood Autism Rating Scale", area: "Rastreio do comportamento",
    evaluates: "Escala de avaliação de comportamentos associados ao TEA a partir de observação e relato.",
    access: "verificar", access_note: VERIFY_NOTE,
    record_fields: [{ key: "total", label: "Pontuação total", type: "number", higher_is_better: false }, { key: "classificacao", label: "Classificação", type: "text" }],
  },
  // Aprendizagem — instrumentos psicopedagógicos
  {
    name: "EOCA", ran_domain: "Aprendizagem", full_name: "Entrevista Operativa Centrada na Aprendizagem", area: "Aprendizagem (psicopedagógicos)",
    evaluates: "Observação da modalidade de aprendizagem, vínculo com os objetos de conhecimento, temática e dinâmica da criança diante de materiais.",
    access: "multiprofissional", access_note: "Técnica da Psicopedagogia, utilizada por psicopedagogos e neuropsicopedagogos.",
    record_fields: QUALI,
  },
  {
    name: "Provas Operatórias", ran_domain: "Aprendizagem", full_name: "Provas Operatórias Piagetianas", area: "Aprendizagem (psicopedagógicos)",
    evaluates: "Nível de pensamento lógico (conservação, classificação, seriação etc.) segundo a teoria piagetiana.",
    access: "multiprofissional", access_note: "Recurso clássico da avaliação psicopedagógica.",
    record_fields: [{ key: "provas_conservadas", label: "Provas com conservação", type: "number", higher_is_better: true }, { key: "nivel", label: "Nível operatório", type: "text" }],
  },
  {
    name: "Técnicas Projetivas Psicopedagógicas", ran_domain: "Aprendizagem", full_name: "Técnicas Projetivas Psicopedagógicas (Visca)", area: "Aprendizagem (psicopedagógicos)",
    evaluates: "Vínculos da criança com a aprendizagem nos âmbitos escolar, familiar e consigo mesma (ex.: par educativo, família educativa).",
    access: "multiprofissional", access_note: "Técnicas da Psicopedagogia (distintas dos testes projetivos psicológicos).",
    record_fields: QUALI,
  },
  {
    name: "IAR", ran_domain: "Linguagem › Habilidades para alfabetização", reference: "LEITE, S. Instrumento de Avaliação do Repertório Básico para Alfabetização. São Paulo: Vetor, 1984.", full_name: "Instrumento de Avaliação do Repertório Básico para Alfabetização", area: "Aprendizagem (psicopedagógicos)",
    evaluates: "Pré-requisitos para a alfabetização: esquema corporal, lateralidade, posição, direção, espaço, tamanho, quantidade, forma, discriminação visual e auditiva, coordenação motora fina, entre outros.",
    access: "multiprofissional", access_note: "Utilizado por psicopedagogos e neuropsicopedagogos. Confirme a edição vigente.",
    record_fields: SCORE,
  },
  // Leitura, escrita e linguagem
  {
    name: "CONFIAS", ran_domain: "Linguagem › Consciência fonológica", full_name: "Consciência Fonológica: Instrumento de Avaliação Sequencial", area: "Leitura, escrita e linguagem",
    evaluates: "Consciência fonológica nos níveis da sílaba e do fonema.",
    access: "multiprofissional", access_note: "Usado por fonoaudiólogos, psicopedagogos e neuropsicopedagogos.",
    record_fields: [
      { key: "silaba", label: "Nível da sílaba", type: "number", higher_is_better: true },
      { key: "fonema", label: "Nível do fonema", type: "number", higher_is_better: true },
      { key: "total", label: "Total", type: "number", higher_is_better: true },
    ],
  },
  {
    name: "PROLEC", ran_domain: "Linguagem › Leitura e escrita", full_name: "Provas de Avaliação dos Processos de Leitura", area: "Leitura, escrita e linguagem",
    evaluates: "Processos envolvidos na leitura: identificação de letras, processos léxicos, sintáticos e semânticos.",
    access: "multiprofissional", access_note: "Usado por fonoaudiólogos, psicopedagogos e neuropsicopedagogos. Personalize os subtestes conforme o manual.",
    record_fields: GENERIC,
  },
  {
    name: "PROESC", ran_domain: "Linguagem › Leitura e escrita", full_name: "Avaliação dos Processos de Escrita", area: "Leitura, escrita e linguagem",
    evaluates: "Processos envolvidos na escrita: ditado, escrita de palavras e pseudopalavras, produção textual.",
    access: "multiprofissional", access_note: "Usado por fonoaudiólogos, psicopedagogos e neuropsicopedagogos. Personalize os subtestes conforme o manual.",
    record_fields: GENERIC,
  },
  {
    name: "TDE II", ran_domain: "Aritmética", full_name: "Teste de Desempenho Escolar — 2ª edição", area: "Leitura, escrita e linguagem",
    evaluates: "Desempenho escolar em leitura, escrita e aritmética.",
    access: "verificar", access_note: VERIFY_NOTE,
    record_fields: [
      { key: "leitura", label: "Leitura", type: "number", higher_is_better: true },
      { key: "escrita", label: "Escrita", type: "number", higher_is_better: true },
      { key: "aritmetica", label: "Aritmética", type: "number", higher_is_better: true },
    ],
  },
  // Atenção e funções executivas
  {
    name: "TAC", ran_domain: "Funções executivas › Atenção", reference: "SEABRA, A. G.; DIAS, N. M. (Orgs.). Avaliação Neuropsicológica Cognitiva: Atenção e Funções Executivas. São Paulo: Memnon, 2012.", full_name: "Teste de Atenção por Cancelamento", area: "Atenção e funções executivas",
    evaluates: "Atenção seletiva e sustentada por meio de tarefas de cancelamento de estímulos-alvo.",
    access: "verificar", access_note: VERIFY_NOTE,
    record_fields: (["Parte 1", "Parte 2", "Parte 3", "Total"] as const).flatMap((p) => [
      { key: `${p}_acertos`, label: `${p} – Nº de acertos`, type: "number" as const, higher_is_better: true },
      { key: `${p}_ausencias`, label: `${p} – Nº de ausências`, type: "number" as const, higher_is_better: false },
      { key: `${p}_erros`, label: `${p} – Nº de erros`, type: "number" as const, higher_is_better: false },
      { key: `${p}_padrao`, label: `${p} – Pontuação-padrão`, type: "number" as const, higher_is_better: true },
      { key: `${p}_class`, label: `${p} – Classificação`, type: "text" as const },
    ]).map((f) => ({ ...f, key: f.key.replace(/\s+/g, "_").toLowerCase() })),
  },
  {
    name: "Trilhas", ran_domain: "Funções executivas › Flexibilidade cognitiva", reference: "TREVISAN, B. T.; SEABRA, A. G. In: SEABRA, A. G.; DIAS, N. M. (Orgs.). Avaliação Neuropsicológica Cognitiva: Atenção e Funções Executivas. São Paulo: Memnon, 2012.", full_name: "Teste de Trilhas", area: "Atenção e funções executivas",
    evaluates: "Flexibilidade cognitiva, atenção alternada e velocidade de processamento.",
    access: "verificar", access_note: "Existem versões diferentes (algumas constam no SATEPSI). " + VERIFY_NOTE,
    record_fields: (["Parte A", "Parte B", "Escore derivado"] as const).flatMap((p) => [
      { key: `${p}_bruto`, label: `${p} – Escore bruto`, type: "number" as const, higher_is_better: true },
      { key: `${p}_padrao`, label: `${p} – Pontuação-padrão`, type: "number" as const, higher_is_better: true },
      { key: `${p}_class`, label: `${p} – Classificação`, type: "text" as const },
    ]).map((f) => ({ ...f, key: f.key.replace(/\s+/g, "_").toLowerCase() })),
  },
  {
    name: "Torre de Londres", ran_domain: "Funções executivas › Planejamento, organização estratégica e resolução de problemas", reference: "Instrumento qualitativo para avaliação das funções executivas, incluindo planejamento, organização estratégica, memória operacional, resolução de problemas e monitoramento das respostas.", full_name: "Torre de Londres", area: "Atenção e funções executivas",
    evaluates: "Planejamento e resolução de problemas.",
    access: "verificar", access_note: VERIFY_NOTE,
    record_fields: [
      { key: "acertos", label: "Problemas resolvidos", type: "number", higher_is_better: true },
      { key: "movimentos_extra", label: "Movimentos extras", type: "number", higher_is_better: false },
      { key: "tempo_s", label: "Tempo (s)", type: "number", higher_is_better: false },
    ],
  },
  {
    name: "FDT", ran_domain: "Funções executivas › Atenção", full_name: "Teste dos Cinco Dígitos", area: "Atenção e funções executivas",
    evaluates: "Velocidade de processamento, controle inibitório e flexibilidade cognitiva.",
    access: "verificar", access_note: VERIFY_NOTE, record_fields: GENERIC,
  },
  {
    name: "BPA", ran_domain: "Funções executivas › Atenção", full_name: "Bateria Psicológica para Avaliação da Atenção", area: "Atenção e funções executivas",
    evaluates: "Atenção concentrada, dividida e alternada.", access: "psicologo", access_note: PSI_NOTE, record_fields: SCORE,
  },
  // Memória
  {
    name: "Cubos de Corsi", ran_domain: "Memória › Memória operacional visuoespacial", reference: "DIAS, N. M.; MECCA, T. P. (Orgs.). Avaliação Neuropsicológica Cognitiva: Memória de Trabalho. São Paulo: Memnon, 2019.", full_name: "Blocos de Corsi", area: "Memória",
    evaluates: "Memória operacional visuoespacial (ordem direta e inversa).",
    access: "verificar", access_note: VERIFY_NOTE,
    record_fields: [
      { key: "span_direto", label: "Span ordem direta", type: "number", higher_is_better: true },
      { key: "span_inverso", label: "Span ordem inversa", type: "number", higher_is_better: true },
    ],
  },
  {
    name: "Figuras de Rey", ran_domain: "Memória › Memória visual", full_name: "Figuras Complexas de Rey", area: "Memória",
    evaluates: "Percepção visual, visuoconstrução, planejamento e memória visual.", access: "psicologo", access_note: PSI_NOTE,
    record_fields: [{ key: "copia", label: "Cópia", type: "number", higher_is_better: true }, { key: "memoria", label: "Memória", type: "number", higher_is_better: true }],
  },
  // Inteligência / visuoconstrução
  {
    name: "WISC", ran_domain: "Inteligência", full_name: "Escala Wechsler de Inteligência para Crianças", area: "Inteligência e visuoconstrução",
    evaluates: "Funcionamento intelectual geral e índices cognitivos.", access: "psicologo", access_note: PSI_NOTE, record_fields: SCORE,
  },
  {
    name: "SON-R", ran_domain: "Inteligência", full_name: "Teste Não-Verbal de Inteligência SON-R", area: "Inteligência e visuoconstrução",
    evaluates: "Inteligência não verbal.", access: "psicologo", access_note: PSI_NOTE, record_fields: SCORE,
  },
  {
    name: "Bender", ran_domain: "Comportamento motor", full_name: "Teste Gestáltico Visomotor de Bender", area: "Inteligência e visuoconstrução",
    evaluates: "Maturidade perceptomotora / visuoconstrução.", access: "psicologo", access_note: PSI_NOTE, record_fields: SCORE,
  },
  // Instrumentos e procedimentos utilizados no modelo de RAN da profissional
  {
    name: "Conners – Pais", full_name: "Questionário de Conners para Pais", area: "Rastreio do comportamento", ran_domain: "Aspectos comportamentais em diferentes contextos",
    evaluates: "Rastreio de comportamentos relacionados a desatenção, hiperatividade e conduta segundo o relato dos pais.",
    reference: "GAIÃO, A. A.; BARBOSA, G. A. Infanto: Revista de Neuropsiquiatria da Infância e Adolescência, v. 6, n. 1, p. 21–31, 1998.",
    access: "verificar", access_note: VERIFY_NOTE,
    record_fields: [{ key: "total", label: "Pontuação total", type: "number", higher_is_better: false }, { key: "sintese", label: "Síntese", type: "text" }],
  },
  {
    name: "Conners – Professores", full_name: "Questionário de Conners para Professores", area: "Rastreio do comportamento", ran_domain: "Aspectos comportamentais em diferentes contextos",
    evaluates: "Rastreio de comportamentos em sala de aula, participação em grupo e atitude em relação à autoridade segundo o relato do(a) professor(a).",
    reference: "GAIÃO, A. A.; BARBOSA, G. A. Infanto: Revista de Neuropsiquiatria da Infância e Adolescência, v. 6, n. 1, p. 21–31, 1998.",
    access: "verificar", access_note: VERIFY_NOTE,
    record_fields: [
      { key: "sala_aula", label: "Comportamento em sala de aula", type: "number", higher_is_better: false },
      { key: "grupo", label: "Participação em grupo", type: "number", higher_is_better: false },
      { key: "autoridade", label: "Atitude em relação à autoridade", type: "number", higher_is_better: false },
      { key: "total", label: "Pontuação total", type: "number", higher_is_better: false },
    ],
  },
  {
    name: "SRS-2", full_name: "Escala de Responsividade Social – Segunda Edição", area: "Rastreio do comportamento", ran_domain: "Aspectos comportamentais em diferentes contextos",
    evaluates: "Comportamentos de responsividade social: percepção social, cognição social, comunicação social, motivação social e padrões restritos e repetitivos.",
    reference: "CONSTANTINO, J. N.; GRUBER, C. P. Social Responsiveness Scale – 2nd Edition (SRS-2). Torrance, CA: Western Psychological Services, 2012.",
    access: "verificar", access_note: VERIFY_NOTE,
    record_fields: ["Percepção social", "Cognição social", "Comunicação social", "Motivação social", "Padrões restritos e repetitivos", "Total"].flatMap((d) => [
      { key: `${d}_t`, label: `${d} – Escore T`, type: "number" as const, higher_is_better: false },
      { key: `${d}_class`, label: `${d} – Classificação`, type: "text" as const },
    ]).map((f) => ({ ...f, key: f.key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").toLowerCase() })),
  },
  {
    name: "DCDQ", full_name: "Developmental Coordination Disorder Questionnaire", area: "Coordenação motora", ran_domain: "Comportamento motor",
    evaluates: "Rastreio da coordenação motora em atividades do dia a dia (controle durante o movimento, motricidade fina/escrita e coordenação geral), respondido pelos responsáveis.",
    reference: "WILSON, B. N.; CRAWFORD, S. G.; GREEN, D.; ROBERTS, G.; AYLOTT, A.; KAPLAN, B. Developmental Coordination Disorder Questionnaire (DCDQ). 2009.",
    access: "verificar", access_note: VERIFY_NOTE,
    record_fields: [
      { key: "controle_movimento", label: "Controle durante o movimento", type: "number", higher_is_better: true },
      { key: "motricidade_fina", label: "Motricidade fina / escrita", type: "number", higher_is_better: true },
      { key: "coordenacao_geral", label: "Coordenação geral", type: "number", higher_is_better: true },
      { key: "total", label: "Pontuação total", type: "number", higher_is_better: true },
    ],
  },
  {
    name: "Prova de Aritmética", full_name: "Prova de Aritmética", area: "Matemática", ran_domain: "Aritmética",
    evaluates: "Habilidades matemáticas: processamento numérico e cálculos.",
    reference: "SEABRA, A. G.; MONTIEL, J. M.; CAPOVILLA, F. C. Prova de Aritmética. In: SEABRA, A. G.; DIAS, N. M.; CAPOVILLA, F. C. (Orgs.). Avaliação neuropsicológica cognitiva: leitura, escrita e aritmética. v. 3. São Paulo: Memnon, 2013.",
    access: "verificar", access_note: VERIFY_NOTE,
    record_fields: (["Processamento Numérico", "Cálculos", "Geral"] as const).flatMap((p) => [
      { key: `${p}_bruto`, label: `${p} – Escore bruto`, type: "number" as const, higher_is_better: true },
      { key: `${p}_padrao`, label: `${p} – Pontuação-padrão`, type: "number" as const, higher_is_better: true },
      { key: `${p}_class`, label: `${p} – Classificação`, type: "text" as const },
    ]).map((f) => ({ ...f, key: f.key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").toLowerCase() })),
  },
  {
    name: "PCFF", full_name: "Prova de Consciência Fonológica por Escolha de Figuras", area: "Leitura, escrita e linguagem", ran_domain: "Linguagem › Consciência fonológica",
    evaluates: "Consciência fonológica (rima, aliteração, adição, subtração e transposição silábica e fonêmica, entre outros) por meio da escolha de figuras.",
    reference: "CAPOVILLA, F. C.; SEABRA, A. G. Teste de Consciência Fonológica por Escolha de Figuras. In: SEABRA, A. G.; DIAS, N. M. (Orgs.). Avaliação neuropsicológica cognitiva: linguagem oral. São Paulo: Memnon, 2012.",
    access: "verificar", access_note: VERIFY_NOTE,
    record_fields: [{ key: "total", label: "Pontuação geral", type: "number", higher_is_better: true }, { key: "classificacao", label: "Classificação", type: "text" }],
  },
  {
    name: "Span de Dígitos", full_name: "Tarefa de Span de Dígitos", area: "Memória", ran_domain: "Memória › Memória operacional auditiva",
    evaluates: "Memória operacional auditiva (ordem direta e ordem inversa).",
    access: "verificar", access_note: VERIFY_NOTE,
    record_fields: [
      { key: "od_escore", label: "Ordem direta – Escore", type: "number", higher_is_better: true },
      { key: "od_span", label: "Ordem direta – Span", type: "number", higher_is_better: true },
      { key: "oi_escore", label: "Ordem inversa – Escore", type: "number", higher_is_better: true },
      { key: "oi_span", label: "Ordem inversa – Span", type: "number", higher_is_better: true },
    ],
  },
  {
    name: "Hora Lúdica", full_name: "Hora Lúdica", area: "Aprendizagem (psicopedagógicos)", ran_domain: "Aprendizagem",
    evaluates: "Procedimento de observação qualitativa do comportamento, interação, comunicação, interesses, brincadeira, autorregulação e estratégias utilizadas pela criança durante situações lúdicas, realizado no contexto da avaliação neuropsicopedagógica.",
    access: "multiprofissional", access_note: "Procedimento de observação clínica.", record_fields: QUALI,
  },
  {
    name: "Observação Escolar", full_name: "Observação Escolar", area: "Aprendizagem (psicopedagógicos)", ran_domain: "Aspectos comportamentais em diferentes contextos",
    evaluates: "Procedimento de observação qualitativa realizado no ambiente escolar, destinado à análise do comportamento, atenção, participação, interação social, engajamento nas atividades, compreensão de instruções e desempenho acadêmico da criança em situação natural de sala de aula.",
    access: "multiprofissional", access_note: "Procedimento de observação.", record_fields: QUALI,
  },
  {
    name: "Sondagem da Leitura e Escrita", full_name: "Sondagem da Leitura e Escrita", area: "Leitura, escrita e linguagem", ran_domain: "Linguagem › Sondagem da leitura e escrita",
    evaluates: "Procedimento de avaliação pedagógica elaborado e aplicado pela avaliadora, destinado à investigação de habilidades relacionadas ao reconhecimento e nomeação de letras, correspondência grafema-fonema, leitura, escrita espontânea, escrita sob ditado e estratégias utilizadas pela criança durante a apropriação do sistema de escrita alfabética.",
    access: "multiprofissional", access_note: "Procedimento pedagógico próprio.",
    record_fields: [{ key: "nivel_escrita", label: "Nível de escrita (hipótese)", type: "text" }, { key: "letras", label: "Letras reconhecidas (de 26)", type: "number", higher_is_better: true }],
  },
  {
    name: "Sondagem Matemática", full_name: "Sondagem Matemática", area: "Matemática", ran_domain: "Aritmética",
    evaluates: "Procedimento de avaliação pedagógica elaborado e aplicado pela avaliadora, destinado à investigação de habilidades matemáticas, incluindo reconhecimento e utilização de números, contagem, relações de quantidade, operações e resolução de situações-problema, conforme as demandas propostas à criança.",
    access: "multiprofissional", access_note: "Procedimento pedagógico próprio.", record_fields: QUALI,
  },
];

export const INSTRUMENT_AREAS = Array.from(new Set(INSTRUMENT_LIBRARY.map((i) => i.area)));

export const ACCESS_LABEL: Record<Instrument["access"], { label: string; short: string; tone: "red" | "green" | "amber" }> = {
  psicologo: { label: "Privativo de psicólogos", short: "Psicólogos", tone: "red" },
  multiprofissional: { label: "Neuropsicopedagogos / psicopedagogos", short: "Neuro/psicopedagogos", tone: "green" },
  verificar: { label: "Classificação a confirmar", short: "Verificar", tone: "amber" },
};

export const DEFAULT_RECORD_FIELDS = GENERIC;

/** Ordem das seções de resultados no RAN (seção 8.2) e da seção 9. */
export const RAN_DOMAINS = [
  "Funções executivas › Atenção",
  "Funções executivas › Flexibilidade cognitiva",
  "Funções executivas › Planejamento, organização estratégica e resolução de problemas",
  "Memória › Memória operacional visuoespacial",
  "Memória › Memória operacional auditiva",
  "Memória › Memória visual",
  "Linguagem › Habilidades para alfabetização",
  "Linguagem › Consciência fonológica",
  "Linguagem › Leitura e escrita",
  "Linguagem › Sondagem da leitura e escrita",
  "Aritmética",
  "Comportamento motor",
  "Aprendizagem",
  "Inteligência",
  "Aspectos comportamentais em diferentes contextos",
];
