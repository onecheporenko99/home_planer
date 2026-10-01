begin;
insert into auth.users(id,email,email_confirmed_at) values ('b98e6fe5-c1e2-4ec6-9f9c-ea4ad1c01d77','phase2-check@example.invalid',now());
select set_config('request.jwt.claim.sub','b98e6fe5-c1e2-4ec6-9f9c-ea4ad1c01d77',true);
insert into storage.objects(bucket_id,name,owner_id) values
 ('home-planer-assets','b98e6fe5-c1e2-4ec6-9f9c-ea4ad1c01d77/'||repeat('a',64),'b98e6fe5-c1e2-4ec6-9f9c-ea4ad1c01d77'),
 ('home-planer-assets','00000000-0000-4000-8000-000000000001/'||repeat('b',64),'00000000-0000-4000-8000-000000000001');
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
 d := r || '{"schemaVersion":5,"resources":[],"underlays":[]}'::jsonb || jsonb_build_object('layers',(r->'layers') || '[{"id":"underlays","name":"Подложки","visible":true,"locked":false}]'::jsonb);
 r := public.home_planer_save_project(d);
 if (r->>'revision')::int <> 4 then raise exception 'v5 save failed';end if;
 if (select count(*) from storage.objects where bucket_id='home-planer-assets') <> 1 then raise exception 'asset isolation failed';end if;
 begin
  insert into storage.objects(bucket_id,name) values ('home-planer-assets','00000000-0000-4000-8000-000000000001/'||repeat('c',64));
  raise exception 'foreign upload accepted';
 exception when insufficient_privilege then null;end;
 update storage.objects set metadata='{"tampered":true}'::jsonb where bucket_id='home-planer-assets';
 if found then raise exception 'immutable assets allowed update';end if;
 begin
  delete from storage.objects where bucket_id='home-planer-assets';
  if found then raise exception 'assets allowed delete';end if;
 exception when insufficient_privilege then null;end;
 d := r || jsonb_build_object('resources',jsonb_build_array(jsonb_build_object('id',repeat('a',64),'sha256',repeat('a',64),'name','fixture.png','mimeType','image/png','byteLength',123,'width',600,'height',400)));
 r := public.home_planer_save_project(d);
 if (r->>'revision')::int <> 5 then raise exception 'own asset save failed';end if;
 begin
  perform public.home_planer_save_project(r || jsonb_build_object('resources',jsonb_build_array(jsonb_build_object('id',repeat('b',64),'sha256',repeat('b',64)))));
  raise exception 'foreign asset reference accepted';
 exception when invalid_parameter_value then null;end;
 begin
  perform public.home_planer_save_project(r || '{"schemaVersion":4}'::jsonb || jsonb_build_object('layers',(r->'layers') - 13));
  raise exception 'downgrade was accepted';
 exception when sqlstate 'P0001' then
  get stacked diagnostics detail = PG_EXCEPTION_DETAIL;
  if detail is distinct from 'schema_conflict' then raise; end if;
 end;
 if has_table_privilege(current_user,'public.home_planer_phase2_stage3_backup','SELECT') then raise exception 'backup exposed'; end if;
 if not exists(select 1 from public.home_planer_projects where id='phase2-rollback-check' and revision=5 and document->>'schemaVersion'='5') then raise exception 'saved state incorrect'; end if;
end $test$;
reset role;
do $$ begin
 if not exists(select 1 from storage.buckets where id='home-planer-assets' and not public and file_size_limit=20971520) then raise exception 'bucket settings incorrect';end if;
end $$;
select 'PASS: v2-v5 save, own asset accepted, foreign read/upload/reference denied, update/delete denied, downgrade denied, private bucket and backup protected; transaction rolled back' as result;
rollback;
