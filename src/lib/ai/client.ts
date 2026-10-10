"use client";
import type { Patient } from "@/lib/types";
import { ageFrom } from "@/lib/utils";
import type { AiTask } from "./prompts";

export interface AiResult<T> {
  demo: boolean;
  result: T;
}

export async function askAI<T = Record<string, unknown>>(task: AiTask, input: Record<string, unknown>): Promise<AiResult<T>> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task, input }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Erro ao consultar a IA");
  return json as AiResult<T>;
}

/**
 * Minimização de dados (LGPD): envia à IA apenas o necessário para o raciocínio clínico,
 * sem nome, contatos, escola ou responsáveis.
 */
export function patientContext(p: Patient) {
  const age = ageFrom(p.birth_date);
  return {
    idade: age ? `${age.years} anos e ${age.months} meses` : "não informada",
    ano_escolar: p.grade || undefined,
    diagnostico: p.diagnosis || undefined,
    hipoteses: p.hypotheses || undefined,
    queixa: p.anamnesis?.complaints || undefined,
    habilidades: p.skills || undefined,
    dificuldades: p.difficulties || undefined,
    perfil_cognitivo: p.cognitive_profile || undefined,
    perfil_comportamental: p.behavioral_profile || undefined,
    objetivos_gerais: p.general_goals || undefined,
  };
}
