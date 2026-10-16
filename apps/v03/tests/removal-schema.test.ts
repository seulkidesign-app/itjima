import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, it, expect } from "vitest";
import {emptyManual,buildManualPayload} from "../src/domain/manual";
const A="11111111-1111-4111-8111-111111111111",B="22222222-2222-4222-8222-222222222222";
let db:PGlite;
async function user(id=A){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`);}
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key);insert into auth.users values('${A}'),('${B}');create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,storage,public to authenticated,anon;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;grant all on storage.objects to authenticated;set v03.project_ref='zzuytanimpiflygrwqfb';`);
 for(const file of ["202610140001_v03_initial.sql","202610150001_v03_progress.sql","202610150002_v03_schedule.sql","202610150003_v03_manual.sql","202610160001_v03_basic_info.sql","202610160002_v03_basic_whitespace.sql","202610160003_v03_schedule_removal.sql"])await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
},30000);
afterAll(async()=>{await db.close();});
async function fixture(dates=true){await user();const id=randomUUID(),p=buildManualPayload({...emptyManual(),title:'Synthetic removal',draftDate:dates?'2026-11-10':'',publishDate:dates?'2026-11-12':''},{text:'Original guide',images:[]},true);await db.query('select public.v03_prepare_manual_import($1,$2)',[id,JSON.stringify(p)]);const cid=(await db.query<{id:string}>('select public.v03_commit_manual_import($1) id',[id])).rows[0].id;const content=(await db.query<{id:string}>('select id from public.v03_contents where collaboration_id=$1',[cid])).rows[0].id;return{cid,content};}
function change(content:string,state='removed',date:string|null=null,revision=0,taskRevision:number|null=0,id=randomUUID()){return db.query<{r:{task_id:string,revision:number,task_revision:number}}>('select public.v03_update_schedule($1,$2,$3,$4,$5,$6,$7) r',[content,'draft_delivery',state,date,revision,taskRevision,id]);}
const evidence=()=>db.query("select (select jsonb_agg(to_jsonb(s) order by id) from public.v03_sources s) sources,(select jsonb_agg(to_jsonb(r) order by id) from public.v03_reviews r) reviews,(select jsonb_agg(to_jsonb(i) order by id) from public.v03_imports i) imports");
it('explicitly removes date and restores the same completed Task without changing any other schedule/status/evidence',async()=>{
 const f=await fixture();await db.exec('reset role');await db.query("update public.v03_tasks set completed_at='2026-10-16T00:00:00Z' where content_id=$1 and type='draft_delivery'",[f.content]);await user();const before=(await evidence()).rows;const tasks=(await db.query<{id:string,type:string,due_date:string,completed_at:string|null,revision:number}>('select id,type,due_date::text,completed_at::text,revision from public.v03_tasks where content_id=$1 order by id',[f.content])).rows;
 const removed=await change(f.content);expect(removed.rows[0].r.task_id).toBe(tasks.find(t=>t.type==='draft_delivery')!.id);
 expect((await db.query('select information_state,date_state from public.v03_schedule_states where content_id=$1',[f.content])).rows).toEqual([{information_state:null,date_state:'removed'}]);
 await change(f.content,'present','2026-11-15',1,1);expect((await db.query('select information_state,date_state from public.v03_schedule_states where content_id=$1',[f.content])).rows).toEqual([{information_state:'present',date_state:null}]);
 const after=(await db.query<{id:string,type:string,due_date:string,completed_at:string|null,revision:number}>('select id,type,due_date::text,completed_at::text,revision from public.v03_tasks where content_id=$1 order by id',[f.content])).rows;
 expect(after.find(t=>t.type==='publish')).toEqual(tasks.find(t=>t.type==='publish'));expect(after.find(t=>t.type==='draft_delivery')!.completed_at).toBe(tasks.find(t=>t.type==='draft_delivery')!.completed_at);expect(after.find(t=>t.type==='draft_delivery')!.due_date).toBe('2026-11-15');expect((await evidence()).rows).toEqual(before);expect((await db.query('select status,revision from public.v03_collaborations where id=$1',[f.cid])).rows).toEqual([{status:'discussion',revision:0}]);
});
it('cannot label an absent or never-entered date as removed and preserves legacy semantics',async()=>{
 const empty=await fixture(false);await expect(change(empty.content,'removed',null,0,null)).rejects.toThrow('v03_schedule_invalid');
 const f=await fixture();await change(f.content,'uncertain');await expect(change(f.content,'removed',null,1,1)).rejects.toThrow('v03_schedule_invalid');expect((await db.query('select information_state,date_state from public.v03_schedule_states where content_id=$1',[f.content])).rows).toEqual([{information_state:'uncertain',date_state:null}]);
});
it('supports identical removal retry without erasing a restored newer date',async()=>{
 const f=await fixture(),id=randomUUID(),first=await change(f.content,'removed',null,0,0,id);await change(f.content,'present','2026-11-15',1,1);expect((await change(f.content,'removed',null,0,0,id)).rows).toEqual(first.rows);await expect(change(f.content,'uncertain',null,0,0,id)).rejects.toThrow('v03_schedule_invalid_retry');await expect(change(f.content,'removed',null,0,0)).rejects.toThrow('v03_schedule_conflict');
});
it('retains owner guards, receipt RLS, direct-write denial and both revisions',async()=>{
 const f=await fixture(),id=randomUUID();await change(f.content,'removed',null,0,0,id);await user(B);await expect(change(f.content,'removed',null,1,1)).rejects.toThrow('v03_schedule_unavailable');await expect(change(f.content,'removed',null,0,0,id)).rejects.toThrow('v03_schedule_invalid_retry');expect((await db.query('select * from public.v03_schedule_states')).rows).toHaveLength(0);await expect(db.exec("update public.v03_schedule_states set date_state='removed'")).rejects.toThrow('permission denied');await user('');await expect(change(f.content)).rejects.toThrow('v03_schedule_auth_required');await user();await expect(change(f.content,'present','2026-11-17',1,0)).rejects.toThrow('v03_schedule_conflict');
});
it('late receipt failure rolls back date, metadata and versions',async()=>{
 const f=await fixture();await db.exec("reset role;create function public.qa_removal_fail() returns trigger language plpgsql as $$ begin raise exception 'synthetic_failure';end $$;create trigger qa_removal_fail before insert on public.v03_schedule_requests for each row execute function public.qa_removal_fail();");await user();await expect(change(f.content)).rejects.toThrow('synthetic_failure');expect((await db.query('select date_state from public.v03_schedule_states where content_id=$1',[f.content])).rows).toHaveLength(0);expect((await db.query("select due_date::text,revision from public.v03_tasks where content_id=$1 and type='draft_delivery'",[f.content])).rows).toEqual([{due_date:'2026-11-10',revision:0}]);await db.exec('reset role;drop trigger qa_removal_fail on public.v03_schedule_requests;drop function public.qa_removal_fail();');
});
it('keeps never-entered initial meaning after a later date is added, removed and restored',async()=>{
 const f=await fixture(false),before=(await evidence()).rows;
 const added=await change(f.content,'present','2026-11-20',0,null);const id=added.rows[0].r.task_id;
 const removed=await change(f.content,'removed',null,1,0);expect(removed.rows[0].r.task_id).toBe(id);
 const restored=await change(f.content,'present','2026-11-21',2,1);expect(restored.rows[0].r.task_id).toBe(id);expect((await evidence()).rows).toEqual(before);
 expect((await db.query("select candidate->>'input_state' state from public.v03_reviews where source_id in(select id from public.v03_sources where collaboration_id=$1) and candidate->>'candidate_id'='draft_due'",[f.cid])).rows).toEqual([{state:'not_entered'}]);
});
