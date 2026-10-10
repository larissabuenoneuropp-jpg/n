"use client";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardList, FileSignature, Sparkles } from "lucide-react";
import { AiNotice, Badge, Button, Field, Input, Modal, Select, Tabs, Textarea, useToast } from "@/components/ui";
import { useCollection, useData } from "@/lib/data/provider";
import { askAI, patientContext } from "@/lib/ai/client";
import { ACCESS_LABEL, DEFAULT_RECORD_FIELDS } from "@/lib/data/instruments-library";
import type { Assessment, AssessmentInstrument, AssessmentRecord, Instrument, Patient, RecordPhase } from "@/lib/types";
import { formatDate, today } from "@/lib/utils";

interface GuideAI {
  preparation: string[]; materials: string[]; rapport: string; steps: string[]; observation_points: string[];
  interruption_criteria: string[]; adaptations: string[]; scoring_notes: string; caution: string;
}
interface RecordAI { record: string; highlights: string[]; comparison: string; next_steps: string[] }

export const PHASE_LABEL: Record<RecordPhase, string> = { inicial: "Avaliação inicial", intermediaria: "Intermediária", reavaliacao: "Reavaliação" };

function guideToText(g: GuideAI) {
  const list = (title: string, items?: string[]) => (items?.length ? `${title}\n${items.map((x) => `• ${x}`).join("\n")}\n` : "");
  return [
    g.caution ? `⚠ ${g.caution}\n` : "",
    list("PREPARAÇÃO", g.preparation),
    list("MATERIAIS", g.materials),
    g.rapport ? `VÍNCULO / ACOLHIMENTO\n${g.rapport}\n` : "",
    list("ETAPAS DA SESSÃO", g.steps),
    list("O QUE OBSERVAR", g.observation_points),
    list("CRITÉRIOS DE INTERRUPÇÃO", g.interruption_criteria),
    list("ADAPTAÇÕES PERMITIDAS", g.adaptations),
    g.scoring_notes ? `CORREÇÃO\n${g.scoring_notes}\n` : "",
    "Siga sempre as instruções e critérios do manual oficial do instrumento.",
  ].filter(Boolean).join("\n");
}

/** Encontra o instrumento da biblioteca correspondente ao item da avaliação. */
export function findInstrument(lib: Instrument[], item: { instrument_id?: string | null; name: string }) {
  return lib.find((i) => i.id === item.instrument_id) ?? lib.find((i) => i.name.toLowerCase() === item.name.toLowerCase());
}

/**
 * Aplicação de um instrumento: roteiro (base + IA) → registro (pontuações + observações + registro clínico com IA)
 * → revisão pela profissional → salvar no prontuário.
 */
export function ApplyInstrumentModal({ open, onClose, patient, assessment, item, existing, onSaved }: {
  open: boolean; onClose: () => void; patient: Patient; assessment?: Assessment; item: AssessmentInstrument | null;
  existing?: AssessmentRecord | null; onSaved: (r: AssessmentRecord) => void;
}) {
  const { store, bump } = useData();
  const toast = useToast();
  const lib = useCollection("instruments");
  const previousAll = useCollection("assessment_records", { filter: { patient_id: patient.id }, orderBy: "date", ascending: true });
  const instrument = item ? findInstrument(lib.data, item) : undefined;
  const fields = instrument?.record_fields?.length ? instrument.record_fields : DEFAULT_RECORD_FIELDS;
  const previous = useMemo(
    () => previousAll.data.filter((r) => r.instrument_name.toLowerCase() === item?.name.toLowerCase() && r.id !== existing?.id),
    [previousAll.data, item, existing],
  );

  const [tab, setTab] = useState<"roteiro" | "registro">("roteiro");
  const [guide, setGuide] = useState("");
  const [date, setDate] = useState(today());
  const [phase, setPhase] = useState<RecordPhase>("inicial");
  const [scores, setScores] = useState<Record<string, number | string>>({});
  const [behavior, setBehavior] = useState("");
  const [record, setRecord] = useState("");
  const [aiUsed, setAiUsed] = useState(false);
  const [demo, setDemo] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<"guide" | "record" | "save" | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab(existing ? "registro" : "roteiro");
    setGuide(existing?.application_guide ?? instrument?.application_guide ?? "");
    setDate(existing?.date ?? item?.date ?? today());
    setPhase(existing?.phase ?? (previous.length ? "reavaliacao" : "inicial"));
    setScores(existing?.scores ?? {});
    setBehavior(existing?.behavior ?? "");
    setRecord(existing?.clinical_record ?? "");
    setAiUsed(existing?.ai_assisted ?? false);
    setDemo(null);
  }, [open, existing, item, instrument?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;
  const instrumentInfo = {
    nome: item.name, nome_completo: instrument?.full_name, area: instrument?.area, avalia: instrument?.evaluates,
    acesso: instrument ? ACCESS_LABEL[instrument.access].label : "não informado",
  };

  async function genGuide() {
    setLoading("guide");
    try {
      const r = await askAI<GuideAI>("application_guide", {
        ...patientContext(patient), instrumento: instrumentInfo, roteiro_base_da_profissional: instrument?.application_guide || undefined,
        objetivo_da_avaliacao: assessment?.objective, hipoteses: assessment?.hypotheses,
      });
      setGuide(guideToText(r.result));
      setDemo(r.demo);
      setAiUsed(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro na IA", "error");
    } finally {
      setLoading(null);
    }
  }

  async function genRecord() {
    setLoading("record");
    try {
      const r = await askAI<RecordAI>("clinical_record", {
        ...patientContext(patient), instrumento: instrumentInfo, fase: PHASE_LABEL[phase], data: date,
        pontuacoes: fields.map((f) => ({ campo: f.label, valor: scores[f.key] ?? "não registrado", maior_e_melhor: f.type === "number" ? f.higher_is_better !== false : undefined })),
        observacoes_comportamentais: behavior || undefined,
        aplicacoes_anteriores: previous.map((p) => ({ data: p.date, fase: PHASE_LABEL[p.phase], pontuacoes: p.scores })),
      });
      const parts = [r.result.record];
      if (r.result.comparison) parts.push(`\nComparação: ${r.result.comparison}`);
      if (r.result.highlights?.length) parts.push(`\nDestaques:\n${r.result.highlights.map((h) => `• ${h}`).join("\n")}`);
      if (r.result.next_steps?.length) parts.push(`\nPróximos passos:\n${r.result.next_steps.map((h) => `• ${h}`).join("\n")}`);
      setRecord(parts.join("\n"));
      setDemo(r.demo);
      setAiUsed(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro na IA", "error");
    } finally {
      setLoading(null);
    }
  }

  async function save() {
    if (!record.trim() && !Object.keys(scores).length) return toast("Registre ao menos uma pontuação ou o registro clínico.", "error");
    setLoading("save");
    try {
      const payload: Partial<AssessmentRecord> = {
        patient_id: patient.id, assessment_id: assessment?.id ?? null, instrument_id: instrument?.id ?? null, instrument_name: item!.name,
        date, phase, scores, behavior, clinical_record: record, application_guide: guide, ai_assisted: aiUsed,
      };
      const saved = existing ? await store.update("assessment_records", existing.id, payload) : await store.insert("assessment_records", payload);
      bump("assessment_records");
      toast("Registro salvo no prontuário");
      onSaved(saved);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro ao salvar", "error");
    } finally {
      setLoading(null);
    }
  }

  const last = previous[previous.length - 1];

  return (
    <Modal open={open} onClose={onClose} wide title={`${item.name}${instrument?.full_name ? ` — ${instrument.full_name}` : ""}`}
      footer={
        <>
          {tab === "roteiro" ? (
            <Button onClick={() => setTab("registro")}>Ir para o registro</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setTab("roteiro")}>Roteiro</Button>
              <Button onClick={save} loading={loading === "save"}>Revisei — salvar no prontuário</Button>
            </>
          )}
        </>
      }>
      <div className="space-y-4">
        {instrument && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={ACCESS_LABEL[instrument.access].tone}>{ACCESS_LABEL[instrument.access].label}</Badge>
            <Badge tone="blue">{instrument.area}</Badge>
            {previous.length > 0 && <Badge tone="sage">{previous.length} aplicação(ões) anterior(es)</Badge>}
          </div>
        )}
        {instrument?.access === "psicologo" && (
          <p className="flex gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" /> Este instrumento consta como de uso privativo de psicólogos. Registre aqui apenas resultados de laudos recebidos de psicólogos, se for o caso.
          </p>
        )}
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: "roteiro", label: "Roteiro de aplicação", icon: <ClipboardList className="h-4 w-4" /> },
          { value: "registro", label: "Registro clínico", icon: <FileSignature className="h-4 w-4" /> },
        ]} />

        {tab === "roteiro" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-ink-soft">{instrument?.application_guide ? "Partindo do seu roteiro base." : "Sem roteiro base cadastrado para este instrumento."}</p>
              <Button variant="ai" size="sm" onClick={genGuide} loading={loading === "guide"}><Sparkles className="h-3.5 w-3.5" /> {guide ? "Refazer com IA" : "Gerar roteiro com IA"}</Button>
            </div>
            {demo !== null && <AiNotice demo={demo} />}
            <Textarea rows={16} className="text-sm" placeholder="Escreva ou gere o roteiro de aplicação…" value={guide} onChange={(e) => setGuide(e.target.value)} />
            <p className="text-[11px] text-ink-faint">O roteiro organiza a sessão; itens, instruções e correção seguem o manual oficial (a IA não reproduz conteúdo protegido).</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Data da aplicação"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Momento">
                <Select value={phase} onChange={(e) => setPhase(e.target.value as RecordPhase)} options={Object.entries(PHASE_LABEL).map(([value, label]) => ({ value, label }))} />
              </Field>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-ink-soft">Pontuações</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {fields.map((f) => (
                  <Field key={f.key} label={`${f.label}${f.type === "number" ? (f.higher_is_better === false ? " (menor = melhor)" : " (maior = melhor)") : ""}`}
                    hint={last && last.scores[f.key] !== undefined ? `Anterior (${formatDate(last.date)}): ${last.scores[f.key]}` : undefined}>
                    <Input type={f.type === "number" ? "number" : "text"} step="any" value={scores[f.key] ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        const next = { ...scores };
                        if (v === "") delete next[f.key];
                        else next[f.key] = f.type === "number" ? Number(v) : v;
                        setScores(next);
                      }} />
                  </Field>
                ))}
              </div>
            </div>
            <Field label="Comportamento e observações durante a aplicação">
              <Textarea value={behavior} onChange={(e) => setBehavior(e.target.value)} />
            </Field>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-ink-soft">Registro clínico</p>
                <Button variant="ai" size="sm" onClick={genRecord} loading={loading === "record"}><Sparkles className="h-3.5 w-3.5" /> Sugerir registro com IA</Button>
              </div>
              {demo !== null && <AiNotice demo={demo} />}
              <Textarea rows={9} value={record} onChange={(e) => setRecord(e.target.value)} placeholder="Descreva a aplicação, o desempenho e sua análise clínica…" />
              <p className="text-[11px] text-ink-faint">Revise e edite antes de salvar. A IA não inventa percentis ou classificações que você não informou.</p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
