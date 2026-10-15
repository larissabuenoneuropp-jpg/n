// Pró-labore sustentável: em vez de um percentual do faturamento, procura a MAIOR retirada mensal
// constante que mantém o caixa projetado acima do piso (saldo mínimo + tributos a pagar + reservas)
// em todos os meses do horizonte. O recomendado usa o cenário conservador; o máximo, o realista.
import { addMonths, monthOf } from "./calendar";
import { buildLedger, monthLedger } from "./ledger";
import { fromCents, toCents } from "./money";
import { project, worstMonth, type FinanceData, type Projection, type ProjectionMonth } from "./projection";
import type { ScenarioKey } from "./settings";

export interface SustainableResult {
  scenario: ScenarioKey;
  /** Maior retirada mensal constante dentro das premissas (múltiplo de R$ 10). */
  amount: number;
  /** Mês que limita o valor (onde a folga zera). */
  bindingMonth: ProjectionMonth | null;
  /** Mesmo sem retirada o caixa fica abaixo do piso em algum mês. */
  infeasible: boolean;
  projection: Projection;
}

/** Busca binária: a folga do caixa só diminui quando a retirada aumenta. */
export function maxSustainableWithdrawal(data: FinanceData, scenario: ScenarioKey, today: string, horizon = data.settings.prolabore_horizon_months, extraOutflows?: Array<{ month: string; amount: number; label: string }>): SustainableResult {
  const endMonth = addMonths(monthOf(today)!, Math.max(1, horizon) - 1);
  const run = (w: number) => project(data, { scenario, today, endMonth, proLabore: w, extraOutflows });
  const ok = (p: Projection) => (worstMonth(p)?.headroom ?? 0) >= 0;

  const zero = run(0);
  if (!ok(zero)) return { scenario, amount: 0, bindingMonth: worstMonth(zero), infeasible: true, projection: zero };
  let lo = 0;
  let hi = 1000; // R$ 10.000 em passos de R$ 10
  while (ok(run(hi * 10)) && hi < 100000) { lo = hi; hi *= 2; }
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (ok(run(mid * 10))) lo = mid; else hi = mid;
  }
  const best = run(lo * 10);
  return { scenario, amount: lo * 10, bindingMonth: worstMonth(best), infeasible: false, projection: best };
}

export interface ProLaboreAnalysis {
  recommended: SustainableResult;
  maximum: SustainableResult;
  planned: number | null;
  withdrawnThisMonth: number;
  /** Quanto ainda pode ser transferido neste mês. */
  availableNow: number;
  availableExplanation: string[];
  plannedExceedsMax: boolean;
  provisional: boolean;
  missing: string[];
  explanation: string[];
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function analyzeProLabore(data: FinanceData, today: string, freeCashNow: number | null): ProLaboreAnalysis {
  const recommended = maxSustainableWithdrawal(data, "conservador", today);
  const maximum = maxSustainableWithdrawal(data, "realista", today);
  const current = monthOf(today)!;
  const led = monthLedger(buildLedger(data.transactions), current);
  const withdrawn = led.withdrawalsProLabore;
  const planned = data.settings.pro_labore_planned;
  const target = planned ?? recommended.amount;
  const missing = [...new Set([...recommended.projection.missing, ...maximum.projection.missing])];
  const provisional = missing.length > 0;

  const remainingPlan = Math.max(0, fromCents(toCents(Math.min(target, recommended.amount)) - toCents(withdrawn)));
  const availableNow = freeCashNow === null ? 0 : Math.max(0, Math.min(remainingPlan, fromCents(toCents(freeCashNow) + toCents(remainingPlan))));
  const availableExplanation = [
    `Referência do mês: ${brl(Math.min(target, recommended.amount))} (${planned !== null ? "o menor entre o planejado e o recomendado" : "o recomendado"}).`,
    `Já retirado neste mês: ${brl(withdrawn)}.`,
    freeCashNow === null
      ? "Sem saldo bancário informado não é possível confirmar o caixa: informe o saldo para liberar a retirada."
      : `Caixa livre agora (depois de contas, tributos, reservas e saldo mínimo, já contando esta retirada): ${brl(freeCashNow)}.`,
  ];

  const lim = (r: SustainableResult) =>
    r.infeasible
      ? `No cenário ${r.projection.params.label.toLowerCase()}, mesmo sem retirada o caixa fica abaixo do piso em ${r.bindingMonth?.month ?? "algum mês"} (falta ${brl(-(r.bindingMonth?.headroom ?? 0))}).`
      : `No cenário ${r.projection.params.label.toLowerCase()}, retirar ${brl(r.amount)} por mês mantém o caixa acima do piso em todos os ${r.projection.months.length} meses; o mês mais apertado é ${r.bindingMonth?.month} (folga de ${brl(r.bindingMonth?.headroom ?? 0)}).`;

  const explanation = [
    "O valor não é um percentual do faturamento: é a maior retirada mensal constante que mantém o caixa projetado acima do piso (saldo mínimo + impostos a pagar + reservas) em todos os meses do horizonte.",
    lim(recommended),
    lim(maximum),
    `Base: caixa atual ${recommended.projection.cashKnown ? brl(recommended.projection.cashStart) : "não informado (R$ 0,00)"}; saldo mínimo ${brl(recommended.projection.minCash)}${recommended.projection.minCashProvisional ? " (provisório)" : ""}; ${data.contracts.filter((k) => k.active).length} contrato(s) ativo(s).`,
    "Na pessoa física (Carnê-Leão) não há separação legal entre pró-labore e lucro: tudo é rendimento seu, já tributado no Carnê-Leão. A separação aqui é gerencial, para proteger o caixa do consultório.",
  ];
  return {
    recommended, maximum, planned, withdrawnThisMonth: withdrawn, availableNow, availableExplanation,
    plannedExceedsMax: planned !== null && planned > maximum.amount, provisional, missing, explanation,
  };
}
