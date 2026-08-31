import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, ChevronDown, Instagram, Linkedin, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { BRAND } from "@/lib/brand";
import { LanguageToggle, useT } from "@/lib/i18n";
import "@/ui-landing-v2.css";
import "@/ui-landing-v2-polish.css";

type Demo = {
  input: string;
  title: string;
  meta: string;
  badge: string;
  tone: "yellow" | "blue" | "paper";
};

const sectionEase = [0.22, 1, 0.36, 1] as const;

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 28 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.72, delay, ease: sectionEase }}
    >
      {children}
    </motion.div>
  );
}

function SectionRule({ label }: { label: string }) {
  return (
    <div className="lv2-rule" aria-hidden="true">
      <span className="lv2-rule-dot" />
      <span className="lv2-rule-label">{label}</span>
      <span className="lv2-rule-line" />
    </div>
  );
}

function PillLink({
  children,
  dark = false,
  className = "",
  ariaLabel,
}: {
  children: React.ReactNode;
  dark?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <Link
      to="/app"
      aria-label={ariaLabel}
      className={`lv2-pill ${dark ? "lv2-pill-dark" : ""} ${className}`}
    >
      <span>{children}</span>
      <ArrowRight size={15} strokeWidth={2.2} aria-hidden="true" />
    </Link>
  );
}

function HeroDemo({ demos }: { demos: Demo[] }) {
  const t = useT();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const active = demos[index];

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setIndex((value) => (value + 1) % demos.length), 3600);
    return () => window.clearInterval(id);
  }, [demos.length, reduced]);

  return (
    <div className="lv2-hero-stage">
      <div className="lv2-demo-main">
        <p className="lv2-demo-kicker">{t("오늘 무엇을 기억할까요?", "What do you want to remember today?")}</p>
        <div className="lv2-input-shell" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={active.input}
              initial={reduced ? false : { opacity: 0, y: 7, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduced ? undefined : { opacity: 0, y: -5, filter: "blur(4px)" }}
              transition={{ duration: 0.32 }}
              className="lv2-input-copy"
            >
              {active.input}
            </motion.span>
          </AnimatePresence>
          <span className="lv2-send" aria-hidden="true">↑</span>
        </div>

        <div className="lv2-demo-tabs" aria-label={t("데모 예시 선택", "Choose a demo example")}>
          {demos.map((demo, demoIndex) => (
            <button
              key={demo.input}
              type="button"
              className={demoIndex === index ? "is-active" : ""}
              aria-pressed={demoIndex === index}
              aria-label={t(`예시 ${demoIndex + 1}`, `Example ${demoIndex + 1}`)}
              onClick={() => setIndex(demoIndex)}
            >
              {demoIndex + 1}
            </button>
          ))}
        </div>

        <p className="lv2-result-kicker">{t("AI가 이해한 결과", "What AI understood")}</p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${active.title}-${active.meta}`}
            className={`lv2-parsed lv2-tone-${active.tone}`}
            initial={reduced ? false : { opacity: 0, scale: 0.985, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, scale: 0.99, y: -6 }}
            transition={{ duration: 0.36, ease: sectionEase }}
          >
            <strong>{active.title}</strong>
            <span>{active.meta}</span>
            <span className="lv2-result-badge">{active.badge}</span>
          </motion.div>
        </AnimatePresence>
      </div>

      <motion.aside
        className="lv2-micro-promise"
        whileHover={reduced ? undefined : { y: -6, rotate: -0.25 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
      >
        <span className="lv2-spark"><Sparkles size={18} aria-hidden="true" /></span>
        <h3>{t("한 문장만", "Just one sentence")}<br />{t("남기면 돼요.", "is enough.")}</h3>
        <p>{t("메모인지, 할 일인지,", "No need to decide whether it's a note,")}<br />{t("일정인지 먼저 고르지 않아요.", "a task, or a schedule first.")}</p>
        <PillLink ariaLabel={t("첫 기록 남기기", "Drop your first thought")}>{t("그냥 남기기", "Just drop it")}</PillLink>
      </motion.aside>
    </div>
  );
}

function WorkflowCard({ index, title, label, tone, rows }: { index: number; title: string; label: string; tone: string; rows: Array<[string, string]> }) {
  const reduced = useReducedMotion();
  return (
    <motion.article
      className={`lv2-work-card ${tone}`}
      initial={reduced ? false : { opacity: 0, y: 42, rotate: index === 1 ? 0 : index === 0 ? -1.4 : 1.4 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0, rotate: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.7, delay: index * 0.11, ease: sectionEase }}
      whileHover={reduced ? undefined : { y: -8 }}
    >
      <span className="lv2-step-number">0{index + 1}</span>
      <h3>{title}</h3>
      <p className="lv2-card-label">{label}</p>
      <div className="lv2-work-rows">
        {rows.map(([main, meta]) => (
          <div className="lv2-mini-row" key={`${main}-${meta}`}>
            <strong>{main}</strong>
            <span>{meta}</span>
          </div>
        ))}
      </div>
    </motion.article>
  );
}

function TrustDemo() {
  const t = useT();
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<"clear" | "ambiguous">("clear");
  const isClear = mode === "clear";

  return (
    <div className="lv2-trust-demo">
      <div className="lv2-trust-switch" role="group" aria-label={t("AI 판단 예시", "AI decision example")}>
        <button type="button" className={isClear ? "is-active" : ""} onClick={() => setMode("clear")}>{t("명확한 입력", "Clear input")}</button>
        <button type="button" className={!isClear ? "is-active" : ""} onClick={() => setMode("ambiguous")}>{t("애매한 입력", "Ambiguous input")}</button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          className="lv2-decision-panel"
          initial={reduced ? false : { opacity: 0, x: isClear ? -18 : 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduced ? undefined : { opacity: 0, x: isClear ? 12 : -12 }}
          transition={{ duration: 0.32, ease: sectionEase }}
        >
          <span className="lv2-decision-label">{t("입력", "Input")}</span>
          <div className="lv2-decision-input">
            <strong>{isClear ? t("내일 오후 3시 치과", "Dentist tomorrow at 3 PM") : t("내일 3시 치과", "Dentist tomorrow at 3")}</strong>
            <span>{isClear ? t("명확한 시간", "Clear time") : t("오전/오후가 애매함", "AM or PM is unclear")}</span>
          </div>

          <span className="lv2-decision-label">{t("잊지마의 판단", "Itjima's decision")}</span>
          <div className="lv2-decision-dark">
            <span className="lv2-decision-status">{isClear ? t("저장됨", "Saved") : t("확인 필요", "Needs confirmation")}</span>
            {isClear ? (
              <div className="lv2-confirmed-copy">
                <strong>{t("치과", "Dentist")}</strong>
                <span>{t("내일 · 오후 3:00", "Tomorrow · 3:00 PM")}</span>
              </div>
            ) : (
              <div className="lv2-clarify">
                <strong>{t("오전인가요, 오후인가요?", "Is that 3 AM or 3 PM?")}</strong>
                <div>
                  <button type="button">{t("오전 3시", "3 AM")}</button>
                  <button type="button" className="is-primary" onClick={() => setMode("clear")}>{t("오후 3시", "3 PM")}</button>
                  <button type="button">{t("시간 없이", "No time")}</button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ProductCard({ title, eyebrow, tone, children, delay = 0 }: { title: string; eyebrow: string; tone: string; children: React.ReactNode; delay?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.article
      className={`lv2-product-card ${tone}`}
      initial={reduced ? false : { opacity: 0, y: 36 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.66, delay, ease: sectionEase }}
      whileHover={reduced ? undefined : { y: -10, scale: 1.01 }}
    >
      <h3>{title}</h3>
      <p className="lv2-card-label">{eyebrow}</p>
      {children}
    </motion.article>
  );
}

function FinalMiniDemo() {
  const t = useT();
  const [value, setValue] = useState(() => t("퇴근하고 세탁소", "Dry cleaner after work"));
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setValue(t("퇴근하고 세탁소", "Dry cleaner after work"));
    setSubmitted(false);
  }, [t]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!value.trim()) return;
    setSubmitted(true);
  }

  return (
    <form className={`lv2-final-demo ${submitted ? "is-submitted" : ""}`} onSubmit={submit}>
      <label className="sr-only" htmlFor="lv2-final-input">{t("떠오른 문장 입력", "Enter a thought")}</label>
      <input
        id="lv2-final-input"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setSubmitted(false);
        }}
      />
      <button type="submit" aria-label={t("데모 입력 확인", "Submit demo input")}>↑</button>
      <AnimatePresence>
        {submitted && (
          <motion.span
            className="lv2-final-confirm"
            role="status"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            <Check size={15} aria-hidden="true" /> {t("이렇게 시작하면 돼요", "That's all it takes")}
          </motion.span>
        )}
      </AnimatePresence>
    </form>
  );
}

export function LandingV2() {
  const t = useT();
  const demos = useMemo<Demo[]>(
    () => [
      {
        input: t("내일 오후 3시 치과", "Dentist tomorrow at 3 PM"),
        title: t("치과", "Dentist"),
        meta: t("내일 · 오후 3:00", "Tomorrow · 3:00 PM"),
        badge: t("일정에서도 보여요", "Also shown in Schedule"),
        tone: "yellow",
      },
      {
        input: t("엄마 선물 알아보기", "Look for a gift for mom"),
        title: t("엄마 선물 알아보기", "Look for a gift for mom"),
        meta: t("날짜 없이 그대로", "Kept without a date"),
        badge: t("생각으로 남겨요", "Saved as a thought"),
        tone: "paper",
      },
      {
        input: t("금요일까지 포폴 수정", "Revise portfolio by Friday"),
        title: t("포트폴리오 수정", "Revise portfolio"),
        meta: t("할 일 · 금요일까지", "Task · by Friday"),
        badge: t("다가오면 다시 보여요", "Shown again as it approaches"),
        tone: "blue",
      },
    ],
    [t],
  );

  return (
    <div className="landing-v2" data-landing-version="2">
      <a className="lv2-skip" href="#lv2-main">{t("본문으로 이동", "Skip to content")}</a>

      <header className="lv2-nav-wrap">
        <nav className="lv2-nav" aria-label={t("랜딩 페이지", "Landing page")}>
          <a className="lv2-brand" href="#lv2-main" aria-label={t("잊지마 홈", "Itjima home")}><span className="lv2-brand-dot" />잊지마</a>
          <div className="lv2-nav-links">
            <a href="#how">{t("서비스 소개", "How it works")}</a>
            <a href="#trust">{t("작동 방식", "AI behavior")}</a>
            <a href="#why">{t("제품 원칙", "Product principles")}</a>
          </div>
          <div className="lv2-nav-actions">
            <LanguageToggle />
            <Link to="/app" className="lv2-nav-cta" aria-label={t("앱 열기", "Open app")}>{t("무료로 시작하기", "Start free")}</Link>
          </div>
        </nav>
      </header>

      <main id="lv2-main">
        <section className="lv2-hero">
          <div className="lv2-hero-glow lv2-glow-a" aria-hidden="true" />
          <div className="lv2-hero-glow lv2-glow-b" aria-hidden="true" />
          <Reveal className="lv2-hero-copy">
            <p className="lv2-eyebrow">{t("AI MEMORY INBOX · 살아있는 메모", "AI MEMORY INBOX · LIVING NOTES")}</p>
            <h1>{t("생각나는 대로 남기면,", "Drop thoughts as they come.")}<br /><span>{t("알아서 정리돼요.", "They organize themselves.")}</span></h1>
            <p className="lv2-lead">{t("메모·할 일·일정을 구분하지 말고 한 문장으로 남기세요. 잊지마가 날짜와 행동을 읽어 자동으로 구조화하고, 필요한 기록을 다시 보기 쉽게 정리해요.", "No need to separate notes, tasks, or schedules. Itjima reads dates and actions, structures what you wrote, and keeps it easy to revisit.")}</p>
            <div className="lv2-hero-cta-row">
              <PillLink dark ariaLabel={t("첫 기록 남기기", "Drop your first thought")}>{t("무료로 시작하기", "Start free")}</PillLink>
              <a className="lv2-secondary-pill" href="#how">{t("10초 데모 보기", "See the 10-second flow")} <ChevronDown size={15} aria-hidden="true" /></a>
            </div>
            <p className="lv2-no-setup">{t("자연어 기록 · 자동 구조화 · 다시 보기", "Natural capture · Auto-organize · Revisit")}</p>
          </Reveal>
          <Reveal className="lv2-hero-demo-wrap" delay={0.12}>
            <div id="demo"><HeroDemo demos={demos} /></div>
          </Reveal>
        </section>

        <section className="lv2-section lv2-how" id="how">
          <div className="lv2-container">
            <SectionRule label="HOW IT WORKS" />
            <Reveal className="lv2-centered-head">
              <h2>{t("남기기만 하세요.", "Just capture it.")}<br />{t("정리는 잊지마가.", "Itjima handles the structure.")}</h2>
              <p>{t("자연어로 남긴 기록을 일정·할 일·생각으로 이해해 한눈에 다시 볼 수 있게 정리해요.", "It interprets what you write as a schedule, task, or thought and keeps it organized for an easy revisit.")}</p>
            </Reveal>
            <div className="lv2-workflow">
              <WorkflowCard index={0} title={t("생각나는 대로 기록", "Capture naturally")} label="Natural capture" tone="paper" rows={[[t("금요일까지 포폴 수정", "Revise portfolio by Friday"), t("한 문장 그대로", "Kept as one sentence")], [t("엄마 선물 알아보기", "Look for a gift for mom"), t("날짜 없이 그대로", "Kept without a date")]]} />
              <WorkflowCard index={1} title={t("AI가 자동 구조화", "AI structures it")} label="Auto organize" tone="yellow" rows={[[t("포트폴리오 수정", "Revise portfolio"), t("할 일 · 금요일까지", "Task · by Friday")], [t("치과", "Dentist"), t("일정 · 내일 오후 3:00", "Schedule · tomorrow 3:00 PM")]]} />
              <WorkflowCard index={2} title={t("필요할 때 다시 보기", "Revisit when needed")} label="Revisit" tone="blue" rows={[[t("오늘 오후 3:00 · 치과", "Today 3:00 PM · Dentist"), t("오늘 필요한 것만", "Only what matters today")], [t("금요일까지 · 포폴 수정", "By Friday · Revise portfolio"), t("다가오는 할 일", "Upcoming task")]]} />
            </div>
          </div>
        </section>

        <section className="lv2-section lv2-trust" id="trust">
          <div className="lv2-container">
            <SectionRule label="TRUST BY DESIGN" />
            <div className="lv2-trust-grid">
              <Reveal><TrustDemo /></Reveal>
              <Reveal className="lv2-trust-copy" delay={0.08}>
                <p className="lv2-eyebrow dark">{t("AI가 멋대로 채우지 않도록", "Designed not to invent details")}</p>
                <h2>{t("확실하면 바로 저장하고,", "Clear things save right away.")}<br />{t("애매할 때만 물어봐요.", "Only ambiguity gets a question.")}</h2>
                <p>{t("임의의 시간을 만들어내지 않고, 문장 안의 단서만 읽고 필요한 확인만 요청합니다.", "It doesn't invent a time. It reads only the clues you gave and asks only for what is missing.")}</p>
                <div className="lv2-principles">
                  <div><span>01</span><strong>{t("확실한 건 바로 저장", "Save what's clear")}</strong><p>{t("이미 말한 내용을 다시 묻지 않아요.", "It doesn't ask you to repeat what you already said.")}</p></div>
                  <div><span>02</span><strong>{t("애매한 건 최소 확인", "Confirm only ambiguity")}</strong><p>{t("추측보다 한 번의 정확한 질문을 택해요.", "One precise question is better than a guess.")}</p></div>
                </div>
                <p className="lv2-trust-quote">{t("AI가 더 많이 묻는 게 아니라,", "Not AI that asks you for more—")}<br />{t("덜 귀찮게 정확해지는 방식.", "AI that gets accurate with less friction.")}</p>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="lv2-section lv2-why" id="why">
          <div className="lv2-container">
            <SectionRule label="WHY ITJIMA" />
            <div className="lv2-why-grid">
              <Reveal className="lv2-thought-collage">
                <p className="lv2-collage-title">{t("정리되지 않은 문장도", "Even an unorganized thought")}<br />{t("그대로 시작점이 돼요.", "can be the starting point.")}</p>
                <motion.div className="lv2-note note-a" whileHover={{ rotate: -2.5, y: -7 }}><strong>{t("엄마 생일 선물 뭐사지", "What should I get mom for her birthday?")}</strong><span>{t("날짜 없이 그대로 기록", "Saved without forcing a date")}</span></motion.div>
                <motion.div className="lv2-note note-b" whileHover={{ rotate: 3, y: -7 }}><strong>{t("내일 치과", "Dentist tomorrow")}<br />{t("아 맞다 3시", "oh right, 3 PM")}</strong></motion.div>
              </Reveal>
              <Reveal className="lv2-why-copy" delay={0.08}>
                <h2>{t("쌓아두는 메모보다,", "More than a pile of notes.")}<br />{t("다시 보기 쉬운 메모.", "Notes made easy to revisit.")}</h2>
                <p>{t("잊지마는 기록을 쌓는 데서 끝나지 않아요. 날짜와 행동을 읽어 일정·할 일·생각으로 구조화해 다시 찾기 쉽게 해요.", "Itjima doesn't stop at storing notes. It reads dates and actions, structures what you wrote, and makes it easier to find again.")}</p>
                <blockquote>{t("“아무렇게나 적어도 돼.", "“Write it however it comes.")}<br />{t("다시 찾기 쉽게 정리해둘게.”", "I'll keep it easy to find again.”")}</blockquote>
                <strong className="lv2-manifesto">{t("기록은 쌓여도, 관리할 일은 쌓이지 않게.", "Let records pile up—not maintenance work.")}</strong>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="lv2-section lv2-product" id="product">
          <div className="lv2-container">
            <SectionRule label="THE PRODUCT" />
            <Reveal className="lv2-product-head">
              <h2>{t("기록하면,", "Drop it in.")}<br />{t("필요한 곳에 정리돼요.", "It lands where it belongs.")}</h2>
              <p>{t("자연어 입력부터 일정·할 일 구조화, 오늘 확인과 가벼운 요약까지 하나의 기록 흐름으로 이어집니다.", "Natural capture, structured schedules and tasks, today's view, and lightweight summaries stay connected in one flow.")}</p>
            </Reveal>
            <div className="lv2-product-track">
              <ProductCard title={t("그냥 남기기", "Just drop it")} eyebrow={t("Capture · 자연어 기록", "Capture · natural language")} tone="paper">
                <div className="lv2-product-input"><strong>{t("엄마 선물 알아보기", "Look for a gift for mom")}</strong><span>{t("말하듯 아무렇게나 남겨보세요", "Write it the way you'd say it")}</span></div>
                <div className="lv2-mini-row"><strong>{t("금요일까지 포트폴리오 수정", "Revise portfolio by Friday")}</strong><span>{t("할 일 · 금요일까지", "Task · by Friday")}</span></div>
                <div className="lv2-mini-row"><strong>{t("제주도에서 가고 싶은 카페", "Cafes I want to visit in Jeju")}</strong><span>{t("생각 · 날짜 없이 그대로", "Thought · kept without a date")}</span></div>
              </ProductCard>
              <ProductCard title={t("오늘 보기", "Today")} eyebrow={t("Schedule · 필요한 일정", "Schedule · what matters now")} tone="blue" delay={0.08}>
                <div className="lv2-today"><span>{t("8월 29일 · 토요일", "August 29 · Saturday")}</span><strong>{t("오늘은 두 가지만 보면 돼요", "Only two things need your attention today")}</strong></div>
                <div className="lv2-event"><span>{t("오후 3:00", "3:00 PM")}</span><strong>{t("치과 예약", "Dentist appointment")}</strong><small>{t("출발 전에 한 번 확인", "One check before you leave")}</small></div>
                <div className="lv2-mini-row"><strong>{t("포트폴리오 수정", "Revise portfolio")}</strong><span>{t("금요일까지 · 할 일", "By Friday · task")}</span></div>
              </ProductCard>
              <ProductCard title={t("알아서 구조화", "Auto-organized")} eyebrow={t("Summary · 기록 한눈에 보기", "Summary · at a glance")} tone="yellow" delay={0.16}>
                <p className="lv2-summary-label">{t("지금 기록은 이렇게 보여요", "Here's what your records look like now")}</p>
                <div className="lv2-stats">
                  <div><span>{t("일정", "Schedule")}</span><strong>4</strong></div><div><span>{t("할 일", "Tasks")}</span><strong>3</strong></div>
                  <div><span>{t("생각", "Thoughts")}</span><strong>7</strong></div><div><span>{t("확인 필요", "Check")}</span><strong>2</strong></div>
                </div>
                <div className="lv2-summary-note"><strong>{t("직접 분류할 필요 없어요", "Nothing to sort yourself")}</strong><span>{t("남긴 기록을 한눈에 보기 쉽게 구조화해요.", "It keeps what you captured structured and easy to scan.")}</span></div>
              </ProductCard>
            </div>
          </div>
        </section>

        <section className="lv2-final">
          <div className="lv2-container lv2-final-inner">
            <Reveal className="lv2-centered-head">
              <p className="lv2-eyebrow">{t("살아있는 메모", "A LIVING MEMORY INBOX")}</p>
              <h2>{t("생각나는 대로", "Drop it while it's on your mind.")}<br />{t("잊지마에 남겨두세요.", "Leave the organizing to Itjima.")}</h2>
              <p>{t("메모인지 일정인지 고민하지 않아도, 남긴 문장을 알아서 구조화해요.", "No need to decide note versus schedule first. Itjima structures what you leave.")}</p>
              <div className="lv2-final-cta"><PillLink dark ariaLabel={t("첫 기록 남기기", "Drop your first thought")}>{t("무료로 시작하기", "Start free")}</PillLink></div>
              <FinalMiniDemo />
            </Reveal>
          </div>
        </section>
      </main>

      <section className="lv2-brand-band" aria-label={t("잊지마 브랜드", "Itjima brand")}>
        <div className="lv2-container lv2-brand-band-inner">
          <p className="lv2-brand-band-kicker">ITJIMA · AI MEMORY INBOX</p>
          <p className="lv2-brand-masthead">잊지마</p>
          <p className="lv2-brand-band-copy">
            {t("생각나는 대로 남기면, 알아서 구조화해 다시 보기 쉽게 정리되는 살아있는 메모.", "A living memory inbox that structures rough thoughts and keeps them easy to revisit.")}
          </p>
        </div>
      </section>

      <footer className="lv2-footer">
        <div className="lv2-container">
          <SectionRule label="ITJIMA" />
          <div className="lv2-footer-row">
            <strong>{t("자연어 한 문장으로 시작하는 AI 기록", "AI capture that starts with one natural sentence")}</strong>
            <div className="lv2-footer-links">
              <a href="#how">{t("서비스 소개", "How it works")}</a>
              <a href="#product">{t("주요 기능", "Product")}</a>
              <a href={BRAND.privacyUrl}>{t("개인정보", "Privacy")}</a>
              <a href={BRAND.termsUrl}>{t("약관", "Terms")}</a>
              <div className="lv2-social-links" aria-label={t("소셜 링크", "Social links")}>
                <a className="lv2-social-link" href={BRAND.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                  <Instagram size={15} aria-hidden="true" /><span>Instagram</span>
                </a>
                <a className="lv2-social-link" href={BRAND.linkedinUrl} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                  <Linkedin size={15} aria-hidden="true" /><span>LinkedIn</span>
                </a>
              </div>
            </div>
          </div>
          <p>© 2026 ITJIMA. {t("기록은 가볍게.", "Keep recording light.")}</p>
        </div>
      </footer>
    </div>
  );
}
