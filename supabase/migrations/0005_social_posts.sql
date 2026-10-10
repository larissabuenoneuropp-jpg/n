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
