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
    name: "SNAP-IV", full_name: "Questionário SNAP-IV (pais e professores)", area: "Rastreio do comportamento",
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
    name: "M-CHAT", full_name: "Modified Checklist for Autism in Toddlers", area: "Rastreio do comportamento",
    evaluates: "Rastreio de sinais de risco para TEA na primeira infância, respondido pelos responsáveis. Não é diagnóstico.",
    access: "multiprofissional", access_note: "Instrumento de rastreio de uso livre. Confira a versão e faixa etária adequadas.",
    record_fields: [{ key: "itens_risco", label: "Itens de risco", type: "number", higher_is_better: false }, { key: "classificacao", label: "Faixa de risco", type: "text" }],
  },
  {
    name: "CARS", full_name: "Childhood Autism Rating Scale", area: "Rastreio do comportamento",
    evaluates: "Escala de avaliação de comportamentos associados ao TEA a partir de observação e relato.",
    access: "verificar", access_note: VERIFY_NOTE,
    record_fields: [{ key: "total", label: "Pontuação total", type: "number", higher_is_better: false }, { key: "classificacao", label: "Classificação", type: "text" }],
  },
  // Aprendizagem — instrumentos psicopedagógicos
  {
    name: "EOCA", full_name: "Entrevista Operativa Centrada na Aprendizagem", area: "Aprendizagem (psicopedagógicos)",
    evaluates: "Observação da modalidade de aprendizagem, vínculo com os objetos de conhecimento, temática e dinâmica da criança diante de materiais.",
    access: "multiprofissional", access_note: "Técnica da Psicopedagogia, utilizada por psicopedagogos e neuropsicopedagogos.",
    record_fields: QUALI,
  },
  {
    name: "Provas Operatórias", full_name: "Provas Operatórias Piagetianas", area: "Aprendizagem (psicopedagógicos)",
    evaluates: "Nível de pensamento lógico (conservação, classificação, seriação etc.) segundo a teoria piagetiana.",
    access: "multiprofissional", access_note: "Recurso clássico da avaliação psicopedagógica.",
    record_fields: [{ key: "provas_conservadas", label: "Provas com conservação", type: "number", higher_is_better: true }, { key: "nivel", label: "Nível operatório", type: "text" }],
  },
  {
    name: "Técnicas Projetivas Psicopedagógicas", full_name: "Técnicas Projetivas Psicopedagógicas (Visca)", area: "Aprendizagem (psicopedagógicos)",
    evaluates: "Vínculos da criança com a aprendizagem nos âmbitos escolar, familiar e consigo mesma (ex.: par educativo, família educativa).",
    access: "multiprofissional", access_note: "Técnicas da Psicopedagogia (distintas dos testes projetivos psicológicos).",
    record_fields: QUALI,
  },
  {
    name: "IAR", full_name: "Instrumento de Avaliação do Repertório Básico para Alfabetização", area: "Aprendizagem (psicopedagógicos)",
    evaluates: "Pré-requisitos para a alfabetização: esquema corporal, lateralidade, posição, direção, espaço, tamanho, quantidade, forma, discriminação visual e auditiva, coordenação motora fina, entre outros.",
    access: "multiprofissional", access_note: "Utilizado por psicopedagogos e neuropsicopedagogos. Confirme a edição vigente.",
    record_fields: SCORE,
  },
  // Leitura, escrita e linguagem
  {
    name: "CONFIAS", full_name: "Consciência Fonológica: Instrumento de Avaliação Sequencial", area: "Leitura, escrita e linguagem",
    evaluates: "Consciência fonológica nos níveis da sílaba e do fonema.",
    access: "multiprofissional", access_note: "Usado por fonoaudiólogos, psicopedagogos e neuropsicopedagogos.",
    record_fields: [
      { key: "silaba", label: "Nível da sílaba", type: "number", higher_is_better: true },
      { key: "fonema", label: "Nível do fonema", type: "number", higher_is_better: true },
      { key: "total", label: "Total", type: "number", higher_is_better: true },
    ],
  },
  {
    name: "PROLEC", full_name: "Provas de Avaliação dos Processos de Leitura", area: "Leitura, escrita e linguagem",
    evaluates: "Processos envolvidos na leitura: identificação de letras, processos léxicos, sintáticos e semânticos.",
    access: "multiprofissional", access_note: "Usado por fonoaudiólogos, psicopedagogos e neuropsicopedagogos. Personalize os subtestes conforme o manual.",
    record_fields: GENERIC,
  },
  {
    name: "PROESC", full_name: "Avaliação dos Processos de Escrita", area: "Leitura, escrita e linguagem",
    evaluates: "Processos envolvidos na escrita: ditado, escrita de palavras e pseudopalavras, produção textual.",
    access: "multiprofissional", access_note: "Usado por fonoaudiólogos, psicopedagogos e neuropsicopedagogos. Personalize os subtestes conforme o manual.",
    record_fields: GENERIC,
  },
  {
    name: "TDE II", full_name: "Teste de Desempenho Escolar — 2ª edição", area: "Leitura, escrita e linguagem",
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
    name: "TAC", full_name: "Teste de Atenção por Cancelamento", area: "Atenção e funções executivas",
    evaluates: "Atenção seletiva e sustentada por meio de tarefas de cancelamento de estímulos-alvo.",
    access: "verificar", access_note: VERIFY_NOTE, record_fields: GENERIC,
  },
  {
    name: "Trilhas", full_name: "Teste de Trilhas", area: "Atenção e funções executivas",
    evaluates: "Flexibilidade cognitiva, atenção alternada e velocidade de processamento.",
    access: "verificar", access_note: "Existem versões diferentes (algumas constam no SATEPSI). " + VERIFY_NOTE, record_fields: GENERIC,
  },
  {
    name: "Torre de Londres", full_name: "Torre de Londres", area: "Atenção e funções executivas",
    evaluates: "Planejamento e resolução de problemas.",
    access: "verificar", access_note: VERIFY_NOTE,
    record_fields: [
      { key: "acertos", label: "Problemas resolvidos", type: "number", higher_is_better: true },
      { key: "movimentos_extra", label: "Movimentos extras", type: "number", higher_is_better: false },
      { key: "tempo_s", label: "Tempo (s)", type: "number", higher_is_better: false },
    ],
  },
  {
    name: "FDT", full_name: "Teste dos Cinco Dígitos", area: "Atenção e funções executivas",
    evaluates: "Velocidade de processamento, controle inibitório e flexibilidade cognitiva.",
    access: "verificar", access_note: VERIFY_NOTE, record_fields: GENERIC,
  },
  {
    name: "BPA", full_name: "Bateria Psicológica para Avaliação da Atenção", area: "Atenção e funções executivas",
    evaluates: "Atenção concentrada, dividida e alternada.", access: "psicologo", access_note: PSI_NOTE, record_fields: SCORE,
  },
  // Memória
  {
    name: "Cubos de Corsi", full_name: "Blocos de Corsi", area: "Memória",
    evaluates: "Memória operacional visuoespacial (ordem direta e inversa).",
    access: "verificar", access_note: VERIFY_NOTE,
    record_fields: [
      { key: "span_direto", label: "Span ordem direta", type: "number", higher_is_better: true },
      { key: "span_inverso", label: "Span ordem inversa", type: "number", higher_is_better: true },
    ],
  },
  {
    name: "Figuras de Rey", full_name: "Figuras Complexas de Rey", area: "Memória",
    evaluates: "Percepção visual, visuoconstrução, planejamento e memória visual.", access: "psicologo", access_note: PSI_NOTE,
    record_fields: [{ key: "copia", label: "Cópia", type: "number", higher_is_better: true }, { key: "memoria", label: "Memória", type: "number", higher_is_better: true }],
  },
  // Inteligência / visuoconstrução
  {
    name: "WISC", full_name: "Escala Wechsler de Inteligência para Crianças", area: "Inteligência e visuoconstrução",
    evaluates: "Funcionamento intelectual geral e índices cognitivos.", access: "psicologo", access_note: PSI_NOTE, record_fields: SCORE,
  },
  {
    name: "SON-R", full_name: "Teste Não-Verbal de Inteligência SON-R", area: "Inteligência e visuoconstrução",
    evaluates: "Inteligência não verbal.", access: "psicologo", access_note: PSI_NOTE, record_fields: SCORE,
  },
  {
    name: "Bender", full_name: "Teste Gestáltico Visomotor de Bender", area: "Inteligência e visuoconstrução",
    evaluates: "Maturidade perceptomotora / visuoconstrução.", access: "psicologo", access_note: PSI_NOTE, record_fields: SCORE,
  },
];

export const INSTRUMENT_AREAS = Array.from(new Set(INSTRUMENT_LIBRARY.map((i) => i.area)));

export const ACCESS_LABEL: Record<Instrument["access"], { label: string; short: string; tone: "red" | "green" | "amber" }> = {
  psicologo: { label: "Privativo de psicólogos", short: "Psicólogos", tone: "red" },
  multiprofissional: { label: "Neuropsicopedagogos / psicopedagogos", short: "Neuro/psicopedagogos", tone: "green" },
  verificar: { label: "Classificação a confirmar", short: "Verificar", tone: "amber" },
};

export const DEFAULT_RECORD_FIELDS = GENERIC;
