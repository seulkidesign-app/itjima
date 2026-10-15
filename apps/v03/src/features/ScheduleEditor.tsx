import { useState } from "react";
import { type InformationState } from "../domain/brief";
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
  const [state, setState] = useState<InformationState | "">(current.informationState ?? "");
  const [date, setDate] = useState(current.dueDate ?? "");
  const label = type === "draft_delivery" ? "가편 전달일" : "업로드 예정일";
  const problem = state === "present" && !validScheduleDate(date);
  const unchanged = state === (current.informationState ?? "") && (state !== "present" || date === current.dueDate);
  return <fieldset className="schedule-field" disabled={disabled || current.ambiguous}>
    <legend>{label}</legend>
    {current.edited && <p className="small muted">현재 일정 · 사용자 수정</p>}
    {current.ambiguous && <p role="alert">같은 종류의 일정이 여러 개 있어요. 이 화면에서 임의로 하나를 덮어쓰지 않아요.</p>}
    <label htmlFor={`${contentId}-${type}-state`}>{label} 정보 상태</label>
    <select id={`${contentId}-${type}-state`} value={state} onChange={(event) => setState(event.target.value as InformationState)}>
      <option value="" disabled>정보 상태를 선택해주세요</option>
      <option value="present">날짜 지정</option><option value="not_mentioned">현재 일정 미기재</option><option value="uncertain">현재 일정 불명확</option>
    </select>
    {state === "present" && <><label htmlFor={`${contentId}-${type}-date`}>{label} (연도 포함)</label>
      <input id={`${contentId}-${type}-date`} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      {problem && <p className="small error">연도를 포함한 유효한 날짜를 선택해주세요.</p>}</>}
    {state && state !== "present" && <p className="small muted">현재 기한을 비워요. 기존 할 일과 완료 여부는 보존해요.</p>}
    <button disabled={!state || problem || unchanged} onClick={() => {
      if (state) onSave({ contentId, type, informationState: state, dueDate: state === "present" ? date : null, revision: current.revision, taskRevision: current.taskRevision });
    }}>{label} 저장</button>
    <details><summary>{label} 최초 검토 보기</summary>
      <p className="small">{current.initial?.information_state === "present" ? current.initial.due_date ? dateLabel(current.initial.due_date) : "확정 일정 없음" : informationLabel(current.initial?.information_state)}</p>
    </details>
  </fieldset>;
}
