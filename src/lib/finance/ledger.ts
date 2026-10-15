// Razão gerencial: estado de cada lançamento, competência × caixa e agregados mensais.
// Regras centrais:
//  - Faturamento (competência) = serviços prestados/faturados no mês, mesmo que ainda não recebidos.
//  - Recebido (caixa) = dinheiro que entrou no mês (paid_at).
//  - Lançamento "previsto" nunca conta como faturado nem como dinheiro disponível.
//  - "Cancelado" não conta em nada (só aparece no relatório de cancelamentos).
import type { FinBalance, Transaction } from "@/lib/types";
import { expenseCategory } from "./categories";
import { monthOf, type Month } from "./calendar";
import { fromCents, toCents } from "./money";

export type TxState = "previsto" | "aberto" | "atrasado" | "quitado" | "cancelado";

export function txState(t: Pick<Transaction, "status" | "paid_at" | "due_date">, today: string): TxState {
  if (t.status === "cancelado") return "cancelado";
  if (t.paid_at) return "quitado";
  if (t.status === "previsto") return "previsto";
  return t.due_date < today ? "atrasado" : "aberto";
}

export function stateLabel(state: TxState, type: Transaction["type"]) {
  const rec = type === "receita";
  return {
    previsto: { label: "Previsto", tone: "gray" as const },
    aberto: { label: rec ? "A receber" : "A pagar", tone: "amber" as const },
    atrasado: { label: "Atrasado", tone: "red" as const },
    quitado: { label: rec ? "Recebido" : type === "retirada" ? "Retirado" : "Pago", tone: "green" as const },
    cancelado: { label: "Cancelado", tone: "gray" as const },
  }[state];
}

/** Recebível em aberto de verdade (faturado e não pago; exclui previsto e cancelado). */
export const isOpenReceivable = (t: Transaction) => t.type === "receita" && !t.paid_at && t.status !== "previsto" && t.status !== "cancelado";

export function competenceOf(t: Pick<Transaction, "competence" | "service_date" | "due_date">): Month {
  return (t.competence && /^\d{4}-\d{2}$/.test(t.competence) ? t.competence : null) ?? monthOf(t.service_date) ?? monthOf(t.due_date) ?? "0000-00";
}

/** Valor bruto contratado (antes do desconto). */
export function grossOf(t: Transaction): number {
  if (t.unit_amount && t.sessions) return fromCents(toCents(t.unit_amount) * t.sessions);
  return fromCents(toCents(t.amount) + toCents(t.discount));
}

export function discountOf(t: Transaction): number {
  return Math.max(0, fromCents(toCents(grossOf(t)) - toCents(t.amount)));
}

export const natureOf = (t: Transaction) => t.nature ?? expenseCategory(t.category).nature;
export const isIncomeTaxPayment = (t: Transaction) => t.type === "despesa" && Boolean(expenseCategory(t.category).incomeTax);

export interface MonthLedger {
  month: Month;
  // Competência
  grossBilled: number;
  discounts: number;
  cancelled: number;
  netBilled: number;
  expensesByNature: Record<string, number>;
  expensesByCategory: Record<string, number>;
  /** Despesas operacionais por competência (sem IR/INSS da profissional, investimentos e gastos pessoais). */
  operatingExpenses: number;
  variableCosts: number;
  fixedCosts: number;
  extraordinary: number;
  operatingTaxes: number;
  investments: number;
  personalExpenses: number;
  /** IR e INSS pagos (caixa) — no DRE, entram pela provisão calculada, não por estes pagamentos. */
  incomeTaxPaidCash: number;
  // Caixa
  received: number;
  receivedPF: number;
  receivedPJ: number;
  receivedUnknown: number;
  irrfWithheld: number;
  paidExpenses: number;
  paidDeductible: number;
  paidToConfirm: number;
  inssPaid: number;
  withdrawals: number;
  withdrawalsProLabore: number;
  // Atendimentos
  sessionsBilled: number;
  sessionsDone: number;
  absences: number;
  payers: number;
}

export interface LedgerOptions {
  /** Classificação fiscal por categoria vinda das configurações. */
  taxClassOf?: (category: string) => string;
}

export function emptyMonth(month: Month): MonthLedger {
  return {
    month, grossBilled: 0, discounts: 0, cancelled: 0, netBilled: 0, expensesByNature: {}, expensesByCategory: {}, operatingExpenses: 0,
    variableCosts: 0, fixedCosts: 0, extraordinary: 0, operatingTaxes: 0, investments: 0, personalExpenses: 0, incomeTaxPaidCash: 0,
    received: 0, receivedPF: 0, receivedPJ: 0, receivedUnknown: 0, irrfWithheld: 0, paidExpenses: 0, paidDeductible: 0, paidToConfirm: 0,
    inssPaid: 0, withdrawals: 0, withdrawalsProLabore: 0, sessionsBilled: 0, sessionsDone: 0, absences: 0, payers: 0,
  };
}

function add(rec: Record<string, number>, key: string, v: number) {
  rec[key] = fromCents(toCents(rec[key] ?? 0) + toCents(v));
}
const plus = (a: number, b: number) => fromCents(toCents(a) + toCents(b));

/** Agrega todos os lançamentos por mês (competência e caixa). */
export function buildLedger(txs: Transaction[], opts: LedgerOptions = {}): Map<Month, MonthLedger> {
  const map = new Map<Month, MonthLedger>();
  const get = (m: Month) => {
    let r = map.get(m);
    if (!r) map.set(m, (r = emptyMonth(m)));
    return r;
  };
  const payersByMonth = new Map<Month, Set<string>>();
  const taxClassOf = opts.taxClassOf ?? ((c: string) => expenseCategory(c).taxClass);

  for (const t of txs) {
    const comp = competenceOf(t);
    const cash = t.paid_at ? monthOf(t.paid_at) : null;
    if (t.type === "receita") {
      if (t.status === "cancelado") { const c = get(comp); c.cancelled = plus(c.cancelled, grossOf(t)); continue; }
      if (t.status !== "previsto") {
        const c = get(comp);
        c.grossBilled = plus(c.grossBilled, grossOf(t));
        c.discounts = plus(c.discounts, discountOf(t));
        c.netBilled = plus(c.netBilled, t.amount);
        c.sessionsBilled += Number(t.sessions ?? 0);
        c.sessionsDone += Number(t.sessions_done ?? 0);
        c.absences += Number(t.absences ?? 0);
        const who = t.patient_id || t.payer_label || t.contract_id;
        if (who) {
          if (!payersByMonth.has(comp)) payersByMonth.set(comp, new Set());
          payersByMonth.get(comp)!.add(who);
        }
      }
      if (cash) {
        const c = get(cash);
        c.received = plus(c.received, t.amount);
        if (t.payer_kind === "pj") c.receivedPJ = plus(c.receivedPJ, t.amount);
        else if (t.payer_kind === "pf") c.receivedPF = plus(c.receivedPF, t.amount);
        else c.receivedUnknown = plus(c.receivedUnknown, t.amount);
        c.irrfWithheld = plus(c.irrfWithheld, t.irrf_withheld ?? 0);
      }
    } else if (t.type === "despesa") {
      if (t.status === "cancelado") continue;
      const nature = natureOf(t);
      const cat = expenseCategory(t.category);
      if (t.status !== "previsto") {
        const c = get(comp);
        if (cat.incomeTax) {
          // IR/INSS da profissional: fora das despesas operacionais
        } else {
          add(c.expensesByNature, nature, t.amount);
          add(c.expensesByCategory, cat.name, t.amount);
          if (nature === "variavel") c.variableCosts = plus(c.variableCosts, t.amount);
          else if (nature === "fixo") c.fixedCosts = plus(c.fixedCosts, t.amount);
          else if (nature === "extraordinario") c.extraordinary = plus(c.extraordinary, t.amount);
          else if (nature === "tributo") c.operatingTaxes = plus(c.operatingTaxes, t.amount);
          else if (nature === "investimento") c.investments = plus(c.investments, t.amount);
          else if (nature === "pessoal") c.personalExpenses = plus(c.personalExpenses, t.amount);
          if (["variavel", "fixo", "extraordinario", "tributo"].includes(nature)) c.operatingExpenses = plus(c.operatingExpenses, t.amount);
        }
      }
      if (cash) {
        const c = get(cash);
        c.paidExpenses = plus(c.paidExpenses, t.amount);
        if (cat.incomeTax) {
          c.incomeTaxPaidCash = plus(c.incomeTaxPaidCash, t.amount);
          if (cat.name.startsWith("INSS")) c.inssPaid = plus(c.inssPaid, t.amount);
        } else {
          const tc = t.tax_class ?? taxClassOf(cat.name);
          if (tc === "dedutivel") c.paidDeductible = plus(c.paidDeductible, t.amount);
          else if (tc === "a_confirmar") c.paidToConfirm = plus(c.paidToConfirm, t.amount);
        }
      }
    } else if (t.type === "retirada") {
      if (t.status === "cancelado" || !cash) continue;
      const c = get(cash);
      c.withdrawals = plus(c.withdrawals, t.amount);
      if ((t.withdrawal_kind ?? "pro_labore") === "pro_labore") c.withdrawalsProLabore = plus(c.withdrawalsProLabore, t.amount);
    }
  }
  for (const [m, set] of payersByMonth) get(m).payers = set.size;
  return map;
}

export function monthLedger(map: Map<Month, MonthLedger>, m: Month): MonthLedger {
  return map.get(m) ?? emptyMonth(m);
}

/** Recebíveis em aberto (faturados, não pagos) até hoje. */
export function receivables(txs: Transaction[], today: string) {
  const open = txs.filter(isOpenReceivable);
  const overdue = open.filter((t) => t.due_date < today);
  const sum = (l: Transaction[]) => fromCents(l.reduce((s, t) => s + toCents(t.amount), 0));
  return { open, overdue, total: sum(open), overdueTotal: sum(overdue) };
}

/** Contas a pagar em aberto (inclui previstas, que são compromissos esperados). */
export function payables(txs: Transaction[]) {
  return txs.filter((t) => t.type === "despesa" && !t.paid_at && t.status !== "cancelado");
}

export interface CashPosition {
  /** Caixa estimado hoje. null = nenhum saldo informado. */
  amount: number | null;
  baseDate: string | null;
  baseAmount: number | null;
  movementsAfter: number;
  explanation: string;
}

/**
 * Caixa atual = último saldo bancário informado + entradas − saídas pagas DEPOIS da data do saldo.
 * Movimentos até a data do saldo já estão dentro dele (não são descontados de novo).
 */
export function cashPosition(balances: FinBalance[], txs: Transaction[], today: string): CashPosition {
  const valid = balances.filter((b) => b.date <= today);
  if (!valid.length) return { amount: null, baseDate: null, baseAmount: null, movementsAfter: 0, explanation: "Nenhum saldo bancário informado." };
  const byDate = new Map<string, number>();
  for (const b of valid) byDate.set(b.date, (byDate.get(b.date) ?? 0) + toCents(b.amount));
  const baseDate = [...byDate.keys()].sort().at(-1)!;
  // Soma de todas as contas informadas na data mais recente
  const baseCents = byDate.get(baseDate)!;
  let mov = 0;
  for (const t of txs) {
    if (!t.paid_at || t.status === "cancelado" || t.paid_at <= baseDate || t.paid_at > today) continue;
    mov += t.type === "receita" ? toCents(t.amount) : -toCents(t.amount);
  }
  return {
    amount: fromCents(baseCents + mov),
    baseDate,
    baseAmount: fromCents(baseCents),
    movementsAfter: fromCents(mov),
    explanation: `Saldo informado em ${baseDate.split("-").reverse().join("/")} + movimentos pagos/recebidos depois dessa data.`,
  };
}

export interface HistoryStats {
  monthsWithData: number;
  attendanceRate: number | null;
  attendanceSample: number;
  delinquencyRate: number | null;
  avgMonthlyRevenue: number | null;
  avgMonthlyReceived: number | null;
  avgFixedCosts: number | null;
  avgVariablePerSession: number | null;
}

/** Indicadores do histórico (meses fechados anteriores ao mês atual). */
export function historyStats(ledger: Map<Month, MonthLedger>, txs: Transaction[], currentMonth: Month, today: string, lookback = 12): HistoryStats {
  const months = [...ledger.values()].filter((m) => m.month < currentMonth).sort((a, b) => b.month.localeCompare(a.month)).slice(0, lookback);
  const withRevenue = months.filter((m) => m.grossBilled > 0);
  const done = months.reduce((s, m) => s + m.sessionsDone, 0);
  const abs = months.reduce((s, m) => s + m.absences, 0);
  const avg = (vals: number[]) => (vals.length ? fromCents(Math.round(vals.reduce((s, v) => s + toCents(v), 0) / vals.length)) : null);
  // Inadimplência: valor vencido há mais de 30 dias e não recebido ÷ total vencido nos últimos 12 meses
  const limit = new Date(today + "T00:00:00Z");
  limit.setUTCDate(limit.getUTCDate() - 30);
  const cutoff = limit.toISOString().slice(0, 10);
  const yearAgo = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
  const due = txs.filter((t) => t.type === "receita" && t.status !== "previsto" && t.status !== "cancelado" && t.due_date <= cutoff && t.due_date >= yearAgo);
  const dueTotal = due.reduce((s, t) => s + toCents(t.amount), 0);
  const lateTotal = due.filter((t) => !t.paid_at).reduce((s, t) => s + toCents(t.amount), 0);
  const varCosts = months.reduce((s, m) => s + toCents(m.variableCosts), 0);
  return {
    monthsWithData: withRevenue.length,
    attendanceRate: done + abs >= 20 ? done / (done + abs) : null,
    attendanceSample: done + abs,
    delinquencyRate: dueTotal > 0 && due.length >= 5 ? lateTotal / dueTotal : null,
    avgMonthlyRevenue: avg(withRevenue.map((m) => m.grossBilled)),
    avgMonthlyReceived: avg(withRevenue.map((m) => m.received)),
    avgFixedCosts: avg(withRevenue.map((m) => m.fixedCosts + m.operatingTaxes)),
    avgVariablePerSession: done > 0 ? fromCents(Math.round(varCosts / done)) : null,
  };
}

/** Possíveis lançamentos duplicados: mesmo tipo, categoria, valor e mês, descrição igual ou vazia. */
export function findDuplicates(txs: Transaction[]): Transaction[][] {
  const groups = new Map<string, Transaction[]>();
  for (const t of txs) {
    if (t.status === "cancelado") continue;
    const key = [t.type, competenceOf(t), t.category, toCents(t.amount), (t.description ?? "").trim().toLowerCase(), t.patient_id ?? t.payer_label ?? ""].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}
