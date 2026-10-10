// Objetivos e atividades múltiplos por sessão, com compatibilidade com o formato antigo (texto único).
import type { AssessmentSessionPlan, ObjectiveStatus, PlannedSession, SessionActivity, SessionObjective } from "@/lib/types";
import { uid } from "@/lib/utils";

export const OBJECTIVE_STATUS: Record<ObjectiveStatus, { label: string; tone: "green" | "amber" | "red" }> = {
  atingido: { label: "Atingido", tone: "green" },
  parcial: { label: "Parcialmente", tone: "amber" },
  nao_atingido: { label: "Não atingido", tone: "red" },
};

/** Quebra um texto legado ("1) ...; 2) ...", uma por linha, ou separados por ";") em itens. */
function splitLegacy(text?: string) {
  return (text ?? "")
    .split(/\n|;|(?:^|\s)\d+[).]\s/)
    .map((t) => t.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

export function objectivesOf(s: { objective?: string; objectives?: SessionObjective[] }): SessionObjective[] {
  if (s.objectives?.length) return s.objectives;
  return splitLegacy(s.objective).map((text) => ({ id: uid(), text }));
}

export function activitiesOf(s: { activities?: string | SessionActivity[]; activity_list?: SessionActivity[] }): SessionActivity[] {
  if (s.activity_list?.length) return s.activity_list;
  if (Array.isArray(s.activities)) return s.activities;
  return splitLegacy(s.activities).map((title) => ({ id: uid(), title }));
}

export const objectivesText = (list: SessionObjective[]) => list.map((o) => o.text).filter(Boolean).join("; ");
export const activitiesText = (list: SessionActivity[]) =>
  list.filter((a) => a.title).map((a) => `${a.title}${a.duration_min ? ` (${a.duration_min} min)` : ""}`).join("\n");

/** Atualiza os objetivos da sessão do plano mantendo o texto legado em sincronia. */
export function withObjectives(s: PlannedSession, objectives: SessionObjective[]): PlannedSession {
  return { ...s, objectives, objective: objectivesText(objectives) };
}
export function withActivities(s: PlannedSession, list: SessionActivity[]): PlannedSession {
  return { ...s, activity_list: list, activities: activitiesText(list) };
}
export function assessmentSessionWithObjectives(s: AssessmentSessionPlan, objectives: SessionObjective[]): AssessmentSessionPlan {
  return { ...s, objectives, objective: objectivesText(objectives) };
}

/** Normaliza uma resposta da IA (aceita lista ou texto único). */
export function toObjectives(v: unknown): SessionObjective[] {
  const arr = Array.isArray(v) ? v : typeof v === "string" ? splitLegacy(v) : [];
  return arr
    .map((x) => {
      if (typeof x === "string") return { text: x, area: undefined as string | undefined };
      const o = x as { text?: string; objetivo?: string; area?: string; area_nome?: string };
      return { text: String(o.text ?? o.objetivo ?? ""), area: o.area ?? o.area_nome };
    })
    .filter((o) => o.text)
    .map((o) => ({ id: uid(), text: o.text, ...(o.area ? { area: o.area } : {}) }));
}

/** Agrupa objetivos por área, preservando a ordem em que as áreas aparecem. */
export function groupByArea<T extends { area?: string }>(list: T[]) {
  const groups = new Map<string, T[]>();
  list.forEach((o) => { const k = o.area || "Sem área"; groups.set(k, [...(groups.get(k) ?? []), o]); });
  return Array.from(groups, ([area, items]) => ({ area, items }));
}
export function toActivities(v: unknown): SessionActivity[] {
  if (typeof v === "string") return splitLegacy(v).map((title) => ({ id: uid(), title }));
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? { title: x } : (x as Partial<SessionActivity> & { titulo?: string })))
    .map((x) => ({ id: uid(), title: String(x.title ?? (x as { titulo?: string }).titulo ?? ""), materials: x.materials, duration_min: x.duration_min ? Number(x.duration_min) : undefined }))
    .filter((x) => x.title);
}

/** Resumo de alcance dos objetivos (para listas e relatórios). */
export function objectiveSummary(list: SessionObjective[]) {
  const evaluated = list.filter((o) => o.status);
  return {
    total: list.length,
    atingido: list.filter((o) => o.status === "atingido").length,
    parcial: list.filter((o) => o.status === "parcial").length,
    nao: list.filter((o) => o.status === "nao_atingido").length,
    evaluated: evaluated.length,
  };
}
