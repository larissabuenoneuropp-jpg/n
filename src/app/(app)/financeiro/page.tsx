"use client";
import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { AlertList, Explain, FinChart, FinLoading, Kpi, pctLabel } from "@/components/finance/kit";
import { useFinance } from "@/lib/finance/use-finance";
import { monthLabel, monthLongLabel } from "@/lib/finance/calendar";
import { formatBRL } from "@/lib/finance/money";
import { reserveBalance } from "@/lib/finance/reserves";

export default function FinanceOverview() {
  const f = useFinance();
  const a = f.analysis;

  const charts = useMemo(() => {
    if (!a) return null;
    const hist = a.dre.slice(-12);
    const proj = a.projections.realista.months;
    const expenses = new Map<string, number>();
    for (const row of a.closed.slice(-3)) {
      const l = a.ledger.get(row.month);
      for (const [cat, v] of Object.entries(l?.expensesByCategory ?? {})) expenses.set(cat, (expenses.get(cat) ?? 0) + v);
    }
    return {
      revenue: hist.map((r) => ({ x: monthLabel(r.month), faturado: r.gross, recebido: r.received })),
      result: hist.map((r) => ({ x: monthLabel(r.month), operacional: r.opResult, liquido: r.netResult })),
      margins: hist.map((r) => ({ x: monthLabel(r.month), op: r.opMargin === null ? null : Math.round(r.opMargin * 1000) / 10, liq: r.netMargin === null ? null : Math.round(r.netMargin * 1000) / 10 })),
      flows: hist.map((r) => ({ x: monthLabel(r.month), entradas: r.received, saidas: r.paidOut + r.withdrawals })),
      sessions: hist.map((r) => ({ x: monthLabel(r.month), realizadas: r.sessionsDone, faltas: r.absences })),
      patients: hist.map((r) => ({ x: monthLabel(r.month), pacientes: r.payers })),
      cash: proj.map((m) => ({ x: monthLabel(m.month), caixa: m.cashEnd, piso: m.floor })),
      projection: proj.map((m) => ({ x: monthLabel(m.month), receita: m.grossRevenue, resultado: m.netResult })),
      expenses: [...expenses.entries()].sort((x, y) => y[1] - x[1]),
    };
  }, [a]);

  if (f.loading || !a || !charts) return <FinLoading />;
  const cur = a.projections.realista.months[0];
  const curDre = a.current;
  const s = f.settings;
  const b = a.budget;
  const pl = a.prolabore;
  const userReserves = f.data.reserves.reduce((acc, r) => acc + reserveBalance(r, a.today), 0);
  const taxLine = b.lines.find((l) => l.key === "tributos")!;
  const snapshot = s.budget_snapshot?.months[a.currentMonth];

  const setup = [
    { done: f.data.balances.length > 0, label: "Informe o saldo bancário atual", href: "/financeiro/fluxo" },
    { done: f.data.contracts.some((k) => k.active), label: "Cadastre os contratos/pacientes ativos (base das projeções)", href: "/financeiro/receitas?aba=contratos" },
    { done: f.data.transactions.some((t) => t.import_key) || a.closed.length >= 3, label: "Importe o histórico (planilha de sessões e financeiro)", href: "/financeiro/configuracoes?aba=importar" },
    { done: f.data.recurring.length > 0, label: "Cadastre as despesas recorrentes (supervisão, cursos, espaço)", href: "/financeiro/despesas?aba=recorrentes" },
    { done: s.min_cash !== null, label: "Defina o saldo mínimo de segurança", href: "/financeiro/configuracoes" },
    { done: a.missingTax.length === 0, label: `Complete os dados tributários (${a.missingTax.length} faltando)`, href: "/financeiro/tributario" },
  ];
  const setupDone = setup.filter((x) => x.done).length;

  return (
    <>
      <PageHeader title="Gestão financeira" subtitle={`${monthLongLabel(a.currentMonth)} · valores calculados a partir dos seus lançamentos, contratos e configurações`} />

      {setupDone < setup.length && (
        <Card className="mb-5">
          <CardHeader title={`Configuração inicial — ${setupDone} de ${setup.length}`} subtitle="Enquanto estes itens faltarem, alguns números aparecem como provisórios." />
          <ul className="grid gap-1 p-4 sm:grid-cols-2">
            {setup.map((x) => (
              <li key={x.label}>
                <Link href={x.href} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-canvas">
                  {x.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="h-4 w-4 shrink-0 text-ink-faint" />}
                  <span className={x.done ? "text-ink-faint line-through" : "text-ink"}>{x.label}</span>
                  {!x.done && <ArrowRight className="ml-auto h-3.5 w-3.5 text-ink-faint" />}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <h2 className="mb-3 font-display text-base font-semibold">Respostas rápidas</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi emphasis label="Quanto posso gastar este mês (operação)" value={b.freeCash === null ? "Informe o saldo" : formatBRL(b.limits.operational)} provisional={b.provisional} hint={<Link className="text-brand-700 hover:underline" href="/financeiro/orcamento">Ver orçamento disponível</Link>} steps={[b.limitNotes.operational, ...b.lines.map((l) => `${l.sign > 0 ? "+" : "−"} ${l.label}: ${formatBRL(l.amount)}`)]} />
        <Kpi emphasis label="Pró-labore recomendado (mensal)" value={formatBRL(pl.recommended.amount)} provisional={pl.provisional} hint={`Máximo sustentável: ${formatBRL(pl.maximum.amount)}`} steps={pl.explanation} />
        <Kpi emphasis label="Posso transferir para minha conta agora" value={formatBRL(pl.availableNow)} provisional={b.freeCash === null} hint={`Já retirado no mês: ${formatBRL(pl.withdrawnThisMonth)}`} steps={pl.availableExplanation} />
        <Kpi emphasis label="Compra extraordinária possível agora" value={formatBRL(b.limits.investment)} provisional={b.provisional} hint={<Link className="text-brand-700 hover:underline" href="/financeiro/orcamento#simular">Simular uma compra</Link>} steps={[b.limitNotes.investment]} />
      </div>

      <h2 className="mb-3 font-display text-base font-semibold">{monthLongLabel(a.currentMonth)}</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <Kpi label="Faturamento bruto (lançado)" value={formatBRL(curDre?.gross ?? 0)} hint={`Projeção do mês: ${formatBRL(cur.grossRevenue)}`} steps={["Serviços prestados no mês (competência), faturados ou já recebidos. Não inclui lançamentos previstos nem cancelados.", `A projeção soma os contratos ainda não lançados: ${formatBRL(cur.grossRevenue)}.`]} />
        <Kpi label="Efetivamente recebido" value={formatBRL(curDre?.received ?? 0)} hint="Dinheiro que entrou no mês" />
        <Kpi label="A receber" value={formatBRL(a.receivables.total)} tone={a.receivables.overdueTotal ? "bad" : "default"} hint={a.receivables.overdueTotal ? `${formatBRL(a.receivables.overdueTotal)} em atraso` : "Nada em atraso"} />
        <Kpi label="Despesas fixas" value={formatBRL(cur.fixedCosts + cur.operatingTaxes)} hint="Lançadas + recorrentes previstas" />
        <Kpi label="Despesas variáveis" value={formatBRL(cur.variableCosts)} hint={`${cur.expectedSessionsDone.toLocaleString("pt-BR")} sessões previstas`} />
        <Kpi label="Tributos e obrigações provisionados" value={formatBRL(taxLine.amount)} steps={[taxLine.detail]} />
        <Kpi label="Resultado operacional estimado" value={formatBRL(cur.operatingResult)} tone={cur.operatingResult < 0 ? "bad" : "default"} steps={["Receita líquida − custos variáveis − despesas fixas − taxas − extraordinárias (competência, mês inteiro estimado)."]} />
        <Kpi label="Lucro líquido estimado" value={formatBRL(cur.netResult)} provisional={s.tax.inss.monthly_amount === null} tone={cur.netResult < 0 ? "bad" : "default"} steps={["Resultado operacional − IR (Carnê-Leão + provisão de ajuste) − INSS.", s.tax.inss.monthly_amount === null && "INSS não informado: valor provisório."]} />
        <Kpi label="Margem operacional · líquida" value={`${pctLabel(cur.operatingMargin)} · ${pctLabel(cur.netMargin)}`} steps={["Margem operacional = resultado operacional ÷ receita líquida.", "Margem líquida = lucro líquido ÷ receita líquida (só com INSS informado)."]} />
        <Kpi label="Pró-labore planejado" value={s.pro_labore_planned === null ? "Não definido" : formatBRL(s.pro_labore_planned)} tone={pl.plannedExceedsMax ? "bad" : "default"} hint={pl.plannedExceedsMax ? "Acima do sustentável" : undefined} />
        <Kpi label="Pró-labore já retirado" value={formatBRL(pl.withdrawnThisMonth)} />
        <Kpi label="Caixa atual" value={a.cash.amount === null ? "Não informado" : formatBRL(a.cash.amount)} tone={a.cash.amount === null ? "muted" : "default"} steps={[a.cash.explanation]} />
        <Kpi label="Reservas comprometidas" value={formatBRL(userReserves + taxLine.amount)} hint={`Reservas ${formatBRL(userReserves)} + tributos ${formatBRL(taxLine.amount)}`} />
        <Kpi label="Caixa livre para novas despesas" value={b.freeCash === null ? "—" : formatBRL(b.freeCash)} tone={b.freeCash !== null && b.freeCash < 0 ? "bad" : "good"} provisional={b.provisional} />
        <Kpi label="Meta mensal de faturamento" value={s.goal_monthly_revenue ? formatBRL(s.goal_monthly_revenue) : "Não definida"} hint={s.goal_monthly_revenue ? `Projeção: ${pctLabel(cur.grossRevenue / s.goal_monthly_revenue, 0)} da meta` : <Link className="text-brand-700 hover:underline" href="/financeiro/configuracoes">Definir meta</Link>} />
        <Kpi label="Ocupação da agenda" value={pctLabel(cur.occupancy, 0)} hint={`${cur.plannedSessions.toLocaleString("pt-BR")} de ${cur.capacitySessions.toLocaleString("pt-BR")} sessões (${s.capacity_per_week}/sem × ${cur.weeks.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} sem)`} />
        <Kpi label="Real × planejado" value={snapshot ? formatBRL((curDre?.gross ?? 0) - snapshot.revenue) : "Sem orçamento salvo"} tone={snapshot ? ((curDre?.gross ?? 0) >= snapshot.revenue ? "good" : "bad") : "muted"} hint={snapshot ? `Faturado ${formatBRL(curDre?.gross ?? 0)} de ${formatBRL(snapshot.revenue)} planejados` : <Link className="text-brand-700 hover:underline" href="/financeiro/projecoes">Salvar orçamento do ano</Link>} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Alertas e recomendações" subtitle="Calculados com os seus números" />
          <AlertList alerts={a.alerts} limit={6} />
        </Card>
        <Card>
          <CardHeader title="Distribuição das despesas" subtitle="Últimos 3 meses fechados, por categoria" />
          <div className="space-y-2 p-5">
            {charts.expenses.length === 0 && <p className="text-sm text-ink-faint">Sem despesas lançadas nos últimos meses.</p>}
            {charts.expenses.map(([cat, v]) => {
              const total = charts.expenses.reduce((acc, x) => acc + x[1], 0);
              return (
                <div key={cat}>
                  <div className="flex justify-between gap-2 text-xs"><span className="truncate text-ink-soft">{cat}</span><span className="tabular-nums">{formatBRL(v)} · {pctLabel(v / total, 0)}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-canvas"><div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${(v / total) * 100}%` }} /></div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader title="Faturamento e recebimentos" subtitle="Competência × caixa, por mês" /><div className="p-5"><FinChart data={charts.revenue} xKey="x" series={[{ key: "faturado", label: "Faturado" }, { key: "recebido", label: "Recebido", color: 1 }]} /></div></Card>
        <Card><CardHeader title="Resultado" subtitle="Operacional e líquido (após IR e INSS)" /><div className="p-5"><FinChart data={charts.result} xKey="x" series={[{ key: "operacional", label: "Resultado operacional" }, { key: "liquido", label: "Lucro líquido", color: 1 }]} /></div></Card>
        <Card><CardHeader title="Margens" subtitle="% da receita líquida" /><div className="p-5"><FinChart data={charts.margins} xKey="x" format={(v) => `${v}%`} tooltipFormat={(v) => `${v.toLocaleString("pt-BR")}%`} series={[{ key: "op", label: "Margem operacional", kind: "line" }, { key: "liq", label: "Margem líquida", kind: "line", color: 1 }]} /></div></Card>
        <Card><CardHeader title="Entradas × saídas de caixa" subtitle="Inclui retiradas pessoais nas saídas" /><div className="p-5"><FinChart data={charts.flows} xKey="x" series={[{ key: "entradas", label: "Entradas" , color: 1 }, { key: "saidas", label: "Saídas", color: 0 }]} /></div></Card>
        <Card><CardHeader title="Saldo de caixa projetado" subtitle="Cenário realista × piso (mínimo + tributos + reservas)" /><div className="p-5"><FinChart data={charts.cash} xKey="x" series={[{ key: "caixa", label: "Caixa no fim do mês", kind: "line", color: 1 }, { key: "piso", label: "Piso", kind: "line", dashed: true, color: 0 }]} /><Explain className="mt-3" steps={a.projections.realista.assumptions} title="Premissas" /></div></Card>
        <Card><CardHeader title="Projeção dos próximos meses" subtitle="Cenário realista" /><div className="p-5"><FinChart data={charts.projection} xKey="x" series={[{ key: "receita", label: "Faturamento" }, { key: "resultado", label: "Lucro líquido", color: 1 }]} /></div></Card>
        <Card><CardHeader title="Atendimentos" subtitle="Sessões realizadas e faltas registradas" /><div className="p-5"><FinChart data={charts.sessions} xKey="x" format={(v) => String(Math.round(v))} tooltipFormat={(v) => v.toLocaleString("pt-BR")} series={[{ key: "realizadas", label: "Realizadas", color: 1 }, { key: "faltas", label: "Faltas", color: 0 }]} /></div></Card>
        <Card><CardHeader title="Pacientes atendidos" subtitle="Pagadores distintos com lançamento no mês" /><div className="p-5"><FinChart data={charts.patients} xKey="x" format={(v) => String(Math.round(v))} tooltipFormat={(v) => String(v)} series={[{ key: "pacientes", label: "Pacientes", kind: "line", color: 1 }]} /></div></Card>
      </div>
    </>
  );
}
