\set ON_ERROR_STOP 1
\set QUIET 1
create temp table r (n serial, test text, ok boolean, detail text);
grant all on r to anon, authenticated; grant usage on sequence r_n_seq to anon, authenticated;

insert into public.profiles (id, email) select id, email from auth.users on conflict do nothing;
-- Profissional A
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
insert into public.patients (name, owner_id, created_at) values ('Paciente A', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2000-01-01');
insert into r (test, ok, detail) select 'mass assignment no insert: owner_id forçado para A', owner_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and created_at > '2020-01-01', owner_id::text from public.patients where name = 'Paciente A';
update public.patients set owner_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', created_at = '2000-01-01', id = gen_random_uuid(), name = 'Paciente A2' where name = 'Paciente A';
insert into r (test, ok, detail) select 'mass assignment no update: id/owner/created_at imutáveis (nome mudou)', count(*) = 1 and bool_and(owner_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and created_at > '2020-01-01'), count(*)::text from public.patients where name = 'Paciente A2';
insert into public.session_records (patient_id, date) select id, current_date from public.patients where name = 'Paciente A2';
insert into r (test, ok, detail) select 'sessão do próprio paciente aceita', count(*) = 1, count(*)::text from public.session_records;
insert into r (test, ok, detail) select 'auditoria registrada', count(*) >= 3, count(*)::text from public.audit_logs;
insert into public.fin_balances (date, amount, owner_id) values (current_date, 1000, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
insert into r (test, ok, detail) select 'financeiro: saldo gravado com owner de A', count(*) = 1 and bool_and(owner_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), count(*)::text from public.fin_balances;
insert into public.transactions (type, category, amount, due_date, competence, status, import_key) values ('retirada', 'Retirada pessoal', 500, current_date, to_char(current_date, 'YYYY-MM'), null, 'k1');
insert into r (test, ok, detail) select 'financeiro: retirada aceita como tipo de lançamento', count(*) = 1, count(*)::text from public.transactions where type = 'retirada';
do $$ begin
  insert into public.transactions (type, category, amount, due_date, import_key) values ('receita', 'Sessão', 1, current_date, 'k1');
  insert into r (test, ok, detail) values ('financeiro: mesma linha importada não entra duas vezes', false, 'duplicou!');
exception when unique_violation then
  insert into r (test, ok, detail) values ('financeiro: mesma linha importada não entra duas vezes', true, sqlerrm);
end $$;

-- Profissional B
set request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
insert into r (test, ok, detail) select 'RLS: B não vê pacientes de A', count(*) = 0, count(*)::text from public.patients;
insert into r (test, ok, detail) select 'RLS: B não vê auditoria de A', count(*) = 0, count(*)::text from public.audit_logs;
insert into r (test, ok, detail) select 'RLS: B não vê saldos nem lançamentos de A', (select count(*) from public.fin_balances) + (select count(*) from public.transactions) = 0, 'ok';
update public.patients set name = 'invadido';
reset role;
insert into r (test, ok, detail) select 'RLS: B não altera paciente de A', count(*) = 0, count(*)::text from public.patients where name = 'invadido';
set role authenticated;
set request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
do $$
declare pid uuid;
begin
  reset role; select id into pid from public.patients where name = 'Paciente A2'; set role authenticated;
  begin
    insert into public.session_records (patient_id, date) values (pid, current_date);
    insert into r (test, ok, detail) values ('B não liga registro ao paciente de A', false, 'inseriu!');
  exception when others then
    insert into r (test, ok, detail) values ('B não liga registro ao paciente de A', true, sqlerrm);
  end;
  begin
    update public.profiles set id = gen_random_uuid() where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    insert into r (test, ok, detail) values ('B não troca o id do próprio perfil', not found, case when found then 'alterou!' else 'nenhuma linha' end);
  exception when others then
    insert into r (test, ok, detail) values ('B não troca o id do próprio perfil', true, sqlerrm);
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('documents', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/documentos/x.pdf');
    insert into r (test, ok, detail) values ('Storage: B não grava na pasta de A', false, 'gravou!');
  exception when others then
    insert into r (test, ok, detail) values ('Storage: B não grava na pasta de A', true, sqlerrm);
  end;
  insert into storage.objects (bucket_id, name) values ('documents', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/documentos/x.pdf');
  insert into r (test, ok, detail) values ('Storage: B grava na própria pasta', true, 'ok');
end $$;

-- Visitante sem login
reset request.jwt.claim.sub;
set role anon;
do $$
begin
  begin
    perform count(*) from public.patients;
    insert into r (test, ok, detail) values ('anon sem acesso às tabelas', false, 'leu!');
  exception when insufficient_privilege then
    insert into r (test, ok, detail) values ('anon sem acesso às tabelas', true, sqlerrm);
  end;
  begin
    insert into public.patients (name) values ('robô');
    insert into r (test, ok, detail) values ('anon não insere', false, 'inseriu!');
  exception when insufficient_privilege then
    insert into r (test, ok, detail) values ('anon não insere', true, sqlerrm);
  end;
end $$;
reset role;
insert into r (test, ok, detail) select 'bucket privado com limite e tipos', public = false and file_size_limit = 26214400 and not ('text/html' = any(allowed_mime_types)) and not ('image/svg+xml' = any(allowed_mime_types)), file_size_limit::text from storage.buckets where id = 'documents';
insert into r (test, ok, detail) select 'RLS ativo em todas as tabelas públicas', bool_and(c.relrowsecurity), string_agg(case when not c.relrowsecurity then c.relname end, ',') from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r';
\set QUIET 0
select case when ok then 'OK  ' else 'FAIL' end, test, left(detail, 70) from r order by n;
