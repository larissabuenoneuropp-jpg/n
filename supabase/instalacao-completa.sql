-- NeuroPlanner — instalação completa do banco (todas as migrações 0001 a 0006 em um único arquivo).
-- Use em um projeto NOVO do Supabase: SQL Editor → New query → cole tudo → Run. Execute apenas UMA vez.


-- ======================================================================
-- 0001_init.sql
-- ======================================================================
-- NeuroPlanner — esquema inicial
-- Execute no SQL Editor do Supabase (ou via `supabase db push`).
-- Todas as tabelas são isoladas por profissional (owner_id = auth.uid()) com Row Level Security.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Perfil / configurações da clínica (1:1 com auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  professional_name text,
  clinic_name text,
  profession text default 'Neuropsicopedagoga',
  crnpp text,
  document text,             -- CPF/CNPJ
  pix_key text,
  phone text,
  email text,
  address text,
  logo_url text,
  signature_url text,
  default_session_value numeric(10,2) default 0,
  work_start time default '08:00',
  work_end time default '19:00',
  session_minutes int default 50,
  templates jsonb not null default '{}'::jsonb,
  lgpd_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, professional_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Pacientes (prontuário)
-- ---------------------------------------------------------------------------
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  photo_url text,
  birth_date date,
  guardians jsonb not null default '[]'::jsonb,
  phones text,
  email text,
  school text,
  grade text,
  teacher text,
  diagnosis text,
  hypotheses text,
  referred_by text,
  payment_type text not null default 'particular' check (payment_type in ('particular','convenio')),
  insurance_name text,
  session_value numeric(10,2) default 0,
  weekly_frequency int default 1,
  start_date date,
  general_goals text,
  notes text,
  status text not null default 'ativo' check (status in ('ativo','inativo','alta')),
  anamnesis jsonb not null default '{}'::jsonb,
  cognitive_profile text,
  behavioral_profile text,
  skills text,
  difficulties text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.patients(owner_id, status);

-- ---------------------------------------------------------------------------
-- Avaliações
-- ---------------------------------------------------------------------------
create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  title text not null,
  objective text,
  hypotheses text,
  status text not null default 'em_andamento' check (status in ('em_andamento','concluida')),
  start_date date,
  end_date date,
  instruments jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  sessions_plan jsonb not null default '[]'::jsonb,
  ai_justification text,
  clinical_notes text,
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.assessments(owner_id, patient_id);

-- ---------------------------------------------------------------------------
-- Planos de intervenção
-- ---------------------------------------------------------------------------
create table public.intervention_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  assessment_id uuid references public.assessments(id) on delete set null,
  title text not null,
  general_objective text,
  specific_objectives jsonb not null default '[]'::jsonb,
  goals jsonb not null default '[]'::jsonb,
  progress_criteria text,
  status text not null default 'ativo' check (status in ('ativo','pausado','concluido')),
  start_date date,
  schedule jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.intervention_plans(owner_id, patient_id);

-- ---------------------------------------------------------------------------
-- Agenda
-- ---------------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  kind text not null default 'atendimento' check (kind in ('atendimento','avaliacao','devolutiva','bloqueio','outro')),
  title text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'agendado' check (status in ('agendado','confirmado','realizado','falta','cancelado')),
  recurrence_id uuid,
  reminder_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on public.appointments(owner_id, starts_at);

-- ---------------------------------------------------------------------------
-- Registros de sessão
-- ---------------------------------------------------------------------------
create table public.session_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  plan_id uuid references public.intervention_plans(id) on delete set null,
  date date not null,
  start_time time,
  objective text,
  activities text,
  materials text,
  child_response text,
  behavior text,
  parent_guidance text,
  next_plan text,
  clinical_evolution text,
  progress jsonb not null default '{}'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  ai_insights jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.session_records(owner_id, patient_id, date desc);

-- ---------------------------------------------------------------------------
-- Banco de atividades
-- ---------------------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  area text not null,
  skills text[] not null default '{}',
  diagnoses text[] not null default '{}',
  age_min int default 4,
  age_max int default 12,
  objectives text,
  materials text,
  steps text,
  duration_min int default 15,
  difficulty text not null default 'medio' check (difficulty in ('facil','medio','dificil')),
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.activities(owner_id, area);

-- ---------------------------------------------------------------------------
-- Documentos (arquivos no Storage, bucket privado "documents")
-- ---------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  category text not null default 'outro',
  name text not null,
  path text not null,
  mime text,
  size bigint,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.documents(owner_id, patient_id);

-- ---------------------------------------------------------------------------
-- Financeiro
-- ---------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  type text not null check (type in ('receita','despesa')),
  category text not null default 'sessao',
  description text,
  amount numeric(10,2) not null check (amount >= 0),
  due_date date not null,
  paid_at date,
  method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.transactions(owner_id, due_date);

-- ---------------------------------------------------------------------------
-- Relatórios / documentos clínicos gerados
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  type text not null,
  title text not null,
  content text not null default '',
  status text not null default 'rascunho' check (status in ('rascunho','finalizado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.reports(owner_id, patient_id);

-- ---------------------------------------------------------------------------
-- Logs de auditoria (somente leitura para o usuário; escrita via trigger)
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  actor_id uuid,
  action text not null,
  table_name text not null,
  record_id uuid,
  at timestamptz not null default now()
);
create index on public.audit_logs(owner_id, at desc);

create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rec record;
begin
  if tg_op = 'DELETE' then rec := old; else rec := new; end if;
  insert into public.audit_logs (owner_id, actor_id, action, table_name, record_id)
  values (rec.owner_id, auth.uid(), lower(tg_op), tg_table_name, rec.id);
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- Triggers e RLS para as tabelas de domínio
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'patients','assessments','intervention_plans','appointments','session_records',
    'activities','documents','transactions','reports'
  ] loop
    execute format('create trigger %I_updated before update on public.%I for each row execute function public.set_updated_at()', t, t);
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_trigger()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s_owner_select" on public.%I for select using (owner_id = auth.uid())', t, t);
    execute format('create policy "%s_owner_insert" on public.%I for insert with check (owner_id = auth.uid())', t, t);
    execute format('create policy "%s_owner_update" on public.%I for update using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t, t);
    execute format('create policy "%s_owner_delete" on public.%I for delete using (owner_id = auth.uid())', t, t);
  end loop;
end $$;

create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
alter table public.profiles enable row level security;
create policy "profiles_self_select" on public.profiles for select using (id = auth.uid());
create policy "profiles_self_update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

alter table public.audit_logs enable row level security;
create policy "audit_owner_select" on public.audit_logs for select using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: bucket privado; cada profissional só acessa a pasta <uid>/...
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
  on conflict (id) do nothing;

create policy "documents_owner_read" on storage.objects for select
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents_owner_insert" on storage.objects for insert
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents_owner_update" on storage.objects for update
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents_owner_delete" on storage.objects for delete
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- ======================================================================
-- 0002_instruments_records.sql
-- ======================================================================
-- NeuroPlanner — biblioteca de testes/protocolos e registros de aplicação (quantificação da evolução)

create table public.instruments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  full_name text not null default '',
  area text not null,
  evaluates text not null default '',
  age_range text,
  access text not null default 'verificar' check (access in ('psicologo','multiprofissional','verificar')),
  access_note text,
  application_guide text,
  record_fields jsonb not null default '[]'::jsonb,
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.instruments(owner_id, area);

create table public.assessment_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  assessment_id uuid references public.assessments(id) on delete set null,
  instrument_id uuid references public.instruments(id) on delete set null,
  instrument_name text not null,
  date date not null,
  phase text not null default 'inicial' check (phase in ('inicial','intermediaria','reavaliacao')),
  scores jsonb not null default '{}'::jsonb,
  application_guide text,
  behavior text,
  clinical_record text not null default '',
  ai_assisted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.assessment_records(owner_id, patient_id, instrument_name, date);

do $$
declare t text;
begin
  foreach t in array array['instruments','assessment_records'] loop
    execute format('create trigger %I_updated before update on public.%I for each row execute function public.set_updated_at()', t, t);
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_trigger()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s_owner_select" on public.%I for select using (owner_id = auth.uid())', t, t);
    execute format('create policy "%s_owner_insert" on public.%I for insert with check (owner_id = auth.uid())', t, t);
    execute format('create policy "%s_owner_update" on public.%I for update using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t, t);
    execute format('create policy "%s_owner_delete" on public.%I for delete using (owner_id = auth.uid())', t, t);
  end loop;
end $$;

-- ======================================================================
-- 0003_contracts_receipts.sql
-- ======================================================================
-- NeuroPlanner — dados para contrato e recibos automáticos

alter table public.patients
  add column if not exists address jsonb not null default '{}'::jsonb,
  add column if not exists assessment_value numeric(10,2) default 0;

alter table public.profiles
  add column if not exists signature_title text,
  add column if not exists cbo text,
  add column if not exists whatsapp text,
  add column if not exists instagram text,
  add column if not exists city text,
  add column if not exists state text;

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  number int not null,
  transaction_id uuid references public.transactions(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  issue_date date not null,
  amount numeric(10,2) not null check (amount >= 0),
  payer_name text not null,
  payer_cpf text,
  payer_city text,
  payer_state text,
  payer_email text,
  description text not null default '',
  service_dates text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, number)
);
create unique index receipts_one_per_transaction on public.receipts(transaction_id) where transaction_id is not null;
create index on public.receipts(owner_id, patient_id, issue_date desc);

create trigger receipts_updated before update on public.receipts for each row execute function public.set_updated_at();
create trigger receipts_audit after insert or update or delete on public.receipts for each row execute function public.audit_trigger();
alter table public.receipts enable row level security;
create policy "receipts_owner_select" on public.receipts for select using (owner_id = auth.uid());
create policy "receipts_owner_insert" on public.receipts for insert with check (owner_id = auth.uid());
create policy "receipts_owner_update" on public.receipts for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "receipts_owner_delete" on public.receipts for delete using (owner_id = auth.uid());

-- ======================================================================
-- 0004_tasks_objectives_attachments.sql
-- ======================================================================
-- NeuroPlanner — tarefas da clínica, vários objetivos/atividades por sessão e anexos em avaliações
-- (objetivos e atividades das sessões planejadas ficam nos campos jsonb já existentes:
--  assessments.sessions_plan e intervention_plans.schedule)

alter table public.assessments
  add column if not exists attachments jsonb not null default '[]'::jsonb;

alter table public.session_records
  add column if not exists objective_results jsonb not null default '[]'::jsonb,
  add column if not exists activity_results jsonb not null default '[]'::jsonb;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'media' check (priority in ('urgente','alta','media','baixa')),
  status text not null default 'a_fazer' check (status in ('a_fazer','fazendo','concluida')),
  category text not null default 'Administrativo',
  due_date date,
  patient_id uuid references public.patients(id) on delete set null,
  recurrence text not null default 'nenhuma' check (recurrence in ('nenhuma','semanal','mensal','semestral','anual')),
  done_at timestamptz,
  source_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.tasks(owner_id, status, priority);
create unique index tasks_source_key on public.tasks(owner_id, source_key) where source_key is not null and status <> 'concluida';

create trigger tasks_updated before update on public.tasks for each row execute function public.set_updated_at();
create trigger tasks_audit after insert or update or delete on public.tasks for each row execute function public.audit_trigger();
alter table public.tasks enable row level security;
create policy "tasks_owner_select" on public.tasks for select using (owner_id = auth.uid());
create policy "tasks_owner_insert" on public.tasks for insert with check (owner_id = auth.uid());
create policy "tasks_owner_update" on public.tasks for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "tasks_owner_delete" on public.tasks for delete using (owner_id = auth.uid());

-- ======================================================================
-- 0005_social_posts.sql
-- ======================================================================
-- NeuroPlanner — criador de conteúdo para Instagram (calendário editorial e métricas)

create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  format text not null default 'carrossel' check (format in ('carrossel','post','reels','stories')),
  theme text,
  audience text,
  goal text,
  status text not null default 'rascunho' check (status in ('ideia','rascunho','agendado','publicado')),
  scheduled_for date,
  published_at date,
  content jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  ig_media_id text,
  permalink text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.social_posts(owner_id, status, scheduled_for);

create trigger social_posts_updated before update on public.social_posts for each row execute function public.set_updated_at();
create trigger social_posts_audit after insert or update or delete on public.social_posts for each row execute function public.audit_trigger();
alter table public.social_posts enable row level security;
create policy "social_posts_owner_select" on public.social_posts for select using (owner_id = auth.uid());
create policy "social_posts_owner_insert" on public.social_posts for insert with check (owner_id = auth.uid());
create policy "social_posts_owner_update" on public.social_posts for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "social_posts_owner_delete" on public.social_posts for delete using (owner_id = auth.uid());

-- ======================================================================
-- 0006_areas_ran_import.sql
-- ======================================================================
-- NeuroPlanner — intervenção por área, modelo RAN e importação de pacientes
-- (áreas dos planos ficam em intervention_plans.schedule/areas via jsonb)

alter table public.intervention_plans
  add column if not exists areas jsonb not null default '[]'::jsonb;

alter table public.patients
  add column if not exists handedness text check (handedness in ('destro','canhoto','ambidestro'));

alter table public.instruments
  add column if not exists reference text,
  add column if not exists ran_domain text;

alter table public.profiles
  add column if not exists objective_bank jsonb not null default '{}'::jsonb;

-- Cobranças automáticas: regras e fila de mensagens que aguardam aprovação da profissional
alter table public.profiles
  add column if not exists billing_rules jsonb not null default '{"enabled": true, "days_before": 2, "on_due": true, "days_after": [3, 7], "whatsapp": true, "email": true}'::jsonb;

create table public.charge_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  channel text not null check (channel in ('whatsapp','email')),
  stage text not null,
  recipient text not null default '',
  recipient_name text,
  subject text,
  body text not null,
  status text not null default 'pendente' check (status in ('pendente','enviada','rejeitada','cancelada','falhou')),
  amount numeric(10,2) not null default 0,
  due_date date not null,
  approved_at timestamptz,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, transaction_id, stage, channel)
);
create index on public.charge_messages(owner_id, status);

create trigger charge_messages_updated before update on public.charge_messages for each row execute function public.set_updated_at();
create trigger charge_messages_audit after insert or update or delete on public.charge_messages for each row execute function public.audit_trigger();
alter table public.charge_messages enable row level security;
create policy "charge_messages_owner_select" on public.charge_messages for select using (owner_id = auth.uid());
create policy "charge_messages_owner_insert" on public.charge_messages for insert with check (owner_id = auth.uid());
create policy "charge_messages_owner_update" on public.charge_messages for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "charge_messages_owner_delete" on public.charge_messages for delete using (owner_id = auth.uid());
