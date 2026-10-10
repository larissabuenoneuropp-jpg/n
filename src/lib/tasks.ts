// Tarefas de gestão da clínica: rotina sugerida e pendências detectadas automaticamente.
import type { Appointment, Assessment, ChargeMessage, ClinicTask, InterventionPlan, Patient, Profile, Receipt, Report, SessionRecord, TaskPriority, Transaction } from "@/lib/types";
import { addDays, monthKey, parseDate, toISODate } from "@/lib/utils";
import { missingContractFields } from "@/lib/documents";

export const PRIORITY: Record<TaskPriority, { label: string; tone: "red" | "amber" | "blue" | "gray"; order: number }> = {
  urgente: { label: "Urgente", tone: "red", order: 0 },
  alta: { label: "Alta", tone: "amber", order: 1 },
  media: { label: "Média", tone: "blue", order: 2 },
  baixa: { label: "Baixa", tone: "gray", order: 3 },
};

export const TASK_CATEGORIES = ["Financeiro", "Clínico", "Documentos", "Agenda", "Administrativo", "Estrutura e materiais", "Formação", "Marketing"];

export const RECURRENCE_LABEL: Record<ClinicTask["recurrence"], string> = {
  nenhuma: "Não repete", semanal: "Semanal", mensal: "Mensal", semestral: "Semestral", anual: "Anual",
};

type Template = Pick<ClinicTask, "title" | "description" | "priority" | "category" | "recurrence"> & { inDays: number };

/** Rotina sugerida de gestão (baseada também nas cláusulas do contrato da profissional). Tudo editável. */
export const ROUTINE_TEMPLATES: Template[] = [
  { title: "Conferir pagamentos e cobrar pendências", description: "Ver Financeiro → em atraso. Enviar lembrete educado pelo WhatsApp. Contrato: suspensão após 4 sessões inadimplentes (cláusula 5).", priority: "alta", category: "Financeiro", recurrence: "semanal", inDays: 1 },
  { title: "Confirmar atendimentos da semana", description: "Enviar confirmações pela Agenda e ajustar faltas/reagendamentos.", priority: "alta", category: "Agenda", recurrence: "semanal", inDays: 0 },
  { title: "Registrar sessões pendentes", description: "Todo atendimento realizado deve ter registro clínico no prontuário.", priority: "alta", category: "Clínico", recurrence: "semanal", inDays: 2 },
  { title: "Planejar as sessões da próxima semana", description: "Revisar objetivos e atividades no plano de intervenção de cada paciente.", priority: "media", category: "Clínico", recurrence: "semanal", inDays: 4 },
  { title: "Fechamento financeiro do mês", description: "Conferir entradas e saídas, exportar Excel e guardar comprovantes de despesas.", priority: "alta", category: "Financeiro", recurrence: "mensal", inDays: 20 },
  { title: "Gerar mensalidades do mês", description: "Financeiro → Gerar mensalidades (pacientes particulares ativos).", priority: "media", category: "Financeiro", recurrence: "mensal", inDays: 21 },
  { title: "Exportar backup dos dados", description: "Configurações → Segurança e LGPD → Exportar meus dados. Guardar em local seguro.", priority: "media", category: "Administrativo", recurrence: "mensal", inDays: 25 },
  { title: "Repor e organizar materiais pedagógicos", description: "Verificar folhas de registro, jogos e materiais de consumo.", priority: "baixa", category: "Estrutura e materiais", recurrence: "mensal", inDays: 14 },
  { title: "Reuniões semestrais com as famílias", description: "Contrato, cláusula 2.5: reunião a cada 6 meses para apresentar o desenvolvimento.", priority: "media", category: "Clínico", recurrence: "semestral", inDays: 30 },
  { title: "Atualizar planos individuais (semestral)", description: "Contrato, cláusula 2.6: atualizar o plano com base em protocolos e avaliações.", priority: "media", category: "Clínico", recurrence: "semestral", inDays: 35 },
  { title: "Reajuste anual de valores (IGPM — julho)", description: "Contrato, cláusula 4.6: calcular o reajuste pelo IGPM (FGV) e comunicar as famílias com antecedência.", priority: "media", category: "Financeiro", recurrence: "anual", inDays: 60 },
  { title: "Revisar contratos e termos (LGPD)", description: "Conferir se todos os pacientes ativos têm contrato assinado e consentimento registrado.", priority: "media", category: "Documentos", recurrence: "semestral", inDays: 10 },
  { title: "Formação continuada", description: "Reservar horário para estudo, supervisão ou curso.", priority: "baixa", category: "Formação", recurrence: "mensal", inDays: 12 },
  { title: "Divulgação / conteúdo para redes sociais", description: "Planejar publicações da semana (sem expor pacientes).", priority: "baixa", category: "Marketing", recurrence: "semanal", inDays: 3 },
];

export function routineTasks(base = new Date()): Partial<ClinicTask>[] {
  return ROUTINE_TEMPLATES.map(({ inDays, ...t }) => ({ ...t, status: "a_fazer", due_date: toISODate(addDays(base, inDays)) }));
}

/** Próxima data de uma tarefa recorrente. */
export function nextDue(due: string | null | undefined, recurrence: ClinicTask["recurrence"]) {
  const d = due ? parseDate(due) : new Date();
  if (recurrence === "semanal") return toISODate(addDays(d, 7));
  if (recurrence === "mensal") return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, d.getDate()));
  if (recurrence === "semestral") return toISODate(new Date(d.getFullYear(), d.getMonth() + 6, d.getDate()));
  if (recurrence === "anual") return toISODate(new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()));
  return null;
}

export interface AutoPending {
  key: string;
  title: string;
  description: string;
  priority: TaskPriority;
  category: string;
  patient_id?: string;
  href: string;
}

/** Pendências detectadas a partir dos dados da clínica (atualizadas em tempo real). */
export function detectPending(d: {
  patients: Patient[]; transactions: Transaction[]; appointments: Appointment[]; sessions: SessionRecord[];
  assessments: Assessment[]; plans: InterventionPlan[]; reports: Report[]; receipts: Receipt[]; profile: Profile | null;
  charges?: ChargeMessage[];
}): AutoPending[] {
  const out: AutoPending[] = [];
  const today = toISODate(new Date());
  const name = (id?: string | null) => d.patients.find((p) => p.id === id)?.name ?? "";
  const active = d.patients.filter((p) => p.status === "ativo");

  // Cobranças aguardando aprovação
  const toApprove = (d.charges ?? []).filter((m) => m.status === "pendente").length;
  if (toApprove) out.push({ key: "aprovar-cobrancas", title: `Aprovar ${toApprove} mensagem(ns) de cobrança`, description: "Mensagens de WhatsApp/e-mail preparadas pelas datas de vencimento. Só são enviadas depois da sua aprovação.", priority: "urgente", category: "Financeiro", href: "/cobrancas" });

  // Financeiro: atrasos
  const overdue = d.transactions.filter((t) => t.type === "receita" && !t.paid_at && t.due_date < today);
  const byPatient = new Map<string, number>();
  overdue.forEach((t) => byPatient.set(t.patient_id ?? "", (byPatient.get(t.patient_id ?? "") ?? 0) + Number(t.amount)));
  byPatient.forEach((total, pid) => {
    out.push({
      key: `atraso:${pid}`, title: `Cobrar pagamento em atraso${pid ? ` — ${name(pid)}` : ""}`,
      description: `R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em aberto.`, priority: "urgente", category: "Financeiro",
      patient_id: pid || undefined, href: pid ? `/pacientes/${pid}?tab=financeiro` : "/financeiro",
    });
  });

  // Contratos
  active.forEach((p) => {
    const c = d.reports.find((r) => r.patient_id === p.id && r.type === "contrato");
    if (!c) out.push({ key: `contrato:${p.id}`, title: `Gerar contrato — ${p.name}`, description: "Paciente ativo sem contrato.", priority: "alta", category: "Documentos", patient_id: p.id, href: `/pacientes/${p.id}` });
    else if (c.status === "rascunho") {
      const missing = missingContractFields(p, d.profile);
      out.push({
        key: `contrato-assinar:${p.id}`, title: `Finalizar e colher assinatura do contrato — ${p.name}`,
        description: missing.length ? `Faltam: ${missing.join(", ")}.` : "Contrato em rascunho: revisar, imprimir e marcar como finalizado.",
        priority: missing.length ? "alta" : "media", category: "Documentos", patient_id: p.id, href: `/relatorios?id=${c.id}`,
      });
    }
  });

  // Sessões realizadas sem registro
  const realized = d.appointments.filter((a) => a.status === "realizado" && a.patient_id && a.kind !== "bloqueio");
  const missingRecords = realized.filter((a) => !d.sessions.some((s) => s.appointment_id === a.id || (s.patient_id === a.patient_id && s.date === toISODate(new Date(a.starts_at)))));
  const perPatient = new Map<string, number>();
  missingRecords.forEach((a) => perPatient.set(a.patient_id!, (perPatient.get(a.patient_id!) ?? 0) + 1));
  perPatient.forEach((n, pid) => out.push({
    key: `registro:${pid}`, title: `Registrar ${n} sessão(ões) realizada(s) — ${name(pid)}`, description: "Atendimentos marcados como realizados sem registro clínico.",
    priority: "alta", category: "Clínico", patient_id: pid, href: `/pacientes/${pid}?tab=sessoes`,
  }));

  // Agenda: atendimentos dos próximos 2 dias ainda não confirmados
  const soon = d.appointments.filter((a) => a.status === "agendado" && a.kind !== "bloqueio" && new Date(a.starts_at) > new Date() && new Date(a.starts_at) < addDays(new Date(), 2));
  if (soon.length) out.push({ key: "confirmar", title: `Confirmar ${soon.length} atendimento(s) das próximas 48h`, description: "Envie a confirmação pela Agenda.", priority: "alta", category: "Agenda", href: "/agenda" });

  // Avaliações: instrumentos aplicados sem correção / avaliação longa
  d.assessments.filter((a) => a.status === "em_andamento").forEach((a) => {
    const toCorrect = a.instruments.filter((i) => i.status === "aplicado").length;
    if (toCorrect) out.push({ key: `corrigir:${a.id}`, title: `Corrigir ${toCorrect} instrumento(s) — ${name(a.patient_id)}`, description: a.title, priority: "media", category: "Clínico", patient_id: a.patient_id, href: `/pacientes/${a.patient_id}?tab=avaliacoes` });
  });

  // Planos: revisão semestral
  d.plans.filter((p) => p.status === "ativo" && p.start_date).forEach((p) => {
    const review = new Date(parseDate(p.start_date!).getFullYear(), parseDate(p.start_date!).getMonth() + 6, parseDate(p.start_date!).getDate());
    if (review <= addDays(new Date(), 15)) out.push({
      key: `revisao:${p.id}`, title: `Revisão semestral do plano — ${name(p.patient_id)}`, description: `${p.title}: revisar objetivos e agendar reunião com a família.`,
      priority: review < new Date() ? "alta" : "media", category: "Clínico", patient_id: p.patient_id, href: `/pacientes/${p.patient_id}?tab=intervencao`,
    });
  });

  // Mensalidades do mês não geradas
  const thisMonth = monthKey(new Date());
  const withoutFee = active.filter((p) => p.payment_type === "particular" && !d.transactions.some((t) => t.patient_id === p.id && monthKey(t.due_date) === thisMonth));
  if (withoutFee.length) out.push({ key: `mensalidades:${thisMonth}`, title: `Lançar cobranças do mês (${withoutFee.length} paciente(s))`, description: withoutFee.map((p) => p.name).join(", "), priority: "media", category: "Financeiro", href: "/financeiro" });

  // Cadastro incompleto
  if (!d.profile?.document) out.push({ key: "perfil-cpf", title: "Preencher seu CPF/CNPJ em Configurações", description: "Necessário para o contrato.", priority: "alta", category: "Administrativo", href: "/configuracoes" });

  return out.sort((a, b) => PRIORITY[a.priority].order - PRIORITY[b.priority].order);
}
