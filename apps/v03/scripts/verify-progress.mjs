// Explicit remote verification. Creates only synthetic accounts/data and cleans them in finally.
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { config, inspect, request, sql } from './remote-verification-support.mjs';
import { secretHeaders } from './supabase-admin.mjs';
import { saveReviewed } from '../src/integrations/save.ts';
import { mockExtract, editCandidate, confirmCandidate, buildPayload } from '../src/domain/brief.ts';
const run='v03-qa-progress-'+Date.now()+'-'+randomBytes(4).toString('hex');
mkdirSync(new URL('../.tmp/',import.meta.url),{recursive:true});
const journal={run,users:[],passed:[],cleanup:false};
const file=new URL('../.tmp/'+run+'-journal.json',import.meta.url);
const persist=()=>writeFileSync(file,JSON.stringify(journal,null,2),{mode:0o600});
const check=(ok,label)=>{if(!ok)throw new Error(label);journal.passed.push(label);persist();console.log('PASS '+label);};
const admin=secretHeaders(config.secret);
const fn='v03_qa_progress_'+randomBytes(5).toString('hex');
journal.triggerFunction=fn;persist();
let trigger=false;
function client(){return createClient(config.url,process.env.VITE_V03_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init)=>fetch(url,{...init,signal:AbortSignal.timeout(30000)})}});}
async function register(){
 const email=run+'-'+journal.users.length+'@example.com',password=randomBytes(24).toString('base64url')+'aA1!';
 const u=await request(config.url+'/auth/v1/admin/users',admin,'POST',{email,password,email_confirm:true,user_metadata:{v03_verification_run:run}});
 if(!/^[0-9a-f-]{36}$/.test(u.id))throw new Error('No test identity');
 journal.users.push(u.id);persist();const c=client();const login=await c.auth.signInWithPassword({email,password});
 check(!login.error,'Real Auth login '+journal.users.length);return c;
}
const update=(c,id,status,revision,requestId=randomUUID())=>c.rpc('v03_update_collaboration_status',{p_id:id,p_status:status,p_expected_revision:revision,p_request_id:requestId});
const toggle=(c,id,completed,revision,requestId=randomUUID())=>c.rpc('v03_set_task_completed',{p_id:id,p_completed:completed,p_expected_revision:revision,p_request_id:requestId});
async function read(c,cid){const r=await c.from('v03_collaborations').select('id,status,revision,v03_contents(v03_tasks(id,completed_at,revision))').eq('id',cid).single();if(r.error)throw new Error('Read verification failed');return r.data;}
async function cleanup(){
 let ok=true;
 if(trigger)try{await sql(`drop trigger if exists ${fn} on public.v03_progress_requests;drop function if exists public.${fn}();`);trigger=false;}catch{ok=false;console.log('FAIL cleanup trigger');}
 if(journal.users.length){const ids=journal.users.map(id=>`'${id}'`).join(',');
  try{await sql(`begin;update public.v03_imports set collaboration_id=null where user_id in (${ids});${['v03_reviews','v03_constraints','v03_tasks','v03_sources','v03_contents','v03_collaborations','v03_imports'].map(t=>`delete from public.${t} where user_id in (${ids});`).join('')}commit;`);}catch{ok=false;console.log('FAIL cleanup rows');}
  for(const id of journal.users)try{await request(config.url+'/auth/v1/admin/users/'+id,admin,'DELETE');}catch{ok=false;console.log('FAIL cleanup account');}
  try{const rows=await sql(`select (select count(*)::int from auth.users where id in (${ids})) users,${['v03_progress_requests','v03_reviews','v03_constraints','v03_tasks','v03_sources','v03_contents','v03_collaborations','v03_imports'].map(t=>`(select count(*)::int from public.${t} where user_id in (${ids})) as ${t}`).join(',')},(select count(*)::int from pg_trigger where tgname='${fn}') triggers,(select count(*)::int from pg_proc where proname='${fn}') functions`);check(Object.values(rows[0]).every(n=>n===0),'Cleanup verified: zero test accounts, rows, receipts and triggers');}catch{ok=false;console.log('FAIL cleanup verification');}
 }
 journal.cleanup=ok;persist();if(!ok)process.exitCode=1;
}
try{
 await inspect();
 const permissions=await sql("select (select relrowsecurity from pg_class where oid='public.v03_progress_requests'::regclass) receipts_rls,bool_and(not has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') and not has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE')) direct_writes_blocked from pg_class c where c.oid in ('public.v03_collaborations'::regclass,'public.v03_tasks'::regclass,'public.v03_progress_requests'::regclass)");
 check(permissions[0].receipts_rls&&permissions[0].direct_writes_blocked,'RLS and direct-write denial retained');
 const a=await register(),b=await register(),anon=client();
 const source={text:run+' synthetic guide only',images:[]};let draft=mockExtract(source);
 for(const candidate of draft.candidates){if(candidate.group==='schedules')draft=editCandidate(draft,candidate.id,{dueDate:'2026-10-20'});draft=confirmCandidate(draft,candidate.id);}
 const cid=await saveReviewed(a,randomUUID(),buildPayload(draft,run),source);
 let row=await read(a,cid);const tasks=row.v03_contents.flatMap(c=>c.v03_tasks);let revision=row.revision;
 for(const status of ['completed','discussion','on_hold','scheduled','in_review','draft_sent','producing']){
  const r=await update(a,cid,status,revision++);check(!r.error&&r.data.status===status&&r.data.revision===revision,'Allowed status '+status);
 }
 row=await read(a,cid);check(row.v03_contents.flatMap(c=>c.v03_tasks).every(t=>t.completed_at===null),'Completing collaboration leaves tasks unfinished');
 for(const t of tasks){const r=await toggle(a,t.id,true,0);check(!r.error&&Boolean(r.data.completed_at),'Task complete uses server timestamp');}
 row=await read(a,cid);check(row.status==='producing'&&row.v03_contents.flatMap(c=>c.v03_tasks).every(t=>t.completed_at),'Completing every task leaves status unchanged');
 const undone=await toggle(a,tasks[0].id,false,1);check(!undone.error&&undone.data.completed_at===null,'Task can return to unfinished');
 const race=await Promise.all([update(a,cid,'completed',revision),update(a,cid,'on_hold',revision)]);
 check(race.filter(r=>!r.error).length===1&&race.filter(r=>r.error?.message==='v03_progress_conflict').length===1,'Concurrent stale writers: exactly one success and one conflict');
 revision++;row=await read(a,cid);check(row.revision===revision,'Concurrent writes increment revision only once');
 const stale=revision;
 check(!(await update(a,cid,'discussion',revision++)).error&&!(await update(a,cid,'producing',revision++)).error,'Status can move backward and forward');
 check((await update(a,cid,'scheduled',stale)).error?.message==='v03_progress_conflict','ABA stale revision rejected');
 const receiptId=randomUUID(),tid=tasks[0].id;
 const first=await toggle(a,tid,true,2,receiptId);check(!first.error,'Receipt request committed');
 const newer=await toggle(a,tid,false,3);check(!newer.error,'Newer independent task change committed');
 const replay=await toggle(a,tid,true,2,receiptId);
 check(!replay.error&&JSON.stringify(replay.data)===JSON.stringify(first.data),'Identical retry returns original receipt');
 const taskNow=(await read(a,cid)).v03_contents.flatMap(c=>c.v03_tasks).find(t=>t.id===tid);
 check(taskNow.revision===4&&taskNow.completed_at===null,'Old receipt replay never overwrites newer task change');
 check((await toggle(a,tid,false,2,receiptId)).error?.message==='v03_progress_invalid_retry','Changed input cannot reuse request UUID');
 const sameId=randomUUID();const duplicate=await Promise.all([toggle(a,tid,true,4,sameId),toggle(a,tid,true,4,sameId)]);
 check(duplicate.every(r=>!r.error&&r.data.revision===5),'Concurrent identical request is applied once');
 check((await update(b,cid,'completed',revision)).error?.message==='v03_progress_unavailable','Other user cannot change status');
 check((await toggle(b,tid,false,5)).error?.message==='v03_progress_unavailable','Other user cannot change task');
 check((await toggle(b,tid,true,2,receiptId)).error?.message==='v03_progress_invalid_retry','Other user cannot replay receipt');
 const receipts=await b.from('v03_progress_requests').select('id');check(!receipts.error&&receipts.data.length===0,'Receipt RLS isolates users');
 check(Boolean((await update(anon,cid,'completed',revision)).error),'Anonymous mutation denied');
 check((await update(a,cid,'invalid',revision)).error?.message==='v03_progress_invalid','Server rejects unknown status');
 check((await toggle(a,tid,null,5)).error?.message==='v03_progress_invalid','Server rejects null completion');
 check((await toggle(a,tid,true,-1)).error?.message==='v03_progress_invalid','Server rejects invalid revision');
 for(const table of ['v03_collaborations','v03_tasks','v03_progress_requests'])check((await a.from(table).update({user_id:journal.users[1]}).eq('id',table==='v03_collaborations'?cid:tid)).error?.code==='42501','Direct UPDATE denied '+table);
 const failId=randomUUID();trigger=true;
 await sql(`create function public.${fn}() returns trigger language plpgsql set search_path='' as $$ begin if new.id='${failId}'::uuid then raise exception 'v03_qa_receipt_failure';end if;return new;end $$;create trigger ${fn} before insert on public.v03_progress_requests for each row execute function public.${fn}();`);
 const before=await read(a,cid),failed=await update(a,cid,'completed',before.revision,failId),after=await read(a,cid);
 check(failed.error?.message==='v03_qa_receipt_failure'&&before.revision===after.revision&&before.status===after.status,'Actual receipt failure rolls back status and revision');
 await sql(`drop trigger ${fn} on public.v03_progress_requests;drop function public.${fn}();`);trigger=false;
 await a.auth.signOut({scope:'local'});await b.auth.signOut({scope:'local'});
}catch(error){console.log('FAIL '+(error instanceof Error?error.message:'verification failed'));journal.failed=true;persist();process.exitCode=1;}
finally{await cleanup();}
