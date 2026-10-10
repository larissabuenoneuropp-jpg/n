import type {
  Activity, Appointment, Assessment, AssessmentRecord, Instrument, InterventionPlan, Patient, Profile, Report, SessionRecord, Transaction,
} from "@/lib/types";
import { addDays, toISODate, uid } from "@/lib/utils";
import { ACTIVITY_LIBRARY } from "./activities-library";
import { INSTRUMENT_LIBRARY } from "./instruments-library";
import { DEFAULT_TEMPLATES } from "@/lib/templates";

/** Dados fictícios para o modo demonstração. */
export function buildSeed() {
  const now = new Date();
  const iso = (d: Date) => toISODate(d);
  const yearsAgo = (y: number, m = 0, extraDays = 0) => {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - y);
    d.setMonth(d.getMonth() - m);
    d.setDate(d.getDate() + extraDays);
    return iso(d);
  };

  const p1 = uid(), p2 = uid(), p3 = uid(), p4 = uid();
  const patients: Patient[] = [
    {
      id: p1, name: "Lucas Andrade", birth_date: yearsAgo(8, 3), status: "ativo",
      guardians: [{ name: "Mariana Andrade", relation: "Mãe", phone: "(11) 98888-1234", email: "mariana@exemplo.com" }],
      phones: "(11) 98888-1234", email: "mariana@exemplo.com", school: "EMEF Monteiro Lobato", grade: "3º ano", teacher: "Prof.ª Cláudia",
      diagnosis: "", hypotheses: "Dislexia do desenvolvimento", referred_by: "Escola", payment_type: "particular",
      session_value: 180, weekly_frequency: 2, start_date: yearsAgo(0, 4), general_goals: "Desenvolver consciência fonológica e fluência leitora.",
      notes: "Gosta de dinossauros e futebol.",
      anamnesis: {
        complaints: "Troca letras na escrita (p/b, f/v), leitura silabada e lenta para a idade.",
        history: "Gestação e parto sem intercorrências. Fala com atraso leve (primeiras frases aos 2a6m).",
        school_history: "Dificuldade de alfabetização desde o 1º ano; reforço escolar sem grande evolução.",
        family_history: "Pai relata dificuldades semelhantes na infância.",
        medications: "Nenhuma.", professionals: "Fonoaudióloga (2022–2023).",
      },
      cognitive_profile: "Bom raciocínio verbal oral; memória operacional fonológica reduzida.",
      behavioral_profile: "Colaborativo, mas evita tarefas de leitura.",
      skills: "Oralidade, criatividade, raciocínio lógico", difficulties: "Decodificação, ortografia, velocidade de leitura",
    },
    {
      id: p2, name: "Sofia Martins", birth_date: yearsAgo(6, 0, -2), status: "ativo",
      guardians: [{ name: "Ricardo Martins", relation: "Pai", phone: "(11) 97777-5678" }],
      phones: "(11) 97777-5678", school: "Colégio Aurora", grade: "1º ano", teacher: "Prof.ª Renata",
      diagnosis: "TEA nível 1 de suporte", hypotheses: "", referred_by: "Neuropediatra", payment_type: "convenio",
      insurance_name: "Saúde Mais", session_value: 140, weekly_frequency: 2, start_date: yearsAgo(1),
      general_goals: "Ampliar flexibilidade cognitiva, habilidades sociais e pré-requisitos de alfabetização.",
      anamnesis: { complaints: "Rigidez em rotinas, dificuldade em atividades em grupo.", medications: "Nenhuma." },
      cognitive_profile: "Memória visual destacada; interesse restrito por planetas.",
      behavioral_profile: "Sensibilidade auditiva; desregulação em transições.",
      skills: "Memória visual, vocabulário", difficulties: "Flexibilidade, interação com pares, coordenação fina",
    },
    {
      id: p3, name: "Pedro Henrique Lima", birth_date: yearsAgo(10, 7), status: "ativo",
      guardians: [{ name: "Ana Lima", relation: "Mãe", phone: "(11) 96666-4321" }],
      phones: "(11) 96666-4321", school: "EE Santos Dumont", grade: "5º ano", teacher: "Prof. Marcos",
      diagnosis: "TDAH (apresentação combinada)", referred_by: "Pediatra", payment_type: "particular",
      session_value: 200, weekly_frequency: 1, start_date: yearsAgo(0, 8),
      general_goals: "Desenvolver funções executivas e estratégias de organização para estudo.",
      anamnesis: { complaints: "Desorganização, esquece tarefas, dificuldade em manter atenção.", medications: "Metilfenidato (prescrição médica)." },
      skills: "Raciocínio matemático, esportes", difficulties: "Planejamento, atenção sustentada, controle inibitório",
    },
    {
      id: p4, name: "Helena Costa", birth_date: (() => { const d = new Date(now); d.setFullYear(d.getFullYear() - 7); d.setDate(d.getDate() + 3); return iso(d); })(),
      status: "ativo", guardians: [{ name: "Juliana Costa", relation: "Mãe", phone: "(11) 95555-8765" }],
      phones: "(11) 95555-8765", school: "Escola Viva", grade: "2º ano", teacher: "Prof.ª Bia",
      hypotheses: "Dificuldade de aprendizagem em matemática (investigar discalculia)", referred_by: "Escola",
      payment_type: "particular", session_value: 180, weekly_frequency: 1, start_date: yearsAgo(0, 1),
      general_goals: "Investigação diagnóstica.", anamnesis: { complaints: "Não reconhece quantidades, conta nos dedos." },
    },
  ];

  const a1 = uid();
  const assessments: Assessment[] = [
    {
      id: a1, patient_id: p4, title: "Avaliação neuropsicopedagógica inicial", status: "em_andamento",
      objective: "Investigar habilidades matemáticas, senso numérico e funções cognitivas associadas.",
      hypotheses: "Discalculia do desenvolvimento; déficit de memória operacional.", start_date: yearsAgo(0, 0, -14),
      instruments: [
        { id: uid(), name: "EOCA", status: "corrigido", session: 1 },
        { id: uid(), name: "Provas Operatórias", status: "aplicado", session: 2 },
        { id: uid(), name: "Cubos de Corsi", status: "planejado", session: 3 },
        { id: uid(), name: "TAC", status: "planejado", session: 3 },
      ],
      checklist: [
        { id: uid(), label: "Anamnese realizada com responsáveis", done: true },
        { id: uid(), label: "Termo de consentimento assinado", done: true },
        { id: uid(), label: "Contato com a escola", done: false },
        { id: uid(), label: "Devolutiva agendada", done: false },
      ],
      sessions_plan: [], clinical_notes: "Demonstra ansiedade diante de tarefas com números.",
    },
  ];

  const plan1 = uid();
  const schedule = [
    ["Fortalecer consciência fonológica (rimas e sílabas)", "Caça-rimas com figuras; segmentação silábica com palmas"],
    ["Correspondência grafema-fonema para pares surdos/sonoros", "Bingo de fonemas com foco em p/b, t/d"],
    ["Ampliar fluência leitora", "Leitura compartilhada com régua de leitura"],
    ["Ortografia: trocas f/v", "Ditado mudo com imagens"],
  ].map(([objective, activities], i) => ({
    id: uid(), number: i + 1, objective, activities, materials: "Cartões, alfabeto móvel, textos curtos",
    duration_min: 50, strategies: "Instrução explícita, modelagem, reforço positivo, apoio multissensorial",
    success_criteria: "Acertar ao menos 80% dos itens com apoio mínimo", done: i < 2, record: i < 2 ? "Realizada" : "",
  }));
  const plans: InterventionPlan[] = [
    {
      id: plan1, patient_id: p1, title: "Plano de intervenção — leitura e escrita", status: "ativo", start_date: yearsAgo(0, 3),
      general_objective: "Desenvolver habilidades de leitura e escrita compatíveis com o ano escolar.",
      specific_objectives: [
        { id: uid(), text: "Ampliar consciência fonológica (nível silábico e fonêmico)." },
        { id: uid(), text: "Reduzir trocas de pares surdos/sonoros na escrita." },
        { id: uid(), text: "Aumentar a fluência leitora." },
      ],
      goals: [{ id: uid(), text: "Ler 60 palavras por minuto em texto do nível até o fim do semestre." }],
      progress_criteria: "Registros de sessão, escalas de progresso e reavaliação a cada 3 meses.", schedule,
    },
    {
      id: uid(), patient_id: p3, title: "Plano de funções executivas", status: "ativo", start_date: yearsAgo(0, 6),
      general_objective: "Desenvolver planejamento, organização e autorregulação.",
      specific_objectives: [{ id: uid(), text: "Usar agenda e checklist para tarefas escolares." }],
      goals: [{ id: uid(), text: "Entregar 90% das tarefas no prazo por 4 semanas." }],
      progress_criteria: "Relato da família/escola e registros.", schedule: [],
    },
  ];

  // Agenda: sessões recorrentes nesta semana e na próxima
  const appointments: Appointment[] = [];
  const mk = (day: Date, h: number, m: number, patient: string, kind: Appointment["kind"] = "atendimento", status: Appointment["status"] = "agendado") => {
    const s = new Date(day); s.setHours(h, m, 0, 0);
    const e = new Date(s); e.setMinutes(e.getMinutes() + 50);
    appointments.push({ id: uid(), patient_id: patient, kind, starts_at: s.toISOString(), ends_at: e.toISOString(), status });
  };
  for (let offset = -7; offset <= 14; offset++) {
    const d = addDays(now, offset);
    const wd = d.getDay();
    const past = offset < 0;
    if (wd === 1 || wd === 3) mk(d, 14, 0, p1, "atendimento", past ? "realizado" : offset === 0 ? "confirmado" : "agendado");
    if (wd === 2 || wd === 4) mk(d, 9, 0, p2, "atendimento", past ? "realizado" : "agendado");
    if (wd === 5) mk(d, 16, 0, p3, "atendimento", past ? "realizado" : "agendado");
    if (wd === 3) mk(d, 10, 0, p4, "avaliacao", past ? "realizado" : "agendado");
  }
  // Garantir atendimentos hoje
  mk(now, 15, 0, p2, "atendimento", "confirmado");
  mk(now, 17, 0, p4, "avaliacao", "agendado");
  const block = new Date(now); block.setHours(12, 0, 0, 0);
  const blockEnd = new Date(block); blockEnd.setHours(13, 0, 0, 0);
  appointments.push({ id: uid(), kind: "bloqueio", title: "Almoço", starts_at: block.toISOString(), ends_at: blockEnd.toISOString(), status: "agendado" });

  const sessions: SessionRecord[] = [1, 2, 3].map((n) => ({
    id: uid(), patient_id: p1, plan_id: plan1, date: iso(addDays(now, -n * 4)), start_time: "14:00",
    objective: n === 3 ? "Consciência fonológica: rimas" : "Correspondência grafema-fonema (p/b)",
    activities: n === 3 ? "Caça-rimas com figuras" : "Bingo de fonemas",
    materials: "Cartões ilustrados", child_response: n === 1 ? "Identificou 8/10 pares com apoio mínimo." : "Precisou de modelagem frequente.",
    behavior: "Engajado nos primeiros 30 min; cansaço ao final.",
    parent_guidance: "Ler 10 min por dia com apontamento.", next_plan: "Introduzir pares t/d.",
    clinical_evolution: n === 1 ? "Evolução consistente na discriminação p/b." : "Em desenvolvimento.",
    progress: { attention: 3 + (n === 1 ? 1 : 0), engagement: 4, autonomy: 2 + (3 - n), goal_achievement: 2 + (3 - n) },
    attachments: [],
  }));

  // Financeiro: 6 meses
  const transactions: Transaction[] = [];
  for (let m = 5; m >= 0; m--) {
    const base = new Date(now.getFullYear(), now.getMonth() - m, 5);
    const due = iso(base);
    const paid = m > 0 || now.getDate() > 5;
    transactions.push(
      { id: uid(), type: "receita", category: "Mensalidade", patient_id: p1, description: "Mensalidade — Lucas", amount: 1440, due_date: due, paid_at: paid ? due : null, method: "PIX" },
      { id: uid(), type: "receita", category: "Sessão", patient_id: p2, description: "Sessões convênio — Sofia", amount: 1120, due_date: iso(new Date(base.getFullYear(), base.getMonth(), 15)), paid_at: m > 0 ? iso(new Date(base.getFullYear(), base.getMonth(), 20)) : null, method: "Transferência" },
      { id: uid(), type: "receita", category: "Mensalidade", patient_id: p3, description: "Mensalidade — Pedro", amount: 800, due_date: due, paid_at: m === 1 ? null : paid ? due : null, method: "PIX" },
      { id: uid(), type: "despesa", category: "Aluguel", description: "Aluguel da sala", amount: 1200, due_date: iso(new Date(base.getFullYear(), base.getMonth(), 10)), paid_at: iso(new Date(base.getFullYear(), base.getMonth(), 10)) },
      { id: uid(), type: "despesa", category: "Materiais", description: "Materiais pedagógicos", amount: 150 + m * 20, due_date: iso(new Date(base.getFullYear(), base.getMonth(), 12)), paid_at: iso(new Date(base.getFullYear(), base.getMonth(), 12)) },
    );
  }
  transactions.push({ id: uid(), type: "receita", category: "Avaliação", patient_id: p4, description: "Avaliação — Helena (1/2)", amount: 900, due_date: iso(addDays(now, -10)), paid_at: null, method: "PIX" });

  const activities: Activity[] = ACTIVITY_LIBRARY.map((a, i) => ({ ...a, id: uid(), favorite: i < 3 }));

  const reports: Report[] = [];

  const instruments: Instrument[] = INSTRUMENT_LIBRARY.map((i) => ({ ...i, id: uid(), favorite: false }));
  const confias = instruments.find((i) => i.name === "CONFIAS")!;
  const corsi = instruments.find((i) => i.name === "Cubos de Corsi")!;
  // Lucas: aplicações inicial e reavaliações para demonstrar a quantificação da evolução
  const assessment_records: AssessmentRecord[] = [
    { phase: "inicial" as const, m: 4, s: 6, f: 3, d: 3, i: 2 },
    { phase: "intermediaria" as const, m: 2, s: 8, f: 6, d: 4, i: 2 },
    { phase: "reavaliacao" as const, m: 0, s: 10, f: 9, d: 5, i: 3 },
  ].flatMap((r): AssessmentRecord[] => {
    const date = (() => { const d = new Date(now); d.setMonth(d.getMonth() - r.m); return iso(d); })();
    return [
      {
        id: uid(), patient_id: p1, instrument_id: confias.id, instrument_name: "CONFIAS", date, phase: r.phase,
        scores: { silaba: r.s, fonema: r.f, total: r.s + r.f }, ai_assisted: false,
        behavior: r.phase === "inicial" ? "Inseguro, pedia confirmação a cada item." : "Mais autônomo, autocorrige-se.",
        clinical_record: `${{ inicial: "Avaliação inicial", intermediaria: "Aplicação intermediária", reavaliacao: "Reavaliação" }[r.phase]}: desempenho no nível da sílaba (${r.s}) e do fonema (${r.f}).`,
      },
      {
        id: uid(), patient_id: p1, instrument_id: corsi.id, instrument_name: "Cubos de Corsi", date, phase: r.phase,
        scores: { span_direto: r.d, span_inverso: r.i }, clinical_record: `Span direto ${r.d}, inverso ${r.i}.`,
      },
    ];
  });

  const profile: Profile = {
    id: "demo", professional_name: "Dra. Camila Souza", clinic_name: "Espaço Aprender", profession: "Neuropsicopedagoga",
    crnpp: "0000/SP", document: "000.000.000-00", pix_key: "camila@exemplo.com", phone: "(11) 90000-0000",
    email: "contato@exemplo.com", address: "Rua das Flores, 100 — São Paulo/SP", default_session_value: 180,
    work_start: "08:00", work_end: "19:00", session_minutes: 50, templates: DEFAULT_TEMPLATES,
  };

  return {
    patients, assessments, intervention_plans: plans, appointments, session_records: sessions,
    activities, documents: [], transactions, reports, profile, instruments, assessment_records,
  };
}
