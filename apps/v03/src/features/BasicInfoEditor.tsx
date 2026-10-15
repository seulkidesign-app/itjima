import {useState} from 'react';
import type {Collaboration} from '../integrations/collaboration';
import {basicProblem,type BasicOperation} from '../integrations/basic';
export function BasicInfoEditor({detail,disabled,onSave}:{detail:Collaboration;disabled:boolean;onSave:(op:Omit<BasicOperation,'requestId'>)=>void}){
 const [editing,setEditing]=useState(false),[title,setTitle]=useState(detail.title),[notes,setNotes]=useState(detail.notes??'');
 const initialTarget=detail.v03_contents.length===1?detail.v03_contents[0].id:'';
 const [contentId,setContentId]=useState(initialTarget);
 const content=detail.v03_contents.find(c=>c.id===contentId);
 const [platform,setPlatform]=useState(content?.platform??'');
 const entry=detail.v03_sources.flatMap(s=>s.v03_reviews).find(r=>r.candidate.candidate_id==='manual_registration'&&r.candidate.origin==='manual')?.candidate.entry;
 const problem=basicProblem(title,notes,platform);
 const changed=title.trim()!==detail.title||(notes.trim()||null)!==detail.notes||(content&&(platform.trim()||null)!==content.platform);
 function cancel(){setTitle(detail.title);setNotes(detail.notes??'');setContentId(initialTarget);setPlatform(detail.v03_contents.find(c=>c.id===initialTarget)?.platform??'');setEditing(false);}
 return <section className="panel" aria-labelledby="basic-info-title">
  <h2 id="basic-info-title">현재 운영 정보</h2>
  <p className="small muted">현재 이름·메모와 선택한 콘텐츠의 플랫폼만 수정해요. 최초 원본·입력·검토 기록은 보존해요.</p>
  {!editing?<><dl><div><dt>현재 협찬 이름</dt><dd>{detail.title}</dd></div><div><dt>현재 메모</dt><dd className="source-text">{detail.notes||'입력하지 않음'}</dd></div></dl><ul aria-label="현재 콘텐츠 플랫폼">{detail.v03_contents.map((c,index)=><li key={c.id}>{index+1}. {c.title} · 플랫폼: {c.platform||"입력하지 않음"}</li>)}</ul><button disabled={disabled} onClick={()=>setEditing(true)}>기본 정보 수정</button></>:<fieldset disabled={disabled}>
   <label htmlFor="basic-title">협찬 이름 수정 (필수)</label><input id="basic-title" maxLength={120} value={title} onChange={e=>setTitle(e.target.value)}/>
   <label htmlFor="basic-notes">메모 수정 (선택)</label><textarea id="basic-notes" maxLength={5000} value={notes} onChange={e=>setNotes(e.target.value)}/>
   <label htmlFor="basic-content">플랫폼 수정 대상 콘텐츠</label><select id="basic-content" value={contentId} onChange={e=>{setContentId(e.target.value);setPlatform(detail.v03_contents.find(c=>c.id===e.target.value)?.platform??'');}}>
    <option value="">플랫폼 수정 안 함 · 이름/메모만</option>
    {detail.v03_contents.map((c,index)=><option key={c.id} value={c.id}>{index+1}. {c.title} · 현재 플랫폼: {c.platform||"입력하지 않음"}</option>)}
   </select>
   {content&&<><p className="small muted">대상 콘텐츠: {detail.v03_contents.findIndex(c=>c.id===content.id)+1}. {content.title}. 다른 콘텐츠에는 적용하지 않아요.</p><label htmlFor="basic-platform">선택 콘텐츠 플랫폼 수정 (선택)</label><input id="basic-platform" maxLength={120} value={platform} onChange={e=>setPlatform(e.target.value)}/></>}
   <p className="small muted">빈 플랫폼·메모는 ‘입력하지 않음’으로 저장해요.</p>
   {problem&&<p className="small error">{problem}</p>}
   <div className="actions"><button disabled={!changed||Boolean(problem)} onClick={()=>onSave({id:detail.id,contentId:content?.id??null,title:title.trim(),notes:notes.trim()||null,platform:content?platform.trim()||null:null,revision:detail.revision,contentRevision:content?(content.revision??-1):null})}>기본 정보 저장</button><button onClick={cancel}>수정 취소</button></div>
  </fieldset>}
  <details><summary>최초 수동 입력 보기 · 현재 운영 정보와 별도</summary>{entry?<dl>
   <div><dt>최초 협찬 이름</dt><dd>{entry.collaboration?.title??'최초 기록 없음'}</dd></div>
   <div><dt>최초 메모</dt><dd className="source-text">{entry.collaboration?.notes||'입력하지 않음'}</dd></div>
   <div><dt>등록 당시 기본 제작물 플랫폼</dt><dd>{entry.content?.platform||'입력하지 않음'}</dd></div>
  </dl>:<p>수동 등록 snapshot이 없는 기록이에요. 원본·최초 검토는 아래 가이드에서 보존해요.</p>}
  {detail.v03_contents.length>1&&<p className="small muted">등록 당시 플랫폼은 이후 추가된 다른 콘텐츠의 최초 값으로 해석하지 않아요.</p>}</details>
 </section>;
}
