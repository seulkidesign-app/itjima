import { useEffect, useState } from "react";
import { supabase, configError } from "../integrations/client";
import {
  loadCollaboration, isCollaborationId, DetailError, informationLabel,
  dateLabel, scheduleSummary, type Collaboration, type SavedSource,
} from "../integrations/collaboration";
import { ScheduleEditor } from "./ScheduleEditor";
import { useScheduleMutation } from "../hooks/useScheduleMutation";
import { useProgressMutation } from "../hooks/useProgressMutation";
import { StatusEditor, ProgressNotice } from "./ProgressControls";
import { STATUS_LABELS } from "../domain/brief";

const constraintLabels: Record<string, string> = {
  thumbnail: "금지 조건", platform: "업로드 플랫폼", retention: "공개 유지", usage_rights: "Usage rights",
};
function GuideImage({ image }: { image: SavedSource["images"][number] }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ url?: string; loading?: boolean; failed?: boolean }>({});
  useEffect(() => {
    if (!attempt || !supabase) return;
    let active = true;
    let objectUrl: string | undefined;
    setState({ loading: true });
    void supabase.storage.from("v03-sources").download(image.path).then(({ data, error }) => {
      if (!active) return;
      if (error || !data || !["image/png", "image/jpeg", "image/webp"].includes(data.type)) {
        setState({ failed: true });
        return;
      }
      objectUrl = URL.createObjectURL(data);
      setState({ url: objectUrl });
    }).catch(() => { if (active) setState({ failed: true }); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [attempt, image.path]);
  return (
    <figure className="guide-image">
      <figcaption>{image.name}</figcaption>
      {state.url ? <>
        <img className="source-image" src={state.url} alt={`원본 가이드: ${image.name}`}
          onError={() => setState({ failed: true })} />
        <a className="button" href={state.url} download={image.name}>원본 이미지 다운로드</a>
      </> : <button disabled={state.loading} onClick={() => setAttempt((value) => value + 1)}>
        {state.loading ? "원본 이미지 불러오는 중…" : state.failed ? "원본 이미지 다시 불러오기" : "원본 이미지 보기"}
      </button>}
      {state.failed && <p role="alert">이미지에 접근할 수 없거나 연결이 끊겼어요. 다시 시도해주세요.</p>}
    </figure>
  );
}

type Result = { id: string; user: string; detail?: Collaboration; error?: string };
export function CollaborationDetail({ id }: { id: string }) {
  const [identity, setIdentity] = useState<string | null | undefined>(undefined);
  const [authEpoch, setAuthEpoch] = useState(0);
  const [authError, setAuthError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let changed = false;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      changed = true;
      if (active) {
        setIdentity(session?.user.id ?? null); setAuthError(false);
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") setAuthEpoch((value) => value + 1);
      }
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active && !changed) { setIdentity(data.session?.user.id ?? null); setAuthError(Boolean(error)); }
    }).catch(() => { if (active) setAuthError(true); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [attempt]);
  useEffect(() => {
    if (!supabase || !identity || !isCollaborationId(id)) return;
    const controller = new AbortController();
    setResult(null);
    const timeout = window.setTimeout(() => {
      setResult({ id, user: identity, error: "network" });
      controller.abort();
    }, 15000);
    void loadCollaboration(supabase, id, identity, controller.signal)
      .then((detail) => {
        window.clearTimeout(timeout);
        if (!controller.signal.aborted) setResult({ id, user: identity, ...(detail ? { detail } : { error: "unavailable" }) });
      })
      .catch((error: unknown) => {
        window.clearTimeout(timeout);
        if (!controller.signal.aborted) setResult({ id, user: identity, error: error instanceof DetailError ? error.kind : "network" });
      });
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [id, identity, attempt, authEpoch]);
  const progress = useProgressMutation(`${id}:${identity ?? "signed-out"}:${authEpoch}`, () => setAttempt((value) => value + 1));
  const schedule = useScheduleMutation(`${id}:${identity ?? "signed-out"}:${authEpoch}`, () => setAttempt((value) => value + 1));
  const editingBlocked = progress.blocked || schedule.blocked;
  const current = result?.id === id && result.user === identity ? result : null;
  let message: string | null = null;
  let retry = false;
  if (!supabase) message = configError ?? "V03 연결 설정이 필요해요.";
  else if (!isCollaborationId(id)) message = "이 협찬을 열 수 없어요. 주소를 확인해주세요.";
  else if (authError) { message = "로그인 상태를 확인하지 못했어요."; retry = true; }
  else if (identity === null || current?.error === "signin") message = "협찬을 보려면 위의 V03 계정에서 로그인해주세요.";
  else if (current?.error === "unavailable") message = "협찬이 없거나 접근 권한이 없어요.";
  else if (current?.error) { message = "협찬을 불러오지 못했어요. 연결을 확인하고 다시 시도해주세요."; retry = true; }
  const detail = !message && identity ? current?.detail : undefined;
  return (
    <>
      <nav aria-label="협찬 상세 탐색"><a href="#/">← 홈</a><a href="#/brief/new">새 브리프 가져오기</a></nav>
      {identity && !message && <ProgressNotice {...progress} onRetry={progress.retry} onRefresh={progress.refresh} />}
      {identity && !message && <ProgressNotice {...schedule} onRetry={schedule.retry} onRefresh={schedule.refresh} />}
      {message ? <section className="panel detail-state" role="alert">
        <h1>협찬을 확인해주세요</h1><p>{message}</p>
        {retry && <button onClick={() => setAttempt((value) => value + 1)}>다시 시도</button>}
      </section> : !detail ? <section className="panel detail-state" role="status" aria-live="polite" aria-busy="true">
        <h1>협찬 불러오는 중</h1><p>저장한 일정과 제작 조건을 확인하고 있어요.</p>
      </section> : <>
        <section className="intro detail-intro">
          <p className="eyebrow">COLLABORATION</p>
          <span className="badge">{STATUS_LABELS[detail.status] ?? "상태 확인 필요"}</span>
          <p className="small muted">브랜드 / 캠페인</p>
          <h1>{detail.title}</h1>
          <button onClick={() => { const guide = document.getElementById("original-guide"); guide?.scrollIntoView(); guide?.focus({ preventScroll: true }); }}>원본 가이드로 이동 ↓</button>
        </section>
        {detail.v03_sources.some((source) => source.v03_reviews.some((review) => review.candidate.origin === "mock")) &&
          <aside className="notice">사용자가 검토한 mock 예시예요. 원본을 자동 분석한 결과가 아니에요.</aside>}
        <StatusEditor detail={detail} disabled={editingBlocked} onSave={(value) => progress.begin({ kind: "status", id: detail.id, revision: detail.revision, value })} />
        <section className="panel" aria-labelledby="dates-title">
          <h2 id="dates-title">주요 일정</h2>
          <dl className="detail-dates"><div><dt>가편 전달일</dt><dd>{scheduleSummary(detail, "draft_delivery", "draft_due")}</dd></div>
            <div><dt>업로드일</dt><dd>{scheduleSummary(detail, "publish", "publish_due")}</dd></div></dl>
        </section>
        <ScheduleEditor detail={detail} disabled={editingBlocked} onSave={schedule.begin} />
        <section className="panel" aria-labelledby="tasks-title">
          <h2 id="tasks-title">해야 할 일</h2>
          {detail.v03_contents.length === 0 && <p className="muted">등록된 제작물이 없어요.</p>}
          {detail.v03_contents.map((content) => <section key={content.id} className="content-tasks">
            <h3>{content.title}</h3>
            {content.platform && <p className="small muted">{content.platform}</p>}
            {content.v03_tasks.length ? <ul className="detail-list">{content.v03_tasks.map((task) => <li key={task.id}>
              <p>{task.title}</p>
              <button disabled={editingBlocked} onClick={() => progress.begin({ kind: "task", id: task.id, revision: task.revision, value: !task.completed_at })}
                aria-label={`${task.title} ${task.completed_at ? "미완료로 되돌리기" : "완료로 표시"}`}>
                {task.completed_at ? "미완료로 되돌리기" : "완료로 표시"}
              </button><p className="small muted">{task.completed_at ? "완료" : "할 일"}{task.due_date ? ` · ${dateLabel(task.due_date)}` : " · 기한 없음"}</p>
            </li>)}</ul> : <p className="muted">등록된 할 일이 없어요.</p>}
          </section>)}
          {detail.v03_sources.flatMap((source) => source.v03_reviews).filter(({ candidate }) =>
            ["film", "captions", "approval"].includes(candidate.candidate_id) && candidate.information_state !== "present",
          ).map(({ candidate }, index) => <p className="small muted" key={`${candidate.candidate_id}-${index}`}>
            {{ film: "영상 제작", captions: "자막", approval: "컨펌" }[candidate.candidate_id]} · {informationLabel(candidate.information_state)}
          </p>)}
        </section>
        <section className="panel" aria-labelledby="constraints-title">
          <h2 id="constraints-title">제작 제약조건</h2>
          {detail.v03_constraints.length ? <dl className="detail-list">{detail.v03_constraints.map((item) => <div key={item.id}>
            <dt>{constraintLabels[item.type] ?? item.type}</dt>
            <dd>{item.information_state === "present" ? item.value ?? "확인 정보 없음" : informationLabel(item.information_state)}</dd>
          </div>)}</dl> : <p className="muted">확인된 제작 조건이 없어요.</p>}
        </section>
        <section className="panel" id="original-guide" aria-labelledby="guide-title" tabIndex={-1}>
          <h2 id="guide-title">원본 가이드</h2>
          {detail.v03_sources.length ? detail.v03_sources.map((source, index) => <details key={source.id} open={index === 0}>
            <summary>원본 {index + 1} · 텍스트 / 이미지 {source.images.length}장</summary>
            {source.raw_text ? <p className="source-text">{source.raw_text}</p> : <p className="muted">원본 텍스트 없이 이미지로 가져왔어요.</p>}
            {source.images.map((image) => <GuideImage key={image.path} image={image} />)}
          </details>) : <p className="muted">접근 가능한 원본이 없어요.</p>}
        </section>
      </>}
    </>
  );
}
