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
