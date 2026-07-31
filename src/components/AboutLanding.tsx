import { Link } from "@tanstack/react-router";
import {
  Archive,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Instagram,
  MessageCircleMore,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { BRAND } from "@/lib/brand";
import { LanguageToggle, useT } from "@/lib/i18n";
import {
  applyLandingSeo,
  injectJsonLd,
  landingStructuredDataGraph,
  removeJsonLd,
} from "@/lib/seo";

export function AboutLanding() {
  const t = useT();

  const painPoints = [
    {
      kicker: t("01 · 저장", "01 · Save"),
      title: t("나에게 카톡을 보내고\n다시 못 찾습니다.", "You message yourself,\nthen never find it again."),
      body: t(
        "기록은 했지만, 필요한 순간에 돌아오지 않으면 사실상 사라진 것과 같습니다.",
        "A note that never returns when you need it is practically gone.",
      ),
    },
    {
      kicker: t("02 · 정리", "02 · Organize"),
      title: t("정리하려는 순간\n기록이 일이 됩니다.", "The moment you organize,\nnoting becomes work."),
      body: t(
        "폴더, 태그, 데이터베이스보다 먼저 필요한 건 생각을 놓치지 않는 것입니다.",
        "Before folders, tags, or databases, you need a way not to lose the thought.",
      ),
    },
    {
      kicker: t("03 · 기억", "03 · Remember"),
      title: t("알람은 울리지만\n생각은 이어지지 않습니다.", "Alarms ring,\nbut context disappears."),
      body: t(
        "잊지마는 단순히 시간을 알리는 대신, 남겨둔 생각을 다시 이어줍니다.",
        "Itjima does more than announce a time — it brings the thought back with context.",
      ),
    },
  ];

  const steps = [
    {
      number: "01",
      icon: MessageCircleMore,
      title: t("떠오르면 그냥 던지기", "Drop it as it comes"),
      body: t(
        "문장이어도, 단어 몇 개여도 괜찮아요. 정리하지 말고 먼저 남기세요.",
        "A sentence or a few rough words is enough. Capture first, organize later.",
      ),
    },
    {
      number: "02",
      icon: CalendarDays,
      title: t("나중에 정리하기", "Sort when you're ready"),
      body: t(
        "일정, 보관함, 그대로 두기 중에서 고르세요. 지금 결정하지 않아도 됩니다.",
        "Choose schedule, archive, or leave it. You do not have to decide right now.",
      ),
    },
    {
      number: "03",
      icon: Clock3,
      title: t("필요한 순간 다시 만나기", "Meet it again at the right time"),
      body: t(
        "지금 처리하지 않아도 됩니다. 나중의 내가 이어서 결정할 수 있게 남겨둡니다.",
        "You do not have to deal with it now. Leave enough context for your future self.",
      ),
    },
  ];

  const audience = [
    t("메모앱이 세 개 이상인 사람", "People with three or more note apps"),
    t("스크린샷을 메모처럼 쓰는 사람", "People who use screenshots as notes"),
    t("브라우저 탭을 닫지 못하는 사람", "People who never close browser tabs"),
    t("생각은 많은데 정리가 부담인 사람", "People with many thoughts and no appetite for organizing"),
    t('하루에 "아 맞다"를 세 번 이상 하는 사람', 'People who say “Oh right” three times a day'),
  ];

  const faq = useMemo(
    () => [
      {
        q: t("잊지마(Itjima)는 어떤 앱인가요?", "What is Itjima (잊지마)?"),
        a: t(
          "잊지마는 정리하기 전에 생각을 잊지 않게 해주는 기억 인박스입니다. 떠오르면 던지고, 필요할 때 일정이나 보관함으로 꺼낼 수 있어요.",
          "Itjima is a memory inbox that keeps thoughts safe before you organize them. Drop a thought now and resurface it to schedule or archive later.",
        ),
      },
      {
        q: t("메모앱이나 캘린더와 무엇이 다른가요?", "How is it different from notes or calendars?"),
        a: t(
          "처음부터 완벽하게 분류하거나 날짜를 정하지 않아도 됩니다. 카톡 나에게 보내기보다 빠르게 던지고, 캘린더보다 부담 없이 시작할 수 있어요.",
          "You do not need to classify everything or pick a date upfront. Faster than messaging yourself, lighter than a calendar.",
        ),
      },
      {
        q: t("앱을 설치해야 하나요?", "Do I need to install an app?"),
        a: t(
          "아니요. 브라우저에서 바로 사용할 수 있고, 원한다면 홈 화면에 추가해 앱처럼 사용할 수 있습니다.",
          "No. It works directly in your browser, and you can add it to your home screen if you want an app-like experience.",
        ),
      },
      {
        q: t("로그인하지 않아도 쓸 수 있나요?", "Can I use it without signing in?"),
        a: t(
          "네. 먼저 가볍게 사용해볼 수 있습니다. 로그인하면 여러 기기에서 데이터를 안전하게 이어서 사용할 수 있습니다.",
          "Yes. You can try it first without signing in. Signing in lets you continue safely across devices.",
        ),
      },
      {
        q: t("Itjima와 잊지마는 같은 서비스인가요?", "Are Itjima and 잊지마 the same service?"),
        a: t(
          "네. Itjima는 한국어 이름 ‘잊지마’를 로마자로 표기한 브랜드명입니다.",
          "Yes. Itjima is the romanized brand name of the Korean word 잊지마.",
        ),
      },
    ],
    [t],
  );

  useEffect(() => {
    applyLandingSeo();
    injectJsonLd(
      "ld-landing-graph",
      landingStructuredDataGraph(
        faq.map(({ q, a }) => ({ question: q, answer: a })),
      ),
    );

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");

    if (reduceMotion) {
      elements.forEach((element) => element.classList.add("is-visible"));
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -40px" },
      );
      elements.forEach((element) => observer.observe(element));
      return () => {
        observer.disconnect();
        removeJsonLd("ld-landing-graph");
      };
    }

    return () => removeJsonLd("ld-landing-graph");
  }, [faq]);

  return (
    <div className="about-v2">
      <style>{ABOUT_CSS}</style>

      <header className="site-header">
        <div className="header-inner">
          <Link to="/about" className="brand" aria-label={t("잊지마 소개 홈", "Itjima about home")}> 
            <span className="brand-mark" aria-hidden="true">잊</span>
            <span className="brand-name">Itjima <small>잊지마</small></span>
          </Link>
          <div className="header-actions">
            <LanguageToggle />
            <Link to="/" className="header-cta">
              <span>{t("앱 열기", "Open app")}</span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-grid">
            <div className="hero-copy" data-reveal>
              <div className="eyebrow-pill">
                <span className="status-dot" />
                {t("생각 인박스 · Early access", "Memory inbox · Early access")}
              </div>
              <h1>
                {t("정리하기 전에,", "Before you organize,")}
                <br />
                <span>{t("먼저 잊지 않게.", "remember first.")}</span>
              </h1>
              <p className="hero-description">
                {t(
                  "카톡 나에게 보내기 대신. 떠오른 생각을 던지면 잊지마(Itjima)가 일정과 보관함으로 다시 꺼내줍니다.",
                  "Instead of messaging yourself. Drop a thought, and Itjima brings it back to schedule or archive when you need it.",
                )}
              </p>
              <div className="hero-actions">
                <Link to="/" className="primary-button">
                  {t("첫 생각 던지기", "Drop your first thought")}
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <a href="#how" className="secondary-button">
                  {t("어떻게 작동하나요", "See how it works")}
                </a>
              </div>
              <div className="hero-meta" aria-label={t("서비스 특징", "Service highlights")}> 
                <span><Check size={14} />{t("설치 없이", "No install")}</span>
                <span><Check size={14} />{t("로그인 전에도", "Try before sign-in")}</span>
                <span><Check size={14} />{t("무료", "Free")}</span>
              </div>
            </div>

            <div className="product-stage" data-reveal>
              <div className="stage-glow" aria-hidden="true" />
              <div className="browser-card" aria-label={t("잊지마 앱 사용 예시", "Itjima app example")}> 
                <div className="browser-top">
                  <div className="browser-dots" aria-hidden="true"><span /><span /><span /></div>
                  <div className="browser-url">itjima.app</div>
                  <div className="browser-spacer" />
                </div>
                <div className="app-preview">
                  <div className="app-preview-nav">
                    <div>
                      <span className="preview-kicker">ITJIMA</span>
                      <strong>{t("생각", "Thoughts")}</strong>
                    </div>
                    <div className="preview-avatar">S</div>
                  </div>
                  <div className="preview-date">{t("오늘, 저녁 7:42", "Today, 7:42 PM")}</div>
                  <div className="thought-bubble">
                    {t(
                      "다음 주 수요일 치과 예약하고 엄마한테 전화하기",
                      "Book the dentist next Wednesday and call Mom",
                    )}
                  </div>
                  <div className="pending-card">
                    <div className="pending-head">
                      <span>{t("하나, 정리해 볼까요?", "Ready to sort one?")}</span>
                    </div>
                    <div className="pending-row">
                      <span className="row-icon calendar"><CalendarDays size={16} /></span>
                      <div>
                        <small>{t("일정", "Schedule")}</small>
                        <strong>{t("다음 주 수요일 · 치과", "Next Wed · Dentist")}</strong>
                      </div>
                    </div>
                    <div className="pending-row">
                      <span className="row-icon archive"><Archive size={16} /></span>
                      <div>
                        <small>{t("보관함", "Archive")}</small>
                        <strong>{t("엄마에게 전화하기", "Call Mom")}</strong>
                      </div>
                    </div>
                    <div className="preview-buttons">
                      <button type="button">{t("정리하기", "Sort")}</button>
                      <button type="button" className="quiet">{t("그냥 둘게요", "Leave it")}</button>
                    </div>
                  </div>
                  <div className="composer-preview">
                    <span>{t("생각나는 대로 적어보세요", "Type whatever comes to mind")}</span>
                    <span className="send-preview"><ArrowRight size={17} /></span>
                  </div>
                </div>
              </div>
              <div className="floating-note note-one"><Archive size={15} />{t("원본은 그대로", "Original preserved")}</div>
              <div className="floating-note note-two"><Clock3 size={15} />{t("나중에 다시", "Resurface later")}</div>
            </div>
          </div>
        </section>

        <section className="comparison-strip" aria-label={t("잊지마의 특징", "Why Itjima")}> 
          <div>{t("카톡 나에게 보내기보다", "Faster than messaging yourself")} <strong>{t("빠르게", "capture")}</strong></div>
          <div>{t("캘린더보다", "Lighter than a calendar")} <strong>{t("부담 없이", "to start")}</strong></div>
          <div>{t("노션보다", "Simpler than Notion")} <strong>{t("가볍게", "to keep")}</strong></div>
        </section>

        <section className="section before-after-section" aria-label={t("Before / After", "Before / After")}>
          <div className="section-heading" data-reveal>
            <span className="section-label">BEFORE / AFTER</span>
            <h2>{t("기록은 했는데,\n왜 다시 못 찾을까요?", "You saved it.\nWhy can't you find it?")}</h2>
          </div>
          <div className="before-after-grid" data-reveal>
            <article className="before-after-card before">
              <span>{t("Before", "Before")}</span>
              <strong>{t("카톡 나에게", "Message yourself")}</strong>
              <p>{t("기록은 했지만, 필요할 때 다시 못 찾음", "Saved, but lost when you need it")}</p>
            </article>
            <article className="before-after-card after">
              <span>{t("After", "After")}</span>
              <strong>{t("잊지마", "Itjima")}</strong>
              <p>{t("던지면, 필요할 때 일정·보관함으로 다시", "Drop it — resurface to schedule or archive")}</p>
            </article>
          </div>
        </section>

        <section className="section pain-section">
          <div className="section-heading" data-reveal>
            <span className="section-label">THE PROBLEM</span>
            <h2>{t("기록은 많아졌는데,\n왜 더 자주 잊을까요?", "More notes,\nyet more things forgotten.")}</h2>
            <p>{t("문제는 기록의 양이 아니라, 다시 만나는 방식에 있습니다.", "The problem is not how much you save, but how it finds you again.")}</p>
          </div>
          <div className="pain-grid">
            {painPoints.map((item, index) => (
              <article className="pain-card" data-reveal key={item.kicker} style={{ transitionDelay: `${index * 80}ms` }}>
                <span>{item.kicker}</span>
                <h3>{item.title.split("\n").map((line) => <span key={line}>{line}</span>)}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className="section how-section">
          <div className="section-heading light" data-reveal>
            <span className="section-label">HOW IT WORKS</span>
            <h2>{t("생각이 떠오른 순간부터,\n다시 필요한 순간까지.", "From the moment it appears\nto the moment you need it.")}</h2>
          </div>
          <div className="steps-grid">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <article className="step-card" data-reveal key={step.number} style={{ transitionDelay: `${index * 90}ms` }}>
                  <div className="step-top"><span>{step.number}</span><Icon size={22} /></div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="section feature-section">
          <div className="section-heading" data-reveal>
            <span className="section-label">DESIGNED FOR LESS EFFORT</span>
            <h2>{t("정리를 잘하는 사람이 아니라,\n생각이 많은 사람을 위해.", "Not for perfect organizers.\nFor people with busy minds.")}</h2>
          </div>
          <div className="bento-grid">
            <article className="bento-card bento-large" data-reveal>
              <div className="bento-icon"><MessageCircleMore size={22} /></div>
              <span className="bento-label">CAPTURE</span>
              <h3>{t("입력창 하나면 충분해요.", "One input is enough.")}</h3>
              <p>{t("폴더를 고르거나 태그를 붙이지 않아도 됩니다. 머릿속 언어 그대로 남기세요.", "No folders or tags before you begin. Use the language already in your head.")}</p>
              <div className="mini-composer"><span>{t("여행 가기 전에…", "Before the trip…")}</span><ArrowRight size={17} /></div>
            </article>
            <article className="bento-card" data-reveal>
              <div className="bento-icon yellow"><CalendarDays size={22} /></div>
              <span className="bento-label">SORT</span>
              <h3>{t("나중에 정리해도 돼요.", "Sort when you're ready.")}</h3>
              <p>{t("일정, 보관함, 그대로 두기. 지금 결정하지 않아도 됩니다.", "Schedule, archive, or leave it. No decision required now.")}</p>
            </article>
            <article className="bento-card" data-reveal>
              <div className="bento-icon blue"><Clock3 size={22} /></div>
              <span className="bento-label">REDISCOVERY</span>
              <h3>{t("기억은 다시 보여야 의미가 있어요.", "Memory matters when it returns.")}</h3>
              <p>{t("쌓아두는 보관함이 아니라, 다시 발견하는 경험을 만듭니다.", "Not a storage pile — an experience of rediscovery.")}</p>
            </article>
            <article className="bento-card bento-wide" data-reveal>
              <div>
                <div className="bento-icon ink"><Archive size={22} /></div>
                <span className="bento-label">YOUR WORDS, INTACT</span>
                <h3>{t("원본은 바꾸지 않습니다.", "Your original stays yours.")}</h3>
                <p>{t("정리는 제안일 뿐입니다. 처음 남긴 생각은 언제든 그대로 확인할 수 있어요.", "Sorting is only a suggestion. Your first words remain available exactly as you wrote them.")}</p>
              </div>
              <div className="original-card">
                <small>{t("내가 남긴 원본", "Your original")}</small>
                <strong>{t("그 전시 링크 나중에 다시 보기", "Look at that exhibition link later")}</strong>
                <span>{t("방금 전", "Just now")}</span>
              </div>
            </article>
          </div>
        </section>

        <section className="manifesto-section">
          <div className="manifesto-inner" data-reveal>
            <span className="section-label">ITJIMA PRINCIPLE</span>
            <blockquote>
              {t("기억하려고 애쓰지 마세요.", "Stop trying so hard to remember.")}
              <br />
              <em>{t("기억할 수 있는 환경을 만드세요.", "Build an environment that remembers for you.")}</em>
            </blockquote>
          </div>
        </section>

        <section className="section audience-section">
          <div className="section-heading" data-reveal>
            <span className="section-label">SOUND LIKE YOU?</span>
            <h2>{t("하나라도 해당되면,\n잊지마를 써볼 이유가 있습니다.", "If one sounds familiar,\nItjima may be for you.")}</h2>
          </div>
          <div className="audience-list" data-reveal>
            {audience.map((item, index) => (
              <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong><Check size={18} /></div>
            ))}
          </div>
        </section>

        <section className="section faq-section">
          <div className="faq-layout">
            <div className="faq-heading" data-reveal>
              <span className="section-label">FAQ</span>
              <h2>{t("궁금한 것만\n빠르게 확인하세요.", "The essentials,\nanswered quickly.")}</h2>
              <Link to="/" className="text-link">{t("직접 써보기", "Try it yourself")}<ArrowRight size={16} /></Link>
            </div>
            <div className="faq-list">
              {faq.map((item, index) => (
                <details key={item.q} className="faq-item" data-reveal open={index === 0}>
                  <summary><span>{item.q}</span><span className="faq-plus" aria-hidden="true">+</span></summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="final-cta-section">
          <div className="final-cta" data-reveal>
            <span className="final-kicker">YOUR MIND CAN LET GO</span>
            <h2>{t("지금 머릿속에 있는 것부터\n하나만 던져보세요.", "Start with the one thing\non your mind right now.")}</h2>
            <p>{t("정리는 나중에 해도 괜찮아요.", "You can organize later.")}</p>
            <Link to="/" className="primary-button large">{t("첫 생각 던지기", "Drop your first thought")}<ArrowRight size={19} /></Link>
          </div>
        </section>

        <section className="legal-section" aria-label={t("법적 고지", "Legal information")}> 
          <div>
            <h2 id="privacy">{t("개인정보 처리방침", "Privacy policy")}</h2>
            <p>{t("잊지마(Itjima)는 생각·일정·보관 데이터를 서비스 제공 목적으로만 처리합니다. 계정 이메일은 로그인과 피드백 회신에만 사용합니다.", "Itjima processes thoughts, schedules, and archive data only to provide the service. Account email is used only for sign-in and feedback replies.")}</p>
          </div>
          <div>
            <h2 id="terms">{t("이용약관", "Terms of use")}</h2>
            <p>{t("서비스는 베타로 제공되며 기능은 변경될 수 있습니다. 중요한 일정은 앱과 별도로 한 번 더 확인해 주세요.", "The service is provided in beta and features may change. Please verify critical schedules independently.")}</p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-main">
          <div>
            <div className="brand footer-brand"><span className="brand-mark">잊</span><span className="brand-name">Itjima <small>잊지마</small></span></div>
            <p>{t("정리 전, 기억부터.", "Remember before you organize.")}</p>
          </div>
          <div className="footer-links">
            <Link to="/">{t("앱 열기", "Open app")}</Link>
            <Link to="/about">{t("소개", "About")}</Link>
            <a href="#privacy">{t("개인정보", "Privacy")}</a>
            <a href="#terms">{t("약관", "Terms")}</a>
            <a href={BRAND.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Instagram size={18} /></a>
          </div>
        </div>
        <div className="footer-bottom"><span>© 2026 Itjima (잊지마)</span><span>Made for busy minds.</span></div>
      </footer>
    </div>
  );
}

const ABOUT_CSS = `
.about-v2{
  --ink:#111111;
  --ink-soft:#9a9a90;
  --paper:#ffffff;
  --paper-strong:#f5f5f3;
  --white:#ffffff;
  --yellow:#ffd43b;
  --yellow-soft:#fff6c8;
  --blue:#e8f2ff;
  --line:rgba(17,17,17,.08);
  --ease-out:cubic-bezier(0.22,1,0.36,1);
  --ease-in-out:cubic-bezier(0.65,0,0.35,1);
  --dur-fast:140ms;
  --dur-base:240ms;
  --dur-slow:360ms;
  --press-scale:0.96;
  min-height:100dvh;
  overflow-x:hidden;
  background:
    radial-gradient(120% 80% at 10% -10%,rgba(255,212,59,.18),transparent 55%),
    radial-gradient(90% 60% at 100% 0%,rgba(232,242,255,.55),transparent 50%),
    var(--paper);
  color:var(--ink);
  font-family:'Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  -webkit-font-smoothing:antialiased;
  padding-top:env(safe-area-inset-top);
}
.about-v2 *{box-sizing:border-box}
.about-v2 a{color:inherit}
.about-v2 button,.about-v2 a{-webkit-tap-highlight-color:transparent}
.about-v2 [data-reveal]{opacity:0;transform:translateY(8px);transition:opacity var(--dur-slow) var(--ease-out),transform var(--dur-slow) var(--ease-out)}
.about-v2 [data-reveal].is-visible{opacity:1;transform:none}
.about-v2 .site-header{position:sticky;top:0;z-index:50;border-bottom:1px solid var(--line);background:rgba(255,255,255,.88);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);padding-top:env(safe-area-inset-top)}
.about-v2 .header-inner{width:min(1180px,calc(100% - 32px));height:72px;margin:0 auto;display:flex;align-items:center;justify-content:space-between}
.about-v2 .brand{display:inline-flex;align-items:center;gap:10px;text-decoration:none;min-height:44px}
.about-v2 .brand-mark{display:grid;place-items:center;width:35px;height:35px;border-radius:11px;background:var(--yellow);font-size:16px;font-weight:900}
.about-v2 .brand-name{font-size:18px;font-weight:900;letter-spacing:-.04em;line-height:1}
.about-v2 .brand-name small{display:block;margin-top:5px;color:var(--ink-soft);font-size:10px;font-weight:700;letter-spacing:.08em}
.about-v2 .header-actions{display:flex;align-items:center;gap:8px}
.about-v2 .header-cta{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:44px;padding:0 16px;border-radius:999px;background:var(--ink);color:white;text-decoration:none;font-size:13px;font-weight:800;transition:transform var(--dur-fast) var(--ease-out),background var(--dur-base) var(--ease-out),opacity var(--dur-fast) var(--ease-out)}
.about-v2 .header-cta:active{transform:scale(var(--press-scale))}
.about-v2 .header-cta:hover{background:#000}
.about-v2 .hero-section{position:relative;padding:72px 0 66px}
.about-v2 .hero-grid{width:min(1180px,calc(100% - 32px));margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr);gap:54px;align-items:center}
.about-v2 .hero-copy{text-align:left}
.about-v2 .eyebrow-pill{display:inline-flex;align-items:center;gap:8px;margin-bottom:25px;padding:8px 12px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.85);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.about-v2 .status-dot{width:7px;height:7px;border-radius:50%;background:#37a766;box-shadow:0 0 0 4px rgba(55,167,102,.12)}
.about-v2 h1{margin:0;font-size:clamp(50px,14vw,78px);font-weight:900;line-height:.98;letter-spacing:-.065em}
.about-v2 h1 span{display:inline-block;position:relative;z-index:0}
.about-v2 h1 span:after{content:'';position:absolute;z-index:-1;left:-.03em;right:-.08em;bottom:.05em;height:.24em;border-radius:99px;background:var(--yellow);transform:rotate(-1deg)}
.about-v2 .hero-description{max-width:620px;margin:27px 0 0;color:var(--ink-soft);font-size:17px;font-weight:520;line-height:1.7;letter-spacing:-.02em}
.about-v2 .hero-actions{display:flex;flex-direction:column;gap:10px;margin-top:30px}
.about-v2 .primary-button,.about-v2 .secondary-button{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:54px;padding:0 24px;border-radius:20px;text-decoration:none;font-size:15px;font-weight:850;transition:transform var(--dur-fast) var(--ease-out),box-shadow var(--dur-base) var(--ease-out),opacity var(--dur-fast) var(--ease-out)}
.about-v2 .primary-button{background:var(--yellow);border:none;box-shadow:0 4px 20px rgba(255,212,59,.35)}
.about-v2 .primary-button:active,.about-v2 .secondary-button:active{transform:scale(var(--press-scale))}
.about-v2 .secondary-button{border:1px solid var(--line);background:var(--white)}
.about-v2 .hero-meta{display:flex;flex-wrap:wrap;gap:10px 17px;margin-top:23px;color:var(--ink-soft);font-size:12px;font-weight:700}
.about-v2 .hero-meta span{display:inline-flex;align-items:center;gap:5px}
.about-v2 .hero-meta svg{color:#25844d}
.about-v2 .product-stage{position:relative;isolation:isolate;min-height:545px;display:grid;place-items:center}
.about-v2 .stage-glow{position:absolute;z-index:-1;width:88%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,var(--yellow-soft),rgba(255,243,168,0) 68%);filter:blur(8px)}
.about-v2 .browser-card{width:min(100%,520px);overflow:hidden;border:1px solid var(--line);border-radius:25px;background:var(--white);box-shadow:0 24px 64px rgba(17,17,17,.12);transform:rotate(.6deg)}
.about-v2 .browser-top{height:45px;display:grid;grid-template-columns:70px 1fr 70px;align-items:center;padding:0 13px;border-bottom:1px solid var(--line);background:var(--paper-strong)}
.about-v2 .browser-dots{display:flex;gap:5px}.about-v2 .browser-dots span{width:8px;height:8px;border-radius:50%;background:#c1beb4}.about-v2 .browser-dots span:first-child{background:#ff806d}.about-v2 .browser-dots span:nth-child(2){background:#f7c94b}.about-v2 .browser-dots span:nth-child(3){background:#65c56f}
.about-v2 .browser-url{justify-self:center;width:min(100%,185px);padding:6px 12px;border:1px solid rgba(0,0,0,.07);border-radius:8px;background:rgba(255,255,255,.75);color:#77736a;text-align:center;font-size:10px;font-weight:700}
.about-v2 .app-preview{position:relative;min-height:480px;padding:24px 20px 20px;background:linear-gradient(180deg,#ffffff 0%,#fafafa 100%)}
.about-v2 .app-preview-nav{display:flex;align-items:center;justify-content:space-between}.about-v2 .app-preview-nav>div:first-child{display:flex;flex-direction:column;gap:3px}.about-v2 .preview-kicker{font-size:9px;font-weight:900;letter-spacing:.18em;color:#a09c91}.about-v2 .app-preview-nav strong{font-size:21px;letter-spacing:-.04em}.about-v2 .preview-avatar{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--ink);color:white;font-size:12px;font-weight:850}
.about-v2 .preview-date{margin:22px 0 9px;text-align:center;color:#aaa69d;font-size:9px;font-weight:700}
.about-v2 .thought-bubble{max-width:82%;margin-left:auto;padding:12px 15px;border-radius:17px 17px 4px 17px;background:var(--yellow);font-size:12px;font-weight:750;line-height:1.45;box-shadow:0 6px 20px rgba(102,88,0,.09)}
.about-v2 .pending-card{margin-top:14px;padding:16px;border:1px solid var(--line);border-radius:18px;background:white;box-shadow:0 10px 30px rgba(17,17,17,.06)}
.about-v2 .pending-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:13px;font-size:11px;font-weight:850}
.about-v2 .pending-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--line)}.about-v2 .row-icon{display:grid;place-items:center;width:31px;height:31px;border-radius:10px}.about-v2 .row-icon.calendar{background:var(--yellow-soft)}.about-v2 .row-icon.archive{background:#e8f8ec}.about-v2 .pending-row div{display:flex;flex-direction:column;gap:3px}.about-v2 .pending-row small{color:var(--ink-soft);font-size:8px;font-weight:750}.about-v2 .pending-row strong{font-size:10px;letter-spacing:-.01em}
.about-v2 .preview-buttons{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:12px}.about-v2 .preview-buttons button{height:34px;border:none;border-radius:10px;background:var(--yellow);font:inherit;font-size:9px;font-weight:850}.about-v2 .preview-buttons button.quiet{border:1px solid var(--line);background:white;color:var(--ink-soft)}
.about-v2 .composer-preview{position:absolute;left:20px;right:20px;bottom:18px;height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 9px 0 15px;border:1px solid var(--line);border-radius:16px;background:white;color:#aaa69d;font-size:10px;font-weight:650;box-shadow:0 7px 20px rgba(23,23,19,.05)}.about-v2 .send-preview{display:grid;place-items:center;width:32px;height:32px;border-radius:11px;background:var(--ink);color:white}
.about-v2 .floating-note{position:absolute;z-index:3;display:flex;align-items:center;gap:7px;padding:10px 12px;border:1px solid var(--line);border-radius:11px;background:var(--white);font-size:10px;font-weight:850;box-shadow:0 8px 24px rgba(17,17,17,.08)}.about-v2 .note-one{left:-3px;top:95px;transform:rotate(-5deg)}.about-v2 .note-two{right:-2px;bottom:82px;transform:rotate(4deg);background:var(--yellow-soft)}
.about-v2 .comparison-strip{width:min(1180px,calc(100% - 32px));margin:0 auto 48px;display:grid;border:1px solid var(--line);border-radius:18px;overflow:hidden;background:var(--white)}
.about-v2 .before-after-section{padding-top:0;padding-bottom:80px}
.about-v2 .before-after-grid{display:grid;gap:12px}
.about-v2 .before-after-card{padding:24px;border:1px solid var(--line);border-radius:20px;background:var(--white)}
.about-v2 .before-after-card>span{display:block;margin-bottom:12px;color:var(--ink-soft);font-size:10px;font-weight:900;letter-spacing:.14em}
.about-v2 .before-after-card strong{display:block;margin-bottom:10px;font-size:22px;font-weight:900;letter-spacing:-.03em}
.about-v2 .before-after-card p{margin:0;color:var(--ink-soft);font-size:14px;line-height:1.6}
.about-v2 .before-after-card.after{border-color:rgba(255,212,59,.55);background:linear-gradient(180deg,#fffef8 0%,#ffffff 100%)}
.about-v2 .comparison-strip div{padding:18px 20px;border-bottom:1px solid var(--line);color:var(--ink-soft);font-size:13px;text-align:center}.about-v2 .comparison-strip div:last-child{border-bottom:0}.about-v2 .comparison-strip strong{color:var(--ink)}
.about-v2 .section{width:min(1180px,calc(100% - 32px));margin:0 auto;padding:100px 0}
.about-v2 .section-heading{max-width:780px;margin-bottom:46px}.about-v2 .section-label{display:block;margin-bottom:16px;color:#7d796f;font-size:10px;font-weight:900;letter-spacing:.18em}.about-v2 .section-heading h2,.about-v2 .faq-heading h2{margin:0;font-size:clamp(36px,9vw,64px);font-weight:900;line-height:1.05;letter-spacing:-.055em;white-space:pre-line}.about-v2 .section-heading p{margin:20px 0 0;color:var(--ink-soft);font-size:16px;line-height:1.7}
.about-v2 .pain-grid{display:grid;gap:12px}.about-v2 .pain-card{min-height:300px;display:flex;flex-direction:column;padding:24px;border:1px solid var(--line);border-radius:22px;background:var(--white);transition:transform var(--dur-base) var(--ease-out),opacity var(--dur-base) var(--ease-out)}.about-v2 .pain-card:active{transform:scale(var(--press-scale))}.about-v2 .pain-card>span{color:#8f8a7f;font-size:10px;font-weight:900;letter-spacing:.15em}.about-v2 .pain-card h3{margin:42px 0 18px;font-size:27px;font-weight:900;line-height:1.15;letter-spacing:-.045em}.about-v2 .pain-card h3 span{display:block}.about-v2 .pain-card p{margin:auto 0 0;color:var(--ink-soft);font-size:14px;line-height:1.65}
.about-v2 .how-section{width:100%;max-width:none;padding:105px max(16px,calc((100% - 1180px)/2));background:var(--ink);color:white}.about-v2 .section-heading.light .section-label{color:#b8b5ab}.about-v2 .steps-grid{display:grid;gap:12px}.about-v2 .step-card{min-height:315px;padding:24px;border:1px solid rgba(255,255,255,.16);border-radius:22px;background:#22221d}.about-v2 .step-top{display:flex;align-items:center;justify-content:space-between;color:var(--yellow)}.about-v2 .step-top>span{font-size:11px;font-weight:900;letter-spacing:.15em}.about-v2 .step-card h3{margin:92px 0 14px;font-size:25px;font-weight:850;letter-spacing:-.04em}.about-v2 .step-card p{margin:0;color:#bebbb1;font-size:14px;line-height:1.7}
.about-v2 .bento-grid{display:grid;gap:12px}.about-v2 .bento-card{position:relative;overflow:hidden;min-height:285px;padding:25px;border:1px solid var(--line);border-radius:23px;background:var(--white)}.about-v2 .bento-large{background:var(--yellow-soft)}.about-v2 .bento-wide{display:grid;gap:24px;background:#e9f3ff}.about-v2 .bento-icon{display:grid;place-items:center;width:44px;height:44px;margin-bottom:36px;border-radius:14px;background:white}.about-v2 .bento-icon.yellow{background:var(--yellow)}.about-v2 .bento-icon.blue{background:var(--blue)}.about-v2 .bento-icon.ink{background:var(--ink);color:white}.about-v2 .bento-label{font-size:9px;font-weight:900;letter-spacing:.16em;color:#827e73}.about-v2 .bento-card h3{margin:10px 0 12px;font-size:27px;font-weight:900;letter-spacing:-.045em}.about-v2 .bento-card p{max-width:500px;margin:0;color:var(--ink-soft);font-size:14px;line-height:1.7}.about-v2 .mini-composer{display:flex;align-items:center;justify-content:space-between;margin-top:28px;padding:16px;border:1px solid rgba(23,23,19,.15);border-radius:14px;background:rgba(255,255,255,.65);color:#8f8a7f;font-size:12px;font-weight:700}.about-v2 .original-card{align-self:end;padding:18px;border:1px solid rgba(23,23,19,.12);border-radius:17px;background:white;box-shadow:0 12px 30px rgba(58,83,112,.08)}.about-v2 .original-card>*{display:block}.about-v2 .original-card small{color:#8b94a0;font-size:9px;font-weight:800}.about-v2 .original-card strong{margin:9px 0 16px;font-size:14px}.about-v2 .original-card span{color:#9da4ac;font-size:9px}
.about-v2 .manifesto-section{padding:120px 16px;background:var(--yellow)}.about-v2 .manifesto-inner{width:min(1000px,100%);margin:0 auto;text-align:center}.about-v2 .manifesto-section .section-label{color:rgba(23,23,19,.55)}.about-v2 blockquote{margin:0;font-size:clamp(38px,10vw,76px);font-weight:900;line-height:1.08;letter-spacing:-.06em}.about-v2 blockquote em{font-style:normal;text-decoration:underline;text-decoration-thickness:.08em;text-underline-offset:.12em}
.about-v2 .audience-list{border-top:1px solid var(--ink)}.about-v2 .audience-list div{display:grid;grid-template-columns:42px 1fr 24px;align-items:center;gap:8px;padding:19px 4px;border-bottom:1px solid var(--line)}.about-v2 .audience-list span{color:#918d83;font-size:10px;font-weight:850}.about-v2 .audience-list strong{font-size:16px;letter-spacing:-.02em}.about-v2 .audience-list svg{color:#25844d}
.about-v2 .faq-layout{display:grid;gap:48px}.about-v2 .faq-heading h2{white-space:pre-line}.about-v2 .text-link{display:inline-flex;align-items:center;gap:7px;margin-top:24px;font-size:14px;font-weight:850}.about-v2 .faq-list{border-top:1px solid var(--ink)}.about-v2 .faq-item{border-bottom:1px solid var(--line)}.about-v2 .faq-item summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:24px 0;cursor:pointer;font-size:17px;font-weight:850;letter-spacing:-.025em;min-height:44px;transition:opacity var(--dur-fast) var(--ease-out)}.about-v2 .faq-item summary::-webkit-details-marker{display:none}.about-v2 .faq-item summary:active{opacity:.72}.about-v2 .faq-plus{font-size:25px;font-weight:400;transition:transform var(--dur-base) var(--ease-out)}.about-v2 .faq-item[open] .faq-plus{transform:rotate(45deg)}.about-v2 .faq-item p{margin:0;padding:0 36px 24px 0;color:var(--ink-soft);font-size:14px;line-height:1.75}
.about-v2 .final-cta-section{padding:34px 16px 100px}.about-v2 .final-cta{width:min(1180px,100%);margin:0 auto;padding:60px 24px;border:1px solid var(--line);border-radius:28px;background:var(--white);text-align:center;box-shadow:0 20px 60px rgba(17,17,17,.08)}.about-v2 .final-kicker{color:#878378;font-size:10px;font-weight:900;letter-spacing:.18em}.about-v2 .final-cta h2{margin:18px 0;font-size:clamp(38px,10vw,70px);font-weight:900;line-height:1.03;letter-spacing:-.06em;white-space:pre-line}.about-v2 .final-cta p{margin:0 0 28px;color:var(--ink-soft);font-size:16px}.about-v2 .primary-button.large{min-height:58px;padding:0 27px}
.about-v2 .legal-section{width:min(1180px,calc(100% - 32px));margin:0 auto;padding:20px 0 70px;display:grid;gap:26px;color:#7d796f}.about-v2 .legal-section h2{margin:0 0 8px;color:var(--ink);font-size:13px}.about-v2 .legal-section p{margin:0;font-size:11px;line-height:1.65}
.about-v2 .site-footer{border-top:1px solid var(--line);padding:45px max(16px,calc((100% - 1180px)/2)) calc(34px + env(safe-area-inset-bottom));background:var(--white)}.about-v2 .footer-main{display:flex;flex-direction:column;gap:30px}.about-v2 .footer-brand{pointer-events:none}.about-v2 .footer-main p{margin:15px 0 0;color:var(--ink-soft);font-size:13px;font-weight:650}.about-v2 .footer-links{display:flex;flex-wrap:wrap;align-items:center;gap:17px}.about-v2 .footer-links a{color:var(--ink-soft);font-size:12px;font-weight:750;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}.about-v2 .footer-bottom{display:flex;flex-direction:column;gap:6px;margin-top:40px;padding-top:20px;border-top:1px solid var(--line);color:#928e84;font-size:10px}
@media (min-width:640px){
  .about-v2 .hero-actions{flex-direction:row}.about-v2 .primary-button,.about-v2 .secondary-button{width:auto}.about-v2 .comparison-strip{grid-template-columns:repeat(3,1fr)}.about-v2 .comparison-strip div{border-right:1px solid var(--line);border-bottom:0}.about-v2 .comparison-strip div:last-child{border-right:0}.about-v2 .before-after-grid{grid-template-columns:repeat(2,1fr)}.about-v2 .pain-grid,.about-v2 .steps-grid{grid-template-columns:repeat(3,1fr)}.about-v2 .pain-card{padding:28px}.about-v2 .bento-grid{grid-template-columns:repeat(2,1fr)}.about-v2 .bento-large{grid-row:span 2}.about-v2 .bento-wide{grid-column:1/-1;grid-template-columns:1.15fr .85fr}.about-v2 .legal-section{grid-template-columns:repeat(2,1fr)}.about-v2 .footer-main,.about-v2 .footer-bottom{flex-direction:row;justify-content:space-between;align-items:flex-start}.about-v2 .footer-bottom{align-items:center}
}
@media (min-width:900px){
  .about-v2 .header-inner{height:82px}.about-v2 .hero-section{padding:92px 0 78px}.about-v2 .hero-grid{grid-template-columns:minmax(0,.92fr) minmax(460px,1.08fr);gap:70px}.about-v2 h1{font-size:clamp(68px,7vw,96px)}.about-v2 .product-stage{min-height:610px}.about-v2 .browser-card{width:500px}.about-v2 .section{padding:130px 0}.about-v2 .pain-grid,.about-v2 .steps-grid{gap:16px}.about-v2 .pain-card{min-height:390px;padding:32px}.about-v2 .pain-card h3{margin-top:75px;font-size:30px}.about-v2 .step-card{min-height:370px;padding:30px}.about-v2 .step-card h3{margin-top:130px;font-size:28px}.about-v2 .bento-card{padding:32px;min-height:330px}.about-v2 .bento-large{min-height:672px}.about-v2 .bento-wide{min-height:300px}.about-v2 .faq-layout{grid-template-columns:.72fr 1.28fr;gap:100px}.about-v2 .faq-heading{position:sticky;top:120px;align-self:start}.about-v2 .final-cta{padding:95px 40px}.about-v2 .legal-section{padding-bottom:90px}
}
@media (max-width:520px){
  .about-v2 .header-inner{width:min(100% - 24px,1180px)}.about-v2 .header-cta{width:43px;padding:0}.about-v2 .header-cta span{display:none}.about-v2 .hero-grid,.about-v2 .section,.about-v2 .comparison-strip,.about-v2 .legal-section{width:calc(100% - 24px)}.about-v2 .hero-section{padding-top:50px}.about-v2 .hero-description{font-size:15px}.about-v2 .product-stage{min-height:480px}.about-v2 .browser-card{width:calc(100% - 14px);box-shadow:0 16px 40px rgba(17,17,17,.1)}.about-v2 .app-preview{min-height:415px;padding:20px 16px}.about-v2 .composer-preview{left:16px;right:16px}.about-v2 .floating-note{font-size:9px}.about-v2 .note-one{left:0;top:62px}.about-v2 .note-two{right:0;bottom:40px}.about-v2 .section{padding:86px 0}.about-v2 .section-heading{margin-bottom:35px}.about-v2 .comparison-strip{margin-bottom:40px}.about-v2 .pain-card{min-height:270px}.about-v2 .how-section{padding-top:86px;padding-bottom:86px}.about-v2 .manifesto-section{padding:88px 16px}.about-v2 .final-cta-section{padding-bottom:80px}.about-v2 .final-cta{padding:54px 18px;border-radius:22px}
}
@media (prefers-reduced-motion:reduce){.about-v2 *{scroll-behavior:auto!important}.about-v2 [data-reveal]{opacity:1;transform:none;transition:opacity var(--dur-fast) ease}.about-v2 .primary-button,.about-v2 .secondary-button,.about-v2 .header-cta,.about-v2 .pain-card{transition:opacity var(--dur-fast) ease}.about-v2 .primary-button:active,.about-v2 .secondary-button:active,.about-v2 .header-cta:active,.about-v2 .pain-card:active{transform:none}}
`;
