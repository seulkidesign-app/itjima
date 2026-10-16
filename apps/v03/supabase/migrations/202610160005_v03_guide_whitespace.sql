begin;
do $$ begin
 if current_setting('v03.project_ref',true) is distinct from 'zzuytanimpiflygrwqfb' or to_regclass('public.inbox') is not null or to_regclass('public.schedules') is not null or to_regprocedure('public.v03_commit_guide_import(uuid)') is null then raise exception 'Verified V03 guide schema required';end if;
end $$;
-- Apply the existing browser-compatible whitespace rule without changing stored originals.
create or replace function public.v03_validate_guide(p jsonb) returns void language plpgsql set search_path='' as $$
declare r jsonb;ids text[]:='{}';
begin
 if p is null or jsonb_typeof(p)<>'object' or p-array['mode','confirmed','collaboration_id','source']<>'{}'::jsonb or p->>'mode' is distinct from 'followup_guide' or p->'confirmed' is distinct from 'true'::jsonb or coalesce(p->>'collaboration_id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'invalid_guide';end if;
 if jsonb_typeof(p->'source') is distinct from 'object' or (p->'source')-array['raw_text','images']<>'{}'::jsonb or jsonb_typeof(p#>'{source,raw_text}') is distinct from 'string' or length(p#>>'{source,raw_text}')>20000 or jsonb_typeof(p#>'{source,images}') is distinct from 'array' or jsonb_array_length(p#>'{source,images}')>4 then raise exception 'invalid_guide_source';end if;
 if public.v03_basic_text(p#>>'{source,raw_text}') is null and jsonb_array_length(p#>'{source,images}')=0 then raise exception 'guide_source_required';end if;
 for r in select value from jsonb_array_elements(p#>'{source,images}') loop
  if jsonb_typeof(r)<>'object' or r-array['id','name','size','type']<>'{}'::jsonb or coalesce(r->>'id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or r->>'id'=any(ids) or jsonb_typeof(r->'name') is distinct from 'string' or length(r->>'name') not between 1 and 255 or jsonb_typeof(r->'size') is distinct from 'number' or coalesce(r->>'size','') !~ '^\d+$' or (r->>'size')::numeric not between 1 and 10485760 or coalesce(r->>'type','') not in ('image/jpeg','image/png','image/webp') then raise exception 'invalid_guide_image';end if;
  ids:=array_append(ids,r->>'id');
 end loop;
end $$;
commit;
