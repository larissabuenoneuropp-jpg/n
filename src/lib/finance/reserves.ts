// Contas gerenciais (reservas). O dinheiro continua na conta bancária: a reserva é uma "separação"
// que deixa de contar como disponível. Impostos e capital de giro são calculados automaticamente
// (tributos provisionados e saldo mínimo), para não serem contados duas vezes.
import type { FinReserve, ReserveKind } from "@/lib/types";
import { monthDiff, monthOf, type Month } from "./calendar";
import { fromCents, toCents } from "./money";

export const RESERVE_KIND_LABEL: Record<ReserveKind, string> = {
  emergencia: "Reserva de emergência",
  anuais: "Despesas anuais previsíveis",
  ferias: "Férias e meses de menor faturamento",
  equipamentos: "Equipamentos e melhorias",
  investimentos: "Investimentos no negócio",
  distribuicao: "Retiradas futuras / distribuição",
  outra: "Outra",
};

export function reserveBalance(r: FinReserve, until?: string) {
  return fromCents((r.movements ?? []).filter((m) => !until || m.date <= until).reduce((s, m) => s + toCents(m.amount), 0));
}

export interface ReserveBase {
  /** Receita mensal média (para metas em % da receita). */
  avgMonthlyRevenue: number;
  /** Custos fixos mensais médios (para metas em meses de custos). */
  avgMonthlyFixedCosts: number;
}

export function reserveTarget(r: FinReserve, base: ReserveBase): number {
  if (r.target_mode === "valor") return r.target_value;
  if (r.target_mode === "percentual_receita") return fromCents(Math.round(toCents(base.avgMonthlyRevenue) * (r.target_value / 100)));
  return fromCents(Math.round(toCents(base.avgMonthlyFixedCosts) * r.target_value));
}

export interface ReserveStatus {
  reserve: FinReserve;
  balance: number;
  target: number;
  gap: number;
  progress: number;
  monthsLeft: number | null;
  /** Aporte mensal necessário para chegar à meta na data (ou em 12 meses). */
  neededMonthly: number;
}

export function reserveStatus(r: FinReserve, base: ReserveBase, today: string): ReserveStatus {
  const balance = reserveBalance(r, today);
  const target = reserveTarget(r, base);
  const gap = Math.max(0, fromCents(toCents(target) - toCents(balance)));
  const now = monthOf(today)!;
  const monthsLeft = r.target_date ? Math.max(1, monthDiff(now, monthOf(r.target_date)!)) : null;
  const neededMonthly = gap > 0 ? fromCents(Math.ceil(toCents(gap) / (monthsLeft ?? 12))) : 0;
  return { reserve: r, balance, target, gap, progress: target > 0 ? Math.min(1, balance / target) : 1, monthsLeft, neededMonthly };
}

/**
 * Saldo separado nas reservas no fim do mês m, supondo os aportes mensais planejados até a meta.
 * Usado como "dinheiro comprometido" nas projeções.
 */
export function earmarkedAt(reserves: FinReserve[], base: ReserveBase, today: string, m: Month): number {
  const now = monthOf(today)!;
  const elapsed = Math.max(0, monthDiff(now, m) + 1);
  let total = 0;
  for (const r of reserves) {
    const bal = toCents(reserveBalance(r, today));
    const target = toCents(reserveTarget(r, base));
    const contrib = toCents(r.monthly_contribution ?? 0) * elapsed;
    // Cresce com os aportes planejados até a meta (sem meta: só os aportes)
    const cap = target > 0 ? Math.max(target, bal) : Number.POSITIVE_INFINITY;
    total += Math.min(bal + contrib, cap);
  }
  return fromCents(total);
}

export interface Allocation {
  reserveId: string;
  name: string;
  amount: number;
  reason: string;
}

/**
 * Sugere a divisão de um valor disponível entre as reservas: por prioridade (1 = primeiro),
 * cada uma recebendo no máximo o aporte necessário do mês. Não usa percentuais fixos.
 */
export function suggestAllocation(statuses: ReserveStatus[], available: number): { allocations: Allocation[]; leftover: number } {
  let left = toCents(Math.max(0, available));
  const allocations: Allocation[] = [];
  for (const st of [...statuses].sort((a, b) => a.reserve.priority - b.reserve.priority)) {
    if (left <= 0) break;
    if (st.gap <= 0) continue;
    const want = toCents(Math.min(st.gap, Math.max(st.neededMonthly, 0)));
    const give = Math.min(left, want);
    if (give <= 0) continue;
    left -= give;
    allocations.push({
      reserveId: st.reserve.id,
      name: st.reserve.name,
      amount: fromCents(give),
      reason: `Prioridade ${st.reserve.priority}; faltam ${fromCents(toCents(st.gap)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}${st.monthsLeft ? ` em ${st.monthsLeft} mês(es)` : " (meta em 12 meses)"}.`,
    });
  }
  return { allocations, leftover: fromCents(left) };
}
