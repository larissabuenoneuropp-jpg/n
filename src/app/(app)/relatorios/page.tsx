"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, Plus, Printer, RefreshCw, Save, Sparkles, Trash2 } from "lucide-react";
import { AiNotice, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea, useToast } from "@/components/ui";
import { useCollection, useData } from "@/lib/data/provider";
import { askAI, patientContext } from "@/lib/ai/client";
import { DEFAULT_TEMPLATES, REPORT_TYPES } from "@/lib/templates";
import type { Assessment, InterventionPlan, Patient, Profile, Report, SessionRecord } from "@/lib/types";
import { ageLabel, fillTemplate, formatDate, today } from "@/lib/utils";
import { cityDate, contractContent, contractVars } from "@/lib/documents";
import { LetterheadPrint } from "@/components/letterhead-print";

function buildVars(p: Patient | undefined, prof: Profile | null, plan?: InterventionPlan, assessment?: Assessment, sessions: SessionRecord[] = []) {
  return {
    ...contractVars(p, prof),
    paciente: p?.name, idade: ageLabel(p?.birth_date), nascimento: formatDate(p?.birth_date),
    responsavel: p?.guardians?.[0]?.name, escola: p?.school, serie: p?.grade, diagnostico: p?.diagnosis, hipoteses: p?.hypotheses,
    queixa: p?.anamnesis?.complaints, profissional: prof?.professional_name, profissao: prof?.profession ?? "Neuropsicopedagoga",
    crnpp: prof?.crnpp, clinica: prof?.clinic_name, data: formatDate(today()),
    cidade_data: cityDate(prof),
    objetivo_geral: plan?.general_objective,
    objetivos_especificos: plan?.specific_objectives.map((o, i) => `${i + 1}. ${o.text}`).join("\n"),
    metas: plan?.goals.map((g) => `• ${g.text}`).join("\n"),
    instrumentos: assessment?.instruments.map((i) => `• ${i.name}${i.notes ? ` — ${i.notes}` : ""}`).join("\n") || "[completar]",
    evolucao: sessions.length
      ? sessions.slice(0, 12).reverse().map((s) => `${formatDate(s.date)} — ${s.objective ?? ""}: ${s.clinical_evolution || s.child_response || ""}`).join("\n")
      : "[completar]",
  };
}

function NewReportModal({ open, onClose, onCreate, presetType, presetPatient, presetPlan }: {
  open: boolean; onClose: () => void; onCreate: (r: Partial<Report>) => Promise<void>; presetType?: string; presetPatient?: string; presetPlan?: string;
}) {
  const { store, profile } = useData();
  const patients = useCollection("patients", { orderBy: "name", ascending: true });
  const [type, setType] = useState(presetType || "relatorio");
  const [patientId, setPatientId] = useState(presetPatient || "");
  const [loading, setLoading] = useState(false);

  async function create() {
    if (!patientId) return;
    setLoading(true);
    try {
      const p = patients.data.find((x) => x.id === patientId);
      const plans = await store.list("intervention_plans", { filter: { patient_id: patientId } });
      const assessments = await store.list("assessments", { filter: { patient_id: patientId } });
      const sessions = await store.list("session_records", { filter: { patient_id: patientId }, orderBy: "date" });
      const plan = plans.find((x) => x.id === presetPlan) ?? plans.find((x) => x.status === "ativo") ?? plans[0];
      const tpl = profile?.templates?.[type] || DEFAULT_TEMPLATES[type];
      const label = REPORT_TYPES.find((t) => t.value === type)?.label ?? type;
      await onCreate({
        patient_id: patientId, type, status: "rascunho", title: `${label} — ${p?.name}`,
        content: fillTemplate(tpl, buildVars(p, profile, plan, assessments[0], sessions)),
      });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo documento" footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={create} loading={loading} disabled={!patientId}>Criar</Button></>}>
      <div className="space-y-3">
        <Field label="Tipo de documento"><Select value={type} onChange={(e) => setType(e.target.value)} options={REPORT_TYPES.map((t) => ({ value: t.value, label: t.label }))} /></Field>
        <Field label="Paciente"><Select value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder="Selecione" options={patients.data.map((p) => ({ value: p.id, label: p.name }))} /></Field>
        <p className="text-xs text-ink-faint">O documento é pré-preenchido com dados do prontuário, do plano e das sessões. Tudo é editável.</p>
      </div>
    </Modal>
  );
}

function ReportEditor({ report, patient, onSave, onDelete }: { report: Report; patient?: Patient; onSave: (r: Partial<Report>) => Promise<void>; onDelete: () => void }) {
  const { profile, store } = useData();
  const toast = useToast();
  const [f, setF] = useState(report);
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [aiText, setAiText] = useState<{ text: string; demo: boolean } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  useEffect(() => setF(report), [report]);

  async function runAI() {
    setAiLoading(true);
    try {
      const sessions = patient ? (await store.list("session_records", { filter: { patient_id: patient.id }, orderBy: "date" })).slice(0, 10) : [];
      // O texto do documento contém o nome do paciente; substituímos antes de enviar (minimização LGPD).
      const pseudo = patient ? f.content.split(patient.name).join("[PACIENTE]") : f.content;
      const r = await askAI<{ text: string }>("report_draft", {
        tipo_documento: REPORT_TYPES.find((t) => t.value === f.type)?.label,
        instrucao: instruction || "Revise e melhore a redação técnica, mantendo as informações.",
        documento_atual: pseudo,
        paciente: patient ? patientContext(patient) : undefined,
        sessoes_recentes: sessions.map((s) => ({ data: s.date, objetivo: s.objective, resposta: s.child_response, evolucao: s.clinical_evolution, escalas: s.progress })),
      });
      setAiText({ text: patient ? r.result.text.split("[PACIENTE]").join(patient.name) : r.result.text, demo: r.demo });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro na IA", "error");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card className="no-print flex flex-wrap items-center gap-2 p-3">
        <Input className="min-w-[200px] flex-1" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <Select className="w-36" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Report["status"] })} options={[{ value: "rascunho", label: "Rascunho" }, { value: "finalizado", label: "Finalizado" }]} />
        {f.type === "contrato" && patient ? (
          <Button variant="secondary" size="sm" className="h-9" title="Preenche novamente com os dados atuais do cadastro e das configurações"
            onClick={() => { if (confirm("Substituir o texto pelos dados atuais do cadastro? Edições manuais serão perdidas.")) setF({ ...f, content: contractContent(patient, profile) }); }}>
            <RefreshCw className="h-4 w-4" /> Atualizar do cadastro
          </Button>
        ) : (
          <Button variant="ai" size="sm" className="h-9" onClick={() => { setAiText(null); setAiOpen(true); }}><Sparkles className="h-4 w-4" /> Redigir com IA</Button>
        )}
        <Button variant="secondary" size="sm" className="h-9" onClick={() => window.print()}><Printer className="h-4 w-4" /> PDF</Button>
        <Button variant="danger" size="sm" className="h-9" onClick={onDelete} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
        <Button size="sm" className="h-9" loading={saving} onClick={async () => { setSaving(true); await onSave(f).finally(() => setSaving(false)); }}><Save className="h-4 w-4" /> Salvar</Button>
      </Card>

      <Textarea className="no-print min-h-[60vh] font-mono text-[13px]" value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} />

      {/* Impressão em papel timbrado (cabeçalho e rodapé em todas as páginas) */}
      <LetterheadPrint content={f.content} profile={profile} />

      <Modal open={aiOpen} onClose={() => setAiOpen(false)} wide title="Redação assistida por IA"
        footer={aiText ? <>
          <Button variant="secondary" onClick={() => { setF({ ...f, content: `${f.content}\n\n${aiText.text}` }); setAiOpen(false); }}>Inserir ao final</Button>
          <Button onClick={() => { setF({ ...f, content: aiText.text }); setAiOpen(false); }}>Substituir documento</Button>
        </> : <Button variant="ai" onClick={runAI} loading={aiLoading}><Sparkles className="h-4 w-4" /> Gerar</Button>}>
        {!aiText ? (
          <div className="space-y-3">
            <Field label="O que você precisa?" hint="Ex.: 'Redija a seção de análise dos resultados de leitura' ou 'Torne a linguagem mais acessível para a escola'.">
              <Textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} />
            </Field>
            <p className="text-[11px] text-ink-faint">O nome do paciente é substituído por [PACIENTE] antes do envio à IA.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AiNotice demo={aiText.demo} />
            <Textarea rows={16} value={aiText.text} onChange={(e) => setAiText({ ...aiText, text: e.target.value })} />
          </div>
        )}
      </Modal>
    </div>
  );
}

function ReportsInner() {
  const params = useSearchParams();
  const toast = useToast();
  const { data, loading, insert, update, remove } = useCollection("reports", { orderBy: "updated_at" });
  const patients = useCollection("patients");
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(params.get("novo") === "1");
  const pmap = useMemo(() => new Map(patients.data.map((p) => [p.id, p])), [patients.data]);

  const wanted = params.get("id");
  const [wantedApplied, setWantedApplied] = useState(false);
  useEffect(() => {
    if (!wantedApplied && wanted && data.some((r) => r.id === wanted)) {
      setSelected(wanted);
      setWantedApplied(true);
    } else if (!selected && data.length) setSelected(data[0].id);
  }, [data, selected, wanted, wantedApplied]);

  if (loading) return <Spinner />;
  const current = data.find((r) => r.id === selected);

  return (
    <>
      <div className="no-print">
        <PageHeader title="Relatórios e documentos" subtitle="Relatórios, encaminhamentos, declarações, atestados, planos e resumos de evolução"
          actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Novo documento</Button>} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="no-print space-y-2">
          {data.length === 0 && <Card><EmptyState icon={<FileText className="h-5 w-5" />} title="Nenhum documento" text="Gere documentos a partir de modelos editáveis." /></Card>}
          {data.map((r) => (
            <button key={r.id} onClick={() => setSelected(r.id)} className={`w-full rounded-xl border p-3 text-left transition ${selected === r.id ? "border-brand-300 bg-white shadow-card" : "border-line bg-white/60 hover:bg-white"}`}>
              <p className="truncate text-sm font-medium">{r.title}</p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-ink-faint">{formatDate(r.updated_at)}</span>
                <Badge tone={r.status === "finalizado" ? "green" : "amber"}>{r.status}</Badge>
              </div>
            </button>
          ))}
        </div>
        {current && (
          <ReportEditor
            report={current}
            patient={current.patient_id ? pmap.get(current.patient_id) : undefined}
            onSave={async (r) => { await update(current.id, r); toast("Documento salvo"); }}
            onDelete={async () => { if (confirm("Excluir documento?")) { await remove(current.id); setSelected(null); } }}
          />
        )}
      </div>
      <NewReportModal open={open} onClose={() => setOpen(false)} presetType={params.get("tipo") ?? undefined} presetPatient={params.get("paciente") ?? undefined} presetPlan={params.get("plano") ?? undefined}
        onCreate={async (r) => { const x = await insert(r); setSelected(x.id); toast("Documento criado"); }} />
    </>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ReportsInner />
    </Suspense>
  );
}
