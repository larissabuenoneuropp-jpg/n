"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Ban, CheckCircle2, FileSpreadsheet, Paperclip, Pencil, Plus, Trash2, Wand2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, PageHeader, Select, Tabs, Textarea, useToast } from "@/components/ui";
import { Explain, FinLoading, Kpi, MoneyInput, NumTable, pctLabel } from "@/components/finance/kit";
import { TxForm, type TxDraft } from "@/components/finance/tx-form";
import { useFinance } from "@/lib/finance/use-finance";
import type { CostNature, FinRecurring, TaxClass, Transaction } from "@/lib/types";
import { EXPENSE_CATEGORIES_FIN, NATURE_LABEL, TAX_CLASS_LABEL, expenseCategory } from "@/lib/finance/categories";
import { addMonths, lastDayOf, monthLabel, monthLongLabel, monthOf, monthRange, type Month } from "@/lib/finance/calendar";
import { competenceOf, stateLabel, txState } from "@/lib/finance/ledger";
import { formatBRL, fromCents, toCents } from "@/lib/finance/money";
import { downloadBlob } from "@/lib/utils";

type Tab = "lancamentos" | "recorrentes" | "custos" | "compromissos";

function RecurringForm({ open, initial, onClose, onSave }: { open: boolean; initial: Partial<FinRecurring> | null; onClose: () => void; onSave: (r: Partial<FinRecurring>) => Promise<unknown> }) {
  const [f, setF] = useState<Partial<FinRecurring>>(initial ?? {});
  const [last, setLast] = useState(initial);
  const [err, setErr] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  if (initial !== last) { setLast(initial); setF(initial ?? {}); setErr([]); }
  const set = (p: Partial<FinRecurring>) => setF((x) => ({ ...x, ...p }));
  async function submit() {
    const e: string[] = [];
    if (!f.description?.trim()) e.push("Informe a descrição.");
    if (!f.amount || f.amount <= 0) e.push("Informe o valor.");
    if (!f.start_date) e.push("Informe o início.");
    if (f.end_date && f.start_date && f.end_date < f.start_date) e.push("O fim não pode ser antes do início.");
    if (f.basis === "anual" && !f.month_of_year) e.push("Informe o mês da cobrança anual.");
    setErr(e);
    if (e.length) return;
    setSaving(true);
    try { await onSave(f); onClose(); } finally { setSaving(false); }
  }
  const cat = expenseCategory(f.category);
  return (
    <Modal open={open} onClose={onClose} wide title={f.id ? "Editar despesa recorrente" : "Nova despesa recorrente"} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={saving} onClick={submit}>Salvar</Button></>}>
      <div className="space-y-3">
        {err.length > 0 && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{err.map((x) => <p key={x}>{x}</p>)}</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Descrição"><Input value={f.description ?? ""} onChange={(e) => set({ description: e.target.value })} maxLength={100} /></Field>
          <Field label="Categoria"><Select value={cat.name} onChange={(e) => { const c = expenseCategory(e.target.value); set({ category: c.name, nature: c.nature, tax_class: c.taxClass }); }} options={EXPENSE_CATEGORIES_FIN.filter((c) => !c.incomeTax).map((c) => c.name)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Cobrança"><Select value={f.basis ?? "mensal"} onChange={(e) => set({ basis: e.target.value as FinRecurring["basis"] })} options={[{ value: "mensal", label: "Mensal" }, { value: "anual", label: "Anual" }, { value: "por_sessao", label: "Por sessão realizada" }]} /></Field>
          <Field label={f.basis === "por_sessao" ? "Valor por sessão" : "Valor"}><MoneyInput value={f.amount} onChange={(v) => set({ amount: v ?? 0 })} /></Field>
          {f.basis === "anual"
            ? <Field label="Mês da cobrança"><Input type="number" min={1} max={12} value={f.month_of_year ?? ""} onChange={(e) => set({ month_of_year: Number(e.target.value) || null })} /></Field>
            : <Field label="Dia do vencimento"><Input type="number" min={1} max={31} value={f.day_of_month ?? ""} onChange={(e) => set({ day_of_month: Number(e.target.value) || null })} /></Field>}
          <Field label="Natureza"><Select value={f.nature ?? cat.nature} onChange={(e) => set({ nature: e.target.value as CostNature })} options={Object.entries(NATURE_LABEL).map(([value, label]) => ({ value, label }))} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Início"><Input type="date" value={f.start_date ?? ""} onChange={(e) => set({ start_date: e.target.value })} /></Field>
          <Field label="Término (cursos, contratos)"><Input type="date" value={f.end_date ?? ""} onChange={(e) => set({ end_date: e.target.value || null })} /></Field>
          <Field label="Reajuste anual (%)"><Input type="number" step="0.1" value={f.adjust_pct ?? ""} onChange={(e) => set({ adjust_pct: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
          <Field label="Mês do reajuste"><Input type="number" min={1} max={12} value={f.adjust_month ?? ""} onChange={(e) => set({ adjust_month: Number(e.target.value) || null })} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Classificação fiscal"><Select value={f.tax_class ?? cat.taxClass} onChange={(e) => set({ tax_class: e.target.value as TaxClass })} options={Object.entries(TAX_CLASS_LABEL).map(([value, label]) => ({ value, label }))} /></Field>
          <div className="flex items-end gap-4 pb-2 text-sm">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={f.active ?? true} onChange={(e) => set({ active: e.target.checked })} /> Ativa</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={Boolean(f.estimated)} onChange={(e) => set({ estimated: e.target.checked })} /> Valor estimado</label>
          </div>
        </div>
        <Field label="Observações"><Textarea rows={2} value={f.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} maxLength={400} /></Field>
      </div>
    </Modal>
  );
}

/** O recorrente está vigente no mês? */
const activeIn = (r: FinRecurring, m: Month) => r.active && r.start_date <= lastDayOf(m) && (!r.end_date || r.end_date >= `${m}-01`) && (r.basis !== "anual" || Number(m.slice(5)) === (r.month_of_year ?? 1));

function ExpensesInner() {
  const params = useSearchParams();
  const toast = useToast();
  const f = useFinance();
  const [tab, setTab] = useState<Tab>((params.get("aba") as Tab) || "lancamentos");
  const [month, setMonth] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [modal, setModal] = useState<TxDraft | null>(null);
  const [rModal, setRModal] = useState<Partial<FinRecurring> | null>(null);
  const a = f.analysis;
  const current = a?.currentMonth ?? monthOf(f.today)!;
  const viewMonth = (month || current) as Month;
  const expenses = useMemo(() => f.data.transactions.filter((t) => t.type === "despesa"), [f.data.transactions]);

  if (f.loading || !a) return <FinLoading />;
  const list = expenses
    .filter((t) => competenceOf(t) === viewMonth && (!cat || t.category === cat) && (!status || txState(t, f.today) === status))
    .sort((x, y) => x.due_date.localeCompare(y.due_date));
  const sum = (l: Transaction[]) => fromCents(l.reduce((s, t) => s + toCents(t.amount), 0));
  const led = a.ledger.get(viewMonth);

  async function launchRecurring() {
    const comp = expenses.filter((t) => competenceOf(t) === viewMonth && t.status !== "cancelado");
    const sessions = a!.projections.realista.months.find((m) => m.month === viewMonth)?.expectedSessionsDone ?? led?.sessionsDone ?? 0;
    const rows: Partial<Transaction>[] = [];
    for (const r of f.data.recurring.filter((x) => activeIn(x, viewMonth))) {
      if (comp.some((t) => t.recurring_id === r.id || (!t.recurring_id && t.category === r.category && (r.basis === "por_sessao" || Math.abs(t.amount - r.amount) <= Math.max(1, r.amount * 0.1))))) continue;
      const amount = r.basis === "por_sessao" ? fromCents(Math.round(toCents(r.amount) * Math.round(sessions))) : r.amount;
      if (amount <= 0) continue;
      const day = String(Math.min(r.day_of_month ?? 10, Number(lastDayOf(viewMonth).slice(8)))).padStart(2, "0");
      rows.push({ type: "despesa", category: r.category, description: r.description, amount, competence: viewMonth, due_date: `${viewMonth}-${day}`, status: r.estimated || r.basis === "por_sessao" ? "previsto" : "faturado", nature: r.nature, tax_class: r.tax_class, recurring_id: r.id, estimated: r.estimated || r.basis === "por_sessao", notes: r.basis === "por_sessao" ? `${Math.round(sessions)} sessões × ${formatBRL(r.amount)} (estimativa; ajuste ao valor real)` : null });
    }
    if (!rows.length) return toast("As despesas recorrentes deste mês já estão lançadas.");
    if (!confirm(`Lançar ${rows.length} despesa(s) recorrente(s) de ${monthLongLabel(viewMonth)}?`)) return;
    await f.saveMany("transactions", rows, `Lançou ${rows.length} despesa(s) recorrente(s) de ${viewMonth}`);
    toast(`${rows.length} despesa(s) lançada(s)`);
  }

  async function seedFromBriefing() {
    if (!confirm("Criar as despesas recorrentes informadas no briefing (todas marcadas como estimadas, para você conferir)?\n\n• Espaço compartilhado: R$ 30 por atendimento\n• Supervisão: R$ 600/mês\n• Condomínio: R$ 550/mês — INATIVO (possível duplicidade com o custo por atendimento)")) return;
    const start = `${current}-01`;
    const rows: Partial<FinRecurring>[] = [
      { description: "Espaço compartilhado (por atendimento)", category: "Espaço por atendimento", amount: 30, basis: "por_sessao", start_date: start, nature: "variavel", tax_class: "a_confirmar", active: true, estimated: true, notes: "Briefing: aproximadamente R$ 30 por atendimento. Planilha: usado a partir de ago/26." },
      { description: "Supervisão profissional", category: "Supervisão profissional", amount: 600, basis: "mensal", day_of_month: 10, start_date: start, nature: "fixo", tax_class: "a_confirmar", active: true, estimated: true, notes: "Briefing e planilha: R$ 600/mês." },
      { description: "Condomínio (estrutura, água, energia, internet, café, limpeza)", category: "Condomínio e estrutura", amount: 550, basis: "mensal", day_of_month: 10, start_date: start, nature: "fixo", tax_class: "dedutivel", active: false, estimated: true, notes: "Briefing: ~R$ 550/mês. Na planilha, desde ago/26 não há condomínio lançado — parece incluído no custo por atendimento. Ative só se confirmar que é cobrado à parte." },
    ];
    await f.saveMany("fin_recurring", rows, "Criou despesas recorrentes iniciais do briefing (estimadas)");
    toast("Despesas recorrentes criadas — confira os valores");
  }

  async function exportExcel() {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`Despesas ${viewMonth}`);
    ws.columns = [{ header: "Competência", key: "c", width: 11 }, { header: "Descrição", key: "d", width: 32 }, { header: "Categoria", key: "cat", width: 30 }, { header: "Natureza", key: "n", width: 14 }, { header: "Fiscal", key: "tc", width: 22 }, { header: "Vencimento", key: "due", width: 12 }, { header: "Pago em", key: "paid", width: 12 }, { header: "Status", key: "s", width: 10 }, { header: "Valor", key: "v", width: 12 }];
    ws.getRow(1).font = { bold: true };
    for (const t of list) ws.addRow({ c: competenceOf(t), d: t.description, cat: t.category, n: NATURE_LABEL[t.nature ?? expenseCategory(t.category).nature], tc: TAX_CLASS_LABEL[t.tax_class ?? f.settings.tax.deductibility[t.category]?.tax_class ?? expenseCategory(t.category).taxClass], due: t.due_date, paid: t.paid_at ?? "", s: stateLabel(txState(t, f.today), "despesa").label, v: t.amount });
    const buf = await wb.xlsx.writeBuffer();
    downloadBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `despesas-${viewMonth}.xlsx`);
  }

  // Visão de custos (média dos últimos 3 meses fechados + recorrentes)
  const last3 = a.closed.slice(-3);
  const avg = (fn: (r: typeof last3[number]) => number) => (last3.length ? last3.reduce((s, r) => s + fn(r), 0) / last3.length : 0);
  const avgDone = avg((r) => r.sessionsDone);
  const annualRec = f.data.recurring.filter((r) => r.active && r.basis === "anual");
  const annualCfg = [f.settings.tax.iss.annual_amount ?? 0, ...f.settings.tax.annual_fees.map((x) => x.amount ?? 0)].reduce((s, v) => s + v, 0);
  const annualTotal = annualRec.reduce((s, r) => s + r.amount, 0) + annualCfg;
  const next12 = monthRange(current, addMonths(current, 11));

  return (
    <>
      <PageHeader title="Despesas" subtitle="Custos fixos, variáveis, extraordinários e investimentos — sem contar o mesmo gasto duas vezes"
        actions={<>
          <Button variant="secondary" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
          <Button variant="secondary" onClick={() => setRModal({ basis: "mensal", start_date: f.today, active: true, estimated: false, category: "Supervisão profissional", nature: "fixo", tax_class: "a_confirmar" })}><Plus className="h-4 w-4" /> Recorrente</Button>
          <Button onClick={() => setModal({ type: "despesa", status: "faturado", category: "Materiais e instrumentos de avaliação", due_date: f.today, competence: current })}><Plus className="h-4 w-4" /> Despesa</Button>
        </>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "lancamentos", label: "Lançamentos" }, { value: "recorrentes", label: `Recorrentes (${f.data.recurring.filter((r) => r.active).length})` }, { value: "custos", label: "Visão de custos" }, { value: "compromissos", label: "Compromissos futuros" }]} />
      <div className="mt-4" />

      {tab === "lancamentos" && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Input type="month" className="w-44" value={viewMonth} onChange={(e) => setMonth(e.target.value)} aria-label="Mês de competência" />
            <Select className="w-64" value={cat} onChange={(e) => setCat(e.target.value)} placeholder="Todas as categorias" options={EXPENSE_CATEGORIES_FIN.map((c) => c.name)} />
            <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Todos os status" options={[{ value: "previsto", label: "Previsto" }, { value: "aberto", label: "A pagar" }, { value: "atrasado", label: "Atrasado" }, { value: "quitado", label: "Pago" }, { value: "cancelado", label: "Cancelado" }]} />
            <Button variant="secondary" size="sm" className="h-9" onClick={launchRecurring}><Wand2 className="h-4 w-4" /> Lançar recorrentes do mês</Button>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label="Fixas" value={formatBRL((led?.fixedCosts ?? 0) + (led?.operatingTaxes ?? 0))} />
            <Kpi label="Variáveis" value={formatBRL(led?.variableCosts ?? 0)} />
            <Kpi label="Extraordinárias" value={formatBRL(led?.extraordinary ?? 0)} />
            <Kpi label="Investimentos" value={formatBRL(led?.investments ?? 0)} hint="Não entram no resultado do mês" />
            <Kpi label="Pagas no mês (caixa)" value={formatBRL(led?.paidExpenses ?? 0)} hint={led?.personalExpenses ? `${formatBRL(led.personalExpenses)} pessoais a corrigir` : undefined} tone={led?.personalExpenses ? "bad" : "default"} />
          </div>
          <Card>
            <CardHeader title={`Despesas — ${monthLongLabel(viewMonth)}`} subtitle={`${list.length} lançamento(s) · ${formatBRL(sum(list.filter((t) => t.status !== "cancelado")))}`} />
            {list.length === 0 ? <EmptyState title="Nenhuma despesa neste filtro" text="Lance uma despesa, use “Lançar recorrentes do mês” ou importe a planilha." /> : (
              <NumTable minWidth={880} head={["Descrição", "Natureza · fiscal", "Vencimento", "Pago em", "Valor", "Status", ""]}
                rows={list.map((t) => {
                  const c = expenseCategory(t.category);
                  const tc = t.tax_class ?? f.settings.tax.deductibility[c.name]?.tax_class ?? c.taxClass;
                  const st = stateLabel(txState(t, f.today), "despesa");
                  return [
                    <div key="d"><p className="font-medium">{t.description || c.name}{t.proof && <Paperclip className="ml-1 inline h-3 w-3 text-ink-faint" />}</p><p className="text-xs text-ink-faint">{c.name}{t.recurring_id ? " · recorrente" : ""}{t.estimated ? " · estimado" : ""}</p></div>,
                    <span key="n" className="text-xs">{NATURE_LABEL[t.nature ?? c.nature]} · {TAX_CLASS_LABEL[tc]}</span>,
                    t.due_date.split("-").reverse().join("/"),
                    t.paid_at ? t.paid_at.split("-").reverse().join("/") : "—",
                    <span key="v" className="font-medium">{formatBRL(t.amount)}</span>,
                    <Badge key="s" tone={st.tone}>{st.label}</Badge>,
                    <div key="a" className="flex justify-end gap-1">
                      {!t.paid_at && t.status !== "cancelado" && <Button variant="ghost" size="sm" title="Marcar como pago hoje" onClick={async () => { await f.save("transactions", { id: t.id, paid_at: f.today, status: "faturado" }); toast("Pagamento registrado"); }}><CheckCircle2 className="h-4 w-4 text-emerald-600" /></Button>}
                      {!t.paid_at && t.status !== "cancelado" && <Button variant="ghost" size="sm" title="Cancelar" onClick={async () => { if (confirm("Cancelar esta despesa?")) await f.save("transactions", { id: t.id, status: "cancelado" }); }}><Ban className="h-3.5 w-3.5" /></Button>}
                      <Button variant="ghost" size="sm" aria-label="Editar" onClick={() => setModal(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" aria-label="Excluir" onClick={async () => { if (confirm("Excluir esta despesa? A alteração fica no histórico.")) await f.remove("transactions", t.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>,
                  ];
                })} />
            )}
          </Card>
          {Object.keys(f.settings.category_budgets).length > 0 && (
            <Card className="mt-4">
              <CardHeader title="Orçamento por categoria" subtitle={monthLongLabel(viewMonth)} />
              <NumTable head={["Categoria", "Limite", "Gasto", "Uso"]} rows={Object.entries(f.settings.category_budgets).map(([k, lim]) => {
                const spent = led?.expensesByCategory[k] ?? 0;
                return [k, formatBRL(lim), formatBRL(spent), <span key="u" className={spent > lim ? "font-medium text-red-600" : ""}>{pctLabel(lim ? spent / lim : null, 0)}</span>];
              })} />
            </Card>
          )}
        </>
      )}

      {tab === "recorrentes" && (
        <Card>
          <CardHeader title="Despesas recorrentes" subtitle="Entram nas projeções só enquanto vigentes e só se o mês ainda não tiver o lançamento correspondente." />
          {f.data.recurring.length === 0 ? (
            <EmptyState title="Nenhuma despesa recorrente" text="Cadastre supervisão, cursos (com data de término), assinaturas e o custo do espaço por atendimento." action={<div className="flex flex-wrap justify-center gap-2"><Button variant="secondary" onClick={seedFromBriefing}>Usar os valores do briefing</Button><Button onClick={() => setRModal({ basis: "mensal", start_date: f.today, active: true, estimated: false, category: "Cursos e especializações", nature: "fixo", tax_class: "a_confirmar" })}><Plus className="h-4 w-4" /> Nova</Button></div>} />
          ) : (
            <NumTable minWidth={820} head={["Descrição", "Cobrança", "Valor", "Vigência", "Fiscal", ""]}
              rows={f.data.recurring.map((r) => [
                <div key="d"><p className="font-medium">{r.description}{!r.active && <Badge className="ml-2">inativa</Badge>}{r.estimated && <Badge tone="amber" className="ml-2">estimada</Badge>}</p><p className="text-xs text-ink-faint">{r.category}{r.notes ? ` · ${r.notes}` : ""}</p></div>,
                r.basis === "por_sessao" ? "por sessão" : r.basis === "anual" ? `anual (mês ${r.month_of_year})` : `mensal${r.day_of_month ? `, dia ${r.day_of_month}` : ""}`,
                formatBRL(r.amount),
                `${r.start_date.split("-").reverse().join("/")}${r.end_date ? ` a ${r.end_date.split("-").reverse().join("/")}` : " · sem fim"}`,
                <span key="t" className="text-xs">{TAX_CLASS_LABEL[r.tax_class]}</span>,
                <div key="a" className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" aria-label="Editar" onClick={() => setRModal(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" aria-label="Excluir" onClick={async () => { if (confirm("Excluir esta despesa recorrente? Os lançamentos já feitos continuam.")) await f.remove("fin_recurring", r.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>,
              ])} />
          )}
        </Card>
      )}

      {tab === "custos" && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Custos fixos mensais (média 3 meses)" value={formatBRL(avg((r) => r.fixed + r.opTaxes))} steps={last3.map((r) => `${monthLabel(r.month)}: ${formatBRL(r.fixed + r.opTaxes)}`)} />
            <Kpi label="Custos variáveis mensais (média)" value={formatBRL(avg((r) => r.variable))} />
            <Kpi label="Custo variável por sessão" value={avgDone ? formatBRL(avg((r) => r.variable) / avgDone) : "—"} hint={`${Math.round(avgDone)} sessões realizadas/mês em média`} steps={["Custos variáveis relacionados aos atendimentos ÷ número de sessões realizadas no mesmo período."]} />
            <Kpi label="Custos anuais rateados por mês" value={formatBRL(annualTotal / 12)} hint={`${formatBRL(annualTotal)} por ano`} steps={[...annualRec.map((r) => `${r.description}: ${formatBRL(r.amount)}/ano`), annualCfg ? `Tributos/taxas anuais configurados: ${formatBRL(annualCfg)}` : "ISS e taxas anuais ainda sem valor (Planejamento tributário)."]} />
          </div>
          <Card>
            <CardHeader title="Custo por sessão realizada, mês a mês" />
            {a.closed.length === 0 ? <EmptyState title="Sem meses fechados com lançamentos" /> : (
              <NumTable head={["Mês", "Sessões realizadas", "Variável/sessão", "Custo total/sessão", "Receita líquida/sessão"]}
                rows={a.closed.slice(-12).map((r) => [monthLabel(r.month), r.sessionsDone, r.sessionsDone ? formatBRL(r.variable / r.sessionsDone) : "—", r.sessionsDone ? formatBRL((r.variable + r.fixed + r.opTaxes) / r.sessionsDone) : "—", r.sessionsDone ? formatBRL(r.net / r.sessionsDone) : "—"])} />
            )}
            <div className="border-t border-line px-5 py-3"><Explain steps={["Sessões realizadas vêm dos lançamentos de receita (campo “sessões realizadas”). Meses sem esse dado aparecem com “—”.", "Custo total por sessão = (variáveis + fixas + taxas) ÷ sessões realizadas."]} /></div>
          </Card>
        </>
      )}

      {tab === "compromissos" && (
        <Card>
          <CardHeader title="Compromissos dos próximos 12 meses" subtitle="Despesas recorrentes vigentes + contas já lançadas e não pagas" />
          <NumTable minWidth={700} head={["Mês", "Recorrentes", "Contas lançadas", "Total", "Encerram neste mês"]}
            rows={next12.map((m) => {
              const rec = f.data.recurring.filter((r) => activeIn(r, m) && r.basis !== "por_sessao").reduce((s, r) => s + r.amount, 0);
              const open = expenses.filter((t) => !t.paid_at && t.status !== "cancelado" && monthOf(t.due_date) === m).reduce((s, t) => s + t.amount, 0);
              const ending = f.data.recurring.filter((r) => r.active && r.end_date && monthOf(r.end_date) === m);
              return [monthLabel(m), formatBRL(rec), formatBRL(open), formatBRL(rec + open), ending.length ? ending.map((r) => r.description).join(", ") : "—"];
            })} />
          <div className="border-t border-line px-5 py-3"><Explain steps={["Custos por sessão (espaço) dependem do número de atendimentos e aparecem nas Projeções.", "Um recorrente já lançado no mês aparece em “Contas lançadas”, não duas vezes, quando você usa “Lançar recorrentes do mês”."]} /></div>
        </Card>
      )}

      <TxForm open={Boolean(modal)} initial={modal} onClose={() => setModal(null)} patients={f.patients} settings={f.settings} store={f.store}
        onSave={async (t) => { await f.save("transactions", t as Partial<Transaction> & { id?: string }); toast("Despesa salva"); }} />
      <RecurringForm open={Boolean(rModal)} initial={rModal} onClose={() => setRModal(null)}
        onSave={async (r) => { await f.save("fin_recurring", r as Partial<FinRecurring> & { id?: string }); toast("Despesa recorrente salva"); }} />
    </>
  );
}

export default function ExpensesPage() {
  return <Suspense fallback={<FinLoading />}><ExpensesInner /></Suspense>;
}
