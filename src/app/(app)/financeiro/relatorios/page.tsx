"use client";
import { useState } from "react";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, PageHeader, Segmented, Select } from "@/components/ui";
import { FinChart, FinLoading, NumTable, pctLabel } from "@/components/finance/kit";
import { useFinance } from "@/lib/finance/use-finance";
import { monthLabel } from "@/lib/finance/calendar";
import { formatBRL } from "@/lib/finance/money";
import { aggregateDre, agingReport, budgetVsActual, cancellations, costPerSession, marginByService, type Period } from "@/lib/finance/reports";
import { receivables } from "@/lib/finance/ledger";
import { reserveBalance } from "@/lib/finance/reserves";
import { downloadBlob } from "@/lib/utils";

const REPORTS = [
  { value: "dre", label: "DRE gerencial" },
  { value: "fluxo", label: "Fluxo de caixa realizado e projetado" },
  { value: "rec_desp", label: "Receitas e despesas por categoria" },
  { value: "impostos", label: "Impostos provisionados" },
  { value: "prolabore", label: "Pró-labore e retiradas" },
  { value: "servico", label: "Margem por tipo de serviço" },
  { value: "sessao", label: "Custos por sessão" },
  { value: "inadimplencia", label: "Inadimplência" },
  { value: "orcado", label: "Orçado × realizado" },
  { value: "patrimonio", label: "Evolução patrimonial" },
  { value: "plano2027", label: "Planejamento financeiro de 2027" },
];

type Row = Array<string | number>;

export default function ReportsPage() {
  const f = useFinance();
  const [report, setReport] = useState("dre");
  const [period, setPeriod] = useState<Period>("mensal");
  const a = f.analysis;
  if (f.loading || !a) return <FinLoading />;

  const rows = aggregateDre(a.dre, period);
  const lbl = (k: string) => (period === "mensal" ? monthLabel(k) : period === "anual" ? k : k.replace("-T", " · T"));
  const months = a.dre.map((r) => r.month);
  const proj = a.projections.realista.months;

  // Cada relatório devolve cabeçalho + linhas (mesmos dados na tela e no Excel)
  let head: string[] = [];
  let body: Row[] = [];
  let note = "";
  let chart: React.ReactNode = null;
  switch (report) {
    case "dre":
      head = ["Período", "Receita bruta", "(−) Descontos", "Receita líquida", "(−) Custos variáveis", "Margem de contribuição", "(−) Despesas fixas", "(−) Taxas", "(−) Extraordinárias", "Resultado operacional", "Margem op.", "(−) IR", "(−) INSS", "Lucro líquido", "Margem líq."];
      body = rows.map((r) => [lbl(r.key), formatBRL(r.gross), formatBRL(r.discounts), formatBRL(r.net), formatBRL(r.variable), formatBRL(r.contribution), formatBRL(r.fixed), formatBRL(r.opTaxes), formatBRL(r.extra), formatBRL(r.opResult), pctLabel(r.opMargin), formatBRL(r.incomeTax), formatBRL(r.inss), `${formatBRL(r.netResult)}${r.netReliable ? "" : " *"}`, r.netReliable ? pctLabel(r.netMargin) : "provisória"]);
      note = "Competência: receitas pelo mês do atendimento; IR pelo regime de caixa (como no Carnê-Leão). * Lucro líquido provisório: INSS não informado. Investimentos e gastos pessoais não entram no resultado.";
      chart = <FinChart data={rows.map((r) => ({ x: lbl(r.key), receita: r.net, resultado: r.opResult, lucro: r.netResult }))} xKey="x" series={[{ key: "receita", label: "Receita líquida" }, { key: "resultado", label: "Resultado operacional", color: 1 }, { key: "lucro", label: "Lucro líquido", kind: "line", color: 3 }]} />;
      break;
    case "fluxo":
      head = ["Mês", "Tipo", "Entradas", "Saídas", "Saldo do mês", "Caixa final"];
      body = [
        ...a.dre.map((r) => [monthLabel(r.month), "Realizado", formatBRL(r.received), formatBRL(r.paidOut + r.withdrawals), formatBRL(r.received - r.paidOut - r.withdrawals), "—"]),
        ...proj.map((m) => [monthLabel(m.month), "Projetado", formatBRL(m.inflows), formatBRL(m.outflows), formatBRL(m.inflows - m.outflows), formatBRL(m.cashEnd)]),
      ];
      note = "Realizado: pela data de pagamento. Projetado: cenário realista a partir do caixa atual (o mês atual mostra só o que ainda falta entrar e sair).";
      break;
    case "rec_desp": {
      const cats = new Map<string, number>();
      const svc = new Map<string, number>();
      for (const m of months) {
        const l = a.ledger.get(m);
        for (const [k, v] of Object.entries(l?.expensesByCategory ?? {})) cats.set(k, (cats.get(k) ?? 0) + v);
      }
      for (const t of f.data.transactions) if (t.type === "receita" && t.status !== "cancelado" && t.status !== "previsto") svc.set(t.service_type || t.category, (svc.get(t.service_type || t.category) ?? 0) + t.amount);
      head = ["Tipo", "Categoria", "Total no período"];
      body = [...[...svc.entries()].sort((x, y) => y[1] - x[1]).map(([k, v]) => ["Receita", k, formatBRL(v)]), ...[...cats.entries()].sort((x, y) => y[1] - x[1]).map(([k, v]) => ["Despesa", k, formatBRL(v)])];
      const c = cancellations(f.data.transactions, months);
      note = `Período: ${months.length ? `${monthLabel(months[0])} a ${monthLabel(months.at(-1)!)}` : "—"}. Cancelamentos: ${formatBRL(c.cancelled)}; descontos concedidos: ${formatBRL(c.discounts)}.`;
      break;
    }
    case "impostos":
      head = ["Mês", "Rendimentos PF", "Rendimentos PJ", "Deduções", "Base", "Carnê-Leão", "Ajuste anual", "INSS", "Total provisionado", "Vencimento DARF"];
      body = [...a.dre.map((r) => ({ m: r.month, t: r.tax, inss: r.inss, kind: "" })), ...proj.slice(1).map((m) => ({ m: m.month, t: m.incomeTax, inss: m.inss, kind: " (proj.)" }))].map((x) => [monthLabel(x.m) + x.kind, formatBRL(x.t.carneBaseIncome), formatBRL(x.t.pjIncome), formatBRL(x.t.deductions.livroCaixa + x.t.deductions.inss + x.t.deductions.dependents), formatBRL(x.t.carneBase), formatBRL(x.t.carneLeao), formatBRL(x.t.annualAdjustmentProvision), formatBRL(x.inss), formatBRL(x.t.totalProvision + x.inss), x.t.dueDate.split("-").reverse().join("/")]);
      note = "Estimativa gerencial pela tabela do arquivo do contador. Confira sempre no Carnê-Leão Web antes de pagar.";
      break;
    case "prolabore": {
      head = ["Mês", "Pró-labore retirado", "Outras retiradas", "Lucro líquido do mês", "Retirado ÷ lucro"];
      body = a.dre.map((r) => {
        const l = a.ledger.get(r.month);
        return [monthLabel(r.month), formatBRL(l?.withdrawalsProLabore ?? 0), formatBRL((l?.withdrawals ?? 0) - (l?.withdrawalsProLabore ?? 0)), formatBRL(r.netResult), pctLabel(r.netResult > 0 ? (l?.withdrawals ?? 0) / r.netResult : null, 0)];
      });
      note = `Recomendado hoje: ${formatBRL(a.prolabore.recommended.amount)}/mês · máximo sustentável: ${formatBRL(a.prolabore.maximum.amount)}/mês · planejado: ${f.settings.pro_labore_planned === null ? "não definido" : formatBRL(f.settings.pro_labore_planned)}.`;
      break;
    }
    case "servico": {
      const ms = marginByService(f.data.transactions, months, a.ledger);
      head = ["Serviço", "Receita", "Sessões realizadas", "Ticket médio/sessão", "Custo variável rateado", "Margem de contribuição", "Margem %"];
      body = ms.map((x) => [x.service, formatBRL(x.revenue), x.sessionsDone, x.avgTicket === null ? "—" : formatBRL(x.avgTicket), formatBRL(x.variable), formatBRL(x.contribution), pctLabel(x.margin)]);
      note = "Custo variável rateado pelas sessões realizadas de cada serviço (o custo do espaço é por atendimento).";
      break;
    }
    case "sessao":
      head = ["Mês", "Sessões realizadas", "Custo variável/sessão", "Custo total/sessão", "Receita líquida/sessão"];
      body = costPerSession(a.dre).map((x) => [monthLabel(x.month), x.sessionsDone, x.variablePerSession === null ? "—" : formatBRL(x.variablePerSession), x.totalPerSession === null ? "—" : formatBRL(x.totalPerSession), x.revenuePerSession === null ? "—" : formatBRL(x.revenuePerSession)]);
      note = "Custo variável por sessão = custos variáveis ÷ sessões realizadas no mesmo mês.";
      break;
    case "inadimplencia": {
      const ag = agingReport(f.data.transactions, f.today);
      head = ["Faixa de atraso", "Lançamentos", "Valor"];
      body = ag.map((b) => [b.label, b.items.length, formatBRL(b.total)]);
      const r = receivables(f.data.transactions, f.today);
      note = `Em aberto: ${formatBRL(r.total)}; em atraso: ${formatBRL(r.overdueTotal)}. Inadimplência histórica (vencidos há +30 dias, 12 meses): ${a.stats.delinquencyRate === null ? "sem dados suficientes" : pctLabel(a.stats.delinquencyRate)}.`;
      break;
    }
    case "orcado": {
      const bva = budgetVsActual(f.settings, a.dre);
      head = ["Mês", "Receita orçada", "Receita real", "Diferença", "Despesas orçadas", "Despesas reais", "Diferença", "Resultado orçado", "Resultado real", "Diferença"];
      body = (bva ?? []).map((x) => [monthLabel(x.month), formatBRL(x.revenuePlanned), formatBRL(x.revenueActual), formatBRL(x.revenueDiff), formatBRL(x.expensesPlanned), formatBRL(x.expensesActual), formatBRL(x.expensesDiff), formatBRL(x.resultPlanned), formatBRL(x.resultActual), formatBRL(x.resultDiff)]);
      note = bva === null ? "Nenhum orçado salvo. Em Projeções, use “Salvar como orçamento” para registrar o planejado." : `Orçamento salvo em ${new Date(f.settings.budget_snapshot!.created_at).toLocaleDateString("pt-BR")} (cenário ${f.settings.budget_snapshot!.scenario}).`;
      break;
    }
    case "patrimonio": {
      const balances = [...f.data.balances].sort((x, y) => x.date.localeCompare(y.date));
      const reserves = f.data.reserves.reduce((s, r) => s + reserveBalance(r, f.today), 0);
      const payables = f.data.transactions.filter((t) => t.type === "despesa" && !t.paid_at && t.status !== "cancelado" && t.status !== "previsto").reduce((s, t) => s + t.amount, 0);
      const taxes = a.budget.lines.find((l) => l.key === "tributos")!.amount;
      head = ["Data", "Saldo bancário informado"];
      body = balances.map((b) => [b.date.split("-").reverse().join("/"), formatBRL(b.amount)]);
      note = a.cash.amount === null ? "Informe saldos bancários para acompanhar a evolução." : `Posição hoje: caixa ${formatBRL(a.cash.amount)} + a receber ${formatBRL(a.receivables.total)} − contas a pagar ${formatBRL(payables)} − tributos provisionados ${formatBRL(taxes)} = ${formatBRL(a.cash.amount + a.receivables.total - payables - taxes)} (das quais ${formatBRL(reserves)} separadas em reservas). Equipamentos não entram (sem inventário cadastrado).`;
      break;
    }
    case "plano2027": {
      const y = proj.filter((m) => m.month.startsWith("2027"));
      head = ["Mês", "Pacientes", "Sessões", "Receita bruta", "Despesas", "Resultado operacional", "Lucro líquido", "Pró-labore", "Caixa final"];
      body = y.map((m) => [monthLabel(m.month), m.activePatients, m.plannedSessions.toLocaleString("pt-BR"), formatBRL(m.grossRevenue), formatBRL(m.variableCosts + m.fixedCosts + m.operatingTaxes + m.extraordinary), formatBRL(m.operatingResult), formatBRL(m.netResult), formatBRL(m.proLabore), formatBRL(m.cashEnd)]);
      if (y.length) body.push(["Total 2027", "", y.reduce((s, m) => s + m.plannedSessions, 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 }), formatBRL(y.reduce((s, m) => s + m.grossRevenue, 0)), formatBRL(y.reduce((s, m) => s + m.variableCosts + m.fixedCosts + m.operatingTaxes + m.extraordinary, 0)), formatBRL(y.reduce((s, m) => s + m.operatingResult, 0)), formatBRL(y.reduce((s, m) => s + m.netResult, 0)), formatBRL(y.reduce((s, m) => s + m.proLabore, 0)), formatBRL(y.at(-1)!.cashEnd)]);
      note = `Cenário realista. ${a.projections.realista.assumptions.join(" ")}`;
      break;
    }
  }

  async function exportExcel() {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = "NeuroPlanner — gestão financeira";
    const ws = wb.addWorksheet(REPORTS.find((r) => r.value === report)!.label.slice(0, 31));
    ws.addRow(head).font = { bold: true };
    body.forEach((r) => ws.addRow(r));
    ws.addRow([]);
    ws.addRow([note]);
    ws.columns.forEach((c) => (c.width = 18));
    const buf = await wb.xlsx.writeBuffer();
    downloadBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `relatorio-${report}-${f.today}.xlsx`);
  }

  return (
    <>
      <PageHeader title="Relatórios" subtitle="Gerados dos lançamentos e das projeções — os mesmos números de todas as telas"
        actions={<><Button variant="secondary" className="no-print" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" /> Excel</Button><Button variant="secondary" className="no-print" onClick={() => window.print()}><FileDown className="h-4 w-4" /> PDF</Button></>} />
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Select className="w-80" value={report} onChange={(e) => setReport(e.target.value)} options={REPORTS} />
        {report === "dre" && <Segmented value={period} onChange={setPeriod} options={[{ value: "mensal", label: "Mensal" }, { value: "trimestral", label: "Trimestral" }, { value: "anual", label: "Anual" }]} />}
      </div>
      <Card className="print-area">
        <CardHeader title={REPORTS.find((r) => r.value === report)!.label} subtitle={f.settings.anonymize ? "Pagadores identificados por código" : undefined} />
        {chart && <div className="p-5">{chart}</div>}
        {body.length === 0 ? <EmptyState title="Sem dados para este relatório" text={note} /> : <NumTable minWidth={Math.max(600, head.length * 110)} head={head} rows={body} />}
        {note && body.length > 0 && <p className="border-t border-line px-5 py-3 text-xs text-ink-soft">{note}</p>}
      </Card>
    </>
  );
}
