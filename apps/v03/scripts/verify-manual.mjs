// Explicit remote verification. Creates only synthetic accounts/data and cleans them in finally.
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { config, inspect, request, sql } from './remote-verification-support.mjs';
import { secretHeaders } from './supabase-admin.mjs';
import { saveManual } from '../src/integrations/save.ts';
import {emptyManual,buildManualPayload} from '../src/domain/manual.ts';
const run='v03-qa-manual-'+Date.now()+'-'+randomBytes(4).toString('hex');
mkdirSync(new URL('../.tmp/',import.meta.url),{recursive:true});
const journal={run,users:[],paths:[],passed:[],cleanup:false};
const file=new URL('../.tmp/'+run+'-journal.json',import.meta.url);
const persist=()=>writeFileSync(file,JSON.stringify(journal,null,2),{mode:0o600});
const check=(ok,label)=>{if(!ok)throw new Error(label);journal.passed.push(label);persist();console.log('PASS '+label);};
const admin=secretHeaders(config.secret);
const fn='v03_qa_manual_'+randomBytes(5).toString('hex');
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
 if(trigger)try{await sql(`drop trigger if exists ${fn} on public.v03_constraints;drop function if exists public.${fn}();`);trigger=false;}catch{ok=false;console.log('FAIL cleanup trigger');}
 if(journal.paths.length)try{await request(config.url+'/storage/v1/object/v03-sources',admin,'DELETE',{prefixes:journal.paths});}catch{ok=false;console.log('FAIL cleanup objects');}
 if(journal.users.length){const ids=journal.users.map(id=>`'${id}'`).join(',');
  try{await sql(`begin;update public.v03_imports set collaboration_id=null where user_id in (${ids});${['v03_reviews','v03_constraints','v03_tasks','v03_sources','v03_contents','v03_collaborations','v03_imports'].map(t=>`delete from public.${t} where user_id in (${ids});`).join('')}commit;`);}catch{ok=false;console.log('FAIL cleanup rows');}
  for(const id of journal.users)try{await request(config.url+'/auth/v1/admin/users/'+id,admin,'DELETE');}catch{ok=false;console.log('FAIL cleanup account');}
  try{const rows=await sql(`select (select count(*)::int from auth.users where id in (${ids})) users,(select count(*)::int from storage.objects where bucket_id='v03-sources' and split_part(name,'/',1)::text in (${ids})) objects,${['v03_schedule_states','v03_schedule_requests','v03_progress_requests','v03_reviews','v03_constraints','v03_tasks','v03_sources','v03_contents','v03_collaborations','v03_imports'].map(t=>`(select count(*)::int from public.${t} where user_id in (${ids})) as ${t}`).join(',')},(select count(*)::int from pg_trigger where tgname='${fn}') triggers,(select count(*)::int from pg_proc where proname='${fn}') functions`);check(Object.values(rows[0]).every(n=>n===0),'Cleanup verified: zero test accounts, rows, receipts and triggers');}catch{ok=false;console.log('FAIL cleanup verification');}
 }
 journal.cleanup=ok;persist();if(!ok)process.exitCode=1;
}
try{
 await inspect();
 const a=await register(),b=await register(),anon=client();
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0ioAAAAASUVORK5CYII=','base64');
 const image={id:randomUUID(),name:'synthetic-manual.png',size:bytes.length,type:'image/png',file:new File([bytes],'synthetic-manual.png',{type:'image/png'}),url:''};
 const source={text:'Synthetic manual verification only',images:[image]},form={...emptyManual(),title:run,platform:'YouTube',notes:'Synthetic note',publishDate:'2026-11-05',tasks:[{id:randomUUID(),value:'Synthetic custom task'}],constraints:[{id:randomUUID(),value:'Synthetic condition'}]};
 const p=buildManualPayload(form,source,true),id=randomUUID();journal.paths.push(`${journal.users[0]}/${id}/${image.id}`);persist();
 const cid=await saveManual(a,id,p,source);check(Boolean(cid),'Manual image registration committed');
 const replay=await saveManual(a,id,p,source);check(replay===cid,'Same request retry returns one collaboration');
 const read=await a.from('v03_collaborations').select('title,notes,status,v03_contents(platform,v03_tasks(type,due_date)),v03_constraints(review_state,value),v03_sources(raw_text,images,v03_reviews(candidate))').eq('id',cid).single();
 check(!read.error&&read.data.notes===form.notes&&read.data.v03_contents[0].platform===form.platform,'Manual name/platform/notes roundtrip');
 check(read.data.v03_contents[0].v03_tasks.length===2&&read.data.v03_contents[0].v03_tasks.every(t=>t.type!=='draft_delivery'),'Only entered tasks and optional publish date created');
 const reviews=read.data.v03_sources[0].v03_reviews;
 check(reviews.every(r=>r.candidate.origin==='manual'&&!r.candidate.review_state)&&reviews.some(r=>r.candidate.input_state==='not_entered')&&read.data.v03_constraints.every(c=>c.review_state==='manual'),'Manual provenance, no fabricated confirmation or original-missing label');
 const path=journal.paths[0],dl=await a.storage.from('v03-sources').download(path);check(!dl.error&&Buffer.from(await dl.data.arrayBuffer()).equals(bytes),'Private image bytes roundtrip');
 check(Boolean((await b.storage.from('v03-sources').download(path)).error),'Other owner image denied');
 check((await b.from('v03_collaborations').select('id').eq('id',cid)).data?.length===0,'Other owner record hidden');
 check(Boolean((await b.rpc('v03_commit_manual_import',{p_id:id})).error),'Other owner commit denied');
 check(Boolean((await anon.rpc('v03_prepare_manual_import',{p_id:randomUUID(),p_payload:p})).error),'Anonymous manual write denied');
 const simple=buildManualPayload({...emptyManual(),title:run+' empty'},{text:'',images:[]},true),simpleId=randomUUID();
 const simpleCid=await saveManual(a,simpleId,simple,{text:'',images:[]});
 const empty=await a.from('v03_collaborations').select('v03_contents(v03_tasks(id)),v03_constraints(id)').eq('id',simpleCid).single();
 check(!empty.error&&empty.data.v03_contents[0].v03_tasks.length===0&&empty.data.v03_constraints.length===0,'No source, dates or fixed nine candidates required');
 const raceId=randomUUID();const race=await Promise.all([saveManual(a,raceId,simple,{text:'',images:[]}),saveManual(a,raceId,simple,{text:'',images:[]})]);check(race[0]===race[1],'Concurrent duplicate request creates once');
 check(Boolean((await a.rpc('v03_prepare_manual_import',{p_id:id,p_payload:{...p,collaboration:{...p.collaboration,title:'changed'}}})).error),'Changed retry payload rejected');
 for(const bad of [{...simple,confirmed:false},{...simple,mode:'reviewed_mock'},{...simple,review:[]},{...simple,user_id:journal.users[1]},{...simple,schedules:{draft_delivery:'2026-02-30',publish:null}}])check(Boolean((await a.rpc('v03_prepare_manual_import',{p_id:randomUUID(),p_payload:bad})).error),'Invalid/manual boundary input rejected');
 check((await a.rpc('v03_prepare_import',{p_id:randomUUID(),p_payload:simple})).error?.code==='42501','Remote mock prepare permission removed');
 check((await a.rpc('v03_commit_import',{p_id:id})).error?.code==='42501','Remote mock commit permission removed');
 check((await a.from('v03_collaborations').update({notes:'blocked'}).eq('id',cid)).error?.code==='42501','Direct writes remain denied');
 // Failure scoped to this run/user only; late failure after source/tasks creation.
 trigger=true;await sql(`create function public.${fn}() returns trigger language plpgsql set search_path='' as $$ begin if new.user_id='${journal.users[0]}'::uuid then raise exception 'v03_qa_manual_failure';end if;return new;end $$;create trigger ${fn} before insert on public.v03_constraints for each row execute function public.${fn}();`);
 const failId=randomUUID();journal.paths.push(`${journal.users[0]}/${failId}/${image.id}`);persist();let failed=false;
 try{await saveManual(a,failId,p,source);}catch{failed=true;}
 const state=await a.from('v03_imports').select('state').eq('id',failId).single();
 check(failed&&!state.error&&state.data.state==='aborted'&&(await a.from('v03_collaborations').select('id').eq('import_id',failId)).data?.length===0,'Late DB failure rolls back manual domain rows and aborts import');
 check(Boolean((await a.storage.from('v03-sources').download(journal.paths[1])).error),'Failed manual image compensated and deleted');
 await sql(`drop trigger ${fn} on public.v03_constraints;drop function public.${fn}();`);trigger=false;
 await a.auth.signOut({scope:'local'});await b.auth.signOut({scope:'local'});
}catch(error){console.log('FAIL '+(error instanceof Error?error.message:'verification failed'));journal.failed=true;persist();process.exitCode=1;}
finally{await cleanup();}
