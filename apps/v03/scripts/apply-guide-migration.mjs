import {readFileSync} from 'node:fs';
import {inspect,sql} from './remote-verification-support.mjs';
await inspect();
const [s]=await sql("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='v03_sources' and column_name='guide_order') marker,to_regprocedure('public.v03_commit_guide_import(uuid)') is not null rpc");
if(s.marker&&s.rpc)console.log('Follow-up guide migration already present; not replayed');
else if(s.marker||s.rpc)throw new Error('Partial guide schema; stop');
else if(process.argv.includes('--apply')){
 const fingerprint=()=>sql("select (select md5(coalesce(jsonb_agg(to_jsonb(s)-array['registered_at','guide_order','import_id'] order by id)::text,'')) from public.v03_sources s) sources,(select md5(coalesce(jsonb_agg(to_jsonb(r) order by id)::text,'')) from public.v03_reviews r) reviews");
 const before=await fingerprint();
 await sql("SET v03.project_ref='zzuytanimpiflygrwqfb';\n"+readFileSync(new URL('../supabase/migrations/202610160004_v03_followup_guides.sql',import.meta.url),'utf8'));
 if(JSON.stringify(before)!==JSON.stringify(await fingerprint()))throw new Error('Historical source/review preservation failed');
 console.log('Applied new 202610160004_v03_followup_guides.sql only; historical evidence unchanged');
}else {console.log('Not applied; use --apply explicitly');process.exit(0);}
const [normalizer]=await sql("select position('v03_basic_text' in pg_get_functiondef('public.v03_validate_guide(jsonb)'::regprocedure))>0 applied");
if(normalizer.applied)console.log('Guide whitespace migration already present; not replayed');
else if(process.argv.includes('--apply')){
 await sql("SET v03.project_ref='zzuytanimpiflygrwqfb';\n"+readFileSync(new URL('../supabase/migrations/202610160005_v03_guide_whitespace.sql',import.meta.url),'utf8'));
 console.log('Applied new 202610160005_v03_guide_whitespace.sql only; no data transformation');
}
