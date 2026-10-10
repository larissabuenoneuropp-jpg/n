"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { ACCESS_LABEL, DEFAULT_RECORD_FIELDS, INSTRUMENT_AREAS, RAN_DOMAINS } from "@/lib/data/instruments-library";
import type { Instrument, RecordField } from "@/lib/types";

const blank: Partial<Instrument> = {
  name: "", full_name: "", area: INSTRUMENT_AREAS[0], evaluates: "", access: "verificar", record_fields: DEFAULT_RECORD_FIELDS, favorite: false,
};

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "campo";

/** Edição de um instrumento, incluindo os campos de pontuação usados na quantificação. */
export function InstrumentForm({ open, onClose, initial, onSave }: {
  open: boolean; onClose: () => void; initial: Partial<Instrument> | null; onSave: (i: Partial<Instrument>) => Promise<unknown>;
}) {
  const [f, setF] = useState<Partial<Instrument>>(initial ?? blank);
  const [last, setLast] = useState(initial);
  const [saving, setSaving] = useState(false);
  if (initial !== last) {
    setLast(initial);
    setF(initial ?? blank);
  }
  const fields = f.record_fields ?? [];
  const setField = (i: number, patch: Partial<RecordField>) => setF({ ...f, record_fields: fields.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  return (
    <Modal open={open} onClose={onClose} wide title={f.id ? `Editar ${f.name}` : "Novo instrumento / protocolo"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={saving} onClick={async () => {
        if (!f.name?.trim()) return;
        setSaving(true);
        // garante chaves únicas e estáveis para os campos
        const seen = new Set<string>();
        const record_fields = fields.filter((x) => x.label.trim()).map((x) => {
          let key = x.key || slug(x.label);
          while (seen.has(key)) key += "_2";
          seen.add(key);
          return { ...x, key };
        });
        await onSave({ ...f, record_fields }).finally(() => setSaving(false));
        onClose();
      }}>Salvar</Button></>}>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Sigla / nome curto"><Input value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Nome completo" className="sm:col-span-3"><Input value={f.full_name ?? ""} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
        <Field label="Área" className="sm:col-span-2">
          <Input list="instrument-areas" value={f.area ?? ""} onChange={(e) => setF({ ...f, area: e.target.value })} />
          <datalist id="instrument-areas">{INSTRUMENT_AREAS.map((a) => <option key={a} value={a} />)}</datalist>
        </Field>
        <Field label="Faixa etária (conforme manual)"><Input value={f.age_range ?? ""} onChange={(e) => setF({ ...f, age_range: e.target.value })} /></Field>
        <Field label="Quem pode aplicar">
          <Select value={f.access} onChange={(e) => setF({ ...f, access: e.target.value as Instrument["access"] })} options={Object.entries(ACCESS_LABEL).map(([value, v]) => ({ value, label: v.label }))} />
        </Field>
        <Field label="O que avalia" className="sm:col-span-2"><Textarea value={f.evaluates ?? ""} onChange={(e) => setF({ ...f, evaluates: e.target.value })} /></Field>
        <Field label="Observação sobre o uso" className="sm:col-span-2"><Textarea value={f.access_note ?? ""} onChange={(e) => setF({ ...f, access_note: e.target.value })} /></Field>
        <Field label="Seção no relatório (RAN)" className="sm:col-span-2">
          <Select value={f.ran_domain ?? ""} onChange={(e) => setF({ ...f, ran_domain: e.target.value })} placeholder="—" options={RAN_DOMAINS} />
        </Field>
        <Field label="Referência bibliográfica (aparece na lista de instrumentos do relatório)" className="sm:col-span-2">
          <Textarea rows={2} value={f.reference ?? ""} onChange={(e) => setF({ ...f, reference: e.target.value })} />
        </Field>
        <Field label="Roteiro base de aplicação (seu modelo)" className="sm:col-span-4" hint="Usado como ponto de partida na aplicação. Não copie itens protegidos do manual.">
          <Textarea rows={5} value={f.application_guide ?? ""} onChange={(e) => setF({ ...f, application_guide: e.target.value })} />
        </Field>
        <div className="sm:col-span-4">
          <p className="mb-1 text-xs font-medium text-ink-soft">Campos de registro (pontuações para quantificar a evolução)</p>
          <p className="mb-2 text-[11px] text-ink-faint">Personalize conforme os subtestes do manual. Para campos numéricos, indique se valor maior significa melhora.</p>
          <div className="space-y-2">
            {fields.map((x, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1.6fr_0.8fr_1.2fr_auto]">
                <Input placeholder="Nome do campo (ex.: Leitura de palavras)" value={x.label} onChange={(e) => setField(i, { label: e.target.value })} />
                <Select value={x.type} onChange={(e) => setField(i, { type: e.target.value as RecordField["type"] })} options={[{ value: "number", label: "Número" }, { value: "text", label: "Texto" }]} />
                {x.type === "number" ? (
                  <Select value={x.higher_is_better === false ? "menor" : "maior"} onChange={(e) => setField(i, { higher_is_better: e.target.value === "maior" })}
                    options={[{ value: "maior", label: "Maior = melhor" }, { value: "menor", label: "Menor = melhor" }]} />
                ) : <span />}
                <Button variant="ghost" size="sm" className="h-9" onClick={() => setF({ ...f, record_fields: fields.filter((_, j) => j !== i) })} aria-label="Remover campo"><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setF({ ...f, record_fields: [...fields, { key: "", label: "", type: "number", higher_is_better: true }] })}>
            <Plus className="h-3.5 w-3.5" /> Campo
          </Button>
        </div>
      </div>
    </Modal>
  );
}
