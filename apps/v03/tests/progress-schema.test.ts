import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, it, expect } from "vitest";
import { mockExtract, editCandidate, confirmCandidate, buildPayload } from "../src/domain/brief";
const A="11111111-1111-4111-8111-111111111111",B="22222222-2222-4222-8222-222222222222";
let db:PGlite;
async function user(id=A){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`);}
async function fixture(){
 await user();let draft=mockExtract({text:"synthetic guide",images:[]});
 for(const c of draft.candidates){if(c.group==="schedules")draft=editCandidate(draft,c.id,{dueDate:"2026-10-20"});draft=confirmCandidate(draft,c.id);}
 const id=randomUUID();await db.query("select public.v03_prepare_import($1,$2)",[id,JSON.stringify(buildPayload(draft,"test"))]);
 const cid=(await db.query<{id:string}>("select public.v03_commit_import($1) id",[id])).rows[0].id;
 const tasks=(await db.query<{id:string}>("select t.id from public.v03_tasks t join public.v03_contents c on c.id=t.content_id where c.collaboration_id=$1 order by t.id",[cid])).rows;
 return {cid,tasks};
}
const status=(id:string,value:string,revision:number,request=randomUUID())=>db.query<{r:{status:string,revision:number}}>("select public.v03_update_collaboration_status($1,$2,$3,$4) r",[id,value,revision,request]);
const task=(id:string,value:boolean|null,revision:number,request:string|null=randomUUID())=>db.query<{r:{completed_at:string|null,revision:number}}>("select public.v03_set_task_completed($1,$2,$3,$4) r",[id,value,revision,request]);
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key);insert into auth.users values('${A}'),('${B}');create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,storage,public to authenticated,anon;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;grant all on storage.objects to authenticated;set v03.project_ref='zzuytanimpiflygrwqfb';`);
 for(const file of ["202610140001_v03_initial.sql","202610150001_v03_progress.sql"])await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
},30000);
afterAll(async()=>{await db.close();});
it("supports every status including skipped steps and reversals without completing tasks",async()=>{
 const {cid,tasks}=await fixture();let revision=0;
 for(const value of ["completed","discussion","on_hold","scheduled","in_review","draft_sent","producing"]){
  const r=await status(cid,value,revision++);expect(r.rows[0].r).toEqual({id:cid,status:value,revision});
 }
 for(const t of tasks)expect((await db.query<{completed_at:string|null}>("select completed_at from public.v03_tasks where id=$1",[t.id])).rows[0].completed_at).toBeNull();
});
it("completing all tasks never changes collaboration status and undo is supported",async()=>{
 const {cid,tasks}=await fixture();
 for(const t of tasks)expect((await task(t.id,true,0)).rows[0].r.completed_at).not.toBeNull();
 expect((await db.query<{status:string}>("select status from public.v03_collaborations where id=$1",[cid])).rows[0].status).toBe("discussion");
 expect((await task(tasks[0].id,false,1)).rows[0].r.completed_at).toBeNull();
});
it("preserves identical request receipts and rejects request UUID reuse with different input",async()=>{
 const {cid,tasks}=await fixture();const request=randomUUID();
 const first=await task(tasks[0].id,true,0,request);
 expect((await task(tasks[0].id,true,0,request)).rows).toEqual(first.rows);
 await expect(task(tasks[0].id,false,0,request)).rejects.toThrow("v03_progress_invalid_retry");
 await expect(status(cid,"completed",0,request)).rejects.toThrow("v03_progress_invalid_retry");
 await task(tasks[0].id,false,1);
 expect((await task(tasks[0].id,true,0,request)).rows).toEqual(first.rows);
 expect((await db.query<{revision:number}>("select revision from public.v03_tasks where id=$1",[tasks[0].id])).rows[0].revision).toBe(2);
});
it("rejects old revisions including ABA and competing requests",async()=>{
 const {cid,tasks}=await fixture();
 await status(cid,"completed",0);await status(cid,"discussion",1);
 await expect(status(cid,"on_hold",0)).rejects.toThrow("v03_progress_conflict");
 await status(cid,"producing",2);
 await expect(status(cid,"scheduled",2)).rejects.toThrow("v03_progress_conflict");
 await task(tasks[0].id,true,0);await expect(task(tasks[0].id,false,0)).rejects.toThrow("v03_progress_conflict");
});
it("enforces ownership and receipt RLS and disallows anonymous execution",async()=>{
 const {cid,tasks}=await fixture();const request=randomUUID();await task(tasks[0].id,true,0,request);
 await user(B);
 expect((await db.query("select * from public.v03_progress_requests")).rows).toHaveLength(0);
 await expect(status(cid,"completed",0)).rejects.toThrow("v03_progress_unavailable");
 await expect(task(tasks[0].id,false,1)).rejects.toThrow("v03_progress_unavailable");
 await expect(task(tasks[0].id,true,0,request)).rejects.toThrow("v03_progress_invalid_retry");
 await user("");await expect(task(tasks[0].id,true,0)).rejects.toThrow("v03_progress_auth_required");
 await db.exec("reset role;set role anon");await expect(task(tasks[0].id,true,0)).rejects.toThrow("permission denied");
});
it("rejects invalid values and keeps all direct writes blocked",async()=>{
 const {cid,tasks}=await fixture();
 await expect(status(cid,"invalid",0)).rejects.toThrow("v03_progress_invalid");
 await expect(task(tasks[0].id,null,0)).rejects.toThrow("v03_progress_invalid");
 await expect(task(tasks[0].id,true,-1)).rejects.toThrow("v03_progress_invalid");
 await expect(task(tasks[0].id,true,0,null)).rejects.toThrow("v03_progress_invalid");
 for(const table of ["v03_collaborations","v03_tasks","v03_progress_requests"]){
  await expect(db.exec(`update public.${table} set user_id='${B}'`)).rejects.toThrow("permission denied");
  await expect(db.exec(`delete from public.${table}`)).rejects.toThrow("permission denied");
 }
});
it("rolls back the changed row if saving its receipt fails",async()=>{
 const {cid}=await fixture();
 await db.exec("reset role;create function public.qa_receipt_failure() returns trigger language plpgsql as $$ begin raise exception 'receipt_failed';end $$;create trigger qa_receipt_failure before insert on public.v03_progress_requests for each row execute function public.qa_receipt_failure();");
 await user();await expect(status(cid,"completed",0)).rejects.toThrow("receipt_failed");
 expect((await db.query("select status,revision from public.v03_collaborations where id=$1",[cid])).rows).toEqual([{status:"discussion",revision:0}]);
 await db.exec("reset role;drop trigger qa_receipt_failure on public.v03_progress_requests;drop function public.qa_receipt_failure();");
});
