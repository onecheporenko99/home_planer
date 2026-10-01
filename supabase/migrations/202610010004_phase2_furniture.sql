-- Phase 2 stage 5: v7 furniture and groups; preserve v2-v6 clients.
begin;
-- Snapshot before changing constraints/RPC, never overwritten on rerun.
create table if not exists public.home_planer_phase2_stage5_backup as select *, now() as backed_up_at from public.home_planer_projects;
alter table public.home_planer_phase2_stage5_backup enable row level security;
revoke all on public.home_planer_phase2_stage5_backup from public, anon, authenticated;
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.home_planer_projects'::regclass and contype='c' and pg_get_constraintdef(oid) like '%schemaVersion%'
 loop execute format('alter table public.home_planer_projects drop constraint %I',c.conname); end loop;
end $$;
alter table public.home_planer_projects add constraint home_planer_supported_schemas check ((document->>'schemaVersion')::integer in (2,3,4,5,6,7));
create or replace function public.home_planer_save_project(p_document jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_owner uuid := auth.uid();
 v_id text := p_document->>'id';
 v_revision bigint;
 v_old public.home_planer_projects%rowtype;
 v_next jsonb;
 v_time timestamptz := now();
begin
 if v_owner is null then raise exception 'Требуется вход' using errcode = '42501'; end if;
 if p_document is null or jsonb_typeof(p_document) <> 'object' or octet_length(p_document::text) > 5242880
 or v_id is null or v_id !~ '^[a-zA-Z0-9-]{1,80}$'
 or jsonb_typeof(p_document->'name') is distinct from 'string' or char_length(p_document->>'name') > 200
 or coalesce(p_document->>'schemaVersion','') not in ('2','3','4','5','6','7')
 or jsonb_typeof(p_document->'nodes') is distinct from 'object'
 or jsonb_typeof(p_document->'objects') is distinct from 'array'
 or jsonb_typeof(p_document->'openings') is distinct from 'array'
 or jsonb_typeof(p_document->'layers') is distinct from 'array'
 or jsonb_typeof(p_document->'settings') is distinct from 'object'
 or jsonb_typeof(p_document->'revision') is distinct from 'number'
 or p_document->>'revision' !~ '^[0-9]+$'
 then raise exception 'Некорректный проект' using errcode = '22023'; end if;
 v_revision := (p_document->>'revision')::bigint;
 if v_revision < 0 or v_revision >= 9007199254740991
 or jsonb_array_length(p_document->'objects') > 10000
 or jsonb_array_length(p_document->'openings') > 10000
 or jsonb_array_length(p_document->'layers') <> (case when p_document->>'schemaVersion'='7' then 16 when p_document->>'schemaVersion'='6' then 15 when p_document->>'schemaVersion'='5' then 14 when p_document->>'schemaVersion'='4' then 13 else 11 end)
 then raise exception 'Некорректный размер проекта' using errcode = '22023'; end if;

 if p_document->>'schemaVersion' in ('5','6','7') then
  if jsonb_typeof(p_document->'resources') is distinct from 'array' or jsonb_typeof(p_document->'underlays') is distinct from 'array' then raise exception 'Некорректные ресурсы' using errcode='22023';end if;
  if jsonb_array_length(p_document->'resources')>200 or jsonb_array_length(p_document->'underlays')>100 then raise exception 'Слишком много ресурсов' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(p_document->'resources') r where coalesce(r->>'id','') !~ '^[a-f0-9]{64}$' or r->>'sha256' is distinct from r->>'id' or not exists(select 1 from storage.objects o where o.bucket_id='home-planer-assets' and o.name=v_owner::text||'/'||(r->>'id'))) then raise exception 'Файл ресурса не загружен или принадлежит другому пользователю' using errcode='22023';end if;
 end if;
 if p_document->>'schemaVersion' in ('6','7') then
  if jsonb_typeof(p_document->'rooms') is distinct from 'array' or jsonb_typeof(p_document->'dimensionChains') is distinct from 'array' or jsonb_typeof(p_document->'settings'->'measurements') is distinct from 'object' then raise exception 'Некорректные комнаты и измерения' using errcode='22023';end if;
  if jsonb_array_length(p_document->'rooms')>1000 or jsonb_array_length(p_document->'dimensionChains')>1000 then raise exception 'Слишком много комнат или размеров' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(p_document->'rooms') r where coalesce(r->>'id','') !~ '^[a-zA-Z0-9-]{1,80}$' or jsonb_typeof(r->'name') is distinct from 'string' or char_length(r->>'name')>200 or jsonb_typeof(r->'purpose') is distinct from 'string' or coalesce(r->>'fill','') !~ '^#[a-fA-F0-9]{6}$' or jsonb_typeof(r->'active') is distinct from 'boolean' or jsonb_typeof(r->'boundary') is distinct from 'array' or jsonb_typeof(r->'holes') is distinct from 'array') then raise exception 'Некорректная комната' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(p_document->'rooms') r group by r->>'id' having count(*)>1) then raise exception 'Повторяющиеся ID комнат' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(p_document->'rooms') r cross join lateral jsonb_array_elements(r->'boundary') e where r->>'active'='true' and not exists(select 1 from jsonb_array_elements(p_document->'objects') o where o->>'id'=e->>'wallId' and o->>'type'='wall')) then raise exception 'Не найдена стена комнаты' using errcode='22023';end if;
 end if;

 if p_document->>'schemaVersion'='7' then
  if jsonb_typeof(p_document->'groups') is distinct from 'array' or jsonb_typeof(p_document->'library') is distinct from 'array' or jsonb_typeof(p_document->'catalogPreferences') is distinct from 'object' then raise exception 'Некорректные группы и библиотека' using errcode='22023';end if;
  if jsonb_array_length(p_document->'groups')>1000 or jsonb_array_length(p_document->'library')>200 then raise exception 'Слишком много групп или шаблонов' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(p_document->'groups') g where coalesce(g->>'id','') !~ '^[a-zA-Z0-9-]{1,80}$' or jsonb_typeof(g->'name') is distinct from 'string' or char_length(g->>'name')>200 or jsonb_typeof(g->'locked') is distinct from 'boolean' or jsonb_typeof(g->'anchor'->'x') is distinct from 'number' or jsonb_typeof(g->'anchor'->'y') is distinct from 'number' or jsonb_typeof(g->'memberIds') is distinct from 'array') then raise exception 'Некорректная группа' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(p_document->'groups') g where jsonb_array_length(g->'memberIds')=0 or jsonb_array_length(g->'memberIds')>10000) then raise exception 'Некорректный состав группы' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(p_document->'groups') g cross join lateral jsonb_array_elements_text(g->'memberIds') as m(member_id) where not exists(select 1 from jsonb_array_elements((p_document->'objects')||(p_document->'openings')||(p_document->'groups')) e where e->>'id'=m.member_id)) then raise exception 'Не найден участник группы' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(p_document->'groups') g cross join lateral jsonb_array_elements_text(g->'memberIds') as m(member_id) group by m.member_id having count(*)>1) then raise exception 'Двойное членство в группе' using errcode='22023';end if;
  if exists(with recursive walk as (select g->>'id' as root,g->>'id' as node,array[g->>'id'] as path,false as cycle from jsonb_array_elements(p_document->'groups') g union all select w.root,m.member_id,w.path||m.member_id,m.member_id=any(w.path) from walk w join lateral (select g from jsonb_array_elements(p_document->'groups') g where g->>'id'=w.node) child on true cross join lateral jsonb_array_elements_text(child.g->'memberIds') as m(member_id) where not w.cycle and cardinality(w.path)<=100) select 1 from walk where cycle or cardinality(path)>100) then raise exception 'Цикл или слишком глубокая вложенность групп' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements((p_document->'objects')||(p_document->'openings')||(p_document->'groups')||(p_document->'library')||(p_document->'rooms')||(p_document->'underlays')||(p_document->'resources')||coalesce(p_document->'jointConstraints','[]'::jsonb)) e group by e->>'id' having count(*)>1) then raise exception 'Повторяющиеся ID' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(p_document->'library') t where coalesce(t->>'id','') !~ '^[a-zA-Z0-9-]{1,80}$' or jsonb_typeof(t->'name') is distinct from 'string' or char_length(t->>'name')>200 or coalesce(t->>'type','') not in ('object','set')) then raise exception 'Некорректный шаблон' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(p_document->'library') t where t->>'type'='object' and (coalesce(t->'spec'->>'shape','') not in ('rectangle','circle','polygon') or jsonb_typeof(t->'spec'->'category') is distinct from 'string' or jsonb_typeof(t->'width') is distinct from 'number' or jsonb_typeof(t->'depth') is distinct from 'number' or jsonb_typeof(t->'height') is distinct from 'number')) then raise exception 'Некорректный предмет шаблона' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(p_document->'library') t where t->>'type'='object' and ((t->>'width')::numeric<=0 or (t->>'width')::numeric>=1000 or (t->>'depth')::numeric<=0 or (t->>'depth')::numeric>=1000 or (t->>'height')::numeric<=0 or (t->>'height')::numeric>=1000)) then raise exception 'Некорректные размеры шаблона' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(p_document->'library') t where t->>'type'='set' and (t->'document'->>'schemaVersion' is distinct from '7' or t->'document'->'library' is distinct from '[]'::jsonb or t->'document'->'resources' is distinct from '[]'::jsonb or t->'document'->'underlays' is distinct from '[]'::jsonb or jsonb_typeof(t->'document'->'objects') is distinct from 'array')) then raise exception 'Некорректный набор' using errcode='22023';end if;
  if jsonb_typeof(p_document->'catalogPreferences'->'favorites') is distinct from 'array' or jsonb_typeof(p_document->'catalogPreferences'->'recent') is distinct from 'array' then raise exception 'Некорректное избранное' using errcode='22023';end if;
 end if;
 -- Serializes concurrent first saves as well as updates for this owner/project.
 perform pg_advisory_xact_lock(hashtextextended(v_owner::text || ':' || v_id, 0));
 for v_old in select * from public.home_planer_projects where owner_id = v_owner and id = v_id for update loop exit; end loop;
 if coalesce(v_old.revision, 0) <> v_revision then
  raise exception 'Проект изменён на другом устройстве' using errcode = 'P0001', detail = 'revision_conflict';
 end if;
 if coalesce((v_old.document->>'schemaVersion')::integer,2) > (p_document->>'schemaVersion')::integer then
  raise exception 'Старый клиент не может перезаписать расширенный проект' using errcode='P0001', detail='schema_conflict';
 end if;
 v_next := p_document || jsonb_build_object('revision',v_revision+1,'updatedAt',v_time,
  'createdAt',coalesce(v_old.created_at,v_time));
 insert into public.home_planer_projects (owner_id,id,name,revision,document,previous_document,created_at,updated_at)
 values (v_owner,v_id,p_document->>'name',v_revision+1,v_next,v_old.document,coalesce(v_old.created_at,v_time),v_time)
 on conflict (owner_id,id) do update set name=excluded.name,revision=excluded.revision,
 document=excluded.document,previous_document=excluded.previous_document,updated_at=excluded.updated_at;
 return v_next;
end;
$$;
revoke all on function public.home_planer_save_project(jsonb) from public, anon;
grant execute on function public.home_planer_save_project(jsonb) to authenticated;
commit;
