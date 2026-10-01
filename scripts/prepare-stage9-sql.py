from pathlib import Path
sql=Path('supabase/migrations/202610010007_phase2_floors.sql').read_text(encoding='utf8').replace('stage8_backup','stage9_backup')
sql=sql.replace('-- Phase 2 stage 8: v10 floors, stairs and vertical routes.', '-- Phase 2 stage 9: optional output preferences in existing settings; schema remains v10.')
helper='''
-- Derived bills are not duplicated in tables; only explicit reserve/print preferences persist.
create or replace function public.home_planer_validate_output(d jsonb)
returns void language plpgsql set search_path='' as $$
declare o jsonb; p jsonb;
begin
 for o in select * from jsonb_path_query(d,'$.**.settings.output') loop
  p:=o->'print';
  if jsonb_typeof(o) is distinct from 'object' or jsonb_typeof(o->'reservePercent') is distinct from 'number'
  or (o->>'reservePercent')::numeric not between 0 and 100 or jsonb_typeof(p) is distinct from 'object'
  or coalesce(p->>'paper','') not in ('A4','A3') or coalesce(p->>'orientation','') not in ('portrait','landscape')
  or coalesce(p->>'mode','') not in ('scale','fit') or coalesce(p->>'overflow','') not in ('tile','reject')
  or coalesce(p->>'scope','') not in ('current','allFloors') or jsonb_typeof(p->'monochrome') is distinct from 'boolean'
  or jsonb_typeof(p->'north') is distinct from 'boolean' or jsonb_typeof(p->'views') is distinct from 'array'
  or jsonb_typeof(p->'scale') is distinct from 'number' or jsonb_typeof(p->'margin') is distinct from 'number'
  or jsonb_typeof(p->'overlap') is distinct from 'number' then raise exception 'Invalid output preferences' using errcode='22023';end if;
  if (p->>'scale')::numeric not between 10 and 1000 or (p->>'margin')::numeric not between 5 and 30
  or (p->>'overlap')::numeric not between 0 and 30 or jsonb_array_length(p->'views') not between 1 and 5
  or exists(select 1 from jsonb_array_elements(p->'views') v where jsonb_typeof(v) is distinct from 'string' or v #>> '{}' not in ('current','layout','electrical','plumbing','site'))
  or exists(select 1 from jsonb_array_elements(p->'views') v group by v having count(*)>1)
  then raise exception 'Invalid print scale/margins/views' using errcode='22023';end if;
 end loop;
end $$;
revoke all on function public.home_planer_validate_output(jsonb) from public,anon,authenticated;
'''
sql=sql.replace('create or replace function public.home_planer_save_project(p_document jsonb)',helper+'\ncreate or replace function public.home_planer_save_project(p_document jsonb)')
sql=sql.replace('-- Serializes concurrent first saves','perform public.home_planer_validate_output(p_document);\n -- Serializes concurrent first saves')
Path('supabase/migrations/202610010008_phase2_output.sql').write_text(sql,encoding='utf8')
verification=Path('supabase/phase2-stage8-verification.sql').read_text(encoding='utf8')
block='''
set local role authenticated;
do $output_test$
declare d jsonb; r jsonb; bad jsonb;
begin
 select document into d from public.home_planer_projects where id='phase2-floors-check';
 d:=jsonb_set(d,'{settings,output}','{"reservePercent":10,"print":{"paper":"A3","orientation":"landscape","mode":"scale","scale":100,"overflow":"tile","overlap":10,"margin":10,"monochrome":false,"north":true,"scope":"allFloors","views":["layout","plumbing","site"]}}'::jsonb);
 r:=public.home_planer_save_project(d);
 if r->'settings'->'output'->>'reservePercent' is distinct from '10' or r->'settings'->'output'->'print'->>'scale' is distinct from '100' then raise exception 'Output preferences lost';end if;
 bad:=jsonb_set(r,'{settings,output,reservePercent}','-1'::jsonb);
 begin perform public.home_planer_save_project(bad);raise exception 'Negative reserve accepted';exception when invalid_parameter_value then null;end;
 bad:=jsonb_set(r,'{settings,output,print,scale}','0'::jsonb);
 begin perform public.home_planer_save_project(bad);raise exception 'Zero scale accepted';exception when invalid_parameter_value then null;end;
 if has_table_privilege(current_user,'public.home_planer_phase2_stage9_backup','SELECT') then raise exception 'Output backup exposed';end if;
end $output_test$;
reset role;
select 'PASS: earlier v2-v10 checks plus explicit output preferences roundtrip; invalid reserve/scale rejected; backup private; rollback' as stage9_result;
'''
Path('supabase/phase2-stage9-verification.sql').write_text(verification.replace('rollback;',block+'\nrollback;'),encoding='utf8')
