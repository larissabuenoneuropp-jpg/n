"use client";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Pencil, Sparkles, Trash2, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Select, Spinner } from "@/components/ui";
import { LineChart } from "@/components/charts";
import { useCollection } from "@/lib/data/provider";
import type { AssessmentRecord, Patient, RecordField } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { ApplyInstrumentModal, PHASE_LABEL } from "./apply-instrument";

/** Quantificação da evolução: compara as aplicações de um mesmo instrumento ao longo do tempo. */
export function EvolutionPanel({ patient }: { patient: Patient }) {
  const records = useCollection("assessment_records", { filter: { patient_id: patient.id }, orderBy: "date", ascending: true });
  const lib = useCollection("instruments");
  const names = useMemo(() => Array.from(new Set(records.data.map((r) => r.instrument_name))), [records.data]);
  const [selected, setSelected] = useState("");
  const [editing, setEditing] = useState<AssessmentRecord | null>(null);

  useEffect(() => {
    if (!selected && names.length) setSelected(names[0]);
  }, [names, selected]);

  const rows = records.data.filter((r) => r.instrument_name === selected);
  const instrument = lib.data.find((i) => i.name === selected);
  const numericFields: RecordField[] = useMemo(() => {
    const defined = (instrument?.record_fields ?? []).filter((f) => f.type === "number");
    const keys = new Set(rows.flatMap((r) => Object.entries(r.scores).filter(([, v]) => typeof v === "number").map(([k]) => k)));
    const out = defined.filter((f) => keys.has(f.key));
    keys.forEach((k) => { if (!out.some((f) => f.key === k)) out.push({ key: k, label: k, type: "number", higher_is_better: true }); });
    return out;
  }, [instrument, rows]);

  if (records.loading) return <Spinner />;
  if (!names.length) {
    return (
      <Card>
        <EmptyState icon={<BarChart3 className="h-5 w-5" />} title="Nenhuma aplicação registrada"
          text="Registre a aplicação dos instrumentos (botão “Aplicar” na avaliação). Ao reaplicar, a evolução aparece aqui em gráfico e tabela." />
      </Card>
    );
  }

  const first = rows[0];
  const last = rows[rows.length - 1];
  const chartData = rows.map((r) => ({ x: formatDate(r.date, { day: "2-digit", month: "2-digit", year: "2-digit" }), ...Object.fromEntries(numericFields.map((f) => [f.key, Number(r.scores[f.key])]).filter(([, v]) => !Number.isNaN(v))) }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Evolução quantitativa" icon={<BarChart3 className="h-4 w-4" />} subtitle="Compare a mesma medida entre avaliação inicial, intermediária e reavaliação"
          action={<Select className="h-8 w-48 text-xs" value={selected} onChange={(e) => setSelected(e.target.value)} options={names} />} />
        <div className="space-y-5 p-5">
          {numericFields.length > 0 && rows.length > 0 ? (
            <LineChart data={chartData} xKey="x" series={numericFields.slice(0, 4).map((f) => ({ key: f.key, label: f.label }))} />
          ) : (
            <p className="text-xs text-ink-faint">Sem pontuações numéricas para este instrumento.</p>
          )}
          {numericFields.length > 4 && <p className="text-[11px] text-ink-faint">O gráfico mostra os 4 primeiros campos; todos aparecem na tabela.</p>}

          {rows.length >= 2 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-left text-xs text-ink-faint">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Medida</th>
                    <th className="py-2 pr-3 text-right font-medium">{formatDate(first.date)}</th>
                    <th className="py-2 pr-3 text-right font-medium">{formatDate(last.date)}</th>
                    <th className="py-2 pr-3 text-right font-medium">Variação</th>
                    <th className="py-2 font-medium">Leitura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {numericFields.map((f) => {
                    const a = Number(first.scores[f.key]);
                    const b = Number(last.scores[f.key]);
                    if (Number.isNaN(a) || Number.isNaN(b)) return null;
                    const diff = b - a;
                    const pct = a !== 0 ? Math.round((diff / Math.abs(a)) * 100) : null;
                    const better = diff === 0 ? null : (diff > 0) === (f.higher_is_better !== false);
                    return (
                      <tr key={f.key}>
                        <td className="py-2 pr-3">{f.label}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-ink-soft">{a}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{b}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{diff > 0 ? "+" : ""}{Math.round(diff * 100) / 100}{pct !== null ? ` (${pct > 0 ? "+" : ""}${pct}%)` : ""}</td>
                        <td className="py-2">
                          {better === null ? <Badge><Minus className="h-3 w-3" /> Estável</Badge> : better ? <Badge tone="green"><TrendingUp className="h-3 w-3" /> Melhora</Badge> : <Badge tone="red"><TrendingDown className="h-3 w-3" /> Piora</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-ink-faint">Variação de pontuação bruta. A interpretação clínica (significância, normas) é da profissional, conforme o manual.</p>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title={`Registros — ${selected}`} />
        <ul className="divide-y divide-line">
          {[...rows].reverse().map((r) => (
            <li key={r.id} className="px-5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{formatDate(r.date)} · {PHASE_LABEL[r.phase]} {r.ai_assisted && <Badge tone="sage" className="ml-1"><Sparkles className="h-3 w-3" /> com IA</Badge>}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">{Object.entries(r.scores).map(([k, v]) => `${instrument?.record_fields.find((f) => f.key === k)?.label ?? k}: ${v}`).join(" · ") || "Sem pontuações"}</p>
                  {r.clinical_record && <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-sm text-ink-soft">{r.clinical_record}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(r)} aria-label="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={async () => { if (confirm("Excluir este registro?")) await records.remove(r.id); }} aria-label="Excluir"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <ApplyInstrumentModal open={Boolean(editing)} onClose={() => setEditing(null)} patient={patient}
        item={editing ? { id: editing.id, instrument_id: editing.instrument_id, name: editing.instrument_name, status: "corrigido" } : null}
        existing={editing} onSaved={() => {}} />
    </div>
  );
}
