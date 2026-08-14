import { Link } from "@tanstack/react-router";
import { ArrowRight, BellRing, CalendarDays, Check, CircleHelp, MessageCircleMore } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { LanguageToggle, useLang, useT } from "@/lib/i18n";
import {
  applyLandingSeo,
  injectJsonLd,
  landingStructuredDataGraph,
  removeJsonLd,
} from "@/lib/seo";

type DemoPreset = {
  ko: string;
  en: string;
  titleKo: string;
  titleEn: string;
  metaKo: string;
  metaEn: string;
  reminderKo?: string;
  reminderEn?: string;
};

const DEMOS: DemoPreset[] = [
  {
    ko: "내일 3시 치과. 한 시간 전에 알려줘.",
    en: "Dentist tomorrow at 3. Remind me an hour before.",
    titleKo: "치과",
    titleEn: "Dentist",
    metaKo: "내일 · 오후 3:00",
    metaEn: "Tomorrow · 3:00 PM",
    reminderKo: "오후 2:00에 알림",
    reminderEn: "Reminder at 2:00 PM",
  },
  {
    ko: "이번 주말에 엄마한테 전화",
    en: "Call mom this weekend",
    titleKo: "엄마한테 전화",
    titleEn: "Call mom",
    metaKo: "이번 주말",
    metaEn: "This weekend",
    reminderKo: "날짜만 확인하면 돼요",
    reminderEn: "Just needs a date check",
  },
  {
    ko: "여권 갱신하기",
    en: "Renew my passport",
    titleKo: "여권 갱신하기",
    titleEn: "Renew my passport",
    metaKo: "날짜 없는 할 일",
    metaEn: "Undated task",
  },
];

export function UsLaunchLanding() {
  const t = useT();
  const { lang } = useLang();
  const [demoIndex, setDemoIndex] = useState(0);
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const activeDemo = DEMOS[demoIndex % DEMOS.length];
  const demoInput = lang === "en" ? activeDemo.en : activeDemo.ko;
  const demoTitle = lang === "en" ? activeDemo.titleEn : activeDemo.titleKo;
  const demoMeta = lang === "en" ? activeDemo.metaEn : activeDemo.metaKo;
  const demoReminder = lang === "en" ? activeDemo.reminderEn : activeDemo.reminderKo;

  const faq = useMemo(
    () => [
      {
        q: t("캘린더와 무엇이 다른가요?", "How is this different from a calendar?"),
        a: t(
          "캘린더는 날짜와 시간을 먼저 고르게 합니다. 잊지마는 생각나는 문장을 먼저 받고, 확실한 정보는 채우며 애매한 부분만 확인합니다.",
          "Calendars ask you to fill fields first. Itjima starts with the thought itself, fills what is clear, and asks only about what is ambiguous.",
        ),
      },
      {
        q: t("로그인 없이 써볼 수 있나요?", "Can I try it without an account?"),
        a: t(
          "네. 브라우저에서 바로 시작할 수 있습니다. 로그인하면 여러 기기에서 동기화할 수 있습니다.",
          "Yes. You can start in the browser. Sign in when you want cross-device sync.",
        ),
      },
      {
        q: t("애매하게 말해도 되나요?", "What if what I say is ambiguous?"),
        a: t(
          "잊지마는 모르는 정보를 멋대로 확정하지 않습니다. 일정에 꼭 필요한 정보만 확인합니다.",
          "Itjima does not silently invent missing details. It asks only for the information needed to make the commitment usable.",
        ),
      },
    ],
    [t],
  );

  useEffect(() => {
    const isEnglish = lang === "en";
    applyLandingSeo({
      canonicalPath: "/about",
      locale: lang,
      title: isEnglish
        ? "Itjima | Just drop the thought"
        : "잊지마 Itjima | 생각났으면, 그냥 던져",
      description: isEnglish
        ? "Capture schedules, tasks, and reminders in natural language. Itjima turns what you say into something you can actually act on later."
        : "일정과 할 일을 말하듯 남기세요. 잊지마가 날짜와 시간을 이해하고, 애매한 부분만 확인해 실제로 다시 챙길 수 있게 정리합니다.",
    });
    injectJsonLd(
      "ld-launch-landing",
      landingStructuredDataGraph(
        faq.map(({ q, a }) => ({ question: q, answer: a })),
        lang,
      ),
    );
    return () => removeJsonLd("ld-launch-landing");
  }, [faq, lang]);

  useEffect(() => {
    setInput(demoInput);
    setSubmitted(false);
  }, [demoInput]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!submitted) setDemoIndex((index) => (index + 1) % DEMOS.length);
    }, 7000);
    return () => window.clearInterval(id);
  }, [submitted]);

  const submitDemo = (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim()) return;
    setSubmitted(true);
  };

  return (
    <div className="min-h-dvh bg-[#f7f7f2] text-[#11110e] selection:bg-[#f1db32] selection:text-[#11110e]">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-full bg-[#11110e] px-4 py-2 text-sm font-bold text-white focus:translate-y-0"
      >
        {t("본문으로 이동", "Skip to content")}
      </a>

      <header className="sticky top-0 z-50 border-b border-black/[0.06] bg-[#f7f7f2]/88 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-[64px] w-[min(1180px,calc(100%-32px))] items-center justify-between gap-4">
          <Link to="/about" className="flex items-center gap-2.5 no-underline">
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#f1db32] text-[11px] font-black tracking-[-.02em]">
              IJ
            </span>
            <span className="text-[16px] font-black tracking-[-.035em]">잊지마 Itjima</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Link
              to="/"
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#11110e] px-4 text-[13px] font-extrabold text-white no-underline transition-transform hover:-translate-y-0.5"
            >
              {t("앱 열기", "Open app")}
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className="overflow-hidden">
        <section className="relative px-4 pb-24 pt-16 sm:pt-24 lg:pb-36 lg:pt-28">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden text-[13px] font-bold text-black/[0.055] sm:text-[16px]">
            <span className="absolute left-[5%] top-[17%] -rotate-6">엄마한테 전화</span>
            <span className="absolute right-[8%] top-[22%] rotate-6">Renew passport</span>
            <span className="absolute bottom-[16%] left-[8%] rotate-3">다음주 PT</span>
            <span className="absolute bottom-[12%] right-[7%] -rotate-4">회의 준비</span>
          </div>

          <div className="relative mx-auto max-w-[1180px]">
            <div className="mx-auto max-w-[980px] text-center">
              <p className="mb-5 text-[12px] font-black uppercase tracking-[.17em] text-black/38">
                {t("생각에서 행동까지 가장 짧은 길", "The shortest path from thought to action")}
              </p>
              <h1 className="text-balance text-[clamp(54px,10vw,108px)] font-black leading-[.9] tracking-[-.075em]">
                {t("생각났으면,", "Had a thought?")}
                <br />
                <span className="relative inline-block">
                  <span className="relative z-10">{t("그냥 던져.", "Just drop it.")}</span>
                  <span className="absolute bottom-[.03em] left-[-.02em] right-[-.03em] h-[.16em] -rotate-1 rounded-full bg-[#f1db32]" aria-hidden />
                </span>
              </h1>
              <p className="mx-auto mt-7 max-w-[650px] text-balance text-[17px] leading-[1.7] text-black/55 sm:text-[20px]">
                {t(
                  "정리부터 하지 마세요. 일정도, 할 일도 말하듯 남기면 잊지마가 필요한 정보만 정리합니다.",
                  "Don't organize first. Drop schedules and tasks the way you'd say them, and Itjima pulls out only what matters.",
                )}
              </p>
            </div>

            <div className="mx-auto mt-12 max-w-[840px] sm:mt-16">
              <div className="rounded-[34px] border border-black/[0.08] bg-white p-3 shadow-[0_32px_100px_-38px_rgba(17,17,14,.3)] sm:p-4">
                <form onSubmit={submitDemo} className="rounded-[26px] bg-[#f7f7f2] p-4 sm:p-5">
                  <label htmlFor="landing-demo" className="sr-only">
                    {t("기억 남기기", "Leave a memory")}
                  </label>
                  <div className="flex items-end gap-3">
                    <textarea
                      id="landing-demo"
                      value={input}
                      onChange={(event) => {
                        setInput(event.target.value);
                        setSubmitted(false);
                      }}
                      rows={2}
                      className="min-h-[76px] flex-1 resize-none bg-transparent text-[19px] font-bold leading-[1.55] tracking-[-.025em] outline-none placeholder:text-black/25 sm:text-[22px]"
                      placeholder={t("무엇이든 남겨보세요…", "Drop anything here…")}
                    />
                    <button
                      type="submit"
                      aria-label={t("기억하기", "Remember this")}
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#11110e] text-white transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
                    >
                      <ArrowRight size={20} aria-hidden />
                    </button>
                  </div>
                </form>

                <div
                  className={`grid transition-all duration-500 ${
                    submitted ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                  aria-live="polite"
                >
                  <div className="overflow-hidden">
                    <div className="mx-1 mb-1 mt-3 rounded-[24px] border border-black/[0.07] bg-[#fffdf5] p-5 sm:p-6">
                      <div className="flex items-center gap-2 text-[12px] font-extrabold text-black/42">
                        <Check size={15} className="text-[#2f7b4a]" aria-hidden />
                        {t("기억했어요", "Got it")}
                      </div>
                      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <h2 className="text-[25px] font-black tracking-[-.045em] sm:text-[30px]">
                            {input.trim() === demoInput ? demoTitle : t("방금 남긴 내용", "Your new thought")}
                          </h2>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-[14px] font-semibold text-black/53">
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarDays size={15} aria-hidden />
                              {input.trim() === demoInput
                                ? demoMeta
                                : t("잊지마에서 내용을 확인합니다", "Itjima checks the details")}
                            </span>
                            {input.trim() === demoInput && demoReminder ? (
                              <span className="inline-flex items-center gap-1.5">
                                <BellRing size={15} aria-hidden />
                                {demoReminder}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <Link
                          to="/"
                          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#f1db32] px-5 text-[13px] font-black no-underline transition-transform hover:-translate-y-0.5"
                        >
                          {t("잊지마에서 이어가기", "Continue in Itjima")}
                          <ArrowRight size={16} aria-hidden />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {DEMOS.map((demo, index) => (
                  <button
                    key={demo.en}
                    type="button"
                    onClick={() => setDemoIndex(index)}
                    className={`rounded-full border px-3.5 py-2 text-[12px] font-bold transition-colors ${
                      index === demoIndex
                        ? "border-black/15 bg-white text-black/70"
                        : "border-transparent text-black/38 hover:text-black/65"
                    }`}
                  >
                    {lang === "en" ? demo.en : demo.ko}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-black/[0.06] bg-[#11110e] px-4 py-24 text-white sm:py-36">
          <div className="mx-auto max-w-[1180px] text-center">
            <p className="text-[12px] font-black uppercase tracking-[.16em] text-white/35">THE PROBLEM</p>
            <h2 className="mx-auto mt-5 max-w-[920px] text-balance text-[clamp(46px,8vw,86px)] font-black leading-[.96] tracking-[-.065em]">
              {t('"아 맞다."를 줄여드립니다.', 'Fewer “oh, right.” moments.')}
            </h2>
            <p className="mx-auto mt-7 max-w-[650px] text-[17px] leading-[1.75] text-white/52">
              {t(
                "기억력이 부족해서가 아니라, 생각을 일정으로 만드는 과정이 너무 길어서 놓칠 때가 있으니까.",
                "Not because your memory is bad. Because turning a passing thought into something actionable is still too much work.",
              )}
            </p>
          </div>
        </section>

        <section className="px-4 py-24 sm:py-36">
          <div className="mx-auto max-w-[1180px]">
            <div className="grid items-start gap-12 lg:grid-cols-[.82fr_1.18fr] lg:gap-20">
              <div className="lg:sticky lg:top-28">
                <p className="text-[12px] font-black uppercase tracking-[.16em] text-black/38">HOW IT WORKS</p>
                <h2 className="mt-4 text-balance text-[clamp(42px,6vw,68px)] font-black leading-[1] tracking-[-.06em]">
                  {t("생각 → 이해 → 저장.", "Thought → understood → saved.")}
                </h2>
                <p className="mt-6 max-w-[480px] text-[17px] leading-[1.7] text-black/52">
                  {t(
                    "필드를 채우는 대신, 먼저 생각을 남깁니다. 잊지마가 날짜·시간·알림을 이해하고 확인 가능한 형태로 바꿉니다.",
                    "Instead of filling fields first, you drop the thought. Itjima turns dates, times, and reminders into something you can verify.",
                  )}
                </p>
              </div>

              <div className="space-y-5">
                <StoryCard
                  number="01"
                  icon={<MessageCircleMore size={23} aria-hidden />}
                  title={t("말하듯 남기고", "Say it naturally")}
                  body={t(
                    "“다음 주 금요일 오후 6시 치과. 전날에도 알려줘.”",
                    '“Dentist next Friday at 6. Remind me the day before.”',
                  )}
                />
                <StoryCard
                  number="02"
                  icon={<CalendarDays size={23} aria-hidden />}
                  title={t("확인 가능한 일정으로", "See what Itjima understood")}
                  body={t(
                    "치과 · 다음 주 금요일 · 오후 6:00 · 하루 전 알림",
                    "Dentist · Next Friday · 6:00 PM · Reminder one day before",
                  )}
                  highlighted
                />
                <StoryCard
                  number="03"
                  icon={<BellRing size={23} aria-hidden />}
                  title={t("다시 챙길 수 있게", "Ready for the reminder")}
                  body={t(
                    "저장한 뒤에도 일정과 알림 상태를 다시 확인하고 수정할 수 있습니다.",
                    "After saving, the schedule and reminder remain visible and editable.",
                  )}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-black/[0.06] bg-white px-4 py-24 sm:py-36">
          <div className="mx-auto grid max-w-[1180px] gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
            <div>
              <p className="text-[12px] font-black uppercase tracking-[.16em] text-black/38">TRUST</p>
              <h2 className="mt-4 text-[clamp(44px,7vw,74px)] font-black leading-[1] tracking-[-.065em]">
                {t("아는 척하지 않아요.", "It doesn't pretend to know.")}
              </h2>
              <p className="mt-6 max-w-[530px] text-[17px] leading-[1.75] text-black/54">
                {t(
                  "애매하면 시간을 만들어내지 않습니다. 일정에 필요한 정보만 짧게 확인합니다.",
                  "When something is ambiguous, Itjima does not silently invent the answer. It asks for the missing piece.",
                )}
              </p>
            </div>

            <div className="rounded-[30px] border border-black/[0.07] bg-[#f7f7f2] p-4 sm:p-6">
              <div className="ml-auto max-w-[80%] rounded-[20px_20px_6px_20px] bg-[#f1db32] px-4 py-3 text-[15px] font-bold">
                {t("퇴근하고 치과", "Dentist after work")}
              </div>
              <div className="mt-4 max-w-[88%] rounded-[24px] border border-black/[0.07] bg-white p-5">
                <div className="flex items-center gap-2 text-[12px] font-black text-black/42">
                  <CircleHelp size={15} aria-hidden />
                  {t("한 가지만 확인할게요", "One quick check")}
                </div>
                <p className="mt-3 text-[20px] font-black tracking-[-.035em]">
                  {t("퇴근은 몇 시쯤인가요?", "What time do you usually leave work?")}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {[t("오후 6시", "6 PM"), t("오후 7시", "7 PM"), t("직접 입력", "Enter time")].map(
                    (option) => (
                      <span
                        key={option}
                        className="rounded-full border border-black/10 bg-[#f7f7f2] px-4 py-2.5 text-[13px] font-bold"
                      >
                        {option}
                      </span>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#fff6a7] px-4 py-24 sm:py-36">
          <div className="mx-auto max-w-[980px] text-center">
            <p className="text-[12px] font-black uppercase tracking-[.16em] text-black/38">NO DATE REQUIRED</p>
            <h2 className="mt-4 text-balance text-[clamp(44px,8vw,80px)] font-black leading-[.98] tracking-[-.065em]">
              {t("모든 할 일에 날짜가 필요한 건 아니니까.", "Not every task needs a date yet.")}
            </h2>
            <p className="mx-auto mt-6 max-w-[660px] text-[17px] leading-[1.75] text-black/55">
              {t(
                "‘여권 갱신하기’처럼 아직 날짜가 없는 일도 그대로 남겨둘 수 있습니다. 필요할 때 일정으로 구체화하세요.",
                "A task like “renew my passport” can stay undated. Add a date only when you're ready to commit.",
              )}
            </p>
            <div className="mx-auto mt-14 max-w-[620px] rounded-[28px] border border-black/[0.08] bg-white p-6 text-left sm:p-7">
              <span className="text-[12px] font-black text-black/38">TASK</span>
              <p className="mt-7 text-[24px] font-black tracking-[-.04em]">{t("여권 갱신하기", "Renew my passport")}</p>
              <div className="my-5 h-px bg-black/[0.07]" />
              <p className="text-[13px] font-bold text-black/50">{t("날짜 없이 나중 할 일로", "Keep it as an undated task")}</p>
            </div>
          </div>
        </section>

        <section className="px-4 py-28 sm:py-44">
          <div className="mx-auto max-w-[980px] text-center">
            <p className="text-[12px] font-black uppercase tracking-[.16em] text-black/38">ITJIMA</p>
            <h2 className="mt-5 text-balance text-[clamp(50px,9vw,94px)] font-black leading-[.94] tracking-[-.07em]">
              {t("정리는 잊지마가 할게요.", "Let Itjima handle the organizing.")}
              <br />
              <span className="text-black/28">{t("당신은 생각만 남기세요.", "You just drop the thought.")}</span>
            </h2>
          </div>
        </section>

        <section className="bg-[#11110e] px-4 py-28 text-white sm:py-40">
          <div className="mx-auto max-w-[940px] text-center">
            <h2 className="text-balance text-[clamp(58px,11vw,112px)] font-black leading-[.9] tracking-[-.075em]">
              {t("생각났어?", "Thought of something?")}
            </h2>
            <p className="mx-auto mt-7 max-w-[560px] text-[17px] leading-[1.7] text-white/52">
              {t("잊기 전에 하나 남겨보세요.", "Drop it before it disappears.")}
            </p>
            <Link
              to="/"
              className="group mt-9 inline-flex min-h-[58px] items-center justify-center gap-2 rounded-full bg-[#f1db32] px-7 text-[15px] font-black text-[#11110e] no-underline transition-transform hover:-translate-y-1"
            >
              <span className="group-hover:hidden">{t("첫 기억 남기기", "Leave your first memory")}</span>
              <span className="hidden group-hover:inline">{t("잊기 전에.", "Before you forget.")}</span>
              <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/8 bg-[#11110e] px-4 py-8 text-white">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-4 text-[12px] font-semibold text-white/38 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 잊지마 Itjima</span>
          <span>{t("생각은 가볍게. 기억은 오래.", "Think less. Remember better.")}</span>
        </div>
      </footer>
    </div>
  );
}

function StoryCard({
  number,
  icon,
  title,
  body,
  highlighted = false,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  highlighted?: boolean;
}) {
  return (
    <article
      className={`rounded-[28px] border p-6 sm:p-8 ${
        highlighted ? "border-[#d2bc19]/35 bg-[#fff7ad]" : "border-black/[0.07] bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-4 text-black/38">
        <span className="text-[11px] font-black tracking-[.14em]">{number}</span>
        {icon}
      </div>
      <h3 className="mt-10 text-[26px] font-black tracking-[-.045em]">{title}</h3>
      <p className="mt-3 text-[15px] font-semibold leading-[1.65] text-black/50">{body}</p>
    </article>
  );
}
