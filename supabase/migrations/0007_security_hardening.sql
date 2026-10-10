-- NeuroPlanner — reforço de segurança (rode depois das migrações 0001 a 0006)
-- 1) Mass assignment: o dono (owner_id), o id e a data de criação são definidos pelo banco, nunca pelo navegador.
-- 2) Um registro só pode apontar para um paciente da mesma profissional.
-- 3) Visitantes sem login (papel "anon") não têm nenhum acesso às tabelas.
-- 4) Bucket de documentos: limite de tamanho e lista de tipos de arquivo permitidos.

create or replace function public.protect_row() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.owner_id := auth.uid();
    end if;
    new.created_at := now();
  else
    new.id := old.id;
    new.owner_id := old.owner_id;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

create or replace function public.check_patient_owner() returns trigger
language plpgsql as $$
begin
  if new.patient_id is not null and not exists (
    select 1 from public.patients p where p.id = new.patient_id and p.owner_id = new.owner_id
  ) then
    raise exception 'Paciente inválido para esta conta' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  for t in
    select c.table_name from information_schema.columns c
    where c.table_schema = 'public' and c.column_name = 'owner_id' and c.table_name <> 'audit_logs'
      and exists (select 1 from information_schema.columns c2 where c2.table_schema = 'public' and c2.table_name = c.table_name and c2.column_name = 'created_at')
      and exists (select 1 from information_schema.tables tb where tb.table_schema = 'public' and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE')
  loop
    execute format('drop trigger if exists %I_protect on public.%I', t, t);
    execute format('create trigger %I_protect before insert or update on public.%I for each row execute function public.protect_row()', t, t);
  end loop;

  for t in
    select c.table_name from information_schema.columns c
    where c.table_schema = 'public' and c.column_name = 'patient_id'
      and exists (select 1 from information_schema.columns c2 where c2.table_schema = 'public' and c2.table_name = c.table_name and c2.column_name = 'owner_id')
      and exists (select 1 from information_schema.tables tb where tb.table_schema = 'public' and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE')
  loop
    -- nome com "zz" para rodar depois do trigger que fixa o owner_id (triggers rodam em ordem alfabética)
    execute format('drop trigger if exists %I_zz_patient_owner on public.%I', t, t);
    execute format('create trigger %I_zz_patient_owner before insert or update of patient_id on public.%I for each row execute function public.check_patient_owner()', t, t);
  end loop;
end $$;

-- Sem login, nada: o app exige sessão para tudo (as políticas RLS já bloqueavam; isto é uma segunda barreira)
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- Bucket privado de documentos: até 25 MB e só formatos de documento, imagem, áudio e vídeo comuns
-- (sem HTML/SVG/scripts). Confira no painel do Supabase (Storage → documents → Edit bucket) se foi aplicado.
update storage.buckets
set public = false,
    file_size_limit = 26214400,
    allowed_mime_types = array[
      'application/pdf','application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.oasis.opendocument.text','application/vnd.oasis.opendocument.spreadsheet',
      'application/rtf','text/rtf','text/plain','text/csv','text/markdown',
      'image/png','image/jpeg','image/webp','image/gif','image/heic','image/heif',
      'audio/mpeg','audio/mp4','audio/x-m4a','video/mp4'
    ]
where id = 'documents';
