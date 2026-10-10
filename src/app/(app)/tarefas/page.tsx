"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarClock, Check, ListChecks, Pencil, Plus, Repeat, Sparkles, Trash2, Wand2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, PageHeader, Segmented, Select, Spinner, Textarea, useToast } from "@/components/ui";
import { useCollection, useData } from "@/lib/data/provider";
import { detectPending, nextDue, PRIORITY, RECURRENCE_LABEL, routineTasks, TASK_CATEGORIES, type AutoPending } from "@/lib/tasks";
import type { ClinicTask, TaskPriority, TaskStatus } from "@/lib/types";
import { cn, formatDate, today } from "@/lib/utils";

const STATUS: Record<TaskStatus, string> = { a_fazer: "A fazer", fazendo: "Fazendo", concluida: "Concluída" };

function TaskModal({ open, onClose, initial, onSave }: { open: boolean; onClose: () => void; initial: Partial<ClinicTask> | null; onSave: (t: Partial<ClinicTask>) => Promise<unknown> }) {
  const patients = useCollection("patients", { orderBy: "name", ascending: true });
  const [f, setF] = useState<Partial<ClinicTask>>(initial ?? {});
  const [last, setLast] = useState(initial);
  const [saving, setSaving] = useState(false);
  if (initial !== last) {
    setLast(initial);
    setF(initial ?? {});
  }
  return (
    <Modal open={open} onClose={onClose} title={f.id ? "Editar tarefa" : "Nova tarefa"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={saving} onClick={async () => {
        if (!f.title?.trim()) return;
        setSaving(true);
        await onSave({ ...f, due_date: f.due_date || null, patient_id: f.patient_id || null }).finally(() => setSaving(false));
        onClose();
      }}>Salvar</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tarefa" className="sm:col-span-2"><Input autoFocus value={f.title ?? ""} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Prioridade">
          <Select value={f.priority ?? "media"} onChange={(e) => setF({ ...f, priority: e.target.value as TaskPriority })} options={Object.entries(PRIORITY).map(([value, p]) => ({ value, label: p.label }))} />
        </Field>
        <Field label="Categoria"><Select value={f.category ?? "Administrativo"} onChange={(e) => setF({ ...f, category: e.target.value })} options={TASK_CATEGORIES} /></Field>
        <Field label="Prazo"><Input type="date" value={f.due_date ?? ""} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></Field>
        <Field label="Repetição">
          <Select value={f.recurrence ?? "nenhuma"} onChange={(e) => setF({ ...f, recurrence: e.target.value as ClinicTask["recurrence"] })} options={Object.entries(RECURRENCE_LABEL).map(([value, label]) => ({ value, label }))} />
        </Field>
        <Field label="Paciente (opcional)" className="sm:col-span-2">
          <Select value={f.patient_id ?? ""} onChange={(e) => setF({ ...f, patient_id: e.target.value })} placeholder="—" options={patients.data.map((p) => ({ value: p.id, label: p.name }))} />
        </Field>
        <Field label="Detalhes" className="sm:col-span-2"><Textarea value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

export default function TasksPage() {
  const toast = useToast();
  const { profile, store, bump } = useData();
  const tasks = useCollection("tasks", { orderBy: "due_date", ascending: true });
  const patients = useCollection("patients");
  const transactions = useCollection("transactions");
  const appointments = useCollection("appointments");
  const sessions = useCollection("session_records");
  const assessments = useCollection("assessments");
  const plans = useCollection("intervention_plans");
  const reports = useCollection("reports");
  const receipts = useCollection("receipts");
  const charges = useCollection("charge_messages");
  const [view, setView] = useState<"prioridade" | "prazo" | "categoria">("prioridade");
  const [showDone, setShowDone] = useState(false);
  const [quick, setQuick] = useState("");
  const [quickPriority, setQuickPriority] = useState<TaskPriority>("media");
  const [modal, setModal] = useState<Partial<ClinicTask> | null>(null);

  const pmap = useMemo(() => new Map(patients.data.map((p) => [p.id, p.name])), [patients.data]);
  const pending = useMemo(() => detectPending({
    patients: patients.data, transactions: transactions.data, appointments: appointments.data, sessions: sessions.data,
    assessments: assessments.data, plans: plans.data, reports: reports.data, receipts: receipts.data, profile, charges: charges.data,
  }), [patients.data, transactions.data, appointments.data, sessions.data, assessments.data, plans.data, reports.data, receipts.data, profile, charges.data]);
  const trackedKeys = new Set(tasks.data.filter((t) => t.status !== "concluida" && t.source_key).map((t) => t.source_key));
  const untracked = pending.filter((p) => !trackedKeys.has(p.key));

  const open = tasks.data.filter((t) => t.status !== "concluida");
  const done = tasks.data.filter((t) => t.status === "concluida").sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));
  const overdue = open.filter((t) => t.due_date && t.due_date < today());
  const sortFn = (a: ClinicTask, b: ClinicTask) =>
    PRIORITY[a.priority].order - PRIORITY[b.priority].order || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");

  const groups: Array<{ title: string; items: ClinicTask[] }> = useMemo(() => {
    const sorted = [...open].sort(sortFn);
    if (view === "prioridade") return (Object.keys(PRIORITY) as TaskPriority[]).map((p) => ({ title: PRIORITY[p].label, items: sorted.filter((t) => t.priority === p) }));
    if (view === "categoria") return TASK_CATEGORIES.map((c) => ({ title: c, items: sorted.filter((t) => t.category === c) }));
    const t0 = today();
    const week = new Date(); week.setDate(week.getDate() + 7);
    const w = week.toISOString().slice(0, 10);
    return [
      { title: "Atrasadas", items: sorted.filter((t) => t.due_date && t.due_date < t0) },
      { title: "Hoje", items: sorted.filter((t) => t.due_date === t0) },
      { title: "Próximos 7 dias", items: sorted.filter((t) => t.due_date && t.due_date > t0 && t.due_date <= w) },
      { title: "Mais tarde", items: sorted.filter((t) => t.due_date && t.due_date > w) },
      { title: "Sem prazo", items: sorted.filter((t) => !t.due_date) },
    ];
  }, [open, view]); // eslint-disable-line react-hooks/exhaustive-deps

  async function complete(t: ClinicTask) {
    await tasks.update(t.id, { status: "concluida", done_at: new Date().toISOString() });
    const nd = nextDue(t.due_date, t.recurrence);
    if (nd) {
      await tasks.insert({ title: t.title, description: t.description, priority: t.priority, category: t.category, patient_id: t.patient_id, recurrence: t.recurrence, status: "a_fazer", due_date: nd });
      toast(`Concluída. Próxima: ${formatDate(nd)}`);
    } else toast("Tarefa concluída");
  }

  async function track(p: AutoPending) {
    await tasks.insert({ title: p.title, description: p.description, priority: p.priority, category: p.category, patient_id: p.patient_id ?? null, recurrence: "nenhuma", status: "a_fazer", due_date: today(), source_key: p.key });
    toast("Adicionada às suas tarefas");
  }

  async function addRoutine() {
    const existing = new Set(tasks.data.filter((t) => t.status !== "concluida").map((t) => t.title));
    const rows = routineTasks().filter((t) => !existing.has(t.title!));
    if (!rows.length) return toast("A rotina sugerida já está na sua lista.");
    await store.insertMany("tasks", rows);
    bump("tasks");
    toast(`${rows.length} tarefa(s) de rotina adicionada(s)`);
  }

  if (tasks.loading) return <Spinner />;

  const TaskRow = ({ t }: { t: ClinicTask }) => {
    const late = t.due_date && t.due_date < today() && t.status !== "concluida";
    return (
      <li className="group flex items-start gap-3 px-5 py-3">
        <button onClick={() => (t.status === "concluida" ? tasks.update(t.id, { status: "a_fazer", done_at: null }) : complete(t))} aria-label="Concluir"
          className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", t.status === "concluida" ? "border-emerald-500 bg-emerald-500 text-white" : "border-line hover:border-brand-400")}>
          {t.status === "concluida" && <Check className="h-3 w-3" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm", t.status === "concluida" && "text-ink-faint line-through")}>{t.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label}</Badge>
            <Badge>{t.category}</Badge>
            {t.status === "fazendo" && <Badge tone="sage">Fazendo</Badge>}
            {t.due_date && <span className={cn("inline-flex items-center gap-1 text-[11px]", late ? "font-medium text-red-600" : "text-ink-faint")}><CalendarClock className="h-3 w-3" />{formatDate(t.due_date)}</span>}
            {t.recurrence !== "nenhuma" && <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint"><Repeat className="h-3 w-3" />{RECURRENCE_LABEL[t.recurrence]}</span>}
            {t.patient_id && <Link href={`/pacientes/${t.patient_id}`} className="text-[11px] text-brand-700 hover:underline">{pmap.get(t.patient_id)}</Link>}
          </div>
          {t.description && <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{t.description}</p>}
        </div>
        <div className="flex shrink-0 gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
          {t.status === "a_fazer" && <Button variant="ghost" size="sm" onClick={() => tasks.update(t.id, { status: "fazendo" })}>Iniciar</Button>}
          <Button variant="ghost" size="sm" onClick={() => setModal(t)} aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="sm" onClick={async () => { if (confirm("Excluir tarefa?")) await tasks.remove(t.id); }} aria-label="Excluir"><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </li>
    );
  };

  return (
    <>
      <PageHeader title="Tarefas da clínica" subtitle="Prioridades de gestão e organização — com pendências detectadas automaticamente"
        actions={<>
          <Button variant="secondary" onClick={addRoutine}><Wand2 className="h-4 w-4" /> Rotina sugerida</Button>
          <Button onClick={() => setModal({ priority: "media", category: "Administrativo", recurrence: "nenhuma", status: "a_fazer" })}><Plus className="h-4 w-4" /> Nova tarefa</Button>
        </>} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Em aberto", String(open.length), "text-ink"],
          ["Urgentes / alta", String(open.filter((t) => t.priority === "urgente" || t.priority === "alta").length), "text-amber-700"],
          ["Atrasadas", String(overdue.length), overdue.length ? "text-red-600" : "text-ink"],
          ["Pendências detectadas", String(untracked.length), untracked.length ? "text-brand-700" : "text-ink"],
        ].map(([l, v, c]) => (
          <Card key={l} className="p-4"><p className="text-xs text-ink-soft">{l}</p><p className={`mt-1 text-2xl font-semibold tabular-nums ${c}`}>{v}</p></Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Card className="flex flex-col gap-2 p-3 sm:flex-row">
            <Input placeholder="Adicionar tarefa rápida e pressionar Enter…" value={quick} onChange={(e) => setQuick(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key !== "Enter" || !quick.trim()) return;
                await tasks.insert({ title: quick.trim(), priority: quickPriority, category: "Administrativo", recurrence: "nenhuma", status: "a_fazer" });
                setQuick("");
              }} />
            <Select className="sm:w-36" value={quickPriority} onChange={(e) => setQuickPriority(e.target.value as TaskPriority)} options={Object.entries(PRIORITY).map(([value, p]) => ({ value, label: p.label }))} />
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented value={view} onChange={setView} options={[{ value: "prioridade", label: "Por prioridade" }, { value: "prazo", label: "Por prazo" }, { value: "categoria", label: "Por categoria" }]} />
            <label className="flex items-center gap-2 text-xs text-ink-soft"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Mostrar concluídas</label>
          </div>

          {open.length === 0 ? (
            <Card><EmptyState icon={<ListChecks className="h-5 w-5" />} title="Nenhuma tarefa em aberto" text="Adicione a rotina sugerida ou crie suas próprias tarefas." action={<Button variant="secondary" onClick={addRoutine}><Wand2 className="h-4 w-4" /> Adicionar rotina sugerida</Button>} /></Card>
          ) : (
            groups.filter((g) => g.items.length).map((g) => (
              <Card key={g.title}>
                <CardHeader title={`${g.title} (${g.items.length})`} />
                <ul className="divide-y divide-line">{g.items.map((t) => <TaskRow key={t.id} t={t} />)}</ul>
              </Card>
            ))
          )}

          {showDone && done.length > 0 && (
            <Card>
              <CardHeader title={`Concluídas (${done.length})`} />
              <ul className="divide-y divide-line">{done.slice(0, 30).map((t) => <TaskRow key={t.id} t={t} />)}</ul>
            </Card>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader title="Pendências detectadas" icon={<Sparkles className="h-4 w-4" />} subtitle="Calculadas a partir da agenda, financeiro, contratos e prontuários" />
          {untracked.length === 0 ? (
            <EmptyState title="Nada pendente agora" text="Quando surgir um atraso, contrato sem assinatura ou sessão sem registro, aparece aqui." />
          ) : (
            <ul className="divide-y divide-line">
              {untracked.map((p) => (
                <li key={p.key} className="px-5 py-3">
                  <div className="flex items-start gap-2">
                    <Badge tone={PRIORITY[p.priority].tone}>{PRIORITY[p.priority].label}</Badge>
                    <p className="flex-1 text-sm">{p.title}</p>
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">{p.description}</p>
                  <div className="mt-2 flex gap-2">
                    <Link href={p.href}><Button variant="secondary" size="sm">Resolver <ArrowRight className="h-3.5 w-3.5" /></Button></Link>
                    <Button variant="ghost" size="sm" onClick={() => track(p)}><Plus className="h-3.5 w-3.5" /> Minhas tarefas</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <TaskModal open={Boolean(modal)} onClose={() => setModal(null)} initial={modal}
        onSave={async (t) => { if (t.id) await tasks.update(t.id, t); else await tasks.insert(t); toast("Tarefa salva"); }} />
    </>
  );
}
