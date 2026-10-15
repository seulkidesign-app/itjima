import { useEffect, useState } from "react";
import { STATUS_LABELS, type Status } from "../domain/brief";
import type { Collaboration } from "../integrations/collaboration";
import type { ProgressError } from "../integrations/progress";
export function StatusEditor({ detail, disabled, onSave }: { detail: Collaboration; disabled: boolean; onSave: (status: Status) => void }) {
  const [value, setValue] = useState(detail.status);
  useEffect(() => setValue(detail.status), [detail.id, detail.status, detail.revision]);
  return <section className="panel" aria-labelledby="status-editor-title">
    <h2 id="status-editor-title">협찬 상태</h2>
    <p className="small muted">단계를 건너뛰거나 이전 상태로 돌아갈 수 있어요. 할 일 완료와는 별개예요.</p>
    <label htmlFor="status-edit">협찬 상태 변경</label>
    <select id="status-edit" value={value} disabled={disabled} onChange={(event) => setValue(event.target.value as Status)}>
      {Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select>
    <button className="primary" disabled={disabled || value === detail.status} onClick={() => onSave(value)}>상태 저장</button>
  </section>;
}
const errors: Record<ProgressError["kind"], string> = {
  conflict: "다른 변경이 먼저 저장됐어요. 최신 내용을 불러온 뒤 변경을 다시 선택해주세요. 덮어쓰지 않았어요.",
  signin: "로그인 상태를 확인해주세요. 위 V03 계정에서 로그아웃 후 다시 로그인해주세요.",
  unavailable: "협찬이나 할 일에 접근할 수 없어요. 최신 내용을 확인해주세요.",
  invalid: "변경 요청을 확인하지 못했어요. 최신 내용을 불러와 다시 선택해주세요.",
  unknown: "저장 결과를 확인하지 못했어요. 같은 요청으로 다시 시도하거나 최신 내용을 확인해주세요.",
};
export function ProgressNotice({ busy, error, saved, onRetry, onRefresh }: {
  busy?: boolean; error?: ProgressError["kind"]; saved?: boolean; onRetry: () => void; onRefresh: () => void;
}) {
  if (busy) return <aside className="notice" role="status">저장 중이에요. 다른 변경은 잠시 기다려주세요.</aside>;
  if (error) return <aside className="notice" role="alert">
    <p>{errors[error]}</p>
    {error === "unknown" && <button onClick={onRetry}>같은 요청 다시 시도</button>}
    <button onClick={onRefresh}>최신 내용 불러오기</button>
  </aside>;
  return saved ? <p role="status" className="notice">변경을 저장했어요. 최신 DB 내용을 확인해요.</p> : null;
}
