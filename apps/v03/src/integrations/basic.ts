import type {SupabaseClient} from '@supabase/supabase-js';
import {isCollaborationId} from './collaboration';
import {ProgressError} from './progress';
export type BasicOperation={id:string;contentId:string|null;title:string;notes:string|null;platform:string|null;revision:number;contentRevision:number|null;requestId:string};
export function basicProblem(title:string,notes:string,platform:string){
 if(!title.trim()||title.length>120)return '협찬 이름을 1~120자로 입력해주세요.';
 if(notes.length>5000||platform.length>120)return '메모는 5,000자, 플랫폼은 120자 이내로 입력해주세요.';
 return null;
}
export async function saveBasic(client:SupabaseClient,op:BasicOperation,signal:AbortSignal){
 const version=(v:number)=>Number.isSafeInteger(v)&&v>=0;
 if(!isCollaborationId(op.id)||!isCollaborationId(op.requestId)||!version(op.revision)||basicProblem(op.title,op.notes??'',op.platform??'')||
 (op.contentId===null ? op.platform!==null||op.contentRevision!==null : !isCollaborationId(op.contentId)||op.contentRevision===null||!version(op.contentRevision)))throw new ProgressError('invalid');
 const {data,error,status}=await client.rpc('v03_update_basic_info',{p_id:op.id,p_content_id:op.contentId,p_title:op.title,p_notes:op.notes,p_platform:op.platform,p_expected_revision:op.revision,p_expected_content_revision:op.contentRevision,p_request_id:op.requestId}).abortSignal(signal).retry(false);
 if(error){
  if(error.message==='v03_basic_conflict')throw new ProgressError('conflict');
  if(status===401||error.message==='v03_basic_auth_required')throw new ProgressError('signin');
  if(error.message==='v03_basic_unavailable')throw new ProgressError('unavailable');
  if(['v03_basic_invalid','v03_basic_invalid_retry'].includes(error.message))throw new ProgressError('invalid');
  throw new ProgressError('unknown');
 }
 if(!data||data.id!==op.id||data.content_id!==op.contentId||!version(data.revision)||data.revision<=op.revision||
 (op.contentId!==null&&(!version(data.content_revision)||data.content_revision<=op.contentRevision!)))throw new ProgressError('unknown');
}
