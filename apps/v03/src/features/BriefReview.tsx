import { useRef, useState } from "react";
import {
  buildPayload,
  candidateProblem,
  confirmCandidate,
  editCandidate,
  reviewComplete,
  STATES,
  REVIEWS,
  STATUS_LABELS,
  type Status,
  type Draft,
  type Candidate,
  type CreationPayload,
} from "../domain/brief";
import { supabase } from "../integrations/client";
import { AbortedSaveError, saveReviewed } from "../integrations/save";
import { SourcePreview } from "./SourcePreview";
export function BriefReview({
  draft,
  onChange,
  onBack,
}: {
  draft: Draft;
  onChange: (draft: Draft) => void;
  onBack: () => void;
}) {
  const [title, setTitle] = useState(""),
    [status, setStatus] = useState<Status>("discussion"),
    [payload, setPayload] = useState<CreationPayload | null>(null),
    [attempted, setAttempted] = useState(false),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState<string | null>(null),
    [error, setError] = useState("");
  const requestId = useRef(crypto.randomUUID()),
    guard = useRef(false);
  const ready = Boolean(title.trim()) && reviewComplete(draft);
  function edit(c: Candidate, patch: Parameters<typeof editCandidate>[2]) {
    if (attempted) return;
    setPayload(null);
    onChange(editCandidate(draft, c.id, patch));
  }
  async function save() {
    if (guard.current) return;
    const next = buildPayload(draft, title, status);
    setPayload(next);
    if (!supabase) return;
    guard.current = true;
    setAttempted(true);
    setBusy(true);
    setError("");
    try {
      setSaved(
        await saveReviewed(supabase, requestId.current, next, draft.source),
      );
    } catch (problem) {
      if (problem instanceof AbortedSaveError)
        requestId.current = crypto.randomUUID();
      setError(
        problem instanceof Error ? problem.message : "저장에 실패했어요.",
      );
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <section className="intro">
        <p className="eyebrow">REVIEW DRAFT</p>
        <h1>
          원본과 나란히,
          <br />
          하나씩 확인해요.
        </h1>
      </section>
      <aside className="notice">
        <strong>지금은 샘플 결과예요</strong>
        <p>
          입력한 텍스트나 이미지를 분석하지 않았어요. 아래 값은 원본에서 추출한
          사실이 아닌 예시예요.
        </p>
      </aside>
      <section className="panel">
        <label htmlFor="collaboration-title">협찬 이름</label>
        <input
          id="collaboration-title"
          maxLength={120}
          value={title}
          disabled={attempted}
          placeholder="브랜드 / 캠페인 이름"
          onChange={(e) => {
            setPayload(null);
            setTitle(e.target.value);
          }}
        />
        <label htmlFor="collaboration-status">상태</label>
        <select
          id="collaboration-status"
          value={status}
          disabled={attempted}
          onChange={(e) => {
            setPayload(null);
            setStatus(e.target.value as Status);
          }}
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </section>
      <div className="review-layout">
        <div className="comparison">
          <details open>
            <summary>원본 브리프 대조하기</summary>
            <div className="source-scroll">
              <SourcePreview source={draft.source} />
            </div>
          </details>
        </div>
        <fieldset disabled={attempted}>
          {(["schedules", "tasks", "constraints"] as const).map((group) => (
            <section
              className="panel"
              key={group}
              aria-label={
                {
                  schedules: "일정",
                  tasks: "해야 할 일",
                  constraints: "제작 제약조건",
                }[group]
              }
            >
              <h2>
                {
                  {
                    schedules: "일정",
                    tasks: "해야 할 일",
                    constraints: "제작 제약조건",
                  }[group]
                }
              </h2>
              {draft.candidates
                .filter((c) => c.group === group)
                .map((c) => (
                  <article
                    className="candidate"
                    data-testid={`candidate-${c.id}`}
                    key={c.id}
                  >
                    <div className="section-heading">
                      <h3>{c.label}</h3>
                      <span className={`badge ${c.reviewState}`}>
                        {REVIEWS[c.reviewState]}
                      </span>
                    </div>
                    <p className="small muted">초기 샘플: {c.originalValue}</p>
                    <label htmlFor={`state-${c.id}`}>정보 상태</label>
                    <select
                      id={`state-${c.id}`}
                      value={c.informationState}
                      onChange={(e) =>
                        edit(c, {
                          informationState: e.target
                            .value as Candidate["informationState"],
                        })
                      }
                    >
                      {Object.entries(STATES).map(([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {c.informationState === "present" ? (
                      <>
                        <label htmlFor={`value-${c.id}`}>검토할 값</label>
                        <textarea
                          id={`value-${c.id}`}
                          rows={2}
                          maxLength={2000}
                          value={c.value}
                          onChange={(e) => edit(c, { value: e.target.value })}
                        />
                        {group === "schedules" && (
                          <>
                            <label htmlFor={`date-${c.id}`}>
                              확정할 날짜 (연도 포함)
                            </label>
                            <input
                              id={`date-${c.id}`}
                              type="date"
                              value={c.dueDate}
                              onChange={(e) =>
                                edit(c, { dueDate: e.target.value })
                              }
                            />
                            <p className="small muted">
                              연도나 시각을 자동 추정하지 않아요.
                            </p>
                          </>
                        )}
                      </>
                    ) : (
                      <p className="small muted">
                        확정 값과 기한을 만들지 않고 이 상태를 남겨요.
                      </p>
                    )}
                    {candidateProblem(c) && (
                      <p className="small error">{candidateProblem(c)}</p>
                    )}
                    <button
                      disabled={
                        Boolean(candidateProblem(c)) ||
                        c.reviewState !== "unreviewed"
                      }
                      onClick={() => {
                        setPayload(null);
                        onChange(confirmCandidate(draft, c.id));
                      }}
                    >
                      {c.reviewState === "unreviewed"
                        ? "이 후보 확인"
                        : "검토 완료"}
                    </button>
                  </article>
                ))}
            </section>
          ))}
        </fieldset>
      </div>
      <section className="review-footer">
        <p role="status">
          {saved
            ? `V03에 저장했어요. 협찬 ID: ${saved}`
            : payload
              ? "생성 예정 payload를 구성했어요. 실제 저장은 아직 하지 않았어요."
              : "협찬과 할 일은 아직 생성되지 않았어요."}
        </p>
        <p className="small muted">
          필수 후보{" "}
          {
            draft.candidates.filter((c) => c.reviewState !== "unreviewed")
              .length
          }{" "}
          / {draft.candidates.length} 검토 완료
        </p>
        <button disabled={attempted} onClick={onBack}>
          원본 수정하기
        </button>
        <button
          className="primary"
          disabled={
            !ready || busy || Boolean(saved) || (!supabase && Boolean(payload))
          }
          onClick={() => void save()}
        >
          {busy ? "저장 중…" : "확인하고 저장"}
        </button>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <p className="small muted">
          {supabase
            ? "확인한 결과만 V03 전용 DB에 저장해요. 저장 시도 후 같은 요청으로 재시도해요."
            : "DB 미연결 · 메모리에서 payload만 구성해요."}
        </p>
      </section>
      {payload && (
        <section className="panel">
          <h2>생성 예정 payload</h2>
          <pre data-testid="creation-payload">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </section>
      )}
    </>
  );
}
