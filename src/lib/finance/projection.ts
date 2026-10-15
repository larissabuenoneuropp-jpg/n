// Projeção mensal de resultado (competência) e caixa, do mês atual até o fim do horizonte.
// Princípios:
//  - Parte do caixa atual (último saldo informado + movimentos depois dele). Nada já pago é descontado de novo.
//  - Receita futura vem dos contratos ativos (sessões/semana × semanas reais do mês × presença), exceto
//    quando o mês daquele contrato já tem lançamento (aí vale o lançamento).
//  - Despesas recorrentes só entram enquanto vigentes e se o mês ainda não tiver o lançamento correspondente.
//  - Imposto do mês é pago no mês seguinte; INSS idem. Reservas e saldo mínimo formam o "piso" do caixa.
//  - Nenhum crescimento automático: novos pacientes só nos cenários que os definem.
import type { FinBalance, FinContract, FinPlan, FinRecurring, FinReserve, PayerKind, Transaction } from "@/lib/types";
import { addMonths, firstDayOf, lastDayOf, monthDiff, monthOf, monthRange, weeksInMonth, workingDays, type Month, type WorkCalendar } from "./calendar";
import { expenseCategory } from "./categories";
import { buildLedger, cashPosition, competenceOf, historyStats, monthLedger, natureOf, type HistoryStats } from "./ledger";
import { fromCents, toCents } from "./money";
import { earmarkedAt, type ReserveBase } from "./reserves";
import type { FinanceSettings, ScenarioKey, ScenarioParams } from "./settings";
import { monthTax, type MonthTaxResult } from "./tax";

export interface FinanceData {
  settings: FinanceSettings;
  transactions: Transaction[];
  contracts: FinContract[];
  recurring: FinRecurring[];
  plans: FinPlan[];
  reserves: FinReserve[];
  balances: FinBalance[];
}

export interface ProjectionOptions {
  scenario: ScenarioKey;
  today: string;
  endMonth?: Month;
  /** Retirada mensal (pró-labore) suposta. Padrão: a planejada nas configurações (ou zero). */
  proLabore?: number;
  /** Saídas extras para simular compras (valor positivo = saída). */
  extraOutflows?: Array<{ month: Month; amount: number; label: string }>;
}

export interface ProjectionMonth {
  month: Month;
  isCurrent: boolean;
  weeks: number;
  workingDays: number;
  activePatients: number;
  plannedSessions: number;
  expectedSessionsDone: number;
  capacitySessions: number;
  occupancy: number | null;
  grossRevenue: number;
  discounts: number;
  netRevenue: number;
  expectedReceipts: number;
  variableCosts: number;
  fixedCosts: number;
  operatingTaxes: number;
  extraordinary: number;
  operatingResult: number;
  operatingMargin: number | null;
  incomeTax: MonthTaxResult;
  inss: number;
  netResult: number;
  netMargin: number | null;
  investments: number;
  proLabore: number;
  reserveEarmarked: number;
  taxesPayableEnd: number;
  minCash: number;
  floor: number;
  inflows: number;
  outflows: number;
  cashStart: number;
  cashEnd: number;
  /** Caixa final − piso (negativo = abaixo do mínimo). */
  headroom: number;
  notes: string[];
}

export interface Projection {
  scenario: ScenarioKey;
  params: ScenarioParams;
  months: ProjectionMonth[];
  cashKnown: boolean;
  cashStart: number;
  attendance: number;
  attendanceSource: string;
  delinquency: number;
  delinquencySource: string;
  minCash: number;
  minCashProvisional: boolean;
  stats: HistoryStats;
  assumptions: string[];
  /** Pendências que tornam a projeção provisória. */
  missing: string[];
  /** Compromissos do mês atual ainda não lançados (usados pelo Orçamento disponível). */
  currentPending: { recurring: number; configCosts: number; inssDue: number; irPrevOutstanding: number; irPrevMonth: string };
}

const c = toCents;
const r = fromCents;

function activeIn(start: string | null | undefined, end: string | null | undefined, m: Month) {
  return (!start || start <= lastDayOf(m)) && (!end || end >= firstDayOf(m));
}

/** Fator de reajuste anual acumulado até o mês m. */
function adjustFactor(rec: FinRecurring, m: Month) {
  if (!rec.adjust_pct || !rec.adjust_month) return 1;
  const startYear = Number(rec.start_date.slice(0, 4));
  let n = 0;
  for (let y = startYear; y <= Number(m.slice(0, 4)); y++) {
    const adj = `${y}-${String(rec.adjust_month).padStart(2, "0")}`;
    if (adj > monthOf(rec.start_date)! && adj <= m) n++;
  }
  return Math.pow(1 + rec.adjust_pct / 100, n);
}

function matchesContract(t: Transaction, k: FinContract) {
  if (t.contract_id) return t.contract_id === k.id;
  if (k.patient_id && t.patient_id) return t.patient_id === k.patient_id;
  return Boolean(t.payer_label && k.label && t.payer_label.trim().toLowerCase() === k.label.trim().toLowerCase());
}

export function workCalendar(s: FinanceSettings): WorkCalendar {
  return {
    weekdays: s.working_weekdays,
    extraHolidays: s.extra_holidays.map((h) => h.date),
    closedPeriods: s.closed_periods.map((p) => ({ start: p.start, end: p.end })),
  };
}

export function contractMonthlyRevenue(k: FinContract, weeks: number, attendance: number, closedFactor = 1) {
  const planned = k.sessions_per_week * weeks;
  const att = k.attendance_rate ?? attendance;
  const done = planned * att;
  const billed = k.charges_absences ? planned : done;
  const revenue = k.billing === "pacote_mensal" ? (k.monthly_amount ?? 0) * closedFactor : billed * k.unit_amount;
  return { planned, done, billed, revenue: r(c(revenue)) };
}

export function project(data: FinanceData, opts: ProjectionOptions): Projection {
  const s = data.settings;
  const sc = s.scenarios[opts.scenario];
  const today = opts.today;
  const current = monthOf(today)!;
  const end = opts.endMonth ?? s.projection_end;
  const months = monthRange(current, monthDiff(current, end) >= 0 ? end : current);
  const cal = workCalendar(s);
  const calNoClosed: WorkCalendar = { ...cal, closedPeriods: [] };
  const txs = data.transactions;
  const ledger = buildLedger(txs, { taxClassOf: (cat) => s.tax.deductibility[cat]?.tax_class ?? expenseCategory(cat).taxClass });
  const stats = historyStats(ledger, txs, current, today);
  const taxClass = (cat: string) => s.tax.deductibility[cat]?.tax_class ?? expenseCategory(cat).taxClass;

  // Presença e inadimplência: configuração > histórico > premissa
  const baseAtt = s.attendance_rate ?? stats.attendanceRate ?? s.attendance_fallback;
  const attendanceSource = s.attendance_rate !== null ? "definida por você" : stats.attendanceRate !== null ? `histórico (${stats.attendanceSample} sessões registradas)` : "premissa provisória (sem histórico suficiente)";
  const attendance = Math.min(1, Math.max(0.3, baseAtt + sc.attendance_delta));
  const delinquency = sc.delinquency ?? s.delinquency_rate ?? stats.delinquencyRate ?? s.delinquency_fallback;
  const delinquencySource = sc.delinquency !== null ? `cenário ${sc.label.toLowerCase()}` : s.delinquency_rate !== null ? "definida por você" : stats.delinquencyRate !== null ? "histórico" : "premissa provisória";
  const keep = 1 - delinquency;

  const pos = cashPosition(data.balances, txs, today);
  const cashKnown = pos.amount !== null;
  const proLabore = opts.proLabore ?? s.pro_labore_planned ?? 0;
  const missing: string[] = [];
  if (!cashKnown) missing.push("Saldo bancário atual (a projeção parte de R$ 0,00)");
  const activeContracts = data.contracts.filter((k) => k.active);
  if (!activeContracts.length) missing.push("Contratos/pacientes ativos (sem eles não há receita futura projetada)");
  if (s.tax.inss.monthly_amount === null) missing.push("Valor do INSS mensal");

  // Fluxos de caixa por mês (centavos)
  const inflow = new Map<Month, number>();
  const outflow = new Map<Month, number>();
  const addIn = (m: Month, v: number) => inflow.set(m, (inflow.get(m) ?? 0) + v);
  const addOut = (m: Month, v: number) => outflow.set(m, (outflow.get(m) ?? 0) + v);
  const clampMonth = (m: Month) => (m < current ? current : m);
  // Recebimentos projetados por tipo de pagador (para o IR por caixa)
  const projRecv = new Map<Month, { pf: number; pj: number; unk: number }>();
  const addRecv = (m: Month, v: number, kind: PayerKind | null | undefined) => {
    const o = projRecv.get(m) ?? { pf: 0, pj: 0, unk: 0 };
    if (kind === "pf") o.pf += v; else if (kind === "pj") o.pj += v; else o.unk += v;
    projRecv.set(m, o);
    addIn(m, v);
  };
  const projDeductible = new Map<Month, number>();
  const projToConfirm = new Map<Month, number>();
  const projInss = new Map<Month, number>();
  const notes = new Map<Month, string[]>();
  const note = (m: Month, t: string) => notes.set(m, [...(notes.get(m) ?? []), t]);

  // 1) Recebíveis já lançados e não pagos (faturados e previstos)
  for (const t of txs) {
    if (t.type !== "receita" || t.paid_at || t.status === "cancelado") continue;
    const due = monthOf(t.due_date)!;
    const m = clampMonth(addMonths(due < current ? current : due, sc.receipt_delay_months));
    addRecv(m, Math.round(c(t.amount) * keep), t.payer_kind);
  }
  // 2) Contas a pagar já lançadas (inclui previstas)
  for (const t of txs) {
    if (t.type === "receita" || t.paid_at || t.status === "cancelado") continue;
    const m = clampMonth(monthOf(t.due_date)!);
    addOut(m, c(t.amount));
    if (t.type === "despesa") {
      const cat = expenseCategory(t.category);
      if (cat.name.startsWith("INSS")) projInss.set(m, (projInss.get(m) ?? 0) + c(t.amount));
      else if (!cat.incomeTax) {
        const tc = t.tax_class ?? taxClass(cat.name);
        if (tc === "dedutivel") projDeductible.set(m, (projDeductible.get(m) ?? 0) + c(t.amount));
        if (tc === "a_confirmar") projToConfirm.set(m, (projToConfirm.get(m) ?? 0) + c(t.amount));
      }
    }
  }

  // Lançamentos por competência para saber o que já está materializado
  const byComp = new Map<Month, Transaction[]>();
  for (const t of txs) {
    if (t.status === "cancelado") continue;
    const m = competenceOf(t);
    if (!byComp.has(m)) byComp.set(m, []);
    byComp.get(m)!.push(t);
  }
  const materialized = (m: Month, category: string, amount: number | null, recurringId?: string) =>
    (byComp.get(m) ?? []).some((t) => t.type === "despesa" && (t.recurring_id ? t.recurring_id === recurringId : t.category === category && (amount === null || Math.abs(t.amount - amount) <= Math.max(1, amount * 0.1))));

  // Contratos removidos no cenário (perda de pacientes): os de maior receita, primeiro (conservador)
  const contractsByValue = [...activeContracts].sort((a, b) => contractMonthlyRevenue(b, 4, 1).revenue - contractMonthlyRevenue(a, 4, 1).revenue);

  const out: ProjectionMonth[] = [];
  const pend = { recurring: 0, configCosts: 0, inssDue: 0, irPrevOutstanding: 0, irPrevMonth: addMonths(current, -1) };
  let cashCents = c(pos.amount ?? 0);
  const avgPrice = activeContracts.length ? activeContracts.reduce((sum, k) => sum + k.unit_amount, 0) / activeContracts.length : s.reference_price;

  // Pré-cálculo de receita/custos por mês (competência), antes do caixa
  interface Pre { m: Month; weeks: number; wd: number; patients: number; planned: number; done: number; capacity: number; gross: number; discounts: number; variable: number; fixed: number; opTaxes: number; extra: number; investments: number; inss: number }
  const pre: Pre[] = [];
  for (const m of months) {
    const weeks = weeksInMonth(m, cal);
    const wd = workingDays(m, cal);
    const wdNoClosed = workingDays(m, calNoClosed);
    const closedFactor = wdNoClosed ? wd / wdNoClosed : 1;
    const capacity = s.capacity_per_week * weeks;
    const elapsed = monthDiff(current, m);
    const priceF = elapsed > 0 ? 1 + sc.price_change_pct / 100 : 1;
    const costF = elapsed > 0 ? 1 + sc.cost_change_pct / 100 : 1;
    const led = monthLedger(ledger, m);
    const compTx = byComp.get(m) ?? [];

    let gross = c(led.grossBilled);
    let discounts = c(led.discounts);
    let planned = 0;
    let done = 0;
    let patients = 0;
    const lost = elapsed > 0 ? Math.floor((sc.lost_patients_per_semester * elapsed) / 6) : 0;
    const lostIds = new Set(contractsByValue.slice(0, lost).map((k) => k.id));
    if (lost) note(m, `Cenário: ${Math.min(lost, contractsByValue.length)} paciente(s) a menos.`);

    // Previstos lançados (competência m) também contam como receita do mês
    for (const t of compTx) if (t.type === "receita" && t.status === "previsto") gross += c(t.amount);

    for (const k of activeContracts) {
      if (!activeIn(k.start_date, k.end_date, m) || lostIds.has(k.id)) continue;
      patients++;
      const est = contractMonthlyRevenue(k, weeks, Math.min(1, Math.max(0.3, (k.attendance_rate ?? baseAtt) + sc.attendance_delta)), closedFactor);
      planned += est.planned;
      const launched = compTx.filter((t) => t.type === "receita" && matchesContract(t, k));
      if (launched.length) {
        // Mês em andamento: as presenças ainda não foram todas marcadas → usa a estimativa se for maior
        const marked = launched.reduce((sum, t) => sum + Number(t.sessions_done ?? t.sessions ?? 0), 0);
        done += m < current ? marked || est.done : Math.max(marked, est.done);
        continue; // receita do mês já lançada: vale o lançamento
      }
      done += est.done;
      const rev = Math.round(c(est.revenue) * priceF);
      gross += rev;
      const recvM = addMonths(m, (k.payment_timing === "mes_seguinte" ? 1 : 0) + sc.receipt_delay_months);
      addRecv(recvM, Math.round(rev * keep), k.payer_kind);
    }
    // Novos pacientes do cenário, limitados à capacidade
    if (elapsed > 0 && sc.new_patients_per_quarter > 0) {
      const newCount = Math.floor((sc.new_patients_per_quarter * elapsed) / 3);
      const room = Math.max(0, capacity - planned);
      const newPlanned = Math.min(room, newCount * sc.sessions_per_new_patient * weeks);
      if (newPlanned > 0) {
        const newDone = newPlanned * attendance;
        const price = s.reference_price * priceF;
        const rev = Math.round(c(newDone * price));
        planned += newPlanned;
        done += newDone;
        patients += Math.min(newCount, Math.ceil(newPlanned / Math.max(1, sc.sessions_per_new_patient * weeks)));
        gross += rev;
        addRecv(addMonths(m, sc.receipt_delay_months), Math.round(rev * keep), "pf");
        note(m, `Cenário: ${newCount} novo(s) paciente(s) a ${price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/sessão${newPlanned < newCount * sc.sessions_per_new_patient * weeks ? " (limitado pela capacidade)" : ""}.`);
      }
    }
    if (planned > capacity) note(m, "Sessões contratadas acima da capacidade configurada.");
    if (wd < wdNoClosed) note(m, `Período sem atendimento: ${wdNoClosed - wd} dia(s) útil(eis) a menos.`);

    // Custos por competência: lançados (não previstos) + previstos lançados + recorrentes ainda não lançados
    let variable = c(led.variableCosts);
    let fixed = c(led.fixedCosts);
    let opTaxes = c(led.operatingTaxes);
    let extra = c(led.extraordinary);
    let investments = c(led.investments);
    for (const t of compTx) {
      if (t.type !== "despesa" || t.status !== "previsto") continue;
      const cat = expenseCategory(t.category);
      if (cat.incomeTax) continue;
      const n = natureOf(t);
      if (n === "variavel") variable += c(t.amount);
      else if (n === "fixo") fixed += c(t.amount);
      else if (n === "tributo") opTaxes += c(t.amount);
      else if (n === "extraordinario") extra += c(t.amount);
      else if (n === "investimento") investments += c(t.amount);
    }
    for (const rec of data.recurring) {
      if (!rec.active || !activeIn(rec.start_date, rec.end_date, m)) continue;
      if (rec.basis === "anual" && Number(m.slice(5, 7)) !== (rec.month_of_year ?? 1)) continue;
      const base = rec.basis === "por_sessao" ? rec.amount * done : rec.amount;
      if (materialized(m, rec.category, rec.basis === "por_sessao" ? null : rec.amount, rec.id)) continue;
      const amt = Math.round(c(base) * adjustFactor(rec, m) * costF);
      if (amt <= 0) continue;
      if (rec.nature === "variavel") variable += amt;
      else if (rec.nature === "fixo") fixed += amt;
      else if (rec.nature === "tributo") opTaxes += amt;
      else if (rec.nature === "extraordinario") extra += amt;
      else if (rec.nature === "investimento") investments += amt;
      // Pagamento no próprio mês
      addOut(m, amt);
      if (m === current) pend.recurring += amt;
      const tc = rec.tax_class;
      if (tc === "dedutivel") projDeductible.set(m, (projDeductible.get(m) ?? 0) + amt);
      if (tc === "a_confirmar") projToConfirm.set(m, (projToConfirm.get(m) ?? 0) + amt);
    }
    // Custos tributários e administrativos das configurações
    const month = Number(m.slice(5, 7));
    const cfgCosts: Array<[string, number | null, boolean, string]> = [
      ["Contabilidade", s.tax.accounting_fee.monthly_amount, true, "fixo"],
      ["Impostos e taxas", month === s.tax.iss.month ? s.tax.iss.annual_amount : 0, true, "tributo"],
      ...s.tax.annual_fees.map((f) => ["Impostos e taxas", month === f.month ? f.amount : 0, true, "tributo"] as [string, number | null, boolean, string]),
    ];
    for (const [cat, amount, deductible, nature] of cfgCosts) {
      if (!amount) continue;
      if (materialized(m, cat, amount)) continue;
      const amt = Math.round(c(amount) * costF);
      if (nature === "fixo") fixed += amt; else opTaxes += amt;
      addOut(m, amt);
      if (m === current) pend.configCosts += amt;
      if (deductible && taxClass(cat) === "dedutivel") projDeductible.set(m, (projDeductible.get(m) ?? 0) + amt);
    }
    // INSS: competência m, pago no mês seguinte (se ainda não lançado)
    const inssTx = compTx.filter((t) => t.type === "despesa" && expenseCategory(t.category).name.startsWith("INSS"));
    let inss = inssTx.reduce((sum, t) => sum + c(t.amount), 0);
    if (s.tax.inss.monthly_amount) {
      if (!inssTx.length) {
        inss = c(s.tax.inss.monthly_amount);
        addOut(addMonths(m, 1), inss);
        if (addMonths(m, 1) === current) pend.inssDue += inss;
        projInss.set(addMonths(m, 1), (projInss.get(addMonths(m, 1)) ?? 0) + inss);
      }
    }
    pre.push({ m, weeks, wd, patients, planned, done, capacity, gross, discounts, variable, fixed, opTaxes, extra, investments, inss });
  }

  // Investimentos aprovados (compras planejadas), parcelados
  for (const p of data.plans) {
    if (p.status !== "aprovado") continue;
    const n = Math.max(1, p.installments || 1);
    const each = Math.floor(c(p.amount) / n);
    for (let i = 0; i < n; i++) {
      const m = clampMonth(addMonths(p.month, i));
      addOut(m, i === n - 1 ? c(p.amount) - each * (n - 1) : each);
      const pr = pre.find((x) => x.m === m);
      if (pr) pr.investments += i === n - 1 ? c(p.amount) - each * (n - 1) : each;
      note(m, `Compra aprovada: ${p.description}${n > 1 ? ` (${i + 1}/${n})` : ""}.`);
    }
  }
  for (const x of opts.extraOutflows ?? []) {
    addOut(clampMonth(x.month), c(x.amount));
    note(clampMonth(x.month), `Simulação: ${x.label}.`);
  }

  // Saldo mínimo: configurado ou provisório (1 mês de custos operacionais projetados)
  const opCostsAvg = pre.slice(0, 3).reduce((sum, p) => sum + p.variable + p.fixed + p.opTaxes, 0) / Math.max(1, Math.min(3, pre.length));
  const minCashProvisional = s.min_cash === null;
  const minCash = s.min_cash ?? r(Math.round(opCostsAvg));
  if (minCashProvisional) missing.push("Saldo mínimo de segurança (usando 1 mês de custos como estimativa)");

  const reserveBase: ReserveBase = {
    avgMonthlyRevenue: stats.avgMonthlyRevenue ?? r(Math.round(pre.slice(0, 3).reduce((sum, p) => sum + p.gross, 0) / Math.max(1, Math.min(3, pre.length)))),
    avgMonthlyFixedCosts: r(Math.round(opCostsAvg)),
  };

  // IR do mês anterior ainda não pago entra como saída no mês atual
  const prev = addMonths(current, -1);
  const prevLed = monthLedger(ledger, prev);
  const prevTax = monthTax({
    month: prev, receivedPF: prevLed.receivedPF, receivedPJ: prevLed.receivedPJ, receivedUnknown: prevLed.receivedUnknown,
    irrfWithheld: prevLed.irrfWithheld, deductibleExpenses: prevLed.paidDeductible, toConfirmExpenses: prevLed.paidToConfirm, inssPaid: prevLed.inssPaid,
  }, s.tax);
  const prevPaid = txs.filter((t) => t.type === "despesa" && t.category === "IRPF — Carnê-Leão" && t.status !== "cancelado" && (competenceOf(t) === prev || (t.paid_at && monthOf(t.paid_at) === current)));
  const prevPaidCents = prevPaid.reduce((sum, t) => sum + c(t.amount), 0);
  const prevOutstanding = Math.max(0, c(prevTax.carneLeao) - prevPaidCents);
  // INSS do mês anterior (pago neste mês), se não lançado
  if (s.tax.inss.monthly_amount && !(byComp.get(prev) ?? []).some((t) => t.type === "despesa" && expenseCategory(t.category).name.startsWith("INSS"))) {
    const v = c(s.tax.inss.monthly_amount);
    addOut(current, v);
    projInss.set(current, (projInss.get(current) ?? 0) + v);
    pend.inssDue += v;
  }
  pend.irPrevOutstanding = prevOutstanding;
  if (prevOutstanding > 0) {
    addOut(current, prevOutstanding);
    note(current, `DARF do Carnê-Leão de ${prev} ainda não registrado como pago.`);
  }

  // Caixa mês a mês
  for (const p of pre) {
    const m = p.m;
    const isCurrent = m === current;
    const led = monthLedger(ledger, m);
    const recv = projRecv.get(m) ?? { pf: 0, pj: 0, unk: 0 };
    const tax = monthTax({
      month: m,
      receivedPF: r(c(isCurrent ? led.receivedPF : 0) + recv.pf),
      receivedPJ: r(c(isCurrent ? led.receivedPJ : 0) + recv.pj),
      receivedUnknown: r(c(isCurrent ? led.receivedUnknown : 0) + recv.unk),
      irrfWithheld: isCurrent ? led.irrfWithheld : 0,
      deductibleExpenses: r(c(isCurrent ? led.paidDeductible : 0) + (projDeductible.get(m) ?? 0)),
      toConfirmExpenses: r(c(isCurrent ? led.paidToConfirm : 0) + (projToConfirm.get(m) ?? 0)),
      inssPaid: r(c(isCurrent ? led.inssPaid : 0) + (projInss.get(m) ?? 0)),
    }, s.tax);
    // IR deste mês é pago no próximo
    addOut(addMonths(m, 1), c(tax.carneLeao));

    let pl = c(proLabore);
    if (isCurrent) pl = Math.max(0, pl - c(led.withdrawalsProLabore));
    addOut(m, pl);

    const inflows = inflow.get(m) ?? 0;
    const outflows = outflow.get(m) ?? 0;
    const cashStart = cashCents;
    cashCents = cashCents + inflows - outflows;

    const net = p.gross - p.discounts;
    const opResult = net - p.variable - p.fixed - p.opTaxes - p.extra;
    const netResult = opResult - c(tax.totalProvision) - p.inss;
    const earmarked = c(earmarkedAt(data.reserves, reserveBase, today, m));
    const taxesPayableEnd = c(tax.carneLeao) + (s.tax.inss.monthly_amount ? c(s.tax.inss.monthly_amount) : 0) + c(tax.annualAdjustmentProvision);
    const floor = c(minCash) + taxesPayableEnd + earmarked;
    out.push({
      month: m,
      isCurrent,
      weeks: p.weeks,
      workingDays: p.wd,
      activePatients: p.patients,
      plannedSessions: Math.round(p.planned * 10) / 10,
      expectedSessionsDone: Math.round(p.done * 10) / 10,
      capacitySessions: Math.round(p.capacity * 10) / 10,
      occupancy: p.capacity > 0 ? p.planned / p.capacity : null,
      grossRevenue: r(p.gross),
      discounts: r(p.discounts),
      netRevenue: r(net),
      expectedReceipts: r(inflows),
      variableCosts: r(p.variable),
      fixedCosts: r(p.fixed),
      operatingTaxes: r(p.opTaxes),
      extraordinary: r(p.extra),
      operatingResult: r(opResult),
      operatingMargin: net > 0 ? opResult / net : null,
      incomeTax: tax,
      inss: r(p.inss),
      netResult: r(netResult),
      netMargin: net > 0 && s.tax.inss.monthly_amount !== null ? netResult / net : null,
      investments: r(p.investments),
      proLabore: r(pl),
      reserveEarmarked: r(earmarked),
      taxesPayableEnd: r(taxesPayableEnd),
      minCash,
      floor: r(floor),
      inflows: r(inflows),
      outflows: r(outflows),
      cashStart: r(cashStart),
      cashEnd: r(cashCents),
      headroom: r(cashCents - floor),
      notes: notes.get(m) ?? [],
    });
  }

  const assumptions = [
    `Presença esperada: ${(attendance * 100).toFixed(0)}% (${attendanceSource}${sc.attendance_delta ? `, ajuste do cenário ${sc.attendance_delta > 0 ? "+" : ""}${(sc.attendance_delta * 100).toFixed(0)} pontos` : ""}).`,
    `Inadimplência: ${(delinquency * 100).toFixed(0)}% (${delinquencySource}).`,
    `Semanas por mês calculadas pelos dias de atendimento reais (feriados nacionais${s.extra_holidays.length ? ", feriados cadastrados" : ""}${s.closed_periods.length ? " e férias" : ""} descontados).`,
    sc.receipt_delay_months ? `Recebimentos ${sc.receipt_delay_months} mês(es) mais tarde.` : "Recebimentos no prazo de cada contrato.",
    `Retirada mensal (pró-labore) considerada: ${proLabore.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
    "IR (Carnê-Leão) calculado por regime de caixa e pago no mês seguinte; INSS pago no mês seguinte.",
  ];
  return {
    scenario: opts.scenario, params: sc, months: out, cashKnown, cashStart: pos.amount ?? 0,
    attendance, attendanceSource, delinquency, delinquencySource, minCash, minCashProvisional, stats, assumptions, missing,
    currentPending: { recurring: r(pend.recurring), configCosts: r(pend.configCosts), inssDue: r(pend.inssDue), irPrevOutstanding: r(pend.irPrevOutstanding), irPrevMonth: pend.irPrevMonth },
  };
}

/** Menor folga (caixa − piso) no horizonte e o mês em que ocorre. */
export function worstMonth(p: Projection, horizon?: number) {
  const ms = horizon ? p.months.slice(0, horizon) : p.months;
  let worst: ProjectionMonth | null = null;
  for (const m of ms) if (!worst || m.headroom < worst.headroom) worst = m;
  return worst;
}
