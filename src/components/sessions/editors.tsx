"use client";
import { useState } from "react";
import { BookOpen, Check, GripVertical, Paperclip, Plus, Trash2, X } from "lucide-react";
import { Button, Input, Select, useToast } from "@/components/ui";
import { useCollection, useData } from "@/lib/data/provider";
import { OBJECTIVE_STATUS } from "@/lib/sessions";
import type { Attachment, ObjectiveStatus, SessionActivity, SessionObjective } from "@/lib/types";
import { cn, uid } from "@/lib/utils";

/* ------------------------------- Objetivos -------------------------------- */

/** Lista de objetivos da sessão (sem limite). Com `withStatus`, permite marcar o resultado de cada um. */
export function ObjectivesEditor({ value, onChange, withStatus, placeholder = "Novo objetivo da sessão" }: {
  value: SessionObjective[]; onChange: (v: SessionObjective[]) => void; withStatus?: boolean; placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft.trim()) return;
    onChange([...value, { id: uid(), text: draft.trim() }]);
    setDraft("");
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {value.map((o, i) => (
        <div key={o.id} className="flex items-center gap-2">
          <button type="button" className="hidden text-ink-faint hover:text-ink sm:block" title="Mover para cima" onClick={() => move(i, -1)} aria-label="Mover para cima">
            <GripVertical className="h-4 w-4" />
          </button>
          <span className="w-5 shrink-0 text-right text-xs font-medium text-ink-faint">{i + 1}.</span>
          <Input value={o.text} onChange={(e) => onChange(value.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)))} />
          {withStatus && (
            <div className="flex shrink-0 gap-1">
              {(Object.keys(OBJECTIVE_STATUS) as ObjectiveStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  title={OBJECTIVE_STATUS[st].label}
                  onClick={() => onChange(value.map((x) => (x.id === o.id ? { ...x, status: x.status === st ? null : st } : x)))}
                  className={cn(
                    "rounded-md border px-2 py-1 text-[11px] font-medium transition",
                    o.status === st
                      ? st === "atingido" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : st === "parcial" ? "border-amber-300 bg-amber-50 text-amber-700" : "border-red-300 bg-red-50 text-red-600"
                      : "border-line text-ink-faint hover:text-ink",
                  )}
                >
                  {st === "atingido" ? "Sim" : st === "parcial" ? "Parcial" : "Não"}
                </button>
              ))}
            </div>
          )}
          <Button type="button" variant="ghost" size="sm" className="h-9 shrink-0" onClick={() => onChange(value.filter((x) => x.id !== o.id))} aria-label="Remover objetivo">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <Button type="button" variant="secondary" size="sm" className="h-9 shrink-0" onClick={add}><Plus className="h-4 w-4" /> Objetivo</Button>
      </div>
      {withStatus && value.length > 0 && <p className="text-[11px] text-ink-faint">Marque o resultado de cada objetivo: Sim (atingido), Parcial ou Não.</p>}
    </div>
  );
}

/* ------------------------------- Atividades ------------------------------- */

/** Lista de atividades da sessão (sem limite), com inserção a partir da biblioteca. */
export function ActivitiesEditor({ value, onChange, withDone }: { value: SessionActivity[]; onChange: (v: SessionActivity[]) => void; withDone?: boolean }) {
  const library = useCollection("activities", { orderBy: "title", ascending: true });
  const [picker, setPicker] = useState("");
  const set = (id: string, patch: Partial<SessionActivity>) => onChange(value.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const fromLibrary = (id: string) => {
    const a = library.data.find((x) => x.id === id);
    if (!a) return;
    onChange([...value, { id: uid(), title: a.title, materials: a.materials, duration_min: a.duration_min, activity_id: a.id }]);
    setPicker("");
  };
  const total = value.reduce((s, a) => s + (Number(a.duration_min) || 0), 0);
  return (
    <div className="space-y-2">
      {value.map((a, i) => (
        <div key={a.id} className={cn("rounded-lg border p-2", a.done ? "border-emerald-200 bg-emerald-50/40" : "border-line")}>
          <div className="flex items-center gap-2">
            {withDone ? (
              <button type="button" onClick={() => set(a.id, { done: !a.done })} aria-label="Marcar como realizada"
                className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded border", a.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-line")}>
                {a.done && <Check className="h-3 w-3" />}
              </button>
            ) : <span className="w-5 shrink-0 text-right text-xs font-medium text-ink-faint">{i + 1}.</span>}
            <Input className="flex-1" placeholder="Atividade" value={a.title} onChange={(e) => set(a.id, { title: e.target.value })} />
            <Input className="w-20 shrink-0" type="number" min={1} placeholder="min" value={a.duration_min ?? ""} onChange={(e) => set(a.id, { duration_min: e.target.value ? Number(e.target.value) : undefined })} aria-label="Tempo em minutos" />
            <Button type="button" variant="ghost" size="sm" className="h-9 shrink-0" onClick={() => onChange(value.filter((x) => x.id !== a.id))} aria-label="Remover atividade"><Trash2 className="h-4 w-4" /></Button>
          </div>
          <Input className="mt-1.5 h-8 text-xs" placeholder="Materiais" value={a.materials ?? ""} onChange={(e) => set(a.id, { materials: e.target.value })} />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...value, { id: uid(), title: "" }])}><Plus className="h-3.5 w-3.5" /> Atividade</Button>
        <div className="flex items-center gap-1.5">
          <BookOpen className="h-4 w-4 text-ink-faint" />
          <Select className="h-8 w-60 text-xs" value={picker} onChange={(e) => fromLibrary(e.target.value)} placeholder="Da biblioteca…"
            options={library.data.map((x) => ({ value: x.id, label: `${x.favorite ? "★ " : ""}${x.title} · ${x.area}` }))} />
        </div>
        {total > 0 && <span className="text-[11px] text-ink-faint">Total: {total} min</span>}
      </div>
    </div>
  );
}

/* --------------------------------- Anexos --------------------------------- */

/**
 * Anexos de uma avaliação, sessão planejada ou registro de sessão.
 * Cada arquivo também é registrado na aba Documentos do paciente.
 */
export function AttachmentsField({ patientId, value, onChange, category, context }: {
  patientId: string; value: Attachment[]; onChange: (v: Attachment[]) => void; category: string; context: string;
}) {
  const { store, bump } = useData();
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const added: Attachment[] = [];
      for (const file of Array.from(files)) {
        const path = await store.upload(file, `documentos/${patientId}`);
        const doc = await store.insert("documents", { patient_id: patientId, category, name: file.name, path, mime: file.type, size: file.size, notes: context });
        added.push({ name: file.name, path, mime: file.type, size: file.size, document_id: doc.id });
      }
      bump("documents");
      onChange([...value, ...added]);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha no upload", "error");
    } finally {
      setUploading(false);
    }
  }

  async function remove(a: Attachment) {
    if (!confirm(`Remover "${a.name}"? O arquivo também sai da aba Documentos.`)) return;
    if (a.document_id) {
      await store.remove("documents", a.document_id).catch(() => {});
      await store.removeFile(a.path).catch(() => {});
      bump("documents");
    }
    onChange(value.filter((x) => x.path !== a.path));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {value.map((a) => (
        <span key={a.path} className="inline-flex items-center gap-1 rounded-full bg-canvas px-2.5 py-1 text-[11px] text-ink-soft">
          <button type="button" className="inline-flex items-center gap-1 hover:text-ink" onClick={async () => window.open(await store.fileUrl(a.path), "_blank", "noopener")}>
            <Paperclip className="h-3 w-3" /> {a.name}
          </button>
          <button type="button" onClick={() => remove(a)} aria-label="Remover anexo" className="hover:text-red-600"><X className="h-3 w-3" /></button>
        </span>
      ))}
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-xs text-ink-soft hover:bg-canvas">
        <Plus className="h-3.5 w-3.5" /> {uploading ? "Enviando…" : "Anexar arquivo"}
        <input type="file" multiple accept="image/*,application/pdf,video/*,.doc,.docx,.xls,.xlsx" className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </label>
    </div>
  );
}
