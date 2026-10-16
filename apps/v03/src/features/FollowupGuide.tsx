import {useEffect,useRef,useState} from 'react';
import type {Source} from '../domain/brief';
import {supabase} from '../integrations/client';
import {GuideInputError,guidePayload,saveGuide} from '../integrations/guide';
import {AbortedSaveError} from '../integrations/save';
import {BriefImport} from './BriefImport';
import {SourcePreview} from './SourcePreview';
export function FollowupGuide({id,disabled,onSaved}:{id:string;disabled:boolean;onSaved:()=>void}){
 const [opened,setOpened]=useState(false),[preview,setPreview]=useState(false),[confirmed,setConfirmed]=useState(false);
 const [source,setSource]=useState<Source>({text:'',images:[]});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[retryOnly,setRetryOnly]=useState(false);
 const live=useRef(false),guard=useRef(false),current=useRef(source),request=useRef(crypto.randomUUID());
 current.current=source;
 useEffect(()=>{live.current=true;return()=>{live.current=false;current.current.images.forEach(i=>URL.revokeObjectURL(i.url));};},[]);
 async function save(){
  if(guard.current||disabled||!supabase||!confirmed)return;
  guard.current=true;setBusy(true);setError('');setRetryOnly(true);
  try{await saveGuide(supabase,request.current,guidePayload(id,source,confirmed),source);if(live.current)onSaved();}
  catch(e){if(live.current){setError(e instanceof Error?e.message:'추가에 실패했어요. 같은 요청으로 재시도해주세요.');if(e instanceof AbortedSaveError||e instanceof GuideInputError){request.current=crypto.randomUUID();setRetryOnly(false);}}}
  finally{guard.current=false;if(live.current)setBusy(false);}
 }
 return <section className="panel" aria-label="후속 가이드 추가">
  {!opened?<button disabled={disabled} onClick={()=>setOpened(true)}>후속 가이드 추가</button>:<>
   {!preview?<BriefImport followup source={source} onText={text=>setSource(s=>({...s,text}))} onImages={images=>setSource(s=>({...s,images:[...s.images,...images]}))} onRemove={id=>setSource(s=>{s.images.filter(i=>i.id===id).forEach(i=>URL.revokeObjectURL(i.url));return {...s,images:s.images.filter(i=>i.id!==id)};})} onPreview={()=>setPreview(true)}/>:<>
    <h2>추가할 원본 확인</h2><SourcePreview source={source}/>
    <p>기존 원본과 최초 입력·검토 기록은 보존해요. 일정·할 일·제작 조건·상태는 변경하지 않아요.</p>
    <p className="small muted">등록 일시는 브랜드 컨택 일자가 아니에요.</p>
    <label className="confirm"><input type="checkbox" checked={confirmed} disabled={busy||retryOnly} onChange={e=>setConfirmed(e.target.checked)}/> 원본을 확인했고 이 협찬에 후속 가이드만 추가합니다.</label>
    {error&&<p className="error" role="alert">{error}</p>}
    <button className="primary" disabled={!confirmed||busy||disabled} onClick={()=>void save()}>{busy?'추가 중…':retryOnly?'같은 요청으로 다시 추가 확인':'가이드 추가 저장'}</button>
    <button disabled={busy||retryOnly} onClick={()=>{setPreview(false);setConfirmed(false);setError('');}}>입력으로 돌아가기</button>
   </>}
   <button disabled={busy||retryOnly} onClick={()=>{setOpened(false);setPreview(false);setConfirmed(false);source.images.forEach(i=>URL.revokeObjectURL(i.url));setSource({text:'',images:[]});setError('');}}>추가 취소</button>
  </>}
 </section>;
}
