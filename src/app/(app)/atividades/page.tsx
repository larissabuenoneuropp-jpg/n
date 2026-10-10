"use client";
import { useMemo, useState } from "react";
import { BookOpen, Clock, Heart, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea, useToast } from "@/components/ui";
import { useCollection } from "@/lib/data/provider";
import { AREAS, DIAGNOSES } from "@/lib/catalog";
import type { Activity, Difficulty } from "@/lib/types";
import { cn } from "@/lib/utils";

const DIFF: Record<Difficulty, { label: string; tone: "green" | "amber" | "red" }> = {
  facil: { label: "Fácil", tone: "green" },
  medio: { label: "Médio", tone: "amber" },
  dificil: { label: "Difícil", tone: "red" },
};

const blank: Partial<Activity> = { title: "", area: AREAS[0], skills: [], diagnoses: [], age_min: 4, age_max: 12, objectives: "", materials: "", steps: "", duration_min: 15, difficulty: "medio", favorite: false };

function ActivityForm({ open, onClose, initial, onSave }: { open: boolean; onClose: () => void; initial: Partial<Activity> | null; onSave: (a: Partial<Activity>) => Promise<unknown> }) {
  const [f, setF] = useState<Partial<Activity>>(initial ?? blank);
  const [skills, setSkills] = useState((initial?.skills ?? []).join(", "));
  const [saving, setSaving] = useState(false);
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setF(initial ?? blank);
    setSkills((initial?.skills ?? []).join(", "));
  }
  return (
    <Modal open={open} onClose={onClose} wide title={f.id ? "Editar atividade" : "Nova atividade"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={saving} onClick={async () => {
        if (!f.title) return;
        setSaving(true);
        await onSave({ ...f, skills: skills.split(",").map((s) => s.trim()).filter(Boolean) }).finally(() => setSaving(false));
        onClose();
      }}>Salvar</Button></>}>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Título" className="sm:col-span-4"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Área" className="sm:col-span-2"><Select value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} options={AREAS} /></Field>
        <Field label="Idade mín."><Input type="number" value={f.age_min} onChange={(e) => setF({ ...f, age_min: Number(e.target.value) })} /></Field>
        <Field label="Idade máx."><Input type="number" value={f.age_max} onChange={(e) => setF({ ...f, age_max: Number(e.target.value) })} /></Field>
        <Field label="Habilidades (separe por vírgula)" className="sm:col-span-2"><Input value={skills} onChange={(e) => setSkills(e.target.value)} /></Field>
        <Field label="Tempo (min)"><Input type="number" value={f.duration_min} onChange={(e) => setF({ ...f, duration_min: Number(e.target.value) })} /></Field>
        <Field label="Dificuldade"><Select value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value as Difficulty })} options={Object.entries(DIFF).map(([value, v]) => ({ value, label: v.label }))} /></Field>
        <div className="sm:col-span-4">
          <p className="mb-1.5 text-xs font-medium text-ink-soft">Indicada para</p>
          <div className="flex flex-wrap gap-1.5">
            {DIAGNOSES.map((d) => {
              const on = f.diagnoses?.includes(d);
              return (
                <button key={d} type="button" onClick={() => setF({ ...f, diagnoses: on ? f.diagnoses!.filter((x) => x !== d) : [...(f.diagnoses ?? []), d] })}
                  className={cn("rounded-full border px-2.5 py-1 text-xs", on ? "border-brand-300 bg-brand-50 text-brand-700" : "border-line text-ink-soft")}>{d}</button>
              );
            })}
          </div>
        </div>
        <Field label="Objetivos" className="sm:col-span-2"><Textarea value={f.objectives} onChange={(e) => setF({ ...f, objectives: e.target.value })} /></Field>
        <Field label="Materiais" className="sm:col-span-2"><Textarea value={f.materials} onChange={(e) => setF({ ...f, materials: e.target.value })} /></Field>
        <Field label="Passo a passo" className="sm:col-span-4"><Textarea rows={6} value={f.steps} onChange={(e) => setF({ ...f, steps: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

export default function ActivitiesPage() {
  const toast = useToast();
  const { data, loading, insert, update, remove } = useCollection("activities", { orderBy: "title", ascending: true });
  const [q, setQ] = useState("");
  const [area, setArea] = useState("");
  const [diag, setDiag] = useState("");
  const [age, setAge] = useState("");
  const [diff, setDiff] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [detail, setDetail] = useState<Activity | null>(null);
  const [form, setForm] = useState<Partial<Activity> | null>(null);

  const list = useMemo(() => {
    const term = q.toLowerCase();
    return data.filter(
      (a) =>
        (!area || a.area === area) &&
        (!diag || a.diagnoses.includes(diag)) &&
        (!diff || a.difficulty === diff) &&
        (!age || (a.age_min <= Number(age) && a.age_max >= Number(age))) &&
        (!favOnly || a.favorite) &&
        (!term || [a.title, a.objectives, ...a.skills].some((v) => v.toLowerCase().includes(term))),
    );
  }, [data, q, area, diag, age, diff, favOnly]);

  const toggleFav = (a: Activity) => update(a.id, { favorite: !a.favorite });

  return (
    <>
      <PageHeader title="Banco de atividades" subtitle="Biblioteca inteligente com filtros por idade, área, habilidade e diagnóstico"
        actions={<Button onClick={() => setForm(blank)}><Plus className="h-4 w-4" /> Nova atividade</Button>} />

      <Card className="mb-4 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input className="pl-9" placeholder="Buscar por objetivo ou habilidade…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={area} onChange={(e) => setArea(e.target.value)} placeholder="Todas as áreas" options={AREAS} />
          <Select value={diag} onChange={(e) => setDiag(e.target.value)} placeholder="Todos os diagnósticos" options={DIAGNOSES} />
          <Input type="number" min={2} max={18} placeholder="Idade (anos)" value={age} onChange={(e) => setAge(e.target.value)} />
          <div className="flex gap-2">
            <Select value={diff} onChange={(e) => setDiff(e.target.value)} placeholder="Nível" options={Object.entries(DIFF).map(([value, v]) => ({ value, label: v.label }))} />
            <Button variant={favOnly ? "primary" : "secondary"} className="h-9 shrink-0 px-3" onClick={() => setFavOnly(!favOnly)} aria-label="Somente favoritas"><Heart className={cn("h-4 w-4", favOnly && "fill-current")} /></Button>
          </div>
        </div>
      </Card>

      {loading ? <Spinner /> : list.length === 0 ? (
        <Card><EmptyState icon={<BookOpen className="h-5 w-5" />} title="Nenhuma atividade encontrada" text="Ajuste os filtros ou cadastre uma nova atividade." /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((a) => (
            <Card key={a.id} className="flex flex-col p-4 transition hover:border-brand-200">
              <div className="mb-2 flex items-start justify-between gap-2">
                <Badge tone="blue">{a.area}</Badge>
                <button onClick={() => toggleFav(a)} aria-label="Favoritar" className={a.favorite ? "text-lilac-500" : "text-ink-faint hover:text-lilac-500"}>
                  <Heart className={cn("h-4 w-4", a.favorite && "fill-current")} />
                </button>
              </div>
              <button className="text-left" onClick={() => setDetail(a)}>
                <h3 className="font-medium leading-snug hover:underline">{a.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{a.objectives}</p>
              </button>
              <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
                <Badge tone={DIFF[a.difficulty].tone}>{DIFF[a.difficulty].label}</Badge>
                <Badge><Clock className="h-3 w-3" /> {a.duration_min} min</Badge>
                <Badge>{a.age_min}–{a.age_max} anos</Badge>
                {a.diagnoses.slice(0, 2).map((d) => <Badge key={d} tone="lilac">{d}</Badge>)}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} wide title={detail?.title ?? ""}
        footer={detail && <>
          <Button variant="danger" className="mr-auto" onClick={async () => { if (confirm("Excluir atividade?")) { await remove(detail.id); setDetail(null); toast("Atividade excluída"); } }}><Trash2 className="h-4 w-4" /></Button>
          <Button variant="secondary" onClick={() => { setForm(detail); setDetail(null); }}><Pencil className="h-4 w-4" /> Editar</Button>
          <Button onClick={() => window.print()}>Imprimir</Button>
        </>}>
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="blue">{detail.area}</Badge>
              <Badge tone={DIFF[detail.difficulty].tone}>{DIFF[detail.difficulty].label}</Badge>
              <Badge>{detail.duration_min} min</Badge>
              <Badge>{detail.age_min}–{detail.age_max} anos</Badge>
              {detail.diagnoses.map((d) => <Badge key={d} tone="lilac">{d}</Badge>)}
            </div>
            {detail.skills.length > 0 && <p><b>Habilidades:</b> {detail.skills.join(", ")}</p>}
            <div><p className="mb-1 font-semibold">Objetivos</p><p className="text-ink-soft">{detail.objectives}</p></div>
            <div><p className="mb-1 font-semibold">Materiais</p><p className="text-ink-soft">{detail.materials}</p></div>
            <div><p className="mb-1 font-semibold">Passo a passo</p><p className="whitespace-pre-wrap text-ink-soft">{detail.steps}</p></div>
          </div>
        )}
      </Modal>

      <ActivityForm open={Boolean(form)} onClose={() => setForm(null)} initial={form}
        onSave={async (a) => { if (a.id) await update(a.id, a); else await insert(a); toast("Atividade salva"); }} />
    </>
  );
}
