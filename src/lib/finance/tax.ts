// Imposto de renda da pessoa física autônoma (Carnê-Leão), por regime de caixa, conforme a
// tabela e as deduções extraídas do arquivo do contador. Cálculo gerencial: não substitui a
// apuração oficial do Carnê-Leão Web nem o contador.
import type { Month } from "./calendar";
import { addMonths, lastBusinessDay } from "./calendar";
import { fromCents, toCents } from "./money";
import type { IrpfBracket, TaxSettings } from "./settings";

export interface BracketResult {
  rate: number;
  deduction: number;
  tax: number;
}

/** Imposto pela tabela progressiva: base × alíquota − parcela a deduzir (nunca negativo). */
export function progressiveTax(base: number, brackets: IrpfBracket[]): BracketResult {
  const b = Math.max(0, base);
  const sorted = [...brackets].sort((x, y) => (x.up_to ?? Infinity) - (y.up_to ?? Infinity));
  const row = sorted.find((r) => r.up_to === null || b <= r.up_to + 1e-9) ?? sorted[sorted.length - 1];
  const tax = Math.max(0, fromCents(Math.round(toCents(b) * row.rate) - toCents(row.deduction)));
  return { rate: row.rate, deduction: row.deduction, tax };
}

/** Redutor mensal (Lei 15.270/2025), aplicado sobre os rendimentos tributáveis do mês. */
export function reducerAmount(income: number, tax: number, r: TaxSettings["reducer"]): number {
  if (!r.enabled || tax <= 0) return 0;
  let red = 0;
  if (income <= r.full_until) red = r.max_reduction;
  else if (income <= r.until) red = Math.max(0, r.a - r.b * income);
  return Math.min(tax, fromCents(toCents(red)));
}

export interface MonthTaxInput {
  month: Month;
  /** Recebido de pessoas físicas no mês (caixa). */
  receivedPF: number;
  /** Recebido de pessoas jurídicas no mês (caixa). */
  receivedPJ: number;
  /** Recebido com pagador "a confirmar". */
  receivedUnknown: number;
  irrfWithheld: number;
  /** Despesas dedutíveis (livro-caixa) pagas no mês. */
  deductibleExpenses: number;
  /** Despesas "a confirmar" pagas no mês (para mostrar o efeito se forem confirmadas). */
  toConfirmExpenses: number;
  /** INSS pago no mês (para a dedução, se ativada). */
  inssPaid: number;
  /** Excesso de livro-caixa vindo de meses anteriores do mesmo ano. */
  carryIn?: number;
}

export interface MonthTaxResult {
  month: Month;
  carneBaseIncome: number;
  /** Rendimentos de pessoa jurídica no mês (fora do Carnê-Leão). */
  pjIncome: number;
  deductions: { livroCaixa: number; inss: number; dependents: number; carryIn: number };
  carneBase: number;
  carneBracket: BracketResult;
  reducer: number;
  /** DARF do Carnê-Leão estimado (rendimentos de pessoa física). */
  carneLeao: number;
  dueDate: string;
  /** Provisão adicional para o ajuste anual (rendimentos de PJ, descontado o IR retido). */
  annualAdjustmentProvision: number;
  /** Total a separar para IR referente a este mês. */
  totalProvision: number;
  carryOut: number;
  /** Quanto o imposto cairia se as despesas "a confirmar" fossem dedutíveis. */
  potentialSavingIfConfirmed: number;
  steps: string[];
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function monthTax(input: MonthTaxInput, s: TaxSettings): MonthTaxResult {
  const steps: string[] = [];
  const pfIncome = fromCents(toCents(input.receivedPF) + (s.unknown_payer_as_pf ? toCents(input.receivedUnknown) : 0));
  const pjIncome = fromCents(toCents(input.receivedPJ) + (s.unknown_payer_as_pf ? 0 : toCents(input.receivedUnknown)));
  const livro = s.livro_caixa.enabled ? input.deductibleExpenses : 0;
  const inss = s.deduct_inss.enabled ? input.inssPaid : 0;
  const deps = s.dependents.amount_each ? fromCents(toCents(s.dependents.amount_each) * s.dependents.count) : 0;
  const carryIn = s.carry_over_excess.enabled ? input.carryIn ?? 0 : 0;
  const totalDed = toCents(livro) + toCents(inss) + toCents(deps) + toCents(carryIn);

  const rawBase = toCents(pfIncome) - totalDed;
  const carryOut = s.carry_over_excess.enabled && rawBase < 0 ? fromCents(-rawBase) : 0;
  const carneBase = fromCents(Math.max(0, rawBase));
  const bracket = progressiveTax(carneBase, s.irpf_brackets);
  const red = reducerAmount(pfIncome, bracket.tax, s.reducer);
  const carne = fromCents(toCents(bracket.tax) - toCents(red));

  steps.push(`Rendimentos de pessoa física recebidos no mês: ${brl(pfIncome)}${s.unknown_payer_as_pf && input.receivedUnknown ? ` (inclui ${brl(input.receivedUnknown)} com pagador a confirmar)` : ""}.`);
  if (livro) steps.push(`(−) Livro-caixa: despesas dedutíveis pagas no mês: ${brl(livro)}.`);
  if (inss) steps.push(`(−) INSS pago no mês: ${brl(inss)}.`);
  if (deps) steps.push(`(−) Dependentes: ${brl(deps)}.`);
  if (carryIn) steps.push(`(−) Excesso de livro-caixa de meses anteriores: ${brl(carryIn)}.`);
  steps.push(`= Base do Carnê-Leão: ${brl(carneBase)} → alíquota ${(bracket.rate * 100).toLocaleString("pt-BR")}% − parcela ${brl(bracket.deduction)} = ${brl(bracket.tax)}.`);
  if (red) steps.push(`(−) Redutor (Lei 15.270/2025, a confirmar): ${brl(red)}.`);

  // Ajuste anual: imposto sobre todos os rendimentos do mês − Carnê-Leão − IR retido (estimativa conservadora)
  let annual = 0;
  if (pjIncome > 0) {
    const allBase = fromCents(Math.max(0, toCents(pfIncome) + toCents(pjIncome) - totalDed));
    const all = progressiveTax(allBase, s.irpf_brackets);
    const allRed = reducerAmount(fromCents(toCents(pfIncome) + toCents(pjIncome)), all.tax, s.reducer);
    annual = Math.max(0, fromCents(toCents(all.tax) - toCents(allRed) - toCents(carne) - toCents(input.irrfWithheld)));
    steps.push(`Rendimentos de pessoa jurídica: ${brl(pjIncome)} (IR retido informado: ${brl(input.irrfWithheld)}). Provisão estimada para o ajuste anual: ${brl(annual)}.`);
  }

  // Economia potencial se as despesas "a confirmar" forem dedutíveis
  let saving = 0;
  if (s.livro_caixa.enabled && input.toConfirmExpenses > 0) {
    const alt = progressiveTax(fromCents(Math.max(0, rawBase - toCents(input.toConfirmExpenses))), s.irpf_brackets);
    const altRed = reducerAmount(pfIncome, alt.tax, s.reducer);
    saving = Math.max(0, fromCents(toCents(carne) - (toCents(alt.tax) - toCents(altRed))));
  }

  const dueDate = lastBusinessDay(addMonths(input.month, 1));
  steps.push(`DARF do Carnê-Leão estimado: ${brl(carne)}, vencimento usual no último dia útil do mês seguinte (${dueDate.split("-").reverse().join("/")}).`);
  return {
    month: input.month,
    carneBaseIncome: pfIncome,
    pjIncome,
    deductions: { livroCaixa: livro, inss, dependents: deps, carryIn },
    carneBase,
    carneBracket: bracket,
    reducer: red,
    carneLeao: carne,
    dueDate,
    annualAdjustmentProvision: annual,
    totalProvision: fromCents(toCents(carne) + toCents(annual)),
    carryOut,
    potentialSavingIfConfirmed: saving,
    steps,
  };
}

/** Calcula vários meses em sequência (o excesso de livro-caixa só passa dentro do mesmo ano). */
export function taxSeries(inputs: MonthTaxInput[], s: TaxSettings): MonthTaxResult[] {
  const out: MonthTaxResult[] = [];
  let carry = 0;
  let year = "";
  for (const i of [...inputs].sort((a, b) => a.month.localeCompare(b.month))) {
    if (i.month.slice(0, 4) !== year) { year = i.month.slice(0, 4); carry = 0; }
    const r = monthTax({ ...i, carryIn: carry }, s);
    carry = r.carryOut;
    out.push(r);
  }
  return out;
}

export interface MissingItem {
  key: string;
  label: string;
  impact: string;
}

/** Dados essenciais ainda não informados (afetam lucro líquido, pró-labore e orçamento). */
export function missingTaxData(s: TaxSettings): MissingItem[] {
  const out: MissingItem[] = [];
  if (s.inss.monthly_amount === null) out.push({ key: "inss", label: "INSS mensal (contribuinte individual)", impact: "Lucro líquido e pró-labore ficam provisórios." });
  if (s.iss.annual_amount === null) out.push({ key: "iss", label: "ISS fixo anual", impact: "Custos anuais incompletos." });
  if (s.accounting_fee.monthly_amount === null) out.push({ key: "contabilidade", label: "Honorários do contador", impact: "Custos fixos incompletos." });
  for (const f of s.annual_fees) if (f.amount === null) out.push({ key: `taxa:${f.id}`, label: f.label, impact: "Custos anuais incompletos." });
  return out;
}
