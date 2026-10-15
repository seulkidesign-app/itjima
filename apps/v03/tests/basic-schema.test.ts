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
 for(const file of ["202610140001_v03_initial.sql","202610150001_v03_progress.sql","202610150002_v03_schedule.sql","202610150003_v03_manual.sql","202610160001_v03_basic_info.sql","202610160002_v03_basic_whitespace.sql"])await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
},30000);
afterAll(async()=>{await db.close();});
async function fixture(){
 await user();const id=randomUUID(),p=buildManualPayload({...emptyManual(),title:'Initial',notes:'original note',platform:'Instagram',publishDate:'2026-11-01',tasks:[{id:randomUUID(),value:'task'}]},{text:'original guide',images:[]},true);
 await db.query('select public.v03_prepare_manual_import($1,$2)',[id,JSON.stringify(p)]);
 const cid=(await db.query<{id:string}>('select public.v03_commit_manual_import($1) id',[id])).rows[0].id;
 const content=(await db.query<{id:string}>('select id from public.v03_contents where collaboration_id=$1',[cid])).rows[0].id;
 await db.exec('reset role');const second=(await db.query<{id:string}>("insert into public.v03_contents(user_id,collaboration_id,title,platform) values($1,$2,'second','TikTok') returning id",[A,cid])).rows[0].id;await user();return{cid,content,second};
}
const change=(f:{cid:string,content:string},revision=0,contentRevision:number|null=0,title='Current',notes:string|null='new note',platform:string|null='YouTube',request=randomUUID(),target:string|null=f.content)=>db.query<{r:{revision:number,content_revision:number}}>('select public.v03_update_basic_info($1,$2,$3,$4,$5,$6,$7,$8) r',[f.cid,target,title,notes,platform,revision,contentRevision,request]);
const immutable=()=>db.query("select (select jsonb_agg(to_jsonb(s) order by id) from public.v03_sources s) sources,(select jsonb_agg(to_jsonb(r) order by id) from public.v03_reviews r) reviews,(select jsonb_agg(to_jsonb(i) order by id) from public.v03_imports i) imports,(select jsonb_agg(to_jsonb(t) order by id) from public.v03_tasks t) tasks,(select jsonb_agg(to_jsonb(s) order by content_id,type) from public.v03_schedule_states s) schedules");
it('changes current info only and explicitly targets one content',async()=>{
 const f=await fixture(),before=(await immutable()).rows;await change(f);
 expect((await db.query('select title,notes,status,revision from public.v03_collaborations where id=$1',[f.cid])).rows).toEqual([{title:'Current',notes:'new note',status:'discussion',revision:1}]);
 expect((await db.query('select platform,revision from public.v03_contents where id=$1',[f.content])).rows).toEqual([{platform:'YouTube',revision:1}]);expect((await db.query('select platform,revision from public.v03_contents where id=$1',[f.second])).rows).toEqual([{platform:'TikTok',revision:0}]);expect((await immutable()).rows).toEqual(before);
});
it('requires name, bounds optional values and normalizes blank notes/platform to null',async()=>{
 const f=await fixture();for(const title of ['', '  ', '\n\t', '\u00a0\u3000', 'x'.repeat(121)])await expect(change(f,0,0,title)).rejects.toThrow('v03_basic_invalid');
 await expect(change(f,0,0,'valid','x'.repeat(5001))).rejects.toThrow('v03_basic_invalid');await expect(change(f,0,0,'valid',null,'x'.repeat(121))).rejects.toThrow('v03_basic_invalid');
 await change(f,0,0,' Trimmed ','  ','');expect((await db.query('select title,notes from public.v03_collaborations where id=$1',[f.cid])).rows).toEqual([{title:'Trimmed',notes:null}]);expect((await db.query('select platform from public.v03_contents where id=$1',[f.content])).rows).toEqual([{platform:null}]);
});
it('supports collaboration-only updates without touching content',async()=>{const f=await fixture();await change(f,0,null,'Name',null,null,randomUUID(),null);expect((await db.query('select platform,revision from public.v03_contents where id=$1',[f.content])).rows).toEqual([{platform:'Instagram',revision:0}]);});
it('rejects stale collaboration and content versions, including ABA',async()=>{
 const f=await fixture();await change(f);await expect(change(f)).rejects.toThrow('v03_basic_conflict');await expect(change(f,1,0)).rejects.toThrow('v03_basic_conflict');await change(f,1,1,'Initial','original note','Instagram');await expect(change(f)).rejects.toThrow('v03_basic_conflict');
});
it('replays same receipt without overwriting newer data and rejects changed UUID reuse',async()=>{const f=await fixture(),id=randomUUID(),first=await change(f,0,0,'Current','new','YouTube',id);await change(f,1,1,'Newer');expect((await change(f,0,0,'Current','new','YouTube',id)).rows).toEqual(first.rows);await expect(change(f,0,0,'Changed','new','YouTube',id)).rejects.toThrow('v03_basic_invalid_retry');expect((await db.query('select title from public.v03_collaborations where id=$1',[f.cid])).rows).toEqual([{title:'Newer'}]);});
it('checks owner and content collaboration membership, plus RLS and direct-write denial',async()=>{
 const f=await fixture(),other=await fixture();await expect(change(f,0,0,'Wrong','note','YouTube',randomUUID(),other.content)).rejects.toThrow('v03_basic_unavailable');
 const id=randomUUID();await change(f,0,0,'Current','new','YouTube',id);await user(B);await expect(change(f,1,1)).rejects.toThrow('v03_basic_unavailable');await expect(change(f,0,0,'Current','new','YouTube',id)).rejects.toThrow('v03_basic_invalid_retry');expect((await db.query('select * from public.v03_basic_requests')).rows).toHaveLength(0);await expect(db.exec('delete from public.v03_basic_requests')).rejects.toThrow('permission denied');await expect(db.exec("update public.v03_contents set platform='blocked'")).rejects.toThrow('permission denied');
 await user('');await expect(change(f)).rejects.toThrow('v03_basic_auth_required');await db.exec('reset role;set role anon');await expect(change(f)).rejects.toThrow('permission denied');
});
it('late receipt failure rolls back collaboration and selected content together',async()=>{
 const f=await fixture();await db.exec("reset role;create function public.qa_basic_fail() returns trigger language plpgsql as $$ begin raise exception 'synthetic_failure';end $$;create trigger qa_basic_fail before insert on public.v03_basic_requests for each row execute function public.qa_basic_fail();");await user();await expect(change(f)).rejects.toThrow('synthetic_failure');
 expect((await db.query('select title,notes,revision from public.v03_collaborations where id=$1',[f.cid])).rows).toEqual([{title:'Initial',notes:'original note',revision:0}]);expect((await db.query('select platform,revision from public.v03_contents where id=$1',[f.content])).rows).toEqual([{platform:'Instagram',revision:0}]);await db.exec('reset role;drop trigger qa_basic_fail on public.v03_basic_requests;drop function public.qa_basic_fail();');
});
it('normalizes tab/newline/unicode blanks without stripping ordinary letters',async()=>{const f=await fixture();await change(f,0,0,' \tv\n ','\u3000','\t');expect((await db.query('select title,notes from public.v03_collaborations where id=$1',[f.cid])).rows).toEqual([{title:'v',notes:null}]);expect((await db.query('select platform from public.v03_contents where id=$1',[f.content])).rows).toEqual([{platform:null}]);});
