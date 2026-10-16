// Explicit remote verification. Creates only synthetic accounts/data and cleans them in finally.
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { config, inspect, request, sql } from './remote-verification-support.mjs';
import { secretHeaders } from './supabase-admin.mjs';
import { saveManual } from '../src/integrations/save.ts';
import {emptyManual,buildManualPayload} from '../src/domain/manual.ts';
const run='v03-qa-removal-'+Date.now()+'-'+randomBytes(4).toString('hex');
mkdirSync(new URL('../.tmp/',import.meta.url),{recursive:true});
const journal={run,users:[],paths:[],passed:[],cleanup:false};
const file=new URL('../.tmp/'+run+'-journal.json',import.meta.url);
const persist=()=>writeFileSync(file,JSON.stringify(journal,null,2),{mode:0o600});
const check=(ok,label)=>{if(!ok)throw new Error(label);journal.passed.push(label);persist();console.log('PASS '+label);};
const admin=secretHeaders(config.secret);
const fn='v03_qa_removal_'+randomBytes(5).toString('hex');
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
async function cleanup(){
 let ok=true;
 if(trigger)try{await sql(`drop trigger if exists ${fn} on public.v03_schedule_requests;drop function if exists public.${fn}();`);trigger=false;}catch{ok=false;console.log('FAIL cleanup trigger');}
 if(journal.paths.length)try{await request(config.url+'/storage/v1/object/v03-sources',admin,'DELETE',{prefixes:journal.paths});}catch{ok=false;console.log('FAIL cleanup objects');}
 if(journal.users.length){const ids=journal.users.map(id=>`'${id}'`).join(',');
  try{await sql(`begin;update public.v03_imports set collaboration_id=null where user_id in (${ids});${['v03_reviews','v03_constraints','v03_tasks','v03_sources','v03_contents','v03_collaborations','v03_imports'].map(t=>`delete from public.${t} where user_id in (${ids});`).join('')}commit;`);}catch{ok=false;console.log('FAIL cleanup rows');}
  for(const id of journal.users)try{await request(config.url+'/auth/v1/admin/users/'+id,admin,'DELETE');}catch{ok=false;console.log('FAIL cleanup account');}
  try{const rows=await sql(`select (select count(*)::int from auth.users where id in (${ids})) users,(select count(*)::int from storage.objects where bucket_id='v03-sources' and split_part(name,'/',1)::text in (${ids})) objects,${['v03_basic_requests','v03_schedule_states','v03_schedule_requests','v03_progress_requests','v03_reviews','v03_constraints','v03_tasks','v03_sources','v03_contents','v03_collaborations','v03_imports'].map(t=>`(select count(*)::int from public.${t} where user_id in (${ids})) as ${t}`).join(',')},(select count(*)::int from pg_trigger where tgname='${fn}') triggers,(select count(*)::int from pg_proc where proname='${fn}') functions`);check(Object.values(rows[0]).every(n=>n===0),'Cleanup verified: zero test accounts, rows, receipts and triggers');}catch{ok=false;console.log('FAIL cleanup verification');}
 }
 journal.cleanup=ok;persist();if(!ok)process.exitCode=1;
}
const change=(c,content,state,date,revision,taskRevision,id=randomUUID())=>c.rpc('v03_update_schedule',{p_content_id:content,p_type:'draft_delivery',p_information_state:state,p_due_date:date,p_expected_revision:revision,p_expected_task_revision:taskRevision,p_request_id:id});
async function seed(c,dates=true){const source={text:'Synthetic removal original guide',images:[]};return saveManual(c,randomUUID(),buildManualPayload({...emptyManual(),title:run,draftDate:dates?'2026-11-10':'',publishDate:dates?'2026-11-12':''},source,true),source);}
async function read(c,cid){const r=await c.from('v03_collaborations').select('id,status,revision,v03_contents(id,v03_tasks(id,type,due_date,completed_at,revision),v03_schedule_states(type,information_state,date_state,revision)),v03_sources(v03_reviews(candidate))').eq('id',cid).single();if(r.error)throw new Error('Removal read failed');return r.data;}
async function evidence(uid){return sql(`select (select jsonb_agg(to_jsonb(s) order by id) from public.v03_sources s where user_id='${uid}') sources,(select jsonb_agg(to_jsonb(r) order by id) from public.v03_reviews r where user_id='${uid}') reviews,(select jsonb_agg(to_jsonb(i) order by id) from public.v03_imports i where user_id='${uid}') imports`);}
try{
 await inspect();const a=await register(),b=await register(),anon=client();const cid=await seed(a),empty=await seed(a,false),legacy=await seed(a,false);let row=await read(a,cid);const content=row.v03_contents[0].id;
 // Synthetic legacy Review fixture only; do not classify any real user's historical data.
 await sql(`update public.v03_reviews set candidate=case candidate->>'candidate_id' when 'draft_due' then '{"candidate_id":"draft_due","origin":"mock","information_state":"not_mentioned"}'::jsonb else '{"candidate_id":"publish_due","origin":"mock","information_state":"uncertain"}'::jsonb end where user_id='${journal.users[0]}' and source_id in(select id from public.v03_sources where collaboration_id='${legacy}') and candidate->>'candidate_id' in ('draft_due','publish_due');update public.v03_tasks set completed_at='2026-10-16T00:00:00Z' where user_id='${journal.users[0]}' and content_id='${content}' and type='draft_delivery'`);
 row=await read(a,cid);const original=await evidence(journal.users[0]),baseline=row,task=row.v03_contents[0].v03_tasks.find(t=>t.type==='draft_delivery'),publish=row.v03_contents[0].v03_tasks.find(t=>t.type==='publish'),rid=randomUUID();
 const first=await change(a,content,'removed',null,0,0,rid);check(!first.error&&first.data.task_id===task.id,'Explicit removal preserves Task ID');
 row=await read(a,cid);let current=row.v03_contents[0];check(current.v03_schedule_states[0].date_state==='removed'&&current.v03_schedule_states[0].information_state===null,'Removal marker is separate from original information states');check(current.v03_tasks.find(t=>t.id===task.id).due_date===null&&current.v03_tasks.find(t=>t.id===task.id).completed_at===task.completed_at,'Removed completed Task remains completed with null due date');check(JSON.stringify(current.v03_tasks.find(t=>t.id===publish.id))===JSON.stringify(publish)&&row.status===baseline.status&&row.revision===baseline.revision,'Other schedule and collaboration status unchanged');
 const restored=await change(a,content,'present','2026-11-16',1,1);check(!restored.error&&restored.data.task_id===task.id,'Restore reuses the same Task');row=await read(a,cid);check(row.v03_contents[0].v03_schedule_states[0].date_state===null&&row.v03_contents[0].v03_tasks.find(t=>t.id===task.id).completed_at===task.completed_at,'Restoring clears marker but preserves completion');
 const replay=await change(a,content,'removed',null,0,0,rid);check(!replay.error&&JSON.stringify(replay.data)===JSON.stringify(first.data)&&(await read(a,cid)).v03_contents[0].v03_tasks.find(t=>t.id===task.id).due_date==='2026-11-16','Old removal receipt never erases restored newer date');
 check((await change(a,content,'uncertain',null,0,0,rid)).error?.message==='v03_schedule_invalid_retry','Changed UUID input rejected');check((await change(a,content,'removed',null,0,0)).error?.message==='v03_schedule_conflict','Stale removal rejected');check((await change(a,content,'removed',null,2,1)).error?.message==='v03_schedule_conflict','Stale Task revision rejected');
 const same=randomUUID(),dup=await Promise.all([change(a,content,'removed',null,2,2,same),change(a,content,'removed',null,2,2,same)]);check(dup.every(r=>!r.error&&r.data.revision===3),'Concurrent identical removal applied once');check((await change(a,content,'removed',null,3,3)).error?.message==='v03_schedule_invalid','Cannot mark an already absent date as a new removal');
 check(!(await change(a,content,'present','2026-11-17',3,3)).error,'Date restored for concurrent writers');const race=await Promise.all([change(a,content,'removed',null,4,4),change(a,content,'present','2026-11-18',4,4)]);check(race.filter(r=>!r.error).length===1&&race.filter(r=>r.error?.message==='v03_schedule_conflict').length===1,'Concurrent remove/edit yields one success and one conflict');
 const er=await read(a,empty),ec=er.v03_contents[0].id;check(er.v03_sources[0].v03_reviews.filter(r=>r.candidate.input_state==='not_entered').length===2&&er.v03_contents[0].v03_tasks.length===0,'Manual never-entered dates retain their own snapshot meaning');check((await change(a,ec,'removed',null,0,null)).error?.message==='v03_schedule_invalid','Never-entered date cannot be marked removed');
 const lr=await read(a,legacy);check(lr.v03_sources[0].v03_reviews.some(r=>r.candidate.information_state==='not_mentioned')&&lr.v03_sources[0].v03_reviews.some(r=>r.candidate.information_state==='uncertain'),'Legacy original-missing and unclear Review remain distinct');
 // Old-compatible unresolved state does not acquire removal metadata.
 check(!(await change(a,ec,'uncertain',null,0,null)).error,'Legacy unresolved state remains supported');check((await read(a,empty)).v03_contents[0].v03_schedule_states[0].date_state===null,'No inferred removal from legacy unclear state');
 check((await change(b,content,'removed',null,5,5)).error?.message==='v03_schedule_unavailable','Other owner removal denied');check((await change(b,content,'removed',null,0,0,rid)).error?.message==='v03_schedule_invalid_retry','Other owner receipt replay denied');check(Boolean((await change(anon,content,'removed',null,5,5)).error),'Anonymous removal denied');check((await b.from('v03_schedule_states').select('*')).data?.length===0,'State owner RLS retained');check((await a.from('v03_schedule_states').update({date_state:'removed'}).eq('user_id',journal.users[0])).error?.code==='42501','Direct metadata UPDATE denied');
 check((await change(a,content,'removed','2026-11-20',5,5)).error?.message==='v03_schedule_invalid','Removal cannot carry a date');check(JSON.stringify(original)===JSON.stringify(await evidence(journal.users[0])),'Source, manual snapshot and Review unchanged throughout');
 // Establish a dated baseline, then inject a receipt failure specific to one UUID.
 check(!(await change(a,content,'present','2026-11-22',5,5)).error,'Dated baseline for rollback');const fail=randomUUID();trigger=true;
 await sql(`create function public.${fn}() returns trigger language plpgsql set search_path='' as $$ begin if new.id='${fail}'::uuid then raise exception 'v03_qa_removal_failure';end if;return new;end $$;create trigger ${fn} before insert on public.v03_schedule_requests for each row execute function public.${fn}();`);
 const before=await read(a,cid),failed=await change(a,content,'removed',null,6,6,fail),after=await read(a,cid);check(failed.error?.message==='v03_qa_removal_failure'&&JSON.stringify(before)===JSON.stringify(after),'Receipt failure rolls back removal, Task date and versions');
 await sql(`drop trigger ${fn} on public.v03_schedule_requests;drop function public.${fn}();`);trigger=false;await a.auth.signOut({scope:'local'});await b.auth.signOut({scope:'local'});
}catch(error){console.log('FAIL '+(error instanceof Error?error.message:'verification failed'));journal.failed=true;persist();process.exitCode=1;}
finally{await cleanup();}
