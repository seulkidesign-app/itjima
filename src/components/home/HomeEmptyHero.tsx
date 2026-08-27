import { useLang, useT } from "@/lib/i18n";

/** Empty Capture home — Figma 319:2 Screen_01 Quietly Organized. */
export function HomeEmptyHero() {
  const t = useT();
  const { lang } = useLang();

  return (
    <section
      className="itjima-empty-hero flex flex-1 flex-col items-start justify-start px-6 pb-3 pt-10 text-left"
      data-testid="home-empty-hero"
      aria-labelledby="home-empty-title"
    >
      <h1 id="home-empty-title" className="quietly-hero-title">
        {t("남기면 끝.", "Leave it. Done.")}
      </h1>
      <p className="quietly-hero-sub mt-3 max-w-[20rem]">
        {t(
          "생각, 할 일, 일정인지 먼저 정하지 않아도 돼요.",
          "You don’t have to decide if it’s a thought, to-do, or schedule first.",
        )}
      </p>
      {lang === "en" ? null : null}
    </section>
  );
}
