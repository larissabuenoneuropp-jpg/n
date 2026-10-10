// Catálogos de referência. A profissional pode adicionar itens livremente.

export interface InstrumentInfo {
  name: string;
  full: string;
  domain: string;
  /** Instrumentos que, até onde sabemos, são de uso privativo de psicólogos (SATEPSI/CFP).
   *  A situação pode mudar — confirme sempre no SATEPSI antes de planejar o uso. */
  restricted?: boolean;
}

export const INSTRUMENTS: InstrumentInfo[] = [
  { name: "CARS", full: "Childhood Autism Rating Scale", domain: "Rastreio TEA / comportamento" },
  { name: "M-CHAT", full: "Modified Checklist for Autism in Toddlers", domain: "Rastreio TEA (primeira infância)" },
  { name: "SNAP-IV", full: "Questionário SNAP-IV (pais/professores)", domain: "Desatenção / hiperatividade / oposição" },
  { name: "IAR", full: "Instrumento de Avaliação do Repertório Básico para Alfabetização", domain: "Pré-requisitos de alfabetização" },
  { name: "CONFIAS", full: "Consciência Fonológica: Instrumento de Avaliação Sequencial", domain: "Consciência fonológica" },
  { name: "PROLEC", full: "Provas de Avaliação dos Processos de Leitura", domain: "Leitura" },
  { name: "PROESC", full: "Avaliação dos Processos de Escrita", domain: "Escrita" },
  { name: "TAC", full: "Teste de Atenção por Cancelamento", domain: "Atenção" },
  { name: "Trilhas", full: "Teste de Trilhas", domain: "Flexibilidade cognitiva / atenção alternada" },
  { name: "Torre de Londres", full: "Torre de Londres", domain: "Planejamento / funções executivas" },
  { name: "Cubos de Corsi", full: "Blocos de Corsi", domain: "Memória operacional visuoespacial" },
  { name: "EOCA", full: "Entrevista Operativa Centrada na Aprendizagem", domain: "Modalidade de aprendizagem" },
  { name: "Provas Operatórias", full: "Provas Operatórias Piagetianas", domain: "Pensamento lógico / nível operatório" },
  { name: "BPA", full: "Bateria Psicológica para Avaliação da Atenção", domain: "Atenção", restricted: true },
  { name: "WISC", full: "Escala Wechsler de Inteligência para Crianças", domain: "Inteligência", restricted: true },
  { name: "SON-R", full: "Teste Não-Verbal de Inteligência SON-R", domain: "Inteligência não verbal", restricted: true },
];

export const AREAS = [
  "Alfabetização", "Funções Executivas", "Memória", "Linguagem", "Leitura", "Escrita",
  "Matemática", "Coordenação Motora", "Psicomotricidade", "Atenção", "Habilidades Sociais", "Regulação Emocional",
];

export const DIAGNOSES = ["TEA", "TDAH", "Dislexia", "Discalculia", "Disortografia", "TOD", "Deficiência Intelectual", "TDL", "Sem diagnóstico"];

export const DOCUMENT_CATEGORIES = [
  { value: "relatorio", label: "Relatório" },
  { value: "anamnese", label: "Anamnese" },
  { value: "termo", label: "Termo" },
  { value: "contrato", label: "Contrato" },
  { value: "laudo", label: "Laudo" },
  { value: "encaminhamento", label: "Encaminhamento" },
  { value: "foto", label: "Foto" },
  { value: "video", label: "Vídeo" },
  { value: "outro", label: "Outro" },
];

export const EXPENSE_CATEGORIES = ["Aluguel", "Materiais", "Testes e protocolos", "Cursos", "Impostos", "Marketing", "Software", "Outros"];
export const INCOME_CATEGORIES = ["Sessão", "Avaliação", "Mensalidade", "Devolutiva", "Supervisão", "Outros"];

export const DEFAULT_CHECKLIST = [
  "Anamnese realizada com responsáveis",
  "Termo de consentimento assinado",
  "Contato com a escola",
  "Materiais e protocolos separados",
  "Correção dos instrumentos",
  "Devolutiva agendada",
];
