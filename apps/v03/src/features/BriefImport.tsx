import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  hasSource,
  imageError,
  SAMPLE,
  type Source,
  type ImageSource,
} from "../domain/brief";
export function BriefImport({
  source,
  onText,
  onImages,
  onRemove,
  onPreview,
}: {
  source: Source;
  onText: (text: string) => void;
  onImages: (images: ImageSource[]) => void;
  onRemove: (id: string) => void;
  onPreview: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const active = useRef(true),
    guard = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function selectImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length || guard.current) return;
    setError("");
    if (files.length + source.images.length > 4) {
      setError("이미지는 최대 4장까지 선택할 수 있어요.");
      return;
    }
    guard.current = true;
    setBusy(true);
    const additions: ImageSource[] = [];
    try {
      for (const file of files) {
        const problem = imageError(file);
        if (problem) throw new Error(problem);
        const url = URL.createObjectURL(file);
        const decoded = await new Promise<boolean>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = url;
        });
        if (!decoded) {
          URL.revokeObjectURL(url);
          throw new Error("이미지를 열 수 없어요. 다른 파일을 선택해주세요.");
        }
        additions.push({
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          size: file.size,
          file,
          url,
        });
      }
      if (active.current) onImages(additions);
      else additions.forEach((image) => URL.revokeObjectURL(image.url));
    } catch (problem) {
      additions.forEach((image) => URL.revokeObjectURL(image.url));
      if (active.current)
        setError(
          problem instanceof Error
            ? problem.message
            : "이미지 선택에 실패했어요.",
        );
    } finally {
      guard.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <>
      <section className="intro">
        <p className="eyebrow">BRIEF IMPORT</p>
        <h1>
          브리프를 그대로
          <br />
          가져오세요.
        </h1>
        <p>
          일정과 할 일, 지켜야 할 제작 조건을
          <br />
          한곳에서 확인하는 첫 단계예요.
        </p>
      </section>
      <section className="panel">
        <div className="section-heading">
          <label htmlFor="brief-text">브리프 텍스트</label>
          <button className="text-button" onClick={() => onText(SAMPLE)}>
            예시 넣기
          </button>
        </div>
        <textarea
          id="brief-text"
          rows={8}
          maxLength={20000}
          value={source.text}
          onChange={(e) => onText(e.target.value)}
          placeholder="DM, 이메일, 가이드의 원문을 붙여넣어 주세요."
        />
      </section>
      <section className="panel">
        <h2>스크린샷</h2>
        <p className="muted">JPG, PNG, WebP · 최대 4장 · 각 10MB</p>
        <label className="upload">
          <span aria-hidden="true">＋</span>
          <span>{busy ? "이미지 확인 중…" : "이미지 선택"}</span>
          <input
            type="file"
            aria-label="이미지 선택"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={busy}
            onChange={(event) => void selectImages(event)}
          />
        </label>
        {source.images.map((image, index) => (
          <div className="selected-image" key={image.id}>
            <img src={image.url} alt={`선택한 스크린샷 ${index + 1}`} />
            <div>
              <p>{image.name}</p>
              <button
                disabled={busy}
                aria-label={`${image.name} 삭제`}
                onClick={() => onRemove(image.id)}
              >
                삭제
              </button>
            </div>
          </div>
        ))}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </section>
      <p className="small muted">
        입력은 메모리에만 있어요. 새로고침하면 사라지고 확인 전에는 서버로
        전송하지 않아요.
      </p>
      <button
        className="primary"
        disabled={!hasSource(source) || busy}
        onClick={onPreview}
      >
        원본 미리보기 →
      </button>
    </>
  );
}
