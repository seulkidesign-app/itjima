import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Source } from "../domain/brief";
import { buildManualPayload, manualProblem, type ManualItem, type ManualForm } from "../domain/manual";
import { saveManual, AbortedSaveError } from "../integrations/save";
import { supabase } from "../integrations/client";
import { SourcePreview } from "./SourcePreview";

type Props = {
  source: Source;
  form: ManualForm;
  onFormChange: Dispatch<SetStateAction<ManualForm>>;
  onSaved: (id: string) => void;
  onBack: () => void;
};
export function ManualRegistration({ source, form, onFormChange: setForm, onSaved, onBack }: Props) {
  const [summary, setSummary] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState("");
  const guard = useRef(false);
  const requestId = useRef(crypto.randomUUID());
  const active = useRef(true);
  const epoch = useRef(0);
  useEffect(() => {
    active.current = true;
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        epoch.current++;
        setError("로그인 후 같은 요청으로 다시 시도해주세요.");
      }
    });
    return () => { active.current = false; subscription?.data.subscription.unsubscribe(); };
  }, []);
  const problem = manualProblem(form);
  function update(key: "title" | "platform" | "notes" | "draftDate" | "publishDate", value: string) {
    setForm(f => ({ ...f, [key]: value }));
    setConfirmed(false);
  }
  async function save() {
    if (guard.current || !confirmed || problem) return;
    if (!supabase) { setError("V03 연결 설정이 필요해요."); return; }
    guard.current = true;
    setBusy(true);
    setError("");
    setAttempted(true);
    const current = epoch.current;
    try {
      const id = await saveManual(supabase, requestId.current, buildManualPayload(form, source, confirmed), source);
      if (active.current && current === epoch.current) onSaved(id);
    } catch (e) {
      // An aborted import cannot be reused. Unknown outcomes keep the same UUID.
      if (e instanceof AbortedSaveError) requestId.current = crypto.randomUUID();
      if (active.current) setError(e instanceof Error ? e.message : "저장에 실패했어요. 같은 요청으로 재시도해주세요.");
    } finally {
      guard.current = false;
      if (active.current) setBusy(false);
    }
  }
  return <>
    <section className="intro">
      <p className="eyebrow">MANUAL REGISTRATION</p>
      <h1>실제 협찬 수동 등록</h1>
      <p>자동 분석 없이 직접 입력해요. 빈 항목은 ‘입력하지 않음’으로 남겨요.</p>
    </section>
    <details open>
      <summary>원본 텍스트·이미지 대조</summary>
      <SourcePreview source={source} />
      {!source.text && !source.images.length && <p>첨부한 원본이 없어요.</p>}
    </details>
    {!summary ? <fieldset disabled={attempted}>
      <section className="panel">
        <label>협찬 이름<input maxLength={120} value={form.title} onChange={e => update("title", e.target.value)} /></label>
        <label>플랫폼 (선택)<input maxLength={120} value={form.platform} onChange={e => update("platform", e.target.value)} /></label>
        <label>메모 (선택)<textarea aria-label="메모 (선택)" maxLength={5000} value={form.notes} onChange={e => update("notes", e.target.value)} /></label>
        <label>가편 전달일 (선택 · 연도 포함)<input type="date" value={form.draftDate} onChange={e => update("draftDate", e.target.value)} /></label>
        <label>업로드 예정일 (선택 · 연도 포함)<input type="date" value={form.publishDate} onChange={e => update("publishDate", e.target.value)} /></label>
      </section>
      <ItemEditor label="할 일" items={form.tasks} onChange={tasks => setForm(f => ({ ...f, tasks }))} />
      <ItemEditor label="제작 조건" items={form.constraints} onChange={constraints => setForm(f => ({ ...f, constraints }))} />
    </fieldset> : <section className="panel" aria-label="저장 전 요약">
      <h2>저장 전 요약</h2>
      <p>출처: 직접 수동 입력 · 자동 추출/후보 확인 결과가 아니에요.</p>
      <dl>{[
        ["협찬 이름", form.title], ["플랫폼", form.platform], ["메모", form.notes],
        ["가편 전달일", form.draftDate], ["업로드 예정일", form.publishDate],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="source-text">{value || "입력하지 않음"}</dd></div>)}</dl>
      {(["tasks", "constraints"] as const).map(key => <div key={key}>
        <h3>{key === "tasks" ? "할 일" : "제작 조건"} {form[key].length}개</h3>
        <ul>{form[key].map(item => <li key={item.id}>{item.value}</li>)}</ul>
      </div>)}
      <p>원본 텍스트 {source.text.length}자 · 이미지 {source.images.length}장</p>
      <label className="manual-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />입력한 내용과 첨부 원본을 확인했으며 이 내용으로 등록합니다.</label>
    </section>}
    {error && <p role="alert">{error}</p>}
    {busy && <p role="status">저장 중이에요. 중복 등록하지 않고 잠시 기다려주세요.</p>}
    <div className="actions">
      {!attempted && <button onClick={() => {
        if (summary) { setSummary(false); setConfirmed(false); } else onBack();
      }}>{summary ? "입력 수정" : "원본 수정"}</button>}
      {!summary
        ? <button className="primary" disabled={Boolean(problem)} onClick={() => setSummary(true)}>저장 전 요약 보기</button>
        : <button className="primary" disabled={!confirmed || busy} onClick={() => void save()}>{attempted ? "같은 요청으로 다시 저장" : "확인하고 실제 등록"}</button>}
    </div>
    {!summary && problem && <p className="small">{problem}</p>}
    <p className="small muted">저장 전 입력은 메모리에만 있어요. 새로고침하면 사라져요.</p>
  </>;
}
function ItemEditor({ label, items, onChange }: { label: string; items: ManualItem[]; onChange: (items: ManualItem[]) => void }) {
  return <section className="panel">
    <h2>{label}</h2>
    {items.map((item, index) => <div key={item.id}>
      <label>{label} {index + 1}<textarea aria-label={`${label} ${index + 1}`} maxLength={2000} value={item.value}
        onChange={e => onChange(items.map(i => i.id === item.id ? { ...i, value: e.target.value } : i))} /></label>
      <button onClick={() => onChange(items.filter(i => i.id !== item.id))}>{label} {index + 1} 삭제</button>
    </div>)}
    <button disabled={items.length >= 30} onClick={() => onChange([...items, { id: crypto.randomUUID(), value: "" }])}>{label} 추가</button>
  </section>;
}
