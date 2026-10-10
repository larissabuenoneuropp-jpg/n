"use client";
import { useMemo, useState } from "react";
import { Download, FileImage, FileText, FileVideo, FolderOpen, Trash2, Upload } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, Textarea, useToast } from "@/components/ui";
import { useCollection, useData } from "@/lib/data/provider";
import { DOCUMENT_CATEGORIES } from "@/lib/catalog";
import type { DocumentFile } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const MAX_MB = 50;

function icon(mime?: string) {
  if (mime?.startsWith("image/")) return <FileImage className="h-5 w-5" />;
  if (mime?.startsWith("video/")) return <FileVideo className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
}

function size(n?: number) {
  if (!n) return "";
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;
}

export function DocumentsList({ patientId }: { patientId?: string }) {
  const { store } = useData();
  const toast = useToast();
  const docs = useCollection("documents", patientId ? { filter: { patient_id: patientId } } : {});
  const patients = useCollection("patients", { orderBy: "name", ascending: true });
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ file: File | null; category: string; patient_id: string; notes: string }>({ file: null, category: "relatorio", patient_id: patientId ?? "", notes: "" });
  const [uploading, setUploading] = useState(false);
  const pmap = useMemo(() => new Map(patients.data.map((p) => [p.id, p.name])), [patients.data]);

  const list = docs.data.filter(
    (d) => (!cat || d.category === cat) && (!q || d.name.toLowerCase().includes(q.toLowerCase()) || pmap.get(d.patient_id ?? "")?.toLowerCase().includes(q.toLowerCase())),
  );

  async function upload() {
    if (!form.file) return toast("Selecione um arquivo.", "error");
    if (!form.patient_id) return toast("Vincule o documento a um paciente.", "error");
    if (form.file.size > MAX_MB * 1024 * 1024) return toast(`Limite de ${MAX_MB} MB por arquivo.`, "error");
    setUploading(true);
    try {
      const path = await store.upload(form.file, `documentos/${form.patient_id}`);
      await docs.insert({ patient_id: form.patient_id, category: form.category, name: form.file.name, path, mime: form.file.type, size: form.file.size, notes: form.notes });
      toast("Documento enviado");
      setOpen(false);
      setForm({ file: null, category: "relatorio", patient_id: patientId ?? "", notes: "" });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha no upload", "error");
    } finally {
      setUploading(false);
    }
  }

  async function openDoc(d: DocumentFile) {
    try {
      const url = await store.fileUrl(d.path);
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      if (url.startsWith("data:")) a.download = d.name;
      a.click();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível abrir", "error");
    }
  }

  async function del(d: DocumentFile) {
    if (!confirm(`Excluir "${d.name}"?`)) return;
    await store.removeFile(d.path).catch(() => {});
    await docs.remove(d.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <Input placeholder="Buscar documento…" value={q} onChange={(e) => setQ(e.target.value)} className="sm:max-w-xs" />
          <Select value={cat} onChange={(e) => setCat(e.target.value)} placeholder="Todas as categorias" options={DOCUMENT_CATEGORIES} className="sm:max-w-[200px]" />
        </div>
        <Button onClick={() => setOpen(true)}><Upload className="h-4 w-4" /> Enviar arquivo</Button>
      </div>

      {docs.loading ? (
        <Spinner />
      ) : list.length === 0 ? (
        <Card><EmptyState icon={<FolderOpen className="h-5 w-5" />} title="Nenhum documento" text="Relatórios, anamneses, termos, contratos, laudos, fotos, PDFs e vídeos — sempre vinculados ao paciente." /></Card>
      ) : (
        <Card className="divide-y divide-line">
          {list.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-5 py-3">
              <span className="rounded-lg bg-brand-50 p-2 text-brand-500">{icon(d.mime)}</span>
              <div className="min-w-0 flex-1">
                <button onClick={() => openDoc(d)} className="block truncate text-left text-sm font-medium hover:underline">{d.name}</button>
                <p className="truncate text-xs text-ink-faint">
                  {!patientId && pmap.get(d.patient_id ?? "") ? `${pmap.get(d.patient_id ?? "")} · ` : ""}
                  {formatDate(d.created_at)} {size(d.size) && `· ${size(d.size)}`} {d.notes && `· ${d.notes}`}
                </p>
              </div>
              <Badge tone="sage">{DOCUMENT_CATEGORIES.find((c) => c.value === d.category)?.label ?? d.category}</Badge>
              <Button variant="ghost" size="sm" onClick={() => openDoc(d)} aria-label="Baixar"><Download className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => del(d)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Enviar documento"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={upload} loading={uploading}>Enviar</Button></>}>
        <div className="space-y-3">
          <Field label="Arquivo" hint={store.mode === "demo" ? "Modo demonstração: até 1,5 MB." : `Até ${MAX_MB} MB. Armazenado em bucket privado.`}>
            <Input type="file" className="py-1.5" accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })} />
          </Field>
          {!patientId && (
            <Field label="Paciente">
              <Select value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })} placeholder="Selecione" options={patients.data.map((p) => ({ value: p.id, label: p.name }))} />
            </Field>
          )}
          <Field label="Categoria">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={DOCUMENT_CATEGORIES} />
          </Field>
          <Field label="Observações"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
