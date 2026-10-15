// Cobranças automáticas por data de vencimento — as mensagens entram numa fila e SÓ são enviadas após aprovação.
import type { DataStore } from "@/lib/data/store";
import type { BillingRules, ChargeMessage, ChargeStage, Patient, Profile, Transaction } from "@/lib/types";
import { addDays, fillTemplate, formatDate, money, parseDate, toISODate } from "@/lib/utils";

export const DEFAULT_BILLING_RULES: BillingRules = { enabled: true, days_before: 2, on_due: true, days_after: [3, 7], whatsapp: true, email: true };

export const BILLING_TEMPLATES = {
  cobranca_lembrete: "Olá, {{responsavel}}! Tudo bem? Passando para lembrar que o pagamento referente a {{descricao}} ({{paciente}}), no valor de {{valor}}, vence em {{vencimento}}.{{pix_linha}} Qualquer dúvida, estou à disposição. {{profissional}}",
  cobranca_vencimento: "Olá, {{responsavel}}! O pagamento referente a {{descricao}} ({{paciente}}), no valor de {{valor}}, vence hoje ({{vencimento}}).{{pix_linha}} Se já realizou, por favor desconsidere esta mensagem. Obrigada! {{profissional}}",
  cobranca_atraso: "Olá, {{responsavel}}! Identifiquei que o pagamento referente a {{descricao}} ({{paciente}}), no valor de {{valor}}, com vencimento em {{vencimento}}, ainda está em aberto.{{pix_linha}} Se já realizou, peço que me envie o comprovante e desconsidere esta mensagem. Obrigada! {{profissional}}",
  cobranca_assunto: "Pagamento — {{paciente}} — vencimento {{vencimento}}",
};

export const STAGE_LABEL = (s: ChargeStage) =>
  s === "lembrete" ? "Lembrete antes do vencimento" : s === "vencimento" ? "Dia do vencimento" : `Em atraso há ${s.split("_")[1]} dias`;

/** Etapa de cobrança aplicável hoje (a mais recente cujo gatilho já passou). */
export function currentStage(due: string, rules: BillingRules, today = new Date()): ChargeStage | null {
  const t = toISODate(today);
  const d = parseDate(due);
  const stages: Array<[ChargeStage, string]> = [];
  if (rules.days_before > 0) stages.push(["lembrete", toISODate(addDays(d, -rules.days_before))]);
  if (rules.on_due) stages.push(["vencimento", due]);
  [...rules.days_after].sort((a, b) => a - b).forEach((n) => stages.push([`atraso_${n}`, toISODate(addDays(d, n))]));
  const passed = stages.filter(([, date]) => date <= t);
  if (!passed.length) return null;
  // "lembrete" só vale antes do vencimento
  const last = passed[passed.length - 1];
  if (last[0] === "lembrete" && t >= due) return null;
  return last[0];
}

export function chargeText(stage: ChargeStage, tx: Transaction, patient: Patient | undefined, profile: Profile | null) {
  const tpl = profile?.templates ?? {};
  const key = stage === "lembrete" ? "cobranca_lembrete" : stage === "vencimento" ? "cobranca_vencimento" : "cobranca_atraso";
  const g = patient?.guardians?.[0];
  const vars = {
    responsavel: g?.name?.split(" ")[0] || "família",
    paciente: patient?.name?.split(" ")[0] ?? "",
    descricao: (tx.description || tx.category).replace(/\s+—\s+.*$/, ""),
    valor: money(tx.amount),
    vencimento: formatDate(tx.due_date),
    pix_linha: profile?.pix_key ? ` Chave PIX: ${profile.pix_key}.` : "",
    profissional: profile?.professional_name ?? "",
  };
  return {
    body: fillTemplate(tpl[key] || BILLING_TEMPLATES[key], vars),
    subject: fillTemplate(tpl.cobranca_assunto || BILLING_TEMPLATES.cobranca_assunto, vars),
  };
}

/**
 * Gera (sem enviar) as mensagens de cobrança do dia e cancela as pendentes de lançamentos já pagos.
 * Chamado ao abrir o app e na tela de Cobranças.
 */
export async function generateChargeQueue(store: DataStore, profile: Profile | null) {
  const rules = { ...DEFAULT_BILLING_RULES, ...(profile?.billing_rules ?? {}) };
  const [txs, existing, patients] = await Promise.all([
    store.list("transactions"), store.list("charge_messages"), store.list("patients"),
  ]);
  let created = 0;
  let cancelled = 0;
  // Pagamento registrado → cancela o que ainda não foi aprovado
  for (const m of existing.filter((x) => x.status === "pendente")) {
    const tx = txs.find((t) => t.id === m.transaction_id);
    if (!tx || tx.paid_at || tx.status === "cancelado" || tx.status === "previsto") {
      await store.update("charge_messages", m.id, { status: "cancelada", error: "Pagamento registrado antes do envio" });
      cancelled++;
    }
  }
  if (!rules.enabled) return { created, cancelled };
  const rows: Partial<ChargeMessage>[] = [];
  for (const tx of txs.filter((t) => t.type === "receita" && !t.paid_at && t.patient_id && t.status !== "previsto" && t.status !== "cancelado")) {
    const stage = currentStage(tx.due_date, rules);
    if (!stage) continue;
    const patient = patients.find((p) => p.id === tx.patient_id);
    if (!patient || patient.status !== "ativo") continue;
    const g = patient.guardians?.[0];
    const { body, subject } = chargeText(stage, tx, patient, profile);
    const channels: Array<ChargeMessage["channel"]> = [];
    if (rules.whatsapp) channels.push("whatsapp");
    if (rules.email) channels.push("email");
    for (const channel of channels) {
      if (existing.some((m) => m.transaction_id === tx.id && m.stage === stage && m.channel === channel)) continue;
      const recipient = channel === "whatsapp" ? (g?.phone || patient.phones || "") : (g?.email || patient.email || "");
      rows.push({
        transaction_id: tx.id, patient_id: patient.id, channel, stage, recipient, recipient_name: g?.name ?? "",
        subject: channel === "email" ? subject : undefined, body, status: "pendente", amount: Number(tx.amount), due_date: tx.due_date,
        error: recipient ? null : channel === "email" ? "Responsável sem e-mail no cadastro" : "Responsável sem telefone no cadastro",
      });
    }
  }
  if (rows.length) await store.insertMany("charge_messages", rows);
  created = rows.length;
  return { created, cancelled };
}

export function whatsappLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "").replace(/^55/, "");
  return `https://wa.me/55${digits}?text=${encodeURIComponent(text)}`;
}
