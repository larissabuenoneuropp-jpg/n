"use client";
import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Button, Card, CardHeader, Field, Input, PageHeader, Segmented, Tabs, useToast } from "@/components/ui";
import { Explain, FinChart, FinLoading, Kpi, MoneyInput, NumTable, pctLabel } from "@/components/finance/kit";
import { useFinance } from "@/lib/finance/use-finance";
import { monthLabel } from "@/lib/finance/calendar";
import { formatBRL } from "@/lib/finance/money";
import { maxSustainableWithdrawal } from "@/lib/finance/prolabore";
import { firstAffordableMonth } from "@/lib/finance/budget";
import type { ScenarioKey, ScenarioParams } from "@/lib/finance/settings";
import { averageWeeks, breakEven, compareScenario, maxAcquisitionCost, sessionsForNetResult, sessionsForRevenue, simulateSessions, type SimBase } from "@/lib/finance/simulator";

const KEYS: ScenarioKey[] = ["conservador", "realista", "otimista"];

function ScenarioEditor({ value, onSave }: { value: ScenarioParams; onSave: (p: ScenarioParams) => Promise<void> }) {
  const [p, setP] = useState(value);
  const [last, setLast] = useState(value);
  if (value !== last) { setLast(value); setP(value); }
  const num = (k: keyof ScenarioParams, scale = 1) => ({ value: p[k] === null ? "" : Math.round(Number(p[k]) * scale * 100) / 100, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setP({ ...p, [k]: e.target.value === "" ? null : Number(e.target.value) / scale }) });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="Presença (± pontos %)"><Input type="number" step="1" {...num("attendance_delta", 100)} /></Field>
        <Field label="Inadimplência (%)" hint="Vazio = histórico"><Input type="number" step="1" min={0} max={100} {...num("delinquency", 100)} /></Field>
        <Field label="Atraso nos recebimentos (meses)"><Input type="number" min={0} max={3} {...num("receipt_delay_months")} /></Field>
        <Field label="Reajuste de preço (%)"><Input type="number" step="0.5" {...num("price_change_pct")} /></Field>
        <Field label="Variação dos custos (%)"><Input type="number" step="0.5" {...num("cost_change_pct")} /></Field>
        <Field label="Novos pacientes / trimestre"><Input type="number" min={0} step="0.5" {...num("new_patients_per_quarter")} /></Field>
        <Field label="Sessões/sem por novo paciente"><Input type="number" min={0} step="0.5" {...num("sessions_per_new_patient")} /></Field>
        <Field label="Pacientes perdidos / semestre"><Input type="number" min={0} step="0.5" {...num("lost_patients_per_semester")} /></Field>
      </div>
      <Button size="sm" onClick={() => onSave(p)}><Save className="h-3.5 w-3.5" /> Salvar premissas do cenário</Button>
    </div>
  );
}

export default function ProjectionsPage() {
  const f = useFinance();
  const toast = useToast();
  const [tab, setTab] = useState<"tabela" | "comparar" | "premissas" | "simulador">("tabela");
  const [scenario, setScenario] = useState<ScenarioKey>("realista");
  const a = f.analysis;
  const sustainable = useMemo(() => (a ? Object.fromEntries(KEYS.map((k) => [k, maxSustainableWithdrawal(f.data, k, f.today)])) as Record<ScenarioKey, ReturnType<typeof maxSustainableWithdrawal>> : null), [a, f.data, f.today]);

  // Simulador
  const [spw, setSpw] = useState<number>(10);
  const [target, setTarget] = useState<number | null>(null);
  const [targetNet, setTargetNet] = useState<number | null>(null);
  const [newPrice, setNewPrice] = useState<number | null>(null);
  const [newCost, setNewCost] = useState<number | null>(null);
  const [lostSessions, setLostSessions] = useState<number>(2);
  const [payback, setPayback] = useState<number>(3);
  const [buyAmount, setBuyAmount] = useState<number | null>(null);
  const [buyResult, setBuyResult] = useState<string | null>(null);

  if (f.loading || !a || !sustainable) return <FinLoading />;
  const p = a.projections[scenario];
  const s = f.settings;
  const reserveContrib = f.data.reserves.reduce((acc, r) => acc + (r.monthly_contribution ?? 0), 0);

  const last3 = a.closed.slice(-3);
  const avgDone = last3.length ? last3.reduce((x, r) => x + r.sessionsDone, 0) / last3.length : 0;
  const varPerSession = avgDone ? last3.reduce((x, r) => x + r.variable, 0) / last3.length / avgDone : (f.data.recurring.find((r) => r.basis === "por_sessao" && r.active)?.amount ?? 0);
  const fixed = p.months[1] ? p.months[1].fixedCosts + p.months[1].operatingTaxes : 0;
  const avgPrice = f.data.contracts.filter((k) => k.active && k.billing === "por_sessao").reduce((x, k, _, arr) => x + k.unit_amount / arr.length, 0) || s.reference_price;
  const base: SimBase = {
    weeksPerMonth: averageWeeks(s, a.currentMonth), attendance: a.projections.realista.attendance, price: avgPrice, variableCostPerSession: varPerSession,
    fixedMonthlyCosts: fixed, capacityPerWeek: s.capacity_per_week, tax: s.tax, deductibleMonthly: 0,
  };
  const be = breakEven(base);

  return (
    <>
      <PageHeader title="Projeções e cenários" subtitle={`De ${monthLabel(p.months[0].month)} até ${monthLabel(p.months.at(-1)!.month)} — contratos ativos, histórico e premissas editáveis`}
        actions={<Button variant="secondary" onClick={async () => {
          const months = Object.fromEntries(a.projections.realista.months.map((m) => [m.month, { revenue: m.grossRevenue, expenses: m.variableCosts + m.fixedCosts + m.operatingTaxes + m.extraordinary, result: m.operatingResult }]));
          await f.saveSettings({ budget_snapshot: { created_at: new Date().toISOString(), scenario: "realista", months } }, "Salvou o orçamento (fotografia do cenário realista)");
          toast("Orçamento salvo — usado no comparativo orçado × realizado");
        }}><Save className="h-4 w-4" /> Salvar como orçamento</Button>} />

      {p.missing.length > 0 && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900"><b>Projeção provisória.</b> Falta: {p.missing.join("; ")}.</div>}

      <Tabs value={tab} onChange={setTab} tabs={[{ value: "tabela", label: "Mês a mês" }, { value: "comparar", label: "Comparar cenários" }, { value: "premissas", label: "Premissas" }, { value: "simulador", label: "Simulador de crescimento" }]} />
      <div className="mt-4" />

      {tab === "tabela" && (
        <Card>
          <CardHeader title={`Cenário ${p.params.label.toLowerCase()}`} subtitle={p.params.meta.notes} action={<Segmented value={scenario} onChange={setScenario} options={KEYS.map((k) => ({ value: k, label: a.projections[k].params.label }))} />} />
          <NumTable minWidth={1900}
            head={["Mês", "Pacientes", "Sessões previstas", "Ocupação", "Receita bruta", "Receita esperada (caixa)", "Tributos (IR+INSS)", "Fixas", "Variáveis", "Resultado operacional", "Pró-labore", "Investimentos", "Aporte reservas", "Caixa inicial", "Caixa final", "Margem op.", "Margem líq."]}
            rows={p.months.map((m) => [
              <span key="m" title={m.notes.join(" ")}>{monthLabel(m.month)}{m.isCurrent ? " (atual)" : ""}{m.notes.length ? " •" : ""}</span>,
              m.activePatients, m.plannedSessions.toLocaleString("pt-BR"), pctLabel(m.occupancy, 0), formatBRL(m.grossRevenue), formatBRL(m.expectedReceipts),
              formatBRL(m.incomeTax.totalProvision + m.inss), formatBRL(m.fixedCosts + m.operatingTaxes), formatBRL(m.variableCosts),
              <span key="o" className={m.operatingResult < 0 ? "text-red-600" : ""}>{formatBRL(m.operatingResult)}</span>, formatBRL(m.proLabore), formatBRL(m.investments), formatBRL(reserveContrib),
              formatBRL(m.cashStart), <span key="c" className={m.headroom < 0 ? "font-medium text-red-600" : ""}>{formatBRL(m.cashEnd)}</span>, pctLabel(m.operatingMargin), pctLabel(m.netMargin),
            ])} />
          <div className="border-t border-line px-5 py-3"><Explain title="Premissas e método" steps={[...p.assumptions, "Sessões previstas = sessões/semana dos contratos × semanas de atendimento reais do mês (sem supor 4 semanas).", "Mês atual: soma o que já foi lançado com a estimativa dos contratos ainda não lançados.", "• = mês com observação (férias, compras aprovadas, mudanças do cenário) — passe o mouse no mês."]} /></div>
        </Card>
      )}

      {tab === "comparar" && (
        <>
          <Card className="mb-4">
            <CardHeader title="Caixa final por cenário" subtitle="Abaixo do piso = risco; folga alta = espaço para investir" />
            <div className="p-5">
              <FinChart data={a.projections.realista.months.map((m, i) => ({ x: monthLabel(m.month), conservador: a.projections.conservador.months[i]?.cashEnd ?? null, realista: m.cashEnd, otimista: a.projections.otimista.months[i]?.cashEnd ?? null, piso: m.floor }))} xKey="x"
                series={[{ key: "conservador", label: "Conservador", kind: "line", color: 0 }, { key: "realista", label: "Realista", kind: "line", color: 1 }, { key: "otimista", label: "Otimista", kind: "line", color: 3 }, { key: "piso", label: "Piso (realista)", kind: "line", dashed: true, color: 2 }]} />
            </div>
          </Card>
          <Card className="mb-4">
            <CardHeader title="Resumo do período" />
            <NumTable head={["", ...KEYS.map((k) => a.projections[k].params.label)]}
              rows={([
                ["Faturamento", (k: ScenarioKey) => formatBRL(a.projections[k].months.reduce((x, m) => x + m.grossRevenue, 0))],
                ["Despesas operacionais", (k: ScenarioKey) => formatBRL(a.projections[k].months.reduce((x, m) => x + m.variableCosts + m.fixedCosts + m.operatingTaxes + m.extraordinary, 0))],
                ["Lucro líquido estimado", (k: ScenarioKey) => formatBRL(a.projections[k].months.reduce((x, m) => x + m.netResult, 0))],
                ["Margem operacional média", (k: ScenarioKey) => { const ms = a.projections[k].months; const net = ms.reduce((x, m) => x + m.netRevenue, 0); return pctLabel(net ? ms.reduce((x, m) => x + m.operatingResult, 0) / net : null); }],
                ["Margem líquida média", (k: ScenarioKey) => { const ms = a.projections[k].months; const net = ms.reduce((x, m) => x + m.netRevenue, 0); return s.tax.inss.monthly_amount === null ? "provisória" : pctLabel(net ? ms.reduce((x, m) => x + m.netResult, 0) / net : null); }],
                ["Pró-labore sustentável (12 meses)", (k: ScenarioKey) => formatBRL(sustainable[k].amount)],
                ["Caixa final", (k: ScenarioKey) => formatBRL(a.projections[k].months.at(-1)!.cashEnd)],
                ["Meses abaixo do piso", (k: ScenarioKey) => String(a.projections[k].months.filter((m) => m.headroom < 0).length)],
              ] as Array<[string, (k: ScenarioKey) => string]>).map(([label, fn]) => [label, ...KEYS.map((k) => fn(k))])} />
          </Card>
          <Card>
            <CardHeader title="Mapa de risco mês a mês" subtitle="Folga = caixa final − piso" />
            <div className="overflow-x-auto p-5">
              <table className="text-xs">
                <thead><tr><th />{a.projections.realista.months.map((m) => <th key={m.month} className="px-1 py-1 font-medium text-ink-faint">{monthLabel(m.month)}</th>)}</tr></thead>
                <tbody>
                  {KEYS.map((k) => (
                    <tr key={k}>
                      <td className="pr-3 text-ink-soft">{a.projections[k].params.label}</td>
                      {a.projections[k].months.map((m) => {
                        const level = m.headroom < 0 ? "Risco" : m.headroom < m.minCash ? "Atenção" : m.headroom > 2 * m.minCash ? "Folga" : "OK";
                        const cls = level === "Risco" ? "bg-red-100 text-red-800" : level === "Atenção" ? "bg-amber-100 text-amber-900" : level === "Folga" ? "bg-emerald-100 text-emerald-800" : "bg-canvas text-ink-soft";
                        return <td key={m.month} className="p-0.5"><div className={`min-w-14 rounded px-1 py-1 text-center ${cls}`} title={`${formatBRL(m.headroom)}`}>{level}</div></td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-ink-faint">Risco: caixa abaixo do piso. Atenção: folga menor que o saldo mínimo. Folga: mais de 2× o saldo mínimo acima do piso — meses em que dá para ampliar investimentos.</p>
            </div>
          </Card>
        </>
      )}

      {tab === "premissas" && (
        <div className="space-y-4">
          {KEYS.map((k) => (
            <Card key={k}>
              <CardHeader title={`Cenário ${s.scenarios[k].label.toLowerCase()}`} subtitle={s.scenarios[k].meta.notes} />
              <div className="p-5"><ScenarioEditor value={s.scenarios[k]} onSave={async (np) => { await f.saveSettings({ scenarios: { ...s.scenarios, [k]: { ...np, meta: { ...np.meta, status: "premissa", source: "Ajustado por você" } } } }, `Alterou premissas do cenário ${k}`); toast("Premissas salvas"); }} /></div>
            </Card>
          ))}
          <Card className="p-5 text-xs text-ink-soft">
            <p>Presença base: {Math.round((s.attendance_rate ?? a.stats.attendanceRate ?? s.attendance_fallback) * 100)}% ({a.projections.realista.attendanceSource}). Inadimplência base: {Math.round(a.projections.realista.delinquency * 100)}% ({a.projections.realista.delinquencySource}). Ajuste em Configurações.</p>
          </Card>
        </div>
      )}

      {tab === "simulador" && (
        <>
          <Card className="mb-4 p-5 text-xs text-ink-soft">
            Base: {base.weeksPerMonth.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} semanas de atendimento/mês (média dos próximos 12 meses), presença {Math.round(base.attendance * 100)}%, valor médio por sessão {formatBRL(base.price)} (contratos ativos), custo variável {formatBRL(base.variableCostPerSession)}/sessão, custos fixos {formatBRL(base.fixedMonthlyCosts)}/mês. A receita conta só sessões realizadas.
          </Card>
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Quanto faturo com N sessões por semana?" />
              <NumTable head={["Sessões/sem", "Ocupação", "Faturamento/mês", "Resultado operacional", "Após IR"]}
                rows={[10, 15, 20, 25].map((n) => { const r = simulateSessions(base, n); return [n, pctLabel(r.occupancy, 0), formatBRL(r.revenue), formatBRL(r.operatingResult), formatBRL(r.afterTax)]; })} />
              <div className="border-t border-line p-5">
                <Field label="Outro número de sessões/semana"><Input type="number" min={0} max={60} value={spw} onChange={(e) => setSpw(Number(e.target.value))} /></Field>
                {(() => { const r = simulateSessions(base, spw); return <p className="mt-2 text-sm">{spw} sessões/sem → {formatBRL(r.revenue)}/mês, resultado {formatBRL(r.operatingResult)}, após IR {formatBRL(r.afterTax)}{spw > s.capacity_per_week ? " — acima da capacidade configurada" : ""}.</p>; })()}
              </div>
            </Card>
            <Card>
              <CardHeader title="Metas" />
              <div className="space-y-4 p-5">
                <Field label="Meta de faturamento mensal"><MoneyInput value={target ?? s.goal_monthly_revenue} onChange={setTarget} /></Field>
                {(() => { const t = target ?? s.goal_monthly_revenue; if (!t) return null; const r = sessionsForRevenue(base, t); const cur = a.projections.realista.months[1]?.plannedSessions ?? 0; const curPerWeek = cur / (a.projections.realista.months[1]?.weeks || 1); return r && <p className="text-sm">Precisa de <b>{r.sessionsPerWeek.toLocaleString("pt-BR")} sessões contratadas/semana</b> (~{r.sessionsPerMonth} no mês){r.withinCapacity ? "" : " — acima da capacidade"}. Hoje: {curPerWeek.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/sem → faltam {Math.max(0, r.sessionsPerWeek - curPerWeek).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} sessões/sem, ou ~{Math.ceil(Math.max(0, r.sessionsPerWeek - curPerWeek))} paciente(s) novo(s) com 1 sessão/sem.</p>; })()}
                <Field label="Meta de resultado mensal após IR"><MoneyInput value={targetNet} onChange={setTargetNet} /></Field>
                {targetNet ? (() => { const r = sessionsForNetResult(base, targetNet); return <p className="text-sm">{r ? <>Precisa de <b>{r.sessionsPerWeek.toLocaleString("pt-BR")} sessões/semana</b>{r.withinCapacity ? "" : " — acima da capacidade"}.</> : "Não alcançável dentro de 2× a capacidade."}</p>; })() : null}
                {be && <p className="text-sm text-ink-soft">Ponto de equilíbrio: {formatBRL(be.revenue)}/mês ({be.sessionsPerWeek.toLocaleString("pt-BR")} sessões/sem). Margem de contribuição {pctLabel(be.marginPct)}.</p>}
              </div>
            </Card>
            <Card>
              <CardHeader title="E se…" subtitle={`Com ${spw} sessões/semana`} />
              <div className="space-y-4 p-5">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Novo preço por sessão"><MoneyInput value={newPrice} onChange={setNewPrice} /></Field>
                  <Field label="Novo custo variável/sessão"><MoneyInput value={newCost} onChange={setNewCost} /></Field>
                </div>
                {newPrice ? <p className="text-sm">Preço {formatBRL(base.price)} → {formatBRL(newPrice)}: resultado após IR muda {formatBRL(compareScenario(base, spw, { price: newPrice }).delta)}/mês.</p> : null}
                {newCost !== null ? <p className="text-sm">Custo {formatBRL(base.variableCostPerSession)} → {formatBRL(newCost)}/sessão: resultado após IR muda {formatBRL(compareScenario(base, spw, { variableCostPerSession: newCost }).delta)}/mês.</p> : null}
                <Field label="Perder um paciente com quantas sessões/semana?"><Input type="number" min={0} step="0.5" value={lostSessions} onChange={(e) => setLostSessions(Number(e.target.value))} /></Field>
                <p className="text-sm">Efeito: {formatBRL(simulateSessions(base, Math.max(0, spw - lostSessions)).afterTax - simulateSessions(base, spw).afterTax)}/mês no resultado após IR.</p>
              </div>
            </Card>
            <Card>
              <CardHeader title="Marketing, estrutura e compras" />
              <div className="space-y-4 p-5">
                <Field label="Em quantos meses o investimento para captar um paciente deve se pagar?"><Input type="number" min={1} max={24} value={payback} onChange={(e) => setPayback(Number(e.target.value) || 1)} /></Field>
                {(() => { const r = maxAcquisitionCost(base, 1, payback); return <p className="text-sm">Um paciente novo com 1 sessão/sem gera {formatBRL(r.contributionPerMonth)}/mês de margem de contribuição → dá para investir até <b>{formatBRL(r.maxCost)}</b> para captá-lo (retorno em {payback} meses). Esse limite também precisa caber no orçamento de despesas operacionais do mês ({formatBRL(a.budget.limits.operational)}).</p>; })()}
                <Field label="Quando consigo comprar algo de"><MoneyInput value={buyAmount} onChange={setBuyAmount} /></Field>
                <Button size="sm" variant="secondary" onClick={() => { if (!buyAmount) return; const m = firstAffordableMonth(f.data, f.today, buyAmount, a.proLaboreUsed); setBuyResult(m ? `A partir de ${monthLabel(m)} a compra cabe, mesmo no cenário conservador, mantendo o caixa acima do piso por 12 meses.` : "Não cabe nos próximos 15 meses com as premissas atuais — considere parcelar ou formar uma reserva de equipamentos."); }}>Calcular</Button>
                {buyResult && <p className="text-sm">{buyResult}</p>}
                <p className="text-xs text-ink-faint">Para contratar um serviço ou ampliar a estrutura, simule o custo mensal como “Novo custo variável” (por sessão) ou some aos custos fixos na tela de Despesas › Recorrentes e veja o pró-labore sustentável e os meses de risco.</p>
              </div>
            </Card>
          </div>
          <Kpi label="Ocupação atual (contratos)" value={pctLabel(a.projections.realista.months[1]?.occupancy, 0)} hint={`Capacidade: ${s.capacity_per_week} sessões/semana`} />
        </>
      )}
    </>
  );
}
