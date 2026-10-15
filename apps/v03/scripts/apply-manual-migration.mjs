import { readFileSync } from 'node:fs';
import { inspect, sql } from './remote-verification-support.mjs';
await inspect();
const [state]=await sql(`select to_regprocedure('public.v03_validate_manual(jsonb)') is not null validator,to_regprocedure('public.v03_prepare_manual_import(uuid,jsonb)') is not null prepare,to_regprocedure('public.v03_commit_manual_import(uuid)') is not null commit`);
console.log('Manual schema: '+JSON.stringify(state));
if(Object.values(state).every(Boolean)) console.log('Manual migration already present; not replayed');
else if(Object.values(state).some(Boolean)) throw new Error('Partial manual schema; stop');
else if(process.argv.includes('--apply')) {
 await sql("SET v03.project_ref='zzuytanimpiflygrwqfb';\n"+readFileSync(new URL('../supabase/migrations/202610150003_v03_manual.sql',import.meta.url),'utf8'));
 console.log('Applied new migration 202610150003_v03_manual.sql only');
}else console.log('Not applied; use --apply explicitly');
