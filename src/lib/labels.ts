import type { AppointmentKind, AppointmentStatus, InstrumentStatus } from "./types";
import type { Tone } from "@/components/ui";

export const APPT_KIND: Record<AppointmentKind, { label: string; color: string }> = {
  atendimento: { label: "Atendimento", color: "bg-brand-50 border-brand-200 text-brand-800" },
  avaliacao: { label: "Avaliação", color: "bg-lilac-50 border-lilac-200 text-lilac-600" },
  devolutiva: { label: "Devolutiva", color: "bg-emerald-50 border-emerald-200 text-emerald-800" },
  bloqueio: { label: "Bloqueio", color: "bg-slate-100 border-slate-200 text-slate-500" },
  outro: { label: "Outro", color: "bg-amber-50 border-amber-200 text-amber-800" },
};

export const APPT_STATUS: Record<AppointmentStatus, { label: string; tone: Tone }> = {
  agendado: { label: "Agendado", tone: "gray" },
  confirmado: { label: "Confirmado", tone: "blue" },
  realizado: { label: "Realizado", tone: "green" },
  falta: { label: "Falta", tone: "red" },
  cancelado: { label: "Cancelado", tone: "amber" },
};

export const INSTRUMENT_STATUS: Record<InstrumentStatus, { label: string; tone: Tone }> = {
  planejado: { label: "Planejado", tone: "gray" },
  aplicado: { label: "Aplicado", tone: "blue" },
  corrigido: { label: "Corrigido", tone: "lilac" },
  no_relatorio: { label: "No relatório", tone: "green" },
};

export function txStatus(t: { paid_at?: string | null; due_date: string }): { label: string; tone: Tone; key: "pago" | "pendente" | "atrasado" } {
  if (t.paid_at) return { label: "Pago", tone: "green", key: "pago" };
  const today = new Date().toISOString().slice(0, 10);
  return t.due_date < today ? { label: "Atrasado", tone: "red", key: "atrasado" } : { label: "Pendente", tone: "amber", key: "pendente" };
}
