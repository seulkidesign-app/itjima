import {readFileSync} from 'node:fs';
import {inspect,sql} from './remote-verification-support.mjs';
await inspect();
const [state]=await sql("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='v03_schedule_states' and column_name='date_state') marker,exists(select 1 from pg_constraint where conrelid='public.v03_schedule_states'::regclass and conname='v03_schedule_meaning_check') contract");
console.log('Removal schema: '+JSON.stringify(state));
const fingerprint=()=>sql("select (select md5(coalesce(jsonb_agg(to_jsonb(s)-'date_state' order by content_id,type)::text,'')) from public.v03_schedule_states s) states,(select md5(coalesce(jsonb_agg(to_jsonb(r) order by id)::text,'')) from public.v03_schedule_requests r) receipts");
if(state.marker&&state.contract)console.log('Removal migration already present; not replayed');
else if(state.marker||state.contract)throw new Error('Partial removal schema; stop');
else if(process.argv.includes('--apply')){
 const before=await fingerprint();
 await sql("SET v03.project_ref='zzuytanimpiflygrwqfb';\n"+readFileSync(new URL('../supabase/migrations/202610160003_v03_schedule_removal.sql',import.meta.url),'utf8'));
 const after=await fingerprint(),[rows]=await sql('select count(*)::int changed from public.v03_schedule_states where date_state is not null');
 if(JSON.stringify(before)!==JSON.stringify(after)||rows.changed!==0)throw new Error('Existing meaning/receipt preservation check failed');
 console.log('Applied new 202610160003_v03_schedule_removal.sql only; existing states/receipts unchanged');
}else console.log('Not applied; use --apply explicitly');
