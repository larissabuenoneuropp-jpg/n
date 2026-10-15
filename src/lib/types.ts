// Tipos de domínio — espelham as tabelas em supabase/migrations/0001_init.sql

export type ID = string;

interface Base {
  id: ID;
  owner_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Guardian {
  name: string;
  relation: string;
  phone: string;
  email?: string;
  cpf?: string;
  rg?: string;
}

export interface Address {
  street?: string;
  number?: string;
  district?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface Anamnesis {
  /** "Jeito de ser da criança, segundo a família" (RAN, seção 5). */
  personality?: string;
  history?: string;
  complaints?: string;
  development?: string;
  school_history?: string;
  family_history?: string;
  medications?: string;
  professionals?: string;
  health?: string;
}

export type PatientStatus = "ativo" | "inativo" | "alta";

export interface Patient extends Base {
  name: string;
  photo_url?: string | null;
  birth_date?: string | null;
  guardians: Guardian[];
  phones?: string;
  email?: string;
  school?: string;
  grade?: string;
  teacher?: string;
  diagnosis?: string;
  hypotheses?: string;
  referred_by?: string;
  payment_type: "particular" | "convenio";
  insurance_name?: string;
  /** Valor da sessão de intervenção. */
  session_value?: number;
  /** Valor da sessão de avaliação. */
  assessment_value?: number;
  weekly_frequency?: number;
  handedness?: "destro" | "canhoto" | "ambidestro" | null;
  /** Endereço do responsável contratante (usado no contrato e no recibo). */
  address?: Address;
  start_date?: string | null;
  general_goals?: string;
  notes?: string;
  status: PatientStatus;
  anamnesis: Anamnesis;
  cognitive_profile?: string;
  behavioral_profile?: string;
  skills?: string;
  difficulties?: string;
}

export type InstrumentStatus = "planejado" | "aplicado" | "corrigido" | "no_relatorio";

export interface AssessmentInstrument {
  id: ID;
  instrument_id?: ID | null;
  name: string;
  status: InstrumentStatus;
  date?: string;
  session?: number;
  notes?: string;
}

export interface ChecklistItem {
  id: ID;
  label: string;
  done: boolean;
}

export type ObjectiveStatus = "atingido" | "parcial" | "nao_atingido";

/** Objetivo de uma sessão (vários por sessão). */
export interface SessionObjective {
  id: ID;
  text: string;
  status?: ObjectiveStatus | null;
  /** Área da intervenção a que o objetivo pertence (ex.: "Consciência fonológica"). */
  area?: string;
}

/** Área de intervenção do plano com seus objetivos específicos. */
export interface PlanArea {
  id: ID;
  area: string;
  objectives: TextItem[];
}

/** Atividade de uma sessão (várias por sessão). */
export interface SessionActivity {
  id: ID;
  title: string;
  materials?: string;
  duration_min?: number;
  /** Atividade de origem na biblioteca, quando inserida a partir dela. */
  activity_id?: ID | null;
  done?: boolean;
}

export interface AssessmentSessionPlan {
  id: ID;
  number: number;
  /** Texto legado (1 objetivo). Mantido em sincronia com `objectives`. */
  objective: string;
  objectives?: SessionObjective[];
  instruments: string[];
  activities?: SessionActivity[];
  duration_min?: number;
  date?: string;
  notes?: string;
}

export interface Assessment extends Base {
  patient_id: ID;
  title: string;
  objective?: string;
  hypotheses?: string;
  status: "em_andamento" | "concluida";
  start_date?: string | null;
  end_date?: string | null;
  instruments: AssessmentInstrument[];
  checklist: ChecklistItem[];
  sessions_plan: AssessmentSessionPlan[];
  ai_justification?: string;
  clinical_notes?: string;
  observations?: string;
  attachments?: Attachment[];
}

export interface TextItem {
  id: ID;
  text: string;
}

export interface PlannedSession {
  id: ID;
  number: number;
  date?: string;
  /** Textos legados, mantidos em sincronia com `objectives` / `activity_list` para relatórios e IA. */
  objective: string;
  activities: string;
  objectives?: SessionObjective[];
  activity_list?: SessionActivity[];
  attachments?: Attachment[];
  materials: string;
  duration_min: number;
  strategies: string;
  success_criteria: string;
  record?: string;
  done: boolean;
}

export interface InterventionPlan extends Base {
  patient_id: ID;
  assessment_id?: ID | null;
  title: string;
  general_objective?: string;
  /** Objetivos específicos organizados por área (fonte principal). */
  areas?: PlanArea[];
  /** Lista plana legada ("Área: objetivo"), mantida em sincronia com `areas`. */
  specific_objectives: TextItem[];
  goals: TextItem[];
  progress_criteria?: string;
  status: "ativo" | "pausado" | "concluido";
  start_date?: string | null;
  schedule: PlannedSession[];
}

export type AppointmentKind = "atendimento" | "avaliacao" | "devolutiva" | "bloqueio" | "outro";
export type AppointmentStatus = "agendado" | "confirmado" | "realizado" | "falta" | "cancelado";

export interface Appointment extends Base {
  patient_id?: ID | null;
  kind: AppointmentKind;
  title?: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  recurrence_id?: string | null;
  reminder_at?: string | null;
  notes?: string;
}

export interface Attachment {
  name: string;
  path: string;
  mime?: string;
  size?: number;
  /** Registro correspondente na aba Documentos do paciente. */
  document_id?: ID | null;
}

export interface ProgressScales {
  attention?: number;
  engagement?: number;
  autonomy?: number;
  goal_achievement?: number;
}

export interface SessionInsights {
  next_objective: string;
  new_activities: string[];
  strategies: string[];
  difficulties: string[];
  emerging_skills: string[];
  clinical_alerts: string[];
  referrals: string[];
}

export interface SessionRecord extends Base {
  patient_id: ID;
  appointment_id?: ID | null;
  plan_id?: ID | null;
  date: string;
  start_time?: string;
  objective?: string;
  activities?: string;
  materials?: string;
  child_response?: string;
  behavior?: string;
  parent_guidance?: string;
  next_plan?: string;
  clinical_evolution?: string;
  progress: ProgressScales;
  attachments: Attachment[];
  ai_insights?: SessionInsights | null;
  /** Objetivos trabalhados na sessão, com o resultado de cada um. */
  objective_results?: SessionObjective[];
  /** Atividades planejadas/realizadas na sessão. */
  activity_results?: SessionActivity[];
}

export type Difficulty = "facil" | "medio" | "dificil";

export interface Activity extends Base {
  title: string;
  area: string;
  skills: string[];
  diagnoses: string[];
  age_min: number;
  age_max: number;
  objectives: string;
  materials: string;
  steps: string;
  duration_min: number;
  difficulty: Difficulty;
  favorite: boolean;
}

export interface DocumentFile extends Base {
  patient_id?: ID | null;
  category: string;
  name: string;
  path: string;
  mime?: string;
  size?: number;
  notes?: string;
}

export type TxType = "receita" | "despesa" | "retirada";
/** Status gravado. "Recebido/pago" e "atrasado" são derivados de paid_at e due_date (ver lib/finance/ledger). */
export type TxStatus = "previsto" | "faturado" | "cancelado";
/** Natureza do gasto para o DRE gerencial e o planejamento. */
export type CostNature = "fixo" | "variavel" | "extraordinario" | "investimento" | "tributo" | "pessoal";
/** Classificação fiscal segundo a orientação do contador. "a_confirmar" nunca é deduzido. */
export type TaxClass = "dedutivel" | "nao_dedutivel" | "investimento" | "a_confirmar" | "pessoal";
/** Quem paga: pessoa física (Carnê-Leão) ou jurídica (ex.: plano de saúde). */
export type PayerKind = "pf" | "pj" | "a_confirmar";

/**
 * Lançamento financeiro. Os campos depois de `method` são do módulo de gestão financeira e
 * todos opcionais, para manter compatíveis os lançamentos antigos.
 */
export interface Transaction extends Base {
  patient_id?: ID | null;
  appointment_id?: ID | null;
  /** "retirada" = pró-labore/retirada pessoal: sai do caixa, mas não é despesa do consultório. */
  type: TxType;
  category: string;
  description?: string;
  /** Valor final (já com desconto). */
  amount: number;
  due_date: string;
  paid_at?: string | null;
  method?: string;
  status?: TxStatus | null;
  /** Data do atendimento / do fato gerador (competência). */
  service_date?: string | null;
  /** Mês de competência "AAAA-MM" (se vazio: mês do atendimento ou do vencimento). */
  competence?: string | null;
  /** Sessões cobradas, sessões realizadas e faltas (para ocupação e taxa de presença). */
  sessions?: number | null;
  sessions_done?: number | null;
  absences?: number | null;
  replacements?: number | null;
  unit_amount?: number | null;
  discount?: number | null;
  service_type?: string | null;
  payer_kind?: PayerKind | null;
  /** Identificador do pagador/paciente (pode ser anônimo, ex.: "AC-1"). */
  payer_label?: string | null;
  invoice_status?: "nao_aplica" | "pendente" | "emitida" | null;
  invoice_number?: string | null;
  /** IR retido na fonte por pessoa jurídica pagadora. */
  irrf_withheld?: number | null;
  nature?: CostNature | null;
  tax_class?: TaxClass | null;
  withdrawal_kind?: "pro_labore" | "distribuicao" | "adicional" | null;
  recurring_id?: ID | null;
  contract_id?: ID | null;
  plan_id?: ID | null;
  proof?: Attachment | null;
  notes?: string | null;
  /** Chave de importação (evita importar a mesma linha duas vezes). */
  import_key?: string | null;
  /** Valor estimado (não confirmado). */
  estimated?: boolean | null;
  /** Datas estimadas (ex.: a planilha não registra o dia do recebimento). */
  dates_estimated?: boolean | null;
}

/** Contrato/pacote recorrente de atendimento — base da receita prevista. */
export interface FinContract extends Base {
  label: string;
  patient_id?: ID | null;
  service_type: string;
  billing: "por_sessao" | "pacote_mensal";
  sessions_per_week: number;
  /** Valor recebido por sessão (já líquido do desconto do convênio, se houver). */
  unit_amount: number;
  monthly_amount?: number | null;
  payer_kind: PayerKind;
  /** Recebimento no mesmo mês do atendimento ou no mês seguinte. */
  payment_timing: "mesmo_mes" | "mes_seguinte";
  payment_day?: number | null;
  start_date: string;
  end_date?: string | null;
  /** Falta é cobrada? (pacotes costumam cobrar) */
  charges_absences: boolean;
  /** Taxa de presença esperada (0–1); vazio = usa a do histórico/cenário. */
  attendance_rate?: number | null;
  active: boolean;
  notes?: string;
}

/** Despesa recorrente (mensal, anual ou por sessão), com início e fim (ex.: cursos). */
export interface FinRecurring extends Base {
  description: string;
  category: string;
  amount: number;
  basis: "mensal" | "anual" | "por_sessao";
  day_of_month?: number | null;
  /** Mês (1–12) de cobrança das despesas anuais. */
  month_of_year?: number | null;
  start_date: string;
  end_date?: string | null;
  nature: CostNature;
  tax_class: TaxClass;
  /** Reajuste anual (%) aplicado a partir do mês indicado. */
  adjust_pct?: number | null;
  adjust_month?: number | null;
  active: boolean;
  estimated: boolean;
  notes?: string;
}

export type ReserveKind = "emergencia" | "anuais" | "ferias" | "equipamentos" | "investimentos" | "distribuicao" | "outra";

export interface ReserveMovement {
  id: ID;
  date: string;
  /** Positivo = aporte; negativo = uso. */
  amount: number;
  note?: string;
}

/** Conta gerencial (dinheiro separado no caixa para um fim). Impostos e capital de giro são automáticos. */
export interface FinReserve extends Base {
  kind: ReserveKind;
  name: string;
  target_mode: "valor" | "percentual_receita" | "meses_custos";
  target_value: number;
  target_date?: string | null;
  priority: number;
  /** Aporte mensal planejado (entra nas projeções como dinheiro separado). */
  monthly_contribution?: number | null;
  movements: ReserveMovement[];
  notes?: string;
}

/** Saldo bancário informado numa data (base do caixa atual). */
export interface FinBalance extends Base {
  date: string;
  account: string;
  amount: number;
  notes?: string;
}

/** Compra ou investimento planejado. Só "aprovado" entra nas projeções. */
export interface FinPlan extends Base {
  description: string;
  category: string;
  amount: number;
  month: string;
  installments: number;
  status: "ideia" | "aprovado" | "realizado" | "descartado";
  notes?: string;
}

/** Histórico de alterações financeiras (antes/depois). */
export interface FinHistory extends Base {
  table_name: string;
  record_id?: string | null;
  action: "criou" | "alterou" | "excluiu" | "importou" | "configurou";
  summary: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export interface Report extends Base {
  patient_id?: ID | null;
  type: string;
  title: string;
  content: string;
  status: "rascunho" | "finalizado";
}

export interface Profile {
  id: string;
  professional_name?: string;
  clinic_name?: string;
  profession?: string;
  crnpp?: string;
  document?: string;
  pix_key?: string;
  phone?: string;
  email?: string;
  address?: string;
  logo_url?: string | null;
  signature_url?: string | null;
  default_session_value?: number;
  work_start?: string;
  work_end?: string;
  session_minutes?: number;
  templates?: Record<string, string>;
  lgpd_consent_at?: string | null;
  /** Linha abaixo da assinatura, ex.: "Professora e Neuropsicopedagoga". */
  signature_title?: string;
  cbo?: string;
  whatsapp?: string;
  instagram?: string;
  city?: string;
  state?: string;
  /** Objetivos personalizados adicionados ao banco, por área. */
  objective_bank?: Record<string, string[]>;
  billing_rules?: BillingRules;
  /** Configurações do módulo de gestão financeira (ver lib/finance/settings). */
  finance_settings?: import("@/lib/finance/settings").FinanceSettings;
}

/** Regras de cobrança automática (as mensagens sempre aguardam aprovação antes do envio). */
export interface BillingRules {
  enabled: boolean;
  /** Lembrete X dias antes do vencimento (0 = não enviar). */
  days_before: number;
  on_due: boolean;
  /** Cobranças após o vencimento, em dias (ex.: [3, 7, 15]). */
  days_after: number[];
  whatsapp: boolean;
  email: boolean;
}

export type ChargeStage = "lembrete" | "vencimento" | `atraso_${number}`;
export type ChargeStatus = "pendente" | "enviada" | "rejeitada" | "cancelada" | "falhou";

/** Mensagem de cobrança na fila de aprovação. */
export interface ChargeMessage extends Base {
  transaction_id: ID;
  patient_id?: ID | null;
  channel: "whatsapp" | "email";
  stage: ChargeStage;
  recipient: string;
  recipient_name?: string;
  subject?: string;
  body: string;
  status: ChargeStatus;
  amount: number;
  due_date: string;
  approved_at?: string | null;
  sent_at?: string | null;
  error?: string | null;
}

/** Recibo de pagamento gerado automaticamente quando uma receita é marcada como paga. */
export interface Receipt extends Base {
  number: number;
  transaction_id?: ID | null;
  patient_id?: ID | null;
  issue_date: string;
  amount: number;
  payer_name: string;
  payer_cpf?: string;
  payer_city?: string;
  payer_state?: string;
  payer_email?: string;
  description: string;
  service_dates: string[];
}

export interface AuditLog {
  id: number;
  action: string;
  table_name: string;
  record_id?: string;
  at: string;
}

export type InstrumentAccess = "psicologo" | "multiprofissional" | "verificar";

/** Campo de pontuação usado para quantificar a evolução entre aplicações. */
export interface RecordField {
  key: string;
  label: string;
  type: "number" | "text";
  /** true = valor maior indica melhor desempenho; false = menor é melhor (ex.: erros, tempo). */
  higher_is_better?: boolean;
}

export interface Instrument extends Base {
  name: string;
  full_name: string;
  area: string;
  evaluates: string;
  /** Referência bibliográfica (lista de instrumentos do relatório). */
  reference?: string;
  /** Seção do RAN onde os resultados aparecem, ex.: "Funções executivas › Atenção". */
  ran_domain?: string;
  age_range?: string;
  access: InstrumentAccess;
  access_note?: string;
  application_guide?: string;
  record_fields: RecordField[];
  favorite: boolean;
}

export type RecordPhase = "inicial" | "intermediaria" | "reavaliacao";

/** Registro de aplicação de um instrumento (base da quantificação da evolução). */
export interface AssessmentRecord extends Base {
  patient_id: ID;
  assessment_id?: ID | null;
  instrument_id?: ID | null;
  instrument_name: string;
  date: string;
  phase: RecordPhase;
  scores: Record<string, number | string>;
  application_guide?: string;
  behavior?: string;
  clinical_record: string;
  ai_assisted?: boolean;
}

export type TaskPriority = "urgente" | "alta" | "media" | "baixa";
export type TaskStatus = "a_fazer" | "fazendo" | "concluida";

/** Tarefa de gestão e organização da clínica. */
export interface ClinicTask extends Base {
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  category: string;
  due_date?: string | null;
  patient_id?: ID | null;
  recurrence: "nenhuma" | "semanal" | "mensal" | "semestral" | "anual";
  done_at?: string | null;
  /** Chave de pendência automática que originou a tarefa (evita duplicar). */
  source_key?: string | null;
}

export type SocialFormat = "carrossel" | "post" | "reels" | "stories";
export type SocialStatus = "ideia" | "rascunho" | "agendado" | "publicado";

export interface SocialSlide { title: string; text: string }
export interface ReelScene { time: string; visual: string; on_screen_text: string; voiceover: string }

export interface SocialContent {
  hook: string;
  slides: SocialSlide[];
  caption: string;
  hashtags: string[];
  cta: string;
  reels?: { duration_s: number; audio_suggestion: string; scenes: ReelScene[] } | null;
  stories?: string[];
  design_tips?: string;
  best_time?: string;
  privacy_notes?: string;
}

export interface SocialMetrics {
  reach?: number;
  views?: number;
  likes?: number;
  comments?: number;
  saves?: number;
  shares?: number;
}

/** Conteúdo para Instagram (calendário editorial). */
export interface SocialPost extends Base {
  title: string;
  format: SocialFormat;
  theme?: string;
  audience?: string;
  goal?: string;
  status: SocialStatus;
  scheduled_for?: string | null;
  published_at?: string | null;
  content: SocialContent;
  metrics?: SocialMetrics;
  ig_media_id?: string | null;
  permalink?: string | null;
}

export interface TableMap {
  patients: Patient;
  assessments: Assessment;
  intervention_plans: InterventionPlan;
  appointments: Appointment;
  session_records: SessionRecord;
  activities: Activity;
  documents: DocumentFile;
  transactions: Transaction;
  reports: Report;
  instruments: Instrument;
  assessment_records: AssessmentRecord;
  receipts: Receipt;
  tasks: ClinicTask;
  social_posts: SocialPost;
  charge_messages: ChargeMessage;
  fin_contracts: FinContract;
  fin_recurring: FinRecurring;
  fin_reserves: FinReserve;
  fin_balances: FinBalance;
  fin_plans: FinPlan;
  fin_history: FinHistory;
}

export type TableName = keyof TableMap;
