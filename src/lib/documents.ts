// Geração automática de contrato e recibo a partir do cadastro do paciente e do financeiro.
import type { DataStore } from "@/lib/data/store";
import type { Appointment, Patient, Profile, Receipt, Transaction } from "@/lib/types";
import { DEFAULT_TEMPLATES } from "@/lib/templates";
import { numeroPorExtenso, reaisPorExtenso } from "@/lib/extenso";
import { fillTemplate, formatDate, monthKey, parseDate, toISODate, today } from "@/lib/utils";

const BLANK = "____________________";
const v = (x?: string | number | null, blank = BLANK) => (x === undefined || x === null || x === "" ? blank : String(x));
const num = (x: number) => x.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "1" → "uma", "2" → "duas" (concordância com "sessão"). */
function extensoFeminino(n: number) {
  const base = numeroPorExtenso(n);
  return base.replace(/\bum\b/g, "uma").replace(/\bdois\b/g, "duas").replace(/entos\b/g, "entas");
}

export function cityDate(profile: Profile | null, date = new Date()) {
  const longDate = date.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  return `${profile?.city ? `${profile.city}, ` : ""}${longDate}.`;
}

/** Variáveis do contrato preenchidas com o cadastro do paciente e as configurações da profissional. */
export function contractVars(p: Patient | undefined, prof: Profile | null): Record<string, string> {
  const g = p?.guardians?.[0];
  const a = p?.address ?? {};
  const freq = Number(p?.weekly_frequency ?? 0);
  const minutes = Number(prof?.session_minutes ?? 45);
  const aval = Number(p?.assessment_value ?? 0);
  const interv = Number(p?.session_value ?? 0);
  return {
    responsavel: v(g?.name),
    responsavel_cpf: v(g?.cpf),
    responsavel_rg: v(g?.rg),
    responsavel_telefone: v(g?.phone || p?.phones),
    responsavel_email: v(g?.email || p?.email),
    endereco_rua: v([a.street, a.number].filter(Boolean).join(", ")),
    endereco_bairro: v(a.district),
    endereco_cidade_uf: v([a.city, a.state].filter(Boolean).join("/")),
    endereco_cep: v(a.zip),
    frequencia: freq ? String(freq) : "__",
    frequencia_extenso: freq ? extensoFeminino(freq) : "______",
    sessao_plural: freq === 1 ? "sessão" : "sessões",
    duracao_sessao: String(minutes),
    duracao_extenso: numeroPorExtenso(minutes),
    valor_avaliacao: aval ? num(aval) : "__________",
    valor_avaliacao_extenso: aval ? reaisPorExtenso(aval) : "__________________",
    valor_intervencao: interv ? num(interv) : "__________",
    valor_intervencao_extenso: interv ? reaisPorExtenso(interv) : "__________________",
    profissional: v(prof?.professional_name),
    profissional_maiusculo: v(prof?.professional_name?.toLocaleUpperCase("pt-BR")),
    profissional_cpf: v(prof?.document),
    endereco_profissional: v(prof?.address),
    email_profissional: v(prof?.email),
    whatsapp: v(prof?.whatsapp || prof?.phone),
    cidade: v(prof?.city),
    uf: v(prof?.state),
    assinatura_titulo: v(prof?.signature_title || prof?.profession, ""),
    cidade_data: cityDate(prof),
    paciente: v(p?.name),
  };
}

/** Campos do cadastro que ainda faltam para o contrato ficar completo. */
export function missingContractFields(p: Patient, prof: Profile | null) {
  const g = p.guardians?.[0];
  const a = p.address ?? {};
  const out: string[] = [];
  if (!g?.name) out.push("nome do responsável");
  if (!g?.cpf) out.push("CPF do responsável");
  if (!g?.rg) out.push("RG do responsável");
  if (!a.street || !a.city) out.push("endereço");
  if (!p.weekly_frequency) out.push("sessões por semana");
  if (!p.assessment_value) out.push("valor da avaliação");
  if (!p.session_value) out.push("valor da intervenção");
  if (!prof?.document) out.push("seu CPF (Configurações)");
  return out;
}

export function contractContent(p: Patient, prof: Profile | null) {
  const tpl = prof?.templates?.contrato || DEFAULT_TEMPLATES.contrato;
  return fillTemplate(tpl, contractVars(p, prof));
}

/** Cria o contrato (rascunho editável) para um paciente recém-cadastrado. */
export async function createContract(store: DataStore, p: Patient, prof: Profile | null) {
  return store.insert("reports", {
    patient_id: p.id, type: "contrato", status: "rascunho",
    title: `Contrato — ${p.name}`, content: contractContent(p, prof),
  });
}

/* --------------------------------- Recibos -------------------------------- */

/** Datas de atendimento cobertas pelo pagamento (sessão vinculada ou atendimentos do mês de referência). */
export function serviceDates(tx: Transaction, appts: Appointment[]) {
  const toDate = (iso: string) => toISODate(new Date(iso));
  if (tx.appointment_id) {
    const a = appts.find((x) => x.id === tx.appointment_id);
    if (a) return [toDate(a.starts_at)];
  }
  const ref = monthKey(tx.due_date);
  return appts
    .filter((a) => a.patient_id === tx.patient_id && a.kind !== "bloqueio" && !["cancelado", "falta"].includes(a.status) && monthKey(new Date(a.starts_at)) === ref)
    .map((a) => toDate(a.starts_at))
    .sort();
}

export function receiptDescription(tx: Transaction, prof: Profile | null) {
  const tipo = tx.category === "Avaliação" ? "avaliação" : tx.category === "Devolutiva" ? "devolutiva" : "intervenção";
  const minutes = prof?.session_minutes ?? 45;
  return `Consultas neuropsicopedagógicas (${tipo}), com duração de ${minutes} minutos, realizadas nas datas de:`;
}

/**
 * Gera o recibo automaticamente quando uma entrada (receita) é marcada como paga.
 * Idempotente: não cria um segundo recibo para o mesmo lançamento.
 */
export async function ensureReceipt(store: DataStore, tx: Transaction, prof: Profile | null): Promise<Receipt | null> {
  if (tx.type !== "receita" || !tx.paid_at) return null;
  const existing = await store.list("receipts", { filter: { transaction_id: tx.id } });
  if (existing.length) return existing[0];
  const all = await store.list("receipts", { orderBy: "number" });
  const number = (all[0]?.number ?? 0) + 1;
  const patient = tx.patient_id ? await store.get("patients", tx.patient_id) : null;
  const appts = tx.patient_id ? await store.list("appointments", { filter: { patient_id: tx.patient_id } }) : [];
  const g = patient?.guardians?.[0];
  return store.insert("receipts", {
    number, transaction_id: tx.id, patient_id: tx.patient_id ?? null, issue_date: tx.paid_at, amount: Number(tx.amount),
    payer_name: g?.name || patient?.name || tx.description || "",
    payer_cpf: g?.cpf ?? "", payer_city: patient?.address?.city ?? "", payer_state: patient?.address?.state ?? "",
    payer_email: g?.email || patient?.email || "",
    description: receiptDescription(tx, prof),
    service_dates: serviceDates(tx, appts),
  });
}

export const receiptNumber = (n: number) => String(n).padStart(4, "0");
export const fmtServiceDate = (d: string) => formatDate(d);
export const isoToday = today;
export { parseDate };
