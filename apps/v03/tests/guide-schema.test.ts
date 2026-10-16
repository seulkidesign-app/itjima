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
 for(const file of ["202610140001_v03_initial.sql","202610150001_v03_progress.sql","202610150002_v03_schedule.sql","202610150003_v03_manual.sql","202610160001_v03_basic_info.sql","202610160002_v03_basic_whitespace.sql","202610160003_v03_schedule_removal.sql","202610160004_v03_followup_guides.sql","202610160005_v03_guide_whitespace.sql"])await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
},30000);
afterAll(async()=>{await db.close();});
async function fixture(dates=true){await user();const id=randomUUID(),p=buildManualPayload({...emptyManual(),title:'Synthetic removal',draftDate:dates?'2026-11-10':'',publishDate:dates?'2026-11-12':''},{text:'Original guide',images:[]},true);await db.query('select public.v03_prepare_manual_import($1,$2)',[id,JSON.stringify(p)]);const cid=(await db.query<{id:string}>('select public.v03_commit_manual_import($1) id',[id])).rows[0].id;const content=(await db.query<{id:string}>('select id from public.v03_contents where collaboration_id=$1',[cid])).rows[0].id;return{cid,content};}
const payload=(cid:string,text='Synthetic followup',images:unknown[]=[])=>({mode:'followup_guide',confirmed:true,collaboration_id:cid,source:{raw_text:text,images}});
async function prepare(cid:string,id=randomUUID(),p=payload(cid)){await db.query('select public.v03_prepare_guide_import($1,$2)',[id,JSON.stringify(p)]);return id;}
async function commit(id:string){return (await db.query<{id:string}>('select public.v03_commit_guide_import($1) id',[id])).rows[0].id;}
async function baseline(cid:string){return (await db.query(`select to_jsonb(c) c,(select jsonb_agg(to_jsonb(t) order by id) from public.v03_contents t where collaboration_id=$1) contents,(select jsonb_agg(to_jsonb(t) order by id) from public.v03_tasks t where content_id in(select id from public.v03_contents where collaboration_id=$1)) tasks,(select jsonb_agg(to_jsonb(r) order by id) from public.v03_reviews r where source_id in(select id from public.v03_sources where collaboration_id=$1)) reviews,(select jsonb_agg(to_jsonb(k) order by id) from public.v03_constraints k where collaboration_id=$1) constraints from public.v03_collaborations c where id=$1`,[cid])).rows;}
it('appends only Source; preserves all initial evidence and operating data; retry returns the same Source',async()=>{
 const {cid}=await fixture(),before=await baseline(cid),original=(await db.query('select * from public.v03_sources where collaboration_id=$1',[cid])).rows;
 const id=await prepare(cid),sid=await commit(id);expect(await commit(id)).toBe(sid);await prepare(cid,id);expect(await baseline(cid)).toEqual(before);
 const rows=(await db.query<{id:string,guide_order:number,registered_at:Date,import_id:string}>('select * from public.v03_sources where collaboration_id=$1 order by guide_order nulls first',[cid])).rows;
 expect(rows).toHaveLength(2);expect(rows[0]).toEqual(original[0]);expect(rows[1].guide_order).toBe(1);expect(rows[1].registered_at).toBeTruthy();expect(rows[1].import_id).toBe(id);
 const next=await prepare(cid);await commit(next);expect((await db.query('select guide_order from public.v03_sources where import_id=$1',[next])).rows).toEqual([{guide_order:2}]);
});
it('requires explicit confirmation and nonempty source; rejects injected operating fields and malformed images',async()=>{
 const {cid}=await fixture();for(const p of [payload(cid,' \n\t　'),payload(cid,'\ufeff\u2001'),{...payload(cid),confirmed:false},{...payload(cid),tasks:[]},payload(cid,'x'.repeat(20001)),payload(cid,'',[{id:randomUUID(),name:'x',size:0,type:'image/png'}]),payload(cid,'',[{id:randomUUID(),name:'x',size:1,type:'text/plain'}])])await expect(prepare(cid,randomUUID(),p)).rejects.toThrow();
});
it('checks ownership, request identity and direct write denial',async()=>{
 const {cid}=await fixture(),id=await prepare(cid);await user(B);await expect(prepare(cid)).rejects.toThrow('guide_unavailable');await expect(commit(id)).rejects.toThrow('import_not_found');expect((await db.query('select * from public.v03_sources')).rows).toHaveLength(0);await expect(db.exec("insert into public.v03_sources(user_id,collaboration_id,raw_text) values('"+B+"','"+cid+"','bad')")).rejects.toThrow('permission denied');await user();await expect(prepare(cid,id,payload(cid,'changed'))).rejects.toThrow('invalid_import_retry');await user('');await expect(commit(id)).rejects.toThrow('authentication_required');
});
it('requires staged image bytes and supports image-only sources with private ownership',async()=>{
 const {cid}=await fixture(),img={id:randomUUID(),name:'qa.png',type:'image/png',size:12},id=await prepare(cid,randomUUID(),payload(cid,'',[img])),path=A+'/'+id+'/'+img.id;
 await expect(commit(id)).rejects.toThrow('source_image_missing');await db.exec('reset role');await db.query("insert into storage.objects(bucket_id,name,metadata) values('v03-sources',$1,'{\"size\":12}')",[path]);await user();const sid=await commit(id);expect((await db.query('select raw_text,jsonb_array_length(images) n from public.v03_sources where id=$1',[sid])).rows).toEqual([{raw_text:'',n:1}]);expect((await db.query("select public.v03_object_allowed($1,'read') allowed",[path])).rows).toEqual([{allowed:true}]);await user(B);expect((await db.query("select public.v03_object_allowed($1,'read') allowed",[path])).rows).toEqual([{allowed:false}]);
});
it('rolls back inserted Source if final Import update fails; abort prevents future commit',async()=>{
 const {cid}=await fixture(),id=await prepare(cid),before=await baseline(cid);await db.exec(`reset role;create function public.qa_guide_fail() returns trigger language plpgsql as $$ begin if new.id='${id}'::uuid and new.state='committed' then raise exception 'synthetic_failure';end if;return new;end $$;create trigger qa_guide_fail before update on public.v03_imports for each row execute function public.qa_guide_fail();`);await user();await expect(commit(id)).rejects.toThrow('synthetic_failure');expect((await db.query('select * from public.v03_sources where import_id=$1',[id])).rows).toHaveLength(0);expect(await baseline(cid)).toEqual(before);await db.query('select public.v03_abort_import($1)',[id]);await expect(commit(id)).rejects.toThrow('import_aborted');await db.exec('reset role;drop trigger qa_guide_fail on public.v03_imports;drop function public.qa_guide_fail();');
});
