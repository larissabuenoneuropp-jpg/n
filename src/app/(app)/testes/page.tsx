"use client";
import { useMemo, useState } from "react";
import { ClipboardCheck, Heart, Info, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Input, Modal, PageHeader, Select, Spinner, useToast } from "@/components/ui";
import { InstrumentForm } from "@/components/instruments/instrument-form";
import { useCollection } from "@/lib/data/provider";
import { ACCESS_LABEL } from "@/lib/data/instruments-library";
import type { Instrument } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function InstrumentsPage() {
  const toast = useToast();
  const { data, loading, insert, update, remove } = useCollection("instruments", { orderBy: "name", ascending: true });
  const [q, setQ] = useState("");
  const [area, setArea] = useState("");
  const [access, setAccess] = useState("");
  const [detail, setDetail] = useState<Instrument | null>(null);
  const [form, setForm] = useState<Partial<Instrument> | null>(null);

  const areas = useMemo(() => Array.from(new Set(data.map((i) => i.area))).sort(), [data]);
  const filtered = data.filter(
    (i) => (!area || i.area === area) && (!access || i.access === access) &&
      (!q || [i.name, i.full_name, i.evaluates].some((v) => v?.toLowerCase().includes(q.toLowerCase()))),
  );
  const grouped = areas.map((a) => ({ area: a, items: filtered.filter((i) => i.area === a) })).filter((g) => g.items.length);

  return (
    <>
      <PageHeader title="Testes e protocolos" subtitle="Biblioteca de instrumentos de avaliação por área, com quem pode aplicar"
        actions={<Button onClick={() => setForm({})}><Plus className="h-4 w-4" /> Novo instrumento</Button>} />

      <Card className="mb-4 flex items-start gap-2 border-mustard-300 bg-mustard-100/40 p-4 text-xs leading-relaxed text-mustard-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          A classificação de quem pode aplicar é uma referência e pode mudar. A lista oficial de testes psicológicos (uso privativo de psicólogos) é mantida pelo
          SATEPSI/CFP — confirme sempre antes de aplicar. Faixas etárias e subtestes devem ser conferidos no manual de cada instrumento.
        </p>
      </Card>

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_220px_240px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input className="pl-9" placeholder="Buscar por nome ou habilidade avaliada…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={area} onChange={(e) => setArea(e.target.value)} placeholder="Todas as áreas" options={areas} />
        <Select value={access} onChange={(e) => setAccess(e.target.value)} placeholder="Qualquer aplicador" options={Object.entries(ACCESS_LABEL).map(([value, v]) => ({ value, label: v.label }))} />
      </div>

      {loading ? <Spinner /> : grouped.length === 0 ? (
        <Card><EmptyState icon={<ClipboardCheck className="h-5 w-5" />} title="Nenhum instrumento encontrado" /></Card>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <section key={g.area}>
              <h2 className="mb-2 text-sm font-semibold text-ink-soft">{g.area}</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.items.map((i) => (
                  <Card key={i.id} className="flex flex-col p-4 transition hover:border-brand-200">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <button onClick={() => setDetail(i)} className="text-left">
                        <p className="font-display font-semibold hover:underline">{i.name}</p>
                        <p className="text-xs text-ink-faint">{i.full_name}</p>
                      </button>
                      <button onClick={() => update(i.id, { favorite: !i.favorite })} aria-label="Favoritar" className={i.favorite ? "text-brand-500" : "text-ink-faint hover:text-brand-500"}>
                        <Heart className={cn("h-4 w-4", i.favorite && "fill-current")} />
                      </button>
                    </div>
                    <p className="line-clamp-3 text-xs text-ink-soft">{i.evaluates}</p>
                    <div className="mt-auto pt-3"><Badge tone={ACCESS_LABEL[i.access].tone}>{ACCESS_LABEL[i.access].label}</Badge></div>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} wide title={detail ? `${detail.name} — ${detail.full_name}` : ""}
        footer={detail && <>
          <Button variant="danger" className="mr-auto" onClick={async () => { if (confirm("Excluir instrumento da biblioteca?")) { await remove(detail.id); setDetail(null); toast("Instrumento excluído"); } }}><Trash2 className="h-4 w-4" /></Button>
          <Button onClick={() => { setForm(detail); setDetail(null); }}><Pencil className="h-4 w-4" /> Editar</Button>
        </>}>
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="blue">{detail.area}</Badge>
              <Badge tone={ACCESS_LABEL[detail.access].tone}>{ACCESS_LABEL[detail.access].label}</Badge>
              {detail.age_range && <Badge>{detail.age_range}</Badge>}
            </div>
            <div><p className="mb-1 font-semibold">O que avalia</p><p className="text-ink-soft">{detail.evaluates}</p></div>
            {detail.access_note && <div><p className="mb-1 font-semibold">Quem pode aplicar</p><p className="text-ink-soft">{detail.access_note}</p></div>}
            <div>
              <p className="mb-1 font-semibold">Campos de registro</p>
              <div className="flex flex-wrap gap-1.5">
                {detail.record_fields.map((f) => <Badge key={f.key} tone="sage">{f.label}{f.type === "number" ? (f.higher_is_better === false ? " ↓" : " ↑") : ""}</Badge>)}
              </div>
              <p className="mt-1 text-[11px] text-ink-faint">↑ maior = melhor · ↓ menor = melhor</p>
            </div>
            {detail.application_guide && <div><p className="mb-1 font-semibold">Roteiro base</p><p className="whitespace-pre-wrap text-ink-soft">{detail.application_guide}</p></div>}
          </div>
        )}
      </Modal>

      <InstrumentForm key={form?.id ?? (form ? "novo" : "fechado")} open={Boolean(form)} onClose={() => setForm(null)} initial={form && Object.keys(form).length ? form : null}
        onSave={async (i) => { if (i.id) await update(i.id, i); else await insert(i); toast("Instrumento salvo"); }} />
    </>
  );
}
