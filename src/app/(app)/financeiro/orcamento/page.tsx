"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select, useToast } from "@/components/ui";
import { Explain, FinLoading, Kpi, MoneyInput, NumTable } from "@/components/finance/kit";
import { useFinance } from "@/lib/finance/use-finance";
import type { FinPlan } from "@/lib/types";
import { firstAffordableMonth, simulatePurchase, type PurchaseSimulation } from "@/lib/finance/budget";
import { maxSustainableWithdrawal } from "@/lib/finance/prolabore";
import { addMonths } from "@/lib/finance/calendar";
import { purchaseRecommendation } from "@/lib/finance/alerts";
import { monthLabel, monthLongLabel } from "@/lib/finance/calendar";
import { EXPENSE_CATEGORIES_FIN } from "@/lib/finance/categories";
import { formatBRL } from "@/lib/finance/money";

const PLAN_STATUS: Record<FinPlan["status"], { label: string; tone: "gray" | "blue" | "green" | "amber" }> = {
  ideia: { label: "Ideia", tone: "gray" },
  aprovado: { label: "Aprovada", tone: "blue" },
  realizado: { label: "Realizada", tone: "green" },
  descartado: { label: "Descartada", tone: "amber" },
};

export default function BudgetPage() {
  const f = useFinance();
  const toast = useToast();
  const [check, setCheck] = useState<{ amount: number | null; kind: "operational" | "investment" | "withdrawal" }>({ amount: null, kind: "operational" });
  const [sim, setSim] = useState<{ description: string; amount: number | null; month: string; installments: number; category: string }>({ description: "", amount: null, month: f.today.slice(0, 7), installments: 1, category: "Equipamentos e mobiliário" });
  const [result, setResult] = useState<(PurchaseSimulation & { first: string | null; proLaboreWith: number; proLaboreWithout: number }) | null>(null);
  const a = f.analysis;
  const plans = useMemo(() => [...f.data.plans].sort((x, y) => x.month.localeCompare(y.month)), [f.data.plans]);
  if (f.loading || !a) return <FinLoading />;
  const b = a.budget;
  const limit = check.kind === "operational" ? b.limits.operational : check.kind === "investment" ? b.limits.investment : b.limits.withdrawal;
  const over = check.amount !== null && check.amount > limit;
  const breaksMin = check.amount !== null && b.freeCash !== null && check.amount > b.freeCash + b.lines.find((l) => l.key === "minimo")!.amount;

  function runSim() {
    if (!sim.amount || sim.amount <= 0) return toast("Informe o valor da compra.", "error");
    const r = simulatePurchase(f.data, f.today, sim.amount, sim.month, sim.installments, a!.proLaboreUsed);
    const n = Math.max(1, sim.installments);
    const extra = Array.from({ length: n }, (_, i) => ({ month: addMonths(sim.month, i), amount: sim.amount! / n, label: "compra simulada" }));
    setResult({
      ...r,
      first: r.sustainable ? sim.month : firstAffordableMonth(f.data, f.today, sim.amount, a!.proLaboreUsed),
      proLaboreWith: maxSustainableWithdrawal(f.data, "conservador", f.today, undefined, extra).amount,
      proLaboreWithout: a!.prolabore.recommended.amount,
    });
  }

  return (
    <>
      <PageHeader title="Orçamento disponível" subtitle={`Quanto posso gastar em ${monthLongLabel(a.currentMonth)} sem comprometer a saúde financeira?`} />

      {b.freeCash === null ? (
        <Card className="mb-4 p-5 text-sm text-ink-soft">Informe o saldo bancário em <a className="text-brand-700 underline" href="/financeiro/fluxo">Fluxo de caixa</a> para calcular o orçamento. Sem ele, qualquer número seria um palpite.</Card>
      ) : b.committedInBank > 0 && (
        <div className="mb-4 rounded-lg border border-line bg-white px-4 py-3 text-sm text-ink-soft">
          Dos <b>{formatBRL(a.cash.amount)}</b> que estão na conta, <b>{formatBRL(b.committedInBank)}</b> já estão comprometidos com contas, tributos, pró-labore, reservas e saldo mínimo — <b>não estão disponíveis para novos gastos</b>.
        </div>
      )}

      <div className="mb-2 grid gap-3 md:grid-cols-3">
        <Kpi emphasis label="1. Limite para despesas operacionais" value={formatBRL(b.limits.operational)} provisional={b.provisional} steps={[b.limitNotes.operational]} />
        <Kpi emphasis label="2. Limite para investimentos extraordinários" value={formatBRL(b.limits.investment)} provisional={b.provisional} steps={[b.limitNotes.investment]} />
        <Kpi emphasis label="3. Limite para retirada pessoal adicional" value={formatBRL(b.limits.withdrawal)} provisional={b.provisional} steps={[b.limitNotes.withdrawal]} />
      </div>
      <p className="mb-6 text-xs text-ink-faint">Os três limites saem do mesmo dinheiro: <b>não podem ser somados</b>. Gastar em um reduz os outros.</p>

      <div className="mb-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Como o caixa livre é calculado" subtitle="Orçamento livre = caixa − compromissos − reservas − saldo mínimo" />
          <NumTable minWidth={520} head={["Item", "Valor"]}
            rows={[
              ...b.lines.map((l) => [<div key={l.key}><p>{l.sign > 0 ? "+" : "−"} {l.label}</p><p className="text-xs text-ink-faint">{l.detail}</p></div>, <span key="v" className={l.sign < 0 ? "text-ink-soft" : ""}>{formatBRL(l.amount)}</span>]),
            ]}
            foot={["= Caixa livre", <span key="f" className={b.freeCash !== null && b.freeCash < 0 ? "text-red-600" : "text-emerald-700"}>{b.freeCash === null ? "—" : formatBRL(b.freeCash)}</span>]} />
          <div className="border-t border-line px-5 py-3 text-xs text-ink-soft">
            Recebimentos <b>apenas previstos</b> (não confirmados) neste mês: {formatBRL(b.expectedOnlyReceipts)} — <b>não entram</b> no orçamento livre até serem confirmados.
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Uma nova despesa cabe?" />
          <div className="space-y-3 p-5">
            <Field label="Tipo"><Select value={check.kind} onChange={(e) => setCheck({ ...check, kind: e.target.value as typeof check.kind })} options={[{ value: "operational", label: "Despesa operacional" }, { value: "investment", label: "Investimento / equipamento" }, { value: "withdrawal", label: "Retirada pessoal adicional" }]} /></Field>
            <Field label="Valor"><MoneyInput value={check.amount} onChange={(v) => setCheck({ ...check, amount: v })} /></Field>
            {check.amount !== null && (
              over ? (
                <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-medium">Ultrapassa o limite em {formatBRL(check.amount - limit)}.</p><p className="text-xs">{breaksMin ? "E compromete o saldo mínimo de segurança." : "Use a simulação abaixo para ver o impacto nos próximos meses."}</p></div></div>
              ) : (
                <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><p>Cabe no limite. Sobram {formatBRL(limit - check.amount)}.</p></div>
              )
            )}
          </div>
        </Card>
      </div>

      <Card className="mb-4" id="simular">
        <CardHeader title="Simular compra de valor elevado" subtitle="Impacto no caixa dos próximos 6 e 12 meses, nos cenários realista e conservador" />
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="Descrição" className="lg:col-span-2"><Input value={sim.description} onChange={(e) => setSim({ ...sim, description: e.target.value })} placeholder="Ex.: computador" /></Field>
          <Field label="Valor total"><MoneyInput value={sim.amount} onChange={(v) => setSim({ ...sim, amount: v })} /></Field>
          <Field label="Mês da compra"><Input type="month" value={sim.month} min={a.currentMonth} onChange={(e) => setSim({ ...sim, month: e.target.value })} /></Field>
          <Field label="Parcelas"><Input type="number" min={1} max={24} value={sim.installments} onChange={(e) => setSim({ ...sim, installments: Math.max(1, Number(e.target.value) || 1) })} /></Field>
          <div className="flex items-end"><Button className="w-full" onClick={runSim}>Simular</Button></div>
        </div>
        {result && (
          <div className="border-t border-line p-5">
            <div className={`mb-3 rounded-lg px-3 py-2 text-sm ${result.sustainable ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{result.verdict}{!result.sustainable && (result.first ? ` Mantendo a retirada atual, o primeiro mês em que cabe no cenário conservador é ${monthLabel(result.first)}.` : ` Mantendo a retirada de ${formatBRL(a.proLaboreUsed)}/mês, não cabe nos próximos 15 meses.`)}</div>
            <p className="mb-3 text-sm">Troca entre compra e retirada: sem a compra, o pró-labore recomendado é <b>{formatBRL(result.proLaboreWithout)}/mês</b>; com a compra, cai para <b>{formatBRL(result.proLaboreWith)}/mês</b> nos próximos 12 meses (diferença de {formatBRL(result.proLaboreWithout - result.proLaboreWith)}/mês).</p>
            <p className="mb-3 text-xs text-ink-soft">{purchaseRecommendation(b, a.projections.conservador, result.amount)}</p>
            <NumTable head={["Cenário", "Menor caixa em 6 meses", "Menor caixa em 12 meses", "Caixa no 6º mês", "Caixa no 12º mês", "Meses abaixo do piso"]}
              rows={result.results.map((r) => [r.label, `${formatBRL(r.minCash6.cash)} (${monthLabel(r.minCash6.month)})`, `${formatBRL(r.minCash12.cash)} (${monthLabel(r.minCash12.month)})`, formatBRL(r.cashIn6), formatBRL(r.cashIn12), r.monthsBelowFloor.length ? <span key="b" className="text-red-600">{r.monthsBelowFloor.map(monthLabel).join(", ")}</span> : "nenhum"])} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={async () => { await f.save("fin_plans", { description: sim.description || "Compra planejada", category: sim.category, amount: result.amount, month: result.month, installments: result.installments, status: "ideia" }); toast("Guardada como ideia de compra"); }}>Guardar como ideia</Button>
              <Button onClick={async () => { if (!result.sustainable && !confirm("A simulação indica risco no cenário conservador. Aprovar mesmo assim?")) return; await f.save("fin_plans", { description: sim.description || "Compra planejada", category: sim.category, amount: result.amount, month: result.month, installments: result.installments, status: "aprovado" }); toast("Compra aprovada — já entra nas projeções"); }}>Aprovar compra</Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Compras e investimentos planejados" subtitle="Só as aprovadas entram nas projeções e no orçamento" />
        {plans.length === 0 ? <EmptyState title="Nenhuma compra planejada" text="Simule uma compra acima e guarde como ideia ou aprove." /> : (
          <NumTable minWidth={720} head={["Descrição", "Mês", "Valor", "Status", ""]}
            rows={plans.map((p) => [
              <div key="d"><p className="font-medium">{p.description}</p><p className="text-xs text-ink-faint">{p.category}{p.installments > 1 ? ` · ${p.installments}x` : ""}</p></div>,
              monthLabel(p.month), formatBRL(p.amount), <Badge key="s" tone={PLAN_STATUS[p.status].tone}>{PLAN_STATUS[p.status].label}</Badge>,
              <div key="a" className="flex justify-end gap-1">
                <Select className="h-8 w-32 text-xs" value={p.status} onChange={async (e) => {
                  const status = e.target.value as FinPlan["status"];
                  await f.save("fin_plans", { id: p.id, status });
                  if (status === "realizado" && confirm("Lançar a despesa correspondente agora (como paga hoje)?")) {
                    await f.save("transactions", { type: "despesa", category: p.category, description: p.description, amount: p.amount, competence: f.today.slice(0, 7), due_date: f.today, paid_at: f.today, status: "faturado", plan_id: p.id, nature: "investimento", tax_class: "investimento" });
                  }
                }} options={Object.entries(PLAN_STATUS).map(([value, s]) => ({ value, label: s.label }))} />
                <Button variant="ghost" size="sm" aria-label="Excluir" onClick={async () => { if (confirm("Excluir este plano?")) await f.remove("fin_plans", p.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>,
            ])} />
        )}
        <div className="border-t border-line px-5 py-3"><Explain steps={[`Categoria padrão: ${EXPENSE_CATEGORIES_FIN.find((c) => c.name === "Equipamentos e mobiliário")?.taxSource}.`, "Ao marcar como realizada, o app oferece lançar a despesa como investimento (não reduz o resultado operacional do mês)."]} /></div>
      </Card>
    </>
  );
}
