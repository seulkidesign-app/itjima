import type { Source } from "../domain/brief";
export function SourcePreview({ source }: { source: Source }) {
  return (
    <section className="panel">
      <h2>원본 브리프</h2>
      {source.text.trim() && <p className="source-text">{source.text}</p>}
      {source.images.map((image, index) => (
        <figure key={image.id}>
          <img
            className="source-image"
            src={image.url}
            alt={`원본 스크린샷 ${index + 1}: ${image.name}`}
          />
          <figcaption>{image.name}</figcaption>
        </figure>
      ))}
    </section>
  );
}
