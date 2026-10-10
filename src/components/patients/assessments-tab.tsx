"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckSquare, ClipboardList, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import {
  AiNotice, Badge, Button, Card, CardHeader, EmptyState, Field, Input, ListEditor, Modal, Select, Spinner, Textarea, useToast,
} from "@/components/ui";
import { useCollection } from "@/lib/data/provider";
import { askAI, patientContext } from "@/lib/ai/client";
import { DEFAULT_CHECKLIST, INSTRUMENTS } from "@/lib/catalog";
import { INSTRUMENT_STATUS } from "@/lib/labels";
import type { Assessment, AssessmentInstrument, InstrumentStatus, Patient } from "@/lib/types";
import { ageLabel, formatDate, today, uid } from "@/lib/utils";

interface AiAssessment {
  objective: string;
  instruments: Array<{ name: string; justification: string; session: number }>;
  sessions: Array<{ number: number; objective: string; instruments: string[]; duration_min: number }>;
  total_sessions: number;
  justification: string;
  checklist: string[];
  warnings: string[];
}

const restricted = (name: string) => INSTRUMENTS.find((i) => i.name.toLowerCase() === name.toLowerCase())?.restricted;

function NewAssessmentModal({ patient, open, onClose, onCreate }: {
  patient: Patient; open: boolean; onClose: () => void; onCreate: (a: Partial<Assessment>) => Promise<void>;
}) {
  const toast = useToast();
  const [form, setForm] = useState({ complaint: "", hypotheses: "", difficulties: "", objectives: "" });
  const [ai, setAi] = useState<AiAssessment | null>(null);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        complaint: patient.anamnesis?.complaints ?? "",
        hypotheses: patient.hypotheses ?? "",
        difficulties: patient.difficulties ?? "",
        objectives: "",
      });
      setAi(null);
    }
  }, [open, patient]);

  async function generate() {
    setLoading(true);
    try {
      const r = await askAI<AiAssessment>("assessment_plan", { ...patientContext(patient), ...form });
      setAi({ ...r.result, instruments: r.result.instruments ?? [], sessions: r.result.sessions ?? [], checklist: r.result.checklist ?? [], warnings: r.result.warnings ?? [] });
      setDemo(r.demo);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro na IA", "error");
    } finally {
      setLoading(false);
    }
  }

  async function create(useAi: boolean) {
    const base: Partial<Assessment> = {
      patient_id: patient.id, title: "Avaliação neuropsicopedagógica", status: "em_andamento", start_date: today(),
      hypotheses: form.hypotheses, objective: form.objectives,
      checklist: DEFAULT_CHECKLIST.map((label) => ({ id: uid(), label, done: false })),
      instruments: [], sessions_plan: [],
    };
    if (useAi && ai) {
      base.objective = ai.objective;
      base.ai_justification = [ai.justification, ...ai.instruments.map((i) => `• ${i.name}: ${i.justification}`), ...(ai.warnings.length ? ["", "Atenção:", ...ai.warnings.map((w) => `• ${w}`)] : [])].join("\n");
      base.instruments = ai.instruments.map((i) => ({ id: uid(), name: i.name, status: "planejado", session: i.session }));
      base.sessions_plan = ai.sessions.map((s) => ({ id: uid(), number: s.number, objective: s.objective, instruments: s.instruments, duration_min: s.duration_min }));
      if (ai.checklist.length) base.checklist = ai.checklist.map((label) => ({ id: uid(), label, done: false }));
    }
    await onCreate(base);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Novo plano de avaliação"
      footer={
        <>
          <Button variant="secondary" onClick={() => create(false)}>Criar em branco</Button>
          {ai ? (
            <Button onClick={() => create(true)}>Usar sugestão</Button>
          ) : (
            <Button variant="ai" onClick={generate} loading={loading}><Sparkles className="h-4 w-4" /> Gerar com IA</Button>
          )}
        </>
      }
    >
      {!ai ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">Idade: <b>{ageLabel(patient.birth_date)}</b>. Informe o contexto e a IA sugerirá instrumentos, ordem de aplicação, número de sessões e justificativa.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Queixa"><Textarea value={form.complaint} onChange={(e) => setForm({ ...form, complaint: e.target.value })} /></Field>
            <Field label="Hipótese diagnóstica"><Textarea value={form.hypotheses} onChange={(e) => setForm({ ...form, hypotheses: e.target.value })} /></Field>
            <Field label="Dificuldades observadas"><Textarea value={form.difficulties} onChange={(e) => setForm({ ...form, difficulties: e.target.value })} /></Field>
            <Field label="Objetivos da avaliação"><Textarea value={form.objectives} onChange={(e) => setForm({ ...form, objectives: e.target.value })} /></Field>
          </div>
          <p className="text-[11px] text-ink-faint">Nome, contatos e escola não são enviados à IA.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AiNotice demo={demo} />
          <Field label="Objetivo"><Textarea value={ai.objective} onChange={(e) => setAi({ ...ai, objective: e.target.value })} /></Field>
          <div>
            <p className="mb-2 text-xs font-medium text-ink-soft">Instrumentos sugeridos (ordem de aplicação) — {ai.total_sessions} sessões</p>
            <ul className="space-y-2">
              {ai.instruments.map((ins, i) => (
                <li key={i} className="rounded-lg border border-line p-3">
                  <div className="flex items-center gap-2">
                    <Input className="h-8 max-w-[180px]" value={ins.name} onChange={(e) => setAi({ ...ai, instruments: ai.instruments.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                    <Badge tone="gray">Sessão {ins.session}</Badge>
                    {restricted(ins.name) && <Badge tone="amber"><AlertTriangle className="h-3 w-3" /> Uso privativo de psicólogos?</Badge>}
                    <button className="ml-auto text-ink-faint hover:text-red-600" onClick={() => setAi({ ...ai, instruments: ai.instruments.filter((_, j) => j !== i) })} aria-label="Remover"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <p className="mt-1.5 text-xs text-ink-soft">{ins.justification}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-ink-soft">Objetivos por sessão</p>
            <ul className="space-y-1.5">
              {ai.sessions.map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-xs text-ink-faint">Sessão {s.number}</span>
                  <Input className="h-8" value={s.objective} onChange={(e) => setAi({ ...ai, sessions: ai.sessions.map((x, j) => (j === i ? { ...x, objective: e.target.value } : x)) })} />
                </li>
              ))}
            </ul>
          </div>
          <Field label="Justificativa clínica"><Textarea rows={4} value={ai.justification} onChange={(e) => setAi({ ...ai, justification: e.target.value })} /></Field>
          {ai.warnings.length > 0 && (
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              {ai.warnings.map((w, i) => <p key={i}>• {w}</p>)}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function AssessmentEditor({ a, onSave, onDelete, onConclude }: {
  a: Assessment; onSave: (p: Partial<Assessment>) => Promise<void>; onDelete: () => void; onConclude: () => void;
}) {
  const [f, setF] = useState<Assessment>(a);
  const [newIns, setNewIns] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => setF(a), [a]);

  const setIns = (id: string, patch: Partial<AssessmentInstrument>) =>
    setF({ ...f, instruments: f.instruments.map((i) => (i.id === id ? { ...i, ...patch } : i)) });

  async function save() {
    setSaving(true);
    await onSave(f).finally(() => setSaving(false));
  }

  return (
    <Card>
      <CardHeader
        title={f.title}
        subtitle={`Início ${formatDate(f.start_date)}${f.status === "concluida" ? ` · Concluída ${formatDate(f.end_date)}` : ""}`}
        action={
          <div className="flex gap-2">
            <Button variant="danger" size="sm" onClick={onDelete} aria-label="Excluir avaliação"><Trash2 className="h-3.5 w-3.5" /></Button>
            <Button size="sm" onClick={save} loading={saving}><Save className="h-3.5 w-3.5" /> Salvar</Button>
          </div>
        }
      />
      <div className="space-y-6 p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Título" className="sm:col-span-2"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Início"><Input type="date" value={f.start_date ?? ""} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></Field>
          <Field label="Término"><Input type="date" value={f.end_date ?? ""} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></Field>
          <Field label="Objetivo da avaliação" className="sm:col-span-2"><Textarea value={f.objective ?? ""} onChange={(e) => setF({ ...f, objective: e.target.value })} /></Field>
          <Field label="Hipóteses clínicas" className="sm:col-span-2"><Textarea value={f.hypotheses ?? ""} onChange={(e) => setF({ ...f, hypotheses: e.target.value })} /></Field>
        </div>

        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Instrumentos</h4>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-canvas text-left text-xs text-ink-faint">
                <tr><th className="px-3 py-2">Instrumento</th><th className="px-3 py-2">Sessão</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Data</th><th className="px-3 py-2">Anotações</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {f.instruments.map((ins) => (
                  <tr key={ins.id}>
                    <td className="px-3 py-2 font-medium">
                      {ins.name}
                      {restricted(ins.name) && <span title="Possivelmente de uso privativo de psicólogos — verifique no SATEPSI"><AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-amber-500" /></span>}
                    </td>
                    <td className="px-3 py-2"><Input className="h-8 w-16" type="number" min={1} value={ins.session ?? ""} onChange={(e) => setIns(ins.id, { session: Number(e.target.value) })} /></td>
                    <td className="px-3 py-2">
                      <Select className="h-8 w-36" value={ins.status} onChange={(e) => setIns(ins.id, { status: e.target.value as InstrumentStatus })}
                        options={Object.entries(INSTRUMENT_STATUS).map(([value, v]) => ({ value, label: v.label }))} />
                    </td>
                    <td className="px-3 py-2"><Input className="h-8 w-36" type="date" value={ins.date ?? ""} onChange={(e) => setIns(ins.id, { date: e.target.value })} /></td>
                    <td className="px-3 py-2"><Input className="h-8" value={ins.notes ?? ""} onChange={(e) => setIns(ins.id, { notes: e.target.value })} /></td>
                    <td className="px-2"><button className="text-ink-faint hover:text-red-600" onClick={() => setF({ ...f, instruments: f.instruments.filter((i) => i.id !== ins.id) })} aria-label="Remover"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex gap-2">
            <Input list="instrument-list" placeholder="Adicionar instrumento (ex.: PROLEC)" value={newIns} onChange={(e) => setNewIns(e.target.value)} className="max-w-xs" />
            <datalist id="instrument-list">
              {INSTRUMENTS.map((i) => <option key={i.name} value={i.name}>{i.full} — {i.domain}</option>)}
            </datalist>
            <Button variant="secondary" size="sm" className="h-9" onClick={() => {
              if (!newIns.trim()) return;
              setF({ ...f, instruments: [...f.instruments, { id: uid(), name: newIns.trim(), status: "planejado" }] });
              setNewIns("");
            }}><Plus className="h-4 w-4" /></Button>
          </div>
          {f.instruments.some((i) => restricted(i.name)) && (
            <p className="mt-2 text-[11px] text-amber-700">⚠ Instrumentos marcados podem ser de uso privativo de psicólogos. Confirme a situação atual no SATEPSI/CFP antes de aplicar.</p>
          )}
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint"><CheckSquare className="h-3.5 w-3.5" /> Checklist de aplicação</h4>
            <ul className="space-y-1.5">
              {f.checklist.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={c.done} onChange={(e) => setF({ ...f, checklist: f.checklist.map((x) => (x.id === c.id ? { ...x, done: e.target.checked } : x)) })} />
                  <span className={c.done ? "text-ink-faint line-through" : ""}>{c.label}</span>
                  <button className="ml-auto text-ink-faint hover:text-red-600" onClick={() => setF({ ...f, checklist: f.checklist.filter((x) => x.id !== c.id) })} aria-label="Remover"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
            <div className="mt-2">
              <ListEditor items={[]} placeholder="Novo item do checklist" onChange={(items) => setF({ ...f, checklist: [...f.checklist, ...items.map((label) => ({ id: uid(), label, done: false }))] })} />
            </div>
          </section>
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Plano de sessões</h4>
            {f.sessions_plan.length === 0 ? (
              <p className="text-xs text-ink-faint">Nenhuma sessão planejada.</p>
            ) : (
              <ul className="space-y-1.5">
                {f.sessions_plan.map((s) => (
                  <li key={s.id} className="rounded-lg bg-canvas px-3 py-2 text-sm">
                    <span className="font-medium">Sessão {s.number}:</span> {s.objective}
                    {s.instruments.length > 0 && <span className="text-xs text-ink-faint"> — {s.instruments.join(", ")}</span>}
                  </li>
                ))}
              </ul>
            )}
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setF({ ...f, sessions_plan: [...f.sessions_plan, { id: uid(), number: f.sessions_plan.length + 1, objective: "Nova sessão", instruments: [] }] })}>
              <Plus className="h-3.5 w-3.5" /> Sessão
            </Button>
          </section>
        </div>

        {f.ai_justification && (
          <Field label="Justificativa clínica (sugerida pela IA, editável)">
            <Textarea rows={5} value={f.ai_justification} onChange={(e) => setF({ ...f, ai_justification: e.target.value })} />
          </Field>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Anotações clínicas"><Textarea rows={4} value={f.clinical_notes ?? ""} onChange={(e) => setF({ ...f, clinical_notes: e.target.value })} /></Field>
          <Field label="Observações"><Textarea rows={4} value={f.observations ?? ""} onChange={(e) => setF({ ...f, observations: e.target.value })} /></Field>
        </div>

        {f.status === "em_andamento" && (
          <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-brand-100 bg-brand-50/50 p-4 sm:flex-row sm:items-center">
            <p className="text-sm text-ink-soft">Avaliação finalizada? Conclua e crie o plano de intervenção a partir dela.</p>
            <Button onClick={async () => { await onSave({ ...f, status: "concluida", end_date: f.end_date || today() }); onConclude(); }}>
              Concluir e criar plano
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

export function AssessmentsTab({ patient }: { patient: Patient }) {
  const router = useRouter();
  const toast = useToast();
  const { data, loading, insert, update, remove } = useCollection("assessments", { filter: { patient_id: patient.id } });
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!selected && data.length) setSelected(data[0].id);
  }, [data, selected]);

  if (loading) return <Spinner />;
  const current = data.find((a) => a.id === selected);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
      <div className="space-y-2">
        <Button className="w-full" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nova avaliação</Button>
        {data.map((a) => {
          const done = a.instruments.filter((i) => i.status !== "planejado").length;
          return (
            <button key={a.id} onClick={() => setSelected(a.id)} className={`w-full rounded-xl border p-3 text-left transition ${selected === a.id ? "border-brand-300 bg-white shadow-card" : "border-line bg-white/60 hover:bg-white"}`}>
              <p className="truncate text-sm font-medium">{a.title}</p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-ink-faint">{formatDate(a.start_date)}</span>
                <Badge tone={a.status === "concluida" ? "green" : "lilac"}>{a.status === "concluida" ? "Concluída" : `${done}/${a.instruments.length}`}</Badge>
              </div>
            </button>
          );
        })}
      </div>
      {current ? (
        <AssessmentEditor
          a={current}
          onSave={async (p) => {
            await update(current.id, p);
            toast("Avaliação salva");
          }}
          onDelete={async () => {
            if (!confirm("Excluir esta avaliação?")) return;
            await remove(current.id);
            setSelected(null);
          }}
          onConclude={() => router.replace(`/pacientes/${patient.id}?tab=intervencao&from=${current.id}`)}
        />
      ) : (
        <Card>
          <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="Nenhuma avaliação" text="Crie um plano de avaliação manualmente ou com apoio da IA." action={<Button variant="ai" onClick={() => setOpen(true)}><Sparkles className="h-4 w-4" /> Planejar avaliação</Button>} />
        </Card>
      )}
      <NewAssessmentModal
        patient={patient}
        open={open}
        onClose={() => setOpen(false)}
        onCreate={async (a) => {
          const r = await insert(a);
          setSelected(r.id);
          toast("Plano de avaliação criado");
        }}
      />
    </div>
  );
}
