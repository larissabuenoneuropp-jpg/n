// Orçamento disponível: "quanto posso gastar neste mês sem comprometer o caixa?"
// Orçamento livre = caixa atual + recebimentos CONFIRMADOS do mês − contas a pagar − tributos −
// pró-labore restante − reservas separadas − saldo mínimo − investimentos aprovados.
// Recebimentos apenas previstos aparecem à parte e NÃO entram no orçamento livre.
// O caixa atual já desconta tudo o que foi pago até hoje: nada é descontado duas vezes.
import type { Transaction } from "@/lib/types";
import { addMonths, lastDayOf, monthLabel, monthOf } from "./calendar";
import { expenseCategory } from "./categories";
import { buildLedger, cashPosition, monthLedger, type CashPosition } from "./ledger";
import { fromCents, toCents } from "./money";
import { project, worstMonth, type FinanceData, type Projection } from "./projection";
import { reserveBalance } from "./reserves";
import type { ScenarioKey } from "./settings";
import { monthTax } from "./tax";

export interface BudgetLine {
  key: string;
  label: string;
  amount: number;
  sign: 1 | -1 | 0;
  detail: string;
}

export interface BudgetResult {
  month: string;
  cash: CashPosition;
  lines: BudgetLine[];
  confirmedReceipts: number;
  expectedOnlyReceipts: number;
  freeCash: number | null;
  limits: {
    operational: number;
    investment: number;
    withdrawal: number;
  };
  limitNotes: { operational: string; investment: string; withdrawal: string };
  committedInBank: number;
  provisional: boolean;
  missing: string[];
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const sum = (l: Transaction[]) => fromCents(l.reduce((s, t) => s + toCents(t.amount), 0));

export function computeBudget(data: FinanceData, today: string, proLaboreRemaining: number, conservative: Projection, realistic: Projection): BudgetResult {
  const s = data.settings;
  const month = monthOf(today)!;
  const end = lastDayOf(month);
  const txs = data.transactions;
  const cash = cashPosition(data.balances, txs, today);
  const ledger = buildLedger(txs, { taxClassOf: (cat) => s.tax.deductibility[cat]?.tax_class ?? expenseCategory(cat).taxClass });
  const led = monthLedger(ledger, month);

  // Recebimentos confirmados: faturados, não pagos, vencendo até o fim do mês e com atraso de até 60 dias
  const d60 = new Date(today + "T00:00:00Z");
  d60.setUTCDate(d60.getUTCDate() - 60);
  const cut60 = d60.toISOString().slice(0, 10);
  const open = txs.filter((t) => t.type === "receita" && !t.paid_at && t.status !== "cancelado");
  const confirmed = open.filter((t) => t.status !== "previsto" && t.due_date <= end && t.due_date >= cut60);
  const expectedOnly = open.filter((t) => t.status === "previsto" && t.due_date <= end);
  const contractEstimate = realistic.months[0] ? Math.max(0, fromCents(toCents(realistic.months[0].expectedReceipts) - toCents(sum(confirmed)) - toCents(sum(expectedOnly)))) : 0;

  const payables = txs.filter((t) => t.type === "despesa" && !t.paid_at && t.status !== "cancelado" && t.due_date <= end && !expenseCategory(t.category).incomeTax);
  const taxBills = txs.filter((t) => t.type === "despesa" && !t.paid_at && t.status !== "cancelado" && t.due_date <= end && expenseCategory(t.category).incomeTax);
  const pend = realistic.currentPending;

  // IR sobre o que JÁ entrou neste mês (será pago no mês que vem, mas o dinheiro já não é livre)
  const irNow = monthTax({
    month, receivedPF: led.receivedPF, receivedPJ: led.receivedPJ, receivedUnknown: led.receivedUnknown, irrfWithheld: led.irrfWithheld,
    deductibleExpenses: led.paidDeductible, toConfirmExpenses: led.paidToConfirm, inssPaid: led.inssPaid,
  }, s.tax);

  const userReserves = data.reserves.reduce((acc, r) => acc + toCents(reserveBalance(r, today)), 0);
  const equipReserves = data.reserves.filter((r) => r.kind === "equipamentos" || r.kind === "investimentos").reduce((acc, r) => acc + toCents(reserveBalance(r, today)), 0);
  const approved = data.plans.filter((p) => p.status === "aprovado" && p.month <= month);
  const approvedAmt = approved.reduce((acc, p) => {
    const n = Math.max(1, p.installments || 1);
    // Parcelas até o mês atual
    let due = 0;
    for (let i = 0; i < n; i++) if (addMonths(p.month, i) <= month) due += Math.round(toCents(p.amount) / n);
    return acc + due;
  }, 0);

  const minCash = conservative.minCash;
  const lines: BudgetLine[] = [
    { key: "saldo", label: "Caixa atual", amount: cash.amount ?? 0, sign: 1, detail: cash.amount === null ? "Nenhum saldo bancário informado — informe em Fluxo de caixa." : cash.explanation },
    { key: "receber", label: "Recebimentos confirmados até o fim do mês", amount: sum(confirmed), sign: 1, detail: `${confirmed.length} cobrança(s) faturada(s) e não paga(s), com vencimento até ${end.split("-").reverse().join("/")} (atrasos acima de 60 dias não entram).` },
    { key: "pagar", label: "Contas a pagar até o fim do mês", amount: fromCents(toCents(sum(payables)) + toCents(pend.recurring) + toCents(pend.configCosts)), sign: -1, detail: `${payables.length} conta(s) lançada(s) + ${brl(pend.recurring)} de despesas recorrentes ainda não lançadas + ${brl(pend.configCosts)} de custos configurados (contador, taxas).` },
    { key: "tributos", label: "Tributos provisionados", amount: fromCents(toCents(sum(taxBills)) + toCents(pend.irPrevOutstanding) + toCents(pend.inssDue) + toCents(irNow.totalProvision)), sign: -1, detail: `DARF de ${pend.irPrevMonth} não pago: ${brl(pend.irPrevOutstanding)}; INSS a pagar: ${brl(pend.inssDue)}; IR sobre o que já entrou neste mês: ${brl(irNow.totalProvision)}; guias lançadas: ${brl(sum(taxBills))}.` },
    { key: "prolabore", label: "Pró-labore restante do mês", amount: proLaboreRemaining, sign: -1, detail: "Retirada planejada (ou recomendada) ainda não feita neste mês." },
    { key: "reservas", label: "Reservas separadas", amount: fromCents(userReserves), sign: -1, detail: "Soma das contas gerenciais (emergência, férias, equipamentos…). Impostos e capital de giro estão nas linhas próprias." },
    { key: "minimo", label: "Saldo mínimo de segurança (capital de giro)", amount: minCash, sign: -1, detail: conservative.minCashProvisional ? "Provisório: 1 mês de custos operacionais. Defina o seu em Configurações." : "Definido por você." },
    { key: "investimentos", label: "Investimentos já aprovados", amount: fromCents(approvedAmt), sign: -1, detail: `${approved.length} compra(s) aprovada(s) com parcela até este mês.` },
  ];
  const freeCents = lines.reduce((acc, l) => acc + l.sign * toCents(l.amount), 0);
  const freeCash = cash.amount === null ? null : fromCents(freeCents);

  // Folga mínima projetada no cenário conservador (12 meses), já com o pró-labore planejado
  const worst12 = worstMonth(conservative, 12);
  const headroom = Math.max(0, worst12?.headroom ?? 0);
  const free = Math.max(0, freeCash ?? 0);
  const operational = free;
  const investment = Math.max(0, Math.min(fromCents(toCents(free) + equipReserves), fromCents(toCents(headroom) + equipReserves)));
  const withdrawal = Math.max(0, Math.min(free, headroom));

  const missing = [...conservative.missing];
  return {
    month,
    cash,
    lines,
    confirmedReceipts: sum(confirmed),
    expectedOnlyReceipts: fromCents(toCents(sum(expectedOnly)) + toCents(contractEstimate)),
    freeCash,
    limits: { operational, investment, withdrawal },
    limitNotes: {
      operational: freeCash === null ? "Informe o saldo bancário para calcular." : `Caixa livre após todos os compromissos do mês${freeCash < 0 ? ` — está negativo em ${brl(-freeCash)}: não há espaço para novos gastos` : ""}.`,
      investment: `Menor entre o caixa livre e a menor folga projetada nos próximos 12 meses no cenário conservador (${brl(headroom)}${worst12 ? `, em ${worst12.month}` : ""}), somando ${brl(fromCents(equipReserves))} já reservados para equipamentos/investimentos. A folga já desconta o pró-labore usado nas projeções (${brl(conservative.months[1]?.proLabore ?? conservative.months[0]?.proLabore ?? 0)}/mês): para abrir espaço para uma compra maior, cada R$ 1.000,00 exige reduzir a retirada em cerca de ${brl(1000 / Math.max(1, (worst12 ? conservative.months.indexOf(worst12) : 11) + 1))}/mês até ${worst12?.month ?? "o mês mais apertado"} — ou usar a simulação de compra.`,
      withdrawal: `Retirada além do pró-labore planejado: menor entre o caixa livre e a folga conservadora de 12 meses. Na pessoa física não há restrição legal, mas o valor sai da proteção do caixa.`,
    },
    committedInBank: cash.amount === null ? 0 : Math.max(0, fromCents(toCents(cash.amount) - Math.max(0, freeCents))),
    provisional: missing.length > 0 || freeCash === null,
    missing,
  };
}

export interface PurchaseSimulation {
  amount: number;
  month: string;
  installments: number;
  results: Array<{
    scenario: ScenarioKey;
    label: string;
    minCash6: { month: string; cash: number; headroom: number };
    minCash12: { month: string; cash: number; headroom: number };
    cashIn6: number;
    cashIn12: number;
    monthsBelowFloor: string[];
  }>;
  sustainable: boolean;
  verdict: string;
}

/** Simula o impacto de uma compra no caixa dos próximos 6 e 12 meses (realista e conservador). */
export function simulatePurchase(data: FinanceData, today: string, amount: number, month: string, installments = 1, proLabore?: number): PurchaseSimulation {
  const n = Math.max(1, installments);
  const each = Math.floor(toCents(amount) / n);
  const extra = Array.from({ length: n }, (_, i) => ({ month: addMonths(month, i), amount: fromCents(i === n - 1 ? toCents(amount) - each * (n - 1) : each), label: `compra simulada ${n > 1 ? `${i + 1}/${n}` : ""}`.trim() }));
  const endMonth = addMonths(monthOf(today)!, 11);
  const results = (["realista", "conservador"] as ScenarioKey[]).map((sc) => {
    const p = project(data, { scenario: sc, today, endMonth, extraOutflows: extra, proLabore });
    const pick = (k: number) => {
      const ms = p.months.slice(0, k);
      const w = ms.reduce((a, b) => (b.cashEnd < a.cashEnd ? b : a), ms[0]);
      return { month: w.month, cash: w.cashEnd, headroom: Math.min(...ms.map((x) => x.headroom)) };
    };
    return {
      scenario: sc,
      label: p.params.label,
      minCash6: pick(6),
      minCash12: pick(12),
      cashIn6: p.months[Math.min(5, p.months.length - 1)].cashEnd,
      cashIn12: p.months[Math.min(11, p.months.length - 1)].cashEnd,
      monthsBelowFloor: p.months.filter((x) => x.headroom < 0).map((x) => x.month),
    };
  });
  const cons = results.find((r) => r.scenario === "conservador")!;
  const real = results.find((r) => r.scenario === "realista")!;
  const sustainable = cons.monthsBelowFloor.length === 0;
  const verdict = sustainable
    ? `Sustentável: mesmo no cenário conservador o caixa fica acima do piso nos próximos 12 meses (menor folga ${brl(cons.minCash12.headroom)} em ${monthLabel(cons.minCash12.month)}).`
    : real.monthsBelowFloor.length === 0
      ? `Arriscado: no cenário realista cabe, mas no conservador o caixa fica abaixo do piso em ${cons.monthsBelowFloor.map(monthLabel).join(", ")}. Considere adiar, parcelar, reduzir a retirada ou juntar na reserva de equipamentos.`
      : `Não sustentável com a retirada atual: mesmo no cenário realista o caixa fica abaixo do piso em ${real.monthsBelowFloor.map(monthLabel).join(", ")}.`;
  return { amount, month, installments: n, results, sustainable, verdict };
}

/** Primeiro mês (a partir do atual) em que a compra fica sustentável no cenário conservador. */
export function firstAffordableMonth(data: FinanceData, today: string, amount: number, proLabore?: number, maxMonths = 15): string | null {
  const start = monthOf(today)!;
  for (let i = 0; i < maxMonths; i++) {
    const m = addMonths(start, i);
    const p = project(data, { scenario: "conservador", today, endMonth: addMonths(m, 11), extraOutflows: [{ month: m, amount, label: "compra" }], proLabore });
    if (p.months.every((x) => x.headroom >= 0)) return m;
  }
  return null;
}
