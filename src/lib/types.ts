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
}

export interface Anamnesis {
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
  session_value?: number;
  weekly_frequency?: number;
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

export interface AssessmentSessionPlan {
  id: ID;
  number: number;
  objective: string;
  instruments: string[];
  duration_min?: number;
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
}

export interface TextItem {
  id: ID;
  text: string;
}

export interface PlannedSession {
  id: ID;
  number: number;
  date?: string;
  objective: string;
  activities: string;
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

export interface Transaction extends Base {
  patient_id?: ID | null;
  appointment_id?: ID | null;
  type: "receita" | "despesa";
  category: string;
  description?: string;
  amount: number;
  due_date: string;
  paid_at?: string | null;
  method?: string;
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
}

export interface AuditLog {
  id: number;
  action: string;
  table_name: string;
  record_id?: string;
  at: string;
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
}

export type TableName = keyof TableMap;
