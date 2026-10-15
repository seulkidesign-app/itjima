import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, it, expect } from "vitest";
import {emptyManual,buildManualPayload} from "../src/domain/manual";
import {mockExtract,confirmCandidate,buildPayload,editCandidate} from "../src/domain/brief";
const A="11111111-1111-4111-8111-111111111111",B="22222222-2222-4222-8222-222222222222";
let db:PGlite;
async function user(id=A){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`);}
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key);insert into auth.users values('${A}'),('${B}');create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,storage,public to authenticated,anon;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;grant all on storage.objects to authenticated;set v03.project_ref='zzuytanimpiflygrwqfb';`);
 for(const file of ["202610140001_v03_initial.sql","202610150001_v03_progress.sql","202610150002_v03_schedule.sql","202610150003_v03_manual.sql"])await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
},30000);
afterAll(async()=>{await db.close();});
const payload=()=>buildManualPayload({...emptyManual(),title:'synthetic manual'}, {text:'',images:[]},true);
const prepare=(id:string,p=payload())=>db.query("select public.v03_prepare_manual_import($1,$2)",[id,JSON.stringify(p)]);
const commit=(id:string)=>db.query<{id:string}>("select public.v03_commit_manual_import($1) id",[id]);
it('creates a minimal manual entry without mock candidates or fabricated missing information',async()=>{
 await user();const id=randomUUID();await prepare(id);const {id:cid}=(await commit(id)).rows[0];
 expect((await db.query("select status,notes from public.v03_collaborations where id=$1",[cid])).rows).toEqual([{status:'discussion',notes:null}]);
 expect((await db.query("select t.* from public.v03_tasks t join public.v03_contents c on c.id=t.content_id where c.collaboration_id=$1",[cid])).rows).toHaveLength(0);
 const r=(await db.query<{candidate:{origin:string,information_state?:string,review_state?:string}}>("select candidate from public.v03_reviews where source_id in(select id from public.v03_sources where collaboration_id=$1)",[cid])).rows;
 expect(r).toHaveLength(3);expect(r.every(v=>v.candidate.origin==='manual'&&!v.candidate.review_state&&!v.candidate.information_state)).toBe(true);
});
it('stores entered fields and dates, creates only entered tasks/conditions and preserves manual provenance',async()=>{
 await user();const p=payload();p.collaboration.notes='note';p.content.platform='YouTube';p.schedules.publish='2026-11-01';p.tasks=[{id:randomUUID(),value:'edit'}];p.constraints=[{id:randomUUID(),value:'no price'}];
 const id=randomUUID();await prepare(id,p);const cid=(await commit(id)).rows[0].id;
 expect((await db.query("select notes from public.v03_collaborations where id=$1",[cid])).rows).toEqual([{notes:'note'}]);
 expect((await db.query("select type from public.v03_tasks where content_id in(select id from public.v03_contents where collaboration_id=$1) order by type",[cid])).rows).toEqual([{type:'custom'},{type:'publish'}]);
 expect((await db.query("select review_state,information_state from public.v03_constraints where collaboration_id=$1",[cid])).rows).toEqual([{review_state:'manual',information_state:'present'}]);
});
it('retries the same request exactly once and refuses changed input or another owner',async()=>{
 await user();const id=randomUUID(),p=payload();await prepare(id,p);const first=await commit(id);expect((await commit(id)).rows).toEqual(first.rows);await prepare(id,p);
 await expect(prepare(id,{...p,collaboration:{...p.collaboration,title:'changed'}})).rejects.toThrow('invalid_import_retry');
 await user(B);await expect(commit(id)).rejects.toThrow('import_not_found');await expect(prepare(id,p)).rejects.toThrow('invalid_import_retry');
});
it('requires explicit confirmation, manual mode, valid values and strict shapes',async()=>{
 await user();for(const bad of [{...payload(),confirmed:false},{...payload(),mode:'reviewed_mock'},{...payload(),review:[]},{...payload(),user_id:B},{...payload(),schedules:{draft_delivery:'2026-02-30',publish:null}},{...payload(),tasks:[{id:randomUUID(),value:''}]},{...payload(),content:{platform:123}},{...payload(),constraints:null}])await expect(prepare(randomUUID(),bad as ReturnType<typeof payload>)).rejects.toThrow();
});
it('retains strict old mock gate and denies remote sample RPC access',async()=>{
 await user();await expect(db.query('select public.v03_prepare_import($1,$2)',[randomUUID(),JSON.stringify(payload())])).rejects.toThrow('permission denied');
 await db.exec('reset role');await expect(db.query('select public.v03_validate_payload($1)',[JSON.stringify(payload())])).rejects.toThrow('review_required');
 let d=mockExtract({text:'sample',images:[]});for(const c of d.candidates){if(c.group==='schedules')d=editCandidate(d,c.id,{informationState:'uncertain'});d=confirmCandidate(d,c.id);}
 await expect(prepare(randomUUID(),buildPayload(d,'sample') as unknown as ReturnType<typeof payload>)).rejects.toThrow('invalid_manual');
});
it('requires image bytes before commit and leaves no partial final rows',async()=>{
 await user();const p=payload(),id=randomUUID();p.source.images=[{id:randomUUID(),name:'test.png',size:12,type:'image/png'}];await prepare(id,p);await expect(commit(id)).rejects.toThrow('source_image_missing');
 expect((await db.query('select id from public.v03_collaborations where import_id=$1',[id])).rows).toHaveLength(0);
 await db.query('select public.v03_abort_import($1)',[id]);await expect(commit(id)).rejects.toThrow('import_aborted');
});
it('rolls back every domain row on a late condition insertion failure',async()=>{
 await user();const id=randomUUID(),p=payload();p.constraints=[{id:randomUUID(),value:'synthetic'}];await prepare(id,p);
 await db.exec("reset role;create function public.qa_manual_fail() returns trigger language plpgsql as $$ begin raise exception 'synthetic_failure';end $$;create trigger qa_manual_fail before insert on public.v03_constraints for each row execute function public.qa_manual_fail();");await user();
 await expect(commit(id)).rejects.toThrow('synthetic_failure');
 expect((await db.query('select id from public.v03_collaborations where import_id=$1',[id])).rows).toHaveLength(0);
 expect((await db.query('select state from public.v03_imports where id=$1',[id])).rows).toEqual([{state:'pending'}]);
 await db.exec('reset role;drop trigger qa_manual_fail on public.v03_constraints;drop function public.qa_manual_fail();');
});
it('denies anonymous calls and direct writes',async()=>{
 await user('');await expect(prepare(randomUUID())).rejects.toThrow('authentication_required');await db.exec('reset role;set role anon');await expect(prepare(randomUUID())).rejects.toThrow('permission denied');await user();await expect(db.exec("insert into public.v03_collaborations(title) values('blocked')")).rejects.toThrow('permission denied');
});
