// Configurações do módulo financeiro. Cada regra carrega sua fonte e situação, para que a tela
// "Configuração contábil e tributária" mostre de onde veio cada número e o que falta confirmar.
import type { TaxClass } from "@/lib/types";
import { EXPENSE_CATEGORIES_FIN } from "./categories";

export type RuleStatus = "extraido_arquivo" | "confirmado" | "a_confirmar" | "premissa" | "faltante";

export interface RuleMeta {
  source: string;
  status: RuleStatus;
  valid_from?: string | null;
  valid_to?: string | null;
  notes?: string;
}

export interface IrpfBracket {
  /** Limite superior da faixa (null = sem limite). */
  up_to: number | null;
  rate: number;
  deduction: number;
}

export type ScenarioKey = "conservador" | "realista" | "otimista";

export interface ScenarioParams {
  label: string;
  /** Variação da taxa de presença em pontos (ex.: −0,10 = 10 pontos a menos). */
  attendance_delta: number;
  /** Inadimplência (0–1). null = usa a do histórico (ou a premissa geral). */
  delinquency: number | null;
  /** Atraso extra dos recebimentos, em meses. */
  receipt_delay_months: number;
  /** Reajuste de preço aplicado a partir do mês seguinte (%). */
  price_change_pct: number;
  /** Variação dos custos (%). */
  cost_change_pct: number;
  /** Novos pacientes por trimestre (limitado pela capacidade). */
  new_patients_per_quarter: number;
  /** Pacientes perdidos por semestre. */
  lost_patients_per_semester: number;
  /** Sessões/semana de cada novo paciente. */
  sessions_per_new_patient: number;
  meta: RuleMeta;
}

export interface FinanceSettings {
  version: 1;
  capacity_per_week: number;
  capacity_meta: RuleMeta;
  session_minutes: number;
  reference_price: number;
  reference_price_meta: RuleMeta;
  /** Dias de atendimento (0 = domingo … 6 = sábado). */
  working_weekdays: number[];
  extra_holidays: Array<{ date: string; label: string }>;
  closed_periods: Array<{ id: string; start: string; end: string; label: string }>;
  /** Presença esperada (0–1). null = usa o histórico; sem histórico, a premissa abaixo. */
  attendance_rate: number | null;
  attendance_fallback: number;
  /** Inadimplência esperada (0–1). null = usa o histórico; sem histórico, a premissa abaixo. */
  delinquency_rate: number | null;
  delinquency_fallback: number;
  /** Saldo mínimo de segurança (capital de giro). null = não informado → estimativa provisória. */
  min_cash: number | null;
  goal_monthly_revenue: number | null;
  /** Pró-labore (retirada mensal) que você planeja fazer. */
  pro_labore_planned: number | null;
  /** Meses usados para testar a sustentabilidade do pró-labore. */
  prolabore_horizon_months: number;
  projection_end: string;
  scenarios: Record<ScenarioKey, ScenarioParams>;
  /** Limite mensal por categoria de despesa (para o comparativo orçado × realizado). */
  category_budgets: Record<string, number>;
  budget_snapshot?: { created_at: string; scenario: ScenarioKey; months: Record<string, { revenue: number; expenses: number; result: number }> } | null;
  /** Mostra pagadores pelo identificador anônimo, nunca pelo nome do paciente. */
  anonymize: boolean;
  tax: TaxSettings;
}

export interface TaxSettings {
  regime: "pf_carne_leao";
  regime_meta: RuleMeta;
  irpf_brackets: IrpfBracket[];
  irpf_meta: RuleMeta;
  reducer: { enabled: boolean; full_until: number; max_reduction: number; a: number; b: number; until: number; meta: RuleMeta };
  livro_caixa: { enabled: boolean; meta: RuleMeta };
  carry_over_excess: { enabled: boolean; meta: RuleMeta };
  deduct_inss: { enabled: boolean; meta: RuleMeta };
  dependents: { count: number; amount_each: number | null; meta: RuleMeta };
  /** Recebimentos de pagador "a confirmar" entram no Carnê-Leão (conservador) até você confirmar. */
  unknown_payer_as_pf: boolean;
  inss: { monthly_amount: number | null; due_day: number; meta: RuleMeta };
  iss: { annual_amount: number | null; month: number; meta: RuleMeta };
  accounting_fee: { monthly_amount: number | null; meta: RuleMeta };
  annual_fees: Array<{ id: string; label: string; amount: number | null; month: number; meta: RuleMeta }>;
  /** Classificação fiscal por categoria (sobrescreve o padrão). */
  deductibility: Record<string, { tax_class: TaxClass; meta: RuleMeta }>;
  /** Cenário de comparação: pessoa jurídica. Nenhum valor vem do arquivo do contador. */
  pj: {
    das_rate: number | null;
    pro_labore: number | null;
    inss_rate_on_pro_labore: number | null;
    accounting_fee_monthly: number | null;
    other_monthly_costs: number | null;
    opening_costs: number | null;
    meta: RuleMeta;
  };
}

const ARQ = "Planilha do contador: SIMULADOR CARNÊ LEÃO – aba única \"Simulador\"";

export const DEFAULT_SCENARIOS: Record<ScenarioKey, ScenarioParams> = {
  conservador: {
    label: "Conservador",
    attendance_delta: -0.1,
    delinquency: 0.1,
    receipt_delay_months: 1,
    price_change_pct: 0,
    cost_change_pct: 5,
    new_patients_per_quarter: 0,
    lost_patients_per_semester: 1,
    sessions_per_new_patient: 1,
    meta: { source: "Hipótese do aplicativo — ajuste", status: "premissa", notes: "Presença 10 pontos menor, 10% de inadimplência, recebimentos 1 mês mais tarde, custos +5% e perda de 1 paciente por semestre." },
  },
  realista: {
    label: "Realista",
    attendance_delta: 0,
    delinquency: null,
    receipt_delay_months: 0,
    price_change_pct: 0,
    cost_change_pct: 0,
    new_patients_per_quarter: 0,
    lost_patients_per_semester: 0,
    sessions_per_new_patient: 1,
    meta: { source: "Contratos ativos + histórico registrado", status: "premissa", notes: "Sem crescimento automático: só os contratos cadastrados, com a presença e a inadimplência observadas." },
  },
  otimista: {
    label: "Otimista",
    attendance_delta: 0.03,
    delinquency: 0,
    receipt_delay_months: 0,
    price_change_pct: 0,
    cost_change_pct: 0,
    new_patients_per_quarter: 2,
    lost_patients_per_semester: 0,
    sessions_per_new_patient: 1,
    meta: { source: "Hipótese do aplicativo — ajuste", status: "premissa", notes: "2 novos pacientes por trimestre (1 sessão/semana cada), sempre limitado à capacidade de atendimento." },
  },
};

export function defaultTaxSettings(): TaxSettings {
  const deductibility: TaxSettings["deductibility"] = {};
  for (const c of EXPENSE_CATEGORIES_FIN) {
    deductibility[c.name] = {
      tax_class: c.taxClass,
      meta: { source: c.taxSource, status: c.taxClass === "a_confirmar" ? "a_confirmar" : c.taxSource.startsWith("Arquivo do contador") ? "extraido_arquivo" : "premissa" },
    };
  }
  return {
    regime: "pf_carne_leao",
    regime_meta: { source: `${ARQ} (o arquivo é um simulador de Carnê-Leão: pessoa física)`, status: "extraido_arquivo", notes: "Confirmar se a atividade é exercida como pessoa física (autônoma) ou se há CNPJ." },
    irpf_brackets: [
      { up_to: 2428.8, rate: 0, deduction: 0 },
      { up_to: 2826.65, rate: 0.075, deduction: 182.16 },
      { up_to: 3751.05, rate: 0.15, deduction: 394.16 },
      { up_to: 4664.68, rate: 0.225, deduction: 675.49 },
      { up_to: null, rate: 0.275, deduction: 908.73 },
    ],
    irpf_meta: { source: `${ARQ}, células E5:G9 e fórmula C7`, status: "extraido_arquivo", valid_from: "2025-05-01", notes: "Confere com a tabela mensal vigente desde maio/2025 segundo fontes secundárias (out/2026). Confirmar na Receita Federal." },
    reducer: {
      enabled: false,
      full_until: 5000,
      max_reduction: 312.89,
      a: 978.62,
      b: 0.133145,
      until: 7350,
      meta: {
        source: "Lei 15.270/2025 (redução do IR mensal a partir de jan/2026) — NÃO consta no arquivo do contador",
        status: "a_confirmar",
        valid_from: "2026-01-01",
        notes: "Fontes divergem sobre a aplicação no Carnê-Leão mensal ou só no ajuste anual. Desligado = provisiona mais imposto (conservador).",
      },
    },
    livro_caixa: { enabled: true, meta: { source: `${ARQ}, dedução "Livro Caixa" (E14) e lista de despesas dedutíveis`, status: "extraido_arquivo", notes: "Só despesas classificadas como dedutíveis, pagas no mês (regime de caixa)." } },
    carry_over_excess: { enabled: false, meta: { source: "Não consta no arquivo do contador", status: "a_confirmar", notes: "Excesso de despesas do livro-caixa compensado nos meses seguintes do mesmo ano. Desligado = conservador." } },
    deduct_inss: { enabled: false, meta: { source: "Não consta no arquivo do contador (regra geral do IRPF)", status: "a_confirmar", notes: "Dedução da contribuição previdenciária oficial na base do Carnê-Leão. Desligado = conservador." } },
    dependents: { count: 0, amount_each: null, meta: { source: `${ARQ}, "Dependente" = 0 (F13)`, status: "extraido_arquivo", notes: "O valor da dedução por dependente não consta no arquivo." } },
    unknown_payer_as_pf: true,
    inss: { monthly_amount: null, due_day: 15, meta: { source: "Não consta no arquivo do contador", status: "faltante", notes: "Informe o valor mensal da guia (GPS/DARF) que você paga como contribuinte individual, ou 0 se não contribui." } },
    iss: { annual_amount: null, month: 3, meta: { source: `${ARQ}: "ISS Fixo" citado como dedutível, sem valor`, status: "faltante", notes: "Informe o valor anual e o mês de pagamento do ISS fixo do seu município." } },
    accounting_fee: { monthly_amount: null, meta: { source: "Não consta no arquivo do contador", status: "faltante", notes: "Honorários mensais do contador (0 se não houver)." } },
    annual_fees: [
      { id: "vigilancia", label: "Vigilância sanitária / alvará", amount: null, month: 3, meta: { source: `${ARQ}: citado como dedutível, sem valor`, status: "faltante" } },
      { id: "conselho", label: "Conselho / associação profissional", amount: null, month: 3, meta: { source: `${ARQ}: "Conselho Regional" citado como dedutível, sem valor`, status: "faltante" } },
    ],
    deductibility,
    pj: {
      das_rate: null,
      pro_labore: null,
      inss_rate_on_pro_labore: null,
      accounting_fee_monthly: null,
      other_monthly_costs: null,
      opening_costs: null,
      meta: { source: "Nenhum dado de pessoa jurídica no arquivo do contador", status: "faltante", notes: "Preencha com valores informados pelo contador para a sua atividade (anexo/alíquota, pró-labore mínimo, honorários)." },
    },
  };
}

export function defaultFinanceSettings(): FinanceSettings {
  return {
    version: 1,
    capacity_per_week: 25,
    capacity_meta: { source: "Informado por você (briefing)", status: "premissa" },
    session_minutes: 45,
    reference_price: 230,
    reference_price_meta: { source: "Informado por você (briefing): sessão avulsa", status: "premissa", notes: "Contratos reais têm valores diferentes; a projeção usa o valor de cada contrato." },
    working_weekdays: [1, 2, 3, 4, 5],
    extra_holidays: [],
    closed_periods: [],
    attendance_rate: null,
    attendance_fallback: 0.85,
    delinquency_rate: null,
    delinquency_fallback: 0.02,
    min_cash: null,
    goal_monthly_revenue: null,
    pro_labore_planned: null,
    prolabore_horizon_months: 12,
    projection_end: "2027-12",
    scenarios: DEFAULT_SCENARIOS,
    category_budgets: {},
    budget_snapshot: null,
    anonymize: true,
    tax: defaultTaxSettings(),
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Completa configurações salvas com os padrões (campos novos aparecem sem apagar os seus). */
function deepMerge<T>(base: T, saved: unknown): T {
  if (!isObj(base) || !isObj(saved)) return (saved === undefined ? base : (saved as T));
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(saved)) {
    const b = (base as Record<string, unknown>)[k];
    out[k] = isObj(b) && isObj(v) ? deepMerge(b, v) : v === undefined ? b : v;
  }
  return out as T;
}

export function resolveSettings(saved: Partial<FinanceSettings> | null | undefined): FinanceSettings {
  return deepMerge(defaultFinanceSettings(), saved ?? {});
}

export const RULE_STATUS_LABEL: Record<RuleStatus, { label: string; tone: "green" | "blue" | "amber" | "gray" | "red" }> = {
  confirmado: { label: "Confirmado", tone: "green" },
  extraido_arquivo: { label: "Extraído do arquivo do contador", tone: "blue" },
  a_confirmar: { label: "Confirmar com o contador", tone: "amber" },
  premissa: { label: "Premissa editável", tone: "gray" },
  faltante: { label: "Dado faltante", tone: "red" },
};
