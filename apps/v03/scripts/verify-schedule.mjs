// Explicit remote verification. Creates only synthetic accounts/data and cleans them in finally.
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { config, inspect, request, sql } from './remote-verification-support.mjs';
import { secretHeaders } from './supabase-admin.mjs';
import { saveReviewed } from '../src/integrations/save.ts';
import { mockExtract, editCandidate, confirmCandidate, buildPayload } from '../src/domain/brief.ts';
const run='v03-qa-schedule-'+Date.now()+'-'+randomBytes(4).toString('hex');
mkdirSync(new URL('../.tmp/',import.meta.url),{recursive:true});
const journal={run,users:[],passed:[],cleanup:false};
const file=new URL('../.tmp/'+run+'-journal.json',import.meta.url);
const persist=()=>writeFileSync(file,JSON.stringify(journal,null,2),{mode:0o600});
const check=(ok,label)=>{if(!ok)throw new Error(label);journal.passed.push(label);persist();console.log('PASS '+label);};
const admin=secretHeaders(config.secret);
const fn='v03_qa_schedule_'+randomBytes(5).toString('hex');
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
const change=(c,content,type,state,date,revision,taskRevision,id=randomUUID())=>c.rpc('v03_update_schedule',{p_content_id:content,p_type:type,p_information_state:state,p_due_date:date,p_expected_revision:revision,p_expected_task_revision:taskRevision,p_request_id:id});
async function read(c,cid){const r=await c.from('v03_collaborations').select('id,status,revision,v03_contents(id,v03_tasks(id,type,due_date,completed_at,revision),v03_schedule_states(type,information_state,revision))').eq('id',cid).single();if(r.error)throw new Error('Schedule read failed');return r.data;}
async function immutable(uid){return sql(`select (select jsonb_agg(to_jsonb(s) order by id) from public.v03_sources s where user_id='${uid}') sources,(select jsonb_agg(to_jsonb(r) order by id) from public.v03_reviews r where user_id='${uid}') reviews,(select jsonb_agg(to_jsonb(i) order by id) from public.v03_imports i where user_id='${uid}') imports`);}
async function seed(c,unresolved=false){const source={text:run+' synthetic schedule guide only',images:[]};let draft=mockExtract(source);for(const v of draft.candidates){if(v.group==='schedules')draft=editCandidate(draft,v.id,unresolved?{informationState:'uncertain',dueDate:undefined}:{dueDate:'2026-10-20'});draft=confirmCandidate(draft,v.id);}return saveReviewed(c,randomUUID(),buildPayload(draft,run),source);}
async function cleanup(){
 let ok=true;
 if(trigger)try{await sql(`drop trigger if exists ${fn} on public.v03_schedule_requests;drop function if exists public.${fn}();`);trigger=false;}catch{ok=false;console.log('FAIL cleanup trigger');}
 if(journal.users.length){const ids=journal.users.map(id=>`'${id}'`).join(',');
  try{await sql(`begin;update public.v03_imports set collaboration_id=null where user_id in (${ids});${['v03_reviews','v03_constraints','v03_tasks','v03_sources','v03_contents','v03_collaborations','v03_imports'].map(t=>`delete from public.${t} where user_id in (${ids});`).join('')}commit;`);}catch{ok=false;console.log('FAIL cleanup rows');}
  for(const id of journal.users)try{await request(config.url+'/auth/v1/admin/users/'+id,admin,'DELETE');}catch{ok=false;console.log('FAIL cleanup account');}
  try{const rows=await sql(`select (select count(*)::int from auth.users where id in (${ids})) users,${['v03_schedule_states','v03_schedule_requests','v03_progress_requests','v03_reviews','v03_constraints','v03_tasks','v03_sources','v03_contents','v03_collaborations','v03_imports'].map(t=>`(select count(*)::int from public.${t} where user_id in (${ids})) as ${t}`).join(',')},(select count(*)::int from pg_trigger where tgname='${fn}') triggers,(select count(*)::int from pg_proc where proname='${fn}') functions`);check(Object.values(rows[0]).every(n=>n===0),'Cleanup verified: zero test accounts, rows, receipts and triggers');}catch{ok=false;console.log('FAIL cleanup verification');}
 }
 journal.cleanup=ok;persist();if(!ok)process.exitCode=1;
}
try{
 await inspect();
 const a=await register(),b=await register(),anon=client();
 const cid=await seed(a),emptyId=await seed(a,true);
 let row=await read(a,cid),content=row.v03_contents[0].id;
 // Completed baseline only: the accepted completion RPC is deliberately not invoked.
 await sql(`update public.v03_tasks set completed_at='2026-10-15T00:00:00Z' where user_id='${journal.users[0]}' and content_id='${content}' and type='draft_delivery'`);
 row=await read(a,cid);const baseline=row,original=await immutable(journal.users[0]);
 const task=t=>row.v03_contents[0].v03_tasks.find(v=>v.type===t);
 const initialTask=task('draft_delivery'),rid=randomUUID();
 const first=await change(a,content,'draft_delivery','present','2026-10-22',0,0,rid);
 check(!first.error&&first.data.revision===1,'Current draft date updated through schedule RPC');
 check(!(await change(a,content,'draft_delivery','present','2026-10-24',1,1)).error,'Newer date committed');
 const replay=await change(a,content,'draft_delivery','present','2026-10-22',0,0,rid);
 row=await read(a,cid);check(!replay.error&&JSON.stringify(replay.data)===JSON.stringify(first.data)&&task('draft_delivery').due_date==='2026-10-24','Identical retry preserves newer date');
 check((await change(a,content,'draft_delivery','present','2026-10-23',0,0,rid)).error?.message==='v03_schedule_invalid_retry','Changed input cannot reuse request UUID');
 const race=await Promise.all([change(a,content,'draft_delivery','present','2026-10-25',2,2),change(a,content,'draft_delivery','present','2026-10-26',2,2)]);
 check(race.filter(r=>!r.error).length===1&&race.filter(r=>r.error?.message==='v03_schedule_conflict').length===1,'Concurrent writers produce one success and one conflict');
 check((await change(a,content,'draft_delivery','present','2026-10-27',2,2)).error?.message==='v03_schedule_conflict','Stale date version rejected');
 check(!(await change(a,content,'draft_delivery','uncertain',null,3,3)).error,'Clear date as uncertain');
 check(!(await change(a,content,'draft_delivery','not_mentioned',null,4,4)).error,'Distinguish current missing date');
 const same=randomUUID(),duplicates=await Promise.all([change(a,content,'draft_delivery','present','2026-10-28',5,5,same),change(a,content,'draft_delivery','present','2026-10-28',5,5,same)]);
 check(duplicates.every(r=>!r.error&&r.data.revision===6),'Concurrent identical retry applied once');
 check(!(await change(a,content,'publish','present','2026-11-02',0,0)).error,'Upload date edited independently');
 row=await read(a,cid);
 check(row.status===baseline.status&&row.revision===baseline.revision&&task('draft_delivery').id===initialTask.id&&row.v03_contents[0].v03_tasks.every(t=>t.completed_at===baseline.v03_contents[0].v03_tasks.find(v=>v.id===t.id)?.completed_at),'Dates preserve status and all completion values');
 check(JSON.stringify(original)===JSON.stringify(await immutable(journal.users[0])),'Source, initial Review and import preserved');
 const empty=await read(a,emptyId),ec=empty.v03_contents[0].id,n=empty.v03_contents[0].v03_tasks.length;
 check(!(await change(a,ec,'publish','uncertain',null,0,null)).error&&(await read(a,emptyId)).v03_contents[0].v03_tasks.length===n,'Uncertain date creates no Task');
 check(!(await change(a,ec,'publish','present','2026-11-03',1,null)).error&&(await read(a,emptyId)).v03_contents[0].v03_tasks.length===n+1,'Explicit date creates one schedule Task');
 check((await change(b,content,'publish','present','2026-11-04',1,1)).error?.message==='v03_schedule_unavailable','Other user cannot edit schedule');
 check((await change(b,content,'draft_delivery','present','2026-10-22',0,0,rid)).error?.message==='v03_schedule_invalid_retry','Other user cannot replay receipt');
 for(const table of ['v03_schedule_states','v03_schedule_requests']){const r=await b.from(table).select('*');check(!r.error&&r.data.length===0,'Owner RLS isolates '+table);check((await a.from(table).delete().eq('user_id',journal.users[0])).error?.code==='42501','Direct delete denied '+table);}
 check((await b.from('v03_collaborations').select('id').eq('id',cid)).data?.length===0,'Other user cannot read target');
 check(Boolean((await change(anon,content,'publish','present','2026-11-04',1,1)).error),'Anonymous date mutation denied');
 for(const [type,state,date] of [['publish','present','2026-02-30'],['publish','present','0000-01-01'],['invalid','present','2026-11-04'],['publish','invalid',null],['publish','uncertain','2026-11-04']])check((await change(a,content,type,state,date,1,1)).error?.message==='v03_schedule_invalid','Invalid schedule input rejected');
 check((await a.from('v03_tasks').update({due_date:'2026-11-04'}).eq('id',initialTask.id)).error?.code==='42501','Direct date UPDATE denied');
 const fail=randomUUID();trigger=true;
 await sql(`create function public.${fn}() returns trigger language plpgsql set search_path='' as $$ begin if new.id='${fail}'::uuid then raise exception 'v03_qa_receipt_failure';end if;return new;end $$;create trigger ${fn} before insert on public.v03_schedule_requests for each row execute function public.${fn}();`);
 const before=await read(a,cid),failed=await change(a,content,'publish','present','2026-11-05',1,1,fail),after=await read(a,cid);
 check(failed.error?.message==='v03_qa_receipt_failure'&&JSON.stringify(before)===JSON.stringify(after),'Receipt failure rolls back date, state and versions');
 await sql(`drop trigger ${fn} on public.v03_schedule_requests;drop function public.${fn}();`);trigger=false;
 await a.auth.signOut({scope:'local'});await b.auth.signOut({scope:'local'});
}catch(error){console.log('FAIL '+(error instanceof Error?error.message:'verification failed'));journal.failed=true;persist();process.exitCode=1;}
finally{await cleanup();}
