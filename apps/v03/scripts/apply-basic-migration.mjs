import { readFileSync } from 'node:fs';
import { inspect, sql } from './remote-verification-support.mjs';
await inspect();
const [state]=await sql(`select exists(select 1 from information_schema.columns where table_schema='public' and table_name='v03_contents' and column_name='revision') content_revision,to_regclass('public.v03_basic_requests') is not null receipts,to_regprocedure('public.v03_update_basic_info(uuid,uuid,text,text,text,bigint,bigint,uuid)') is not null rpc`);
console.log('Basic info schema: '+JSON.stringify(state));
if(Object.values(state).every(Boolean)) console.log('Basic info migration already present; not replayed');
else if(Object.values(state).some(Boolean)) throw new Error('Partial basic schema; stop');
else if(process.argv.includes('--apply')) {
 await sql("SET v03.project_ref='zzuytanimpiflygrwqfb';\n"+readFileSync(new URL('../supabase/migrations/202610160001_v03_basic_info.sql',import.meta.url),'utf8'));
 console.log('Applied new migration 202610160001_v03_basic_info.sql only');
}else console.log('Not applied; use --apply explicitly');

const [textState]=await sql("select to_regprocedure('public.v03_basic_text(text)') is not null present");
if(textState.present) console.log('Basic whitespace validation already present; not replayed');
else if(process.argv.includes('--apply')) {
 await sql("SET v03.project_ref='zzuytanimpiflygrwqfb';\n"+readFileSync(new URL('../supabase/migrations/202610160002_v03_basic_whitespace.sql',import.meta.url),'utf8'));
 console.log('Applied new migration 202610160002_v03_basic_whitespace.sql only');
}
