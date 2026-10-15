// Alertas e recomendações: sempre com os números que os originaram (nada de texto fixo de exemplo).
import { addMonths, lastBusinessDay, monthLabel, monthOf, type Month } from "./calendar";
import { expenseCategory } from "./categories";
import { competenceOf, findDuplicates, isOpenReceivable, type MonthLedger } from "./ledger";
import { fromCents, toCents } from "./money";
import type { FinanceData, Projection } from "./projection";
import type { ProLaboreAnalysis } from "./prolabore";
import type { BudgetResult } from "./budget";
import type { DreRow } from "./reports";
import { missingTaxData } from "./tax";
import { project } from "./projection";

export type AlertLevel = "critico" | "atencao" | "oportunidade" | "info";

export interface FinAlert {
  id: string;
  level: AlertLevel;
  title: string;
  message: string;
  href?: string;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string) => d.split("-").reverse().join("/");

export interface AlertContext {
  data: FinanceData;
  today: string;
  ledger: Map<Month, MonthLedger>;
  closed: DreRow[];
  realistic: Projection;
  conservative: Projection;
  prolabore: ProLaboreAnalysis;
  budget: BudgetResult;
  proLabore: number;
}

export function computeAlerts(ctx: AlertContext): FinAlert[] {
  const { data, today, realistic, conservative, prolabore, budget, closed } = ctx;
  const s = data.settings;
  const txs = data.transactions;
  const current = monthOf(today)!;
  const out: FinAlert[] = [];

  // 1. Caixa projetado abaixo do mínimo
  const below = realistic.months.filter((m) => m.headroom < 0);
  if (below.length) {
    const first = below[0];
    out.push({
      id: "caixa-minimo", level: "critico", title: "Caixa projetado abaixo do mínimo",
      message: `No cenário realista, o caixa de ${monthLabel(first.month)} fica em ${brl(first.cashEnd)}, ${brl(-first.headroom)} abaixo do piso de ${brl(first.floor)} (saldo mínimo + tributos a pagar + reservas). ${below.length} mês(es) afetado(s) até ${monthLabel(realistic.months.at(-1)!.month)}.`,
      href: "/financeiro/fluxo",
    });
  } else {
    const consBelow = conservative.months.filter((m) => m.headroom < 0);
    if (consBelow.length) out.push({ id: "caixa-conservador", level: "atencao", title: "Risco de caixa no cenário conservador", message: `Com menos presença, inadimplência e atrasos, o caixa ficaria abaixo do piso em ${consBelow.slice(0, 4).map((m) => monthLabel(m.month)).join(", ")}${consBelow.length > 4 ? "…" : ""} (pior: ${brl(Math.min(...consBelow.map((m) => m.headroom)))}).`, href: "/financeiro/projecoes" });
  }

  // 2. Risco de faltar dinheiro para tributos
  const taxRisk = realistic.months.find((m) => m.cashEnd < m.taxesPayableEnd);
  if (taxRisk) out.push({ id: "tributos-risco", level: "critico", title: "Risco de faltar dinheiro para tributos", message: `Em ${monthLabel(taxRisk.month)} o caixa projetado (${brl(taxRisk.cashEnd)}) não cobre os tributos a pagar no mês seguinte (${brl(taxRisk.taxesPayableEnd)}).`, href: "/financeiro/tributario" });
  const irPaidYear = txs.some((t) => t.type === "despesa" && t.category === "IRPF — Carnê-Leão" && t.status !== "cancelado" && competenceOf(t).slice(0, 4) === current.slice(0, 4));
  const irDueYear = closed.filter((r) => r.month.slice(0, 4) === current.slice(0, 4)).reduce((a, r) => a + toCents(r.tax.carneLeao), 0);
  if (!irPaidYear && irDueYear > 0) out.push({ id: "carne-nao-pago", level: "atencao", title: "Nenhum pagamento de Carnê-Leão registrado no ano", message: `Pelos recebimentos registrados, o Carnê-Leão estimado de ${current.slice(0, 4)} até o mês passado soma ${brl(fromCents(irDueYear))}. Se esses DARFs não foram pagos, confirme com o contador (pode haver multa e juros). Se foram, registre os pagamentos.`, href: "/financeiro/tributario" });

  // 3. Despesas acima do orçamento por categoria (mês atual, competência)
  const curL = ctx.ledger.get(current);
  for (const [cat, limit] of Object.entries(s.category_budgets)) {
    const spent = curL?.expensesByCategory[cat] ?? 0;
    if (limit > 0 && spent > limit) out.push({ id: `orcamento:${cat}`, level: "atencao", title: `Orçamento estourado: ${cat}`, message: `Gasto de ${brl(spent)} em ${monthLabel(current)}, ${brl(spent - limit)} acima do limite de ${brl(limit)}.`, href: "/financeiro/despesas" });
  }
  if (budget.freeCash !== null && budget.freeCash < 0) out.push({ id: "orcamento-negativo", level: "critico", title: "Sem orçamento livre neste mês", message: `Depois de contas, tributos, pró-labore, reservas e saldo mínimo, faltam ${brl(-budget.freeCash)}. O dinheiro na conta já está comprometido: evite novos gastos.`, href: "/financeiro/orcamento" });

  // 4. Margem caindo
  const withRev = closed.filter((r) => r.net > 0 && r.opMargin !== null);
  if (withRev.length >= 4) {
    const last = withRev.at(-1)!;
    const prev = withRev.slice(-4, -1);
    const avg = prev.reduce((a, r) => a + (r.opMargin ?? 0), 0) / prev.length;
    if ((last.opMargin ?? 0) < avg - 0.1) out.push({ id: "margem-queda", level: "atencao", title: "Margem operacional caiu", message: `Em ${monthLabel(last.month)} a margem foi ${((last.opMargin ?? 0) * 100).toFixed(1)}%, contra média de ${(avg * 100).toFixed(1)}% nos 3 meses anteriores.`, href: "/financeiro/relatorios" });
  }

  // 5. Faturamento abaixo da meta
  if (s.goal_monthly_revenue) {
    const cur = realistic.months[0];
    if (cur && cur.grossRevenue < s.goal_monthly_revenue) out.push({ id: "meta", level: "atencao", title: "Faturamento abaixo da meta", message: `Projeção de ${monthLabel(cur.month)}: ${brl(cur.grossRevenue)}, ${brl(s.goal_monthly_revenue - cur.grossRevenue)} abaixo da meta de ${brl(s.goal_monthly_revenue)}.`, href: "/financeiro/projecoes" });
  }

  // 6. Mais pacientes sem lucro proporcional
  if (closed.length >= 4) {
    const a = closed.at(-4)!;
    const b = closed.at(-1)!;
    if (b.payers > a.payers && b.opResult <= a.opResult) out.push({ id: "crescimento-sem-lucro", level: "atencao", title: "Mais pacientes, sem mais resultado", message: `De ${monthLabel(a.month)} para ${monthLabel(b.month)} os pagadores passaram de ${a.payers} para ${b.payers}, mas o resultado operacional foi de ${brl(a.opResult)} para ${brl(b.opResult)}. Verifique preço, faltas e custos por sessão.`, href: "/financeiro/relatorios" });
  }

  // 7. Recorrentes: fim próximo, possível duplicidade, redução
  const in60 = addMonths(current, 2);
  for (const r of data.recurring.filter((x) => x.active && x.end_date && monthOf(x.end_date)! >= current && monthOf(x.end_date)! <= in60)) {
    out.push({ id: `fim:${r.id}`, level: "oportunidade", title: `${r.description} termina em ${fmtDate(r.end_date!)}`, message: `Libera ${brl(r.amount)} por mês a partir de ${monthLabel(addMonths(monthOf(r.end_date!)!, 1))}. Já considerado nas projeções.`, href: "/financeiro/despesas" });
  }
  const activeRec = data.recurring.filter((x) => x.active);
  const hasSpace = activeRec.some((x) => x.category === "Espaço por atendimento");
  const hasCondo = activeRec.some((x) => x.category === "Condomínio e estrutura" || x.category === "Aluguel");
  if (hasSpace && hasCondo) out.push({ id: "duplicidade-espaco", level: "atencao", title: "Possível cobrança dupla do espaço", message: "Há despesa recorrente por atendimento e também condomínio/aluguel fixo. Confirme se a taxa por atendimento já inclui estrutura, água, energia e internet, para não pagar (nem projetar) duas vezes.", href: "/financeiro/despesas" });
  const dups = findDuplicates(txs.filter((t) => t.type !== "receita" && competenceOf(t) >= addMonths(current, -3)));
  if (dups.length) out.push({ id: "duplicados", level: "atencao", title: `${dups.length} possível(is) lançamento(s) duplicado(s)`, message: `Mesma categoria, valor e mês: ${dups.slice(0, 3).map((g) => `${g[0].category} ${brl(g[0].amount)} (${g.length}×) em ${monthLabel(competenceOf(g[0]))}`).join("; ")}.`, href: "/financeiro/despesas" });
  const personal = txs.filter((t) => t.type === "despesa" && expenseCategory(t.category).nature === "pessoal" && t.status !== "cancelado" && competenceOf(t) >= addMonths(current, -3));
  if (personal.length) out.push({ id: "pessoais", level: "atencao", title: "Gastos pessoais pagos pelo consultório", message: `${personal.length} lançamento(s), ${brl(fromCents(personal.reduce((a, t) => a + toCents(t.amount), 0)))} nos últimos 3 meses. Reclassifique como retirada pessoal para não distorcer o resultado.`, href: "/financeiro/despesas" });
  const subs = activeRec.filter((x) => x.category === "Sistemas, aplicativos e assinaturas" && x.basis === "mensal");
  if (subs.length >= 3) out.push({ id: "assinaturas", level: "oportunidade", title: "Revise as assinaturas", message: `${subs.length} assinaturas ativas somam ${brl(fromCents(subs.reduce((a, x) => a + toCents(x.amount), 0)))} por mês. Cancelar as pouco usadas reduz custo fixo direto.`, href: "/financeiro/despesas" });

  // 8. Compra aprovada não sustentável
  const approved = data.plans.filter((p) => p.status === "aprovado");
  if (approved.length) {
    const consBelow = conservative.months.filter((m) => m.headroom < 0);
    if (consBelow.length) {
      const without = project({ ...data, plans: data.plans.filter((p) => p.status !== "aprovado") }, { scenario: "conservador", today, proLabore: ctx.proLabore });
      if (without.months.filter((m) => m.headroom < 0).length < consBelow.length) out.push({ id: "compra-insustentavel", level: "critico", title: "Compra aprovada compromete o caixa", message: `Com as compras aprovadas (${approved.map((p) => `${p.description} ${brl(p.amount)}`).join(", ")}), o caixa conservador fica abaixo do piso em ${consBelow.length} mês(es), a partir de ${monthLabel(consBelow[0].month)}.`, href: "/financeiro/orcamento" });
    }
  }

  // 9. Pró-labore planejado acima do sustentável
  if (prolabore.plannedExceedsMax && prolabore.planned !== null) out.push({ id: "prolabore", level: "critico", title: "Pró-labore planejado acima da capacidade", message: `Planejado: ${brl(prolabore.planned)} por mês. Máximo sustentável no cenário realista: ${brl(prolabore.maximum.amount)}; recomendado (conservador): ${brl(prolabore.recommended.amount)}.`, href: "/financeiro/pro-labore" });

  // 10. Obrigações próximas do vencimento / vencidas
  const in7 = new Date(today + "T00:00:00Z");
  in7.setUTCDate(in7.getUTCDate() + 7);
  const lim7 = in7.toISOString().slice(0, 10);
  const soon = txs.filter((t) => t.type === "despesa" && !t.paid_at && t.status !== "cancelado" && t.due_date <= lim7);
  const late = soon.filter((t) => t.due_date < today);
  if (late.length) out.push({ id: "contas-atrasadas", level: "critico", title: `${late.length} conta(s) em atraso`, message: `${brl(fromCents(late.reduce((a, t) => a + toCents(t.amount), 0)))} vencido(s): ${late.slice(0, 3).map((t) => `${t.description || t.category} (${fmtDate(t.due_date)})`).join(", ")}.`, href: "/financeiro/despesas" });
  const upcoming = soon.filter((t) => t.due_date >= today);
  if (upcoming.length) out.push({ id: "contas-semana", level: "atencao", title: `${upcoming.length} conta(s) vencem em até 7 dias`, message: upcoming.slice(0, 4).map((t) => `${t.description || t.category}: ${brl(t.amount)} em ${fmtDate(t.due_date)}`).join("; ") + ".", href: "/financeiro/despesas" });
  const pend = realistic.currentPending;
  if (pend.irPrevOutstanding > 0) {
    out.push({ id: "darf", level: "atencao", title: "DARF do Carnê-Leão a pagar", message: `Estimativa referente a ${monthLabel(pend.irPrevMonth)}: ${brl(pend.irPrevOutstanding)}, vencimento usual em ${fmtDate(lastBusinessDay(current))}. Confira no Carnê-Leão Web antes de pagar.`, href: "/financeiro/tributario" });
  }
  const overdueRec = txs.filter((t) => isOpenReceivable(t) && t.due_date < today);
  if (overdueRec.length) out.push({ id: "inadimplencia", level: "atencao", title: `${overdueRec.length} recebimento(s) em atraso`, message: `${brl(fromCents(overdueRec.reduce((a, t) => a + toCents(t.amount), 0)))} vencido(s) e não recebido(s). Veja em Receitas ou em Cobranças.`, href: "/financeiro/receitas?status=atrasado" });

  // 11. Dados faltantes
  const missingTax = missingTaxData(s.tax);
  const missingAll = [...new Set([...realistic.missing, ...missingTax.map((m) => m.label)])];
  if (missingAll.length) out.push({ id: "dados", level: "info", title: "Dados que faltam para números definitivos", message: missingAll.join("; ") + ".", href: "/financeiro/configuracoes" });

  const order: Record<AlertLevel, number> = { critico: 0, atencao: 1, oportunidade: 2, info: 3 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

/** Recomendação objetiva para uma compra extraordinária, com números calculados. */
export function purchaseRecommendation(budget: BudgetResult, conservative: Projection, amount: number) {
  const worst = conservative.months.slice(0, 12).reduce((a, b) => (b.headroom < a.headroom ? b : a), conservative.months[0]);
  const after = worst ? fromCents(toCents(worst.cashEnd) - toCents(amount)) : null;
  return `Com base nos recebimentos confirmados, nas obrigações previstas e no saldo mínimo de caixa, o orçamento disponível para despesas extraordinárias neste mês é de ${brl(budget.limits.investment)}. Uma compra de ${brl(amount)} reduziria o caixa projetado (cenário conservador) para ${after === null ? "—" : brl(after)} em ${worst ? monthLabel(worst.month) : "—"}, o mês mais apertado dos próximos 12.`;
}

