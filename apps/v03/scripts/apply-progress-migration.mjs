import { readFileSync } from 'node:fs';
import { inspect, sql } from './remote-verification-support.mjs';
const migration = new URL('../supabase/migrations/202610150001_v03_progress.sql', import.meta.url);
await inspect();
const state = await sql(`select
 (select count(*)::int from information_schema.columns where table_schema='public' and table_name in ('v03_collaborations','v03_tasks') and column_name='revision') as columns,
 to_regclass('public.v03_progress_requests') is not null as receipts,
 to_regprocedure('public.v03_update_collaboration_status(uuid,text,bigint,uuid)') is not null as status_rpc,
 to_regprocedure('public.v03_set_task_completed(uuid,boolean,bigint,uuid)') is not null as task_rpc`);
const row = state[0];
console.log('Progress schema: '+JSON.stringify(row));
if (row.columns===2 && row.receipts && row.status_rpc && row.task_rpc) {
 console.log('Progress migration already present; not replayed');
} else if (row.columns!==0 || row.receipts || row.status_rpc || row.task_rpc) {
 throw new Error('Partial progress schema; inspect before applying');
} else if (process.argv.includes('--apply')) {
 await sql("SET v03.project_ref='zzuytanimpiflygrwqfb';\n"+readFileSync(migration,'utf8'));
 console.log('Applied new migration 202610150001_v03_progress.sql only');
} else {
 console.log('Not applied; use --apply explicitly');
}
