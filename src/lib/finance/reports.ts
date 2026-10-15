// Relatórios sobre os meses realizados (lançamentos): DRE gerencial, impostos, margem por serviço,
// custo por sessão, inadimplência e orçado × realizado.
import type { Transaction } from "@/lib/types";
import type { Month } from "./calendar";
import { competenceOf, discountOf, grossOf, isOpenReceivable, monthLedger, type MonthLedger } from "./ledger";
import { fromCents, toCents } from "./money";
import type { FinanceSettings } from "./settings";
import { taxSeries, type MonthTaxResult } from "./tax";

export interface DreRow {
  month: Month;
  gross: number;
  discounts: number;
  net: number;
  variable: number;
  contribution: number;
  fixed: number;
  opTaxes: number;
  extra: number;
  opResult: number;
  opMargin: number | null;
  incomeTax: number;
  inss: number;
  netResult: number;
  netMargin: number | null;
  /** false quando falta dado essencial (ex.: INSS) — lucro líquido é estimativa provisória. */
  netReliable: boolean;
  received: number;
  paidOut: number;
  withdrawals: number;
  investments: number;
  personal: number;
  sessionsDone: number;
  absences: number;
  payers: number;
  tax: MonthTaxResult;
}

const c = toCents;
const r = fromCents;

export function taxInputsFromLedger(l: MonthLedger) {
  return {
    month: l.month, receivedPF: l.receivedPF, receivedPJ: l.receivedPJ, receivedUnknown: l.receivedUnknown, irrfWithheld: l.irrfWithheld,
    deductibleExpenses: l.paidDeductible, toConfirmExpenses: l.paidToConfirm, inssPaid: l.inssPaid,
  };
}

export function actualDre(ledger: Map<Month, MonthLedger>, months: Month[], s: FinanceSettings, txs: Transaction[]): DreRow[] {
  const taxes = taxSeries(months.map((m) => taxInputsFromLedger(monthLedger(ledger, m))), s.tax);
  return months.map((m, i) => {
    const l = monthLedger(ledger, m);
    const net = c(l.grossBilled) - c(l.discounts);
    const contribution = net - c(l.variableCosts);
    const op = contribution - c(l.fixedCosts) - c(l.operatingTaxes) - c(l.extraordinary);
    const inssTx = txs.filter((t) => t.type === "despesa" && t.status !== "cancelado" && t.status !== "previsto" && t.category.startsWith("INSS") && competenceOf(t) === m);
    const inss = s.tax.inss.monthly_amount !== null ? c(s.tax.inss.monthly_amount) : inssTx.reduce((acc, t) => acc + c(t.amount), 0);
    const tax = taxes[i];
    const netResult = op - c(tax.totalProvision) - inss;
    const reliable = s.tax.inss.monthly_amount !== null || inssTx.length > 0;
    return {
      month: m,
      gross: l.grossBilled,
      discounts: l.discounts,
      net: r(net),
      variable: l.variableCosts,
      contribution: r(contribution),
      fixed: l.fixedCosts,
      opTaxes: l.operatingTaxes,
      extra: l.extraordinary,
      opResult: r(op),
      opMargin: net > 0 ? op / net : null,
      incomeTax: tax.totalProvision,
      inss: r(inss),
      netResult: r(netResult),
      netMargin: net > 0 ? netResult / net : null,
      netReliable: reliable,
      received: l.received,
      paidOut: l.paidExpenses,
      withdrawals: l.withdrawals,
      investments: l.investments,
      personal: l.personalExpenses,
      sessionsDone: l.sessionsDone,
      absences: l.absences,
      payers: l.payers,
      tax,
    };
  });
}

export type Period = "mensal" | "trimestral" | "anual";

export function periodKey(m: Month, p: Period) {
  if (p === "mensal") return m;
  if (p === "anual") return m.slice(0, 4);
  return `${m.slice(0, 4)}-T${Math.floor((Number(m.slice(5, 7)) - 1) / 3) + 1}`;
}

/** Soma linhas do DRE por trimestre ou ano (margens recalculadas sobre os totais). */
export function aggregateDre(rows: DreRow[], p: Period) {
  if (p === "mensal") return rows.map((x) => ({ key: x.month, ...x }));
  const groups = new Map<string, DreRow[]>();
  for (const row of rows) {
    const k = periodKey(row.month, p);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(row);
  }
  return [...groups.entries()].map(([key, g]) => {
    const s = (f: (x: DreRow) => number) => r(g.reduce((acc, x) => acc + c(f(x)), 0));
    const net = s((x) => x.net);
    const op = s((x) => x.opResult);
    const nr = s((x) => x.netResult);
    return {
      key, ...g[0], month: g[0].month,
      gross: s((x) => x.gross), discounts: s((x) => x.discounts), net, variable: s((x) => x.variable), contribution: s((x) => x.contribution),
      fixed: s((x) => x.fixed), opTaxes: s((x) => x.opTaxes), extra: s((x) => x.extra), opResult: op, opMargin: net > 0 ? op / net : null,
      incomeTax: s((x) => x.incomeTax), inss: s((x) => x.inss), netResult: nr, netMargin: net > 0 ? nr / net : null, netReliable: g.every((x) => x.netReliable),
      received: s((x) => x.received), paidOut: s((x) => x.paidOut), withdrawals: s((x) => x.withdrawals), investments: s((x) => x.investments), personal: s((x) => x.personal),
      sessionsDone: g.reduce((a, x) => a + x.sessionsDone, 0), absences: g.reduce((a, x) => a + x.absences, 0), payers: Math.max(...g.map((x) => x.payers)),
    };
  });
}

/** Margem por tipo de serviço: receita, sessões e custo variável rateado por sessão realizada. */
export function marginByService(txs: Transaction[], months: Month[], ledger: Map<Month, MonthLedger>) {
  const set = new Set(months);
  const rows = new Map<string, { revenue: number; sessions: number; done: number }>();
  for (const t of txs) {
    if (t.type !== "receita" || t.status === "cancelado" || t.status === "previsto" || !set.has(competenceOf(t))) continue;
    const k = t.service_type || t.category || "Outros";
    const row = rows.get(k) ?? { revenue: 0, sessions: 0, done: 0 };
    row.revenue += c(t.amount);
    row.sessions += Number(t.sessions ?? 0);
    row.done += Number(t.sessions_done ?? t.sessions ?? 0);
    rows.set(k, row);
  }
  const varCost = months.reduce((acc, m) => acc + c(monthLedger(ledger, m).variableCosts), 0);
  const totalDone = [...rows.values()].reduce((a, x) => a + x.done, 0);
  const perSession = totalDone ? varCost / totalDone : 0;
  return [...rows.entries()].map(([service, x]) => {
    const variable = Math.round(perSession * x.done);
    return {
      service,
      revenue: r(x.revenue),
      sessions: x.sessions,
      sessionsDone: x.done,
      avgTicket: x.done ? r(Math.round(x.revenue / x.done)) : null,
      variable: r(variable),
      contribution: r(x.revenue - variable),
      margin: x.revenue ? (x.revenue - variable) / x.revenue : null,
    };
  }).sort((a, b) => b.revenue - a.revenue);
}

/** Custo por sessão realizada: variável, total (variável + fixo) e receita média. */
export function costPerSession(rows: DreRow[]) {
  return rows.map((x) => ({
    month: x.month,
    sessionsDone: x.sessionsDone,
    variablePerSession: x.sessionsDone ? r(Math.round(c(x.variable) / x.sessionsDone)) : null,
    totalPerSession: x.sessionsDone ? r(Math.round((c(x.variable) + c(x.fixed) + c(x.opTaxes)) / x.sessionsDone)) : null,
    revenuePerSession: x.sessionsDone ? r(Math.round(c(x.net) / x.sessionsDone)) : null,
  }));
}

/** Inadimplência por faixa de atraso. */
export function agingReport(txs: Transaction[], today: string) {
  const buckets = [
    { key: "a_vencer", label: "A vencer", min: -Infinity, max: 0 },
    { key: "1_30", label: "1 a 30 dias", min: 1, max: 30 },
    { key: "31_60", label: "31 a 60 dias", min: 31, max: 60 },
    { key: "61_90", label: "61 a 90 dias", min: 61, max: 90 },
    { key: "90", label: "Mais de 90 dias", min: 91, max: Infinity },
  ];
  const t0 = Date.parse(today + "T00:00:00Z");
  const out = buckets.map((b) => ({ ...b, total: 0, items: [] as Transaction[] }));
  for (const t of txs.filter(isOpenReceivable)) {
    const days = Math.round((t0 - Date.parse(t.due_date + "T00:00:00Z")) / 86400000);
    const b = out.find((x) => days >= x.min && days <= x.max)!;
    b.total = r(c(b.total) + c(t.amount));
    b.items.push(t);
  }
  return out;
}

/** Orçado (fotografia da projeção salva) × realizado. */
export function budgetVsActual(s: FinanceSettings, rows: DreRow[]) {
  const snap = s.budget_snapshot;
  if (!snap) return null;
  return rows.filter((x) => snap.months[x.month]).map((x) => {
    const b = snap.months[x.month];
    const expenses = r(c(x.variable) + c(x.fixed) + c(x.opTaxes) + c(x.extra));
    return {
      month: x.month,
      revenuePlanned: b.revenue, revenueActual: x.gross, revenueDiff: r(c(x.gross) - c(b.revenue)),
      expensesPlanned: b.expenses, expensesActual: expenses, expensesDiff: r(c(expenses) - c(b.expenses)),
      resultPlanned: b.result, resultActual: x.opResult, resultDiff: r(c(x.opResult) - c(b.result)),
    };
  });
}

/** Cancelamentos e descontos do período. */
export function cancellations(txs: Transaction[], months: Month[]) {
  const set = new Set(months);
  const list = txs.filter((t) => t.type === "receita" && set.has(competenceOf(t)) && (t.status === "cancelado" || discountOf(t) > 0));
  return {
    cancelled: r(list.filter((t) => t.status === "cancelado").reduce((a, t) => a + c(grossOf(t)), 0)),
    discounts: r(list.filter((t) => t.status !== "cancelado").reduce((a, t) => a + c(discountOf(t)), 0)),
    count: list.length,
  };
}

export const monthsWithData = (ledger: Map<Month, MonthLedger>, until: Month) =>
  [...ledger.keys()].filter((m) => m <= until && m !== "0000-00").sort();

