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
 d := '{"id":"59ba132d-9169-4dfa-b384-5560d7087849","name":"Мой участок","schemaVersion":6,"revision":0,"createdAt":"2026-10-01T08:48:50.281Z","updatedAt":"2026-10-01T08:48:50.282Z","settings":{"unit":"m","grid":1,"snap":0.1,"measurements":{"mode":"axis","showRoomDimensions":true,"showWallDimensions":true,"showClearances":true,"showChains":true}},"layers":[{"id":"plot","name":"Участок","visible":true,"locked":false},{"id":"buildings","name":"Постройки","visible":true,"locked":false},{"id":"walls","name":"Стены","visible":true,"locked":false},{"id":"openings","name":"Окна и двери","visible":true,"locked":false},{"id":"plumbing","name":"Сантехника","visible":true,"locked":false},{"id":"pipes","name":"Трубы","visible":true,"locked":false},{"id":"electrical","name":"Электрические предметы","visible":true,"locked":false},{"id":"wires","name":"Провода","visible":true,"locked":false},{"id":"paths","name":"Дорожки","visible":true,"locked":false},{"id":"dimensions","name":"Размеры","visible":true,"locked":false},{"id":"labels","name":"Подписи","visible":true,"locked":false},{"id":"annotations","name":"Разметка","visible":true,"locked":false},{"id":"guidelines","name":"Направляющие","visible":true,"locked":false},{"id":"underlays","name":"Подложки","visible":true,"locked":false},{"id":"rooms","name":"Комнаты","visible":true,"locked":false}],"nodes":{"3164a457-b88f-411a-b156-417de6acf139":{"x":-0.1,"y":-0.09999999999999876,"id":"3164a457-b88f-411a-b156-417de6acf139"},"ce6d513e-6581-4bba-b6e4-88c00eeb3fc9":{"x":3.1000000000000005,"y":-0.1,"id":"ce6d513e-6581-4bba-b6e4-88c00eeb3fc9"},"6259fe58-7e08-4e03-adf5-a3e23e70d299":{"x":3.1,"y":4.1,"id":"6259fe58-7e08-4e03-adf5-a3e23e70d299"},"8e9114bb-e05a-4f12-ba8b-1ae039c33ea7":{"x":-0.10000000000000009,"y":4.1,"id":"8e9114bb-e05a-4f12-ba8b-1ae039c33ea7"}},"objects":[{"id":"120e6e7c-413c-4f6a-a225-8b333fdc9be4","type":"wall","name":"Комната 3×4 · стена 1 1","vertexIds":["3164a457-b88f-411a-b156-417de6acf139","ce6d513e-6581-4bba-b6e4-88c00eeb3fc9"],"thickness":0.2,"height":2.8,"wallKind":"internal","layerId":"walls"},{"id":"41656b87-d0cb-46f4-8c77-12760735429c","type":"wall","name":"Комната 3×4 · стена 2 1","vertexIds":["ce6d513e-6581-4bba-b6e4-88c00eeb3fc9","6259fe58-7e08-4e03-adf5-a3e23e70d299"],"thickness":0.2,"height":2.8,"wallKind":"internal","layerId":"walls"},{"id":"1558571b-8724-4d7e-be98-4d392ec50598","type":"wall","name":"Комната 3×4 · стена 3 1","vertexIds":["6259fe58-7e08-4e03-adf5-a3e23e70d299","8e9114bb-e05a-4f12-ba8b-1ae039c33ea7"],"thickness":0.2,"height":2.8,"wallKind":"internal","layerId":"walls"},{"id":"755de864-6cff-4988-9982-c999e84eb22d","type":"wall","name":"Комната 3×4 · стена 4 1","vertexIds":["8e9114bb-e05a-4f12-ba8b-1ae039c33ea7","3164a457-b88f-411a-b156-417de6acf139"],"thickness":0.2,"height":2.8,"wallKind":"internal","layerId":"walls"}],"openings":[{"id":"door-check","type":"door","name":"Дверь","wallId":"120e6e7c-413c-4f6a-a225-8b333fdc9be4","width":0.8,"offset":0.4,"anchor":"start","height":2.1,"hinge":"start","side":1,"kind":"single","layerId":"openings"}],"resources":[],"underlays":[],"rooms":[{"id":"db717cc9-f7d0-455e-b1a7-25084aeba106","name":"Комната 3×4","purpose":"Не задано","fill":"#edf3e7","labelOffset":{"x":0,"y":0},"active":true,"boundary":[{"wallId":"120e6e7c-413c-4f6a-a225-8b333fdc9be4","from":0,"to":1},{"wallId":"41656b87-d0cb-46f4-8c77-12760735429c","from":0,"to":1},{"wallId":"1558571b-8724-4d7e-be98-4d392ec50598","from":0,"to":1},{"wallId":"755de864-6cff-4988-9982-c999e84eb22d","from":0,"to":1}],"holes":[],"anchor":{"x":1.5000000000000002,"y":1.9999999999999998},"lastArea":11.999999999999996}],"dimensionChains":[{"wallId":"120e6e7c-413c-4f6a-a225-8b333fdc9be4","offset":0.5,"labelOffsets":[]}]}'::jsonb || jsonb_build_object('id',r->'id','revision',r->'revision');
 r := public.home_planer_save_project(d);
 if (r->>'revision')::int <> 5 or jsonb_array_length(r->'rooms')<>1 or abs((r->'rooms'->0->>'lastArea')::numeric-12)>0.000001 then raise exception 'v6 room save failed';end if;
 begin
  perform public.home_planer_save_project(r || '{"rooms":[{"id":"invalid"}]}'::jsonb);
  raise exception 'malformed room accepted';
 exception when invalid_parameter_value then null;end;
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
 if (r->>'revision')::int <> 6 then raise exception 'own asset save failed';end if;
 begin
  perform public.home_planer_save_project(r || jsonb_build_object('resources',jsonb_build_array(jsonb_build_object('id',repeat('b',64),'sha256',repeat('b',64)))));
  raise exception 'foreign asset reference accepted';
 exception when invalid_parameter_value then null;end;
 begin
  perform public.home_planer_save_project(r || '{"schemaVersion":5}'::jsonb || jsonb_build_object('layers',(r->'layers') - 14));
  raise exception 'downgrade was accepted';
 exception when sqlstate 'P0001' then
  get stacked diagnostics detail = PG_EXCEPTION_DETAIL;
  if detail is distinct from 'schema_conflict' then raise; end if;
 end;
 if has_table_privilege(current_user,'public.home_planer_phase2_stage4_backup','SELECT') then raise exception 'backup exposed'; end if;
 if not exists(select 1 from public.home_planer_projects where id='phase2-rollback-check' and revision=6 and document->>'schemaVersion'='6') then raise exception 'saved state incorrect'; end if;
end $test$;
reset role;
do $$ begin
 if not exists(select 1 from storage.buckets where id='home-planer-assets' and not public and file_size_limit=20971520) then raise exception 'bucket settings incorrect';end if;
end $$;
select 'PASS: v2-v6 save; room 3x4=12m2 and door/chain saved; malformed room rejected, own asset accepted, foreign read/upload/reference denied, update/delete denied, downgrade denied, private bucket and backup protected; transaction rolled back' as result;
rollback;
