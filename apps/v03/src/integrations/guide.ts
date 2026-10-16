import type {SupabaseClient} from '@supabase/supabase-js';
import {hasSource,type Source} from '../domain/brief.ts';
import {AbortedSaveError} from './save.ts';
export class GuideInputError extends Error {}
export function guidePayload(collaborationId:string,source:Source,confirmed:boolean){
 if(!confirmed||!hasSource(source))throw new Error('텍스트 또는 이미지를 확인해주세요.');
 return {mode:'followup_guide',confirmed:true,collaboration_id:collaborationId,source:{raw_text:source.text,images:source.images.map(({id,name,size,type})=>({id,name,size,type}))}};
}
const unknown=()=>new Error('저장 결과 확인이 필요해요. 입력을 유지하고 같은 요청으로 재시도해주세요.');
export async function saveGuide(client:SupabaseClient,id:string,payload:ReturnType<typeof guidePayload>,source:Source):Promise<string>{
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user)throw new Error('V03 계정으로 로그인해주세요.');
 const prepared=await client.rpc('v03_prepare_guide_import',{p_id:id,p_payload:payload});
 if(prepared.error){
  if(prepared.error.code==='P0001')throw new GuideInputError('가이드 저장 준비가 거부됐어요. 로그인·소유권·입력을 확인해주세요.');
  throw unknown();
 }
 if(prepared.data.state==='committed'){
  if(!prepared.data.source_id)throw unknown();
  return prepared.data.source_id;
 }
 const paths=source.images.map(image=>`${user.id}/${id}/${image.id}`);
 try{
  for(let i=0;i<source.images.length;i++){
   const uploaded=await client.storage.from('v03-sources').upload(paths[i],source.images[i].file,{upsert:true,contentType:source.images[i].type});
   if(uploaded.error)throw uploaded.error;
  }
  const committed=await client.rpc('v03_commit_guide_import',{p_id:id});
  if(committed.error||!committed.data)throw unknown();
  return committed.data as string;
 }catch{
  const state=await client.from('v03_imports').select('state').eq('id',id).single();
  if(state.error)throw unknown();
  if(state.data.state==='committed'){
   const saved=await client.from('v03_sources').select('id').eq('import_id',id).single();
   if(saved.error||!saved.data?.id)throw unknown();
   return saved.data.id as string;
  }
  const aborted=await client.rpc('v03_abort_import',{p_id:id});
  if(aborted.error||!aborted.data)throw unknown();
  if(paths.length){const removed=await client.storage.from('v03-sources').remove(paths);if(removed.error)throw new AbortedSaveError('가이드는 저장되지 않았지만 임시 이미지 정리가 필요해요. 다음 로그인에서 다시 정리해요.');}
  throw new AbortedSaveError('추가 실패로 가이드와 임시 이미지를 정리했어요. 다시 시도해주세요.');
 }
}
