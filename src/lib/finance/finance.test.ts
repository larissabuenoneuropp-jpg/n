import { describe, expect, it } from "vitest";
import type { FinBalance, FinContract, FinRecurring, FinReserve, Transaction } from "@/lib/types";
import { easter, lastBusinessDay, monthRange, weeksInMonth, workingDays } from "./calendar";
import { buildLedger, cashPosition, competenceOf, findDuplicates, historyStats, monthLedger, txState } from "./ledger";
import { parseBRNumber, sumMoney, toCents } from "./money";
import { progressiveTax, monthTax, reducerAmount, taxSeries } from "./tax";
import { defaultFinanceSettings, resolveSettings, type FinanceSettings } from "./settings";
import { project, contractMonthlyRevenue, type FinanceData } from "./projection";
import { maxSustainableWithdrawal } from "./prolabore";
import { computeBudget, simulatePurchase } from "./budget";
import { reserveStatus, reserveTarget, suggestAllocation, earmarkedAt } from "./reserves";
import { breakEven, sessionsForRevenue, simulateSessions, type SimBase } from "./simulator";
import { actualDre, aggregateDre, agingReport } from "./reports";
import { analyzeFinance } from "./analyze";

let n = 0;
const id = () => `id-${++n}`;
function tx(p: Partial<Transaction>): Transaction {
  return { id: id(), type: "receita", category: "Sessão avulsa", amount: 0, due_date: "2026-10-10", ...p } as Transaction;
}
function settings(patch: Partial<FinanceSettings> = {}): FinanceSettings {
  return { ...defaultFinanceSettings(), ...patch };
}
function data(p: Partial<FinanceData> = {}): FinanceData {
  return { settings: settings(), transactions: [], contracts: [], recurring: [], plans: [], reserves: [], balances: [], ...p };
}
const contract = (p: Partial<FinContract> = {}): FinContract => ({
  id: id(), label: "P1", service_type: "Sessão avulsa", billing: "por_sessao", sessions_per_week: 2, unit_amount: 200, payer_kind: "pf",
  payment_timing: "mesmo_mes", start_date: "2026-01-01", charges_absences: false, active: true, attendance_rate: 1, ...p,
});
const balance = (date: string, amount: number): FinBalance => ({ id: id(), date, account: "Conta", amount });

describe("dinheiro em centavos", () => {
  it("evita erro de ponto flutuante", () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(toCents(229.5 * 3)).toBe(68850);
    expect(toCents(-1.005)).toBe(-101);
  });
  it("lê números no formato brasileiro", () => {
    expect(parseBRNumber("1.234,56")).toBe(1234.56);
    expect(parseBRNumber("R$ 30,00")).toBe(30);
    expect(parseBRNumber("-1,5")).toBe(-1.5);
    expect(parseBRNumber("(200,00)")).toBe(-200);
    expect(parseBRNumber("1234.56")).toBe(1234.56);
    expect(parseBRNumber("4.500")).toBe(4500);
    expect(parseBRNumber("4.5")).toBe(4.5);
    expect(parseBRNumber("12.500,00")).toBe(12500);
    expect(parseBRNumber("abc")).toBeNull();
  });
});

describe("calendário de atendimento", () => {
  it("calcula a Páscoa", () => {
    expect(easter(2026)).toBe("2026-04-05");
    expect(easter(2027)).toBe("2027-03-28");
  });
  it("conta dias úteis reais, sem supor 4 semanas", () => {
    const cal = { weekdays: [1, 2, 3, 4, 5] };
    expect(workingDays("2026-10", cal)).toBe(21); // 22 dias úteis − 12/10
    expect(weeksInMonth("2026-10", cal)).toBeCloseTo(4.2);
    expect(workingDays("2026-11", cal)).toBe(19); // 21 − 02/11 − 20/11 (15/11 é domingo)
    expect(workingDays("2026-11", { ...cal, closedPeriods: [{ start: "2026-11-23", end: "2026-11-30" }] })).toBe(13);
  });
  it("acha o último dia útil (vencimento do DARF)", () => {
    expect(lastBusinessDay("2026-10")).toBe("2026-10-30");
    expect(lastBusinessDay("2026-11")).toBe("2026-11-30");
  });
});

describe("Carnê-Leão (tabela do arquivo do contador)", () => {
  const s = defaultFinanceSettings().tax;
  it("reproduz o exemplo do simulador do contador: base 4.000 → R$ 224,51", () => {
    expect(progressiveTax(4000, s.irpf_brackets)).toEqual({ rate: 0.225, deduction: 675.49, tax: 224.51 });
  });
  it("isenção e faixas-limite", () => {
    expect(progressiveTax(2428.8, s.irpf_brackets).tax).toBe(0);
    expect(progressiveTax(2826.655, s.irpf_brackets).rate).toBe(0.15); // a planilha não cobria este valor
    expect(progressiveTax(5000, s.irpf_brackets).tax).toBe(466.27);
  });
  it("desconta só despesas dedutíveis pagas (livro-caixa) e mostra o efeito das 'a confirmar'", () => {
    const r = monthTax({ month: "2026-09", receivedPF: 8000, receivedPJ: 0, receivedUnknown: 0, irrfWithheld: 0, deductibleExpenses: 1500, toConfirmExpenses: 1000, inssPaid: 0 }, s);
    expect(r.carneBase).toBe(6500);
    expect(r.carneLeao).toBe(878.77);
    expect(r.potentialSavingIfConfirmed).toBe(275); // 1.000 × 27,5%
    expect(r.dueDate).toBe("2026-10-30");
  });
  it("redutor (desligado por padrão) segue a fórmula da Lei 15.270/2025", () => {
    const red = { ...s.reducer, enabled: true };
    expect(reducerAmount(5000, 466.27, red)).toBe(312.89);
    expect(reducerAmount(6000, 1000, red)).toBe(179.75); // 978,62 − 0,133145 × 6000
    expect(reducerAmount(7350, 1000, red)).toBe(0);
    expect(reducerAmount(4000, 100, red)).toBe(100); // limitado ao imposto
    expect(reducerAmount(5000, 466.27, s.reducer)).toBe(0);
  });
  it("rendimentos de PJ geram provisão para o ajuste anual, descontado o IR retido", () => {
    const r = monthTax({ month: "2026-09", receivedPF: 3000, receivedPJ: 3000, receivedUnknown: 0, irrfWithheld: 100, deductibleExpenses: 0, toConfirmExpenses: 0, inssPaid: 0 }, s);
    // total 6.000 → 1.650 − 908,73 = 741,27; Carnê-Leão sobre 3.000 → 450 − 394,16 = 55,84
    expect(r.carneLeao).toBe(55.84);
    expect(r.annualAdjustmentProvision).toBe(585.43);
    expect(r.totalProvision).toBe(641.27);
  });
  it("compensa excesso de livro-caixa só quando ativado e dentro do ano", () => {
    const on = { ...s, carry_over_excess: { ...s.carry_over_excess, enabled: true } };
    const base = { receivedPJ: 0, receivedUnknown: 0, irrfWithheld: 0, toConfirmExpenses: 0, inssPaid: 0 };
    const res = taxSeries([
      { month: "2026-11", receivedPF: 1000, deductibleExpenses: 2000, ...base },
      { month: "2026-12", receivedPF: 5000, deductibleExpenses: 0, ...base },
      { month: "2027-01", receivedPF: 5000, deductibleExpenses: 0, ...base },
    ], on);
    expect(res[1].carneBase).toBe(4000);
    expect(res[2].carneBase).toBe(5000);
  });
});

describe("razão: competência × caixa", () => {
  const today = "2026-10-15";
  const txs = [
    tx({ amount: 900, service_date: "2026-09-20", due_date: "2026-10-05", paid_at: "2026-10-04", payer_kind: "pf", sessions: 4, sessions_done: 4, unit_amount: 225 }),
    tx({ amount: 500, competence: "2026-10", due_date: "2026-11-10" }),
    tx({ amount: 700, competence: "2026-10", due_date: "2026-11-10", status: "previsto" }),
    tx({ amount: 300, competence: "2026-10", due_date: "2026-10-01", status: "cancelado" }),
    tx({ type: "despesa", category: "Supervisão profissional", amount: 600, due_date: "2026-10-09", paid_at: "2026-10-09" }),
    tx({ type: "despesa", category: "Aluguel", amount: 1000, due_date: "2026-10-05", paid_at: "2026-10-05" }),
    tx({ type: "retirada", category: "Retirada pessoal", amount: 2000, due_date: "2026-10-10", paid_at: "2026-10-10", withdrawal_kind: "pro_labore" }),
  ];
  const l = buildLedger(txs);
  it("faturado por competência não inclui previsto nem cancelado", () => {
    expect(monthLedger(l, "2026-09").grossBilled).toBe(900);
    expect(monthLedger(l, "2026-10").grossBilled).toBe(500);
    expect(monthLedger(l, "2026-10").cancelled).toBe(300);
  });
  it("recebido por caixa usa a data do pagamento", () => {
    expect(monthLedger(l, "2026-10").received).toBe(900);
    expect(monthLedger(l, "2026-10").receivedPF).toBe(900);
    expect(monthLedger(l, "2026-10").paidDeductible).toBe(1000);
    expect(monthLedger(l, "2026-10").paidToConfirm).toBe(600);
  });
  it("retirada não é despesa do consultório", () => {
    expect(monthLedger(l, "2026-10").operatingExpenses).toBe(1600);
    expect(monthLedger(l, "2026-10").withdrawals).toBe(2000);
  });
  it("estados derivados", () => {
    expect(txState(txs[1], today)).toBe("aberto");
    expect(txState({ ...txs[1], due_date: "2026-10-01" }, today)).toBe("atrasado");
    expect(txState(txs[2], today)).toBe("previsto");
    expect(txState(txs[0], today)).toBe("quitado");
    expect(competenceOf(txs[0])).toBe("2026-09");
  });
  it("caixa atual não desconta de novo o que já estava no saldo informado", () => {
    const pos = cashPosition([balance("2026-10-06", 5000)], txs, today);
    // Depois de 06/10: supervisão (−600 em 09/10) e retirada (−2.000 em 10/10). Aluguel e recebimento já estavam no saldo.
    expect(pos.amount).toBe(2400);
    expect(cashPosition([], txs, today).amount).toBeNull();
  });
  it("aponta possíveis duplicados", () => {
    const d = findDuplicates([tx({ type: "despesa", category: "Materiais e instrumentos de avaliação", amount: 86.2, competence: "2026-03" }), tx({ type: "despesa", category: "Materiais e instrumentos de avaliação", amount: 86.2, competence: "2026-03" })]);
    expect(d).toHaveLength(1);
  });
  it("taxa de presença do histórico", () => {
    const hist = [tx({ amount: 1, competence: "2026-08", sessions_done: 34, absences: 6 })];
    const st = historyStats(buildLedger(hist), hist, "2026-10", today);
    expect(st.attendanceRate).toBeCloseTo(0.85);
  });
});

describe("DRE gerencial e margens", () => {
  it("margem operacional = resultado operacional ÷ receita líquida; margem líquida só com INSS informado", () => {
    const s = settings();
    const txs = [
      tx({ amount: 9000, discount: 1000, competence: "2026-09", due_date: "2026-09-30", paid_at: "2026-09-30", payer_kind: "pf" }),
      tx({ type: "despesa", category: "Espaço por atendimento", amount: 1200, competence: "2026-09", due_date: "2026-09-30", paid_at: "2026-09-30" }),
      tx({ type: "despesa", category: "Supervisão profissional", amount: 600, competence: "2026-09", due_date: "2026-09-30", paid_at: "2026-09-30" }),
    ];
    const [row] = actualDre(buildLedger(txs), ["2026-09"], s, txs);
    expect(row.gross).toBe(10000);
    expect(row.net).toBe(9000);
    expect(row.contribution).toBe(7800);
    expect(row.opResult).toBe(7200);
    expect(row.opMargin).toBeCloseTo(0.8);
    expect(row.netReliable).toBe(false);
    // IR: 9.000 recebidos, nenhuma dedutível confirmada → 9.000 × 27,5% − 908,73 = 1.566,27
    expect(row.incomeTax).toBe(1566.27);
    const s2 = resolveSettings({ tax: { ...s.tax, inss: { ...s.tax.inss, monthly_amount: 300 } } });
    const [row2] = actualDre(buildLedger(txs), ["2026-09"], s2, txs);
    expect(row2.netReliable).toBe(true);
    expect(row2.netResult).toBe(7200 - 1566.27 - 300);
    expect(aggregateDre([row2, { ...row2, month: "2026-08" }], "anual")[0].net).toBe(18000);
  });
});

describe("projeção", () => {
  const today = "2026-10-15";
  it("receita do contrato = sessões/semana × semanas reais × valor", () => {
    expect(contractMonthlyRevenue(contract(), 3.8, 1).revenue).toBe(1520);
    expect(contractMonthlyRevenue(contract({ attendance_rate: 0.5 }), 4, 1).revenue).toBe(800);
    expect(contractMonthlyRevenue(contract({ attendance_rate: 0.5, charges_absences: true }), 4, 1).revenue).toBe(1600);
  });
  it("caixa final = inicial + entradas − saídas, e IR do mês é pago no seguinte", () => {
    const d = data({ contracts: [contract({ sessions_per_week: 5, unit_amount: 300 })], balances: [balance("2026-10-15", 10000)] });
    d.settings = settings({ attendance_rate: 1 });
    const p = project(d, { scenario: "realista", today, endMonth: "2026-12", proLabore: 0 });
    const nov = p.months[1];
    expect(nov.grossRevenue).toBe(5 * (19 / 5) * 300); // 5.700
    expect(nov.cashEnd).toBe(Math.round((nov.cashStart + nov.inflows - nov.outflows) * 100) / 100);
    const oct = p.months[0];
    expect(p.months[1].outflows).toBeGreaterThanOrEqual(oct.incomeTax.carneLeao);
    expect(p.months[0].cashStart).toBe(10000);
  });
  it("não conta duas vezes a receita já lançada do contrato no mês", () => {
    const k = contract({ label: "AC-1" });
    const d = data({ contracts: [k], transactions: [tx({ amount: 999, competence: "2026-10", payer_label: "AC-1", due_date: "2026-10-30" })] });
    const p = project(d, { scenario: "realista", today, endMonth: "2026-11", proLabore: 0 });
    expect(p.months[0].grossRevenue).toBe(999);
  });
  it("despesa recorrente para quando o curso termina e não duplica a lançada", () => {
    const rec: FinRecurring = { id: id(), description: "Pós", category: "Cursos e especializações", amount: 199, basis: "mensal", start_date: "2026-01-01", end_date: "2026-11-30", nature: "fixo", tax_class: "a_confirmar", active: true, estimated: false };
    const d = data({ recurring: [rec], transactions: [tx({ type: "despesa", category: "Cursos e especializações", amount: 199, competence: "2026-10", paid_at: "2026-10-06", due_date: "2026-10-06" })] });
    const p = project(d, { scenario: "realista", today, endMonth: "2027-01", proLabore: 0 });
    expect(p.months.map((m) => m.fixedCosts)).toEqual([199, 199, 0, 0]);
  });
  it("cenário otimista respeita a capacidade", () => {
    const d = data({ contracts: [contract({ sessions_per_week: 24 })] });
    d.settings = settings({ scenarios: { ...d.settings.scenarios, otimista: { ...d.settings.scenarios.otimista, new_patients_per_quarter: 30 } } });
    const p = project(d, { scenario: "otimista", today, endMonth: "2027-06", proLabore: 0 });
    for (const m of p.months) expect(m.plannedSessions).toBeLessThanOrEqual(m.capacitySessions + 0.05);
  });
});

describe("pró-labore sustentável", () => {
  const today = "2026-10-15";
  it("é a maior retirada que mantém o caixa acima do piso em todos os meses", () => {
    const d = data({ contracts: [contract({ sessions_per_week: 10, unit_amount: 230 })], balances: [balance("2026-10-15", 8000)] });
    d.settings = settings({ min_cash: 3000, attendance_rate: 0.9 });
    const r = maxSustainableWithdrawal(d, "realista", today, 12);
    expect(r.infeasible).toBe(false);
    expect(r.amount).toBeGreaterThan(0);
    const worst = (w: number) => Math.min(...project(d, { scenario: "realista", today, endMonth: "2027-09", proLabore: w }).months.map((m) => m.headroom));
    expect(worst(r.amount)).toBeGreaterThanOrEqual(0);
    expect(worst(r.amount + 10)).toBeLessThan(0);
    const cons = maxSustainableWithdrawal(d, "conservador", today, 12);
    expect(cons.amount).toBeLessThan(r.amount);
  });
  it("sem receita e com caixa abaixo do mínimo, retirada sustentável é zero", () => {
    const d = data({ balances: [balance("2026-10-15", 100)] });
    d.settings = settings({ min_cash: 1000 });
    const r = maxSustainableWithdrawal(d, "realista", today, 6);
    expect(r.infeasible).toBe(true);
    expect(r.amount).toBe(0);
  });
});

describe("orçamento disponível", () => {
  const today = "2026-10-15";
  it("orçamento livre = soma das linhas e ignora recebimentos só previstos", () => {
    const d = data({
      balances: [balance("2026-10-14", 10000)],
      transactions: [
        tx({ amount: 2000, competence: "2026-10", due_date: "2026-10-20" }),
        tx({ amount: 5000, competence: "2026-10", due_date: "2026-10-25", status: "previsto" }),
        tx({ type: "despesa", category: "Supervisão profissional", amount: 600, competence: "2026-10", due_date: "2026-10-22" }),
      ],
    });
    d.settings = settings({ min_cash: 3000 });
    const cons = project(d, { scenario: "conservador", today, proLabore: 0 });
    const real = project(d, { scenario: "realista", today, proLabore: 0 });
    const b = computeBudget(d, today, 1500, cons, real);
    // 10.000 + 2.000 − 600 − tributos(0) − 1.500 − reservas(0) − 3.000 − investimentos(0)
    expect(b.freeCash).toBe(6900);
    expect(b.confirmedReceipts).toBe(2000);
    expect(b.expectedOnlyReceipts).toBeGreaterThanOrEqual(5000 * 0);
    expect(b.limits.operational).toBe(6900);
    expect(b.limits.withdrawal).toBeLessThanOrEqual(6900);
  });
  it("simula compra e diz se é sustentável", () => {
    const d = data({ balances: [balance("2026-10-15", 5000)], contracts: [contract({ sessions_per_week: 8, unit_amount: 230 })] });
    d.settings = settings({ min_cash: 2000 });
    const small = simulatePurchase(d, today, 500, "2026-10", 1, 0);
    const huge = simulatePurchase(d, today, 500000, "2026-10", 1, 0);
    expect(small.sustainable).toBe(true);
    expect(huge.sustainable).toBe(false);
    expect(huge.results[0].monthsBelowFloor.length).toBeGreaterThan(0);
  });
});

describe("reservas", () => {
  const r = (p: Partial<FinReserve>): FinReserve => ({ id: id(), kind: "emergencia", name: "Emergência", target_mode: "valor", target_value: 6000, priority: 1, movements: [], ...p });
  const base = { avgMonthlyRevenue: 8000, avgMonthlyFixedCosts: 2000 };
  it("metas em valor, % da receita e meses de custos", () => {
    expect(reserveTarget(r({}), base)).toBe(6000);
    expect(reserveTarget(r({ target_mode: "percentual_receita", target_value: 10 }), base)).toBe(800);
    expect(reserveTarget(r({ target_mode: "meses_custos", target_value: 3 }), base)).toBe(6000);
  });
  it("calcula o que falta e distribui por prioridade sem passar do necessário", () => {
    const a = reserveStatus(r({ movements: [{ id: "m", date: "2026-10-01", amount: 1200 }] }), base, "2026-10-15");
    expect(a.gap).toBe(4800);
    expect(a.neededMonthly).toBe(400);
    const b = reserveStatus(r({ name: "Férias", priority: 2, target_value: 1200 }), base, "2026-10-15");
    const alloc = suggestAllocation([b, a], 500);
    expect(alloc.allocations.map((x) => [x.name, x.amount])).toEqual([["Emergência", 400], ["Férias", 100]]);
    expect(alloc.leftover).toBe(0);
  });
  it("saldo separado cresce com aportes até a meta", () => {
    const res = [r({ monthly_contribution: 1000, movements: [{ id: "m", date: "2026-10-01", amount: 5500 }] })];
    expect(earmarkedAt(res, base, "2026-10-15", "2026-10")).toBe(6000);
    expect(earmarkedAt(res, base, "2026-10-15", "2027-03")).toBe(6000);
  });
});

describe("simulador", () => {
  const s = defaultFinanceSettings();
  const b: SimBase = { weeksPerMonth: 4.2, attendance: 0.85, price: 230, variableCostPerSession: 30, fixedMonthlyCosts: 1500, capacityPerWeek: 25, tax: s.tax, deductibleMonthly: 0 };
  it("ponto de equilíbrio = custos fixos ÷ margem de contribuição %", () => {
    const be = breakEven(b)!;
    expect(be.marginPct).toBeCloseTo(200 / 230);
    expect(be.revenue).toBeCloseTo(1725, 0);
  });
  it("faturamento com N sessões e sessões para uma meta", () => {
    const r10 = simulateSessions(b, 10);
    expect(r10.revenue).toBeCloseTo(230 * 10 * 4.2 * 0.85, 2);
    const need = sessionsForRevenue(b, r10.revenue)!;
    expect(need.sessionsPerWeek).toBeCloseTo(10, 1);
  });
});

describe("relatórios e análise completa", () => {
  it("inadimplência por faixa de atraso", () => {
    const a = agingReport([tx({ amount: 100, due_date: "2026-10-01" }), tx({ amount: 50, due_date: "2026-07-01" }), tx({ amount: 70, due_date: "2026-10-20" })], "2026-10-15");
    expect(a.find((x) => x.key === "1_30")!.total).toBe(100);
    expect(a.find((x) => x.key === "90")!.total).toBe(50);
    expect(a.find((x) => x.key === "a_vencer")!.total).toBe(70);
  });
  it("roda a análise completa sem dados (estado vazio) e com dados", () => {
    const empty = analyzeFinance(data(), "2026-10-15");
    expect(empty.budget.freeCash).toBeNull();
    expect(empty.alerts.some((a) => a.id === "dados")).toBe(true);
    const months = monthRange("2026-02", "2026-09");
    const hist = months.map((m) => tx({ amount: 7000, competence: m, due_date: `${m}-28`, paid_at: `${m}-28`, payer_kind: "pf", sessions: 32, sessions_done: 28, absences: 4 }));
    const full = analyzeFinance(data({ transactions: hist, contracts: [contract({ sessions_per_week: 8, unit_amount: 225 })], balances: [balance("2026-10-10", 9000)] }), "2026-10-15");
    expect(full.closed).toHaveLength(8);
    expect(full.stats.attendanceRate).toBeCloseTo(28 / 32);
    expect(full.projections.realista.months.at(-1)!.month).toBe("2027-12");
    expect(full.alerts.some((a) => a.id === "carne-nao-pago")).toBe(true);
  });
});
