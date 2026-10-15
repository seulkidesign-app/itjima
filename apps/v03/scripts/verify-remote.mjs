import {randomUUID,randomBytes} from 'node:crypto';
import {writeFileSync,mkdirSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {config,sql,request,inspect} from './remote-verification-support.mjs';
import {secretHeaders} from '../scripts/supabase-admin.mjs';
import {saveReviewed,AbortedSaveError,cleanupExpired} from '../src/integrations/save.ts';
import {connectionConfig} from '../src/integrations/config.ts';
import {mockExtract,editCandidate,confirmCandidate,buildPayload} from '../src/domain/brief.ts';
const run='v03-qa-'+Date.now()+'-'+randomBytes(4).toString('hex');
mkdirSync(new URL('../.tmp/',import.meta.url),{recursive:true});
const tables=['v03_imports','v03_collaborations','v03_contents','v03_tasks','v03_sources','v03_constraints','v03_reviews'];
const journal={run,users:[],paths:[],results:[]};
const persist=()=>writeFileSync(new URL('../.tmp/'+run+'-journal.json',import.meta.url),JSON.stringify(journal,null,2),{mode:0o600});
function check(ok,label){if(!ok)throw new Error(label);journal.results.push(label);persist();console.log('PASS '+label);}
function client(){return createClient(config.url,process.env.VITE_V03_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0ioAAAAASUVORK5CYII=','base64');
function fixture(images=[]){const source={text:run+' synthetic brief only',images};let d=mockExtract(source);for(const c of d.candidates){if(c.group==='schedules')d=editCandidate(d,c.id,{dueDate:'2026-10-20'});d=confirmCandidate(d,c.id);}return {source,payload:buildPayload(d,run)};}
function image(){return {id:randomUUID(),name:run+'.png',size:png.length,type:'image/png',file:new File([png],run+'.png',{type:'image/png'}),url:''};}
const headers=secretHeaders(config.secret);
const newImport=()=>randomUUID();
const failureId=newImport();
const suffix=randomBytes(5).toString('hex');
const fn='v03_qa_fail_'+suffix;
let triggerCreated=false;
async function domainCounts(uid){const rows=await sql('select '+tables.filter(t=>t!=='v03_imports').map(t=>`(select count(*)::int from public.${t} where user_id='${uid}') as ${t}`).join(','));return rows[0];}
async function register(){const email=run+'-'+journal.users.length+'@example.com';const password=randomBytes(24).toString('base64url')+'aA1!';const user=await request(config.url+'/auth/v1/admin/users',headers,'POST',{email,password,email_confirm:true,user_metadata:{v03_verification_run:run}});const uid=user.id??user.user?.id;if(!/^[0-9a-f-]{36}$/.test(uid))throw new Error('Auth create returned no ID');journal.users.push(uid);persist();const c=client();const login=await c.auth.signInWithPassword({email,password});check(!login.error&&login.data.user?.id===uid,'Auth create and password login '+journal.users.length);return {c,uid};}
async function cleanup(){
 let ok=true;
 if(triggerCreated){try{await sql(`drop trigger if exists ${fn} on public.v03_tasks;drop function if exists public.${fn}();`);triggerCreated=false;}catch{ok=false;console.log('FAIL cleanup test trigger');}}
 if(journal.paths.length){try{await request(config.url+'/storage/v1/object/v03-sources',headers,'DELETE',{prefixes:journal.paths});}catch{ok=false;console.log('FAIL cleanup storage bytes');}}
 if(journal.users.length){const ids=journal.users.map(u=>`'${u}'`).join(',');try{await sql(`begin;update public.v03_imports set collaboration_id=null where user_id in (${ids});${['v03_reviews','v03_constraints','v03_tasks','v03_sources','v03_contents','v03_collaborations','v03_imports'].map(t=>`delete from public.${t} where user_id in (${ids});`).join('')}commit;`);}catch{ok=false;console.log('FAIL cleanup domain rows');}
 for(const uid of journal.users){try{await request(config.url+'/auth/v1/admin/users/'+uid,headers,'DELETE');}catch{ok=false;console.log('FAIL cleanup Auth account');}}
 try{const rows=await sql(`select (select count(*)::int from auth.users where id in (${ids})) as users,(select count(*)::int from storage.objects where bucket_id='v03-sources' and split_part(name,'/',1) in (${ids})) as objects,${tables.map(t=>`(select count(*)::int from public.${t} where user_id in (${ids})) as ${t}`).join(',')}`);check(Object.values(rows[0]).every(x=>x===0),'Cleanup: zero test accounts, rows and storage objects');}catch{ok=false;console.log('FAIL cleanup verification');}}
 journal.cleanup=ok;persist();if(!ok)process.exitCode=1;
}
try{
 const publicConfig=connectionConfig(process.env);
 if(!publicConfig.config)throw new Error('Valid V03 publishable configuration required');
 const schema=await inspect();
 check(tables.every(t=>schema.some(r=>r.tablename===t&&r.rowsecurity)), 'Existing V03 schema required; migration is never run');
 const buckets=await sql("select public,file_size_limit,allowed_mime_types from storage.buckets where id='v03-sources'");check(buckets.length===1&&buckets[0].public===false&&Number(buckets[0].file_size_limit)===10485760,'Private bucket and 10MB limit');
 const policies=await sql("select tablename,count(*)::int n from pg_policies where schemaname='public' and tablename like 'v03_%' group by tablename");check(tables.every(t=>policies.some(p=>p.tablename===t&&p.n===1)),'Owner-read policies on all seven tables');
 const {c:a,uid:A}=await register();const {c:b,uid:B}=await register();
 const anon=client();
 for(const t of tables){const r=await anon.from(t).select('id');check(Boolean(r.error),'Anonymous read denied '+t);}
 const img=image(), id=newImport();journal.paths.push(`${A}/${id}/${img.id}`);persist();const f=fixture([img]);
 const bad=structuredClone(f.payload);bad.review[0].review_state='unreviewed';const badId=newImport();const badResult=await a.rpc('v03_prepare_import',{p_id:badId,p_payload:bad});check(Boolean(badResult.error),'Server rejects unreviewed payload');
 const badRows=await a.from('v03_imports').select('id').eq('id',badId);check(!badRows.error&&badRows.data.length===0,'Rejected payload creates no import');
 const anonymous=await anon.rpc('v03_prepare_import',{p_id:newImport(),p_payload:f.payload});check(Boolean(anonymous.error),'Anonymous RPC denied');
 const cid=await saveReviewed(a,id,f.payload,f.source);check(typeof cid==='string','Reviewed payload and real image saved through SDK');
 const counts=await domainCounts(A);check(counts.v03_collaborations===1&&counts.v03_contents===1&&counts.v03_sources===1&&counts.v03_tasks===5&&counts.v03_constraints===4&&counts.v03_reviews===9,'All six domain tables committed with expected counts');
 check(await saveReviewed(a,id,f.payload,f.source)===cid,'Same request retry returns same collaboration');
 check(JSON.stringify(await domainCounts(A))===JSON.stringify(counts),'Idempotent retry creates no duplicate domain rows');
 for(const t of tables){const r=await b.from(t).select('id').eq('user_id',A);check(!r.error&&r.data.length===0,'User B cannot read user A '+t);const w=await a.from(t).insert({id:randomUUID(),user_id:A});check(Boolean(w.error),'Direct client write denied '+t);}
 const other=await b.rpc('v03_prepare_import',{p_id:id,p_payload:f.payload});check(Boolean(other.error),'Another user cannot reuse import UUID');
 const otherCommit=await b.rpc('v03_commit_import',{p_id:id});check(Boolean(otherCommit.error),'Another user cannot commit import');
 const own=await a.storage.from('v03-sources').download(journal.paths[0]);check(!own.error&&(await own.data.arrayBuffer()).byteLength===png.length,'Owner can download private original image');
 const otherImage=await b.storage.from('v03-sources').download(journal.paths[0]);check(Boolean(otherImage.error),'Another user cannot download private image');
 const anonymousImage=await anon.storage.from('v03-sources').download(journal.paths[0]);check(Boolean(anonymousImage.error),'Anonymous cannot download private image');
 const pub=await fetch(config.url+'/storage/v1/object/public/v03-sources/'+journal.paths[0]);check(!pub.ok,'Public URL cannot expose private image');await pub.body?.cancel();
 const mutation=await a.storage.from('v03-sources').upload(journal.paths[0],img.file,{upsert:true,contentType:'image/png'});check(Boolean(mutation.error),'Committed image overwrite denied');
 await a.storage.from('v03-sources').remove([journal.paths[0]]);const still=await a.storage.from('v03-sources').download(journal.paths[0]);check(!still.error,'Committed image deletion denied');
 const rogue=`${A}/${id}/${randomUUID()}`;journal.paths.push(rogue);persist();const rogueUpload=await a.storage.from('v03-sources').upload(rogue,img.file,{contentType:'image/png'});check(Boolean(rogueUpload.error),'Upload outside manifest denied');
 const bf=fixture();const bid=newImport();await saveReviewed(b,bid,bf.payload,bf.source);for(const t of tables){const r=await a.from(t).select('id').eq('user_id',B);check(!r.error&&r.data.length===0,'User A cannot read user B '+t);}
 const failImage=image();const ff=fixture([failImage]);const failPath=`${A}/${failureId}/${failImage.id}`;journal.paths.push(failPath);persist();
 // Failure injection applies only to this run's import, after parent rows have been inserted.
 triggerCreated=true;
 await sql(`create function public.${fn}() returns trigger language plpgsql set search_path='' as $$ begin if exists(select 1 from public.v03_contents where id=new.content_id and collaboration_id in (select id from public.v03_collaborations where import_id='${failureId}')) then raise exception 'v03_qa_injected_failure';end if;return new;end $$; create trigger ${fn} before insert on public.v03_tasks for each row execute function public.${fn}();`);triggerCreated=true;
 const originalRpc=a.rpc.bind(a);let injected=false;
 a.rpc=async (...args)=>{const result=await originalRpc(...args);if(args[0]==='v03_commit_import'&&args[1]?.p_id===failureId)injected=result.error?.message==='v03_qa_injected_failure';return result;};
 let failed=false;try{await saveReviewed(a,failureId,ff.payload,ff.source);}catch(e){failed=e instanceof AbortedSaveError;}
 a.rpc=originalRpc;
 check(injected,'Real commit RPC reported the scoped injected DB failure');
 check(failed,'Injected mid-transaction failure reaches application compensation');
 check(JSON.stringify(await domainCounts(A))===JSON.stringify(counts),'Mid-transaction failure rolls back every final domain row');
 const state=await a.from('v03_imports').select('state').eq('id',failureId).single();check(!state.error&&state.data.state==='aborted','Failed import atomically marked aborted');
 const objects=await sql(`select count(*)::int n from storage.objects where bucket_id='v03-sources' and name='${failPath}'`);check(objects[0].n===0,'Compensation deletes actual staged image');
 await sql(`drop trigger ${fn} on public.v03_tasks;drop function public.${fn}();`);triggerCreated=false;
 const retry=await a.rpc('v03_commit_import',{p_id:failureId});check(Boolean(retry.error),'Aborted import cannot commit');
 await cleanupExpired(a);check(true,'Login cleanup can reprocess aborted import');
 await a.auth.signOut();await b.auth.signOut();check(true,'Auth signout completed');
}catch(e){console.log('FAIL '+(e instanceof Error?e.message:'verification failed'));journal.failure=e instanceof Error?e.message:'verification failed';persist();process.exitCode=1;}
finally{await cleanup();}
