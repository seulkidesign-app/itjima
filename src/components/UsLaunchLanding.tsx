import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarCheck2,
  Check,
  Clock3,
  Download,
  Globe2,
  MessageSquareText,
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

const proofItems = [
  { ko: "설치 없이 시작", en: "Start without installing" },
  { ko: "로그인 전 사용 가능", en: "Try before signing in" },
  { ko: "한국어·영어", en: "English & Korean" },
  { ko: "데이터 export·삭제", en: "Export & delete your data" },
];

export function UsLaunchLanding() {
  const t = useT();
  const { lang } = useLang();

  const examples = useMemo(
    () => [
      {
        input: t("내일 오후 3시에 치과", "Dentist tomorrow at 3 PM"),
        result: t("내일 · 오후 3:00 · 치과", "Tomorrow · 3:00 PM · Dentist"),
        note: t("확실한 일정은 한 번에 추가", "Clear schedule → one-tap add"),
      },
      {
        input: t("주말에 수진이 만나기", "Meet Maya this weekend"),
        result: t("토요일  /  일요일", "Saturday  /  Sunday"),
        note: t("애매한 부분만 확인", "Ask only about what is ambiguous"),
      },
      {
        input: t("퇴근 후 장보기", "Buy groceries after work"),
        result: t("오후 6시  /  오후 7시", "6 PM  /  7 PM"),
        note: t("사용자 시간을 멋대로 단정하지 않음", "Never silently assume your time"),
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
      {
        q: t("비밀번호나 카드번호를 저장해도 되나요?", "Should I store passwords or card numbers?"),
        a: t(
          "아니요. 잊지마는 일정과 할 일을 위한 도구입니다. 비밀번호·결제정보·정부 식별번호 같은 비밀정보는 저장하지 마세요.",
          "No. Itjima is for schedules and tasks. Do not store passwords, payment details, government identifiers, or other secrets.",
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
        ? "Itjima | Natural-language schedule capture"
        : "잊지마 Itjima | 말하듯 남기는 일정 캡처",
      description: isEnglish
        ? "Say a plan naturally. Itjima fills what is clear, asks only about ambiguous date and time details, and turns it into a usable schedule."
        : "말하듯 일정을 남기면 확실한 정보는 채우고, 애매한 날짜와 시간만 확인해 일정으로 만듭니다.",
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
    <div className="min-h-dvh bg-[#fbfbf7] text-[#141410]">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-full bg-[#141410] px-4 py-2 text-sm font-bold text-white focus:translate-y-0"
      >
        {t("본문으로 이동", "Skip to content")}
      </a>

      <header className="sticky top-0 z-50 border-b border-black/[0.07] bg-[#fbfbf7]/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[68px] w-[min(1120px,calc(100%-32px))] items-center justify-between gap-4">
          <Link
            to="/about"
            className="flex min-h-11 items-center gap-2.5 no-underline"
            aria-label={t("잊지마 소개", "Itjima home")}
          >
            <span className="grid h-9 w-9 place-items-center rounded-[12px] bg-primary text-sm font-black">
              IJ
            </span>
            <span className="font-display text-[18px] uppercase tracking-wide">
              ITJIMA
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Link
              to="/"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#141410] px-4 text-[13px] font-bold text-white no-underline"
            >
              {t("앱 열기", "Open app")}
              <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className="px-4 pb-20 pt-16 sm:pt-24">
          <div className="mx-auto grid w-full max-w-[1120px] items-center gap-14 lg:grid-cols-[1.04fr_.96fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.13em]">
                <Sparkles size={14} aria-hidden />
                {t("자연어 일정 캡처 · Public beta", "Natural-language scheduling · Public beta")}
              </div>
              <h1 className="mt-7 max-w-[720px] text-[clamp(48px,9vw,82px)] font-black leading-[.98] tracking-[-.065em]">
                {t("말하듯 남기면,", "Say the plan.")}
                <br />
                <span className="relative inline-block">
                  <span className="relative z-10">
                    {t("일정이 됩니다.", "It becomes a schedule.")}
                  </span>
                  <span className="absolute bottom-[.06em] left-[-.02em] right-[-.04em] h-[.22em] -rotate-1 rounded-full bg-primary" aria-hidden />
                </span>
              </h1>
              <p className="mt-7 max-w-[650px] text-[17px] leading-[1.75] text-black/58 sm:text-[19px]">
                {t(
                  "날짜 선택부터 시작하지 마세요. 대충 말해도 괜찮아요. 잊지마가 확실한 일정 정보는 채우고, 위험한 추측이 필요한 부분만 묻습니다.",
                  "Do not start by filling calendar fields. Say it roughly. Itjima fills what is clear and asks only when a date or time would require a risky assumption.",
                )}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/"
                  className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[17px] bg-primary px-6 text-[15px] font-black no-underline shadow-[0_12px_30px_rgba(126,104,0,.14)]"
                >
                  {t("첫 일정 남기기", "Capture your first plan")}
                  <ArrowRight size={18} aria-hidden />
                </Link>
                <a
                  href="#how"
                  className="inline-flex min-h-[56px] items-center justify-center rounded-[17px] border border-black/[0.1] bg-white px-6 text-[15px] font-bold no-underline"
                >
                  {t("작동 방식 보기", "See how it works")}
                </a>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-10 rounded-full bg-primary/30 blur-3xl" aria-hidden />
              <div className="relative rounded-[28px] border border-black/[0.08] bg-white p-3 shadow-[0_28px_80px_rgba(20,20,16,.14)]">
                <div className="flex items-center justify-between border-b border-black/[0.06] px-3 py-3">
                  <div>
                    <div className="text-[10px] font-black tracking-[.16em] text-black/38">ITJIMA</div>
                    <div className="mt-1 text-[17px] font-black">{t("일정 남기기", "Capture")}</div>
                  </div>
                  <Globe2 size={20} className="text-black/35" aria-hidden />
                </div>
                <div className="space-y-4 p-3 pb-5 pt-6">
                  <div className="ml-auto max-w-[84%] rounded-[19px_19px_5px_19px] bg-primary px-4 py-3 text-[14px] font-bold leading-relaxed">
                    {t("내일 오후 3시에 치과", "Dentist tomorrow at 3 PM")}
                  </div>
                  <div className="max-w-[92%] rounded-[20px] border border-black/[0.08] bg-[#fafaf7] p-4">
                    <div className="text-[11px] font-bold text-black/42">
                      {t("이렇게 이해했어요", "Here's what I understood")}
                    </div>
                    <div className="mt-2 text-[17px] font-black">
                      {t("내일 · 오후 3:00 · 치과", "Tomorrow · 3:00 PM · Dentist")}
                    </div>
                    <p className="mt-2 text-[12px] leading-relaxed text-black/48">
                      {t(
                        "확실한 일정이에요. 한 번 누르면 추가됩니다.",
                        "The date and time are clear. Add it in one tap.",
                      )}
                    </p>
                    <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                      <span className="grid min-h-11 place-items-center rounded-full bg-primary px-4 text-[12px] font-black">
                        {t("일정에 추가", "Add to schedule")}
                      </span>
                      <span className="grid min-h-11 place-items-center rounded-full border border-black/[0.1] px-4 text-[12px] font-bold">
                        {t("수정", "Adjust")}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-black/[0.08] px-4 py-3 text-[13px] text-black/38">
                    {t("말하듯 일정을 남겨보세요…", "Say a plan naturally…")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-black/[0.07] bg-white px-4">
          <div className="mx-auto grid max-w-[1120px] sm:grid-cols-2 lg:grid-cols-4">
            {proofItems.map((item) => (
              <div key={item.en} className="flex min-h-[74px] items-center gap-2 border-b border-black/[0.06] px-3 text-[13px] font-bold last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
                <Check size={16} className="text-[#27834d]" aria-hidden />
                {t(item.ko, item.en)}
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="px-4 py-24">
          <div className="mx-auto max-w-[1120px]">
            <span className="text-[11px] font-black uppercase tracking-[.16em] text-black/42">HOW IT WORKS</span>
            <h2 className="mt-4 max-w-[820px] text-[clamp(38px,7vw,64px)] font-black leading-[1.04] tracking-[-.055em]">
              {t("입력은 자유롭게. 확인은 필요한 만큼만.", "Free-form input. Minimal confirmation.")}
            </h2>
            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              {examples.map((example, index) => (
                <article key={example.input} className="flex min-h-[300px] flex-col rounded-[24px] border border-black/[0.08] bg-white p-6">
                  <span className="text-[11px] font-black tracking-[.14em] text-black/35">0{index + 1}</span>
                  <MessageSquareText size={25} className="mt-8" aria-hidden />
                  <h3 className="mt-5 text-[21px] font-black tracking-[-.035em]">“{example.input}”</h3>
                  <div className="mt-5 rounded-[15px] bg-[#f6f6f1] px-4 py-3 text-[14px] font-bold">{example.result}</div>
                  <p className="mt-auto pt-6 text-[13px] leading-relaxed text-black/48">{example.note}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#171712] px-4 py-24 text-white">
          <div className="mx-auto max-w-[1120px]">
            <span className="text-[11px] font-black uppercase tracking-[.16em] text-white/45">BUILT FOR TRUST</span>
            <h2 className="mt-4 max-w-[800px] text-[clamp(38px,7vw,64px)] font-black leading-[1.04] tracking-[-.055em]">
              {t("일정을 맡기려면, 통제권이 보여야 합니다.", "A scheduling tool must make control visible.")}
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
                  bodyKo: "IANA 시간대를 저장하고, 잘못된 값은 서울이 아닌 UTC로 안전하게 처리합니다.",
                  bodyEn: "It stores the device's IANA time zone and safely falls back to UTC, never another user's region.",
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
                <article key={en} className="rounded-[23px] border border-white/12 bg-white/[0.045] p-6">
                  <Icon size={25} className="text-primary" aria-hidden />
                  <h3 className="mt-7 text-[22px] font-black tracking-[-.035em]">{t(ko, en)}</h3>
                  <p className="mt-3 max-w-[520px] text-[14px] leading-[1.7] text-white/58">{t(bodyKo, bodyEn)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-24">
          <div className="mx-auto grid max-w-[1120px] gap-12 lg:grid-cols-[.75fr_1.25fr]">
            <div>
              <span className="text-[11px] font-black uppercase tracking-[.16em] text-black/42">FAQ</span>
              <h2 className="mt-4 text-[clamp(38px,7vw,60px)] font-black leading-[1.04] tracking-[-.055em]">
                {t("출시 전에 답해야 할 질문들.", "Questions a launch-ready product should answer.")}
              </h2>
            </div>
            <div className="border-t border-black/15">
              {faq.map((item) => (
                <details key={item.q} className="group border-b border-black/[0.09]">
                  <summary className="flex min-h-[72px] cursor-pointer list-none items-center justify-between gap-5 py-4 text-[17px] font-black tracking-[-.025em] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-blue-600">
                    <span>{item.q}</span>
                    <span className="text-[24px] font-normal transition-transform group-open:rotate-45" aria-hidden>+</span>
                  </summary>
                  <p className="max-w-[680px] pb-6 pr-8 text-[14px] leading-[1.75] text-black/55">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-24">
          <div className="mx-auto max-w-[1120px] rounded-[30px] border border-black/[0.08] bg-white px-6 py-16 text-center shadow-[0_22px_70px_rgba(20,20,16,.08)] sm:px-10">
            <CalendarCheck2 size={34} className="mx-auto" aria-hidden />
            <h2 className="mx-auto mt-6 max-w-[780px] text-[clamp(40px,8vw,68px)] font-black leading-[1.02] tracking-[-.06em]">
              {t("지금 떠오른 일정 하나로 시작하세요.", "Start with the plan on your mind right now.")}
            </h2>
            <p className="mx-auto mt-5 max-w-[620px] text-[16px] leading-relaxed text-black/52">
              {t("설치도, 완벽한 문장도 필요 없습니다.", "No install. No perfect sentence required.")}
            </p>
            <Link to="/" className="mx-auto mt-8 inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[17px] bg-primary px-7 text-[15px] font-black no-underline">
              {t("무료로 시작", "Start free")}
              <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/[0.08] bg-white px-4 py-10">
        <div className="mx-auto flex max-w-[1120px] flex-col justify-between gap-8 sm:flex-row sm:items-end">
          <div>
            <div className="font-display text-[18px] tracking-wide">ITJIMA</div>
            <p className="mt-2 text-[13px] text-black/45">{t(BRAND.taglineKo, BRAND.taglineEn)}</p>
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
