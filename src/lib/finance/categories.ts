// Categorias de receitas e despesas, com natureza (DRE gerencial) e classificação fiscal padrão.
// A classificação fiscal padrão vem do arquivo do contador (aba única "Simulador", colunas I1:I28);
// o que o arquivo não cita fica "a_confirmar" e NÃO é deduzido do imposto.
import type { CostNature, TaxClass } from "@/lib/types";

export interface ExpenseCategory {
  name: string;
  nature: CostNature;
  taxClass: TaxClass;
  /** De onde vem a classificação fiscal padrão. */
  taxSource: string;
  /** Tributo sobre a renda da profissional (IR/INSS): fica abaixo do resultado operacional no DRE. */
  incomeTax?: boolean;
}

const ARQ = "Arquivo do contador, lista de despesas dedutíveis (I1:I17)";
const ARQ_ND = "Arquivo do contador, lista de despesas não dedutíveis (I21:I28)";
const NAO_CITA = "Não citado no arquivo do contador — confirmar";

export const EXPENSE_CATEGORIES_FIN: ExpenseCategory[] = [
  { name: "Espaço por atendimento", nature: "variavel", taxClass: "a_confirmar", taxSource: `${NAO_CITA} (pode equivaler a "aluguel", dedutível, se houver recibo em seu nome)` },
  { name: "Aluguel", nature: "fixo", taxClass: "dedutivel", taxSource: `${ARQ}: "Aluguel"` },
  { name: "Condomínio e estrutura", nature: "fixo", taxClass: "dedutivel", taxSource: `${ARQ}: "Condomínio", "Luz", "Água", "Telefone"` },
  { name: "Supervisão profissional", nature: "fixo", taxClass: "a_confirmar", taxSource: NAO_CITA },
  { name: "Cursos e especializações", nature: "fixo", taxClass: "a_confirmar", taxSource: NAO_CITA },
  { name: "Materiais e instrumentos de avaliação", nature: "variavel", taxClass: "a_confirmar", taxSource: NAO_CITA },
  { name: "Brinquedos e jogos terapêuticos", nature: "variavel", taxClass: "a_confirmar", taxSource: NAO_CITA },
  { name: "Sistemas, aplicativos e assinaturas", nature: "fixo", taxClass: "a_confirmar", taxSource: NAO_CITA },
  { name: "Marketing e divulgação", nature: "fixo", taxClass: "dedutivel", taxSource: `${ARQ}: "Propaganda"` },
  { name: "Contabilidade", nature: "fixo", taxClass: "dedutivel", taxSource: `${ARQ}: "Honorários contábeis"` },
  { name: "Impostos e taxas", nature: "tributo", taxClass: "dedutivel", taxSource: `${ARQ}: "ISS fixo", "Vigilância sanitária", "Conselho regional"` },
  { name: "IRPF — Carnê-Leão", nature: "tributo", taxClass: "nao_dedutivel", taxSource: "O próprio imposto não é despesa dedutível", incomeTax: true },
  { name: "INSS — contribuição individual", nature: "tributo", taxClass: "nao_dedutivel", taxSource: "Tratado pela regra de dedução do INSS (Configuração tributária)", incomeTax: true },
  { name: "Deslocamentos", nature: "variavel", taxClass: "nao_dedutivel", taxSource: `${ARQ_ND}: "Despesas com locomoção"` },
  { name: "Equipamentos e mobiliário", nature: "investimento", taxClass: "investimento", taxSource: `${ARQ_ND}: "Equipamentos", "Móveis e aparelhos" — considerados investimento` },
  { name: "Outras despesas operacionais", nature: "fixo", taxClass: "a_confirmar", taxSource: NAO_CITA },
  { name: "Investimentos empresariais", nature: "investimento", taxClass: "investimento", taxSource: "Investimento: não é despesa do mês" },
  { name: "Despesas pessoais pagas pela empresa", nature: "pessoal", taxClass: "pessoal", taxSource: "Gasto pessoal: corrigir (reembolsar ou reclassificar como retirada)" },
];

/** Categorias antigas do app (antes do módulo) → categorias atuais. */
const ALIASES: Record<string, string> = {
  "aluguel": "Aluguel",
  "materiais": "Materiais e instrumentos de avaliação",
  "testes e protocolos": "Materiais e instrumentos de avaliação",
  "cursos": "Cursos e especializações",
  "impostos": "Impostos e taxas",
  "marketing": "Marketing e divulgação",
  "software": "Sistemas, aplicativos e assinaturas",
  "outros": "Outras despesas operacionais",
  "condomínio": "Condomínio e estrutura",
  "condominio": "Condomínio e estrutura",
  "contabilidade": "Contabilidade",
  "supervisão": "Supervisão profissional",
};

export function expenseCategory(name: string | null | undefined): ExpenseCategory {
  const raw = (name ?? "").trim();
  const exact = EXPENSE_CATEGORIES_FIN.find((c) => c.name === raw);
  if (exact) return exact;
  const alias = ALIASES[raw.toLowerCase()];
  const found = alias && EXPENSE_CATEGORIES_FIN.find((c) => c.name === alias);
  if (found) return found;
  return { name: raw || "Outras despesas operacionais", nature: "fixo", taxClass: "a_confirmar", taxSource: NAO_CITA };
}

/** Tipos de serviço (receitas). Mantém os nomes antigos do app para compatibilidade. */
export const SERVICE_TYPES = ["Sessão avulsa", "Pacote mensal", "Sessão (convênio)", "Avaliação", "Devolutiva", "Reposição", "Mensalidade", "Sessão", "Supervisão", "Outros"];

export const WITHDRAWAL_CATEGORY = "Retirada pessoal";

export const NATURE_LABEL: Record<CostNature, string> = {
  fixo: "Fixa",
  variavel: "Variável",
  extraordinario: "Extraordinária",
  investimento: "Investimento",
  tributo: "Tributo/taxa",
  pessoal: "Pessoal (corrigir)",
};

export const TAX_CLASS_LABEL: Record<TaxClass, string> = {
  dedutivel: "Dedutível (livro-caixa)",
  nao_dedutivel: "Não dedutível",
  investimento: "Investimento (não dedutível)",
  a_confirmar: "A confirmar com o contador",
  pessoal: "Pessoal",
};

export const PAYMENT_METHODS = ["PIX", "Transferência", "Dinheiro", "Cartão de crédito", "Cartão de débito", "Boleto", "Convênio/plano de saúde", "Outro"];
