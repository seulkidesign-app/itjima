import { useEffect, useState } from "react";
import { STATUS_LABELS } from "../domain/brief";
import { configError, supabase } from "../integrations/client";
import { dateLabel, DetailError, scheduleSummary } from "../integrations/collaboration";
import { dueState, isActive, loadHome, localDate, pendingTasks, type HomeCollaboration, type HomeTask } from "../integrations/home";

function TaskList({ tasks, today }: { tasks: HomeTask[]; today: string }) {
  return <ul className="home-tasks">{tasks.map((task) => <li key={task.id}>
    <a className="home-task-link" href={`#/collaborations/${task.collaborationId}`}>
      <span className="small muted">{task.collaborationTitle} · {task.contentTitle}</span>
      <strong>{task.title}</strong>
      <span className={`small ${task.due_date && task.due_date < today ? "overdue" : "muted"}`}>
        {task.due_date && <time dateTime={task.due_date}>{dateLabel(task.due_date)} · </time>}
        {dueState(task.due_date, today)}
      </span>
    </a>
  </li>)}</ul>;
}
function CollaborationCard({ item, today }: { item: HomeCollaboration; today: string }) {
  const remaining = pendingTasks([item]);
  return <li className="home-collaboration">
    <a className="home-card-link" href={`#/collaborations/${item.id}`} aria-label={`${item.title} 상세 보기`}>
      <span className="section-heading"><strong>{item.title}</strong><span className="badge">{STATUS_LABELS[item.status]}</span></span>
      <dl className="home-dates">
        <div><dt>가편 전달일</dt><dd>{scheduleSummary(item, "draft_delivery", "draft_due")}</dd></div>
        <div><dt>업로드일</dt><dd>{scheduleSummary(item, "publish", "publish_due")}</dd></div>
      </dl>
      <span className="small muted">{remaining.length ? `미완료 할 일 ${remaining.length}개` : "남은 할 일 없음"} · 상세 / 원본 가이드 →</span>
    </a>
    {!isActive(item) && remaining.length > 0 && <div className="archived-tasks">
      <p className="small muted">{STATUS_LABELS[item.status]} 상태에 남아 있는 할 일</p>
      <TaskList tasks={remaining} today={today} />
    </div>}
  </li>;
}

type Result = { user: string; items?: HomeCollaboration[]; error?: "signin" | "network" };
export function Home() {
  const [identity, setIdentity] = useState<string | null | undefined>();
  const [authError, setAuthError] = useState(false);
  const [authEpoch, setAuthEpoch] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [today, setToday] = useState(localDate);
  useEffect(() => {
    const update = () => setToday(localDate());
    const timer = window.setInterval(update, 60000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let changed = false;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      changed = true;
      if (!active) return;
      setIdentity(session?.user.id ?? null);
      setAuthError(false);
      if (!session || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setResult(null);
        setAuthEpoch((value) => value + 1);
      }
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active && !changed) { setIdentity(data.session?.user.id ?? null); setAuthError(Boolean(error)); }
    }).catch(() => { if (active) setAuthError(true); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [attempt]);
  useEffect(() => {
    if (!supabase || !identity) return;
    const controller = new AbortController();
    setResult(null);
    const timer = window.setTimeout(() => {
      setResult({ user: identity, error: "network" });
      controller.abort();
    }, 15000);
    void loadHome(supabase, identity, controller.signal).then((items) => {
      window.clearTimeout(timer);
      if (!controller.signal.aborted) setResult({ user: identity, items });
    }).catch((error: unknown) => {
      window.clearTimeout(timer);
      if (!controller.signal.aborted) setResult({ user: identity, error: error instanceof DetailError && error.kind === "signin" ? "signin" : "network" });
    });
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [identity, authEpoch, attempt]);
  const current = result?.user === identity ? result : null;
  let message: string | null = null;
  let retry = false;
  if (!supabase) message = configError ?? "V03 DB 미연결 · 로그인 사용자의 협찬을 연결하면 여기에 보여드려요.";
  else if (authError) { message = "로그인 상태를 확인하지 못했어요."; retry = true; }
  else if (identity === null || current?.error === "signin") message = "위의 V03 계정에서 로그인하면 내 협찬과 할 일을 볼 수 있어요.";
  else if (current?.error) { message = "협찬 목록을 불러오지 못했어요. 연결을 확인하고 다시 시도해주세요."; retry = true; }
  const items = !message && identity ? current?.items : undefined;
  const active = items?.filter(isActive) ?? [];
  const held = items?.filter((item) => item.status === "on_hold") ?? [];
  const completed = items?.filter((item) => item.status === "completed") ?? [];
  const tasks = pendingTasks(active);
  return <>
    <section className="intro home-intro">
      <p className="eyebrow">YOUR COLLABORATIONS</p>
      <h1>협찬의 다음 단계,<br />한곳에서.</h1>
      <a className="button primary" href="#/brief/new">브리프 가져오기 ＋</a>
    </section>
    {message ? <section className="panel" role={retry ? "alert" : "status"}>
      <p>{message}</p>
      {retry && <button onClick={() => { setResult(null); setAttempt((value) => value + 1); }}>다시 시도</button>}
    </section> : !items ? <section className="panel" role="status" aria-busy="true">
      <h2>협찬 불러오는 중</h2><p>내 협찬과 다음 할 일을 확인하고 있어요.</p>
    </section> : items.length === 0 ? <section className="panel">
      <h2>아직 등록된 협찬이 없어요</h2><p>첫 브리프를 가져와 검토하고 저장해보세요.</p>
    </section> : <>
      <nav className="home-shortcuts" aria-label="홈 목록 바로가기">
        {[{ id: "active-title", label: `진행 중 ${active.length}건 ↓` }, { id: "next-tasks-title", label: `할 일 ${tasks.length}개 ↓` }].map((target) =>
          <button key={target.id} onClick={() => { const heading = document.getElementById(target.id); heading?.scrollIntoView(); heading?.focus({ preventScroll: true }); }}>{target.label}</button>,
        )}
      </nav>
      <section className="panel" aria-labelledby="next-tasks-title">
        <div className="section-heading"><h2 id="next-tasks-title" tabIndex={-1}>다음 해야 할 일</h2><span className="badge">{tasks.length}개</span></div>
        <p className="small muted">진행 중 협찬의 미완료 항목이에요. 지난 기한부터 보여드려요. 기한 없는 항목도 아래에 있어요.</p>
        {tasks.length ? <TaskList tasks={tasks} today={today} /> : <p className="home-empty">진행 중 협찬에 남은 할 일이 없어요.</p>}
        <p className="small muted">기한 표시는 이 기기의 날짜 기준이에요. 완료·보류 협찬의 남은 할 일은 아래 별도 목록에 있어요.</p>
      </section>
      <section aria-labelledby="active-title">
        <div className="section-heading"><h2 id="active-title" tabIndex={-1}>진행 중인 협찬</h2><span className="badge">{active.length}건</span></div>
        {active.length ? <ul className="home-cards">{active.map((item) => <CollaborationCard key={item.id} item={item} today={today} />)}</ul>
          : <p className="panel">진행 중인 협찬이 없어요. 완료·보류 목록을 확인해주세요.</p>}
      </section>
      {([{ title: "보류한 협찬", id: "held-title", rows: held }, { title: "완료한 협찬", id: "completed-title", rows: completed }]).map((group) =>
        <section className="home-archive" aria-labelledby={group.id} key={group.id}>
          <div className="section-heading"><h2 id={group.id}>{group.title}</h2><span className="badge">{group.rows.length}건</span></div>
          {group.rows.length ? <ul className="home-cards">{group.rows.map((item) => <CollaborationCard key={item.id} item={item} today={today} />)}</ul>
            : <p className="small muted">해당하는 협찬이 없어요.</p>}
        </section>,
      )}
    </>}
  </>;
}
