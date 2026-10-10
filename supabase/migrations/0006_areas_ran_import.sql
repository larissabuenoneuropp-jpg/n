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
