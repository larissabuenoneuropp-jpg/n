// Catálogos de referência. A profissional pode adicionar itens livremente.

import { INSTRUMENT_LIBRARY } from "./data/instruments-library";

/** Lista de nomes/descrições para sugestões rápidas (a biblioteca completa fica na tabela "instruments"). */
export const INSTRUMENTS = INSTRUMENT_LIBRARY.map((i) => ({
  name: i.name, full: i.full_name, domain: i.area, restricted: i.access === "psicologo",
}));

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
