"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Ban, CalendarCheck, CheckCircle2, FileSpreadsheet, Pencil, Plus, Trash2, Wand2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, PageHeader, Select, Tabs, Textarea, useToast } from "@/components/ui";
import { Explain, FinLoading, Kpi, MoneyInput, NumTable } from "@/components/finance/kit";
import { TxForm, initialsLabel, payerName, type TxDraft } from "@/components/finance/tx-form";
import { useFinance } from "@/lib/finance/use-finance";
import { useCollection } from "@/lib/data/provider";
import type { FinContract, Transaction } from "@/lib/types";
import { addMonths, lastDayOf, monthLabel, monthLongLabel, monthOf, monthRange, weeksInMonth, type Month } from "@/lib/finance/calendar";
import { competenceOf, stateLabel, txState } from "@/lib/finance/ledger";
import { formatBRL, fromCents, toCents } from "@/lib/finance/money";
import { contractMonthlyRevenue, workCalendar } from "@/lib/finance/projection";
import { SERVICE_TYPES } from "@/lib/finance/categories";
import { downloadBlob } from "@/lib/utils";
import { STANDALONE } from "@/lib/finance/runtime";

type Tab = "lancamentos" | "contratos" | "prevista";

function ContractForm({ open, initial, onClose, onSave, patients, anonymize }: { open: boolean; initial: Partial<FinContract> | null; onClose: () => void; onSave: (c: Partial<FinContract>) => Promise<unknown>; patients: Array<{ id: string; name: string }>; anonymize: boolean }) {
  const [f, setF] = useState<Partial<FinContract>>(initial ?? {});
  const [last, setLast] = useState(initial);
  const [err, setErr] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  if (initial !== last) { setLast(initial); setF(initial ?? {}); setErr([]); }
  const set = (p: Partial<FinContract>) => setF((x) => ({ ...x, ...p }));
  async function submit() {
    const e: string[] = [];
    if (!f.label?.trim()) e.push("Informe um identificador (ex.: iniciais).");
    if (f.billing === "pacote_mensal" ? !f.monthly_amount : !f.unit_amount) e.push(f.billing === "pacote_mensal" ? "Informe o valor mensal do pacote." : "Informe o valor por sessão.");
    if (f.sessions_per_week === undefined || f.sessions_per_week < 0) e.push("Informe as sessões por semana.");
    if (!f.start_date) e.push("Informe o início.");
    if (f.end_date && f.start_date && f.end_date < f.start_date) e.push("O fim não pode ser antes do início.");
    if (f.attendance_rate !== null && f.attendance_rate !== undefined && (f.attendance_rate < 0 || f.attendance_rate > 1)) e.push("Presença deve ficar entre 0% e 100%.");
    setErr(e);
    if (e.length) return;
    setSaving(true);
    try { await onSave({ ...f, unit_amount: f.unit_amount ?? 0, patient_id: f.patient_id || null }); onClose(); } finally { setSaving(false); }
  }
  return (
    <Modal open={open} onClose={onClose} wide title={f.id ? "Editar contrato" : "Novo contrato / pacote"} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={saving} onClick={submit}>Salvar</Button></>}>
      <div className="space-y-3">
        {err.length > 0 && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{err.map((x) => <p key={x}>{x}</p>)}</div>}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Identificador" hint="Iniciais ou código; é o que aparece nos relatórios."><Input value={f.label ?? ""} onChange={(e) => set({ label: e.target.value })} maxLength={40} /></Field>
          {!STANDALONE && <Field label="Paciente (opcional)"><Select value={f.patient_id ?? ""} onChange={(e) => set({ patient_id: e.target.value || null })} placeholder="—" options={patients.map((p) => ({ value: p.id, label: anonymize ? initialsLabel(p.name) : p.name }))} /></Field>}
          <Field label="Serviço"><Select value={f.service_type ?? "Sessão avulsa"} onChange={(e) => set({ service_type: e.target.value })} options={SERVICE_TYPES} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Cobrança"><Select value={f.billing ?? "por_sessao"} onChange={(e) => set({ billing: e.target.value as FinContract["billing"] })} options={[{ value: "por_sessao", label: "Por sessão" }, { value: "pacote_mensal", label: "Pacote mensal fixo" }]} /></Field>
          <Field label="Sessões por semana"><Input type="number" min={0} step="0.5" value={f.sessions_per_week ?? ""} onChange={(e) => set({ sessions_per_week: Number(e.target.value) })} /></Field>
          <Field label="Valor recebido por sessão" hint="Já sem o desconto do convênio"><MoneyInput value={f.unit_amount} onChange={(v) => set({ unit_amount: v ?? 0 })} /></Field>
          {f.billing === "pacote_mensal" && <Field label="Valor do pacote/mês"><MoneyInput value={f.monthly_amount} onChange={(v) => set({ monthly_amount: v })} /></Field>}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Quem paga"><Select value={f.payer_kind ?? "a_confirmar"} onChange={(e) => set({ payer_kind: e.target.value as FinContract["payer_kind"] })} options={[{ value: "pf", label: "Pessoa física" }, { value: "pj", label: "Pessoa jurídica (plano)" }, { value: "a_confirmar", label: "A confirmar" }]} /></Field>
          <Field label="Recebimento"><Select value={f.payment_timing ?? "mesmo_mes"} onChange={(e) => set({ payment_timing: e.target.value as FinContract["payment_timing"] })} options={[{ value: "mesmo_mes", label: "No mesmo mês" }, { value: "mes_seguinte", label: "No mês seguinte" }]} /></Field>
          <Field label="Dia de pagamento"><Input type="number" min={1} max={31} value={f.payment_day ?? ""} onChange={(e) => set({ payment_day: e.target.value ? Number(e.target.value) : null })} placeholder="após a sessão" /></Field>
          <Field label="Presença esperada (%)" hint="Vazio = histórico/cenário"><Input type="number" min={0} max={100} value={f.attendance_rate === null || f.attendance_rate === undefined ? "" : Math.round(f.attendance_rate * 100)} onChange={(e) => set({ attendance_rate: e.target.value === "" ? null : Number(e.target.value) / 100 })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Início"><Input type="date" value={f.start_date ?? ""} onChange={(e) => set({ start_date: e.target.value })} /></Field>
          <Field label="Fim (se houver)"><Input type="date" value={f.end_date ?? ""} onChange={(e) => set({ end_date: e.target.value || null })} /></Field>
          <label className="mt-6 inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(f.charges_absences)} onChange={(e) => set({ charges_absences: e.target.checked })} /> Falta é cobrada</label>
          <label className="mt-6 inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active ?? true} onChange={(e) => set({ active: e.target.checked })} /> Ativo</label>
        </div>
        <Field label="Observações"><Textarea rows={2} value={f.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} maxLength={400} /></Field>
      </div>
    </Modal>
  );
}

function RevenueInner() {
  const params = useSearchParams();
  const toast = useToast();
  const f = useFinance();
  const appts = useCollection("appointments");
  const [tab, setTab] = useState<Tab>((params.get("aba") as Tab) || "lancamentos");
  const [month, setMonth] = useState<string>(params.get("mes") || "");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<TxDraft | null>(params.get("novo") === "1" ? { type: "receita", status: "faturado", service_type: "Sessão avulsa", category: "Sessão avulsa", due_date: new Date().toISOString().slice(0, 10), payer_kind: "a_confirmar" } : null);
  const [cModal, setCModal] = useState<Partial<FinContract> | null>(null);
  const pmap = useMemo(() => new Map(f.patients.map((p) => [p.id, p])), [f.patients]);

  const a = f.analysis;
  const current = a?.currentMonth ?? monthOf(f.today)!;
  const viewMonth = (month || current) as Month;
  const revenues = f.data.transactions.filter((t) => t.type === "receita");
  const list = revenues
    .filter((t) => (status === "atrasado" ? true : competenceOf(t) === viewMonth))
    .filter((t) => !status || txState(t, f.today) === status || (status === "atrasado" && txState(t, f.today) === "atrasado"))
    .filter((t) => !q || `${payerName(t, pmap, f.settings.anonymize)} ${t.service_type ?? ""} ${t.description ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .sort((x, y) => (x.service_date ?? x.due_date).localeCompare(y.service_date ?? y.due_date));

  if (f.loading || !a) return <FinLoading />;
  const led = a.ledger.get(viewMonth);
  const sum = (l: Transaction[]) => fromCents(l.reduce((s, t) => s + toCents(t.amount), 0));

  async function saveTx(t: TxDraft) {
    await f.save("transactions", t as Partial<Transaction> & { id?: string });
    toast("Receita salva");
  }

  /** Cria lançamentos previstos do mês a partir dos contratos ainda sem lançamento. */
  async function generateFromContracts() {
    const cal = workCalendar(f.settings);
    const weeks = weeksInMonth(viewMonth, cal);
    const att = a!.projections.realista.attendance;
    const comp = revenues.filter((t) => competenceOf(t) === viewMonth && t.status !== "cancelado");
    const rows: Partial<Transaction>[] = [];
    for (const k of f.data.contracts.filter((c) => c.active && c.start_date <= lastDayOf(viewMonth) && (!c.end_date || c.end_date >= `${viewMonth}-01`))) {
      if (comp.some((t) => t.contract_id === k.id || (k.patient_id && t.patient_id === k.patient_id) || (t.payer_label && t.payer_label === k.label))) continue;
      const est = contractMonthlyRevenue(k, weeks, att);
      const sessions = Math.round(est.billed);
      const payMonth = k.payment_timing === "mes_seguinte" ? addMonths(viewMonth, 1) : viewMonth;
      const day = String(Math.min(k.payment_day ?? 28, Number(lastDayOf(payMonth).slice(8)))).padStart(2, "0");
      rows.push({
        type: "receita", status: "previsto", category: k.service_type, service_type: k.service_type, competence: viewMonth, contract_id: k.id, patient_id: k.patient_id ?? null,
        payer_label: k.label, payer_kind: k.payer_kind, sessions: k.billing === "por_sessao" ? sessions : null, unit_amount: k.billing === "por_sessao" ? k.unit_amount : null,
        amount: k.billing === "por_sessao" ? fromCents(toCents(k.unit_amount) * sessions) : est.revenue, due_date: `${payMonth}-${day}`, estimated: true,
        notes: `Gerado do contrato (${k.sessions_per_week}/sem × ${weeks.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} semanas). Confirme quando faturar.`,
      });
    }
    if (!rows.length) return toast("Todos os contratos ativos já têm lançamento neste mês.");
    if (!confirm(`Criar ${rows.length} lançamento(s) PREVISTO(S) para ${monthLongLabel(viewMonth)}? Eles não contam como dinheiro até serem confirmados.`)) return;
    await f.saveMany("transactions", rows, `Gerou ${rows.length} receita(s) prevista(s) de ${viewMonth} a partir dos contratos`);
    toast(`${rows.length} lançamento(s) previsto(s) criado(s)`);
  }

  /** Lança sessões realizadas da agenda para pacientes sem contrato (uma linha por paciente no mês). */
  async function billFromAgenda() {
    const withContract = new Set(f.data.contracts.filter((k) => k.patient_id).map((k) => k.patient_id));
    const billed = new Set(revenues.map((t) => t.appointment_id).filter(Boolean));
    const done = appts.data.filter((x) => x.status === "realizado" && x.patient_id && !billed.has(x.id) && monthOf(x.starts_at.slice(0, 10)) === viewMonth && !withContract.has(x.patient_id));
    const rows = done.map((x) => {
      const p = pmap.get(x.patient_id!);
      return p?.session_value ? {
        type: "receita" as const, status: "faturado" as const, category: "Sessão avulsa", service_type: "Sessão avulsa", patient_id: p.id, appointment_id: x.id,
        payer_label: initialsLabel(p.name), payer_kind: (p.payment_type === "convenio" ? "a_confirmar" : "pf") as Transaction["payer_kind"], sessions: 1, sessions_done: 1, unit_amount: p.session_value,
        amount: p.session_value, service_date: x.starts_at.slice(0, 10), competence: viewMonth, due_date: x.starts_at.slice(0, 10),
      } : null;
    }).filter(Boolean) as Partial<Transaction>[];
    if (!rows.length) return toast("Nenhuma sessão realizada na agenda sem lançamento (pacientes sem contrato e com valor cadastrado).");
    if (!confirm(`Lançar ${rows.length} sessão(ões) realizada(s) da agenda?`)) return;
    await f.saveMany("transactions", rows, `Lançou ${rows.length} sessão(ões) da agenda em ${viewMonth}`);
    toast(`${rows.length} sessão(ões) lançada(s)`);
  }

  async function exportExcel() {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`Receitas ${viewMonth}`);
    ws.columns = [
      { header: "Competência", key: "comp", width: 11 }, { header: "Atendimento", key: "svc", width: 12 }, { header: "Pagador", key: "payer", width: 18 },
      { header: "Serviço", key: "type", width: 18 }, { header: "Sessões", key: "sessions", width: 8 }, { header: "Valor unit.", key: "unit", width: 11 },
      { header: "Desconto", key: "disc", width: 10 }, { header: "Valor", key: "amount", width: 12 }, { header: "Previsto p/", key: "due", width: 12 },
      { header: "Recebido em", key: "paid", width: 12 }, { header: "Status", key: "status", width: 12 }, { header: "Fonte pagadora", key: "pk", width: 12 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const t of list) ws.addRow({ comp: competenceOf(t), svc: t.service_date ?? "", payer: payerName(t, pmap, f.settings.anonymize), type: t.service_type ?? t.category, sessions: t.sessions ?? "", unit: t.unit_amount ?? "", disc: t.discount ?? "", amount: t.amount, due: t.due_date, paid: t.paid_at ?? "", status: stateLabel(txState(t, f.today), "receita").label, pk: t.payer_kind ?? "" });
    const buf = await wb.xlsx.writeBuffer();
    downloadBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `receitas-${viewMonth}.xlsx`);
  }

  // Receita prevista por mês (contratos ativos, presença realista)
  const cal = workCalendar(f.settings);
  const expMonths = monthRange(current, addMonths(current, 11));
  const att = a.projections.realista.attendance;
  const activeContracts = f.data.contracts.filter((k) => k.active);

  return (
    <>
      <PageHeader title="Receitas e atendimentos" subtitle="Faturado (competência) é diferente de recebido (caixa). Previsto nunca conta como dinheiro."
        actions={<>
          <Button variant="secondary" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
          <Button variant="secondary" onClick={() => setCModal({ billing: "por_sessao", sessions_per_week: 1, payer_kind: "a_confirmar", payment_timing: "mesmo_mes", start_date: f.today, active: true, charges_absences: false, service_type: "Sessão avulsa", unit_amount: f.settings.reference_price })}><Plus className="h-4 w-4" /> Contrato</Button>
          <Button onClick={() => setModal({ type: "receita", status: "faturado", service_type: "Sessão avulsa", category: "Sessão avulsa", due_date: f.today, competence: current, payer_kind: "a_confirmar" })}><Plus className="h-4 w-4" /> Receita</Button>
        </>} />

      <Tabs value={tab} onChange={setTab} tabs={[{ value: "lancamentos", label: "Lançamentos" }, { value: "contratos", label: `Contratos e pacotes (${activeContracts.length})` }, { value: "prevista", label: "Receita prevista por mês" }]} />
      <div className="mt-4" />

      {tab === "lancamentos" && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Input type="month" className="w-44" value={viewMonth} onChange={(e) => setMonth(e.target.value)} aria-label="Mês de competência" />
            <Select className="w-44" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Todos os status" options={[{ value: "previsto", label: "Previsto" }, { value: "aberto", label: "A receber" }, { value: "atrasado", label: "Atrasado (todos os meses)" }, { value: "quitado", label: "Recebido" }, { value: "cancelado", label: "Cancelado" }]} />
            <Input className="w-52" placeholder="Buscar pagador ou serviço" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button variant="secondary" size="sm" className="h-9" onClick={generateFromContracts}><Wand2 className="h-4 w-4" /> Gerar previstos dos contratos</Button>
            {!STANDALONE && <Button variant="secondary" size="sm" className="h-9" onClick={billFromAgenda}><CalendarCheck className="h-4 w-4" /> Lançar sessões da agenda</Button>}
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label="Faturado no mês" value={formatBRL(led?.grossBilled ?? 0)} hint={led?.discounts ? `Descontos: ${formatBRL(led.discounts)}` : undefined} />
            <Kpi label="Recebido no mês (caixa)" value={formatBRL(led?.received ?? 0)} />
            <Kpi label="Previsto (não confirmado)" value={formatBRL(sum(revenues.filter((t) => competenceOf(t) === viewMonth && t.status === "previsto")))} tone="muted" />
            <Kpi label="Cancelado" value={formatBRL(led?.cancelled ?? 0)} tone="muted" />
            <Kpi label="Sessões realizadas · faltas" value={`${led?.sessionsDone ?? 0} · ${led?.absences ?? 0}`} hint={led && led.sessionsDone + led.absences ? `Presença ${Math.round((led.sessionsDone / (led.sessionsDone + led.absences)) * 100)}%` : undefined} />
          </div>
          <Card>
            <CardHeader title={status === "atrasado" ? "Recebimentos em atraso" : `Receitas — ${monthLongLabel(viewMonth)}`} subtitle={`${list.length} lançamento(s) · ${formatBRL(sum(list))}`} />
            {list.length === 0 ? (
              <EmptyState title="Nenhuma receita neste filtro" text="Cadastre uma receita, gere os previstos a partir dos contratos ou importe a planilha em Configurações › Importar." />
            ) : (
              <NumTable minWidth={900}
                head={["Pagador · serviço", "Atendimento", "Sessões", "Valor", "Previsto p/", "Recebido", "Status", ""]}
                rows={list.map((t) => {
                  const st = stateLabel(txState(t, f.today), "receita");
                  return [
                    <div key="p"><p className="font-medium">{payerName(t, pmap, f.settings.anonymize)}</p><p className="text-xs text-ink-faint">{t.service_type ?? t.category}{t.payer_kind === "pj" ? " · PJ" : t.payer_kind === "a_confirmar" || !t.payer_kind ? " · pagador a confirmar" : ""}{t.estimated ? " · estimado" : ""}{t.dates_estimated ? " · data estimada" : ""}</p></div>,
                    t.service_date ? t.service_date.split("-").reverse().join("/") : monthLabel(competenceOf(t)),
                    t.sessions ? <span key="se">{t.sessions}{t.sessions_done !== null && t.sessions_done !== undefined && <span className="block text-[11px] text-ink-faint">{t.sessions_done} realizada(s){t.absences ? ` · ${t.absences} falta(s)` : ""}</span>}</span> : "—",
                    <span key="v" className="font-medium">{formatBRL(t.amount)}</span>,
                    t.due_date.split("-").reverse().join("/"),
                    t.paid_at ? t.paid_at.split("-").reverse().join("/") : "—",
                    <Badge key="s" tone={st.tone}>{st.label}</Badge>,
                    <div key="a" className="flex justify-end gap-1">
                      {t.status === "previsto" && <Button variant="ghost" size="sm" title="Confirmar faturamento" onClick={async () => { await f.save("transactions", { id: t.id, status: "faturado", estimated: false }); toast("Faturamento confirmado"); }}><CheckCircle2 className="h-4 w-4 text-sage-600" /></Button>}
                      {!t.paid_at && t.status !== "cancelado" && <Button variant="ghost" size="sm" title="Marcar como recebido hoje" onClick={async () => { await f.save("transactions", { id: t.id, paid_at: f.today, status: "faturado" }); toast("Recebimento registrado"); }}><CheckCircle2 className="h-4 w-4 text-emerald-600" /></Button>}
                      {!t.paid_at && t.status !== "cancelado" && <Button variant="ghost" size="sm" title="Cancelar" onClick={async () => { if (confirm("Marcar como cancelado? O valor deixa de contar no faturamento.")) await f.save("transactions", { id: t.id, status: "cancelado" }); }}><Ban className="h-3.5 w-3.5" /></Button>}
                      <Button variant="ghost" size="sm" aria-label="Editar" onClick={() => setModal(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" aria-label="Excluir" onClick={async () => { if (confirm("Excluir este lançamento? A alteração fica no histórico.")) await f.remove("transactions", t.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>,
                  ];
                })} />
            )}
          </Card>
        </>
      )}

      {tab === "contratos" && (
        <Card>
          <CardHeader title="Contratos, pacotes e atendimentos recorrentes" subtitle="Base da receita projetada. Use valores recebidos de fato (líquidos do desconto do convênio)." />
          {f.data.contracts.length === 0 ? (
            <EmptyState title="Nenhum contrato cadastrado" text="Cadastre cada paciente recorrente (sessões por semana e valor). Se você importou a planilha, use o botão em Configurações › Importar para criar os contratos a partir do último mês." action={<Button onClick={() => setCModal({ billing: "por_sessao", sessions_per_week: 1, payer_kind: "a_confirmar", payment_timing: "mesmo_mes", start_date: f.today, active: true, charges_absences: false, service_type: "Sessão avulsa", unit_amount: f.settings.reference_price })}><Plus className="h-4 w-4" /> Novo contrato</Button>} />
          ) : (
            <NumTable minWidth={820}
              head={["Identificador", "Sessões/sem", "Valor", "Receita estimada/mês", "Pagador", "Vigência", ""]}
              rows={f.data.contracts.map((k) => [
                <div key="l"><p className="font-medium">{k.label}{!k.active && <Badge className="ml-2">inativo</Badge>}</p><p className="text-xs text-ink-faint">{k.service_type}{k.charges_absences ? " · cobra falta" : ""}</p></div>,
                k.sessions_per_week.toLocaleString("pt-BR"),
                k.billing === "pacote_mensal" ? `${formatBRL(k.monthly_amount)}/mês` : `${formatBRL(k.unit_amount)}/sessão`,
                formatBRL(contractMonthlyRevenue(k, weeksInMonth(addMonths(current, 1), cal), att).revenue),
                k.payer_kind === "pf" ? "PF" : k.payer_kind === "pj" ? "PJ" : "a confirmar",
                `${k.start_date.split("-").reverse().join("/")}${k.end_date ? ` a ${k.end_date.split("-").reverse().join("/")}` : ""}`,
                <div key="a" className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" aria-label="Editar" onClick={() => setCModal(k)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" aria-label="Excluir" onClick={async () => { if (confirm("Excluir contrato? Os lançamentos já feitos continuam.")) await f.remove("fin_contracts", k.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>,
              ])} />
          )}
          <div className="border-t border-line px-5 py-3"><Explain steps={[
            `Receita estimada do mês seguinte (${monthLabel(addMonths(current, 1))}) = sessões/semana × ${weeksInMonth(addMonths(current, 1), cal).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} semanas de atendimento (dias úteis reais ÷ dias por semana) × presença ${Math.round(att * 100)}% × valor por sessão.`,
            "Se a falta é cobrada, conta a sessão contratada; se não, só a realizada.",
            "Pacote mensal fixo: o valor do pacote, reduzido proporcionalmente em meses com férias cadastradas.",
          ]} /></div>
        </Card>
      )}

      {tab === "prevista" && (
        <Card>
          <CardHeader title="Receita prevista por mês" subtitle={`Contratos ativos, presença ${Math.round(att * 100)}% (${a.projections.realista.attendanceSource}). Sem crescimento automático.`} />
          {activeContracts.length === 0 ? <EmptyState title="Cadastre os contratos ativos para ver a receita prevista" /> : (
            <NumTable minWidth={760}
              head={["Mês", "Semanas", "Sessões contratadas", "Sessões realizadas (est.)", "Receita prevista", "Já lançado"]}
              rows={expMonths.map((m) => {
                const w = weeksInMonth(m, cal);
                let planned = 0, done = 0, rev = 0;
                for (const k of activeContracts) {
                  if (k.start_date > lastDayOf(m) || (k.end_date && k.end_date < `${m}-01`)) continue;
                  const e = contractMonthlyRevenue(k, w, att);
                  planned += e.planned; done += e.done; rev += e.revenue;
                }
                return [monthLabel(m), w.toLocaleString("pt-BR", { maximumFractionDigits: 1 }), planned.toLocaleString("pt-BR", { maximumFractionDigits: 1 }), done.toLocaleString("pt-BR", { maximumFractionDigits: 1 }), formatBRL(rev), formatBRL(a.ledger.get(m)?.grossBilled ?? 0)];
              })} />
          )}
        </Card>
      )}

      <TxForm open={Boolean(modal)} initial={modal} onClose={() => setModal(null)} onSave={saveTx} patients={f.patients} settings={f.settings} store={f.store} />
      <ContractForm open={Boolean(cModal)} initial={cModal} onClose={() => setCModal(null)} patients={f.patients} anonymize={f.settings.anonymize}
        onSave={async (c) => { await f.save("fin_contracts", c as Partial<FinContract> & { id?: string }); toast("Contrato salvo"); }} />
    </>
  );
}

export default function RevenuePage() {
  return <Suspense fallback={<FinLoading />}><RevenueInner /></Suspense>;
}
