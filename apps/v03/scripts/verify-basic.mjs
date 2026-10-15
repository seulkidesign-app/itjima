// Explicit remote verification. Creates only synthetic accounts/data and cleans them in finally.
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { config, inspect, request, sql } from './remote-verification-support.mjs';
import { secretHeaders } from './supabase-admin.mjs';
import { saveManual } from '../src/integrations/save.ts';
import {emptyManual,buildManualPayload} from '../src/domain/manual.ts';
const run='v03-qa-basic-'+Date.now()+'-'+randomBytes(4).toString('hex');
mkdirSync(new URL('../.tmp/',import.meta.url),{recursive:true});
const journal={run,users:[],paths:[],passed:[],cleanup:false};
const file=new URL('../.tmp/'+run+'-journal.json',import.meta.url);
const persist=()=>writeFileSync(file,JSON.stringify(journal,null,2),{mode:0o600});
const check=(ok,label)=>{if(!ok)throw new Error(label);journal.passed.push(label);persist();console.log('PASS '+label);};
const admin=secretHeaders(config.secret);
const fn='v03_qa_basic_'+randomBytes(5).toString('hex');
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
 if(trigger)try{await sql(`drop trigger if exists ${fn} on public.v03_basic_requests;drop function if exists public.${fn}();`);trigger=false;}catch{ok=false;console.log('FAIL cleanup trigger');}
 if(journal.paths.length)try{await request(config.url+'/storage/v1/object/v03-sources',admin,'DELETE',{prefixes:journal.paths});}catch{ok=false;console.log('FAIL cleanup objects');}
 if(journal.users.length){const ids=journal.users.map(id=>`'${id}'`).join(',');
  try{await sql(`begin;update public.v03_imports set collaboration_id=null where user_id in (${ids});${['v03_reviews','v03_constraints','v03_tasks','v03_sources','v03_contents','v03_collaborations','v03_imports'].map(t=>`delete from public.${t} where user_id in (${ids});`).join('')}commit;`);}catch{ok=false;console.log('FAIL cleanup rows');}
  for(const id of journal.users)try{await request(config.url+'/auth/v1/admin/users/'+id,admin,'DELETE');}catch{ok=false;console.log('FAIL cleanup account');}
  try{const rows=await sql(`select (select count(*)::int from auth.users where id in (${ids})) users,(select count(*)::int from storage.objects where bucket_id='v03-sources' and split_part(name,'/',1)::text in (${ids})) objects,${['v03_basic_requests','v03_schedule_states','v03_schedule_requests','v03_progress_requests','v03_reviews','v03_constraints','v03_tasks','v03_sources','v03_contents','v03_collaborations','v03_imports'].map(t=>`(select count(*)::int from public.${t} where user_id in (${ids})) as ${t}`).join(',')},(select count(*)::int from pg_trigger where tgname='${fn}') triggers,(select count(*)::int from pg_proc where proname='${fn}') functions`);check(Object.values(rows[0]).every(n=>n===0),'Cleanup verified: zero test accounts, rows, receipts and triggers');}catch{ok=false;console.log('FAIL cleanup verification');}
 }
 journal.cleanup=ok;persist();if(!ok)process.exitCode=1;
}
const change=(c,cid,content,revision,contentRevision,title='Current name',notes='Current note',platform='YouTube',id=randomUUID())=>c.rpc('v03_update_basic_info',{p_id:cid,p_content_id:content,p_title:title,p_notes:notes,p_platform:platform,p_expected_revision:revision,p_expected_content_revision:contentRevision,p_request_id:id});
async function seed(c){const source={text:'Synthetic original basic info guide',images:[]};return saveManual(c,randomUUID(),buildManualPayload({...emptyManual(),title:run,notes:'Initial note',platform:'Instagram',publishDate:'2026-11-06',tasks:[{id:randomUUID(),value:'Synthetic task'}]},source,true),source);}
async function read(c,cid){const r=await c.from('v03_collaborations').select('id,title,notes,status,revision,v03_contents(id,title,platform,revision,v03_tasks(id,type,due_date,completed_at,revision))').eq('id',cid).single();if(r.error)throw new Error('Basic read failed');return r.data;}
async function evidence(uid){return sql(`select (select jsonb_agg(to_jsonb(s) order by id) from public.v03_sources s where user_id='${uid}') sources,(select jsonb_agg(to_jsonb(r) order by id) from public.v03_reviews r where user_id='${uid}') reviews,(select jsonb_agg(to_jsonb(i) order by id) from public.v03_imports i where user_id='${uid}') imports,(select jsonb_agg(to_jsonb(t) order by id) from public.v03_tasks t where user_id='${uid}') tasks,(select jsonb_agg(to_jsonb(s) order by content_id,type) from public.v03_schedule_states s where user_id='${uid}') schedules`);}
try{
 await inspect();const a=await register(),b=await register(),anon=client();const cid=await seed(a),otherCid=await seed(a);let row=await read(a,cid);const content=row.v03_contents[0].id,other=(await read(a,otherCid)).v03_contents[0].id;
 const second=(await sql(`insert into public.v03_contents(user_id,collaboration_id,title,platform) values('${journal.users[0]}','${cid}','Synthetic second content','TikTok') returning id`))[0].id;
 // A completed Task baseline is seeded only to assert no completion writes.
 await sql(`update public.v03_tasks set completed_at='2026-10-16T00:00:00Z' where user_id='${journal.users[0]}' and content_id='${content}' and type='publish'`);
 const original=await evidence(journal.users[0]),rid=randomUUID();const first=await change(a,cid,content,0,0,'Current name','Current note','YouTube',rid);check(!first.error&&first.data.revision===1&&first.data.content_revision===1,'Current name/notes and selected platform committed atomically');
 row=await read(a,cid);check(row.title==='Current name'&&row.notes==='Current note'&&row.v03_contents.find(c=>c.id===content).platform==='YouTube','Current values roundtrip');check(row.v03_contents.find(c=>c.id===second).platform==='TikTok'&&row.v03_contents.find(c=>c.id===second).revision===0,'Other content unchanged');
 check(!(await change(a,cid,content,1,1,'Newer')).error,'Newer info committed');const replay=await change(a,cid,content,0,0,'Current name','Current note','YouTube',rid);check(!replay.error&&JSON.stringify(first.data)===JSON.stringify(replay.data)&&(await read(a,cid)).title==='Newer','Same request receipt never overwrites newer info');
 check((await change(a,cid,content,0,0,'Changed','Current note','YouTube',rid)).error?.message==='v03_basic_invalid_retry','Changed UUID input rejected');
 const race=await Promise.all([change(a,cid,content,2,2,'Race one'),change(a,cid,content,2,2,'Race two')]);check(race.filter(r=>!r.error).length===1&&race.filter(r=>r.error?.message==='v03_basic_conflict').length===1,'Concurrent basic edits: one success and one conflict');
 check(!(await change(a,cid,null,3,null,'Name only',null,null)).error,'Collaboration-only edit supported');check((await read(a,cid)).v03_contents.find(c=>c.id===content).revision===3,'Collaboration-only edit leaves platform version unchanged');
 check(!(await change(a,cid,content,4,3,'Trimmed','  ','')).error,'Empty optional fields accepted');row=await read(a,cid);check(row.notes===null&&row.v03_contents.find(c=>c.id===content).platform===null,'Blank notes/platform normalize to null');
 const same=randomUUID(),dup=await Promise.all([change(a,cid,content,5,4,'Final','Note','Instagram',same),change(a,cid,content,5,4,'Final','Note','Instagram',same)]);check(dup.every(r=>!r.error&&r.data.revision===6),'Concurrent identical UUID applied once');
 check((await change(a,cid,content,5,5)).error?.message==='v03_basic_conflict','Stale collaboration version rejected');check((await change(a,cid,content,6,4)).error?.message==='v03_basic_conflict','Stale content version rejected');
 check((await change(a,cid,other,6,0)).error?.message==='v03_basic_unavailable','Content from another collaboration rejected');check((await change(b,cid,content,6,5)).error?.message==='v03_basic_unavailable','Other user write rejected');check((await change(b,cid,content,0,0,'Current name','Current note','YouTube',rid)).error?.message==='v03_basic_invalid_retry','Other user receipt replay rejected');
 check((await b.from('v03_basic_requests').select('id')).data?.length===0,'Receipt owner RLS');check(Boolean((await change(anon,cid,content,6,5)).error),'Anonymous write rejected');
 for(const [title,notes,platform] of [['',null,null],['  ',null,null],['\n\t',null,null],['\u00a0\u3000',null,null],['x'.repeat(121),null,null],['Name','x'.repeat(5001),null],['Name',null,'x'.repeat(121)]])check((await change(a,cid,content,6,5,title,notes,platform)).error?.message==='v03_basic_invalid','Server validates required name and optional bounds');
 for(const table of ['v03_collaborations','v03_contents','v03_basic_requests'])check((await a.from(table).delete().eq('user_id',journal.users[0])).error?.code==='42501','Direct writes denied '+table);
 check(JSON.stringify(original)===JSON.stringify(await evidence(journal.users[0]))&&(await read(a,cid)).status==='discussion','Original source/manual snapshot/reviews, status, tasks and schedules preserved');
 const fail=randomUUID();trigger=true;await sql(`create function public.${fn}() returns trigger language plpgsql set search_path='' as $$ begin if new.id='${fail}'::uuid then raise exception 'v03_qa_basic_failure';end if;return new;end $$;create trigger ${fn} before insert on public.v03_basic_requests for each row execute function public.${fn}();`);
 const before=await read(a,cid),failed=await change(a,cid,content,6,5,'Rollback','Rollback','Rollback',fail),after=await read(a,cid);check(failed.error?.message==='v03_qa_basic_failure'&&JSON.stringify(before)===JSON.stringify(after),'Receipt failure rolls back both current info and selected platform versions');
 await sql(`drop trigger ${fn} on public.v03_basic_requests;drop function public.${fn}();`);trigger=false;await a.auth.signOut({scope:'local'});await b.auth.signOut({scope:'local'});
}catch(error){console.log('FAIL '+(error instanceof Error?error.message:'verification failed'));journal.failed=true;persist();process.exitCode=1;}
finally{await cleanup();}
