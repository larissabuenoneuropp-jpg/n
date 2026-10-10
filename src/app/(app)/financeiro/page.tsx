"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, FileDown, FileSpreadsheet, Pencil, Plus, Receipt, Trash2, Wand2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, PageHeader, Segmented, Select, Spinner, useToast } from "@/components/ui";
import { BarChart } from "@/components/charts";
import { ReceiptsList } from "@/components/finance/receipts-list";
import { useCollection, useData } from "@/lib/data/provider";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/catalog";
import { txStatus } from "@/lib/labels";
import type { Transaction } from "@/lib/types";
import { MONTHS, downloadBlob, formatDate, money, monthKey, today } from "@/lib/utils";

const compact = (v: number) => (v >= 1000 ? `R$ ${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `R$ ${Math.round(v)}`);

function TxModal({ open, onClose, initial, onSave }: { open: boolean; onClose: () => void; initial: Partial<Transaction> | null; onSave: (t: Partial<Transaction>) => Promise<unknown> }) {
  const patients = useCollection("patients", { orderBy: "name", ascending: true });
  const [f, setF] = useState<Partial<Transaction>>(initial ?? {});
  const [last, setLast] = useState(initial);
  const [saving, setSaving] = useState(false);
  if (initial !== last) {
    setLast(initial);
    setF(initial ?? {});
  }
  const cats = f.type === "despesa" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  return (
    <Modal open={open} onClose={onClose} title={f.id ? "Editar lançamento" : "Novo lançamento"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={saving} onClick={async () => {
        if (!f.amount || !f.due_date) return;
        setSaving(true);
        await onSave({ ...f, paid_at: f.paid_at || null, patient_id: f.patient_id || null }).finally(() => setSaving(false));
        onClose();
      }}>Salvar</Button></>}>
      <div className="space-y-3">
        <Segmented value={f.type ?? "receita"} onChange={(type) => setF({ ...f, type, category: type === "despesa" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0] })}
          options={[{ value: "receita", label: "Receita" }, { value: "despesa", label: "Despesa" }]} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoria"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={cats} /></Field>
          <Field label="Valor (R$)"><Input type="number" min={0} step="0.01" value={f.amount ?? ""} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} /></Field>
        </div>
        <Field label="Descrição"><Input value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        {f.type !== "despesa" && (
          <Field label="Paciente"><Select value={f.patient_id ?? ""} onChange={(e) => setF({ ...f, patient_id: e.target.value })} placeholder="—" options={patients.data.map((p) => ({ value: p.id, label: p.name }))} /></Field>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Vencimento"><Input type="date" value={f.due_date ?? ""} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></Field>
          <Field label="Pago em"><Input type="date" value={f.paid_at ?? ""} onChange={(e) => setF({ ...f, paid_at: e.target.value })} /></Field>
          <Field label="Forma"><Select value={f.method ?? ""} onChange={(e) => setF({ ...f, method: e.target.value })} placeholder="—" options={["PIX", "Dinheiro", "Cartão", "Transferência", "Boleto", "Convênio"]} /></Field>
        </div>
      </div>
    </Modal>
  );
}

function FinanceInner() {
  const params = useSearchParams();
  const toast = useToast();
  const { store, bump } = useData();
  const txs = useCollection("transactions", { orderBy: "due_date" });
  const patients = useCollection("patients");
  const appts = useCollection("appointments");
  const [month, setMonth] = useState(monthKey(new Date()));
  const [type, setType] = useState<"todos" | "receita" | "despesa">("todos");
  const [status, setStatus] = useState("");
  const [modal, setModal] = useState<Partial<Transaction> | null>(params.get("novo") === "1" ? { type: "receita", category: "Sessão", due_date: today() } : null);
  const pmap = useMemo(() => new Map(patients.data.map((p) => [p.id, p])), [patients.data]);

  const inMonth = txs.data.filter((t) => monthKey(t.due_date) === month || (t.paid_at && monthKey(t.paid_at) === month));
  const list = inMonth.filter((t) => (type === "todos" || t.type === type) && (!status || txStatus(t).key === status));

  const received = txs.data.filter((t) => t.type === "receita" && t.paid_at && monthKey(t.paid_at) === month).reduce((s, t) => s + Number(t.amount), 0);
  const expenses = txs.data.filter((t) => t.type === "despesa" && t.paid_at && monthKey(t.paid_at) === month).reduce((s, t) => s + Number(t.amount), 0);
  const billed = txs.data.filter((t) => t.type === "receita" && monthKey(t.due_date) === month);
  const overdue = txs.data.filter((t) => t.type === "receita" && txStatus(t).key === "atrasado");
  const overdueTotal = overdue.reduce((s, t) => s + Number(t.amount), 0);
  const pendingMonth = billed.filter((t) => !t.paid_at).reduce((s, t) => s + Number(t.amount), 0);
  // Inadimplência: valor em atraso ÷ total de receitas já vencidas (todos os períodos)
  const dueSoFar = txs.data.filter((t) => t.type === "receita" && t.due_date <= today()).reduce((s, t) => s + Number(t.amount), 0);
  const delinquency = dueSoFar ? Math.round((overdueTotal / dueSoFar) * 100) : 0;

  const chart = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(y, m - 1 - (5 - i), 1);
      const k = monthKey(d);
      const sum = (tp: string) => txs.data.filter((t) => t.type === tp && t.paid_at && monthKey(t.paid_at) === k).reduce((s, t) => s + Number(t.amount), 0);
      const r = sum("receita");
      const e = sum("despesa");
      return { x: `${MONTHS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, receitas: r, despesas: e, lucro: r - e };
    });
  }, [txs.data, month]);

  const monthLabel = (() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  })();

  /** Gera mensalidades para pacientes particulares ativos (valor × frequência × 4 semanas). */
  async function generateMonthly() {
    const [y, m] = month.split("-").map(Number);
    const due = `${month}-05`;
    const active = patients.data.filter((p) => p.status === "ativo" && p.payment_type === "particular" && p.session_value);
    const existing = new Set(txs.data.filter((t) => t.category === "Mensalidade" && monthKey(t.due_date) === month).map((t) => t.patient_id));
    const rows = active.filter((p) => !existing.has(p.id)).map((p) => ({
      type: "receita" as const, category: "Mensalidade", patient_id: p.id, due_date: due,
      description: `Mensalidade ${MONTHS[m - 1]}/${y} — ${p.name}`, amount: Number(p.session_value) * (p.weekly_frequency ?? 1) * 4,
    }));
    if (!rows.length) return toast("Nenhuma mensalidade nova para gerar.");
    if (!confirm(`Gerar ${rows.length} mensalidade(s) com vencimento em ${formatDate(due)}?`)) return;
    await store.insertMany("transactions", rows);
    bump("transactions");
    toast(`${rows.length} mensalidade(s) gerada(s)`);
  }

  /** Cobra sessões realizadas (pacientes por sessão/convênio) ainda não lançadas. */
  async function billSessions() {
    const billedAppts = new Set(txs.data.map((t) => t.appointment_id).filter(Boolean));
    const rows = appts.data
      .filter((a) => a.status === "realizado" && a.patient_id && !billedAppts.has(a.id) && monthKey(new Date(a.starts_at)) === month)
      .map((a) => ({ a, p: pmap.get(a.patient_id!) }))
      .filter(({ p }) => p && p.payment_type === "convenio" && p.session_value)
      .map(({ a, p }) => ({
        type: "receita" as const, category: "Sessão", patient_id: p!.id, appointment_id: a.id, due_date: a.starts_at.slice(0, 10),
        description: `Sessão ${formatDate(a.starts_at.slice(0, 10))} — ${p!.name}${p!.insurance_name ? ` (${p!.insurance_name})` : ""}`, amount: Number(p!.session_value), method: "Convênio",
      }));
    if (!rows.length) return toast("Nenhuma sessão realizada pendente de lançamento (convênio).");
    if (!confirm(`Lançar ${rows.length} sessão(ões) realizada(s)?`)) return;
    await store.insertMany("transactions", rows);
    bump("transactions");
    toast(`${rows.length} sessão(ões) lançada(s)`);
  }

  async function exportExcel() {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = "NeuroPlanner";
    const ws = wb.addWorksheet(`Lançamentos ${month}`);
    ws.columns = [
      { header: "Tipo", key: "type", width: 10 }, { header: "Categoria", key: "category", width: 16 },
      { header: "Descrição", key: "description", width: 40 }, { header: "Paciente", key: "patient", width: 26 },
      { header: "Vencimento", key: "due", width: 12 }, { header: "Pago em", key: "paid", width: 12 },
      { header: "Status", key: "status", width: 11 }, { header: "Forma", key: "method", width: 14 },
      { header: "Valor (R$)", key: "amount", width: 14, style: { numFmt: '"R$" #,##0.00' } },
    ];
    ws.getRow(1).font = { bold: true };
    list.forEach((t) => ws.addRow({
      type: t.type, category: t.category, description: t.description, patient: t.patient_id ? pmap.get(t.patient_id)?.name : "",
      due: formatDate(t.due_date), paid: t.paid_at ? formatDate(t.paid_at) : "", status: txStatus(t).label, method: t.method,
      amount: t.type === "despesa" ? -Number(t.amount) : Number(t.amount),
    }));
    const flow = wb.addWorksheet("Fluxo de caixa");
    flow.columns = [{ header: "Mês", key: "x", width: 12 }, { header: "Receitas", key: "receitas", width: 14 }, { header: "Despesas", key: "despesas", width: 14 }, { header: "Lucro", key: "lucro", width: 14 }];
    flow.getRow(1).font = { bold: true };
    chart.forEach((c) => flow.addRow(c));
    const buf = await wb.xlsx.writeBuffer();
    downloadBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `financeiro-${month}.xlsx`);
  }

  async function markPaid(t: Transaction) {
    await txs.update(t.id, { paid_at: today() });
    toast("Pagamento registrado — recibo emitido");
  }

  // Resumo por paciente no mês selecionado
  const byPatient = patients.data
    .map((p) => {
      const own = billed.filter((t) => t.patient_id === p.id);
      return { p, pago: own.filter((t) => t.paid_at).reduce((s, t) => s + Number(t.amount), 0), aberto: own.filter((t) => !t.paid_at).reduce((s, t) => s + Number(t.amount), 0) };
    })
    .filter((x) => x.pago || x.aberto)
    .sort((a, b) => b.pago + b.aberto - (a.pago + a.aberto));

  if (txs.loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Financeiro" subtitle="Receitas, despesas, mensalidades e fluxo de caixa"
        actions={
          <>
            <Button variant="secondary" className="no-print" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
            <Button variant="secondary" className="no-print" onClick={() => window.print()}><FileDown className="h-4 w-4" /> PDF</Button>
            <Button className="no-print" onClick={() => setModal({ type: "receita", category: "Sessão", due_date: today() })}><Plus className="h-4 w-4" /> Lançamento</Button>
          </>
        } />

      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-44" />
        <Button variant="secondary" size="sm" className="h-9" onClick={generateMonthly}><Wand2 className="h-4 w-4" /> Gerar mensalidades</Button>
        <Button variant="secondary" size="sm" className="h-9" onClick={billSessions}><Receipt className="h-4 w-4" /> Lançar sessões realizadas</Button>
      </div>
      <p className="mb-4 hidden text-sm print:block">Período: {monthLabel}</p>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Entradas recebidas", money(received), "text-ink"],
          ["Saídas pagas", money(expenses), "text-ink"],
          ["Lucro", money(received - expenses), received - expenses >= 0 ? "text-emerald-700" : "text-red-600"],
          ["A receber (mês)", money(pendingMonth), "text-ink"],
          ["Inadimplência (geral)", `${delinquency}% · ${money(overdueTotal)}`, overdueTotal ? "text-red-600" : "text-ink"],
        ].map(([l, v, c]) => (
          <Card key={l} className="p-4">
            <p className="text-xs text-ink-soft">{l}</p>
            <p className={`mt-1 text-lg font-semibold tabular-nums ${c}`}>{v}</p>
          </Card>
        ))}
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Entradas e saídas" subtitle="Valores efetivamente pagos, últimos 6 meses" />
          <div className="p-5">
            <BarChart data={chart} xKey="x" series={[{ key: "receitas", label: "Entradas" }, { key: "despesas", label: "Saídas" }]} format={compact} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Fluxo de caixa" />
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-faint"><tr><th className="px-5 py-2 font-medium">Mês</th><th className="px-2 py-2 text-right font-medium">Saldo</th><th className="px-5 py-2 text-right font-medium">Acumulado</th></tr></thead>
            <tbody className="divide-y divide-line">
              {chart.map((c, i) => (
                <tr key={c.x}>
                  <td className="px-5 py-2 text-ink-soft">{c.x}</td>
                  <td className={`px-2 py-2 text-right tabular-nums ${c.lucro < 0 ? "text-red-600" : ""}`}>{money(c.lucro)}</td>
                  <td className="px-5 py-2 text-right tabular-nums text-ink-soft">{money(chart.slice(0, i + 1).reduce((s, x) => s + x.lucro, 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card>
        <CardHeader title={`Lançamentos — ${monthLabel}`}
          action={<div className="no-print flex flex-wrap gap-2">
            <Segmented value={type} onChange={setType} options={[{ value: "todos", label: "Todos" }, { value: "receita", label: "Receitas" }, { value: "despesa", label: "Despesas" }]} />
            <Select className="h-8 w-32 text-xs" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Status" options={[{ value: "pago", label: "Pago" }, { value: "pendente", label: "Pendente" }, { value: "atrasado", label: "Atrasado" }]} />
          </div>} />
        {list.length === 0 ? <EmptyState title="Nenhum lançamento no período" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-canvas text-left text-xs text-ink-faint">
                <tr><th className="px-5 py-2 font-medium">Descrição</th><th className="px-3 py-2 font-medium">Categoria</th><th className="px-3 py-2 font-medium">Vencimento</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 text-right font-medium">Valor</th><th className="no-print px-3 py-2" /></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((t) => {
                  const st = txStatus(t);
                  return (
                    <tr key={t.id}>
                      <td className="px-5 py-2.5">
                        <p>{t.description || t.category}</p>
                        {t.patient_id && <p className="text-xs text-ink-faint">{pmap.get(t.patient_id)?.name}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-ink-soft">{t.category}</td>
                      <td className="px-3 py-2.5 text-ink-soft">{formatDate(t.due_date)}</td>
                      <td className="px-3 py-2.5"><Badge tone={st.tone}>{st.label}</Badge></td>
                      <td className={`px-3 py-2.5 text-right font-medium tabular-nums ${t.type === "despesa" ? "text-red-600" : "text-emerald-700"}`}>{t.type === "despesa" ? "−" : "+"} {money(t.amount)}</td>
                      <td className="no-print px-3 py-2.5">
                        <div className="flex justify-end gap-1">
                          {!t.paid_at && <Button variant="ghost" size="sm" onClick={() => markPaid(t)} title="Marcar como pago"><CheckCircle2 className="h-4 w-4 text-emerald-600" /></Button>}
                          <Button variant="ghost" size="sm" onClick={() => setModal(t)} aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="sm" onClick={async () => { if (confirm("Excluir lançamento?")) await txs.remove(t.id); }} aria-label="Excluir"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={`Por paciente — ${monthLabel}`} subtitle="Cobranças com vencimento no mês" />
          {byPatient.length === 0 ? <EmptyState title="Sem cobranças no mês" /> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-ink-faint"><tr><th className="px-5 py-2 font-medium">Paciente</th><th className="px-2 py-2 text-right font-medium">Pago</th><th className="px-5 py-2 text-right font-medium">Em aberto</th></tr></thead>
              <tbody className="divide-y divide-line">
                {byPatient.map(({ p, pago, aberto }) => (
                  <tr key={p.id}>
                    <td className="px-5 py-2"><a className="hover:underline" href={`/pacientes/${p.id}?tab=financeiro`}>{p.name}</a></td>
                    <td className="px-2 py-2 text-right tabular-nums text-emerald-700">{money(pago)}</td>
                    <td className={`px-5 py-2 text-right tabular-nums ${aberto ? "text-red-600" : "text-ink-faint"}`}>{money(aberto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <div className="no-print"><ReceiptsList limit={8} /></div>
      </div>

      <TxModal open={Boolean(modal)} onClose={() => setModal(null)} initial={modal}
        onSave={async (t) => { if (t.id) await txs.update(t.id, t); else await txs.insert({ type: "receita", ...t }); toast("Lançamento salvo"); }} />
    </>
  );
}

export default function FinancePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <FinanceInner />
    </Suspense>
  );
}
