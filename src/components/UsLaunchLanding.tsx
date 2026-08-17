import { Link } from "@tanstack/react-router";
import {
  Archive,
  ArrowRight,
  CalendarCheck2,
  CalendarClock,
  Check,
  Clock3,
  Download,
  Globe2,
  Hand,
  MessageSquareText,
  MoveDown,
  MoveLeft,
  MoveRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
} from "react";
import { BRAND } from "@/lib/brand";
import { LanguageToggle, useLang, useT } from "@/lib/i18n";
import {
  applyLandingSeo,
  injectJsonLd,
  landingStructuredDataGraph,
  removeJsonLd,
} from "@/lib/seo";

const proofItems = [
  { ko: "설치 없이 무료", en: "Free, no install required" },
  { ko: "로그인 없이 체험", en: "Try before signing in" },
  { ko: "텍스트·음성 입력", en: "Type or speak" },
  { ko: "스와이프로 빠른 정리", en: "Sort by swiping" },
];

const brandWordmarkStyle: CSSProperties = {
  fontFamily: '"Fugaz One", sans-serif',
  fontWeight: 400,
  letterSpacing: "-0.035em",
};

export function UsLaunchLanding() {
  const t = useT();
  const { lang } = useLang();
  const landingRef = useRef<HTMLDivElement>(null);

  const examples = useMemo(
    () => [
      {
        input: t("내일 오후 3시에 치과", "Dentist tomorrow at 3 PM"),
        result: t("내일 · 오후 3:00 · 치과", "Tomorrow · 3:00 PM · Dentist"),
        note: t(
          "날짜·시간·할 일을 한 번에 정리",
          "Turn the date, time, and task into one clear plan",
        ),
      },
      {
        input: t("주말에 수진이 만나기", "Meet Maya this weekend"),
        result: t("토요일  /  일요일", "Saturday  /  Sunday"),
        note: t(
          "토요일인지 일요일인지, 애매한 날짜만 확인",
          "Ask only whether you mean Saturday or Sunday",
        ),
      },
      {
        input: t("퇴근 후 장보기", "Buy groceries after work"),
        result: t("오후 6시  /  오후 7시", "6 PM  /  7 PM"),
        note: t(
          "퇴근 시간을 멋대로 정하지 않고 필요한 정보만 질문",
          "Never guess your time; ask only for what is missing",
        ),
      },
    ],
    [t],
  );

  const faq = useMemo(
    () => [
      {
        q: t(
          "잊지마는 어떤 일정 관리 앱인가요?",
          "What kind of scheduling app is Itjima?",
        ),
        a: t(
          "잊지마는 일정과 할 일을 말하거나 적으면 날짜와 시간을 정리해 주는 AI 일정관리 앱입니다. 확실한 내용은 바로 채우고, 애매한 부분만 짧게 확인합니다.",
          "Itjima turns schedules and tasks you type or say into structured plans. It fills clear details and asks only about anything ambiguous.",
        ),
      },
      {
        q: t(
          "기존 캘린더 앱과 무엇이 다른가요?",
          "How is this different from a calendar?",
        ),
        a: t(
          "캘린더는 보통 날짜와 시간을 먼저 골라야 합니다. 잊지마는 ‘내일 3시 치과’처럼 말하듯 남기면 일정 형식으로 정리하고, 필요한 경우에만 추가로 묻습니다.",
          "Calendars ask you to fill fields first. Itjima lets you say the plan naturally, fills what is clear, and asks only about the uncertain part.",
        ),
      },
      {
        q: t(
          "스와이프 정리는 어떻게 쓰나요?",
          "How does swipe sorting work?",
        ),
        a: t(
          "쌓인 내용을 한 장씩 보면서 오른쪽으로 밀면 일정으로, 아래로 내리면 그대로 두고, 왼쪽으로 밀면 보관함으로 정리할 수 있습니다.",
          "Review one item at a time: swipe right to schedule it, down to keep it where it is, or left to save it to the vault.",
        ),
      },
      {
        q: t(
          "음성으로도 일정을 등록할 수 있나요?",
          "Can I add a schedule by voice?",
        ),
        a: t(
          "네. 키보드로 적거나 마이크로 말할 수 있습니다. 한국어 일정 표현을 인식해 날짜와 시간을 정리합니다.",
          "Yes. Type with the keyboard or use the microphone. Itjima understands Korean and English schedule expressions and organizes the date and time.",
        ),
      },
      {
        q: t(
          "앱을 설치하거나 로그인해야 하나요?",
          "Do I need to install the app or sign in?",
        ),
        a: t(
          "아니요. 브라우저에서 설치와 로그인 없이 무료로 체험할 수 있습니다. 여러 기기에서 이어 쓰고 싶을 때 로그인하면 됩니다.",
          "No. Try it for free in your browser without installing or signing in. Sign in later if you want to continue across devices.",
        ),
      },
      {
        q: t("알림은 항상 도착하나요?", "Are reminders guaranteed to arrive?"),
        a: t(
          "브라우저·기기·네트워크 설정에 따라 알림이 지연되거나 누락될 수 있습니다. 중요한 일정은 별도 캘린더나 알람으로도 확인하세요.",
          "No reminder system can guarantee delivery across every browser, device, and network condition. Keep a separate calendar or alarm for critical commitments.",
        ),
      },
      {
        q: t(
          "내 데이터를 삭제할 수 있나요?",
          "Can I export or delete my data?",
        ),
        a: t(
          "설정의 ‘데이터와 개인정보’에서 데이터를 내려받거나 기기 데이터·계정을 삭제할 수 있습니다.",
          "Yes. Open Settings → Data & privacy to download your data or delete device data and your account.",
        ),
      },
    ],
    [t],
  );

  useLayoutEffect(() => {
    const landing = landingRef.current;
    if (!landing) return;

    const revealItems = Array.from(
      landing.querySelectorAll<HTMLElement>("[data-landing-reveal]"),
    );
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reducedMotion || !("IntersectionObserver" in window)) {
      landing.dataset.motion = "reduced";
      revealItems.forEach((item) => {
        item.dataset.landingVisible = "true";
      });
      return;
    }

    landing.dataset.motion = "ready";
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const item = entry.target as HTMLElement;
          item.dataset.landingVisible = "true";
          observer.unobserve(item);
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -48px" },
    );

    revealItems.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    applyLandingSeo({
      canonicalPath: "/",
      locale: lang,
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

  return (
    <div ref={landingRef} className="landing-motion min-h-dvh bg-white text-[#141410]">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-full bg-[#141410] px-4 py-2 text-sm font-bold text-white focus:translate-y-0"
      >
        {t("본문으로 이동", "Skip to content")}
      </a>

      <header className="landing-motion-header sticky top-0 z-50 border-b border-black/[0.07] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[68px] w-[min(1120px,calc(100%-32px))] items-center justify-between gap-4">
          <Link
            to="/about"
            className="landing-motion-wordmark flex min-h-11 items-center no-underline"
            aria-label={t("잊지마 소개", "Itjima home")}
          >
            <span
              className="text-[26px] leading-none text-[#141410]"
              style={brandWordmarkStyle}
            >
              ITJIMA
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Link
              to="/"
              className="landing-motion-header-cta inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#141410] px-4 text-[13px] font-bold text-white no-underline"
            >
              {t("앱 열기", "Open app")}
              <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className="landing-motion-hero bg-white px-4 pb-20 pt-16 sm:pt-24">
          <div className="mx-auto grid w-full max-w-[1120px] items-center gap-14 lg:grid-cols-[1.04fr_.96fr]">
            <div className="landing-motion-copy">
              <div className="landing-motion-eyebrow inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.13em]">
                <Sparkles size={14} aria-hidden />
                {t(
                  "무계획자를 위한 일정 관리 · 무료 베타",
                  "Scheduling for unplanned minds · Free beta",
                )}
              </div>
              <h1 className="landing-motion-title mt-7 max-w-[720px] text-[clamp(48px,9vw,82px)] font-black leading-[.98] tracking-[-.065em]">
                {t("대충 말해도,", "Say it roughly.")}
                <br />
                <span className="relative inline-block">
                  <span className="relative z-10">
                    {t("일정이 됩니다.", "It becomes a schedule.")}
                  </span>
                  <span
                    className="landing-motion-highlight absolute bottom-[.06em] left-[-.02em] right-[-.04em] h-[.22em] -rotate-1 rounded-full bg-primary"
                    aria-hidden
                  />
                </span>
              </h1>
              <p className="landing-motion-description mt-7 max-w-[650px] text-[17px] leading-[1.75] text-black/58 sm:text-[19px]">
                {t(
                  "‘내일 3시 치과’, ‘주말에 수진이 만나기’처럼 말하거나 적어보세요. 잊지마가 날짜와 시간을 정리하고, 애매한 부분만 물어봐요.",
                  "Type or say a plan as it comes to mind. Itjima organizes the date and time, then asks only about anything ambiguous.",
                )}
              </p>
              <div className="landing-motion-actions mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/"
                  className="landing-motion-primary-cta inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[17px] bg-primary px-6 text-[15px] font-black no-underline shadow-[0_12px_30px_rgba(126,104,0,.14)]"
                >
                  {t("일정 하나 던져보기", "Drop your first plan")}
                  <ArrowRight size={18} aria-hidden />
                </Link>
                <a
                  href="#how"
                  className="landing-motion-secondary-cta inline-flex min-h-[56px] items-center justify-center rounded-[17px] border border-black/[0.1] bg-white px-6 text-[15px] font-bold no-underline"
                >
                  {t("10초 작동 방식 보기", "See the 10-second flow")}
                </a>
              </div>
            </div>

            <div className="landing-motion-demo-wrap relative">
              <div
                className="landing-motion-demo-glow absolute inset-10 rounded-full bg-primary/30 blur-3xl"
                aria-hidden
              />
              <div className="landing-motion-demo-shell relative rounded-[28px] border border-black/[0.08] bg-white p-3 shadow-[0_28px_80px_rgba(20,20,16,.14)]">
                <div className="flex items-center justify-between border-b border-black/[0.06] px-3 py-3">
                  <div>
                    <div
                      className="text-[12px] leading-none text-black/45"
                      style={brandWordmarkStyle}
                    >
                      ITJIMA
                    </div>
                    <div className="mt-2 text-[17px] font-black">
                      {t("일정 등록", "Schedule")}
                    </div>
                  </div>
                  <Globe2 size={20} className="text-black/35" aria-hidden />
                </div>
                <div className="space-y-4 p-3 pb-5 pt-6">
                  <div className="landing-motion-message ml-auto max-w-[84%] rounded-[19px_19px_5px_19px] bg-primary px-4 py-3 text-[14px] font-bold leading-relaxed">
                    {t("내일 오후 3시에 치과", "Dentist tomorrow at 3 PM")}
                  </div>
                  <div className="landing-motion-result max-w-[92%] rounded-[20px] border border-black/[0.08] bg-[#fafaf7] p-4">
                    <div className="text-[11px] font-bold text-black/42">
                      {t("이렇게 이해했어요", "Here's what I understood")}
                    </div>
                    <div className="mt-2 text-[17px] font-black">
                      {t(
                        "내일 · 오후 3:00 · 치과",
                        "Tomorrow · 3:00 PM · Dentist",
                      )}
                    </div>
                    <p className="mt-2 text-[12px] leading-relaxed text-black/48">
                      {t(
                        "날짜와 시간이 분명해요. 확인하면 바로 추가돼요.",
                        "The date and time are clear. Add it in one tap.",
                      )}
                    </p>
                    <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                      <span className="landing-motion-confirm grid min-h-11 place-items-center rounded-full bg-primary px-4 text-[12px] font-black">
                        {t("이대로 추가", "Add this plan")}
                      </span>
                      <span className="landing-motion-adjust grid min-h-11 place-items-center rounded-full border border-black/[0.1] px-4 text-[12px] font-bold">
                        {t("수정할게요", "Adjust")}
                      </span>
                    </div>
                  </div>
                  <div className="landing-motion-input rounded-[18px] border border-black/[0.08] px-4 py-3 text-[13px] text-black/38">
                    {t(
                      "일정이나 할 일을 말해보세요…",
                      "Say a schedule or task…",
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-motion-proof border-y border-black/[0.07] bg-white px-4">
          <div className="mx-auto grid max-w-[1120px] sm:grid-cols-2 lg:grid-cols-4">
            {proofItems.map((item, index) => (
              <div
                key={item.en}
                data-landing-reveal
                className="flex min-h-[74px] items-center gap-2 border-b border-black/[0.06] px-3 text-[13px] font-bold last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
                style={
                  { "--landing-delay": `${index * 60}ms` } as CSSProperties
                }
              >
                <Check size={16} className="text-[#27834d]" aria-hidden />
                {t(item.ko, item.en)}
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="bg-white px-4 py-24">
          <div className="mx-auto max-w-[1120px]">
            <div data-landing-reveal>
              <span className="text-[11px] font-black uppercase tracking-[.16em] text-black/42">
                {t("작동 방식 · HOW IT WORKS", "HOW IT WORKS")}
              </span>
              <h2 className="mt-4 max-w-[820px] text-[clamp(38px,7vw,64px)] font-black leading-[1.04] tracking-[-.055em]">
                {t(
                  "말하거나 적으면, 일정으로 정리해요.",
                  "Type or speak. It turns into a schedule.",
                )}
              </h2>
            </div>
            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              {examples.map((example, index) => (
                <article
                  key={example.input}
                  data-landing-reveal
                  className="landing-motion-lift flex min-h-[300px] flex-col rounded-[24px] border border-black/[0.08] bg-white p-6"
                  style={
                    { "--landing-delay": `${index * 90}ms` } as CSSProperties
                  }
                >
                  <span className="text-[11px] font-black tracking-[.14em] text-black/35">
                    0{index + 1}
                  </span>
                  <MessageSquareText size={25} className="mt-8" aria-hidden />
                  <h3 className="mt-5 text-[21px] font-black tracking-[-.035em]">
                    “{example.input}”
                  </h3>
                  <div className="mt-5 rounded-[15px] bg-[#f6f6f1] px-4 py-3 text-[14px] font-bold">
                    {example.result}
                  </div>
                  <p className="mt-auto pt-6 text-[13px] leading-relaxed text-black/48">
                    {example.note}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="swipe" className="border-y border-black/[0.07] bg-white px-4 py-24">
          <div className="mx-auto grid max-w-[1120px] items-center gap-14 lg:grid-cols-[.86fr_1.14fr]">
            <div data-landing-reveal>
              <span className="text-[11px] font-black uppercase tracking-[.16em] text-black/42">
                {t("빠른 정리 · SWIPE TO DECIDE", "SWIPE TO DECIDE")}
              </span>
              <h2 className="mt-4 max-w-[620px] text-[clamp(38px,7vw,64px)] font-black leading-[1.04] tracking-[-.055em]">
                {t(
                  "쌓인 생각은, 스와이프로 가볍게 정리해요.",
                  "When thoughts pile up, swipe through them.",
                )}
              </h2>
              <p className="mt-6 max-w-[590px] text-[16px] leading-[1.75] text-black/55">
                {t(
                  "하나씩 읽고 결정만 하세요. 오른쪽은 일정으로, 아래는 그대로, 왼쪽은 보관함으로. 다시 폼을 채우지 않아도 됩니다.",
                  "Review one item and make one decision. Right schedules it, down keeps it here, and left saves it to the vault — no forms to refill.",
                )}
              </p>
              <div className="mt-8 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {[
                  {
                    icon: MoveLeft,
                    ko: "왼쪽 · 보관함",
                    en: "Left · Vault",
                  },
                  {
                    icon: MoveDown,
                    ko: "아래 · 그대로",
                    en: "Down · Keep",
                  },
                  {
                    icon: MoveRight,
                    ko: "오른쪽 · 일정",
                    en: "Right · Schedule",
                  },
                ].map(({ icon: Icon, ko, en }) => (
                  <div
                    key={en}
                    className="flex items-center gap-2 rounded-[14px] border border-black/[0.08] bg-white px-3 py-3 text-[12px] font-bold"
                  >
                    <Icon size={16} aria-hidden />
                    {t(ko, en)}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[560px] py-12" data-landing-reveal>
              <div className="absolute left-1/2 top-1/2 h-[310px] w-[310px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-3xl" aria-hidden />
              <div className="relative mx-auto h-[390px] max-w-[430px]">
                <div className="absolute inset-x-10 top-12 h-[260px] rotate-[-5deg] rounded-[28px] border border-black/[0.06] bg-[#f7f7f3]" aria-hidden />
                <div className="absolute inset-x-8 top-8 h-[270px] rotate-[4deg] rounded-[28px] border border-black/[0.07] bg-white shadow-[0_16px_50px_rgba(20,20,16,.08)]" aria-hidden />
                <article className="absolute inset-x-6 top-4 min-h-[280px] rounded-[28px] border border-black/[0.1] bg-white p-7 shadow-[0_28px_80px_rgba(20,20,16,.14)] sm:inset-x-10">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black tracking-[.14em] text-black/35">
                      {t("정리할 생각 1/5", "THOUGHT 1/5")}
                    </span>
                    <Hand size={20} className="text-black/30" aria-hidden />
                  </div>
                  <p className="mt-14 text-[27px] font-black leading-[1.2] tracking-[-.045em] sm:text-[31px]">
                    {t(
                      "다음 주에 여권 갱신 알아보기",
                      "Look into renewing my passport next week",
                    )}
                  </p>
                  <p className="mt-4 text-[13px] leading-relaxed text-black/45">
                    {t(
                      "지금 결정할 방향으로 카드를 밀어보세요.",
                      "Move the card in the direction of your decision.",
                    )}
                  </p>
                </article>

                <div className="absolute left-0 top-[154px] flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3 py-2 text-[11px] font-black shadow-card">
                  <Archive size={15} aria-hidden />
                  {t("보관함으로", "Vault")}
                </div>
                <div className="absolute right-0 top-[154px] flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-[11px] font-black shadow-card">
                  {t("일정으로", "Schedule")}
                  <CalendarClock size={15} aria-hidden />
                </div>
                <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3 py-2 text-[11px] font-black shadow-card">
                  <Hand size={15} aria-hidden />
                  {t("그대로 둘게요", "Keep here")}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#171712] px-4 py-24 text-white">
          <div className="mx-auto max-w-[1120px]">
            <div data-landing-reveal>
              <span className="text-[11px] font-black uppercase tracking-[.16em] text-white/45">
                {t("안심하고 쓰기 · BUILT FOR TRUST", "BUILT FOR TRUST")}
              </span>
              <h2 className="mt-4 max-w-[800px] text-[clamp(38px,7vw,64px)] font-black leading-[1.04] tracking-[-.055em]">
                {t(
                  "자동으로 정리해도, 결정은 내가.",
                  "It organizes the details. You stay in control.",
                )}
              </h2>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-2">
              {[
                {
                  icon: ShieldCheck,
                  ko: "애매하면 먼저 물어봐요",
                  en: "No silent time assumptions",
                  bodyKo:
                    "오전·오후, 주말 날짜, 퇴근 시간을 멋대로 정하지 않아요.",
                  bodyEn:
                    "AM or PM, weekend day, and after-work time are confirmed instead of silently guessed.",
                },
                {
                  icon: Globe2,
                  ko: "내 시간대에 맞춰요",
                  en: "Your local time zone",
                  bodyKo: "기기 시간대를 기준으로 일정을 저장하고 보여줘요.",
                  bodyEn:
                    "It stores the device's time zone and keeps your plans aligned with local time.",
                },
                {
                  icon: Download,
                  ko: "내 데이터는 내가 관리해요",
                  en: "Export and delete your data",
                  bodyKo:
                    "설정에서 데이터를 내려받고 기기 데이터나 계정을 삭제할 수 있어요.",
                  bodyEn:
                    "Download saved data and delete device data or your account from Settings.",
                },
                {
                  icon: Clock3,
                  ko: "중요 일정은 한 번 더 확인해요",
                  en: "Critical plans need a backup",
                  bodyKo:
                    "알림은 기기와 네트워크 상태에 따라 늦거나 누락될 수 있다고 미리 알려드려요.",
                  bodyEn:
                    "We clearly state that browser and network conditions can delay or prevent reminders.",
                },
              ].map(({ icon: Icon, ko, en, bodyKo, bodyEn }, index) => (
                <article
                  key={en}
                  data-landing-reveal
                  className="landing-motion-lift landing-motion-lift-dark rounded-[23px] border border-white/12 bg-white/[0.045] p-6"
                  style={
                    { "--landing-delay": `${index * 70}ms` } as CSSProperties
                  }
                >
                  <Icon size={25} className="text-primary" aria-hidden />
                  <h3 className="mt-7 text-[22px] font-black tracking-[-.035em]">
                    {t(ko, en)}
                  </h3>
                  <p className="mt-3 max-w-[520px] text-[14px] leading-[1.7] text-white/58">
                    {t(bodyKo, bodyEn)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-24">
          <div className="mx-auto grid max-w-[1120px] gap-12 lg:grid-cols-[.75fr_1.25fr]">
            <div data-landing-reveal>
              <span className="text-[11px] font-black uppercase tracking-[.16em] text-black/42">
                FAQ
              </span>
              <h2 className="mt-4 text-[clamp(38px,7vw,60px)] font-black leading-[1.04] tracking-[-.055em]">
                {t(
                  "처음 쓰기 전에 궁금한 점.",
                  "What you may want to know first.",
                )}
              </h2>
            </div>
            <div
              className="landing-motion-faq border-t border-black/15"
              data-landing-reveal
            >
              {faq.map((item) => (
                <details
                  key={item.q}
                  className="group border-b border-black/[0.09]"
                >
                  <summary className="flex min-h-[72px] cursor-pointer list-none items-center justify-between gap-5 py-4 text-[17px] font-black tracking-[-.025em] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-blue-600">
                    <span>{item.q}</span>
                    <span
                      className="text-[24px] font-normal transition-transform group-open:rotate-45"
                      aria-hidden
                    >
                      +
                    </span>
                  </summary>
                  <p className="max-w-[680px] pb-6 pr-8 text-[14px] leading-[1.75] text-black/55">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white px-4 pb-24">
          <div
            data-landing-reveal
            className="landing-motion-final mx-auto max-w-[1120px] rounded-[30px] border border-black/[0.08] bg-white px-6 py-16 text-center shadow-[0_22px_70px_rgba(20,20,16,.08)] sm:px-10"
          >
            <CalendarCheck2 size={34} className="mx-auto" aria-hidden />
            <h2 className="mx-auto mt-6 max-w-[780px] text-[clamp(40px,8vw,68px)] font-black leading-[1.02] tracking-[-.06em]">
              {t(
                "지금 떠오른 일정, 잊기 전에 던져보세요.",
                "Drop the plan on your mind before it disappears.",
              )}
            </h2>
            <p className="mx-auto mt-5 max-w-[620px] text-[16px] leading-relaxed text-black/52">
              {t(
                "설치 없이 무료로 시작하고, 필요하면 나중에 로그인하세요.",
                "Start free without installing. Sign in later if you need sync.",
              )}
            </p>
            <Link
              to="/"
              className="landing-motion-primary-cta mx-auto mt-8 inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[17px] bg-primary px-7 text-[15px] font-black no-underline"
            >
              {t("일정 하나 던져보기", "Drop a plan for free")}
              <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/[0.08] bg-white px-4 py-10">
        <div className="mx-auto flex max-w-[1120px] flex-col justify-between gap-8 sm:flex-row sm:items-end">
          <div>
            <div className="text-[21px] leading-none" style={brandWordmarkStyle}>
              ITJIMA
            </div>
            <p className="mt-3 text-[13px] text-black/45">
              {t(BRAND.taglineKo, BRAND.taglineEn)}
            </p>
          </div>
          <nav
            className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-bold"
            aria-label={t(
              "제품, 소셜 및 법적 링크",
              "Product, social, and legal links",
            )}
          >
            <Link to="/">{t("앱 열기", "Open app")}</Link>
            <a href={BRAND.privacyUrl}>{t("개인정보", "Privacy")}</a>
            <a href={BRAND.termsUrl}>{t("약관", "Terms")}</a>
            <a
              href={BRAND.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Instagram
            </a>
            <a
              href={BRAND.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn
            </a>
            <a
              href="https://github.com/seulkidesign-app/itjima"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
