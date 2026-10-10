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
