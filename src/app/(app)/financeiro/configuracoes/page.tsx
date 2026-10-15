"use client";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileSpreadsheet, Plus, Save, Trash2, Upload } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select, Tabs, useToast } from "@/components/ui";
import { Explain, FinLoading, MoneyInput, NumTable } from "@/components/finance/kit";
import { useFinance } from "@/lib/finance/use-finance";
import { useCollection } from "@/lib/data/provider";
import type { Transaction } from "@/lib/types";
import { resolveSettings, type FinanceSettings } from "@/lib/finance/settings";
import { EXPENSE_CATEGORIES_FIN } from "@/lib/finance/categories";
import { monthLabel, nationalHolidays } from "@/lib/finance/calendar";
import { formatBRL } from "@/lib/finance/money";
import { buildSheetImport, contractsFromMonth, existingImportKeys, guessColumns, normalizeName, parseCSV, parseOFX, parseSessionsSheet, reconcile, rowsToStatement, type ColumnMap, type ReconcileResult, type SheetMonth } from "@/lib/finance/importers";
import { gridFromWorksheet } from "@/lib/finance/excel-grid";
import { downloadBlob, uid } from "@/lib/utils";

type Tab = "geral" | "importar" | "backup" | "historico";
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function GeneralSettings({ settings, onSave }: { settings: FinanceSettings; onSave: (s: Partial<FinanceSettings>) => Promise<void> }) {
  const [d, setD] = useState<FinanceSettings>(settings);
  const [last, setLast] = useState(settings);
  const [budgetCat, setBudgetCat] = useState(EXPENSE_CATEGORIES_FIN[0].name);
  const [budgetVal, setBudgetVal] = useState<number | null>(null);
  if (settings !== last) { setLast(settings); setD(settings); }
  const set = (p: Partial<FinanceSettings>) => setD((x) => ({ ...x, ...p }));
  const pctField = (v: number | null) => (v === null ? "" : Math.round(v * 1000) / 10);
  const years = [Number(new Date().getFullYear()), Number(new Date().getFullYear()) + 1];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Atendimento e capacidade" />
        <div className="grid grid-cols-2 gap-3 p-5">
          <Field label="Capacidade (sessões/semana)"><Input type="number" min={1} max={80} value={d.capacity_per_week} onChange={(e) => set({ capacity_per_week: Number(e.target.value) || 1 })} /></Field>
          <Field label="Duração da sessão (min)"><Input type="number" min={15} max={180} value={d.session_minutes} onChange={(e) => set({ session_minutes: Number(e.target.value) || 45 })} /></Field>
          <Field label="Valor de referência da sessão avulsa"><MoneyInput value={d.reference_price} onChange={(v) => set({ reference_price: v ?? 0 })} /></Field>
          <Field label="Projeção até (mês)"><Input type="month" value={d.projection_end} onChange={(e) => e.target.value && set({ projection_end: e.target.value })} /></Field>
          <div className="col-span-2">
            <span className="text-xs font-medium text-ink-soft">Dias de atendimento</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {WEEKDAYS.map((w, i) => (
                <label key={w} className="inline-flex items-center gap-1 text-sm"><input type="checkbox" checked={d.working_weekdays.includes(i)} onChange={(e) => set({ working_weekdays: e.target.checked ? [...d.working_weekdays, i].sort() : d.working_weekdays.filter((x) => x !== i) })} />{w}</label>
              ))}
            </div>
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Segurança do caixa e metas" />
        <div className="grid grid-cols-2 gap-3 p-5">
          <Field label="Saldo mínimo de segurança" hint="Capital de giro que nunca deve ser gasto"><MoneyInput value={d.min_cash} onChange={(v) => set({ min_cash: v })} placeholder="não definido" /></Field>
          <Field label="Meta mensal de faturamento"><MoneyInput value={d.goal_monthly_revenue} onChange={(v) => set({ goal_monthly_revenue: v })} placeholder="não definida" /></Field>
          <Field label="Presença esperada (%)" hint="Vazio = usa o histórico"><Input type="number" min={30} max={100} value={pctField(d.attendance_rate)} onChange={(e) => set({ attendance_rate: e.target.value === "" ? null : Number(e.target.value) / 100 })} /></Field>
          <Field label="Inadimplência esperada (%)" hint="Vazio = usa o histórico"><Input type="number" min={0} max={100} value={pctField(d.delinquency_rate)} onChange={(e) => set({ delinquency_rate: e.target.value === "" ? null : Number(e.target.value) / 100 })} /></Field>
          <Field label="Presença sem histórico (premissa, %)"><Input type="number" min={30} max={100} value={pctField(d.attendance_fallback)} onChange={(e) => set({ attendance_fallback: (Number(e.target.value) || 85) / 100 })} /></Field>
          <Field label="Horizonte do pró-labore (meses)"><Input type="number" min={3} max={24} value={d.prolabore_horizon_months} onChange={(e) => set({ prolabore_horizon_months: Math.min(24, Math.max(3, Number(e.target.value) || 12)) })} /></Field>
          <label className="col-span-2 inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={d.anonymize} onChange={(e) => set({ anonymize: e.target.checked })} /> Mostrar pagadores só por código/iniciais (dados anonimizados)</label>
        </div>
      </Card>
      <Card>
        <CardHeader title="Férias e períodos sem atendimento" subtitle="Reduzem as sessões projetadas" />
        <div className="space-y-2 p-5">
          {d.closed_periods.map((p, i) => (
            <div key={p.id} className="grid grid-cols-[1fr_1fr_1.2fr_auto] items-end gap-2">
              <Field label="Início"><Input type="date" value={p.start} onChange={(e) => set({ closed_periods: d.closed_periods.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)) })} /></Field>
              <Field label="Fim"><Input type="date" value={p.end} onChange={(e) => set({ closed_periods: d.closed_periods.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)) })} /></Field>
              <Field label="Descrição"><Input value={p.label} onChange={(e) => set({ closed_periods: d.closed_periods.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} /></Field>
              <Button variant="ghost" size="sm" className="mb-1" aria-label="Remover período" onClick={() => set({ closed_periods: d.closed_periods.filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={() => set({ closed_periods: [...d.closed_periods, { id: uid(), start: "", end: "", label: "Férias" }] })}><Plus className="h-3.5 w-3.5" /> Período</Button>
        </div>
      </Card>
      <Card>
        <CardHeader title="Feriados" subtitle="Nacionais já descontados; cadastre os municipais/estaduais" />
        <div className="space-y-2 p-5">
          <Explain title="Feriados nacionais considerados" steps={years.flatMap((y) => nationalHolidays(y).map((h) => `${h.date.split("-").reverse().join("/")} — ${h.label}`))} />
          {d.extra_holidays.map((h, i) => (
            <div key={i} className="grid grid-cols-[1fr_1.5fr_auto] items-end gap-2">
              <Input type="date" value={h.date} onChange={(e) => set({ extra_holidays: d.extra_holidays.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)) })} />
              <Input value={h.label} onChange={(e) => set({ extra_holidays: d.extra_holidays.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              <Button variant="ghost" size="sm" aria-label="Remover feriado" onClick={() => set({ extra_holidays: d.extra_holidays.filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={() => set({ extra_holidays: [...d.extra_holidays, { date: "", label: "Feriado municipal" }] })}><Plus className="h-3.5 w-3.5" /> Feriado</Button>
        </div>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader title="Limite mensal por categoria de despesa" subtitle="Gera alerta quando ultrapassado e aparece em Despesas" />
        <div className="p-5">
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <Field label="Categoria" className="w-72"><Select value={budgetCat} onChange={(e) => setBudgetCat(e.target.value)} options={EXPENSE_CATEGORIES_FIN.filter((c) => !c.incomeTax).map((c) => c.name)} /></Field>
            <Field label="Limite mensal" className="w-44"><MoneyInput value={budgetVal} onChange={setBudgetVal} /></Field>
            <Button size="sm" variant="secondary" className="mb-0.5 h-9" onClick={() => { if (budgetVal) set({ category_budgets: { ...d.category_budgets, [budgetCat]: budgetVal } }); setBudgetVal(null); }}><Plus className="h-3.5 w-3.5" /> Definir</Button>
          </div>
          {Object.entries(d.category_budgets).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between border-b border-line py-1.5 text-sm"><span>{k}</span><span className="flex items-center gap-2 tabular-nums">{formatBRL(v)}<button aria-label="Remover limite" onClick={() => { const n = { ...d.category_budgets }; delete n[k]; set({ category_budgets: n }); }}><Trash2 className="h-3.5 w-3.5 text-ink-faint" /></button></span></div>
          ))}
        </div>
      </Card>
      <div className="lg:col-span-2 flex justify-end">
        <Button onClick={() => {
          const err = d.closed_periods.find((p) => !p.start || !p.end || p.end < p.start);
          if (err) return alert("Confira os períodos sem atendimento: início e fim são obrigatórios e o fim não pode ser antes do início.");
          if (!d.working_weekdays.length) return alert("Escolha pelo menos um dia de atendimento.");
          onSave({ ...d, extra_holidays: d.extra_holidays.filter((h) => h.date) });
        }}><Save className="h-4 w-4" /> Salvar configurações</Button>
      </div>
    </div>
  );
}

function SheetImport({ f }: { f: ReturnType<typeof useFinance> }) {
  const toast = useToast();
  const [months, setMonths] = useState<SheetMonth[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [includeFuture, setIncludeFuture] = useState(false);
  const [units, setUnits] = useState<Record<string, number>>({});
  const [cats, setCats] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const keys = useMemo(() => existingImportKeys(f.data.transactions), [f.data.transactions]);
  const plan = useMemo(() => months && buildSheetImport(months, f.data.transactions, { today: f.today, anonymize: f.settings.anonymize, includeFuture, patients: f.patients, unitOverrides: units, categoryOverrides: cats, existingKeys: keys }), [months, f.data.transactions, f.today, f.settings.anonymize, includeFuture, f.patients, units, cats, keys]);
  const lastImported = useMemo(() => {
    const ms = [...new Set(f.data.transactions.filter((t) => t.import_key?.startsWith("sheet:") && t.type === "receita" && t.status !== "previsto").map((t) => t.competence!))].sort();
    return ms.filter((m) => m < f.today.slice(0, 7)).at(-1) ?? null;
  }, [f.data.transactions, f.today]);

  async function load(file: File) {
    setBusy(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const parsed = wb.worksheets.map((ws) => parseSessionsSheet(gridFromWorksheet(ws as never))).filter(Boolean) as SheetMonth[];
      if (!parsed.length) throw new Error("Nenhuma aba mensal reconhecida (nomes como “OUT. 26”).");
      setMonths(parsed);
      setFileName(file.name);
      setSelected(new Set(parsed.map((m) => m.competence)));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível ler a planilha", "error");
    } finally {
      setBusy(false);
    }
  }

  const missing = months?.flatMap((m) => m.patients.filter((p) => p.total === null && p.unit === null && (p.billedCount ?? 0) > 0).map((p) => ({ m: m.sheet, name: p.name, key: normalizeName(p.name), count: p.billedCount }))) ?? [];
  const chosen = plan ? { revenues: plan.revenues.filter((t) => selected.has(t.competence!)), expenses: plan.expenses.filter((t) => selected.has(t.competence!)) } : null;

  return (
    <Card className="mb-4">
      <CardHeader title="Planilha “Sessões e Financeiro” (abas mensais)" subtitle="Lida no seu navegador. Nada é enviado a servidores." />
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm hover:bg-canvas">
            <Upload className="h-4 w-4" /> {busy ? "Lendo…" : "Escolher arquivo .xlsx"}
            <input type="file" accept=".xlsx" className="hidden" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
          </label>
          {fileName && <span className="text-xs text-ink-faint">{fileName}</span>}
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={includeFuture} onChange={(e) => setIncludeFuture(e.target.checked)} /> Importar meses futuros como previsão</label>
        </div>
        {f.settings.anonymize ? <p className="text-xs text-ink-faint">Os pacientes viram códigos (iniciais + número). Nomes não são gravados nos lançamentos.</p> : <p className="text-xs text-amber-700">Anonimização desligada: o nome do paciente será gravado como identificador.</p>}
        {plan && chosen && months && (
          <>
            <NumTable minWidth={720} head={["", "Aba", "Receitas", "Total", "Despesas", "Total", "Avisos"]}
              rows={[...months].sort((a, b) => a.competence.localeCompare(b.competence)).map((m) => {
                const r = plan.revenues.filter((t) => t.competence === m.competence);
                const e = plan.expenses.filter((t) => t.competence === m.competence);
                return [
                  <input key="c" type="checkbox" aria-label={`Importar ${m.sheet}`} checked={selected.has(m.competence)} onChange={(ev) => { const n = new Set(selected); if (ev.target.checked) n.add(m.competence); else n.delete(m.competence); setSelected(n); }} />,
                  m.sheet, r.length, formatBRL(r.reduce((s, t) => s + (t.amount ?? 0), 0)), e.length, formatBRL(e.reduce((s, t) => s + (t.amount ?? 0), 0)), m.issues.length ? <Badge key="i" tone="amber">{m.issues.length}</Badge> : "—",
                ];
              })} />
            {missing.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-medium text-amber-900">Pacientes com atendimentos sem valor na planilha</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {[...new Map(missing.map((x) => [x.key, x])).values()].map((x) => (
                    <Field key={x.key} label={`${f.settings.anonymize ? plan.labels[x.key] ?? "paciente" : x.name} — valor por sessão`}><MoneyInput value={units[x.key] ?? null} onChange={(v) => setUnits((u) => { const n = { ...u }; if (v) n[x.key] = v; else delete n[x.key]; return n; })} placeholder="sem valor: não importa" /></Field>
                  ))}
                </div>
              </div>
            )}
            {plan.issues.length > 0 && <Explain title={`${plan.issues.length} aviso(s) sobre a planilha`} steps={plan.issues} />}
            {plan.possibleDuplicates.length > 0 && <Explain title={`${plan.possibleDuplicates.length} possível(is) duplicidade(s) com lançamentos manuais`} steps={plan.possibleDuplicates} />}
            {plan.skipped.length > 0 && <Explain title={`${plan.skipped.length} item(ns) não importado(s)`} steps={plan.skipped.map((s) => s.reason)} />}
            <details>
              <summary className="cursor-pointer text-sm text-brand-700">Conferir categorias das {chosen.expenses.length} despesas</summary>
              <div className="mt-2 max-h-96 overflow-y-auto">
                <NumTable minWidth={640} head={["Mês", "Descrição", "Valor", "Categoria no app"]}
                  rows={chosen.expenses.map((t) => [monthLabel(t.competence!), t.description ?? "", formatBRL(t.amount), <Select key="c" className="h-8 w-64 text-xs" value={t.category} onChange={(e) => setCats((c) => ({ ...c, [t.import_key!]: e.target.value }))} options={EXPENSE_CATEGORIES_FIN.map((x) => x.name)} />])} />
              </div>
            </details>
            <Button disabled={!chosen.revenues.length && !chosen.expenses.length} onClick={async () => {
              if (!confirm(`Importar ${chosen.revenues.length} receita(s) e ${chosen.expenses.length} despesa(s)? Linhas já importadas são ignoradas.`)) return;
              await f.saveMany("transactions", [...chosen.revenues, ...chosen.expenses], `Importou ${chosen.revenues.length} receita(s) e ${chosen.expenses.length} despesa(s) da planilha ${fileName}`);
              toast("Importação concluída");
              setMonths(null);
            }}>Importar {chosen.revenues.length + chosen.expenses.length} lançamento(s)</Button>
          </>
        )}
        {lastImported && (
          <div className="rounded-lg border border-line bg-canvas p-3 text-sm">
            <p>Último mês completo importado: <b>{monthLabel(lastImported)}</b>. Criar contratos a partir dele (sessões/semana e valor de cada pagador)?</p>
            <Button size="sm" className="mt-2" variant="secondary" onClick={async () => {
              const ks = contractsFromMonth(f.data.transactions, lastImported, f.settings, f.data.contracts);
              if (!ks.length) return toast("Todos os pagadores desse mês já têm contrato.");
              if (!confirm(`Criar ${ks.length} contrato(s) a partir de ${monthLabel(lastImported)}? Confira depois em Receitas › Contratos (frequência, valor e quem paga).`)) return;
              await f.saveMany("fin_contracts", ks, `Criou ${ks.length} contrato(s) a partir de ${lastImported}`);
              toast(`${ks.length} contrato(s) criado(s)`);
            }}>Criar contratos</Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function StatementImport({ f }: { f: ReturnType<typeof useFinance> }) {
  const toast = useToast();
  const [table, setTable] = useState<string[][] | null>(null);
  const [map, setMap] = useState<Partial<ColumnMap>>({});
  const [ofx, setOfx] = useState<ReturnType<typeof parseOFX> | null>(null);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const keys = useMemo(() => existingImportKeys(f.data.transactions), [f.data.transactions]);
  const rows = ofx ?? (table && map.date !== undefined && map.amount !== undefined && map.description !== undefined ? rowsToStatement(table, map as ColumnMap) : null);
  const result: ReconcileResult[] | null = useMemo(() => (rows ? reconcile(rows, f.data.transactions, keys) : null), [rows, f.data.transactions, keys]);

  async function load(file: File) {
    try {
      setOfx(null); setTable(null); setSkip(new Set());
      if (/\.ofx$/i.test(file.name)) { setOfx(parseOFX(await file.text())); return; }
      let t: string[][];
      if (/\.xlsx$/i.test(file.name)) {
        const ExcelJS = (await import("exceljs")).default;
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(await file.arrayBuffer());
        const g = gridFromWorksheet(wb.worksheets[0] as never);
        t = g.rows.filter(Boolean).map((r) => Array.from(r, (c) => (c?.v instanceof Date ? c.v.toISOString().slice(0, 10) : c?.v === null || c?.v === undefined ? "" : String(c.v))));
      } else t = parseCSV(await file.text());
      if (t.length < 2) throw new Error("Arquivo sem linhas.");
      setTable(t);
      setMap(guessColumns(t[0]));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível ler o arquivo", "error");
    }
  }
  const opts = table ? table[0].map((h, i) => ({ value: String(i), label: h || `Coluna ${i + 1}` })) : [];
  const colSel = (k: keyof ColumnMap, label: string, optional = false) => (
    <Field label={label}><Select value={map[k] === undefined ? "" : String(map[k])} onChange={(e) => setMap({ ...map, [k]: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder={optional ? "—" : "Escolha"} options={opts} /></Field>
  );

  return (
    <Card className="mb-4">
      <CardHeader title="Extrato bancário ou planilha de lançamentos (CSV, Excel, OFX)" subtitle="Concilia com o que já existe: nada é lançado duas vezes" />
      <div className="space-y-4 p-5">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm hover:bg-canvas">
          <Upload className="h-4 w-4" /> Escolher arquivo (.csv, .xlsx, .ofx)
          <input type="file" accept=".csv,.xlsx,.ofx,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
        </label>
        {table && (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {colSel("date", "Data")}{colSel("description", "Descrição")}{colSel("amount", "Valor (ou crédito)")}{colSel("debit", "Débito (se separado)", true)}{colSel("type", "Tipo (receita/despesa)", true)}{colSel("category", "Categoria", true)}
          </div>
        )}
        {result && (
          <>
            <p className="text-sm">{result.filter((r) => r.action === "novo").length} novo(s) · {result.filter((r) => r.action === "conciliar").length} a conciliar (marcar como pago) · {result.filter((r) => r.action === "ja_registrado").length} já registrado(s)</p>
            <div className="max-h-96 overflow-y-auto">
              <NumTable minWidth={760} head={["", "Data", "Descrição", "Valor", "Ação"]}
                rows={result.map((r) => [
                  r.action === "ja_registrado" ? "" : <input key="c" type="checkbox" aria-label="Incluir" checked={!skip.has(r.key)} onChange={(e) => { const n = new Set(skip); if (e.target.checked) n.delete(r.key); else n.add(r.key); setSkip(n); }} />,
                  r.row.date.split("-").reverse().join("/"), r.row.description, <span key="v" className={r.row.amount < 0 ? "text-red-600" : "text-emerald-700"}>{formatBRL(r.row.amount)}</span>,
                  r.action === "novo" ? <Badge key="a" tone="blue">Novo lançamento</Badge> : r.action === "conciliar" ? <Badge key="a" tone="green">Conciliar com “{r.match?.description || r.match?.category}”</Badge> : <Badge key="a">Já registrado</Badge>,
                ])} />
            </div>
            <Button onClick={async () => {
              const todo = result.filter((r) => r.action !== "ja_registrado" && !skip.has(r.key));
              if (!todo.length) return toast("Nada a importar.");
              if (!confirm(`Aplicar ${todo.length} item(ns)?`)) return;
              for (const r of todo.filter((x) => x.action === "conciliar")) await f.save("transactions", { id: r.match!.id, paid_at: r.row.date, status: r.match!.status === "previsto" ? "faturado" : r.match!.status, import_key: r.match!.import_key ?? r.key });
              const news = todo.filter((x) => x.action === "novo").map((x) => x.draft!);
              await f.saveMany("transactions", news, `Importou ${news.length} lançamento(s) do extrato e conciliou ${todo.length - news.length}`);
              toast("Extrato aplicado — revise as categorias dos lançamentos novos");
              setTable(null); setOfx(null);
            }}>Aplicar</Button>
          </>
        )}
      </div>
    </Card>
  );
}

function SettingsInner() {
  const params = useSearchParams();
  const toast = useToast();
  const f = useFinance();
  const history = useCollection("fin_history", { orderBy: "created_at" });
  const [tab, setTab] = useState<Tab>((params.get("aba") as Tab) || "geral");
  if (f.loading || !f.analysis) return <FinLoading />;
  const a = f.analysis;

  async function exportAll() {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = "NeuroPlanner — gestão financeira";
    const sheet = (name: string, rows: Array<Record<string, unknown>>) => {
      const ws = wb.addWorksheet(name);
      if (!rows.length) return;
      ws.columns = Object.keys(rows[0]).map((k) => ({ header: k, key: k, width: 16 }));
      ws.getRow(1).font = { bold: true };
      rows.forEach((r) => ws.addRow(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "object" && v !== null ? JSON.stringify(v) : v]))));
    };
    const strip = (t: Transaction) => { const { owner_id: _o, ...rest } = t; return rest as Record<string, unknown>; };
    sheet("Lançamentos", f.data.transactions.map(strip));
    sheet("Contratos", f.data.contracts as unknown as Array<Record<string, unknown>>);
    sheet("Recorrentes", f.data.recurring as unknown as Array<Record<string, unknown>>);
    sheet("Reservas", f.data.reserves as unknown as Array<Record<string, unknown>>);
    sheet("Saldos", f.data.balances as unknown as Array<Record<string, unknown>>);
    sheet("Compras planejadas", f.data.plans as unknown as Array<Record<string, unknown>>);
    sheet("DRE", a.dre.map(({ tax: _t, ...r }) => r as unknown as Record<string, unknown>));
    sheet("Projeção realista", a.projections.realista.months.map(({ incomeTax, notes, ...m }) => ({ ...m, ir: incomeTax.totalProvision, observacoes: notes.join(" ") })));
    const buf = await wb.xlsx.writeBuffer();
    downloadBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `financeiro-completo-${f.today}.xlsx`);
  }

  const imported = f.data.transactions.filter((t) => t.import_key?.startsWith("sheet:"));

  return (
    <>
      <PageHeader title="Configurações financeiras" subtitle="Premissas, importação, backup e histórico de alterações" />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "geral", label: "Geral" }, { value: "importar", label: "Importar" }, { value: "backup", label: "Backup e exportação" }, { value: "historico", label: "Histórico de alterações" }]} />
      <div className="mt-4" />
      {tab === "geral" && <GeneralSettings settings={f.settings} onSave={async (s) => { await f.saveSettings(s); toast("Configurações salvas — indicadores recalculados"); }} />}
      {tab === "importar" && (
        <>
          <SheetImport f={f} />
          <StatementImport f={f} />
          <p className="text-xs text-ink-faint">As regras tributárias do arquivo do contador já estão pré-carregadas em <Link className="text-brand-700 underline" href="/financeiro/tributario">Planejamento tributário</Link>, com a fonte de cada uma.</p>
        </>
      )}
      {tab === "backup" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Exportar" />
            <div className="space-y-3 p-5 text-sm">
              <Button onClick={exportAll}><FileSpreadsheet className="h-4 w-4" /> Excel completo do financeiro</Button>
              <p className="text-xs text-ink-faint">Lançamentos, contratos, recorrentes, reservas, saldos, compras, DRE e projeção. Contém dados financeiros: guarde em local seguro.</p>
              <p className="text-xs text-ink-soft">O backup completo do sistema (criptografado, inclui o financeiro) fica em <Link className="text-brand-700 underline" href="/configuracoes?tab=seguranca">Configurações › Segurança</Link>. Faça um por semana.</p>
            </div>
          </Card>
          <Card>
            <CardHeader title="Desfazer importação da planilha" />
            <div className="space-y-3 p-5 text-sm">
              <p className="text-ink-soft">{imported.length} lançamento(s) vieram da planilha. Remover todos permite importar de novo do zero (por exemplo, depois de corrigir a planilha).</p>
              <Button variant="danger" disabled={!imported.length} onClick={async () => {
                if (prompt(`Digite REMOVER para apagar ${imported.length} lançamento(s) importados da planilha.`) !== "REMOVER") return;
                for (const t of imported) await f.store.remove("transactions", t.id);
                await f.log({ table_name: "transactions", action: "excluiu", summary: `Removeu ${imported.length} lançamento(s) importados da planilha` });
                window.dispatchEvent(new Event("np:vault-changed"));
                toast("Lançamentos importados removidos");
              }}><Trash2 className="h-4 w-4" /> Remover lançamentos importados</Button>
              <Button variant="secondary" onClick={async () => { if (!confirm("Restaurar as configurações financeiras padrão (regras do arquivo do contador e premissas iniciais)? Lançamentos não são afetados.")) return; await f.saveSettings(resolveSettings(null), "Restaurou as configurações financeiras padrão"); toast("Configurações restauradas"); }}>Restaurar configurações padrão</Button>
            </div>
          </Card>
        </div>
      )}
      {tab === "historico" && (
        <Card>
          <CardHeader title="Histórico de alterações financeiras" subtitle="Quem criou, alterou, excluiu ou importou — com antes e depois" />
          {history.data.length === 0 ? <EmptyState title="Nenhuma alteração registrada ainda" /> : (
            <NumTable minWidth={720} head={["Quando", "Ação", "Resumo", "Antes → depois"]}
              rows={history.data.slice(0, 300).map((h) => [
                h.created_at ? new Date(h.created_at).toLocaleString("pt-BR") : "—",
                <Badge key="a" tone={h.action === "excluiu" ? "red" : h.action === "criou" ? "green" : "blue"}>{h.action}</Badge>,
                <span key="s" className="block max-w-md text-left">{h.summary}</span>,
                h.before || h.after ? <details key="d" className="text-left text-xs"><summary className="cursor-pointer text-ink-faint">ver</summary><pre className="max-w-md whitespace-pre-wrap text-[10px]">{JSON.stringify({ antes: h.before, depois: h.after }, null, 1)}</pre></details> : "—",
              ])} />
          )}
        </Card>
      )}
    </>
  );
}

export default function FinanceSettingsPage() {
  return <Suspense fallback={<FinLoading />}><SettingsInner /></Suspense>;
}
