import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, it, expect } from "vitest";
import { mockExtract, editCandidate, confirmCandidate, buildPayload } from "../src/domain/brief";
const A="11111111-1111-4111-8111-111111111111",B="22222222-2222-4222-8222-222222222222";
let db:PGlite;
async function user(id=A){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`);}
async function fixture(unresolved=false){
 await user();let draft=mockExtract({text:"synthetic guide",images:[]});
 for(const c of draft.candidates){if(c.group==="schedules")draft=editCandidate(draft,c.id,unresolved?{informationState:"uncertain"}:{dueDate:"2026-10-20"});draft=confirmCandidate(draft,c.id);}
 const id=randomUUID();await db.query("select public.v03_prepare_import($1,$2)",[id,JSON.stringify(buildPayload(draft,"test"))]);
 const cid=(await db.query<{id:string}>("select public.v03_commit_import($1) id",[id])).rows[0].id;
 const tasks=(await db.query<{id:string}>("select t.id from public.v03_tasks t join public.v03_contents c on c.id=t.content_id where c.collaboration_id=$1 order by t.id",[cid])).rows;
 const content=(await db.query<{id:string}>("select id from public.v03_contents where collaboration_id=$1",[cid])).rows[0].id;
 return {cid,tasks,content};
}
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key);insert into auth.users values('${A}'),('${B}');create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,storage,public to authenticated,anon;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;grant all on storage.objects to authenticated;set v03.project_ref='zzuytanimpiflygrwqfb';`);
 for(const file of ["202610140001_v03_initial.sql","202610150001_v03_progress.sql","202610150002_v03_schedule.sql"])await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
},30000);
afterAll(async()=>{await db.close();});
function change(content:string,opts:{kind?:string,state?:string,date?:string|null,revision?:number,taskRevision?:number|null,request?:string}={}){
 return db.query<{r:{revision:number,task_id:string|null,task_revision:number|null}}>("select public.v03_update_schedule($1,$2,$3,$4,$5,$6,$7) r",[content,opts.kind??"draft_delivery",opts.state??"present",opts.date===undefined?"2026-10-22":opts.date,opts.revision??0,opts.taskRevision===undefined?0:opts.taskRevision,opts.request??randomUUID()]);
}
it("changes only the current Task date and preserves initial evidence, status and completion",async()=>{
 const f=await fixture();const before=(await db.query("select payload from public.v03_imports where collaboration_id=$1",[f.cid])).rows;
 const sources=(await db.query("select raw_text,images from public.v03_sources where collaboration_id=$1",[f.cid])).rows;
 const reviews=(await db.query("select candidate from public.v03_reviews where source_id in (select id from public.v03_sources where collaboration_id=$1) order by id",[f.cid])).rows;
 await db.exec("reset role");await db.query("update public.v03_tasks set completed_at='2026-10-01T00:00:00Z',revision=1 where content_id=$1 and type='draft_delivery'",[f.content]);await user();
 await change(f.content,{taskRevision:1});
 const task=(await db.query<{due_date:string|null,completed_at:string|null}>("select due_date::text,completed_at::text from public.v03_tasks where content_id=$1 and type='draft_delivery'",[f.content])).rows[0];
 expect(task.due_date).toBe("2026-10-22");expect(task.completed_at).not.toBeNull();
 expect((await db.query("select status,revision from public.v03_collaborations where id=$1",[f.cid])).rows).toEqual([{status:"discussion",revision:0}]);
 expect((await db.query("select payload from public.v03_imports where collaboration_id=$1",[f.cid])).rows).toEqual(before);
 expect((await db.query("select raw_text,images from public.v03_sources where collaboration_id=$1",[f.cid])).rows).toEqual(sources);
 expect((await db.query("select candidate from public.v03_reviews where source_id in (select id from public.v03_sources where collaboration_id=$1) order by id",[f.cid])).rows).toEqual(reviews);
});
it("clears dates without deleting the Task or changing its completion and supports restoring a date",async()=>{
 const f=await fixture();let result=await change(f.content,{state:"uncertain",date:null});const id=result.rows[0].r.task_id;
 expect((await db.query<{due_date:string|null}>("select due_date from public.v03_tasks where id=$1",[id])).rows[0].due_date).toBeNull();
 await change(f.content,{state:"not_mentioned",date:null,revision:1,taskRevision:1});
 result=await change(f.content,{date:"2024-02-29",revision:2,taskRevision:2});expect(result.rows[0].r.task_id).toBe(id);
 expect((await db.query<{completed_at:string|null}>("select completed_at from public.v03_tasks where id=$1",[id])).rows[0].completed_at).toBeNull();
});
it("does not create a Task for an unresolved date, but creates one once a new date is confirmed",async()=>{
 const f=await fixture(true);expect(f.tasks).toHaveLength(3);
 expect((await change(f.content,{state:"uncertain",date:null,taskRevision:null})).rows[0].r.task_id).toBeNull();
 const result=await change(f.content,{revision:1,taskRevision:null});expect(result.rows[0].r.task_id).not.toBeNull();
 const task=(await db.query<{due_date:string|null,completed_at:string|null}>("select completed_at,due_date::text from public.v03_tasks where id=$1",[result.rows[0].r.task_id])).rows[0];expect(task.completed_at).toBeNull();expect(task.due_date).toBe("2026-10-22");
});
it("keeps draft and publish edits independent and rejects stale schedule or Task versions",async()=>{
 const f=await fixture();await change(f.content);
 await change(f.content,{kind:"publish",date:"2026-10-25"});
 await expect(change(f.content,{date:"2026-10-23"})).rejects.toThrow("v03_schedule_conflict");
 await expect(change(f.content,{revision:1,taskRevision:0})).rejects.toThrow("v03_schedule_conflict");
 await change(f.content,{date:"2026-10-20",revision:1,taskRevision:1});
 await expect(change(f.content,{date:"2026-10-22"})).rejects.toThrow("v03_schedule_conflict");
});
it("replays identical receipts without overwriting a newer date and rejects changed request input",async()=>{
 const f=await fixture(),request=randomUUID();const first=await change(f.content,{request});
 await change(f.content,{revision:1,taskRevision:1,date:"2026-10-24"});
 expect((await change(f.content,{request})).rows).toEqual(first.rows);
 await expect(change(f.content,{request,date:"2026-10-23"})).rejects.toThrow("v03_schedule_invalid_retry");
 expect((await db.query<{due_date:string|null}>("select due_date::text from public.v03_tasks where content_id=$1 and type='draft_delivery'",[f.content])).rows[0].due_date).toBe("2026-10-24");
});
it("validates exact date-only values and rejects unknown states and kinds",async()=>{
 const f=await fixture();for(const date of ["2026-02-30","2026-10-20T09:00:00Z","10-20","0000-01-01"])await expect(change(f.content,{date})).rejects.toThrow("v03_schedule_invalid");
 await expect(change(f.content,{state:"uncertain"})).rejects.toThrow("v03_schedule_invalid");
 await expect(change(f.content,{state:"invalid"})).rejects.toThrow("v03_schedule_invalid");
 await expect(change(f.content,{kind:"custom"})).rejects.toThrow("v03_schedule_invalid");
});
it("denies another user and anonymous callers and keeps schedule tables RPC-only",async()=>{
 const f=await fixture(),request=randomUUID();await change(f.content,{request});await user(B);
 await expect(change(f.content)).rejects.toThrow("v03_schedule_unavailable");
 await expect(change(f.content,{request})).rejects.toThrow("v03_schedule_invalid_retry");
 for(const table of ["v03_schedule_states","v03_schedule_requests"]){expect((await db.query(`select * from public.${table}`)).rows).toHaveLength(0);await expect(db.exec(`delete from public.${table}`)).rejects.toThrow("permission denied");}
 await user("");await expect(change(f.content)).rejects.toThrow("v03_schedule_auth_required");
 await db.exec("reset role;set role anon");await expect(change(f.content)).rejects.toThrow("permission denied");
});
it("refuses ambiguous same-type tasks without choosing one",async()=>{
 const f=await fixture();await db.exec("reset role");await db.query("insert into public.v03_tasks(user_id,content_id,type,title) values($1,$2,'draft_delivery','duplicate')",[A,f.content]);await user();
 await expect(change(f.content)).rejects.toThrow("v03_schedule_ambiguous");
});
it("rolls back date and state if persisting the receipt fails",async()=>{
 const f=await fixture();await db.exec("reset role;create function public.qa_schedule_fail() returns trigger language plpgsql as $$ begin raise exception 'schedule_receipt_failed';end $$;create trigger qa_schedule_fail before insert on public.v03_schedule_requests for each row execute function public.qa_schedule_fail();");await user();
 await expect(change(f.content)).rejects.toThrow("schedule_receipt_failed");
 expect((await db.query("select due_date::text,revision from public.v03_tasks where content_id=$1 and type='draft_delivery'",[f.content])).rows).toEqual([{due_date:"2026-10-20",revision:0}]);
 expect((await db.query("select * from public.v03_schedule_states where content_id=$1",[f.content])).rows).toHaveLength(0);
 await db.exec("reset role;drop trigger qa_schedule_fail on public.v03_schedule_requests;drop function public.qa_schedule_fail();");
});
