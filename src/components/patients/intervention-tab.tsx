"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarRange, Check, ChevronDown, ChevronUp, FileText, Plus, Save, Sparkles, Target, Trash2 } from "lucide-react";
import {
  AiNotice, Badge, Button, Card, CardHeader, EmptyState, Field, Input, ListEditor, Modal, Select, Spinner, Textarea, useToast,
} from "@/components/ui";
import { useCollection } from "@/lib/data/provider";
import { askAI, patientContext } from "@/lib/ai/client";
import type { Assessment, InterventionPlan, Patient, PlannedSession } from "@/lib/types";
import { ActivitiesEditor, AttachmentsField, ObjectivesEditor } from "@/components/sessions/editors";
import { PlanAreasEditor } from "@/components/sessions/plan-areas";
import { areasOf, buildAreaOptions, flattenAreas, objectiveBank } from "@/lib/objective-bank";
import { useData } from "@/lib/data/provider";
import type { PlanArea } from "@/lib/types";
import { activitiesOf, groupByArea, objectiveSummary, objectivesOf, OBJECTIVE_STATUS, toActivities, toObjectives, withActivities, withObjectives } from "@/lib/sessions";
import { addDays, formatDate, parseDate, toISODate, today, uid } from "@/lib/utils";

interface AiPlan {
  title: string;
  general_objective: string;
  areas?: Array<{ area: string; objectives: string[] }>;
  specific_objectives?: string[];
  goals: string[];
  progress_criteria: string;
  sessions: Array<{
    number: number; objectives?: unknown; objective?: string; activities?: unknown; materials?: string;
    duration_min?: number; strategies?: string; success_criteria?: string;
  }>;
}

/** Distribui as datas das sessões conforme a frequência semanal a partir da data de início. */
function scheduleDates(start: string, count: number, perWeek: number) {
  const gaps = perWeek >= 2 ? [3, 4] : [7];
  const dates: string[] = [];
  let d = parseDate(start);
  for (let i = 0; i < count; i++) {
    dates.push(toISODate(d));
    d = addDays(d, perWeek >= 3 ? 2 : gaps[i % gaps.length]);
  }
  return dates;
}

function blankSession(n: number): PlannedSession {
  return { id: uid(), number: n, objective: "", activities: "", objectives: [], activity_list: [], attachments: [], materials: "", duration_min: 45, strategies: "", success_criteria: "", done: false };
}

/** Converte uma sessão sugerida pela IA (vários objetivos e atividades) em sessão do plano. */
function sessionFromAI(s: AiPlan["sessions"][number], n: number, date?: string): PlannedSession {
  let ps: PlannedSession = {
    ...blankSession(n), date, materials: s.materials ?? "", duration_min: Number(s.duration_min) || 45,
    strategies: s.strategies ?? "", success_criteria: s.success_criteria ?? "",
  };
  ps = withObjectives(ps, toObjectives(s.objectives ?? s.objective));
  ps = withActivities(ps, toActivities(s.activities));
  return ps;
}

function NewPlanModal({ patient, assessment, open, onClose, onCreate }: {
  patient: Patient; assessment?: Assessment; open: boolean; onClose: () => void; onCreate: (p: Partial<InterventionPlan>) => Promise<void>;
}) {
  const toast = useToast();
  const [count, setCount] = useState(8);
  const [focus, setFocus] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [ai, setAi] = useState<AiPlan | null>(null);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(false);
  const { profile } = useData();

  useEffect(() => {
    if (open) {
      setAi(null);
      setFocus(assessment?.clinical_notes ?? "");
    }
  }, [open, assessment]);

  async function generate() {
    setLoading(true);
    try {
      const r = await askAI<AiPlan>("intervention_plan", {
        ...patientContext(patient),
        areas_disponiveis: Object.keys(objectiveBank(profile)),
        sessions_count: count,
        foco: focus || undefined,
        avaliacao: assessment
          ? {
              objetivo: assessment.objective,
              hipoteses: assessment.hypotheses,
              instrumentos: assessment.instruments.map((i) => `${i.name}${i.notes ? `: ${i.notes}` : ""}`),
              anotacoes: assessment.clinical_notes,
              observacoes: assessment.observations,
            }
          : undefined,
      });
      setAi(r.result);
      setDemo(r.demo);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro na IA", "error");
    } finally {
      setLoading(false);
    }
  }

  async function create(useAi: boolean) {
    const dates = scheduleDates(startDate, useAi && ai ? ai.sessions.length : count, patient.weekly_frequency ?? 1);
    const plan: Partial<InterventionPlan> = {
      patient_id: patient.id, assessment_id: assessment?.id ?? null, status: "ativo", start_date: startDate,
      title: "Plano de intervenção", specific_objectives: [], areas: [], goals: [],
      schedule: Array.from({ length: count }, (_, i) => ({ ...blankSession(i + 1), date: dates[i] })),
    };
    if (useAi && ai) {
      Object.assign(plan, {
        title: ai.title, general_objective: ai.general_objective, progress_criteria: ai.progress_criteria,
        ...(() => {
          const areas: PlanArea[] = ai.areas?.length
            ? ai.areas.map((a) => ({ id: uid(), area: a.area, objectives: (a.objectives ?? []).map((text) => ({ id: uid(), text })) }))
            : areasOf({ specific_objectives: (ai.specific_objectives ?? []).map((text) => ({ id: uid(), text })) });
          return { areas, specific_objectives: flattenAreas(areas) };
        })(),
        goals: ai.goals.map((text) => ({ id: uid(), text })),
        schedule: ai.sessions.map((s, i) => sessionFromAI(s, i + 1, dates[i])),
      });
    }
    await onCreate(plan);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} wide title="Novo plano de intervenção"
      footer={
        <>
          <Button variant="secondary" onClick={() => create(false)}>Criar em branco</Button>
          {ai ? <Button onClick={() => create(true)}>Usar sugestão</Button> : <Button variant="ai" onClick={generate} loading={loading}><Sparkles className="h-4 w-4" /> Gerar com IA</Button>}
        </>
      }
    >
      {!ai ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            A IA considera idade, diagnóstico, hipóteses, habilidades, dificuldades e perfis cognitivo/comportamental registrados no prontuário
            {assessment ? <> e os resultados da avaliação <b>{assessment.title}</b></> : null}.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Número de sessões"><Input type="number" min={1} max={40} value={count} onChange={(e) => setCount(Number(e.target.value))} /></Field>
            <Field label="Início"><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
            <Field label="Frequência" hint="Definida no cadastro"><Input disabled value={`${patient.weekly_frequency ?? 1}x/semana`} /></Field>
          </div>
          <Field label="Foco / observações para o plano (opcional)"><Textarea value={focus} onChange={(e) => setFocus(e.target.value)} /></Field>
        </div>
      ) : (
        <div className="space-y-4">
          <AiNotice demo={demo} />
          <Field label="Título"><Input value={ai.title} onChange={(e) => setAi({ ...ai, title: e.target.value })} /></Field>
          <Field label="Objetivo geral"><Textarea value={ai.general_objective} onChange={(e) => setAi({ ...ai, general_objective: e.target.value })} /></Field>
          <div>
            <p className="mb-2 text-xs font-medium text-ink-soft">Áreas e objetivos específicos (edite tudo depois de criar)</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(ai.areas ?? []).map((a, i) => (
                <div key={i} className="rounded-lg bg-canvas px-3 py-2 text-sm">
                  <p className="font-display font-semibold text-brand-700">{a.area}</p>
                  <ul className="mt-1 list-disc pl-5 text-xs text-ink-soft">{(a.objectives ?? []).map((o, j) => <li key={j}>{o}</li>)}</ul>
                </div>
              ))}
              {!ai.areas?.length && (ai.specific_objectives ?? []).map((o, j) => <p key={j} className="text-xs text-ink-soft">• {o}</p>)}
            </div>
          </div>
          <Field label="Metas"><ListEditor items={ai.goals} onChange={(v) => setAi({ ...ai, goals: v })} /></Field>
          <div>
            <p className="mb-2 text-xs font-medium text-ink-soft">Cronograma sugerido ({ai.sessions.length} sessões) — editável após criar</p>
            <ul className="space-y-1.5 text-sm">
              {ai.sessions.map((s, i) => {
                const objs = toObjectives(s.objectives ?? s.objective);
                const acts = toActivities(s.activities);
                return (
                  <li key={i} className="rounded-lg bg-canvas px-3 py-2">
                    <b>Sessão {i + 1}</b> · {objs.length} objetivo(s), {acts.length} atividade(s)
                    <ul className="mt-1 list-disc pl-5 text-xs text-ink-soft">{objs.map((o) => <li key={o.id}>{o.text}</li>)}</ul>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  );
}

function SessionCard({ s, patientId, planTitle, onChange, onRemove, onSuggest, areaOptions }: {
  s: PlannedSession; patientId: string; planTitle: string; onChange: (next: PlannedSession) => void; onRemove: () => void; onSuggest: () => Promise<void>;
  areaOptions: ReturnType<typeof buildAreaOptions>;
}) {
  const [open, setOpen] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const objectives = objectivesOf(s);
  const activities = activitiesOf(s);
  const sum = objectiveSummary(objectives);
  return (
    <div className={`rounded-xl border ${s.done ? "border-emerald-200 bg-emerald-50/30" : "border-line bg-white"}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => onChange({ ...s, done: !s.done })} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${s.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-line"}`} aria-label="Marcar como realizada">
          {s.done && <Check className="h-3 w-3" />}
        </button>
        <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(!open)}>
          <p className="text-sm font-medium">Sessão {s.number}{s.date ? <span className="font-normal text-ink-faint"> · {formatDate(s.date)}</span> : null}</p>
          <p className="truncate text-xs text-ink-soft">
            {objectives.length ? groupByArea(objectives).map((g) => `${g.area}: ${g.items.length}`).join(" · ") : "Sem objetivos definidos"}
          </p>
        </button>
        <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
          <Badge>{objectives.length} obj.</Badge>
          <Badge>{activities.length} ativ.</Badge>
          {sum.evaluated > 0 && <Badge tone="green">{sum.atingido}/{sum.total} atingidos</Badge>}
          {(s.attachments?.length ?? 0) > 0 && <Badge tone="sage">{s.attachments!.length} anexo(s)</Badge>}
        </div>
        <button onClick={() => setOpen(!open)} className="text-ink-faint" aria-label="Expandir">{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
      </div>
      {open && (
        <div className="grid gap-4 border-t border-line p-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <Button variant="ai" size="sm" loading={suggesting} onClick={async () => { setSuggesting(true); await onSuggest().finally(() => setSuggesting(false)); }}>
              <Sparkles className="h-3.5 w-3.5" /> Sugerir objetivos e atividades com IA
            </Button>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-soft">Objetivos da sessão</p>
            <ObjectivesEditor value={objectives} onChange={(v) => onChange(withObjectives(s, v))} withStatus areaOptions={areaOptions} />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-soft">Atividades</p>
            <ActivitiesEditor value={activities} onChange={(v) => onChange(withActivities(s, v))} withDone />
          </div>
          <Field label="Materiais gerais"><Textarea value={s.materials} onChange={(e) => onChange({ ...s, materials: e.target.value })} /></Field>
          <Field label="Estratégias"><Textarea value={s.strategies} onChange={(e) => onChange({ ...s, strategies: e.target.value })} /></Field>
          <Field label="Critérios de sucesso"><Textarea value={s.success_criteria} onChange={(e) => onChange({ ...s, success_criteria: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data"><Input type="date" value={s.date ?? ""} onChange={(e) => onChange({ ...s, date: e.target.value })} /></Field>
            <Field label="Tempo (min)"><Input type="number" min={5} value={s.duration_min} onChange={(e) => onChange({ ...s, duration_min: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Registro" className="lg:col-span-2"><Textarea value={s.record ?? ""} onChange={(e) => onChange({ ...s, record: e.target.value })} /></Field>
          <div className="lg:col-span-2">
            <p className="mb-1.5 text-xs font-medium text-ink-soft">Anexos da sessão (também aparecem em Documentos)</p>
            <AttachmentsField patientId={patientId} value={s.attachments ?? []} onChange={(v) => onChange({ ...s, attachments: v })} category="sessao" context={`${planTitle} — Sessão ${s.number}`} />
          </div>
          <div className="lg:col-span-2"><Button variant="danger" size="sm" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" /> Remover sessão</Button></div>
        </div>
      )}
    </div>
  );
}

function PlanEditor({ plan, patient, onSave, onDelete }: { plan: InterventionPlan; patient: Patient; onSave: (p: Partial<InterventionPlan>) => Promise<void>; onDelete: () => void }) {
  const toast = useToast();
  const { profile } = useData();
  const [f, setF] = useState<InterventionPlan>({ ...plan, areas: areasOf(plan) });
  const [saving, setSaving] = useState(false);
  const activities = useCollection("activities", { orderBy: "title", ascending: true });
  const bank = objectiveBank(profile);
  const areaOptions = buildAreaOptions(f.areas ?? [], bank);
  const setAreas = (areas: PlanArea[]) => setF({ ...f, areas, specific_objectives: flattenAreas(areas) });

  // Progresso por área: resultado dos objetivos marcados nas sessões
  const areaProgress = groupByArea(f.schedule.flatMap((x) => objectivesOf(x)).filter((o) => o.status)).map((g) => ({
    area: g.area, total: g.items.length, ok: g.items.filter((o) => o.status === "atingido").length, partial: g.items.filter((o) => o.status === "parcial").length,
  }));

  async function suggestSession(s: PlannedSession) {
    try {
      const r = await askAI<AiPlan["sessions"][number]>("plan_session", {
        ...patientContext(patient), objetivos_atuais: objectivesOf(s).map((o) => ({ area: o.area, text: o.text })), objetivo_geral_do_plano: f.general_objective,
        areas_do_plano: (f.areas ?? []).map((a) => ({ area: a.area, objetivos: a.objectives.map((o) => o.text) })),
        objetivos_especificos: f.specific_objectives.map((o) => o.text), numero_da_sessao: s.number,
        sessoes_anteriores: f.schedule.filter((x) => x.number < s.number).slice(-3).map((x) => ({
          objetivos: objectivesOf(x).map((o) => `${o.text}${o.status ? ` (${OBJECTIVE_STATUS[o.status].label})` : ""}`), registro: x.record,
        })),
        biblioteca: activities.data.filter((a) => a.favorite).slice(0, 15).map((a) => ({ titulo: a.title, area: a.area, objetivos: a.objectives })),
      });
      const sug = sessionFromAI(r.result, s.number, s.date);
      setF((cur) => ({
        ...cur,
        schedule: cur.schedule.map((x) => (x.id === s.id ? {
          ...x,
          objectives: sug.objectives?.length ? sug.objectives : x.objectives, objective: sug.objectives?.length ? sug.objective : x.objective,
          activity_list: sug.activity_list?.length ? sug.activity_list : x.activity_list, activities: sug.activity_list?.length ? sug.activities : x.activities,
          materials: sug.materials || x.materials, duration_min: sug.duration_min || x.duration_min,
          strategies: sug.strategies || x.strategies, success_criteria: sug.success_criteria || x.success_criteria,
        } : x)),
      }));
      toast(r.demo ? "Sugestão de exemplo inserida (modo demonstração) — revise e salve" : "Sugestão inserida — revise e salve o plano");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro na IA", "error");
    }
  }
  useEffect(() => setF({ ...plan, areas: areasOf(plan) }), [plan]);
  const done = f.schedule.filter((s) => s.done).length;
  const pct = f.schedule.length ? Math.round((done / f.schedule.length) * 100) : 0;

  return (
    <Card>
      <CardHeader
        title={f.title}
        subtitle={`Início ${formatDate(f.start_date)} · ${done}/${f.schedule.length} sessões (${pct}%)`}
        action={
          <div className="flex gap-2">
            <Link href={`/relatorios?novo=1&tipo=plano&paciente=${f.patient_id}&plano=${f.id}`}><Button variant="secondary" size="sm"><FileText className="h-3.5 w-3.5" /> Documento</Button></Link>
            <Button variant="danger" size="sm" onClick={onDelete} aria-label="Excluir plano"><Trash2 className="h-3.5 w-3.5" /></Button>
            <Button size="sm" loading={saving} onClick={async () => { setSaving(true); await onSave(f).finally(() => setSaving(false)); }}><Save className="h-3.5 w-3.5" /> Salvar</Button>
          </div>
        }
      />
      <div className="h-1 bg-slate-100"><div className="h-1 bg-linear-to-r from-brand-400 to-sage-400" style={{ width: `${pct}%` }} /></div>
      <div className="space-y-6 p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Título" className="sm:col-span-2"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as InterventionPlan["status"] })} options={[{ value: "ativo", label: "Ativo" }, { value: "pausado", label: "Pausado" }, { value: "concluido", label: "Concluído" }]} /></Field>
          <Field label="Início"><Input type="date" value={f.start_date ?? ""} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></Field>
          <Field label="Objetivo geral" className="sm:col-span-4"><Textarea value={f.general_objective ?? ""} onChange={(e) => setF({ ...f, general_objective: e.target.value })} /></Field>
        </div>
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Áreas de intervenção e objetivos específicos</h4>
          <PlanAreasEditor value={f.areas ?? []} onChange={setAreas} />
          {areaProgress.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {areaProgress.map((a) => (
                <span key={a.area} className="rounded-lg bg-canvas px-2.5 py-1 text-[11px] text-ink-soft">
                  <b className="text-ink">{a.area}</b>: {a.ok}/{a.total} atingidos{a.partial ? `, ${a.partial} parciais` : ""}
                </span>
              ))}
            </div>
          )}
        </section>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Field label="Metas">
            <ListEditor items={f.goals.map((o) => o.text)} onChange={(v) => setF({ ...f, goals: v.map((text, i) => ({ id: f.goals[i]?.id ?? uid(), text })) })} placeholder="Nova meta" />
          </Field>
        </div>
        <Field label="Critérios de evolução"><Textarea value={f.progress_criteria ?? ""} onChange={(e) => setF({ ...f, progress_criteria: e.target.value })} /></Field>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint"><CalendarRange className="h-3.5 w-3.5" /> Cronograma de sessões</h4>
            <Button variant="ghost" size="sm" onClick={() => setF({ ...f, schedule: [...f.schedule, blankSession(f.schedule.length + 1)] })}><Plus className="h-3.5 w-3.5" /> Sessão</Button>
          </div>
          <div className="space-y-2">
            {f.schedule.map((s) => (
              <SessionCard
                key={s.id}
                s={s}
                patientId={f.patient_id}
                planTitle={f.title}
                areaOptions={areaOptions}
                onChange={(next) => setF({ ...f, schedule: f.schedule.map((x) => (x.id === s.id ? next : x)) })}
                onRemove={() => setF({ ...f, schedule: f.schedule.filter((x) => x.id !== s.id).map((x, i) => ({ ...x, number: i + 1 })) })}
                onSuggest={() => suggestSession(s)}
              />
            ))}
          </div>
        </section>
      </div>
    </Card>
  );
}

export function InterventionTab({ patient }: { patient: Patient }) {
  const params = useSearchParams();
  const toast = useToast();
  const plans = useCollection("intervention_plans", { filter: { patient_id: patient.id } });
  const assessments = useCollection("assessments", { filter: { patient_id: patient.id } });
  const [selected, setSelected] = useState<string | null>(null);
  const fromAssessment = params.get("from");
  const [open, setOpen] = useState(Boolean(fromAssessment));

  useEffect(() => {
    if (!selected && plans.data.length) setSelected(plans.data[0].id);
  }, [plans.data, selected]);

  if (plans.loading) return <Spinner />;
  const current = plans.data.find((p) => p.id === selected);
  const baseAssessment = assessments.data.find((a) => a.id === fromAssessment) ?? assessments.data.find((a) => a.status === "concluida");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="space-y-2">
        <Button className="w-full" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Novo plano</Button>
        {plans.data.map((p) => (
          <button key={p.id} onClick={() => setSelected(p.id)} className={`w-full rounded-xl border p-3 text-left transition ${selected === p.id ? "border-brand-300 bg-white shadow-card" : "border-line bg-white/60 hover:bg-white"}`}>
            <p className="truncate text-sm font-medium">{p.title}</p>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs text-ink-faint">{formatDate(p.start_date)}</span>
              <Badge tone={p.status === "ativo" ? "green" : p.status === "pausado" ? "amber" : "gray"}>{p.status}</Badge>
            </div>
          </button>
        ))}
      </div>
      {current ? (
        <PlanEditor
          plan={current}
          patient={patient}
          onSave={async (p) => { await plans.update(current.id, p); toast("Plano salvo"); }}
          onDelete={async () => { if (!confirm("Excluir este plano?")) return; await plans.remove(current.id); setSelected(null); }}
        />
      ) : (
        <Card>
          <EmptyState icon={<Target className="h-5 w-5" />} title="Nenhum plano de intervenção" text="Após a avaliação, crie um plano com objetivos, metas e cronograma gerado automaticamente." action={<Button variant="ai" onClick={() => setOpen(true)}><Sparkles className="h-4 w-4" /> Criar plano</Button>} />
        </Card>
      )}
      <NewPlanModal
        patient={patient}
        assessment={baseAssessment}
        open={open}
        onClose={() => setOpen(false)}
        onCreate={async (p) => { const r = await plans.insert(p); setSelected(r.id); toast("Plano criado"); }}
      />
    </div>
  );
}
