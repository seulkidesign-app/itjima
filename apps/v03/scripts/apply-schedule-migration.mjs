import { readFileSync } from 'node:fs';
import { inspect, sql } from './remote-verification-support.mjs';
await inspect();
const [state]=await sql(`select to_regclass('public.v03_schedule_states') is not null states,to_regclass('public.v03_schedule_requests') is not null receipts,to_regprocedure('public.v03_update_schedule(uuid,text,text,text,bigint,bigint,uuid)') is not null rpc`);
console.log('Schedule schema: '+JSON.stringify(state));
if(Object.values(state).every(Boolean)) console.log('Schedule migration already present; not replayed');
else if(Object.values(state).some(Boolean)) throw new Error('Partial schedule schema; stop');
else if(process.argv.includes('--apply')) {
 await sql("SET v03.project_ref='zzuytanimpiflygrwqfb';\n"+readFileSync(new URL('../supabase/migrations/202610150002_v03_schedule.sql',import.meta.url),'utf8'));
 console.log('Applied new migration 202610150002_v03_schedule.sql only');
}else console.log('Not applied; use --apply explicitly');
