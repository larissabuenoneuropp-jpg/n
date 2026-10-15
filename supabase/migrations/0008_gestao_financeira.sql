-- NeuroPlanner — gestão financeira (rode depois das migrações 0001 a 0007)
-- 1) Lançamentos ganham campos de competência, status, sessões, pagador, classificação fiscal e importação.
-- 2) Novas tabelas: contratos, despesas recorrentes, reservas, saldos bancários, compras planejadas e histórico.
-- 3) Configurações do módulo ficam no perfil (finance_settings).
-- Todas as tabelas novas seguem o mesmo padrão: RLS por owner_id, owner/id/created_at protegidos.

alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add constraint transactions_type_check check (type in ('receita','despesa','retirada'));

alter table public.transactions
  add column if not exists status text check (status is null or status in ('previsto','faturado','cancelado')),
  add column if not exists service_date date,
  add column if not exists competence text check (competence is null or competence ~ '^\d{4}-\d{2}$'),
  add column if not exists sessions numeric(6,1),
  add column if not exists sessions_done numeric(6,1),
  add column if not exists absences numeric(6,1),
  add column if not exists replacements numeric(6,1),
  add column if not exists unit_amount numeric(10,2),
  add column if not exists discount numeric(10,2),
  add column if not exists service_type text,
  add column if not exists payer_kind text check (payer_kind is null or payer_kind in ('pf','pj','a_confirmar')),
  add column if not exists payer_label text,
  add column if not exists invoice_status text check (invoice_status is null or invoice_status in ('nao_aplica','pendente','emitida')),
  add column if not exists invoice_number text,
  add column if not exists irrf_withheld numeric(10,2),
  add column if not exists nature text check (nature is null or nature in ('fixo','variavel','extraordinario','investimento','tributo','pessoal')),
  add column if not exists tax_class text check (tax_class is null or tax_class in ('dedutivel','nao_dedutivel','investimento','a_confirmar','pessoal')),
  add column if not exists withdrawal_kind text check (withdrawal_kind is null or withdrawal_kind in ('pro_labore','distribuicao','adicional')),
  add column if not exists recurring_id uuid,
  add column if not exists contract_id uuid,
  add column if not exists plan_id uuid,
  add column if not exists proof jsonb,
  add column if not exists notes text,
  add column if not exists import_key text,
  add column if not exists estimated boolean,
  add column if not exists dates_estimated boolean;

-- A mesma linha importada não entra duas vezes
create unique index if not exists transactions_import_key_uniq on public.transactions(owner_id, import_key) where import_key is not null;
create index if not exists transactions_owner_competence on public.transactions(owner_id, competence);

alter table public.profiles add column if not exists finance_settings jsonb;

create table if not exists public.fin_contracts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null,
  patient_id uuid references public.patients(id) on delete set null,
  service_type text not null default 'Sessão avulsa',
  billing text not null default 'por_sessao' check (billing in ('por_sessao','pacote_mensal')),
  sessions_per_week numeric(4,1) not null default 1 check (sessions_per_week >= 0),
  unit_amount numeric(10,2) not null default 0 check (unit_amount >= 0),
  monthly_amount numeric(10,2) check (monthly_amount is null or monthly_amount >= 0),
  payer_kind text not null default 'a_confirmar' check (payer_kind in ('pf','pj','a_confirmar')),
  payment_timing text not null default 'mesmo_mes' check (payment_timing in ('mesmo_mes','mes_seguinte')),
  payment_day int check (payment_day is null or payment_day between 1 and 31),
  start_date date not null,
  end_date date,
  charges_absences boolean not null default false,
  attendance_rate numeric(4,3) check (attendance_rate is null or attendance_rate between 0 and 1),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fin_recurring (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  description text not null,
  category text not null,
  amount numeric(10,2) not null check (amount >= 0),
  basis text not null default 'mensal' check (basis in ('mensal','anual','por_sessao')),
  day_of_month int check (day_of_month is null or day_of_month between 1 and 31),
  month_of_year int check (month_of_year is null or month_of_year between 1 and 12),
  start_date date not null,
  end_date date,
  nature text not null default 'fixo' check (nature in ('fixo','variavel','extraordinario','investimento','tributo','pessoal')),
  tax_class text not null default 'a_confirmar' check (tax_class in ('dedutivel','nao_dedutivel','investimento','a_confirmar','pessoal')),
  adjust_pct numeric(6,2),
  adjust_month int check (adjust_month is null or adjust_month between 1 and 12),
  active boolean not null default true,
  estimated boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fin_reserves (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'outra' check (kind in ('emergencia','anuais','ferias','equipamentos','investimentos','distribuicao','outra')),
  name text not null,
  target_mode text not null default 'valor' check (target_mode in ('valor','percentual_receita','meses_custos')),
  target_value numeric(12,2) not null default 0 check (target_value >= 0),
  target_date date,
  priority int not null default 1,
  monthly_contribution numeric(10,2),
  movements jsonb not null default '[]',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fin_balances (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  account text not null default 'Conta principal',
  amount numeric(12,2) not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fin_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  description text not null,
  category text not null default 'Equipamentos e mobiliário',
  amount numeric(12,2) not null check (amount >= 0),
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  installments int not null default 1 check (installments between 1 and 60),
  status text not null default 'ideia' check (status in ('ideia','aprovado','realizado','descartado')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fin_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  table_name text not null,
  record_id text,
  action text not null check (action in ('criou','alterou','excluiu','importou','configurou')),
  summary text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fin_history_owner_created on public.fin_history(owner_id, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['fin_contracts','fin_recurring','fin_reserves','fin_balances','fin_plans','fin_history'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_owner_select" on public.%I', t, t);
    execute format('drop policy if exists "%s_owner_insert" on public.%I', t, t);
    execute format('drop policy if exists "%s_owner_update" on public.%I', t, t);
    execute format('drop policy if exists "%s_owner_delete" on public.%I', t, t);
    execute format('create policy "%s_owner_select" on public.%I for select using (owner_id = auth.uid())', t, t);
    execute format('create policy "%s_owner_insert" on public.%I for insert with check (owner_id = auth.uid())', t, t);
    execute format('create policy "%s_owner_update" on public.%I for update using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t, t);
    execute format('create policy "%s_owner_delete" on public.%I for delete using (owner_id = auth.uid())', t, t);
    execute format('drop trigger if exists %I_updated on public.%I', t, t);
    execute format('create trigger %I_updated before update on public.%I for each row execute function public.set_updated_at()', t, t);
    execute format('drop trigger if exists %I_audit on public.%I', t, t);
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_trigger()', t, t);
    -- Mesmo reforço da migração 0007: owner_id, id e created_at definidos pelo banco
    execute format('drop trigger if exists %I_protect on public.%I', t, t);
    execute format('create trigger %I_protect before insert or update on public.%I for each row execute function public.protect_row()', t, t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Contrato só pode apontar para paciente da mesma profissional
drop trigger if exists fin_contracts_zz_patient_owner on public.fin_contracts;
create trigger fin_contracts_zz_patient_owner before insert or update of patient_id on public.fin_contracts
  for each row execute function public.check_patient_owner();
