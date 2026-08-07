import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  Check,
  CircleHelp,
  MapPin,
  MessageCircleMore,
  Sparkles,
} from "lucide-react";
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
    ko: "다음에 다이소 가면 건전지 사기",
    en: "Next time I'm at Daiso, buy batteries",
    titleKo: "건전지 사기",
    titleEn: "Buy batteries",
    metaKo: "다이소에 갈 때",
    metaEn: "When you're at Daiso",
    reminderKo: "장소 기반 기억",
    reminderEn: "Place-based memory",
  },
  {
    ko: "이번 주말에 엄마한테 전화",
    en: "Call mom this weekend",
    titleKo: "엄마한테 전화",
    titleEn: "Call mom",
    metaKo: "이번 주말",
    metaEn: "This weekend",
    reminderKo: "시간은 아직 미정",
    reminderEn: "Time not set yet",
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
          "잊지마는 모르는 정보를 멋대로 확정하지 않습니다. 일정에 꼭 필요한 정보만 한 번 확인합니다.",
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
        ? "Itjima | Drop the thought. We'll remember it."
        : "잊지마 Itjima | 생각났으면, 그냥 던져",
      description: isEnglish
        ? "Drop a thought naturally. Itjima understands schedules, tasks, and memories, then brings them back when they matter."
        : "일정도, 할 일도, 언젠가 필요한 기억도 말하듯 남기세요. 잊지마가 이해하고 필요한 순간에 다시 가져옵니다.",
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
        <section className="px-4 pb-24 pt-16 sm:pt-24 lg:pb-32 lg:pt-28">
          <div className="mx-auto max-w-[1180px]">
            <div className="mx-auto max-w-[980px] text-center">
              <p className="mb-5 text-[12px] font-black uppercase tracking-[.17em] text-black/38">
                {t("기억을 위한 가장 짧은 입력", "The shortest path from thought to memory")}
              </p>
              <h1 className="text-balance text-[clamp(54px,10vw,104px)] font-black leading-[.92] tracking-[-.075em]">
                {t("생각났으면,", "Had a thought?")}
                <br />
                <span className="relative inline-block">
                  <span className="relative z-10">{t("그냥 던져.", "Just drop it.")}</span>
                  <span className="absolute bottom-[.03em] left-[-.02em] right-[-.03em] h-[.16em] -rotate-1 rounded-full bg-[#f1db32]" aria-hidden />
                </span>
              </h1>
              <p className="mx-auto mt-7 max-w-[680px] text-balance text-[17px] leading-[1.7] text-black/55 sm:text-[20px]">
                {t(
                  "일정도, 할 일도, 언젠가 필요한 기억도. 정리하지 말고 말하듯 남기세요. 필요한 순간까지 잊지마가 들고 있을게요.",
                  "Schedules, tasks, or something you'll need someday. Don't organize it. Just say it. Itjima will hold onto it until it matters.",
                )}
              </p>
            </div>

            <div className="mx-auto mt-12 max-w-[840px] sm:mt-16">
              <div className="rounded-[32px] border border-black/[0.08] bg-white p-3 shadow-[0_30px_90px_-35px_rgba(17,17,14,.28)] sm:p-4">
                <form onSubmit={submitDemo} className="rounded-[24px] bg-[#f7f7f2] p-4 sm:p-5">
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
                      className="min-h-[72px] flex-1 resize-none bg-transparent text-[19px] font-bold leading-[1.55] tracking-[-.025em] outline-none placeholder:text-black/25 sm:text-[22px]"
                      placeholder={t("무엇이든 남겨보세요…", "Drop anything here…")}
                    />
                    <button
                      type="submit"
                      aria-label={t("기억하기", "Remember this")}
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#11110e] text-white transition-transform hover:-translate-y-0.5"
                    >
                      <ArrowRight size={20} aria-hidden />
                    </button>
                  </div>
                </form>

                <div className={`grid transition-all duration-500 ${submitted ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                  <div className="overflow-hidden">
                    <div className="mx-1 mb-1 mt-3 rounded-[24px] border border-black/[0.07] bg-[#fffdf5] p-5 sm:p-6">
                      <div className="flex items-center gap-2 text-[12px] font-extrabold text-black/42">
                        <Check size={15} className="text-[#2f7b4a]" aria-hidden />
                        {t("기억했어요", "Got it")}
                      </div>
                      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <h2 className="text-[25px] font-black tracking-[-.045em] sm:text-[30px]">
                            {input.trim() === demoInput ? demoTitle : t("방금 남긴 기억", "Your new memory")}
                          </h2>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-[14px] font-semibold text-black/53">
                            <span className="inline-flex items-center gap-1.5"><CalendarDays size={15} aria-hidden />{input.trim() === demoInput ? demoMeta : t("잊지마가 내용을 확인합니다", "Itjima checks the details")}</span>
                            {input.trim() === demoInput && demoReminder ? <span className="inline-flex items-center gap-1.5"><BellRing size={15} aria-hidden />{demoReminder}</span> : null}
                          </div>
                        </div>
                        <Link
                          to="/"
                          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#f1db32] px-5 text-[13px] font-black no-underline"
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
                    className={`rounded-full border px-3.5 py-2 text-[12px] font-bold transition-colors ${index === demoIndex ? "border-black/15 bg-white text-black/70" : "border-transparent text-black/38 hover:text-black/65"}`}
                  >
                    {lang === "en" ? demo.en : demo.ko}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-black/[0.06] bg-[#11110e] px-4 py-24 text-white sm:py-32">
          <div className="mx-auto max-w-[1180px] text-center">
            <p className="text-[12px] font-black uppercase tracking-[.16em] text-white/35">THE PROBLEM</p>
            <h2 className="mx-auto mt-5 max-w-[920px] text-balance text-[clamp(46px,8vw,84px)] font-black leading-[.98] tracking-[-.065em]">
              {t('"아 맞다."를 줄여드립니다.', 'Fewer “oh, right.” moments.')}
            </h2>
            <div className="mx-auto mt-12 grid max-w-[900px] gap-3 text-left sm:grid-cols-2">
              {[t("나에게 카톡으로 보내둔 할 일", "That task you messaged to yourself"), t("언젠가 가고 싶어서 저장한 장소", "That place you saved for someday"), t("알람 만들기 귀찮아서 기억해둔 약속", "That plan you meant to remember without an alarm"), t("메모장 어딘가에 묻힌 생각", "That thought buried somewhere in Notes")].map((copy) => (
                <div key={copy} className="rounded-[22px] border border-white/10 bg-white/[0.045] px-5 py-4 text-[15px] font-semibold text-white/68">
                  {copy}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-24 sm:py-32">
          <div className="mx-auto max-w-[1180px]">
            <div className="grid items-start gap-12 lg:grid-cols-[.82fr_1.18fr] lg:gap-20">
              <div className="lg:sticky lg:top-28">
                <p className="text-[12px] font-black uppercase tracking-[.16em] text-black/38">HOW IT WORKS</p>
                <h2 className="mt-4 text-balance text-[clamp(42px,6vw,66px)] font-black leading-[1] tracking-[-.06em]">
                  {t("생각 → 기억 → 다시.", "Thought → memory → back to you.")}
                </h2>
                <p className="mt-6 max-w-[480px] text-[17px] leading-[1.7] text-black/52">
                  {t("날짜를 고르고, 시간을 입력하고, 알림 메뉴를 찾는 중간 과정을 줄였습니다.", "We removed the form-filling between having a thought and making it useful.")}
                </p>
              </div>

              <div className="space-y-5">
                <StoryCard number="01" icon={<MessageCircleMore size={23} />} title={t("말하듯 남기고", "Say it naturally")} body={t("“다음 주 금요일 오후 6시 치과. 전날에도 알려줘.”", '“Dentist next Friday at 6. Remind me the day before.”')} />
                <StoryCard number="02" icon={<Sparkles size={23} />} title={t("알아서 이해하고", "It understands the commitment")} body={t("치과 · 다음 주 금요일 · 오후 6:00 · 하루 전 알림", "Dentist · Next Friday · 6:00 PM · Reminder one day before")} highlighted />
                <StoryCard number="03" icon={<BellRing size={23} />} title={t("필요한 순간에 다시", "It comes back when it matters")} body={t("저장보다 중요한 건 다시 떠올리는 일이니까.", "Because remembering later matters more than filing it perfectly now.")} />
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-black/[0.06] bg-white px-4 py-24 sm:py-32">
          <div className="mx-auto grid max-w-[1180px] gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
            <div>
              <p className="text-[12px] font-black uppercase tracking-[.16em] text-black/38">TRUST</p>
              <h2 className="mt-4 text-[clamp(44px,7vw,72px)] font-black leading-[1] tracking-[-.065em]">
                {t("아는 척하지 않아요.", "It doesn't pretend to know.")}
              </h2>
              <p className="mt-6 max-w-[530px] text-[17px] leading-[1.75] text-black/54">
                {t("애매하면 마음대로 시간을 만들지 않습니다. 일정에 꼭 필요한 것만 한 번 물어봅니다.", "When something is ambiguous, Itjima does not silently invent the answer. It asks for just the missing piece.")}
              </p>
            </div>
            <div className="rounded-[30px] border border-black/[0.07] bg-[#f7f7f2] p-4 sm:p-6">
              <div className="ml-auto max-w-[80%] rounded-[20px_20px_6px_20px] bg-[#f1db32] px-4 py-3 text-[15px] font-bold">
                {t("퇴근하고 치과", "Dentist after work")}
              </div>
              <div className="mt-4 max-w-[88%] rounded-[24px] border border-black/[0.07] bg-white p-5">
                <div className="flex items-center gap-2 text-[12px] font-black text-black/42"><CircleHelp size={15} />{t("한 가지만 확인할게요", "One quick check")}</div>
                <p className="mt-3 text-[20px] font-black tracking-[-.035em]">{t("퇴근은 몇 시쯤인가요?", "What time do you usually leave work?")}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {[t("오후 6시", "6 PM"), t("오후 7시", "7 PM"), t("직접 입력", "Enter time")].map((option) => <span key={option} className="rounded-full border border-black/10 bg-[#f7f7f2] px-4 py-2.5 text-[13px] font-bold">{option}</span>)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#fff6a7] px-4 py-24 sm:py-32">
          <div className="mx-auto max-w-[1180px]">
            <div className="mx-auto max-w-[860px] text-center">
              <p className="text-[12px] font-black uppercase tracking-[.16em] text-black/38">BEYOND THE CALENDAR</p>
              <h2 className="mt-4 text-balance text-[clamp(44px,8vw,80px)] font-black leading-[.98] tracking-[-.065em]">
                {t("모든 기억에 날짜가 있는 건 아니니까.", "Not every memory belongs on a date.")}
              </h2>
              <p className="mx-auto mt-6 max-w-[660px] text-[17px] leading-[1.75] text-black/55">
                {t("언젠가 필요한 생각도 일정에 억지로 끼워 넣지 마세요. 잊지마는 다시 꺼낼 맥락까지 함께 기억하는 제품을 만들고 있습니다.", "Don't force someday-thoughts into calendar slots. Itjima is being built to remember the context that makes a memory useful again.")}
              </p>
            </div>
            <div className="mx-auto mt-14 grid max-w-[900px] gap-4 sm:grid-cols-2">
              <MemoryCard icon={<MapPin size={20} />} input={t("다음에 다이소 가면 건전지", "Next time I'm at Daiso, batteries")} output={t("다이소에 갈 때 다시", "Bring it back at Daiso")} />
              <MemoryCard icon={<CalendarDays size={20} />} input={t("제주 가면 그 카페 가보기", "Try that cafe when I'm in Jeju")} output={t("제주에서 다시", "Bring it back in Jeju")} />
            </div>
          </div>
        </section>

        <section className="px-4 py-28 sm:py-40">
          <div className="mx-auto max-w-[980px] text-center">
            <p className="text-[12px] font-black uppercase tracking-[.16em] text-black/38">REDISCOVERY</p>
            <h2 className="mt-5 text-balance text-[clamp(50px,9vw,92px)] font-black leading-[.94] tracking-[-.07em]">
              {t("생각은 사라져도 됩니다.", "The thought can disappear.")}
              <br />
              <span className="text-black/28">{t("필요할 때 다시 가져올게요.", "We'll bring it back when it matters.")}</span>
            </h2>
            <div className="mx-auto mt-16 max-w-[620px] rounded-[28px] border border-black/[0.07] bg-white p-5 text-left shadow-[0_26px_70px_-36px_rgba(17,17,14,.28)] sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[12px] font-black text-black/35">ITJIMA</span>
                <span className="text-[12px] font-semibold text-black/35">7 {t("개월 전", "months ago")}</span>
              </div>
              <p className="mt-5 text-[13px] font-bold text-black/44">{t("예전에 남긴 기억이 있어요", "You left this for yourself")}</p>
              <p className="mt-2 text-[22px] font-black tracking-[-.04em]">{t("제주 가면 여기 가보기", "Try this place when I'm in Jeju")}</p>
            </div>
          </div>
        </section>

        <section className="border-t border-black/[0.06] px-4 py-24 sm:py-32">
          <div className="mx-auto max-w-[1180px]">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <FeatureCard title={t("말하듯 남기기", "Capture naturally")} body={t("필드를 채우기 전에 생각부터 남기세요.", "Capture the thought before filling fields.")} />
              <FeatureCard title={t("애매함만 확인", "Clarify only ambiguity")} body={t("모르는 건 추측하지 않고 필요한 것만 묻습니다.", "It asks instead of silently guessing.")} />
              <FeatureCard title={t("정해진 건 명확하게", "Clear when committed")} body={t("확정된 일정은 실제 캘린더처럼 관리합니다.", "Committed plans stay clear and manageable.")} />
              <FeatureCard title={t("날짜 없는 기억도", "Memories without dates")} body={t("언젠가 필요할 생각까지 한곳에 둡니다.", "Keep the thoughts you'll need someday, too.")} />
            </div>
          </div>
        </section>

        <section className="bg-[#11110e] px-4 py-28 text-white sm:py-36">
          <div className="mx-auto max-w-[940px] text-center">
            <h2 className="text-[clamp(60px,11vw,112px)] font-black leading-[.9] tracking-[-.075em]">{t("생각났어?", "Thought of something?")}</h2>
            <p className="mx-auto mt-7 max-w-[560px] text-[17px] leading-[1.7] text-white/52">{t("잊기 전에 하나 남겨보세요. 정리는 잊지마가 할게요.", "Drop it before it disappears. Itjima can handle the organizing.")}</p>
            <Link to="/" className="mt-9 inline-flex min-h-[58px] items-center justify-center gap-2 rounded-full bg-[#f1db32] px-7 text-[15px] font-black text-[#11110e] no-underline transition-transform hover:-translate-y-1">
              {t("첫 기억 남기기", "Leave your first memory")}
              <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/8 bg-[#11110e] px-4 py-8 text-white">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-4 text-[12px] font-semibold text-white/38 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 잊지마 Itjima</span>
          <span>{t("생각은 가볍게. 기억은 오래.", "Light thoughts. Lasting memory.")}</span>
        </div>
      </footer>
    </div>
  );
}

function StoryCard({ number, icon, title, body, highlighted = false }: { number: string; icon: React.ReactNode; title: string; body: string; highlighted?: boolean }) {
  return (
    <article className={`rounded-[28px] border p-6 sm:p-8 ${highlighted ? "border-[#d2bc19]/35 bg-[#fff7ad]" : "border-black/[0.07] bg-white"}`}>
      <div className="flex items-center justify-between gap-4 text-black/38">
        <span className="text-[11px] font-black tracking-[.14em]">{number}</span>
        {icon}
      </div>
      <h3 className="mt-10 text-[26px] font-black tracking-[-.045em]">{title}</h3>
      <p className="mt-3 text-[15px] font-semibold leading-[1.65] text-black/50">{body}</p>
    </article>
  );
}

function MemoryCard({ icon, input, output }: { icon: React.ReactNode; input: string; output: string }) {
  return (
    <article className="rounded-[28px] border border-black/[0.08] bg-white p-6 text-left sm:p-7">
      <div className="flex items-center gap-2 text-[12px] font-black text-black/38">{icon} MEMORY</div>
      <p className="mt-7 text-[20px] font-black tracking-[-.035em]">“{input}”</p>
      <div className="my-5 h-px bg-black/[0.07]" />
      <p className="text-[13px] font-bold text-black/50">→ {output}</p>
    </article>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="min-h-[220px] rounded-[26px] border border-black/[0.07] bg-white p-6">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-[#f1db32]"><Check size={16} /></div>
      <h3 className="mt-10 text-[20px] font-black tracking-[-.04em]">{title}</h3>
      <p className="mt-3 text-[14px] font-semibold leading-[1.65] text-black/48">{body}</p>
    </article>
  );
}
