import { useEffect, useRef, useState } from "react";
import {
  hasSource,
  mockExtract,
  type Source,
  type ImageSource,
  type Draft,
} from "./domain/brief";
import { CollaborationDetail } from "./features/CollaborationDetail";
import { AuthPanel } from "./features/AuthPanel";
import { BriefImport } from "./features/BriefImport";
import { BriefReview } from "./features/BriefReview";
import { SourcePreview } from "./features/SourcePreview";
const routes = ["/", "/brief/new", "/brief/preview", "/brief/review"] as const;
type Route = (typeof routes)[number] | `/collaborations/${string}`;
function readRoute(): Route {
  const route = location.hash.slice(1) || "/";
  return route.startsWith("/collaborations/") || routes.some((known) => known === route) ? (route as Route) : "/";
}
function navigate(route: Route) {
  location.hash = route;
}
export function App() {
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
      (route === "/brief/preview" && !hasSource(source)) ||
      (route === "/brief/review" && !draft)
    )
      navigate("/brief/new");
  }, [route, source, draft]);
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
          <>
            <section className="intro">
              <p className="eyebrow">YOUR NEXT COLLABORATION</p>
              <h1>
                협찬의 다음 단계,
                <br />
                한곳에서.
              </h1>
              <p>
                브리프를 가져와 일정과 제작 조건을
                <br />
                먼저 확인해 보세요.
              </p>
            </section>
            <section className="panel">
              <h2>브리프부터 시작해요</h2>
              <p>텍스트나 스크린샷으로 검토 흐름을 살펴보세요.</p>
              <a className="button primary" href="#/brief/new">
                브리프 가져오기 ＋
              </a>
            </section>
          </>
        ) : (
          <>
            <nav aria-label="브리프 단계">
              <a href="#/">← 홈</a>
              <ol>
                {["입력", "원본 확인", "결과 검토"].map((label, index) => (
                  <li
                    key={label}
                    aria-current={
                      route === routes[index + 1] ? "step" : undefined
                    }
                  >
                    {index + 1} {label}
                  </li>
                ))}
              </ol>
            </nav>
            {route === "/brief/new" && (
              <BriefImport
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
            {route === "/brief/preview" && hasSource(source) && (
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
                  AI 분석 없이 고정된 예시 결과를 보여줘요. 확인 전에는 원본을
                  저장하지 않아요.
                </aside>
                <div className="actions">
                  <button onClick={() => navigate("/brief/new")}>
                    원본 수정
                  </button>
                  <button
                    className="primary"
                    onClick={() => {
                      setDraft(mockExtract(source));
                      navigate("/brief/review");
                    }}
                  >
                    Mock 결과 보기 →
                  </button>
                </div>
              </>
            )}
            {route === "/brief/review" && draft && (
              <BriefReview
                draft={draft}
                onChange={setDraft}
                onSaved={(id) => {
                  navigate(`/collaborations/${id}`);
                  setRoute(readRoute());
                  urls.current.forEach((url) => URL.revokeObjectURL(url));
                  urls.current.clear();
                  setSource({ text: "", images: [] });
                  setDraft(null);
                }}
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
