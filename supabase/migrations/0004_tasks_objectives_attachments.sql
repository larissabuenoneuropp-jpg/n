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
