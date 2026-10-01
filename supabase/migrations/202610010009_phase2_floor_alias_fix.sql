-- Fix ambiguous PL/pgSQL/SQL names; leaves project data and access rules unchanged.
begin;
create or replace function public.home_planer_validate_floors(d jsonb)
returns void language plpgsql set search_path='' as $$
declare m jsonb:=d->'floorModel'; f jsonb; rec jsonb; doc jsonb; n jsonb; s jsonb; lo jsonb; hi jsonb; a jsonb; b jsonb; route_a jsonb; route_b jsonb; rise numeric;
begin
 if jsonb_typeof(m) is distinct from 'object' or jsonb_typeof(m->'levels') is distinct from 'array'
 or jsonb_typeof(m->'stairs') is distinct from 'array' or jsonb_typeof(m->'verticalLinks') is distinct from 'array'
 or jsonb_typeof(m->'showSite') is distinct from 'boolean' or jsonb_typeof(m->'snapTrace') is distinct from 'boolean'
 or not (m ? 'activeFloorId') or not (m ? 'traceFloorId') then raise exception 'Invalid floor model' using errcode='22023';end if;
 if jsonb_array_length(m->'levels')>100 or jsonb_array_length(m->'stairs')>100 or jsonb_array_length(m->'verticalLinks')>1000 then raise exception 'Too many floors or links' using errcode='22023';end if;
 if (m->>'activeFloorId' is not null and not exists(select 1 from jsonb_array_elements(m->'levels') level_row where level_row->>'id'=m->>'activeFloorId'))
 or (m->>'traceFloorId' is not null and not exists(select 1 from jsonb_array_elements(m->'levels') level_row where level_row->>'id'=m->>'traceFloorId')) then raise exception 'Missing active/tracing floor' using errcode='22023';end if;
 for rec in select m->'site' union all select value from jsonb_array_elements(m->'levels') loop
  doc:=rec->'document';
  if doc->>'schemaVersion' is distinct from '8' or doc ? 'floorModel' or doc ? 'workspace' or doc ? 'variantSnapshot'
  or jsonb_typeof(doc->'nodes') is distinct from 'object' or jsonb_typeof(doc->'objects') is distinct from 'array'
  or jsonb_typeof(doc->'openings') is distinct from 'array' or jsonb_typeof(doc->'layers') is distinct from 'array'
  or jsonb_typeof(doc->'resources') is distinct from 'array' or jsonb_typeof(rec->'notes') is distinct from 'array'
  then raise exception 'Invalid floor plan' using errcode='22023';end if;
  if jsonb_array_length(doc->'layers')<>18 or jsonb_array_length(doc->'objects')>10000 or jsonb_array_length(doc->'openings')>10000 or jsonb_array_length(rec->'notes')>500 then raise exception 'Floor plan exceeds limits' using errcode='22023';end if;
  perform public.home_planer_validate_site(doc);
  if exists(select 1 from jsonb_array_elements(doc->'resources') r where not exists(select 1 from jsonb_array_elements(d->'resources') shared where shared->>'id'=r->>'id' and shared->>'sha256'=r->>'sha256' and shared->>'mimeType'=r->>'mimeType' and shared->'byteLength'=r->'byteLength' and shared->'width' is not distinct from r->'width' and shared->'height' is not distinct from r->'height')) then raise exception 'Floor resource absent or metadata mismatch' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(doc->'objects') o cross join lateral jsonb_array_elements_text(o->'vertexIds') vertex_id where not (doc->'nodes' ? vertex_id)) then raise exception 'Missing floor node' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(doc->'openings') o where not exists(select 1 from jsonb_array_elements(doc->'objects') wall where wall->>'id'=o->>'wallId' and wall->>'type'='wall')) then raise exception 'Missing opening wall' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(rec->'notes') note_row group by note_row->>'id' having count(*)>1) then raise exception 'Repeated floor note ID' using errcode='22023';end if;
  for n in select value from jsonb_array_elements(rec->'notes') loop
   if coalesce(n->>'id','') !~ '^[a-zA-Z0-9-]{1,80}$' or jsonb_typeof(n->'text') is distinct from 'string' or char_length(n->>'text')>2000 or jsonb_typeof(n->'photoIds') is distinct from 'array' or jsonb_array_length(n->'photoIds')>10
   or jsonb_typeof(n->'position'->'x') is distinct from 'number' or jsonb_typeof(n->'position'->'y') is distinct from 'number' or jsonb_typeof(n->'offset'->'x') is distinct from 'number' or jsonb_typeof(n->'offset'->'y') is distinct from 'number' then raise exception 'Invalid floor note' using errcode='22023';end if;
   if exists(select 1 from jsonb_array_elements_text(n->'photoIds') photo where not exists(select 1 from jsonb_array_elements(d->'resources') r where r->>'id'=photo and r->>'mimeType' like 'image/%')) then raise exception 'Missing floor photo' using errcode='22023';end if;
  end loop;
 end loop;
 if exists(select 1 from (select level_row->>'id' id from jsonb_array_elements(m->'levels') level_row union all select stair_row->>'id' from jsonb_array_elements(m->'stairs') stair_row union all select stair_row->'opening'->>'id' from jsonb_array_elements(m->'stairs') stair_row union all select l->>'id' from jsonb_array_elements(m->'verticalLinks') l) ids group by id having count(*)>1 or coalesce(id,'') !~ '^[a-zA-Z0-9-]{1,80}$') then raise exception 'Invalid or repeated floor/link ID' using errcode='22023';end if;
 for f in select value from jsonb_array_elements(m->'levels') loop
  if jsonb_typeof(f->'name') is distinct from 'string' or char_length(btrim(f->>'name')) not between 1 and 80 or jsonb_typeof(f->'elevation') is distinct from 'number' or jsonb_typeof(f->'height') is distinct from 'number' then raise exception 'Invalid floor metadata' using errcode='22023';end if;
  if abs((f->>'elevation')::numeric)>1000 or (f->>'height')::numeric<=0 or (f->>'height')::numeric>100
  or not exists(select 1 from jsonb_array_elements(m->'site'->'document'->'objects') building_row where building_row->>'id'=f->>'buildingId' and building_row->>'type'='building') then raise exception 'Invalid floor building/elevation/height' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(m->'levels') other where other->>'id'<>f->>'id' and other->>'buildingId'=f->>'buildingId' and abs((other->>'elevation')::numeric-(f->>'elevation')::numeric)<0.0000001) then raise exception 'Duplicate building elevation' using errcode='22023';end if;
 end loop;
 for s in select value from jsonb_array_elements(m->'stairs') loop
  select value into lo from jsonb_array_elements(m->'levels') where value->>'id'=s->>'lowerId';select value into hi from jsonb_array_elements(m->'levels') where value->>'id'=s->>'upperId';
  if lo is null or hi is null or lo->>'buildingId' is distinct from s->>'buildingId' or hi->>'buildingId' is distinct from s->>'buildingId' or coalesce(s->>'kind','') not in ('straight','L','U') or coalesce(s->>'turn','') not in ('left','right') or coalesce(s->>'direction','') not in ('1','-1')
  or jsonb_typeof(s->'opening'->'enabled') is distinct from 'boolean' then raise exception 'Invalid stair levels or shape' using errcode='22023';end if;
  if exists(select 1 from jsonb_each(s) e where e.key in ('x','y','rotation','steps','riser','tread','flightWidth','landing','gap') and jsonb_typeof(e.value) is distinct from 'number') or not (s ?& array['x','y','rotation','steps','riser','tread','flightWidth','landing','gap']) or jsonb_typeof(s->'opening'->'margin') is distinct from 'number' then raise exception 'Invalid stair dimensions' using errcode='22023';end if;
  rise:=(hi->>'elevation')::numeric-(lo->>'elevation')::numeric;
  if rise<=0 or (s->>'steps')::numeric not between 2 and 200 or (s->>'steps')::numeric<>trunc((s->>'steps')::numeric) or abs((s->>'steps')::numeric*(s->>'riser')::numeric-rise)>0.00001
  or (s->>'riser')::numeric<=0.00001 or (s->>'riser')::numeric>20 or (s->>'tread')::numeric<=0.00001 or (s->>'tread')::numeric>20 or (s->>'flightWidth')::numeric<=0.00001 or (s->>'flightWidth')::numeric>20
  or (s->>'landing')::numeric not between 0 and 20 or (s->>'gap')::numeric not between 0 and 20 or (s->'opening'->>'margin')::numeric not between 0 and 5 or abs((s->>'rotation')::numeric)>360 or abs((s->>'x')::numeric)>1000000 or abs((s->>'y')::numeric)>1000000
  or (s->>'kind'<>'straight' and ((s->>'steps')::integer<3 or (s->>'landing')::numeric<(s->>'flightWidth')::numeric)) then raise exception 'Stair dimensions disagree with floors' using errcode='22023';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(m->'verticalLinks') l group by l->>'lowerId',l->>'upperId',l->>'fromNodeId',l->>'toNodeId',l->>'type',l->>'kind' having count(*)>1) then raise exception 'Duplicate vertical route' using errcode='22023';end if;
 for s in select value from jsonb_array_elements(m->'verticalLinks') loop
  select value into lo from jsonb_array_elements(m->'levels') where value->>'id'=s->>'lowerId';select value into hi from jsonb_array_elements(m->'levels') where value->>'id'=s->>'upperId';
  if lo is null or hi is null or lo->>'buildingId' is distinct from s->>'buildingId' or hi->>'buildingId' is distinct from s->>'buildingId' or coalesce(s->>'type','') not in ('pipe','wire') or jsonb_typeof(s->'height') is distinct from 'number' or jsonb_typeof(s->'fromOffset') is distinct from 'number' or jsonb_typeof(s->'toOffset') is distinct from 'number' then raise exception 'Invalid vertical route' using errcode='22023';end if;
  select value into route_a from jsonb_array_elements(lo->'document'->'objects') where value->>'id'=s->>'fromRouteId';select value into route_b from jsonb_array_elements(hi->'document'->'objects') where value->>'id'=s->>'toRouteId';a:=lo->'document'->'nodes'->(s->>'fromNodeId');b:=hi->'document'->'nodes'->(s->>'toNodeId');
  if route_a is null or route_b is null or a is null or b is null or route_a->>'type' is distinct from s->>'type' or route_b->>'type' is distinct from s->>'type' or route_a->>'kind' is distinct from s->>'kind' or route_b->>'kind' is distinct from s->>'kind' or not (route_a->'vertexIds' ? (s->>'fromNodeId')) or not (route_b->'vertexIds' ? (s->>'toNodeId')) then raise exception 'Missing or incompatible vertical endpoint' using errcode='22023';end if;
  rise:=abs((hi->>'elevation')::numeric+(s->>'toOffset')::numeric-(lo->>'elevation')::numeric-(s->>'fromOffset')::numeric);
  if (hi->>'elevation')::numeric<=(lo->>'elevation')::numeric or (s->>'fromOffset')::numeric not between 0 and (lo->>'height')::numeric or (s->>'toOffset')::numeric not between 0 and (hi->>'height')::numeric or rise<=0 or abs(rise-(s->>'height')::numeric)>0.000001 or abs((a->>'x')::numeric-(b->>'x')::numeric)>0.000001 or abs((a->>'y')::numeric-(b->>'y')::numeric)>0.000001 then raise exception 'Vertical height or X/Y mismatch' using errcode='22023';end if;
 end loop;
end $$;
revoke all on function public.home_planer_validate_floors(jsonb) from public,anon,authenticated;


commit;
