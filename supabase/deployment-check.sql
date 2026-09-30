begin;
insert into auth.users(id) values ('11111111-2222-4333-8444-555555555551'),('11111111-2222-4333-8444-555555555552');
select set_config('request.jwt.claim.sub','11111111-2222-4333-8444-555555555551',true);
set local role authenticated;
do $$
declare d jsonb := '{"schemaVersion":2,"id":"deployment-check","name":"Deployment check","revision":0,"nodes":{},"objects":[],"openings":[],"settings":{},"layers":[{},{},{},{},{},{},{},{},{},{},{}]}'::jsonb; r jsonb;
begin
r := public.home_planer_save_project(d);
if (r->>'revision')::int <> 1 then raise exception 'first save failed'; end if;
r := public.home_planer_save_project(r);
if (r->>'revision')::int <> 2 then raise exception 'second save failed'; end if;
if (select count(*) from public.home_planer_projects where id='deployment-check' and document->>'revision'='2' and previous_document->>'revision'='1') <> 1 then raise exception 'read/history failed'; end if;
begin
perform public.home_planer_save_project(d);
raise exception 'conflict was not rejected';
exception when sqlstate 'P0001' then
if SQLERRM <> 'Проект изменён на другом устройстве' then raise; end if;
end;
end $$;
select set_config('request.jwt.claim.sub','11111111-2222-4333-8444-555555555552',true);
do $$ begin
if (select count(*) from public.home_planer_projects where id='deployment-check') <> 0 then raise exception 'owner isolation failed'; end if;
end $$;
select 'PASS: save, reopen, revision conflict, previous version and owner isolation' as result;
rollback;
