// Explicit remote verification. Creates only synthetic accounts/data and cleans them in finally.
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { config, inspect, request, sql } from './remote-verification-support.mjs';
import { secretHeaders } from './supabase-admin.mjs';
import {saveGuide,guidePayload} from '../src/integrations/guide.ts';
import { saveManual } from '../src/integrations/save.ts';
import {emptyManual,buildManualPayload} from '../src/domain/manual.ts';
const run='v03-qa-guide-'+Date.now()+'-'+randomBytes(4).toString('hex');
mkdirSync(new URL('../.tmp/',import.meta.url),{recursive:true});
const journal={run,users:[],paths:[],passed:[],cleanup:false};
const file=new URL('../.tmp/'+run+'-journal.json',import.meta.url);
const persist=()=>writeFileSync(file,JSON.stringify(journal,null,2),{mode:0o600});
const check=(ok,label)=>{if(!ok)throw new Error(label);journal.passed.push(label);persist();console.log('PASS '+label);};
const admin=secretHeaders(config.secret);
const fn='v03_qa_guide_'+randomBytes(5).toString('hex');
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
 if(trigger)try{await sql(`drop trigger if exists ${fn} on public.v03_imports;drop function if exists public.${fn}();`);trigger=false;}catch{ok=false;console.log('FAIL cleanup trigger');}
 if(journal.paths.length)try{await request(config.url+'/storage/v1/object/v03-sources',admin,'DELETE',{prefixes:journal.paths});}catch{ok=false;console.log('FAIL cleanup objects');}
 if(journal.users.length){const ids=journal.users.map(id=>`'${id}'`).join(',');
  try{await sql(`begin;update public.v03_imports set collaboration_id=null where user_id in (${ids});${['v03_reviews','v03_constraints','v03_tasks','v03_sources','v03_contents','v03_collaborations','v03_imports'].map(t=>`delete from public.${t} where user_id in (${ids});`).join('')}commit;`);}catch{ok=false;console.log('FAIL cleanup rows');}
  for(const id of journal.users)try{await request(config.url+'/auth/v1/admin/users/'+id,admin,'DELETE');}catch{ok=false;console.log('FAIL cleanup account');}
  try{const rows=await sql(`select (select count(*)::int from auth.users where id in (${ids})) users,(select count(*)::int from storage.objects where bucket_id='v03-sources' and split_part(name,'/',1)::text in (${ids})) objects,${['v03_basic_requests','v03_schedule_states','v03_schedule_requests','v03_progress_requests','v03_reviews','v03_constraints','v03_tasks','v03_sources','v03_contents','v03_collaborations','v03_imports'].map(t=>`(select count(*)::int from public.${t} where user_id in (${ids})) as ${t}`).join(',')},(select count(*)::int from pg_trigger where tgname='${fn}') triggers,(select count(*)::int from pg_proc where proname='${fn}') functions`);check(Object.values(rows[0]).every(n=>n===0),'Cleanup verified: zero test accounts, rows, receipts and triggers');}catch{ok=false;console.log('FAIL cleanup verification');}
 }
 journal.cleanup=ok;persist();if(!ok)process.exitCode=1;
}
async function seed(c){const source={text:'Synthetic initial guide',images:[]};return saveManual(c,randomUUID(),buildManualPayload({...emptyManual(),title:run,draftDate:'2026-11-10',tasks:[{id:randomUUID(),value:'Synthetic task'}]},source,true),source);}
async function read(c,cid){const r=await c.from('v03_collaborations').select('*,v03_contents(*,v03_tasks(*),v03_schedule_states(*)),v03_constraints(*),v03_sources(*,v03_reviews(*))').eq('id',cid).single();if(r.error)throw new Error('Guide read failed');return r.data;}
const domain=r=>JSON.stringify({...r,v03_sources:r.v03_sources.filter(s=>!s.import_id).sort((a,b)=>a.id.localeCompare(b.id))});
function imageSource(){const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0ioAAAAASUVORK5CYII=','base64'),file=new File([bytes],'synthetic-guide.png',{type:'image/png'});return{text:'Synthetic followup guide',images:[{id:randomUUID(),name:file.name,size:file.size,type:file.type,file,url:''}]};}
try{
 await inspect();const a=await register(),b=await register(),anon=client(),cid=await seed(a),original=domain(await read(a,cid));
 const src=imageSource(),id=randomUUID(),payload=guidePayload(cid,src,true),path=`${journal.users[0]}/${id}/${src.images[0].id}`;journal.paths.push(path);persist();
 const sid=await saveGuide(a,id,payload,src);let row=await read(a,cid),added=row.v03_sources.find(s=>s.id===sid);
 check(added?.guide_order===1&&Boolean(added.registered_at)&&added.v03_reviews.length===0,'Source appended with order, server timestamp and no invented Review');check(domain(row)===original,'Initial Source/snapshot/Review and all operating fields unchanged');
 check(!(await a.storage.from('v03-sources').download(path)).error,'Owner reads private follow-up image');check(Boolean((await b.storage.from('v03-sources').download(path)).error),'Other user private image denied');check(Boolean((await anon.storage.from('v03-sources').download(path)).error),'Anonymous private image denied');
 check(await saveGuide(a,id,payload,src)===sid,'Same UUID replay returns existing Source without upload');
 check(Boolean((await b.rpc('v03_prepare_guide_import',{p_id:randomUUID(),p_payload:payload})).error),'Other owner append denied');check(Boolean((await b.rpc('v03_commit_guide_import',{p_id:id})).error),'Other owner receipt denied');check(Boolean((await anon.rpc('v03_prepare_guide_import',{p_id:randomUUID(),p_payload:payload})).error),'Anonymous append denied');
 check((await b.from('v03_sources').select('id')).data?.length===0,'Source owner RLS');check(Boolean((await a.from('v03_sources').insert({user_id:journal.users[0],collaboration_id:cid,raw_text:'forbidden'})).error),'Direct Source INSERT denied');check(Boolean((await a.from('v03_sources').update({raw_text:'forbidden'}).eq('id',sid)).error),'Direct Source UPDATE denied');
 for(const invalid of [{...payload,source:{raw_text:'\ufeff\u2001',images:[]}},{...payload,confirmed:false},{...payload,source:{raw_text:' \n\t',images:[]}},{...payload,tasks:[]},{...payload,source:{raw_text:'x'.repeat(20001),images:[]}}])check(Boolean((await a.rpc('v03_prepare_guide_import',{p_id:randomUUID(),p_payload:invalid})).error),'Invalid/empty/unconfirmed/injected payload rejected');
 check(Boolean((await a.rpc('v03_prepare_guide_import',{p_id:id,p_payload:{...payload,source:{raw_text:'changed',images:[]}}})).error),'Changed UUID payload rejected');
 const append=()=>{const s={text:'Synthetic concurrent guide',images:[]};return saveGuide(a,randomUUID(),guidePayload(cid,s,true),s);};
 const parallel=await Promise.all([append(),append()]);row=await read(a,cid);check(new Set(parallel).size===2&&row.v03_sources.filter(s=>s.import_id).map(s=>s.guide_order).sort().join(',')==='1,2,3','Concurrent appends have unique server order and create no new Collaboration/Content');
 // Lose the successful commit response and the first status read: no image deletion is permitted.
 const lost=imageSource(),lostId=randomUUID(),lostPayload=guidePayload(cid,lost,true),lostPath=`${journal.users[0]}/${lostId}/${lost.images[0].id}`;journal.paths.push(lostPath);persist();let lose=true,hide=false;
 const uncertain=createClient(config.url,process.env.VITE_V03_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(url,init)=>{const u=String(url);if(hide&&u.includes('/rest/v1/v03_imports')){return new Response('{}',{status:400});}const r=await fetch(url,{...init,signal:AbortSignal.timeout(30000)});if(lose&&u.endsWith('/rpc/v03_commit_guide_import')&&r.ok){hide=true;return new Response('{}',{status:400});}return r;}}});
 const session=(await a.auth.getSession()).data.session;await uncertain.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token});
 let unknown=false;try{await saveGuide(uncertain,lostId,lostPayload,lost);}catch{unknown=true;}lose=false;hide=false;
 check(unknown&&!(await a.storage.from('v03-sources').download(lostPath)).error,'Unknown result preserves committed private image');const recovered=await saveGuide(a,lostId,lostPayload,lost);check(Boolean((await read(a,cid)).v03_sources.find(s=>s.id===recovered)),'Unknown result recovers same Source via same UUID');
 // Failure after Source insert, before Import commit, must roll back Source and remove staged bytes after abort.
 const failed=imageSource(),failId=randomUUID(),failPath=`${journal.users[0]}/${failId}/${failed.images[0].id}`;journal.paths.push(failPath);persist();trigger=true;
 await sql(`create function public.${fn}() returns trigger language plpgsql set search_path='' as $$ begin if new.id='${failId}'::uuid and new.state='committed' then raise exception 'v03_qa_guide_failure';end if;return new;end $$;create trigger ${fn} before update on public.v03_imports for each row execute function public.${fn}();`);
 let aborted=false;try{await saveGuide(a,failId,guidePayload(cid,failed,true),failed);}catch(e){aborted=e.constructor.name==='AbortedSaveError';}
 const failState=await a.from('v03_imports').select('state').eq('id',failId).single();
 check(aborted&&failState.data?.state==='aborted'&&(await a.from('v03_sources').select('id').eq('import_id',failId)).data?.length===0,'Late DB failure rolls back Source and aborts Import');check(Boolean((await a.storage.from('v03-sources').download(failPath)).error),'Failed staged image compensated after abort');
 await sql(`drop trigger ${fn} on public.v03_imports;drop function public.${fn}();`);trigger=false;
 const onlyImage=imageSource();onlyImage.text='';const onlyId=randomUUID();journal.paths.push(`${journal.users[0]}/${onlyId}/${onlyImage.images[0].id}`);persist();await saveGuide(a,onlyId,guidePayload(cid,onlyImage,true),onlyImage);check(true,'Image-only guide accepted');
 row=await read(a,cid);check(domain(row)===original,'All original and operating data still unchanged after retries, races and rollback');check(row.v03_sources.filter(s=>s.import_id).length===5,'Exactly five committed follow-up Sources; no duplicate');
 await a.auth.signOut({scope:'local'});await b.auth.signOut({scope:'local'});await uncertain.auth.signOut({scope:'local'});
}catch(error){console.log('FAIL '+(error instanceof Error?error.message:'verification failed'));journal.failed=true;persist();process.exitCode=1;}
finally{await cleanup();}
