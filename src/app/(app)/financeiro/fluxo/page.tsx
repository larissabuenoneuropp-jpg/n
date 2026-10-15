"use client";
import Link from "next/link";
import { useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Segmented, useToast } from "@/components/ui";
import { Explain, FinChart, FinLoading, Kpi, MoneyInput, NumTable } from "@/components/finance/kit";
import { useFinance } from "@/lib/finance/use-finance";
import { monthLabel } from "@/lib/finance/calendar";
import { formatBRL } from "@/lib/finance/money";
import type { ScenarioKey } from "@/lib/finance/settings";

export default function CashFlowPage() {
  const f = useFinance();
  const toast = useToast();
  const [scenario, setScenario] = useState<ScenarioKey>("realista");
  const [bal, setBal] = useState<{ date: string; account: string; amount: number | null }>({ date: f.today, account: "Conta principal", amount: null });
  const a = f.analysis;
  if (f.loading || !a) return <FinLoading />;
  const p = a.projections[scenario];
  const realized = a.dre.slice(-12);

  async function addBalance() {
    if (bal.amount === null || !bal.date) return toast("Informe data e valor do saldo.", "error");
    if (bal.date > f.today) return toast("O saldo informado não pode ser de uma data futura.", "error");
    await f.save("fin_balances", { date: bal.date, account: bal.account.trim() || "Conta principal", amount: bal.amount });
    setBal({ ...bal, amount: null });
    toast("Saldo registrado");
  }

  return (
    <>
      <PageHeader title="Fluxo de caixa" subtitle="Realizado (dinheiro que entrou e saiu) e projetado mês a mês"
        actions={<Link href="/financeiro/configuracoes?aba=importar"><Button variant="secondary"><Upload className="h-4 w-4" /> Importar extrato</Button></Link>} />

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Saldo bancário" subtitle="Base do caixa atual" />
          <div className="space-y-3 p-5">
            <Kpi label="Caixa atual estimado" value={a.cash.amount === null ? "Não informado" : formatBRL(a.cash.amount)} tone={a.cash.amount === null ? "muted" : "default"} steps={[a.cash.explanation, a.cash.baseAmount !== null && `Saldo informado: ${formatBRL(a.cash.baseAmount)}; movimentos depois: ${formatBRL(a.cash.movementsAfter)}.`, "Lançamentos pagos até a data do saldo já estão dentro dele e não são descontados de novo."]} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Data"><Input type="date" max={f.today} value={bal.date} onChange={(e) => setBal({ ...bal, date: e.target.value })} /></Field>
              <Field label="Conta"><Input value={bal.account} onChange={(e) => setBal({ ...bal, account: e.target.value })} maxLength={40} /></Field>
            </div>
            <Field label="Saldo na data (soma das contas da empresa)"><MoneyInput allowNegative value={bal.amount} onChange={(v) => setBal({ ...bal, amount: v })} /></Field>
            <Button className="w-full" onClick={addBalance}><Plus className="h-4 w-4" /> Registrar saldo</Button>
            {f.data.balances.length > 0 && (
              <ul className="divide-y divide-line text-sm">
                {[...f.data.balances].sort((x, y) => y.date.localeCompare(x.date)).slice(0, 8).map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="text-ink-soft">{b.date.split("-").reverse().join("/")} · {b.account}</span>
                    <span className="flex items-center gap-2 tabular-nums">{formatBRL(b.amount)}<button aria-label="Excluir saldo" className="text-ink-faint hover:text-red-600" onClick={async () => { if (confirm("Excluir este saldo?")) await f.remove("fin_balances", b.id); }}><Trash2 className="h-3.5 w-3.5" /></button></span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Realizado" subtitle="Entradas e saídas efetivas (data de pagamento)" />
          <div className="p-5">
            {realized.length === 0 ? <EmptyState title="Sem movimentações registradas" /> : (
              <FinChart data={realized.map((r) => ({ x: monthLabel(r.month), entradas: r.received, saidas: r.paidOut + r.withdrawals, saldo: r.received - r.paidOut - r.withdrawals }))} xKey="x"
                series={[{ key: "entradas", label: "Entradas", color: 1 }, { key: "saidas", label: "Saídas", color: 0 }, { key: "saldo", label: "Saldo do mês", kind: "line", color: 3 }]} />
            )}
          </div>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader title="Fluxo realizado por mês" />
        <NumTable minWidth={760} head={["Mês", "Recebido", "Despesas pagas", "Retiradas", "Saldo do mês", "Faturado (competência)"]}
          rows={realized.map((r) => [monthLabel(r.month), formatBRL(r.received), formatBRL(r.paidOut), formatBRL(r.withdrawals), <span key="s" className={r.received - r.paidOut - r.withdrawals < 0 ? "text-red-600" : ""}>{formatBRL(r.received - r.paidOut - r.withdrawals)}</span>, formatBRL(r.gross)])} />
      </Card>

      <Card>
        <CardHeader title="Fluxo projetado" subtitle={`Do caixa atual até ${monthLabel(p.months.at(-1)!.month)}`} action={<Segmented value={scenario} onChange={setScenario} options={[{ value: "conservador", label: "Conservador" }, { value: "realista", label: "Realista" }, { value: "otimista", label: "Otimista" }]} />} />
        <div className="p-5">
          <FinChart data={p.months.map((m) => ({ x: monthLabel(m.month), caixa: m.cashEnd, piso: m.floor }))} xKey="x" series={[{ key: "caixa", label: "Caixa final", kind: "line", color: 1 }, { key: "piso", label: "Piso (mínimo + tributos + reservas)", kind: "line", dashed: true, color: 0 }]} />
        </div>
        <NumTable minWidth={980} head={["Mês", "Caixa inicial", "Entradas previstas", "Saídas previstas", "Pró-labore", "Caixa final", "Piso", "Folga"]}
          rows={p.months.map((m) => [
            <span key="m" title={m.notes.join(" ")}>{monthLabel(m.month)}{m.notes.length ? " •" : ""}</span>,
            formatBRL(m.cashStart), formatBRL(m.inflows), formatBRL(m.outflows - m.proLabore), formatBRL(m.proLabore), formatBRL(m.cashEnd), formatBRL(m.floor),
            <span key="h" className={m.headroom < 0 ? "font-medium text-red-600" : "text-emerald-700"}>{formatBRL(m.headroom)}</span>,
          ])} />
        <div className="border-t border-line px-5 py-3">
          <Explain title="Premissas e fórmula" steps={["Caixa projetado = saldo inicial + recebimentos previstos − pagamentos previstos.", ...p.assumptions, ...p.missing.map((x) => `Falta: ${x}.`)]} />
        </div>
      </Card>
    </>
  );
}
