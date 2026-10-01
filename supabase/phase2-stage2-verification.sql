begin;
insert into auth.users(id,email,email_confirmed_at) values ('b98e6fe5-c1e2-4ec6-9f9c-ea4ad1c01d77','phase2-check@example.invalid',now());
select set_config('request.jwt.claim.sub','b98e6fe5-c1e2-4ec6-9f9c-ea4ad1c01d77',true);
set local role authenticated;
do $test$
declare d jsonb := '{"id":"phase2-rollback-check","name":"Phase 2 transaction check","schemaVersion":2,"revision":0,"createdAt":"2026-09-30T20:24:30.722Z","updatedAt":"2026-09-30T20:24:30.724Z","settings":{"unit":"m","grid":1,"snap":0.1},"layers":[{"id":"plot","name":"Участок","visible":true,"locked":false},{"id":"buildings","name":"Постройки","visible":true,"locked":false},{"id":"walls","name":"Стены","visible":true,"locked":false},{"id":"openings","name":"Окна и двери","visible":true,"locked":false},{"id":"plumbing","name":"Сантехника","visible":true,"locked":false},{"id":"pipes","name":"Трубы","visible":true,"locked":false},{"id":"electrical","name":"Электрические предметы","visible":true,"locked":false},{"id":"wires","name":"Провода","visible":true,"locked":false},{"id":"paths","name":"Дорожки","visible":true,"locked":false},{"id":"dimensions","name":"Размеры","visible":true,"locked":false},{"id":"labels","name":"Подписи","visible":true,"locked":false}],"nodes":{},"objects":[],"openings":[]}'::jsonb; r jsonb; detail text;
begin
 r := public.home_planer_save_project(d);
 if (r->>'revision')::int <> 1 then raise exception 'v2 save failed'; end if;
 d := r || '{"schemaVersion":3}'::jsonb;
 r := public.home_planer_save_project(d);
 if (r->>'revision')::int <> 2 then raise exception 'v3 save failed'; end if;
 d := r || '{"schemaVersion":4}'::jsonb || jsonb_build_object('layers',(r->'layers') || '[{"id":"annotations","name":"Разметка","visible":true,"locked":false},{"id":"guidelines","name":"Направляющие","visible":true,"locked":false}]'::jsonb);
 r := public.home_planer_save_project(d);
 if (r->>'revision')::int <> 3 then raise exception 'v4 save failed'; end if;
 begin
  perform public.home_planer_save_project(r || '{"schemaVersion":3}'::jsonb || jsonb_build_object('layers',(d->'layers') - 12 - 11));
  raise exception 'downgrade was accepted';
 exception when sqlstate 'P0001' then
  get stacked diagnostics detail = PG_EXCEPTION_DETAIL;
  if detail is distinct from 'schema_conflict' then raise; end if;
 end;
 if has_table_privilege(current_user,'public.home_planer_phase2_stage2_backup','SELECT') then raise exception 'backup exposed'; end if;
 if not exists(select 1 from public.home_planer_projects where id='phase2-rollback-check' and revision=3 and document->>'schemaVersion'='4') then raise exception 'saved state incorrect'; end if;
end $test$;
reset role;
select 'PASS: v2 save, v3 save, v4 save, downgrade rejected, backup protected; transaction rolled back' as result;
rollback;
