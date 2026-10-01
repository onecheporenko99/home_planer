-- Phase 2 stage 2: additive v4 support; v2/v3 clients retain their supported documents.
begin;
-- Snapshot before changing constraints/RPC, never overwritten on rerun.
create table if not exists public.home_planer_phase2_stage2_backup as select *, now() as backed_up_at from public.home_planer_projects;
alter table public.home_planer_phase2_stage2_backup enable row level security;
revoke all on public.home_planer_phase2_stage2_backup from public, anon, authenticated;
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.home_planer_projects'::regclass and contype='c' and pg_get_constraintdef(oid) like '%schemaVersion%'
 loop execute format('alter table public.home_planer_projects drop constraint %I',c.conname); end loop;
end $$;
alter table public.home_planer_projects add constraint home_planer_supported_schemas check ((document->>'schemaVersion')::integer in (2,3,4));
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
 or coalesce(p_document->>'schemaVersion','') not in ('2','3','4')
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
 or jsonb_array_length(p_document->'layers') <> (case when p_document->>'schemaVersion'='4' then 13 else 11 end)
 then raise exception 'Некорректный размер проекта' using errcode = '22023'; end if;

 -- Serializes concurrent first saves as well as updates for this owner/project.
 perform pg_advisory_xact_lock(hashtextextended(v_owner::text || ':' || v_id, 0));
 select * into v_old from public.home_planer_projects where owner_id = v_owner and id = v_id for update;
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
