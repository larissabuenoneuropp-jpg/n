// Relatório de Avaliação Neuropsicopedagógica (RAN) — estrutura baseada no modelo da profissional.
import type { Assessment, AssessmentRecord, Instrument, Patient, RecordField } from "@/lib/types";
import { RAN_DOMAINS } from "@/lib/data/instruments-library";
import { formatDate } from "@/lib/utils";

const FILL = "[completar]";
const orFill = (...parts: Array<string | undefined | null>) => parts.filter((p) => p && p.trim()).join("\n\n") || FILL;

/** Tabela de resultados no formato do RAN. Campos "Parte – Medida" viram linhas × colunas. */
export function resultsTable(fields: RecordField[], scores: Record<string, number | string>) {
  const present = fields.filter((f) => scores[f.key] !== undefined && scores[f.key] !== "");
  if (!present.length) return "";
  const pivot = present.every((f) => f.label.includes(" – "));
  if (pivot) {
    const rows: string[] = [];
    const cols: string[] = [];
    present.forEach((f) => {
      const [r, c] = f.label.split(" – ");
      if (!rows.includes(r)) rows.push(r);
      if (!cols.includes(c)) cols.push(c);
    });
    const cell = (r: string, c: string) => {
      const f = present.find((x) => x.label === `${r} – ${c}`);
      return f ? String(scores[f.key]) : "-";
    };
    return [`| Domínio | ${cols.join(" | ")} |`, ...rows.map((r) => `| ${r} | ${cols.map((c) => cell(r, c)).join(" | ")} |`)].join("\n");
  }
  return ["| Medida | Resultado |", ...present.map((f) => `| ${f.label} | ${scores[f.key]} |`)].join("\n");
}

function lowerFirst(s: string) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

function instrumentBlock(rec: AssessmentRecord, inst?: Instrument) {
  const name = inst?.full_name && inst.full_name !== rec.instrument_name ? `${inst.full_name} (${rec.instrument_name})` : rec.instrument_name;
  const intro = inst?.evaluates ? `O instrumento ${name} foi utilizado para investigar ${lowerFirst(inst.evaluates).replace(/\.$/, "")}.` : `Foi aplicado o instrumento ${name}.`;
  const fields = inst?.record_fields?.length ? inst.record_fields : Object.keys(rec.scores).map((k) => ({ key: k, label: k, type: "text" as const }));
  const table = resultsTable(fields, rec.scores);
  return [
    intro,
    rec.behavior ? rec.behavior : "",
    table ? `[[${rec.instrument_name} – Resultados${rec.date ? ` (${formatDate(rec.date)})` : ""}]]\n${table}` : "",
    rec.clinical_record || FILL,
  ].filter(Boolean).join("\n\n");
}

/** Monta os blocos variáveis do RAN a partir da avaliação e dos registros de aplicação. */
export function ranBlocks(patient: Patient | undefined, assessment: Assessment | undefined, records: AssessmentRecord[], instruments: Instrument[]) {
  const findInst = (name: string, id?: string | null) =>
    instruments.find((i) => i.id === id) ?? instruments.find((i) => i.name.toLowerCase() === name.toLowerCase());

  // Usa o registro mais recente de cada instrumento (da avaliação escolhida, quando houver)
  const scoped = assessment ? records.filter((r) => r.assessment_id === assessment.id || !r.assessment_id) : records;
  const latest = new Map<string, AssessmentRecord>();
  [...scoped].sort((a, b) => a.date.localeCompare(b.date)).forEach((r) => latest.set(r.instrument_name.toLowerCase(), r));

  // 8.1 Instrumentos (aplicados na avaliação + com registro)
  const names = new Set<string>([
    ...(assessment?.instruments ?? []).filter((i) => i.status !== "planejado").map((i) => i.name),
    ...Array.from(latest.values()).map((r) => r.instrument_name),
  ]);
  const instrumentList = Array.from(names).sort((a, b) => a.localeCompare(b, "pt-BR")).map((n) => {
    const inst = findInst(n);
    const title = inst?.full_name && inst.full_name !== n ? `${n} – ${inst.full_name}` : n;
    return `• ${title}.${inst?.reference ? ` ${inst.reference}` : ""}`;
  });

  // 8.2 Síntese por domínio
  const byDomain = new Map<string, AssessmentRecord[]>();
  latest.forEach((rec) => {
    const domain = findInst(rec.instrument_name, rec.instrument_id)?.ran_domain || "Outros instrumentos";
    byDomain.set(domain, [...(byDomain.get(domain) ?? []), rec]);
  });
  const behaviorDomain = "Aspectos comportamentais em diferentes contextos";
  const order = [...RAN_DOMAINS, "Outros instrumentos"];
  const results: string[] = [];
  let lastTop = "";
  order.filter((d) => d !== behaviorDomain && byDomain.has(d)).forEach((d) => {
    const [top, sub] = d.split(" › ");
    if (top !== lastTop) {
      results.push(`### ${top}`);
      lastTop = top;
    }
    if (sub) results.push(`#### ${sub}`);
    byDomain.get(d)!.forEach((rec) => results.push(instrumentBlock(rec, findInst(rec.instrument_name, rec.instrument_id))));
  });

  const behavior = (byDomain.get(behaviorDomain) ?? []).map((rec) => {
    const inst = findInst(rec.instrument_name, rec.instrument_id);
    return `#### ${inst?.full_name || rec.instrument_name}\n${instrumentBlock(rec, inst)}`;
  });

  const g = patient?.guardians?.[0];
  const mother = patient?.guardians?.find((x) => /m[ãa]e/i.test(x.relation ?? ""));
  const hand = patient?.handedness;
  return {
    dominancia: `(${hand === "destro" ? "X" : "  "}) Destro (${hand === "canhoto" ? "X" : "  "}) Canhoto${hand === "ambidestro" ? " (X) Ambidestro" : ""}`,
    responsavel_linha: mother ? `Nome da mãe: ${mother.name}` : g?.name ? `Nome do(a) responsável: ${g.name}${g.relation ? ` (${g.relation})` : ""}` : `Nome da mãe: ${FILL}`,
    medicamento: patient?.anamnesis?.medications?.trim() || "Não informado",
    historico: orFill(patient?.anamnesis?.history, patient?.anamnesis?.development, patient?.anamnesis?.health),
    antecedentes: orFill(patient?.anamnesis?.family_history),
    jeito_de_ser: orFill(patient?.anamnesis?.personality, patient?.behavioral_profile),
    vida_escolar: orFill(patient?.anamnesis?.school_history),
    comportamento_avaliacao: orFill(assessment?.clinical_notes, assessment?.observations),
    instrumentos_referencias: instrumentList.join("\n") || FILL,
    resultados_por_area: results.join("\n\n") || FILL,
    aspectos_comportamentais: behavior.join("\n\n") || FILL,
  };
}
