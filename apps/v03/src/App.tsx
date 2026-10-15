import { useEffect, useRef, useState } from "react";
import {
  hasSource,
  SAMPLE,
  mockExtract,
  type Source,
  type ImageSource,
  type Draft,
} from "./domain/brief";
import {emptyManual} from "./domain/manual";
import { ManualRegistration } from "./features/ManualRegistration";
import { Home } from "./features/Home";
import { CollaborationDetail } from "./features/CollaborationDetail";
import { AuthPanel } from "./features/AuthPanel";
import { BriefImport } from "./features/BriefImport";
import { BriefReview } from "./features/BriefReview";
import { SourcePreview } from "./features/SourcePreview";
const routes = ["/", "/brief/new", "/brief/preview", "/brief/review", "/brief/manual"] as const;
type Route = (typeof routes)[number] | `/collaborations/${string}`;
function readRoute(): Route {
  const route = location.hash.slice(1) || "/";
  return route.startsWith("/collaborations/") || routes.some((known) => known === route) ? (route as Route) : "/";
}
function navigate(route: Route) {
  location.hash = route;
}
export function App() {
  const [manualForm,setManualForm]=useState(emptyManual);
  const [experience,setExperience]=useState<"manual"|"sample">("manual");
  const [route, setRoute] = useState<Route>(readRoute),
    [source, setSource] = useState<Source>({ text: "", images: [] }),
    [draft, setDraft] = useState<Draft | null>(null);
  const urls = useRef(new Set<string>()),
    heading = useRef<HTMLElement>(null);
  useEffect(() => {
    const update = () => setRoute(readRoute());
    window.addEventListener("hashchange", update);
    const owned = urls.current;
    return () => {
      window.removeEventListener("hashchange", update);
      owned.forEach((url) => URL.revokeObjectURL(url));
      owned.clear();
    };
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, [route]);
  useEffect(() => {
    if (
      (route === "/brief/preview" && experience === "sample" && !hasSource(source)) ||
      (route === "/brief/review" && !draft)
    )
      navigate("/brief/new");
  }, [route, source, draft, experience]);
  function addImages(images: ImageSource[]) {
    images.forEach((image) => urls.current.add(image.url));
    setSource((current) => ({
      ...current,
      images: [...current.images, ...images],
    }));
    setDraft(null);
  }
  function removeImage(id: string) {
    const image = source.images.find((image) => image.id === id);
    if (image) {
      URL.revokeObjectURL(image.url);
      urls.current.delete(image.url);
    }
    setSource((current) => ({
      ...current,
      images: current.images.filter((image) => image.id !== id),
    }));
    setDraft(null);
  }
  function changeExperience(mode: "manual" | "sample") {
    if (mode === experience) return;
    urls.current.forEach(url => URL.revokeObjectURL(url));
    urls.current.clear();
    setSource({ text: mode === "sample" ? SAMPLE : "", images: [] });
    setDraft(null);
    setManualForm(emptyManual());
    setExperience(mode);
  }
  function completeManual(id: string) {
    navigate(`/collaborations/${id}`);
    setRoute(readRoute());
    urls.current.forEach(url => URL.revokeObjectURL(url));
    urls.current.clear();
    setSource({ text: "", images: [] });
    setManualForm(emptyManual());
  }
  return (
    <div className="app-shell">
      <header>
        <a className="wordmark" href="#/" aria-label="잊지마 V03 홈">
          itjima<span>.</span>
        </a>
        <span className="small muted">V03 · 협찬 관리</span>
      </header>
      <main ref={heading} tabIndex={-1}>
        <AuthPanel />
        {route.startsWith("/collaborations/") ? (
          <CollaborationDetail key={route} id={route.slice("/collaborations/".length)} />
        ) : route === "/" ? (
          <Home />
        ) : (
          <>
            <nav aria-label="브리프 단계">
              <a href="#/">← 홈</a>
              <ol>
                {["입력", "원본 확인", experience==="manual"?"직접 입력·요약":"샘플 검토"].map((label, index) => (
                  <li
                    key={label}
                    aria-current={
                      route === routes[index + 1] || (index===2 && route==="/brief/manual") ? "step" : undefined
                    }
                  >
                    {index + 1} {label}
                  </li>
                ))}
              </ol>
            </nav>
            {route === "/brief/new" && <section className="panel" aria-label="등록 방식">
              <h2>등록 방식</h2>
              <p>실제 등록은 빈 수동 입력으로 시작해요. 샘플 체험은 저장되지 않아요.</p>
              {(["manual", "sample"] as const).map(mode => <button key={mode}
                aria-pressed={experience === mode} onClick={() => changeExperience(mode)}>
                {mode === "manual" ? "실제 협찬 등록" : "샘플 체험 · 저장 안 됨"}
              </button>)}
            </section>}
            {route === "/brief/new" && (
              <BriefImport sampleMode={experience==="sample"}
                source={source}
                onText={(text) => {
                  setSource((current) => ({ ...current, text }));
                  setDraft(null);
                }}
                onImages={addImages}
                onRemove={removeImage}
                onPreview={() => navigate("/brief/preview")}
              />
            )}{" "}
            {route === "/brief/preview" && (experience==="manual" || hasSource(source)) && (
              <>
                <section className="intro">
                  <p className="eyebrow">ORIGINAL BRIEF</p>
                  <h1>
                    원본부터
                    <br />
                    확인할까요?
                  </h1>
                </section>
                <SourcePreview source={source} />
                <aside className="notice">
                  {experience==="sample"?"샘플 체험이에요. 고정 예시를 보여주며 원격 저장하지 않아요.":"자동 분석하지 않아요. 원본을 보며 빈 항목에 직접 입력해주세요."}
                </aside>
                <div className="actions">
                  <button onClick={() => navigate("/brief/new")}>
                    원본 수정
                  </button>
                  <button
                    className="primary"
                    onClick={() => {
                      if(experience==="sample"){setDraft(mockExtract(source));navigate("/brief/review");}else navigate("/brief/manual");
                    }}
                  >
                    {experience==="sample"?"Mock 결과 보기 →":"직접 입력하기 →"}
                  </button>
                </div>
              </>
            )}
            {route === "/brief/manual" && experience === "manual" && <ManualRegistration
              source={source} form={manualForm} onFormChange={setManualForm}
              onBack={() => navigate("/brief/new")} onSaved={completeManual} />}

            {route === "/brief/review" && draft && (
              <BriefReview
                draft={draft}
                onChange={setDraft}
                onBack={() => {
                  setDraft(null);
                  navigate("/brief/new");
                }}
              />
            )}
          </>
        )}
      </main>
      <footer>잊지마 · 협찬 관리 미리보기</footer>
    </div>
  );
}
