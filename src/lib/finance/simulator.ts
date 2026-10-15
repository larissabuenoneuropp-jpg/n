// Simulador de crescimento: respostas rápidas sobre sessões, preço, custos e metas.
// Usa as semanas reais dos próximos 12 meses (média), a presença esperada e os custos cadastrados.
import { addMonths, monthRange, weeksInMonth, type Month } from "./calendar";
import { fromCents, toCents } from "./money";
import { workCalendar } from "./projection";
import type { FinanceSettings, TaxSettings } from "./settings";
import { progressiveTax } from "./tax";

export interface SimBase {
  /** Semanas de atendimento por mês (média dos próximos 12 meses). */
  weeksPerMonth: number;
  attendance: number;
  price: number;
  variableCostPerSession: number;
  fixedMonthlyCosts: number;
  capacityPerWeek: number;
  tax: TaxSettings;
  /** Despesas dedutíveis mensais (livro-caixa). */
  deductibleMonthly: number;
}

export function averageWeeks(settings: FinanceSettings, from: Month, months = 12) {
  const cal = workCalendar(settings);
  const list = monthRange(from, addMonths(from, months - 1));
  return list.reduce((s, m) => s + weeksInMonth(m, cal), 0) / list.length;
}

export interface SimResult {
  sessionsPerWeek: number;
  sessionsPerMonth: number;
  sessionsDone: number;
  occupancy: number;
  revenue: number;
  variableCosts: number;
  contribution: number;
  fixedCosts: number;
  operatingResult: number;
  incomeTax: number;
  afterTax: number;
}

/** Resultado mensal médio com N sessões contratadas por semana (receita só das sessões realizadas). */
export function simulateSessions(b: SimBase, sessionsPerWeek: number): SimResult {
  const perMonth = sessionsPerWeek * b.weeksPerMonth;
  const done = perMonth * b.attendance;
  const revenue = fromCents(Math.round(toCents(b.price) * done));
  const variable = fromCents(Math.round(toCents(b.variableCostPerSession) * done));
  const contribution = fromCents(toCents(revenue) - toCents(variable));
  const op = fromCents(toCents(contribution) - toCents(b.fixedMonthlyCosts));
  const base = Math.max(0, revenue - (b.tax.livro_caixa.enabled ? b.deductibleMonthly : 0));
  const ir = progressiveTax(base, b.tax.irpf_brackets).tax;
  return {
    sessionsPerWeek, sessionsPerMonth: perMonth, sessionsDone: done, occupancy: b.capacityPerWeek ? sessionsPerWeek / b.capacityPerWeek : 0,
    revenue, variableCosts: variable, contribution, fixedCosts: b.fixedMonthlyCosts, operatingResult: op, incomeTax: ir, afterTax: fromCents(toCents(op) - toCents(ir)),
  };
}

/** Sessões contratadas por semana necessárias para atingir uma receita mensal. */
export function sessionsForRevenue(b: SimBase, targetRevenue: number) {
  const perDone = b.price * b.weeksPerMonth * b.attendance;
  if (perDone <= 0) return null;
  const spw = targetRevenue / perDone;
  return { sessionsPerWeek: Math.ceil(spw * 10) / 10, sessionsPerMonth: Math.ceil(spw * b.weeksPerMonth), withinCapacity: spw <= b.capacityPerWeek };
}

/** Sessões/semana para atingir um resultado depois do IR (busca incremental de 0,5 em 0,5). */
export function sessionsForNetResult(b: SimBase, targetAfterTax: number) {
  for (let spw = 0; spw <= b.capacityPerWeek * 2; spw += 0.5) {
    if (simulateSessions(b, spw).afterTax >= targetAfterTax) return { sessionsPerWeek: spw, withinCapacity: spw <= b.capacityPerWeek };
  }
  return null;
}

/** Ponto de equilíbrio = custos fixos ÷ margem de contribuição percentual. */
export function breakEven(b: SimBase) {
  if (b.price <= 0) return null;
  const marginPct = (b.price - b.variableCostPerSession) / b.price;
  if (marginPct <= 0) return null;
  const revenue = b.fixedMonthlyCosts / marginPct;
  const sessionsDone = revenue / b.price;
  return {
    marginPct,
    revenue: fromCents(Math.round(toCents(revenue))),
    sessionsPerMonth: Math.ceil(sessionsDone),
    sessionsPerWeek: Math.ceil((sessionsDone / b.attendance / b.weeksPerMonth) * 10) / 10,
  };
}

/** Quanto investir para captar um paciente: contribuição que ele gera no período de retorno desejado. */
export function maxAcquisitionCost(b: SimBase, sessionsPerWeek: number, paybackMonths: number) {
  const perMonth = (b.price - b.variableCostPerSession) * sessionsPerWeek * b.weeksPerMonth * b.attendance;
  return { contributionPerMonth: fromCents(Math.round(toCents(perMonth))), maxCost: fromCents(Math.round(toCents(perMonth * paybackMonths))) };
}

export function compareScenario(b: SimBase, sessionsPerWeek: number, change: Partial<SimBase>) {
  const before = simulateSessions(b, sessionsPerWeek);
  const after = simulateSessions({ ...b, ...change }, sessionsPerWeek);
  return { before, after, delta: fromCents(toCents(after.afterTax) - toCents(before.afterTax)) };
}
