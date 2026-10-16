import { useState } from "react";
import { dateLabel, informationLabel, type Collaboration } from "../integrations/collaboration";
import { currentSchedule, validScheduleDate, type ScheduleOperation } from "../integrations/schedule";
export function ScheduleEditor({ detail, disabled, onSave }: {
  detail: Collaboration; disabled: boolean; onSave: (operation: Omit<ScheduleOperation, "requestId">) => void;
}) {
  const reviews = detail.v03_sources.flatMap((source) => source.v03_reviews);
  return <section className="panel" aria-labelledby="schedule-editor-title">
    <h2 id="schedule-editor-title">일정 수정</h2>
    <p className="small muted">원본과 최초 검토는 보존해요. 현재 일정만 바꾸며 협찬 상태·할 일 완료 여부는 바꾸지 않아요.</p>
    {detail.v03_contents.map((content) => <section key={content.id} className="schedule-content">
      <h3>{content.title}</h3>
      {(["draft_delivery", "publish"] as const).map((type) => {
        const value = currentSchedule(content, reviews, type);
        return <ScheduleField key={`${content.id}:${type}:${value.revision}:${value.taskRevision}`} contentId={content.id} type={type} current={value} disabled={disabled} onSave={onSave} />;
      })}
    </section>)}
    {detail.v03_contents.length === 0 && <p>수정할 제작물이 없어요.</p>}
  </section>;
}
function ScheduleField({ contentId, type, current, disabled, onSave }: {
  contentId: string; type: ScheduleOperation["type"]; current: ReturnType<typeof currentSchedule>;
  disabled: boolean; onSave: (operation: Omit<ScheduleOperation, "requestId">) => void;
}) {
  const [state, setState] = useState<ScheduleOperation["informationState"] | "not_entered" | "">(current.informationState ?? "");
  const [removing, setRemoving] = useState(false);
  const [date, setDate] = useState(current.dueDate ?? "");
  const label = type === "draft_delivery" ? "가편 전달일" : "업로드 예정일";
  const problem = state === "present" && !validScheduleDate(date);
  const canRemove = Boolean(current.dueDate) && !current.ambiguous;
  const unchanged = state === (current.informationState ?? "") && (state !== "present" || date === current.dueDate);
  return <fieldset className="schedule-field" disabled={disabled || current.ambiguous}>
    <legend>{label}</legend>
    {current.edited && <p className="small muted">현재 일정 · 사용자 수정</p>}
    {current.ambiguous && <p role="alert">같은 종류의 일정이 여러 개 있어요. 이 화면에서 임의로 하나를 덮어쓰지 않아요.</p>}
    <label htmlFor={`${contentId}-${type}-state`}>{label} 정보 상태</label>
    <select id={`${contentId}-${type}-state`} value={state} onChange={(event) => setState(event.target.value as ScheduleOperation["informationState"])}>
      <option value="" disabled>정보 상태를 선택해주세요</option>
      <option value="present">날짜 지정 / 복원</option>
      <option value="not_mentioned" disabled>{current.edited ? "현재 일정 미기재 · 기존 의미 유지" : "원문에 미기재"}</option>
      <option value="uncertain" disabled>{current.edited ? "현재 일정 불명확 · 기존 의미 유지" : "불명확 / 판독 불가"}</option>
      {state === "not_entered" && <option value="not_entered" disabled>수동 등록 시 입력하지 않음</option>}
      {state === "removed" && <option value="removed" disabled>사용자가 날짜 제거함</option>}
    </select>
    {state === "present" && <><label htmlFor={`${contentId}-${type}-date`}>{label} (연도 포함)</label>
      <input id={`${contentId}-${type}-date`} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      {problem && <p className="small error">연도를 포함한 유효한 날짜를 선택해주세요.</p>}</>}
    {state === "removed" && <p className="small muted">사용자가 기존 날짜를 명시적으로 제거했어요. 같은 할 일의 완료 여부는 보존했어요. 날짜 지정 / 복원으로 다시 입력할 수 있어요.</p>}
    {state === "not_entered" && <p className="small muted">수동 등록할 때 입력하지 않은 날짜예요. 원문에 없다고 판단한 것이 아니에요.</p>}
    {canRemove && !removing && <button onClick={()=>setRemoving(true)}>{label} 제거</button>}
    {canRemove && removing && <aside className="notice"><p>기존 날짜만 제거해요. 원본·최초 기록·할 일 ID와 완료 여부는 보존해요.</p><button onClick={()=>onSave({contentId,type,informationState:"removed",dueDate:null,revision:current.revision,taskRevision:current.taskRevision})}>{label} 제거 확인</button><button onClick={()=>setRemoving(false)}>제거 취소</button></aside>}
    <button disabled={!state || state === "not_entered" || state === "removed" || removing || problem || unchanged} onClick={() => {
      if (state && state !== "not_entered" && state !== "removed") onSave({ contentId, type, informationState: state, dueDate: state === "present" ? date : null, revision: current.revision, taskRevision: current.taskRevision });
    }}>{label} 저장</button>
    <details><summary>{label} {current.initial?.origin === "manual" ? "최초 수동 입력 보기" : "최초 검토 보기"}</summary>
      <p className="small">{current.initial?.input_state === "not_entered" ? "수동 등록 시 입력하지 않음" : current.initial?.information_state === "present" ? current.initial.due_date ? dateLabel(current.initial.due_date) : "확정 일정 없음" : informationLabel(current.initial?.information_state)}</p>
    </details>
  </fieldset>;
}
