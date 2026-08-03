import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BellRing,
  CalendarCheck2,
  Check,
  Clock3,
  Download,
  Globe2,
  Layers3,
  MessageSquareText,
  Mic2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { BRAND } from "@/lib/brand";
import { LanguageToggle, useLang, useT } from "@/lib/i18n";
import {
  applyLandingSeo,
  injectJsonLd,
  landingStructuredDataGraph,
  removeJsonLd,
} from "@/lib/seo";
import { ItjimaBrandMark } from "./ItjimaBrandMark";

const proofItems = [
  { ko: "로그인 없이 바로 시작", en: "Try before signing in" },
  { ko: "말하거나 타이핑해서 입력", en: "Type or speak naturally" },
  { ko: "한국어·영어 지원", en: "English & Korean" },
  { ko: "홈 화면에 앱으로 추가", en: "Install to your home screen" },
];

export function UsLaunchLanding() {
  const t = useT();
  const { lang } = useLang();

  const examples = useMemo(
    () => [
      {
        icon: MessageSquareText,
        input: t("다음 주 금요일 퇴근하고 치과", "Dentist next Friday after work"),
        result: t("금요일 · 오후 7:00 · 치과", "Friday · 7:00 PM · Dentist"),
        note: t(
          "확실한 날짜와 시간을 한 장의 일정으로 정리",
          "Turn clear date and time details into one finished plan",
        ),
      },
      {
        icon: Clock3,
        input: t("주말에 수진이 만나기", "Meet Maya this weekend"),
        result: t("토요일 / 일요일 중 선택", "Choose Saturday or Sunday"),
        note: t(
          "애매한 부분만 짧게 확인하고 나머지는 그대로 유지",
          "Ask only about the ambiguous part and preserve the rest",
        ),
      },
      {
        icon: BellRing,
        input: t("전날에도 알려줘", "Remind me the day before"),
        result: t("전날 오후 9시 미리 알림", "Reminder · 9 PM the day before"),
        note: t(
          "생각이 다시 필요해지는 순간에 먼저 꺼내 보여주기",
          "Bring the thought back when it becomes useful again",
        ),
      },
    ],
    [t],
  );

  const faq = useMemo(
    () => [
      {
        q: t("캘린더와 무엇이 다른가요?", "How is this different from a calendar?"),
        a: t(
          "캘린더는 날짜와 시간을 먼저 고르게 합니다. 잊지마는 먼저 말하듯 남기고, 확실한 정보는 채우며 애매한 부분만 확인합니다.",
          "Calendars ask you to fill fields first. Itjima lets you say the plan naturally, fills what is clear, and asks only about the uncertain part.",
        ),
      },
      {
        q: t("로그인 없이 사용할 수 있나요?", "Can I use it without an account?"),
        a: t(
          "네. 브라우저에서 바로 사용할 수 있습니다. 로그인하면 여러 기기에서 동기화할 수 있습니다.",
          "Yes. You can start in the browser. Sign in only when you want cross-device sync.",
        ),
      },
      {
        q: t("홈 화면에 앱처럼 추가할 수 있나요?", "Can I install it like an app?"),
        a: t(
          "네. Chrome에서는 설치 버튼을, iPhone에서는 공유 메뉴의 ‘홈 화면에 추가’를 사용하면 됩니다. 랜딩과 메인 홈에서 기기별 설치 방법을 확인할 수 있습니다.",
          "Yes. Chrome can open a native install prompt, while iPhone uses Add to Home Screen from the Share menu. Device-specific steps are available on the landing page and app home.",
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
        q: t("내 데이터를 삭제할 수 있나요?", "Can I export or delete my data?"),
        a: t(
          "설정의 ‘데이터와 개인정보’에서 데이터를 내려받거나 기기 데이터·계정을 삭제할 수 있습니다.",
          "Yes. Open Settings → Data & privacy to download your data or delete device data and your account.",
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
        ? "Itjima | Drop a thought. Get a usable schedule."
        : "잊지마 Itjima | 생각을 던지면 일정이 됩니다",
      description: isEnglish
        ? "Say a plan naturally. Itjima fills what is clear, asks only about ambiguous details, and brings the thought back when it matters."
        : "말하듯 일정을 남기면 확실한 정보는 채우고, 애매한 날짜와 시간만 확인해 다시 필요한 순간에 알려줍니다.",
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
    <div className="marketing-landing min-h-dvh bg-[#f7f5ee] text-[#15150f]">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-full bg-[#15150f] px-4 py-2 text-sm font-bold text-white focus:translate-y-0"
      >
        {t("본문으로 이동", "Skip to content")}
      </a>

      <header className="marketing-header sticky top-0 z-50 border-b border-black/[0.07] bg-[#f7f5ee]/88 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] w-[min(1180px,calc(100%-32px))] items-center justify-between gap-4">
          <Link
            to="/about"
            className="marketing-wordmark flex min-h-11 items-center gap-2.5 no-underline"
            aria-label={t("잊지마 소개", "Itjima home")}
          >
            <ItjimaBrandMark size={40} />
            <span>
              <strong className="block font-display text-[19px] uppercase tracking-[0.07em]">
                ITJIMA
              </strong>
              <small className="hidden text-[9px] font-bold uppercase tracking-[0.14em] text-black/38 sm:block">
                {t("기억을 맡기는 가장 가벼운 방법", "A lighter way to remember")}
              </small>
            </span>
          </Link>

          <nav className="marketing-header-links hidden items-center gap-6 text-[12px] font-bold text-black/55 lg:flex" aria-label={t("랜딩 메뉴", "Landing navigation")}>
            <a href="#how">{t("작동 방식", "How it works")}</a>
            <a href="#why">{t("왜 잊지마인가", "Why Itjima")}</a>
            <a href="#faq">FAQ</a>
          </nav>

          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Link
              to="/"
              className="marketing-open-app inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#15150f] px-4 text-[13px] font-bold text-white no-underline"
            >
              {t("앱 열기", "Open app")}
              <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className="marketing-hero relative overflow-hidden px-4 pb-20 pt-14 sm:pb-28 sm:pt-24">
          <div className="marketing-orbit marketing-orbit-a" aria-hidden />
          <div className="marketing-orbit marketing-orbit-b" aria-hidden />

          <div className="mx-auto grid w-full max-w-[1180px] items-center gap-14 lg:grid-cols-[1.02fr_.98fr] lg:gap-20">
            <div className="marketing-hero-copy relative z-[2]">
              <div className="marketing-eyebrow inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/75 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] shadow-sm backdrop-blur">
                <Sparkles size={14} aria-hidden />
                {t("생각을 던지면, 일정이 된다 · Public beta", "Drop a thought. Get a schedule. · Public beta")}
              </div>

              <h1 className="marketing-hero-title mt-7 max-w-[760px] text-[clamp(52px,9vw,92px)] font-black leading-[0.92] tracking-[-0.072em]">
                {t("기억하려고", "Stop trying")}
                <br />
                {t("애쓰지 마세요.", "to remember.")}
                <br />
                <span className="marketing-highlight relative inline-block">
                  <span className="relative z-10">{t("그냥 던지세요.", "Just drop it.")}</span>
                  <span className="marketing-highlight-stroke absolute bottom-[0.02em] left-[-0.03em] right-[-0.05em] h-[0.22em] -rotate-1 rounded-full bg-primary" aria-hidden />
                </span>
              </h1>

              <p className="mt-7 max-w-[670px] text-[17px] font-medium leading-[1.72] text-black/58 sm:text-[19px]">
                {t(
                  "‘다음 주 금요일 퇴근하고 치과. 전날에도 알려줘.’ 캘린더 칸을 채우지 말고 말하듯 남기세요. 잊지마가 일정으로 정리하고 다시 필요한 순간에 꺼내 보여줍니다.",
                  "“Dentist next Friday after work. Remind me the day before.” Skip the calendar fields. Say it naturally, and Itjima turns it into a usable plan that comes back when it matters.",
                )}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/"
                  className="marketing-primary-cta inline-flex min-h-[58px] items-center justify-center gap-2 rounded-[18px] bg-primary px-7 text-[15px] font-black no-underline"
                >
                  {t("첫 일정 남기기", "Capture your first plan")}
                  <ArrowRight size={18} aria-hidden />
                </Link>
                <a
                  href="#how"
                  className="marketing-secondary-cta inline-flex min-h-[58px] items-center justify-center rounded-[18px] border border-black/[0.11] bg-white/80 px-7 text-[15px] font-bold no-underline backdrop-blur"
                >
                  {t("10초 데모 보기", "See the 10-second flow")}
                </a>
              </div>

              <div className="marketing-hero-notes mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-bold text-black/40">
                <span>{t("로그인 없이 바로 시작", "No sign-in required to try")}</span>
                <span>{t("PC·모바일·PWA", "Web, mobile, and PWA")}</span>
                <span>{t("한국어·영어", "Korean and English")}</span>
              </div>
            </div>

            <div className="marketing-demo-wrap relative z-[2]">
              <div className="marketing-demo-glow absolute inset-[12%] rounded-full bg-primary/30 blur-3xl" aria-hidden />
              <span className="marketing-float-chip marketing-float-chip-a">
                <Mic2 size={14} aria-hidden /> {t("말하듯 입력", "Speak naturally")}
              </span>
              <span className="marketing-float-chip marketing-float-chip-b">
                <Layers3 size={14} aria-hidden /> {t("한 장의 일정", "One finished card")}
              </span>
              <span className="marketing-float-chip marketing-float-chip-c">
                <BellRing size={14} aria-hidden /> {t("필요할 때 다시", "Back when needed")}
              </span>

              <div className="marketing-demo-shell relative rounded-[34px] border border-black/[0.09] bg-white/92 p-3 shadow-[0_36px_100px_rgba(28,25,13,.18)] backdrop-blur-xl">
                <div className="marketing-demo-topbar flex items-center justify-between border-b border-black/[0.06] px-3 py-3">
                  <div className="flex items-center gap-2.5">
                    <ItjimaBrandMark size={34} />
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-[.17em] text-black/35">ITJIMA</div>
                      <div className="mt-0.5 text-[15px] font-black">{t("생각 남기기", "Capture")}</div>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#f4f2e9] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-black/35">
                    {t("방금", "Now")}
                  </span>
                </div>

                <div className="marketing-demo-thread space-y-4 p-3 pb-5 pt-6">
                  <div className="marketing-demo-message ml-auto max-w-[88%] rounded-[21px_21px_6px_21px] bg-primary px-4 py-3.5 text-[14px] font-bold leading-relaxed shadow-[0_12px_28px_rgba(137,107,0,.15)]">
                    {t(
                      "다음 주 금요일 퇴근하고 치과. 전날에도 알려줘",
                      "Dentist next Friday after work. Remind me the day before",
                    )}
                  </div>

                  <div className="marketing-demo-interpretation max-w-[94%] rounded-[23px] border border-black/[0.08] bg-[#fbfaf4] p-4 shadow-[0_14px_38px_rgba(20,20,16,.07)]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-black uppercase tracking-[0.13em] text-black/38">
                        {t("이렇게 기억할게요", "Here is what I understood")}
                      </span>
                      <Check size={16} className="text-[#23834c]" aria-hidden />
                    </div>
                    <div className="mt-3 text-[19px] font-black tracking-[-.035em]">
                      {t("치과 가기", "Go to the dentist")}
                    </div>
                    <div className="mt-3 grid gap-2 text-[12px] font-bold sm:grid-cols-2">
                      <div className="marketing-demo-detail rounded-[14px] bg-white px-3 py-2.5">
                        <Clock3 size={14} aria-hidden />
                        {t("금요일 오후 7시", "Friday · 7 PM")}
                      </div>
                      <div className="marketing-demo-detail rounded-[14px] bg-white px-3 py-2.5">
                        <BellRing size={14} aria-hidden />
                        {t("전날 오후 9시", "Day before · 9 PM")}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                      <span className="marketing-demo-confirm grid min-h-11 place-items-center rounded-[14px] bg-[#15150f] px-4 text-[12px] font-black text-white">
                        {t("이대로 기억하기", "Remember this")}
                      </span>
                      <span className="grid min-h-11 place-items-center rounded-[14px] border border-black/[0.1] bg-white px-4 text-[12px] font-bold">
                        {t("수정", "Adjust")}
                      </span>
                    </div>
                  </div>

                  <div className="marketing-demo-saved flex items-center gap-3 rounded-[18px] border border-primary/45 bg-primary/15 px-4 py-3">
                    <CalendarCheck2 size={19} aria-hidden />
                    <div>
                      <strong className="block text-[12px] font-black">{t("기억해둘게요", "I will remember it")}</strong>
                      <span className="mt-0.5 block text-[10px] font-medium text-black/45">{t("캘린더와 알림에 반영됨", "Added to calendar and reminders")}</span>
                    </div>
                  </div>

                  <div className="marketing-demo-input flex min-h-[50px] items-center justify-between rounded-[18px] border border-black/[0.09] bg-white px-4 text-[12px] text-black/36">
                    <span>{t("말하듯 남겨보세요…", "Say a plan naturally…")}</span>
                    <Mic2 size={18} aria-hidden />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="marketing-proof-strip border-y border-black/[0.07] bg-white/80 px-4 backdrop-blur">
          <div className="mx-auto grid max-w-[1180px] sm:grid-cols-2 lg:grid-cols-4">
            {proofItems.map((item) => (
              <div key={item.en} className="flex min-h-[78px] items-center gap-2.5 border-b border-black/[0.06] px-3 text-[13px] font-bold last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/22">
                  <Check size={15} aria-hidden />
                </span>
                {t(item.ko, item.en)}
              </div>
            ))}
          </div>
        </section>

        <section id="why" className="marketing-manifesto relative overflow-hidden bg-[#171712] px-4 py-24 text-white sm:py-32">
          <div className="marketing-manifesto-glow" aria-hidden />
          <div className="relative mx-auto max-w-[1180px]">
            <span className="text-[10px] font-black uppercase tracking-[.18em] text-primary">WHY ITJIMA</span>
            <h2 className="mt-5 max-w-[1000px] text-[clamp(44px,8vw,82px)] font-black leading-[0.98] tracking-[-.064em]">
              {t(
                "머릿속에서 꺼내는 순간, 해야 할 일은 가벼워집니다.",
                "The moment it leaves your head, the plan becomes lighter.",
              )}
            </h2>
            <p className="mt-7 max-w-[720px] text-[17px] leading-[1.72] text-white/58">
              {t(
                "잊지마는 더 많은 일을 관리하게 만드는 생산성 도구가 아닙니다. 떠오른 생각을 빠르게 밖으로 꺼내고, 나중에 필요한 순간에 다시 연결하는 기억의 외주 서비스입니다.",
                "Itjima is not another productivity system asking you to manage more. It helps you move a thought out of your head quickly, then reconnects it to the moment it becomes useful.",
              )}
            </p>

            <div className="mt-14 grid gap-4 lg:grid-cols-3">
              {[
                {
                  no: "01",
                  titleKo: "던지기",
                  titleEn: "Drop",
                  bodyKo: "완벽한 문장 없이, 떠오른 그대로 남깁니다.",
                  bodyEn: "Capture it exactly as it arrives, without a perfect sentence.",
                },
                {
                  no: "02",
                  titleKo: "형태 만들기",
                  titleEn: "Shape",
                  bodyKo: "확실한 정보는 일정으로 만들고, 애매한 부분만 확인합니다.",
                  bodyEn: "Turn clear details into a plan and confirm only what is uncertain.",
                },
                {
                  no: "03",
                  titleKo: "다시 떠올리기",
                  titleEn: "Return",
                  bodyKo: "필요한 날짜와 시간에 생각을 다시 꺼내 보여줍니다.",
                  bodyEn: "Bring the thought back at the date and time it matters.",
                },
              ].map((item) => (
                <article key={item.no} className="marketing-manifesto-card rounded-[25px] border border-white/12 bg-white/[0.045] p-6">
                  <span className="text-[11px] font-black tracking-[.16em] text-primary">{item.no}</span>
                  <h3 className="mt-10 text-[26px] font-black tracking-[-.04em]">{t(item.titleKo, item.titleEn)}</h3>
                  <p className="mt-3 text-[14px] leading-[1.7] text-white/55">{t(item.bodyKo, item.bodyEn)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="marketing-how px-4 py-24 sm:py-32">
          <div className="mx-auto max-w-[1180px]">
            <span className="text-[10px] font-black uppercase tracking-[.18em] text-black/40">10-SECOND FLOW</span>
            <div className="mt-5 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <h2 className="max-w-[850px] text-[clamp(42px,7vw,72px)] font-black leading-[1] tracking-[-.06em]">
                {t("입력은 자유롭게. 확인은 필요한 만큼만.", "Free-form input. Minimal confirmation.")}
              </h2>
              <p className="max-w-[310px] text-[14px] leading-[1.7] text-black/48">
                {t("캘린더 설정 화면은 필요할 때만 열립니다. 기본 흐름은 한 문장, 한 번의 확인입니다.", "Detailed calendar controls stay out of the way until you actually need them.")}
              </p>
            </div>

            <div className="mt-14 grid gap-4 lg:grid-cols-3">
              {examples.map((example, index) => {
                const Icon = example.icon;
                return (
                  <article key={example.input} className="marketing-how-card flex min-h-[330px] flex-col rounded-[26px] border border-black/[0.08] bg-white p-6">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black tracking-[.15em] text-black/30">0{index + 1}</span>
                      <span className="grid h-11 w-11 place-items-center rounded-[15px] bg-[#f3f1e8]">
                        <Icon size={21} aria-hidden />
                      </span>
                    </div>
                    <h3 className="mt-8 text-[23px] font-black leading-[1.35] tracking-[-.04em]">“{example.input}”</h3>
                    <div className="mt-6 rounded-[16px] bg-primary/18 px-4 py-3.5 text-[14px] font-bold">{example.result}</div>
                    <p className="mt-auto pt-7 text-[13px] leading-[1.7] text-black/48">{example.note}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="marketing-audience px-4 pb-24 sm:pb-32">
          <div className="mx-auto max-w-[1180px] rounded-[32px] border border-black/[0.08] bg-primary px-6 py-10 sm:px-10 sm:py-14">
            <span className="text-[10px] font-black uppercase tracking-[.18em] text-black/45">MADE FOR REAL BRAINS</span>
            <h2 className="mt-4 max-w-[840px] text-[clamp(36px,6vw,60px)] font-black leading-[1.02] tracking-[-.055em]">
              {t("계획은 있는데, 입력하는 순간이 귀찮은 사람을 위해.", "For people with plans who hate entering plans.")}
            </h2>
            <div className="mt-8 flex flex-wrap gap-2.5">
              {[
                ["생각이 많아 자주 놓치는 사람", "People with too many thoughts"],
                ["캘린더 입력을 자꾸 미루는 사람", "People who postpone calendar entry"],
                ["말로 먼저 정리되는 사람", "People who think by speaking"],
                ["완벽한 계획보다 빠른 기록이 필요한 사람", "People who need fast capture, not perfect plans"],
              ].map(([ko, en]) => (
                <span key={en} className="rounded-full border border-black/12 bg-white/72 px-4 py-2.5 text-[12px] font-bold">
                  {t(ko, en)}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="marketing-trust bg-[#ece9df] px-4 py-24 sm:py-32">
          <div className="mx-auto max-w-[1180px]">
            <span className="text-[10px] font-black uppercase tracking-[.18em] text-black/40">BUILT FOR TRUST</span>
            <h2 className="mt-5 max-w-[850px] text-[clamp(40px,7vw,68px)] font-black leading-[1.02] tracking-[-.058em]">
              {t("기억을 맡기려면, 통제권이 보여야 합니다.", "A memory tool must make control visible.")}
            </h2>
            <div className="mt-12 grid gap-4 md:grid-cols-2">
              {[
                {
                  icon: ShieldCheck,
                  ko: "위험한 시간 추측 방지",
                  en: "No silent time assumptions",
                  bodyKo: "오전·오후, 주말 날짜, 퇴근 시간을 멋대로 확정하지 않습니다.",
                  bodyEn: "AM or PM, weekend day, and after-work time are confirmed instead of silently guessed.",
                },
                {
                  icon: Globe2,
                  ko: "사용자 시간대 기준",
                  en: "Your local time zone",
                  bodyKo: "기기 시간대를 기준으로 일정을 보여주고 변경 사항을 다시 확인합니다.",
                  bodyEn: "Schedules follow your device time zone and surface changes clearly.",
                },
                {
                  icon: Download,
                  ko: "데이터 내려받기·삭제",
                  en: "Export and delete your data",
                  bodyKo: "설정에서 저장된 데이터를 내려받고 기기 데이터나 계정을 삭제할 수 있습니다.",
                  bodyEn: "Download saved data and delete device data or your account from Settings.",
                },
                {
                  icon: Clock3,
                  ko: "중요 일정은 이중 확인",
                  en: "Critical plans need a backup",
                  bodyKo: "알림은 기기와 네트워크에 따라 누락될 수 있음을 숨기지 않습니다.",
                  bodyEn: "We clearly state that browser and network conditions can delay or prevent reminders.",
                },
              ].map(({ icon: Icon, ko, en, bodyKo, bodyEn }) => (
                <article key={en} className="marketing-trust-card rounded-[24px] border border-black/[0.07] bg-white/70 p-6 backdrop-blur">
                  <span className="grid h-12 w-12 place-items-center rounded-[16px] bg-primary/22">
                    <Icon size={23} aria-hidden />
                  </span>
                  <h3 className="mt-7 text-[22px] font-black tracking-[-.035em]">{t(ko, en)}</h3>
                  <p className="mt-3 max-w-[520px] text-[14px] leading-[1.72] text-black/52">{t(bodyKo, bodyEn)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="marketing-faq px-4 py-24 sm:py-32">
          <div className="mx-auto grid max-w-[1180px] gap-12 lg:grid-cols-[.72fr_1.28fr]">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[.18em] text-black/40">FAQ</span>
              <h2 className="mt-5 text-[clamp(40px,7vw,64px)] font-black leading-[1.02] tracking-[-.058em]">
                {t("시작하기 전에 궁금한 것들.", "What you may want to know first.")}
              </h2>
            </div>
            <div className="border-t border-black/15">
              {faq.map((item) => (
                <details key={item.q} className="group border-b border-black/[0.09]">
                  <summary className="flex min-h-[76px] cursor-pointer list-none items-center justify-between gap-5 py-4 text-[17px] font-black tracking-[-.025em] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-blue-600">
                    <span>{item.q}</span>
                    <span className="text-[24px] font-normal transition-transform group-open:rotate-45" aria-hidden>+</span>
                  </summary>
                  <p className="max-w-[680px] pb-7 pr-8 text-[14px] leading-[1.78] text-black/55">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="marketing-final-section px-4 pb-28">
          <div className="marketing-final-cta relative mx-auto max-w-[1180px] overflow-hidden rounded-[34px] border border-black/[0.08] bg-white px-6 py-16 text-center shadow-[0_26px_90px_rgba(28,25,13,.1)] sm:px-10 sm:py-20">
            <div className="marketing-final-orbit" aria-hidden />
            <ItjimaBrandMark size={56} className="relative mx-auto" />
            <h2 className="relative mx-auto mt-7 max-w-[860px] text-[clamp(42px,8vw,74px)] font-black leading-[0.98] tracking-[-.064em]">
              {t("지금 머릿속에 있는 것부터 던져보세요.", "Drop the thought in your head right now.")}
            </h2>
            <p className="relative mx-auto mt-5 max-w-[620px] text-[16px] leading-relaxed text-black/52">
              {t("설치도, 로그인도, 완벽한 문장도 필요 없습니다.", "No install, sign-in, or perfect sentence required.")}
            </p>
            <Link to="/" className="marketing-primary-cta relative mx-auto mt-8 inline-flex min-h-[58px] items-center justify-center gap-2 rounded-[18px] bg-primary px-8 text-[15px] font-black no-underline">
              {t("무료로 시작", "Start free")}
              <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="marketing-footer border-t border-black/[0.08] bg-white/70 px-4 py-10 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] flex-col justify-between gap-8 sm:flex-row sm:items-end">
          <div className="flex items-center gap-3">
            <ItjimaBrandMark size={42} />
            <div>
              <div className="font-display text-[18px] tracking-[0.07em]">ITJIMA</div>
              <p className="mt-1 text-[12px] text-black/45">{t(BRAND.taglineKo, BRAND.taglineEn)}</p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-bold" aria-label={t("법적 및 제품 링크", "Legal and product links")}> 
            <Link to="/">{t("앱 열기", "Open app")}</Link>
            <a href={BRAND.privacyUrl}>{t("개인정보", "Privacy")}</a>
            <a href={BRAND.termsUrl}>{t("약관", "Terms")}</a>
            <a href="https://github.com/seulkidesign-app/itjima" target="_blank" rel="noopener noreferrer">GitHub</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
