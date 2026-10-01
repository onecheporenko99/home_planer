-- Phase 2 stage 7: v9 independent variants, notes, layer presets and immutable versions; preserve v2-v8 clients.
begin;
-- Snapshot before changing constraints/RPC, never overwritten on rerun.
create table if not exists public.home_planer_phase2_stage7_backup as select *, now() as backed_up_at from public.home_planer_projects;
alter table public.home_planer_phase2_stage7_backup enable row level security;
revoke all on public.home_planer_phase2_stage7_backup from public, anon, authenticated;
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.home_planer_projects'::regclass and contype='c' and pg_get_constraintdef(oid) like '%schemaVersion%'
 loop execute format('alter table public.home_planer_projects drop constraint %I',c.conname); end loop;
end $$;
alter table public.home_planer_projects add constraint home_planer_supported_schemas check ((document->>'schemaVersion')::integer in (2,3,4,5,6,7,8,9));
-- Validate stage 6 data inside the authenticated save RPC as well as in the client.
create or replace function public.home_planer_validate_site(d jsonb)
returns void language plpgsql set search_path = '' as $$
declare f jsonb; o jsonb; r jsonb; seg integer; a jsonb; b jsonb; len double precision; s jsonb := d->'settings'->'site';
begin
 if jsonb_typeof(d->'fences') is distinct from 'array' or jsonb_typeof(d->'clearanceRules') is distinct from 'array'
 or jsonb_typeof(s) is distinct from 'object' then raise exception 'Некорректные ограждения и зоны' using errcode='22023';end if;
 if jsonb_array_length(d->'fences')>100 or jsonb_array_length(d->'clearanceRules')>1000
 or jsonb_typeof(s->'intentional') is distinct from 'array' or jsonb_typeof(s->'showZones') is distinct from 'boolean'
 or jsonb_typeof(s->'northAngle') is distinct from 'number' or jsonb_typeof(s->'boundaryOffset') is distinct from 'number'
 or jsonb_typeof(s->'minPassage') is distinct from 'number' or jsonb_typeof(s->'northPosition'->'x') is distinct from 'number'
 or jsonb_typeof(s->'northPosition'->'y') is distinct from 'number' then raise exception 'Некорректные настройки участка' using errcode='22023';end if;
 if abs((s->>'northAngle')::numeric)>360 or (s->>'boundaryOffset')::numeric not between 0 and 100
 or (s->>'minPassage')::numeric not between 0 and 100 or abs((s->'northPosition'->>'x')::numeric)>1000000
 or abs((s->'northPosition'->>'y')::numeric)>1000000 or jsonb_array_length(s->'intentional')>10000 then raise exception 'Некорректные расстояния участка' using errcode='22023';end if;
 for f in select value from jsonb_array_elements(d->'fences') loop
  if coalesce(f->>'id','') !~ '^[a-zA-Z0-9-]{1,80}$' or jsonb_typeof(f->'name') is distinct from 'string'
  or coalesce(f->>'kind','') not in ('wood','metal','mesh','masonry') or coalesce(f->>'lastSpan','') not in ('remainder','equal')
  or jsonb_typeof(f->'points') is distinct from 'array' or jsonb_typeof(f->'segmentIds') is distinct from 'array'
  or jsonb_typeof(f->'openings') is distinct from 'array' or jsonb_typeof(f->'posts') is distinct from 'array'
  or jsonb_typeof(f->'sections') is distinct from 'array' or jsonb_typeof(f->'height') is distinct from 'number'
  or jsonb_typeof(f->'screenWidth') is distinct from 'number' or jsonb_typeof(f->'interval') is distinct from 'number'
  then raise exception 'Некорректное ограждение' using errcode='22023';end if;
  if jsonb_array_length(f->'points') not between 2 and 101 or jsonb_array_length(f->'segmentIds')<>jsonb_array_length(f->'points')-1
  or jsonb_array_length(f->'openings')>1000 or jsonb_array_length(f->'posts')+jsonb_array_length(f->'sections')>10000
  or (f->>'height')::numeric<=0 or (f->>'height')::numeric>1000 or (f->>'interval')::numeric<=0 or (f->>'interval')::numeric>1000
  or (f->>'screenWidth')::numeric<=0 or (f->>'screenWidth')::numeric>20 then raise exception 'Некорректные размеры ограждения' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(f->'points') q where jsonb_typeof(q->'x') is distinct from 'number' or jsonb_typeof(q->'y') is distinct from 'number' or abs((q->>'x')::numeric)>1000000 or abs((q->>'y')::numeric)>1000000)
  then raise exception 'Некорректные координаты ограждения' using errcode='22023';end if;
  for seg in 0..jsonb_array_length(f->'segmentIds')-1 loop
   a:=f->'points'->seg;b:=f->'points'->(seg+1);len:=sqrt(power((b->>'x')::double precision-(a->>'x')::double precision,2)+power((b->>'y')::double precision-(a->>'y')::double precision,2));
   if len<0.00001 then raise exception 'Нулевой сегмент ограждения' using errcode='22023';end if;
  end loop;
  if exists(select 1 from jsonb_array_elements_text(f->'segmentIds') value where value !~ '^[a-zA-Z0-9-]{1,80}$') then raise exception 'Неверный ID сегмента' using errcode='22023';end if;
  for r in select value from jsonb_array_elements((f->'posts') || (f->'sections')) loop
   select ordinality::integer-1 into seg from jsonb_array_elements_text(f->'segmentIds') with ordinality as ids(value,ordinality) where value=r->>'segmentId';
   if seg is null or coalesce(r->>'id','') !~ '^[a-zA-Z0-9-]{1,80}$' then raise exception 'Некорректный элемент ограждения' using errcode='22023';end if;
   a:=f->'points'->seg;b:=f->'points'->(seg+1);len:=sqrt(power((b->>'x')::double precision-(a->>'x')::double precision,2)+power((b->>'y')::double precision-(a->>'y')::double precision,2));
   if r ? 'offset' then
    if jsonb_typeof(r->'offset') is distinct from 'number' or (r->>'offset')::numeric<0 or (r->>'offset')::numeric>len+0.0000001 then raise exception 'Столб выходит из сегмента' using errcode='22023';end if;
   else
    if jsonb_typeof(r->'start') is distinct from 'number' or jsonb_typeof(r->'end') is distinct from 'number' or (r->>'start')::numeric<0 or (r->>'end')::numeric<=(r->>'start')::numeric or (r->>'end')::numeric>len+0.0000001 then raise exception 'Некорректная секция' using errcode='22023';end if;
   end if;
  end loop;
  for o in select value from jsonb_array_elements(f->'openings') loop
   select ordinality::integer-1 into seg from jsonb_array_elements_text(f->'segmentIds') with ordinality as ids(value,ordinality) where value=o->>'segmentId';
   if seg is null or coalesce(o->>'id','') !~ '^[a-zA-Z0-9-]{1,80}$' or coalesce(o->>'kind','') not in ('swing','sliding','wicket')
   or coalesce(o->>'side','') not in ('1','-1') or coalesce(o->>'hinge','') not in ('start','end')
   or jsonb_typeof(o->'width') is distinct from 'number' or jsonb_typeof(o->'offset') is distinct from 'number'
   then raise exception 'Некорректные ворота или калитка' using errcode='22023';end if;
   a:=f->'points'->seg;b:=f->'points'->(seg+1);len:=sqrt(power((b->>'x')::double precision-(a->>'x')::double precision,2)+power((b->>'y')::double precision-(a->>'y')::double precision,2));
   if (o->>'width')::numeric<=0 or (o->>'offset')::numeric<0 or (o->>'offset')::numeric+(o->>'width')::numeric>len+0.0000001 then raise exception 'Проём выходит из сегмента' using errcode='22023';end if;
   if exists(select 1 from jsonb_array_elements(f->'openings') other where other->>'id'<>o->>'id' and other->>'segmentId'=o->>'segmentId' and (other->>'offset')::numeric<(o->>'offset')::numeric+(o->>'width')::numeric-0.0000001 and (o->>'offset')::numeric<(other->>'offset')::numeric+(other->>'width')::numeric-0.0000001) then raise exception 'Проёмы пересекаются' using errcode='22023';end if;
  end loop;
 end loop;
 if exists(select 1 from jsonb_array_elements(s->'intentional') x where jsonb_typeof(x) is distinct from 'string' or char_length(x #>> '{}')>300) then raise exception 'Некорректные отметки замечаний' using errcode='22023';end if;
 if exists(select 1 from (
  select key as id from jsonb_each(d->'nodes')
  union all select x->>'id' from jsonb_array_elements((d->'objects') || (d->'openings') || (d->'groups') || (d->'rooms') || (d->'library') || (d->'clearanceRules') || (d->'fences')) x
  union all select x->>'id' from jsonb_array_elements(d->'fences') as chain_rows(fence_doc) cross join lateral jsonb_array_elements((fence_doc->'openings') || (fence_doc->'posts') || (fence_doc->'sections')) x
  union all select x from jsonb_array_elements(d->'fences') as chain_rows(fence_doc) cross join lateral jsonb_array_elements_text(fence_doc->'segmentIds') x
 ) all_ids group by id having count(*)>1) then raise exception 'Повторяющиеся ID участка' using errcode='22023';end if;
 for r in select value from jsonb_array_elements(d->'clearanceRules') loop
  if coalesce(r->>'id','') !~ '^[a-zA-Z0-9-]{1,80}$' or jsonb_typeof(r->'objectId') is distinct from 'string'
  or coalesce(r->>'side','') not in ('front','back','left','right') or jsonb_typeof(r->'depth') is distinct from 'number'
  or (r->>'depth')::numeric<=0 or (r->>'depth')::numeric>1000 then raise exception 'Некорректная зона свободного места' using errcode='22023';end if;
 end loop;
end $$;
revoke all on function public.home_planer_validate_site(jsonb) from public, anon, authenticated;

-- Immutable saved revisions; clients read only their own records.
create table if not exists public.home_planer_versions (
 owner_id uuid not null references auth.users(id) on delete cascade,
 project_id text not null,
 revision bigint not null check(revision>0),
 label text check(label is null or char_length(label) between 1 and 80),
 created_at timestamptz not null default now(),
 document jsonb not null,
 primary key(owner_id,project_id,revision)
);
alter table public.home_planer_versions enable row level security;
revoke all on public.home_planer_versions from public,anon,authenticated;
grant select on public.home_planer_versions to authenticated;
drop policy if exists home_planer_versions_read on public.home_planer_versions;
create policy home_planer_versions_read on public.home_planer_versions for select to authenticated using(owner_id=(select auth.uid()));
insert into public.home_planer_versions(owner_id,project_id,revision,created_at,document)
 select owner_id,id,revision,updated_at,document from public.home_planer_projects where revision>0 on conflict do nothing;
insert into public.home_planer_versions(owner_id,project_id,revision,created_at,document)
 select owner_id,id,(previous_document->>'revision')::bigint,coalesce((previous_document->>'updatedAt')::timestamptz,updated_at),previous_document from public.home_planer_projects where previous_document is not null and coalesce((previous_document->>'revision')::bigint,0)>0 on conflict do nothing;
create or replace function public.home_planer_validate_workspace(d jsonb)
returns void language plpgsql set search_path='' as $$
declare w jsonb:=d->'workspace';v jsonb;n jsonb;photo jsonb;view_doc jsonb;notes_doc jsonb;
begin
 if jsonb_typeof(w) is distinct from 'object' or jsonb_typeof(w->'variants') is distinct from 'array'
 or jsonb_typeof(d->'notes') is distinct from 'array' or jsonb_typeof(d->'viewPresets') is distinct from 'array'
 then raise exception 'Некорректные варианты и заметки' using errcode='22023';end if;
 if jsonb_array_length(w->'variants') not between 1 and 12 or jsonb_array_length(d->'notes')>500 or jsonb_array_length(d->'viewPresets')>50
 or not exists(select 1 from jsonb_array_elements(w->'variants') x where x->>'id'=w->>'activeVariantId')
 or exists(select 1 from jsonb_array_elements(w->'variants') x group by x->>'id' having count(*)>1)
 then raise exception 'Некорректный активный вариант' using errcode='22023';end if;
 for v in select value from jsonb_array_elements(w->'variants') loop
  if coalesce(v->>'id','') !~ '^[a-zA-Z0-9-]{1,80}$' or jsonb_typeof(v->'name') is distinct from 'string'
  or char_length(btrim(v->>'name')) not between 1 and 80 or v->'document'->>'schemaVersion' is distinct from '8'
  or v->'document' ? 'workspace' or v->'document' ? 'notes' or v->'document' ? 'viewPresets'
  or jsonb_typeof(v->'notes') is distinct from 'array' or jsonb_array_length(v->'notes')>500
  then raise exception 'Некорректный снимок варианта' using errcode='22023';end if;
  if jsonb_typeof(v->'document'->'nodes') is distinct from 'object' or jsonb_typeof(v->'document'->'objects') is distinct from 'array'
  or jsonb_typeof(v->'document'->'openings') is distinct from 'array' or jsonb_typeof(v->'document'->'resources') is distinct from 'array'
  or jsonb_typeof(v->'document'->'layers') is distinct from 'array' or jsonb_array_length(v->'document'->'layers')<>18
  then raise exception 'Некорректная геометрия варианта' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(v->'document'->'resources') resource_doc where not exists(select 1 from jsonb_array_elements(d->'resources') shared_doc where shared_doc->>'id'=resource_doc->>'id')) then raise exception 'Файл варианта отсутствует в общей библиотеке' using errcode='22023';end if;
  perform public.home_planer_validate_site(v->'document');
 end loop;
 for notes_doc in select d->'notes' union all select variant_doc->'notes' from jsonb_array_elements(w->'variants') variant_doc loop
  if exists(select 1 from jsonb_array_elements(notes_doc) x group by x->>'id' having count(*)>1) then raise exception 'Повторные ID заметок' using errcode='22023';end if;
  for n in select value from jsonb_array_elements(notes_doc) loop
   if coalesce(n->>'id','') !~ '^[a-zA-Z0-9-]{1,80}$' or jsonb_typeof(n->'text') is distinct from 'string' or char_length(n->>'text')>2000
   or jsonb_typeof(n->'photoIds') is distinct from 'array' or jsonb_array_length(n->'photoIds')>10
   or jsonb_typeof(n->'position'->'x') is distinct from 'number' or jsonb_typeof(n->'position'->'y') is distinct from 'number'
   or jsonb_typeof(n->'offset'->'x') is distinct from 'number' or jsonb_typeof(n->'offset'->'y') is distinct from 'number'
   then raise exception 'Некорректная заметка' using errcode='22023';end if;
   if abs((n->'position'->>'x')::numeric)>1000000 or abs((n->'position'->>'y')::numeric)>1000000 or abs((n->'offset'->>'x')::numeric)>1000000 or abs((n->'offset'->>'y')::numeric)>1000000 then raise exception 'Неверная точка заметки' using errcode='22023';end if;
   for photo in select value from jsonb_array_elements(n->'photoIds') loop
    if jsonb_typeof(photo) is distinct from 'string' or not exists(select 1 from jsonb_array_elements(d->'resources') resource_doc where resource_doc->>'id'=photo #>> '{}' and resource_doc->>'mimeType' like 'image/%') then raise exception 'Фото заметки не найдено' using errcode='22023';end if;
   end loop;
  end loop;
 end loop;
 for view_doc in select value from jsonb_array_elements(d->'viewPresets') loop
  if coalesce(view_doc->>'id','') !~ '^[a-zA-Z0-9-]{1,80}$' or jsonb_typeof(view_doc->'name') is distinct from 'string'
  or char_length(btrim(view_doc->>'name')) not between 1 and 80 or jsonb_typeof(view_doc->'visibility') is distinct from 'object' then raise exception 'Некорректный набор видимости' using errcode='22023';end if;
  if exists(select 1 from jsonb_each(view_doc->'visibility') visible_layer where jsonb_typeof(visible_layer.value) is distinct from 'boolean' or not exists(select 1 from jsonb_array_elements(d->'layers') layer_doc where layer_doc->>'id'=visible_layer.key)) then raise exception 'Неизвестный слой набора' using errcode='22023';end if;
 end loop;
end $$;
revoke all on function public.home_planer_validate_workspace(jsonb) from public,anon,authenticated;

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
 or coalesce(p_document->>'schemaVersion','') not in ('2','3','4','5','6','7','8','9')
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
 or jsonb_array_length(p_document->'layers') <> (case when p_document->>'schemaVersion'='9' then 19 when p_document->>'schemaVersion'='8' then 18 when p_document->>'schemaVersion'='7' then 16 when p_document->>'schemaVersion'='6' then 15 when p_document->>'schemaVersion'='5' then 14 when p_document->>'schemaVersion'='4' then 13 else 11 end)
 then raise exception 'Некорректный размер проекта' using errcode = '22023'; end if;

 if p_document->>'schemaVersion' in ('5','6','7','8','9') then
  if jsonb_typeof(p_document->'resources') is distinct from 'array' or jsonb_typeof(p_document->'underlays') is distinct from 'array' then raise exception 'Некорректные ресурсы' using errcode='22023';end if;
  if jsonb_array_length(p_document->'resources')>200 or jsonb_array_length(p_document->'underlays')>100 then raise exception 'Слишком много ресурсов' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(p_document->'resources') r where coalesce(r->>'id','') !~ '^[a-f0-9]{64}$' or r->>'sha256' is distinct from r->>'id' or not exists(select 1 from storage.objects o where o.bucket_id='home-planer-assets' and o.name=v_owner::text||'/'||(r->>'id'))) then raise exception 'Файл ресурса не загружен или принадлежит другому пользователю' using errcode='22023';end if;
 end if;
 if p_document->>'schemaVersion' in ('6','7','8','9') then
  if jsonb_typeof(p_document->'rooms') is distinct from 'array' or jsonb_typeof(p_document->'dimensionChains') is distinct from 'array' or jsonb_typeof(p_document->'settings'->'measurements') is distinct from 'object' then raise exception 'Некорректные комнаты и измерения' using errcode='22023';end if;
  if jsonb_array_length(p_document->'rooms')>1000 or jsonb_array_length(p_document->'dimensionChains')>1000 then raise exception 'Слишком много комнат или размеров' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(p_document->'rooms') r where coalesce(r->>'id','') !~ '^[a-zA-Z0-9-]{1,80}$' or jsonb_typeof(r->'name') is distinct from 'string' or char_length(r->>'name')>200 or jsonb_typeof(r->'purpose') is distinct from 'string' or coalesce(r->>'fill','') !~ '^#[a-fA-F0-9]{6}$' or jsonb_typeof(r->'active') is distinct from 'boolean' or jsonb_typeof(r->'boundary') is distinct from 'array' or jsonb_typeof(r->'holes') is distinct from 'array') then raise exception 'Некорректная комната' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(p_document->'rooms') r group by r->>'id' having count(*)>1) then raise exception 'Повторяющиеся ID комнат' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(p_document->'rooms') r cross join lateral jsonb_array_elements(r->'boundary') e where r->>'active'='true' and not exists(select 1 from jsonb_array_elements(p_document->'objects') o where o->>'id'=e->>'wallId' and o->>'type'='wall')) then raise exception 'Не найдена стена комнаты' using errcode='22023';end if;
 end if;

 if p_document->>'schemaVersion' in ('7','8','9') then
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
 if p_document->>'schemaVersion' in ('8','9') then perform public.home_planer_validate_site(p_document);end if;
 if p_document->>'schemaVersion'='9' then perform public.home_planer_validate_workspace(p_document);end if;
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
 if coalesce(v_old.revision,0)>0 then
  insert into public.home_planer_versions(owner_id,project_id,revision,created_at,document) values(v_owner,v_id,v_old.revision,v_old.updated_at,v_old.document) on conflict do nothing;
 end if;
 insert into public.home_planer_versions(owner_id,project_id,revision,created_at,document) values(v_owner,v_id,v_revision+1,v_time,v_next);
 return v_next;
end;
$$;
revoke all on function public.home_planer_save_project(jsonb) from public, anon;
grant execute on function public.home_planer_save_project(jsonb) to authenticated;
create or replace function public.home_planer_create_checkpoint(p_document jsonb,p_name text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved jsonb;
begin
 if p_name is null or char_length(btrim(p_name)) not between 1 and 80 then raise exception 'Название контрольной точки: от 1 до 80 символов' using errcode='22023';end if;
 saved:=public.home_planer_save_project(p_document);
 update public.home_planer_versions set label=btrim(p_name) where owner_id=auth.uid() and project_id=saved->>'id' and revision=(saved->>'revision')::bigint;
 return saved;
end $$;
revoke all on function public.home_planer_create_checkpoint(jsonb,text) from public,anon;
grant execute on function public.home_planer_create_checkpoint(jsonb,text) to authenticated;
commit;
