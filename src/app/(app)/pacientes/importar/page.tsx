"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, FileSpreadsheet, FileText, Lock, Sparkles, UploadCloud } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select, Textarea, useToast } from "@/components/ui";
import { useCollection, useData } from "@/lib/data/provider";
import { askAI } from "@/lib/ai/client";
import { createContract } from "@/lib/documents";
import {
  detectDocKind, findExisting, guessColumn, IMPORT_FIELDS, mergeIntoExisting, parseDateBR, parseDocumentText, toPatient,
  type DocKind, type ImportData, type ImportField,
} from "@/lib/importer";
import type { Patient } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

interface Candidate {
  key: string;
  source: string;
  data: ImportData;
  existingId?: string;
  action: "criar" | "atualizar" | "ignorar";
  file?: File;
  docKind?: DocKind;
}

interface SheetState { file: File; rows: string[][]; mapping: Array<ImportField | "">; headerRow: boolean }

const MAIN_FIELDS: ImportField[] = ["name", "birth_date", "guardian_name", "guardian_phone", "guardian_email", "school", "grade", "diagnosis", "hypotheses"];
const KIND_CATEGORY: Record<DocKind, string> = { relatorio: "relatorio", anamnese: "anamnese", contrato: "contrato", laudo: "laudo", outro: "outro" };

function CandidateCard({ c, patients, onChange }: { c: Candidate; patients: Patient[]; onChange: (c: Candidate) => void }) {
  const [open, setOpen] = useState(false);
  const set = (k: ImportField, v: string) => {
    const data = { ...c.data, [k]: v };
    const ex = k === "name" ? findExisting(patients, v) : patients.find((p) => p.id === c.existingId);
    onChange({ ...c, data, existingId: ex?.id, action: c.action === "ignorar" ? "ignorar" : ex ? "atualizar" : "criar" });
  };
  const filled = (Object.keys(IMPORT_FIELDS) as ImportField[]).filter((k) => c.data[k]?.trim()).length;
  const extra = (Object.keys(IMPORT_FIELDS) as ImportField[]).filter((k) => !MAIN_FIELDS.includes(k));
  return (
    <Card className={cn("p-4", c.action === "ignorar" && "opacity-60")}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {c.file ? <FileText className="h-4 w-4 text-brand-500" /> : <FileSpreadsheet className="h-4 w-4 text-brand-500" />}
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.data.name || "Nome não encontrado"}</span>
        <span className="truncate text-xs text-ink-faint">{c.source}</span>
        <Badge>{filled} campos reconhecidos</Badge>
        {c.existingId && <Badge tone="amber">Já cadastrado</Badge>}
        <Select className="h-8 w-40 text-xs" value={c.action} onChange={(e) => onChange({ ...c, action: e.target.value as Candidate["action"] })}
          options={[
            ...(c.existingId ? [{ value: "atualizar", label: "Completar existente" }] : []),
            { value: "criar", label: c.existingId ? "Criar outro" : "Cadastrar" },
            { value: "ignorar", label: "Ignorar" },
          ]} />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {MAIN_FIELDS.map((k) => (
          <Field key={k} label={IMPORT_FIELDS[k]}>
            <Input className={cn(!c.data[k] && "border-dashed")} type={k === "birth_date" ? "date" : "text"}
              value={k === "birth_date" ? parseDateBR(c.data[k]) : c.data[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
          </Field>
        ))}
      </div>
      <button className="mt-3 inline-flex items-center gap-1 text-xs text-brand-700 hover:underline" onClick={() => setOpen(!open)}>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} {open ? "Ocultar" : "Ver"} todos os campos (queixa, histórico, endereço…)
      </button>
      {open && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {extra.map((k) => {
            const long = ["complaints", "history", "family_history", "personality", "school_history", "notes", "medications"].includes(k);
            return (
              <Field key={k} label={IMPORT_FIELDS[k]} className={long ? "sm:col-span-2" : ""}>
                {long ? <Textarea rows={3} value={c.data[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
                  : <Input value={c.data[k] ?? ""} onChange={(e) => set(k, e.target.value)} />}
              </Field>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default function ImportPatientsPage() {
  const toast = useToast();
  const { store, profile, bump } = useData();
  const patients = useCollection("patients");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [sheets, setSheets] = useState<SheetState[]>([]);
  const [useAI, setUseAI] = useState(false);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<Array<{ id: string; name: string; action: string }> | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function readFiles(files: FileList | null) {
    if (!files?.length) return;
    setReading(true);
    setErrors([]);
    const errs: string[] = [];
    const found: Candidate[] = [];
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/import", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Falha na leitura");
        if (json.kind === "sheet") {
          const rows: string[][] = json.rows;
          if (!rows.length) throw new Error("Planilha vazia");
          setSheets((s) => [...s, { file, rows, headerRow: true, mapping: rows[0].map(guessColumn) }]);
          continue;
        }
        let data = parseDocumentText(json.text);
        if (useAI) {
          try {
            const r = await askAI<ImportData>("import_extract", { arquivo: file.name, texto: json.text.slice(0, 50000) });
            // A IA completa apenas os campos que as regras não encontraram
            const ai = Object.fromEntries(Object.entries(r.result ?? {}).filter(([, v]) => typeof v === "string" && v.trim())) as ImportData;
            data = { ...ai, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v)) };
            if (ai.birth_date && !data.birth_date) data.birth_date = parseDateBR(ai.birth_date);
          } catch (e) {
            errs.push(`${file.name}: IA indisponível (${(e as Error).message}); usando só as regras locais.`);
          }
        }
        const ex = findExisting(patients.data, data.name);
        found.push({ key: `${file.name}-${Date.now()}-${Math.random()}`, source: file.name, data, file, docKind: detectDocKind(json.text), existingId: ex?.id, action: ex ? "atualizar" : "criar" });
      } catch (e) {
        errs.push(`${file.name}: ${(e as Error).message}`);
      }
    }
    setCandidates((c) => [...c, ...found]);
    setErrors(errs);
    setReading(false);
  }

  function sheetToCandidates(s: SheetState) {
    const body = s.headerRow ? s.rows.slice(1) : s.rows;
    const list: Candidate[] = body.map((row, i) => {
      const data: ImportData = {};
      s.mapping.forEach((field, j) => {
        if (field && row[j]?.trim()) data[field] = data[field] ? `${data[field]} ${row[j].trim()}` : row[j].trim();
      });
      if (data.birth_date) data.birth_date = parseDateBR(data.birth_date);
      const ex = findExisting(patients.data, data.name);
      return { key: `${s.file.name}-${i}`, source: `${s.file.name} · linha ${i + (s.headerRow ? 2 : 1)}`, data, existingId: ex?.id, action: (data.name ? (ex ? "atualizar" : "criar") : "ignorar") as Candidate["action"] };
    });
    setCandidates((c) => [...c, ...list]);
    setSheets((all) => all.filter((x) => x !== s));
  }

  async function runImport() {
    const todo = candidates.filter((c) => c.action !== "ignorar");
    if (todo.some((c) => !c.data.name?.trim())) return toast("Há itens sem nome. Preencha ou marque como Ignorar.", "error");
    setImporting(true);
    const done: Array<{ id: string; name: string; action: string }> = [];
    try {
      for (const c of todo) {
        const incoming = toPatient(c.data);
        let patientId: string;
        if (c.action === "atualizar" && c.existingId) {
          const existing = patients.data.find((p) => p.id === c.existingId)!;
          await store.update("patients", existing.id, mergeIntoExisting(existing, incoming));
          patientId = existing.id;
          done.push({ id: patientId, name: existing.name, action: "completado" });
        } else {
          const p = await store.insert("patients", { ...incoming, session_value: incoming.session_value ?? profile?.default_session_value ?? 0 });
          await createContract(store, p, profile);
          patientId = p.id;
          done.push({ id: p.id, name: p.name, action: "cadastrado" });
        }
        // Guarda o documento original na aba Documentos do paciente
        if (c.file) {
          try {
            const path = await store.upload(c.file, `documentos/${patientId}`);
            await store.insert("documents", { patient_id: patientId, category: KIND_CATEGORY[c.docKind ?? "outro"], name: c.file.name, path, mime: c.file.type, size: c.file.size, notes: "Importado do Drive" });
          } catch (e) {
            setErrors((x) => [...x, `${c.file!.name}: dados importados, mas o arquivo não foi anexado (${(e as Error).message}).`]);
          }
        }
      }
      bump("patients"); bump("documents"); bump("reports");
      setResult(done);
      setCandidates([]);
      toast(`${done.length} paciente(s) importado(s)`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro na importação", "error");
    } finally {
      setImporting(false);
    }
  }

  const counts = useMemo(() => ({
    criar: candidates.filter((c) => c.action === "criar").length,
    atualizar: candidates.filter((c) => c.action === "atualizar").length,
  }), [candidates]);

  return (
    <>
      <Link href="/pacientes" className="mb-4 inline-flex items-center gap-1 text-xs text-ink-soft hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> Pacientes</Link>
      <PageHeader title="Importar pacientes do Drive" subtitle="Anexe anamneses, relatórios (RAN), fichas ou a planilha de pacientes — o sistema preenche o cadastro para você revisar" />

      <Card className="mb-4 p-5">
        <label className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/40 px-6 py-10 text-center transition hover:bg-brand-50", reading && "pointer-events-none opacity-60")}>
          <UploadCloud className="h-8 w-8 text-brand-500" />
          <span className="font-medium">{reading ? "Lendo arquivos…" : "Clique para escolher os arquivos"}</span>
          <span className="text-xs text-ink-soft">Word (.docx), PDF com texto, .txt, planilhas (.xlsx, .csv) — vários de uma vez</span>
          <input type="file" multiple className="hidden" accept=".docx,.pdf,.txt,.md,.xlsx,.csv" onChange={(e) => { readFiles(e.target.files); e.target.value = ""; }} />
        </label>
        <p className="mt-3 text-[11px] text-ink-faint">
          No Google Drive: Documentos → <b>Arquivo › Fazer download › Microsoft Word (.docx)</b>; Planilhas → <b>Arquivo › Fazer download › .xlsx</b>.
        </p>
        <label className="mt-3 flex items-start gap-2 rounded-lg bg-sand-100 p-3 text-xs text-ink-soft">
          <input type="checkbox" className="mt-0.5" checked={useAI} onChange={(e) => setUseAI(e.target.checked)} />
          <span>
            <Sparkles className="mr-1 inline h-3.5 w-3.5 text-sage-700" /><b>Usar IA para completar a extração de documentos.</b> O texto do documento (com dados pessoais e de saúde) será enviado à OpenAI.
            Use somente se você tiver base legal/consentimento para isso (LGPD). Sem marcar, a leitura é feita apenas por regras locais, sem enviar nada.
          </span>
        </label>
        {errors.length > 0 && <div className="mt-3 space-y-1 rounded-lg bg-red-50 p-3 text-xs text-red-700">{errors.map((e) => <p key={e}>{e}</p>)}</div>}
      </Card>

      {sheets.map((s) => (
        <Card key={s.file.name} className="mb-4">
          <CardHeader title={`Planilha: ${s.file.name}`} icon={<FileSpreadsheet className="h-4 w-4" />} subtitle={`${s.rows.length} linha(s) — confira a qual campo corresponde cada coluna`}
            action={<Button size="sm" onClick={() => sheetToCandidates(s)}>Continuar</Button>} />
          <div className="overflow-x-auto p-5">
            <label className="mb-3 flex items-center gap-2 text-xs text-ink-soft">
              <input type="checkbox" checked={s.headerRow} onChange={(e) => setSheets((all) => all.map((x) => (x === s ? { ...x, headerRow: e.target.checked } : x)))} />
              A primeira linha é o cabeçalho
            </label>
            <table className="min-w-full text-xs">
              <thead>
                <tr>{s.rows[0].map((h, j) => (
                  <th key={j} className="p-1 text-left align-bottom">
                    <p className="mb-1 truncate font-medium text-ink-soft">{s.headerRow ? h : `Coluna ${j + 1}`}</p>
                    <Select className="h-8 w-44 text-xs" value={s.mapping[j] ?? ""} placeholder="Ignorar coluna"
                      onChange={(e) => setSheets((all) => all.map((x) => (x === s ? { ...x, mapping: x.mapping.map((m, k) => (k === j ? (e.target.value as ImportField | "") : m)) } : x)))}
                      options={(Object.keys(IMPORT_FIELDS) as ImportField[]).map((k) => ({ value: k, label: IMPORT_FIELDS[k] }))} />
                  </th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(s.headerRow ? s.rows.slice(1, 4) : s.rows.slice(0, 3)).map((r, i) => (
                  <tr key={i}>{s.rows[0].map((_, j) => <td key={j} className="max-w-[180px] truncate p-1 text-ink-soft">{r[j]}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      {result && (
        <Card className="mb-4 border-emerald-200 bg-emerald-50/40 p-5">
          <p className="mb-2 flex items-center gap-2 font-medium text-emerald-800"><CheckCircle2 className="h-5 w-5" /> Importação concluída</p>
          <ul className="space-y-1 text-sm">
            {result.map((r) => <li key={r.id}><Link className="text-brand-700 hover:underline" href={`/pacientes/${r.id}`}>{r.name}</Link> — {r.action}{r.action === "cadastrado" ? " (contrato gerado em rascunho)" : ""}</li>)}
          </ul>
        </Card>
      )}

      {candidates.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink-soft">Revise os dados reconhecidos. Campos com borda tracejada não foram encontrados.</p>
            <Button onClick={runImport} loading={importing}>Importar ({counts.criar} novo{counts.criar === 1 ? "" : "s"}, {counts.atualizar} a completar)</Button>
          </div>
          {candidates.map((c) => (
            <CandidateCard key={c.key} c={c} patients={patients.data} onChange={(n) => setCandidates((all) => all.map((x) => (x.key === c.key ? n : x)))} />
          ))}
        </div>
      ) : !sheets.length && !result && (
        <Card><EmptyState icon={<Lock className="h-5 w-5" />} title="Nenhum arquivo lido ainda" text={`Pacientes já cadastrados com o mesmo nome são completados, sem apagar o que você já preencheu. Hoje: ${formatDate(new Date().toISOString().slice(0, 10))}.`} /></Card>
      )}
    </>
  );
}
