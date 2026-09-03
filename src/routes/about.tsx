import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useLang } from "@/lib/i18n";
import {
  applyLandingSeo,
  injectJsonLd,
  removeJsonLd,
  SITE_URL,
} from "@/lib/seo";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

const ABOUT_JSON_LD_ID = "itjima-about-jsonld";

const COPY = {
  ko: {
    title: "잊지마(Itjima)란? | 자연어 AI 메모·일정 앱",
    description:
      "잊지마(Itjima)는 메모·할 일·일정을 구분하지 않고 자연어 한 문장으로 기록하면 날짜와 행동을 읽어 자동으로 구조화하고 다시 보기 쉽게 정리해주는 AI 메모·일정 앱입니다.",
    eyebrow: "ABOUT ITJIMA",
    heading: "잊지마(Itjima)란?",
    intro:
      "잊지마(Itjima)는 메모·할 일·일정을 구분하지 않고 자연어 한 문장으로 기록하면 날짜와 행동을 읽어 자동으로 구조화하고 다시 보기 쉽게 정리해주는 AI 메모·일정 앱입니다.",
    promise:
      "기록할 때부터 어디에 넣을지 고민하지 않아도 되는 것. 생각나는 대로 남기고, 정리는 잊지마에게 맡기는 것이 잊지마의 출발점입니다.",
    whatTitle: "무엇을 해주나요?",
    whatItems: [
      ["자연어로 기록", "메모인지, 할 일인지, 일정인지 먼저 고르지 않고 평소 말하듯 한 문장으로 남길 수 있습니다."],
      ["날짜와 행동을 이해", "‘내일 3시 회의’, ‘금요일까지 포트폴리오 수정’처럼 문장 속 시간과 해야 할 행동을 읽습니다."],
      ["자동으로 구조화", "기록을 다시 찾고 확인하기 쉽도록 필요한 정보만 정리합니다. 애매한 정보는 임의로 만들지 않고 확인합니다."],
      ["다시 보기 쉽게", "기록을 쌓아두는 데서 끝나지 않고, 필요한 일정·할 일·생각을 다시 확인하기 쉽게 만듭니다."],
    ],
    differenceTitle: "다른 메모 앱과 무엇이 다른가요?",
    differenceBody:
      "잊지마의 목표는 메모를 더 잘 쓰게 만드는 것이 아니라, 메모를 관리하지 않아도 되게 만드는 것입니다. 제목·폴더·카테고리를 먼저 정하는 대신 입력은 가볍게 두고, 구조화와 재확인의 부담을 줄이는 데 집중합니다.",
    nameTitle: "Itjima라는 이름은 무슨 뜻인가요?",
    nameBody:
      "Itjima는 한국어 ‘잊지 마’에서 가져온 이름입니다. 영어로는 ‘Don’t forget’에 가깝지만, 잊지마(Itjima)는 그 이름을 사용하는 AI 메모·일정 앱이자 서비스 브랜드입니다.",
    useTitle: "어디서 사용할 수 있나요?",
    useBody:
      "잊지마는 웹에서 바로 사용할 수 있는 PWA입니다. 모바일과 데스크톱 브라우저에서 사용할 수 있고, 지원되는 환경에서는 홈 화면에 추가해 앱처럼 사용할 수 있습니다.",
    cta: "잊지마 시작하기",
    home: "홈으로",
    lang: "EN",
  },
  en: {
    title: "What is Itjima? | AI notes, tasks, and schedules",
    description:
      "Itjima is an AI note and scheduling app that reads dates and actions from one natural sentence, structures what you wrote, and keeps it easy to revisit.",
    eyebrow: "ABOUT ITJIMA",
    heading: "What is Itjima?",
    intro:
      "Itjima is an AI note and scheduling app that lets you capture notes, tasks, and schedules in one natural sentence, then reads dates and actions, structures what you wrote, and keeps it easy to revisit.",
    promise:
      "You should not have to decide where a thought belongs before you capture it. Write it naturally, and let Itjima handle the structure.",
    whatTitle: "What does Itjima do?",
    whatItems: [
      ["Capture naturally", "Write a note, task, or schedule the way you would normally say it, without choosing a category first."],
      ["Understand dates and actions", "Itjima reads expressions such as ‘meeting tomorrow at 3’ or ‘revise the portfolio by Friday’."],
      ["Structure automatically", "It organizes the information needed to find and review a record later. When timing is ambiguous, it asks instead of inventing a time."],
      ["Make records easy to revisit", "Itjima is designed not just to store what you wrote, but to make schedules, tasks, and thoughts easier to find again."],
    ],
    differenceTitle: "How is it different from a traditional notes app?",
    differenceBody:
      "Itjima is not trying to make you better at managing notes. It is designed to reduce the amount of note management you have to do. Capture stays lightweight while structure and retrieval happen around the record.",
    nameTitle: "What does the name ‘Itjima’ mean?",
    nameBody:
      "Itjima comes from the Korean phrase ‘잊지 마’, meaning ‘Don’t forget.’ Itjima is also the name of this AI note and scheduling app and service brand.",
    useTitle: "Where can I use it?",
    useBody:
      "Itjima is a web-based PWA. You can use it in mobile and desktop browsers and, on supported devices, add it to your home screen for an app-like experience.",
    cta: "Start using Itjima",
    home: "Home",
    lang: "한국어",
  },
} as const;

function AboutPage() {
  const { lang, toggle } = useLang();
  const copy = COPY[lang];

  useEffect(() => {
    applyLandingSeo({
      canonicalPath: "/about",
      title: copy.title,
      description: copy.description,
      ogTitle: copy.title,
      ogDescription: copy.description,
      locale: lang,
    });

    injectJsonLd(ABOUT_JSON_LD_ID, {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      "@id": `${SITE_URL}/about#webpage`,
      url: `${SITE_URL}/about`,
      name: copy.heading,
      description: copy.description,
      inLanguage: lang === "en" ? "en-US" : "ko-KR",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: [
        { "@id": `${SITE_URL}/#brand` },
        { "@id": `${SITE_URL}/#software` },
      ],
      mainEntity: { "@id": `${SITE_URL}/#software` },
    });

    return () => removeJsonLd(ABOUT_JSON_LD_ID);
  }, [copy, lang]);

  return (
    <main className="min-h-screen bg-[#fffdf4] text-[#161616]">
      <div className="mx-auto max-w-5xl px-5 pb-20 pt-6 sm:px-8 sm:pb-28 sm:pt-8">
        <header className="flex items-center justify-between border-b border-black/10 pb-5">
          <a
            href="/"
            className="text-xl font-black tracking-[-0.04em] text-[#161616] no-underline"
            aria-label={copy.home}
          >
            itjima
          </a>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggle}
              className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-semibold transition hover:border-black/35"
            >
              {copy.lang}
            </button>
            <a
              href="/app"
              className="rounded-full bg-[#161616] px-4 py-2 text-sm font-bold text-white no-underline transition hover:opacity-80"
            >
              {copy.cta}
            </a>
          </div>
        </header>

        <article className="mx-auto max-w-3xl pt-16 sm:pt-24">
          <p className="mb-5 text-xs font-bold tracking-[0.18em] text-black/45">
            {copy.eyebrow}
          </p>
          <h1 className="max-w-3xl text-4xl font-black leading-[1.08] tracking-[-0.055em] sm:text-6xl">
            {copy.heading}
          </h1>
          <p className="mt-8 text-xl font-semibold leading-[1.65] tracking-[-0.025em] sm:text-2xl">
            {copy.intro}
          </p>
          <p className="mt-5 text-base leading-8 text-black/65 sm:text-lg">
            {copy.promise}
          </p>

          <section className="mt-20 sm:mt-24">
            <h2 className="text-2xl font-black tracking-[-0.04em] sm:text-3xl">
              {copy.whatTitle}
            </h2>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {copy.whatItems.map(([title, body], index) => (
                <div
                  key={title}
                  className="rounded-[24px] border border-black/10 bg-white p-6 sm:p-7"
                >
                  <div className="mb-8 flex h-9 w-9 items-center justify-center rounded-full bg-[#fff76a] text-sm font-black">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <h3 className="text-lg font-black tracking-[-0.025em]">{title}</h3>
                  <p className="mt-3 text-[15px] leading-7 text-black/62">{body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-20 border-t border-black/10 pt-10 sm:mt-24 sm:pt-12">
            <h2 className="text-2xl font-black tracking-[-0.04em] sm:text-3xl">
              {copy.differenceTitle}
            </h2>
            <p className="mt-5 text-base leading-8 text-black/68 sm:text-lg">
              {copy.differenceBody}
            </p>
          </section>

          <section className="mt-16 border-t border-black/10 pt-10 sm:mt-20 sm:pt-12">
            <h2 className="text-2xl font-black tracking-[-0.04em] sm:text-3xl">
              {copy.nameTitle}
            </h2>
            <p className="mt-5 text-base leading-8 text-black/68 sm:text-lg">
              {copy.nameBody}
            </p>
          </section>

          <section className="mt-16 border-t border-black/10 pt-10 sm:mt-20 sm:pt-12">
            <h2 className="text-2xl font-black tracking-[-0.04em] sm:text-3xl">
              {copy.useTitle}
            </h2>
            <p className="mt-5 text-base leading-8 text-black/68 sm:text-lg">
              {copy.useBody}
            </p>
          </section>

          <div className="mt-20 rounded-[28px] bg-[#fff76a] p-7 sm:mt-24 sm:flex sm:items-center sm:justify-between sm:p-9">
            <p className="max-w-lg text-xl font-black leading-snug tracking-[-0.035em] sm:text-2xl">
              {lang === "en"
                ? "Write it down. Let Itjima handle the remembering."
                : "적어. 잊는 건 잊지마에게 맡겨."}
            </p>
            <a
              href="/app"
              className="mt-6 inline-flex rounded-full bg-[#161616] px-5 py-3 text-sm font-bold text-white no-underline sm:mt-0"
            >
              {copy.cta} →
            </a>
          </div>
        </article>
      </div>
    </main>
  );
}
