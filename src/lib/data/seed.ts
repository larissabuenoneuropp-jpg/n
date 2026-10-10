import type {
  Activity, Appointment, Assessment, AssessmentRecord, Instrument, Receipt, InterventionPlan, Patient, Profile, Report, SessionRecord, Transaction,
} from "@/lib/types";
import { addDays, toISODate, uid } from "@/lib/utils";
import { ACTIVITY_LIBRARY } from "./activities-library";
import { INSTRUMENT_LIBRARY } from "./instruments-library";
import { DEFAULT_TEMPLATES } from "@/lib/templates";
import { routineTasks } from "@/lib/tasks";
import type { ClinicTask, SocialPost } from "@/lib/types";

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
      guardians: [{ name: "Mariana Andrade", relation: "Mãe", phone: "(47) 98888-1234", email: "mariana@exemplo.com", cpf: "111.222.333-44", rg: "1.234.567" }],
      address: { street: "Rua das Palmeiras", number: "120", district: "Centro", city: "Balneário Camboriú", state: "SC", zip: "88330-000" },
      assessment_value: 250,
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
      guardians: [{ name: "Ricardo Martins", relation: "Pai", phone: "(47) 97777-5678", cpf: "222.333.444-55" }],
      address: { street: "Av. Brasil", number: "800", district: "Pioneiros", city: "Balneário Camboriú", state: "SC", zip: "88331-000" },
      assessment_value: 250,
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
      status: "ativo", guardians: [{ name: "Juliana Costa", relation: "Mãe", phone: "(47) 95555-8765", email: "juliana@exemplo.com", cpf: "333.444.555-66", rg: "7.654.321" }],
      address: { street: "Rua 1500", number: "45", district: "Centro", city: "Balneário Camboriú", state: "SC", zip: "88330-500" },
      assessment_value: 250,
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
  type SeedSession = { objs: Array<[string, string]>; acts: Array<[string, number, string]>; res?: Array<"atingido" | "parcial" | "nao_atingido"> };
  const seedSessions: SeedSession[] = [
    { objs: [["Consciência fonológica", "Identificar rimas em pares de palavras"], ["Consciência fonológica", "Segmentar palavras em sílabas"], ["Atenção", "Manter a atenção sustentada na tarefa por tempo progressivamente maior"]],
      acts: [["Caça-rimas com figuras", 15, "Cartões ilustrados"], ["Segmentação silábica com palmas", 10, "Fichas de palavras, tampinhas"], ["Jogo da memória de rimas", 15, "Pares de cartas"]], res: ["atingido", "atingido", "parcial"] },
    { objs: [["Escrita e ortografia", "Reduzir trocas de grafemas com sons semelhantes (p/b, t/d, f/v)"], ["Alfabetização", "Estabelecer correspondência grafema-fonema"], ["Alfabetização", "Combinar letras para formar sílabas simples (CV)"]],
      acts: [["Bingo de fonemas (p/b)", 20, "Cartelas, marcadores"], ["Leitura de sílabas no alfabeto móvel", 15, "Alfabeto móvel"]], res: ["atingido", "parcial", "parcial"] },
    { objs: [["Leitura e compreensão", "Ler palavras regulares com precisão"], ["Leitura e compreensão", "Aumentar a fluência leitora"], ["Leitura e compreensão", "Responder perguntas literais sobre o texto"]],
      acts: [["Leitura compartilhada com pistas visuais", 20, "Texto curto, régua colorida"], ["Mapa da história", 15, "Folha A3, canetas"]] },
    { objs: [["Escrita e ortografia", "Escrever palavras sob ditado com correspondência adequada"], ["Escrita e ortografia", "Revisar a própria escrita com apoio de checklist"], ["Atenção", "Concluir as tarefas iniciadas"]],
      acts: [["Ditado mudo com imagens", 15, "Folha com figuras"], ["Traçado em bandeja sensorial (f/v)", 10, "Bandeja com sal"], ["Produção de frases", 15, "Cartões de frases"]] },
  ];
  const schedule = seedSessions.map((ss, i) => {
    const objectives = ss.objs.map(([area, text], j) => ({ id: uid(), area, text, status: ss.res?.[j] ?? null }));
    const activity_list = ss.acts.map(([title, duration_min, materials]) => ({ id: uid(), title, duration_min, materials, done: Boolean(ss.res) }));
    return {
      id: uid(), number: i + 1, objective: ss.objs.map((o) => o[1]).join("; "), activities: ss.acts.map((a) => a[0]).join("\n"), objectives, activity_list, attachments: [],
      materials: "Cartões, alfabeto móvel, textos curtos", duration_min: 45,
      strategies: "Instrução explícita, modelagem, reforço positivo, apoio multissensorial",
      success_criteria: "Acertar ao menos 80% dos itens com apoio mínimo", done: i < 2, record: i < 2 ? "Realizada" : "",
    };
  });
  const plans: InterventionPlan[] = [
    {
      id: plan1, patient_id: p1, title: "Plano de intervenção — leitura e escrita", status: "ativo", start_date: yearsAgo(0, 3),
      general_objective: "Desenvolver habilidades de leitura e escrita compatíveis com o ano escolar.",
      areas: [
        { id: uid(), area: "Consciência fonológica", objectives: [{ id: uid(), text: "Identificar rimas em pares de palavras" }, { id: uid(), text: "Segmentar palavras em sílabas" }] },
        { id: uid(), area: "Alfabetização", objectives: [{ id: uid(), text: "Estabelecer correspondência grafema-fonema" }, { id: uid(), text: "Combinar letras para formar sílabas simples (CV)" }] },
        { id: uid(), area: "Leitura e compreensão", objectives: [{ id: uid(), text: "Ler palavras regulares com precisão" }, { id: uid(), text: "Aumentar a fluência leitora" }] },
        { id: uid(), area: "Escrita e ortografia", objectives: [{ id: uid(), text: "Reduzir trocas de grafemas com sons semelhantes (p/b, t/d, f/v)" }] },
        { id: uid(), area: "Atenção", objectives: [{ id: uid(), text: "Manter a atenção sustentada na tarefa por tempo progressivamente maior" }] },
      ],
      specific_objectives: [
        { id: uid(), text: "Consciência fonológica: Identificar rimas em pares de palavras" },
        { id: uid(), text: "Alfabetização: Estabelecer correspondência grafema-fonema" },
        { id: uid(), text: "Leitura e compreensão: Aumentar a fluência leitora" },
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

  const paidWithPatient = transactions.filter((t) => t.type === "receita" && t.paid_at && t.patient_id).sort((a, b) => a.paid_at!.localeCompare(b.paid_at!));
  const receipts: Receipt[] = paidWithPatient.map((t, i) => {
    const pt = patients.find((x) => x.id === t.patient_id)!;
    const g = pt.guardians[0];
    const ref = t.due_date.slice(0, 7);
    return {
      id: uid(), number: i + 1, transaction_id: t.id, patient_id: pt.id, issue_date: t.paid_at!, amount: t.amount,
      payer_name: g.name, payer_cpf: g.cpf ?? "", payer_city: pt.address?.city ?? "", payer_state: pt.address?.state ?? "", payer_email: g.email ?? "",
      description: "Consultas neuropsicopedagógicas (intervenção), com duração de 45 minutos, realizadas nas datas de:",
      service_dates: appointments.filter((a) => a.patient_id === pt.id && a.starts_at.slice(0, 7) === ref && a.status !== "cancelado").map((a) => iso(new Date(a.starts_at))).sort(),
    };
  });

  const activities: Activity[] = ACTIVITY_LIBRARY.map((a, i) => ({ ...a, id: uid(), favorite: i < 3 }));

  const reports: Report[] = [];
  const social_posts: SocialPost[] = [
    {
      id: uid(), title: "5 sinais de dificuldade na leitura", format: "carrossel", theme: "Dislexia / leitura", audience: "Pais", goal: "Captar pacientes",
      status: "publicado", published_at: iso(addDays(now, -20)),
      content: {
        hook: "Seu filho lê devagar e troca letras? Pode não ser preguiça.",
        slides: [
          { title: "Pode não ser preguiça", text: "Algumas crianças se esforçam muito e, mesmo assim, a leitura não flui." },
          { title: "Sinais de atenção", text: "Leitura silabada, trocas como p/b e f/v, cansaço ao ler e fuga das tarefas." },
          { title: "O que fazer", text: "Uma avaliação neuropsicopedagógica ajuda a entender como a criança aprende." },
          { title: "Vamos conversar?", text: "Agende uma conversa pelo WhatsApp do perfil." },
        ],
        caption: "Ler com dificuldade não é falta de vontade. 💛 Quando a leitura cansa, a criança precisa de um olhar cuidadoso.", hashtags: ["#neuropsicopedagogia", "#dislexia", "#leitura"], cta: "Agende pelo WhatsApp",
      },
      metrics: { reach: 1840, likes: 132, comments: 14, saves: 61, shares: 38 },
    },
    {
      id: uid(), title: "Rotina visual para crianças com TDAH", format: "reels", theme: "TDAH / atenção", audience: "Pais", goal: "Educar",
      status: "publicado", published_at: iso(addDays(now, -9)),
      content: {
        hook: "3 minutos que mudam a manhã da sua casa", slides: [],
        caption: "Rotina visual: simples, barata e funciona para muitas famílias.", hashtags: ["#tdah", "#rotina"], cta: "Salve para testar amanhã",
        reels: { duration_s: 30, audio_suggestion: "Áudio calmo em alta", scenes: [{ time: "0–3s", visual: "Quadro de rotina", on_screen_text: "Manhãs caóticas?", voiceover: "Se as manhãs na sua casa são uma correria..." }] },
      },
      metrics: { views: 5200, reach: 3900, likes: 210, comments: 22, saves: 140, shares: 95 },
    },
    {
      id: uid(), title: "Bastidores do consultório", format: "post", theme: "Institucional", audience: "Pais", goal: "Autoridade",
      status: "publicado", published_at: iso(addDays(now, -30)),
      content: { hook: "Um espaço pensado para aprender brincando", slides: [], caption: "Cada material tem um porquê.", hashtags: ["#neuropsicopedagoga"], cta: "Conheça o espaço" },
      metrics: { reach: 900, likes: 70, comments: 5, saves: 6, shares: 2 },
    },
  ];
  const tasks: ClinicTask[] = routineTasks(now).map((t) => ({ ...(t as ClinicTask), id: uid() }));

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

  // Perfil de demonstração com os dados públicos de contato da identidade visual.
  // CPF fica em branco de propósito: preencha em Configurações (não versionamos documentos pessoais).
  const profile: Profile = {
    id: "demo", professional_name: "Larissa Rodrigues Bueno", clinic_name: "Larissa Bueno", profession: "Neuropsicopedagoga",
    signature_title: "Professora e Neuropsicopedagoga", cbo: "2394-40", crnpp: "", document: "",
    pix_key: "", phone: "(47) 9 9692-1817", whatsapp: "(47) 9 9692-1817", instagram: "@npp.larissabueno",
    email: "larissabuenopedagoga@gmail.com", address: "Rua 500, nº 550, Centro, Balneário Camboriú - SC",
    city: "Balneário Camboriú", state: "SC", default_session_value: 180,
    work_start: "08:00", work_end: "19:00", session_minutes: 45, templates: DEFAULT_TEMPLATES,
  };

  return {
    patients, assessments, intervention_plans: plans, appointments, session_records: sessions,
    activities, documents: [], transactions, reports, profile, instruments, assessment_records, receipts, tasks, social_posts, charge_messages: [] as import("@/lib/types").ChargeMessage[],
  };
}
