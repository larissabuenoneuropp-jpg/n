"use client";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Brain, Lightbulb, NotebookPen, Paperclip, Pencil, Plus, Sparkles, Trash2, TrendingUp,
} from "lucide-react";
import {
  AiNotice, Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, Select, Spinner, Textarea, useToast,
} from "@/components/ui";
import { LineChart } from "@/components/charts";
import { useCollection, useData } from "@/lib/data/provider";
import { ActivitiesEditor, AttachmentsField, ObjectivesEditor } from "@/components/sessions/editors";
import { areasOf, buildAreaOptions, objectiveBank } from "@/lib/objective-bank";
import { activitiesOf, activitiesText, OBJECTIVE_STATUS, objectiveSummary, objectivesOf, objectivesText, withActivities, withObjectives } from "@/lib/sessions";
import { askAI, patientContext } from "@/lib/ai/client";
import type { Patient, PlannedSession, ProgressScales, SessionInsights, SessionRecord } from "@/lib/types";
import { formatDate, today } from "@/lib/utils";

const SCALES: Array<{ key: keyof ProgressScales; label: string }> = [
  { key: "attention", label: "Atenção" },
  { key: "engagement", label: "Engajamento" },
  { key: "autonomy", label: "Autonomia" },
  { key: "goal_achievement", label: "Alcance do objetivo" },
];

const TEXT_FIELDS: Array<{ key: keyof SessionRecord; label: string }> = [
  { key: "materials", label: "Materiais utilizados" },
  { key: "child_response", label: "Resposta da criança" },
  { key: "behavior", label: "Comportamento observado" },
  { key: "parent_guidance", label: "Orientações aos pais" },
  { key: "next_plan", label: "Planejamento da próxima sessão" },
  { key: "clinical_evolution", label: "Evolução clínica" },
];

function recordForAI(r: Partial<SessionRecord>) {
  const objs = objectivesOf({ objective: r.objective, objectives: r.objective_results });
  return {
    data: r.date,
    objetivos: objs.map((o) => ({ objetivo: o.text, resultado: o.status ? OBJECTIVE_STATUS[o.status].label : "não avaliado" })),
    atividades: activitiesOf({ activities: r.activities, activity_list: r.activity_results }).map((a) => `${a.title}${a.done === false ? " (não realizada)" : ""}`),
    resposta: r.child_response,
    comportamento: r.behavior, evolucao: r.clinical_evolution, escalas_1a5: r.progress,
  };
}

function InsightsView({ ins }: { ins: SessionInsights }) {
  const block = (title: string, items: string[] | undefined, icon: React.ReactNode, tone = "") =>
    items && items.length > 0 ? (
      <div>
        <p className={`mb-1 flex items-center gap-1.5 text-xs font-semibold ${tone || "text-ink-soft"}`}>{icon}{title}</p>
        <ul className="space-y-0.5 text-sm text-ink-soft">{items.map((x, i) => <li key={i}>• {x}</li>)}</ul>
      </div>
    ) : null;
  return (
    <div className="space-y-3">
      {ins.next_objective && <p className="text-sm"><b>Próximo objetivo:</b> {ins.next_objective}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {block("Novas atividades", ins.new_activities, <Lightbulb className="h-3.5 w-3.5" />)}
        {block("Estratégias", ins.strategies, <Brain className="h-3.5 w-3.5" />)}
        {block("Dificuldades observadas", ins.difficulties, null)}
        {block("Habilidades emergentes", ins.emerging_skills, <TrendingUp className="h-3.5 w-3.5" />)}
        {block("Alertas clínicos", ins.clinical_alerts, <AlertTriangle className="h-3.5 w-3.5" />, "text-amber-700")}
        {block("Possíveis encaminhamentos", ins.referrals, null, "text-sage-600")}
      </div>
    </div>
  );
}

function SessionForm({ patient, open, onClose, initial, appointmentId, onSaved }: {
  patient: Patient; open: boolean; onClose: () => void; initial?: SessionRecord | null; appointmentId?: string | null;
  onSaved: (r: SessionRecord) => void;
}) {
  const { store, bump, profile } = useData();
  const toast = useToast();
  const plans = useCollection("intervention_plans", { filter: { patient_id: patient.id } });
  const [f, setF] = useState<Partial<SessionRecord>>({});
  const linkedPlan = plans.data.find((p) => p.id === f.plan_id);
  const [saving, setSaving] = useState(false);
  const [withAi, setWithAi] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setF({
        ...initial,
        objective_results: objectivesOf({ objective: initial.objective, objectives: initial.objective_results }),
        activity_results: activitiesOf({ activities: initial.activities, activity_list: initial.activity_results }),
      });
      return;
    }
    // Pré-preenche com a próxima sessão planejada do plano ativo
    const active = plans.data.find((p) => p.status === "ativo");
    const next = active?.schedule.find((s) => !s.done);
    setF({
      patient_id: patient.id, date: today(), start_time: new Date().toTimeString().slice(0, 5),
      appointment_id: appointmentId ?? null, plan_id: active?.id ?? null,
      // objetivos e atividades da sessão planejada, para marcar o resultado de cada um
      objective_results: next ? objectivesOf(next).map((o) => ({ ...o, status: null })) : [],
      activity_results: next ? activitiesOf(next).map((a) => ({ ...a, done: true })) : [],
      materials: next?.materials ?? "",
      progress: { attention: 3, engagement: 3, autonomy: 3, goal_achievement: 3 }, attachments: [],
    });
  }, [open, initial, patient.id, appointmentId, plans.data]);

  async function save() {
    if (!f.date) return toast("Informe a data.", "error");
    setSaving(true);
    try {
      const payload: Partial<SessionRecord> = {
        ...f,
        objective: objectivesText(f.objective_results ?? []),
        activities: activitiesText((f.activity_results ?? []).filter((a) => a.done !== false)),
      };
      let rec = initial ? await store.update("session_records", initial.id, payload) : await store.insert("session_records", payload);
      // Marca a sessão planejada como realizada e leva o resultado de cada objetivo/atividade para o plano
      if (!initial && rec.plan_id) {
        const plan = plans.data.find((p) => p.id === rec.plan_id);
        const next = plan?.schedule.find((s) => !s.done);
        if (plan && next) {
          await store.update("intervention_plans", plan.id, {
            schedule: plan.schedule.map((s) => {
              if (s.id !== next.id) return s;
              let upd: PlannedSession = { ...s, done: true, record: rec.clinical_evolution || rec.child_response || "Realizada", attachments: [...(s.attachments ?? []), ...(rec.attachments ?? [])] };
              upd = withObjectives(upd, rec.objective_results ?? objectivesOf(s));
              upd = withActivities(upd, rec.activity_results ?? activitiesOf(s));
              return upd;
            }),
          });
          bump("intervention_plans");
        }
      }
      if (!initial && rec.appointment_id) {
        await store.update("appointments", rec.appointment_id, { status: "realizado" }).catch(() => {});
        bump("appointments");
      }
      if (withAi && !initial) {
        try {
          const history = (await store.list("session_records", { filter: { patient_id: patient.id }, orderBy: "date" })).slice(1, 5);
          const r = await askAI<SessionInsights>("session_insights", {
            ...patientContext(patient), sessao_atual: recordForAI(rec), historico_recente: history.map(recordForAI),
          });
          rec = await store.update("session_records", rec.id, { ai_insights: r.result });
        } catch (e) {
          toast(e instanceof Error ? e.message : "IA indisponível", "error");
        }
      }
      bump("session_records");
      toast("Sessão registrada");
      onSaved(rec);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao salvar", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} wide title={initial ? "Editar registro de sessão" : "Registrar sessão"}
      footer={
        <>
          {!initial && (
            <label className="mr-auto flex items-center gap-2 text-xs text-ink-soft">
              <input type="checkbox" checked={withAi} onChange={(e) => setWithAi(e.target.checked)} />
              Gerar sugestões da IA após salvar
            </label>
          )}
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} loading={saving}>Salvar</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Data"><Input type="date" value={f.date ?? ""} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Horário"><Input type="time" value={f.start_time ?? ""} onChange={(e) => setF({ ...f, start_time: e.target.value })} /></Field>
          <Field label="Plano vinculado">
            <Select value={f.plan_id ?? ""} onChange={(e) => setF({ ...f, plan_id: e.target.value || null })} placeholder="Nenhum" options={plans.data.map((p) => ({ value: p.id, label: p.title }))} />
          </Field>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-soft">Objetivos da sessão — resultado de cada um</p>
            <ObjectivesEditor value={f.objective_results ?? []} onChange={(v) => setF({ ...f, objective_results: v })} withStatus
              areaOptions={buildAreaOptions(linkedPlan ? areasOf(linkedPlan) : [], objectiveBank(profile))} />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-soft">Atividades realizadas</p>
            <ActivitiesEditor value={f.activity_results ?? []} onChange={(v) => setF({ ...f, activity_results: v })} withDone />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {TEXT_FIELDS.map(({ key, label }) => (
            <Field key={key} label={label}>
              <Textarea value={(f[key] as string) ?? ""} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
            </Field>
          ))}
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-ink-soft">Escalas de progresso (1 = muito baixo · 5 = muito alto)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {SCALES.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 text-sm">
                <span className="w-36 shrink-0 text-ink-soft">{label}</span>
                <input type="range" min={1} max={5} value={f.progress?.[key] ?? 3} className="flex-1 accent-brand-600"
                  onChange={(e) => setF({ ...f, progress: { ...f.progress, [key]: Number(e.target.value) } })} />
                <span className="w-4 text-right font-medium tabular-nums">{f.progress?.[key] ?? 3}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-ink-soft">Fotos e arquivos (também aparecem em Documentos)</p>
          <AttachmentsField patientId={patient.id} value={f.attachments ?? []} onChange={(v) => setF({ ...f, attachments: v })}
            category="sessao" context={`Registro de sessão — ${f.date ? formatDate(f.date) : ""}`} />
        </div>
      </div>
    </Modal>
  );
}

interface Evolution {
  summary: string;
  progress_patterns: string[];
  stagnation_points: string[];
  suggested_adaptations: string[];
  next_steps: string[];
}

export function SessionsTab({ patient, autoNew, appointmentId }: { patient: Patient; autoNew?: boolean; appointmentId?: string | null }) {
  const { store } = useData();
  const toast = useToast();
  const { data, loading, remove, update } = useCollection("session_records", { filter: { patient_id: patient.id }, orderBy: "date" });
  const [open, setOpen] = useState(Boolean(autoNew));
  const [editing, setEditing] = useState<SessionRecord | null>(null);
  const [evolution, setEvolution] = useState<{ demo: boolean; data: Evolution } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [insightLoading, setInsightLoading] = useState<string | null>(null);

  const chartData = useMemo(
    () =>
      [...data].reverse().map((r) => ({
        x: formatDate(r.date, { day: "2-digit", month: "2-digit" }),
        attention: r.progress?.attention ?? 0,
        engagement: r.progress?.engagement ?? 0,
        autonomy: r.progress?.autonomy ?? 0,
        goal_achievement: r.progress?.goal_achievement ?? 0,
      })),
    [data],
  );

  async function analyze() {
    setAnalyzing(true);
    try {
      const r = await askAI<Evolution>("evolution_analysis", { ...patientContext(patient), sessoes: [...data].reverse().slice(-20).map(recordForAI) });
      setEvolution({ demo: r.demo, data: r.result });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro na IA", "error");
    } finally {
      setAnalyzing(false);
    }
  }

  async function regenerate(r: SessionRecord) {
    setInsightLoading(r.id);
    try {
      const res = await askAI<SessionInsights>("session_insights", { ...patientContext(patient), sessao_atual: recordForAI(r) });
      await update(r.id, { ai_insights: res.result });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro na IA", "error");
    } finally {
      setInsightLoading(null);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-soft">{data.length} sessão(ões) registrada(s)</p>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Registrar sessão</Button>
      </div>

      {data.length > 0 && (
        <Card>
          <CardHeader
            title="Escalas de progresso"
            icon={<TrendingUp className="h-4 w-4" />}
            subtitle="Escala 1–5 por sessão"
            action={<Button variant="ai" size="sm" onClick={analyze} loading={analyzing}><Sparkles className="h-3.5 w-3.5" /> Analisar evolução</Button>}
          />
          <div className="p-5">
            <LineChart data={chartData} xKey="x" yMax={5} series={SCALES.map((s) => ({ key: s.key, label: s.label }))} />
            {evolution && (
              <div className="mt-5 space-y-3 rounded-xl border border-sage-200 bg-sage-50/40 p-4">
                <AiNotice demo={evolution.demo} />
                <p className="text-sm">{evolution.data.summary}</p>
                <div className="grid gap-3 text-sm text-ink-soft sm:grid-cols-2">
                  {([["Padrões de progresso", evolution.data.progress_patterns], ["Pontos de estagnação", evolution.data.stagnation_points], ["Adaptações sugeridas", evolution.data.suggested_adaptations], ["Próximos passos", evolution.data.next_steps]] as const).map(([t, items]) =>
                    items?.length ? (
                      <div key={t}>
                        <p className="mb-1 text-xs font-semibold text-ink-soft">{t}</p>
                        {items.map((x, i) => <p key={i}>• {x}</p>)}
                      </div>
                    ) : null,
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {data.length === 0 ? (
        <Card><EmptyState icon={<NotebookPen className="h-5 w-5" />} title="Nenhuma sessão registrada" text="Registre cada atendimento para acompanhar a evolução e receber sugestões da IA." /></Card>
      ) : (
        <div className="space-y-3">
          {data.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3">
                <div>
                  <p className="text-sm font-semibold">{formatDate(r.date, { weekday: "short", day: "2-digit", month: "long", year: "numeric" })}{r.start_time ? ` · ${r.start_time.slice(0, 5)}` : ""}</p>
                  <p className="text-xs text-ink-soft">{(() => { const sm = objectiveSummary(objectivesOf({ objective: r.objective, objectives: r.objective_results })); return sm.total ? `${sm.total} objetivo(s) · ${sm.atingido} atingido(s), ${sm.parcial} parcial(is), ${sm.nao} não atingido(s)` : "Sem objetivos registrados"; })()}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(r); setOpen(true); }} aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={async () => { if (confirm("Excluir este registro?")) await remove(r.id); }} aria-label="Excluir"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-2">
                <dl className="space-y-2 text-sm">
                  {(() => {
                    const objs = objectivesOf({ objective: r.objective, objectives: r.objective_results });
                    const acts = activitiesOf({ activities: r.activities, activity_list: r.activity_results });
                    return (
                      <>
                        {objs.length > 0 && (
                          <div>
                            <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Objetivos</dt>
                            <dd><ul className="mt-0.5 space-y-1">{objs.map((o) => (
                              <li key={o.id} className="flex items-start gap-2 text-ink-soft">
                                <span className="flex-1">{o.text}</span>
                                {o.status ? <Badge tone={OBJECTIVE_STATUS[o.status].tone}>{OBJECTIVE_STATUS[o.status].label}</Badge> : <Badge>Não avaliado</Badge>}
                              </li>
                            ))}</ul></dd>
                          </div>
                        )}
                        {acts.length > 0 && (
                          <div>
                            <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Atividades</dt>
                            <dd className="text-ink-soft">{acts.map((a) => <p key={a.id} className={a.done === false ? "line-through opacity-60" : ""}>• {a.title}{a.duration_min ? ` (${a.duration_min} min)` : ""}</p>)}</dd>
                          </div>
                        )}
                      </>
                    );
                  })()}
                  {TEXT_FIELDS.map(({ key, label }) =>
                    r[key] ? (
                      <div key={key}>
                        <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{label}</dt>
                        <dd className="whitespace-pre-wrap text-ink-soft">{r[key] as string}</dd>
                      </div>
                    ) : null,
                  )}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {SCALES.map(({ key, label }) => <Badge key={key} tone="blue">{label}: {r.progress?.[key] ?? "—"}</Badge>)}
                  </div>
                  {r.attachments?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {r.attachments.map((a, i) => (
                        <button key={i} onClick={async () => window.open(await store.fileUrl(a.path), "_blank", "noopener")} className="inline-flex items-center gap-1 rounded-full bg-canvas px-2 py-0.5 text-[11px] text-ink-soft hover:text-ink">
                          <Paperclip className="h-3 w-3" /> {a.name}
                        </button>
                      ))}
                    </div>
                  )}
                </dl>
                <div className="rounded-xl bg-linear-to-br from-brand-50/60 to-sage-50/60 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-700"><Sparkles className="h-3.5 w-3.5" /> Sugestões da IA</p>
                    <Button variant="ghost" size="sm" loading={insightLoading === r.id} onClick={() => regenerate(r)}>{r.ai_insights ? "Gerar novamente" : "Gerar"}</Button>
                  </div>
                  {r.ai_insights ? <InsightsView ins={r.ai_insights} /> : <p className="text-xs text-ink-faint">Nenhuma sugestão gerada para esta sessão.</p>}
                  {r.ai_insights && <p className="mt-3 text-[10px] text-ink-faint">Sugestões para revisão — não substituem o julgamento clínico.</p>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <SessionForm patient={patient} open={open} onClose={() => setOpen(false)} initial={editing} appointmentId={appointmentId} onSaved={() => {}} />
    </div>
  );
}
