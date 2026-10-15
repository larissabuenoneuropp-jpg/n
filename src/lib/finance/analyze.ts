// Ponto único que calcula todos os indicadores a partir dos dados registrados.
// Todas as telas usam este resultado: uma alteração em qualquer lançamento atualiza tudo.
import { monthOf, type Month } from "./calendar";
import { expenseCategory } from "./categories";
import { buildLedger, cashPosition, historyStats, receivables, type CashPosition, type HistoryStats, type MonthLedger } from "./ledger";
import { computeBudget, type BudgetResult } from "./budget";
import { computeAlerts, type FinAlert } from "./alerts";
import { fromCents, toCents } from "./money";
import { analyzeProLabore, maxSustainableWithdrawal, type ProLaboreAnalysis } from "./prolabore";
import { project, type FinanceData, type Projection } from "./projection";
import { actualDre, monthsWithData, type DreRow } from "./reports";
import type { ScenarioKey } from "./settings";
import { missingTaxData, type MissingItem } from "./tax";

export interface FinanceAnalysis {
  today: string;
  currentMonth: Month;
  ledger: Map<Month, MonthLedger>;
  /** DRE dos meses com lançamentos até o mês atual (o atual ainda está em andamento). */
  dre: DreRow[];
  /** Somente meses fechados (anteriores ao atual). */
  closed: DreRow[];
  current: DreRow | null;
  stats: HistoryStats;
  /** Retirada mensal usada nas projeções: a planejada ou, sem plano, a recomendada. */
  proLaboreUsed: number;
  cash: CashPosition;
  receivables: ReturnType<typeof receivables>;
  projections: Record<ScenarioKey, Projection>;
  prolabore: ProLaboreAnalysis;
  budget: BudgetResult;
  alerts: FinAlert[];
  missingTax: MissingItem[];
}

export function analyzeFinance(data: FinanceData, today: string): FinanceAnalysis {
  const s = data.settings;
  const currentMonth = monthOf(today)!;
  const ledger = buildLedger(data.transactions, { taxClassOf: (cat) => s.tax.deductibility[cat]?.tax_class ?? expenseCategory(cat).taxClass });
  const months = monthsWithData(ledger, currentMonth);
  const dre = actualDre(ledger, months.length ? months : [currentMonth], s, data.transactions);
  const closed = dre.filter((r) => r.month < currentMonth);
  const current = dre.find((r) => r.month === currentMonth) ?? null;
  const stats = historyStats(ledger, data.transactions, currentMonth, today);
  const cash = cashPosition(data.balances, data.transactions, today);

  // Pró-labore usado nas projeções exibidas: o planejado ou, se não houver, o recomendado
  const rec = maxSustainableWithdrawal(data, "conservador", today);
  const plannedOrRec = s.pro_labore_planned ?? rec.amount;
  const projections = {
    conservador: project(data, { scenario: "conservador", today, proLabore: plannedOrRec }),
    realista: project(data, { scenario: "realista", today, proLabore: plannedOrRec }),
    otimista: project(data, { scenario: "otimista", today, proLabore: plannedOrRec }),
  } satisfies Record<ScenarioKey, Projection>;

  const withdrawn = ledger.get(currentMonth)?.withdrawalsProLabore ?? 0;
  const remaining = Math.max(0, fromCents(toCents(Math.min(plannedOrRec, rec.amount)) - toCents(withdrawn)));
  const budget = computeBudget(data, today, remaining, projections.conservador, projections.realista);
  const prolabore = analyzeProLabore(data, today, budget.freeCash);
  const alerts = computeAlerts({ data, today, ledger, closed, realistic: projections.realista, conservative: projections.conservador, prolabore, budget, proLabore: plannedOrRec });
  return {
    today, currentMonth, ledger, dre, closed, current, stats, proLaboreUsed: plannedOrRec, cash, receivables: receivables(data.transactions, today), projections, prolabore, budget, alerts,
    missingTax: missingTaxData(s.tax),
  };
}

