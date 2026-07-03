import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useT, LanguageToggle } from "@/lib/i18n";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  const t = useT();

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const STORY = useMemo(
    () => [
      {
        line: t(
          '아침에 일어나자마자 "아 맞다" 한 번.',
          'Wake up and immediately think "Oh right."',
        ),
        cap: "",
      },
      {
        line: t(
          "나에게 카톡 보내고 나중에 못 찾음.",
          "Message yourself on KakaoTalk and never find it again.",
        ),
        cap: t(
          "카카오톡 나에게 보내기는 훌륭한 메모앱입니다. 찾기 전까지는.",
          "Save to self works great — until you need to find it.",
        ),
      },
      {
        line: t(
          "노션 새 페이지 열고 3초 만에 닫음.",
          "Open a new Notion page and close it in three seconds.",
        ),
        cap: t(
          "빈 페이지는 생각보다 무겁습니다.",
          "A blank page is heavier than it looks.",
        ),
      },
      {
        line: t(
          "알람 27개 설정. 전부 무시함.",
          "Set 27 alarms. Ignore all of them.",
        ),
        cap: t(
          "이미 알고 있었죠. 알람은 끄려고 보는 거라는 걸.",
          "You already knew — alarms are for dismissing.",
        ),
      },
      {
        line: t(
          "자기 전에 갑자기 할 일 8개가 생각남.",
          "Eight to-dos appear right before bed.",
        ),
        cap: t(
          "뇌는 당신이 쉬려는 순간을 좋아합니다.",
          "Your brain loves the moment you try to rest.",
        ),
      },
    ],
    [t],
  );

  const ME = useMemo(
    () => [
      t("메모앱이 세 개 이상인 사람", "Someone with three or more note apps"),
      t(
        "브라우저 탭이 항상 20개 넘는 사람",
        "Someone who always has 20+ browser tabs open",
      ),
      t(
        "스크린샷이 사실상 메모장인 사람",
        "Someone whose camera roll is basically a notebook",
      ),
      t(
        "링크 저장해두고 한 번도 안 본 사람",
        "Someone who saves links and never opens them",
      ),
      t(
        "벼락치기가 가장 생산적인 사람",
        "Someone who works best at the last minute",
      ),
      t(
        "생각은 많은데 시작이 어려운 사람",
        "Someone with plenty of thoughts but a hard time starting",
      ),
      t(
        '"아 맞다"를 하루 세 번 이상 하는 사람',
        'Someone who says "Oh right" at least three times a day',
      ),
    ],
    [t],
  );

  const HOW = useMemo(
    () => [
      {
        n: "01",
        t: t("떠오르면 그냥 던진다.", "Drop it the moment it appears."),
        d: t(
          "카테고리 없음. 태그 없음. 생각 날 때 0.5초 안에 기록하는 게 전부입니다.",
          "No categories. No tags. Just capture it in half a second.",
        ),
      },
      {
        n: "02",
        t: t("스와이프로 0.5초 결정.", "Swipe to decide in half a second."),
        d: t(
          "오른쪽 = 그때. 왼쪽 = 기억함. 틴더처럼. 그게 전부입니다.",
          "Right = when. Left = saved. Like swiping cards. That's it.",
        ),
      },
      {
        n: "03",
        t: t("그때가 되면 다시 떠올린다.", "When the time comes, it resurfaces."),
        d: t(
          "앱을 열어두면 그때 알려드려요. 조용히, 부담 없이.",
          "Keep the app open and we'll remind you then — quietly, without pressure.",
        ),
      },
    ],
    [t],
  );

  const PHIL = useMemo(
    () => [
      {
        n: "01",
        t: t(
          "정리하려 하지 마세요. 일단 버리세요.",
          "Don't organize. Just offload.",
        ),
      },
      {
        n: "02",
        t: t(
          "완벽한 메모 필요 없습니다. 대충 써도 됩니다.",
          "Perfect notes aren't required. Messy is fine.",
        ),
      },
      {
        n: "03",
        t: t(
          "분류는 제안일 뿐. 결정은 당신 몫.",
          "Suggestions only — you stay in control.",
        ),
      },
      {
        n: "04",
        t: t(
          "팝업 알림 없습니다. 필요할 때만 조용히.",
          "No popup alerts. Only quiet nudges when it matters.",
        ),
      },
    ],
    [t],
  );

  return (
    <div className="landing">
      <style>{LANDING_CSS}</style>

      <div className="blobs" aria-hidden>
        <div className="blob blob-y" />
        <div className="blob blob-s" />
        <div className="blob blob-y2" />
      </div>

      <nav className="lnav">
        <Link to="/about" className="lnav-logo">
          It<span>Jima.</span>
        </Link>
        <div className="lnav-right">
          <LanguageToggle />
          <Link to="/" className="lnav-cta">
            {t("앱 열기 →", "Open app →")}
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="badge reveal">{t("생각함 · Beta", "Mental Inbox · Beta")}</div>
        <h1 className="reveal" style={{ transitionDelay: "70ms" }}>
          {t("기억하지 말고", "Don't memorize.")}
          <br />
          <span className="hl">{t("맡겨라.", "Offload it.")}</span>
        </h1>
        <p className="hero-sub reveal" style={{ transitionDelay: "140ms" }}>
          {t(
            "머릿속이 복잡한 건 의지력 문제가 아닙니다.",
            "A cluttered mind isn't a willpower problem.",
          )}
          <br />
          {t(
            "그냥 뇌가 저장공간이 아닌 거예요.",
            "Your brain just isn't built for storage.",
          )}
        </p>
        <div className="hero-btns reveal" style={{ transitionDelay: "210ms" }}>
          <Link to="/" className="btn-yellow">
            {t("지금 던지러 가기 →", "Drop a thought now →")}
          </Link>
          <a href="#me" className="btn-ghost">
            {t("이거 나인데?", "That's me")}
          </a>
        </div>
        <div className="micro reveal" style={{ transitionDelay: "280ms" }}>
          {t("무료 · 설치 없음 · 30초면 시작", "Free · no install · 30 seconds to start")}
        </div>
      </section>

      <div className="rule" />

      {/* STORY */}
      <section className="sec">
        <div className="eyebrow reveal">{t("당신의 하루", "Your day")}</div>
        <div className="story">
          {STORY.map((s, i) => (
            <div key={i}>
              <div
                className="story-item reveal"
                style={{ transitionDelay: `${i * 70}ms` }}
              >
                <div className="story-line">{s.line}</div>
                {s.cap && <div className="story-cap">{s.cap}</div>}
              </div>
              {i < STORY.length - 1 && <div className="rule thin" />}
            </div>
          ))}
        </div>
      </section>

      <div className="rule" />

      {/* ME */}
      <section id="me" className="sec">
        <div className="eyebrow reveal">{t("혹시 이런 사람?", "Sound like you?")}</div>
        <ul className="me-list">
          {ME.map((m, i) => (
            <li
              key={i}
              className="me-item reveal"
              style={{ transitionDelay: `${i * 70}ms` }}
            >
              <span className="me-tag">{t("나인데", "Me")}</span>
              <span className="me-text">{m}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="rule" />

      {/* QUOTE */}
      <section className="sec quote-sec">
        <h2 className="quote reveal">
          {t("당신 머릿속은", "Your head isn't")}
          <br />
          <span className="hl">{t("꽉 찬 게 아니라", "full —")}</span>
          <br />
          {t("그냥 안 비운 거예요.", "it just hasn't been emptied.")}
        </h2>
        <p className="quote-sub reveal" style={{ transitionDelay: "140ms" }}>
          {t(
            "ItJima는 뇌의 저장공간 문제를 해결합니다.",
            "ItJima solves the storage problem in your head.",
          )}
          <br />
          {t(
            "메모앱도, 일정관리 앱도 아닌 — 기억 외주 서비스.",
            "Not a notes app, not a planner — memory outsourcing.",
          )}
        </p>
      </section>

      <div className="rule" />

      {/* HOW */}
      <section className="sec">
        <div className="eyebrow reveal">{t("어떻게 쓰나요", "How it works")}</div>
        <div className="how">
          {HOW.map((h, i) => (
            <div key={h.n}>
              <div
                className="how-item reveal"
                style={{ transitionDelay: `${i * 70}ms` }}
              >
                <div className="how-n">{t("Step", "Step")} {h.n}</div>
                <div className="how-t">{h.t}</div>
                <div className="how-d">{h.d}</div>
              </div>
              {i < HOW.length - 1 && <div className="rule thin" />}
            </div>
          ))}
        </div>
      </section>

      <div className="rule" />

      {/* PHILOSOPHY */}
      <section className="sec">
        <div className="eyebrow reveal">{t("ItJima 철학", "ItJima philosophy")}</div>
        <div className="phil">
          {PHIL.map((p, i) => (
            <div key={p.n}>
              <div
                className="phil-item reveal"
                style={{ transitionDelay: `${i * 70}ms` }}
              >
                <span className="phil-n">{p.n}</span>
                <span className="phil-sep">—</span>
                <span className="phil-t">{p.t}</span>
              </div>
              {i < PHIL.length - 1 && <div className="rule thin" />}
            </div>
          ))}
        </div>
      </section>

      <div className="rule" />

      {/* FINAL CTA */}
      <section className="sec cta">
        <h2 className="cta-h reveal">
          {t("지금 머릿속에", "There's something")}
          <br />
          {t("맴도는 거", "on your mind")}
          <br />
          <span className="hl">{t("있잖아요.", "right now.")}</span>
        </h2>
        <p className="cta-sub reveal" style={{ transitionDelay: "140ms" }}>
          {t("그거 지금 던지세요. 30초면 됩니다.", "Drop it here. Thirty seconds.")}
        </p>
        <Link
          to="/"
          className="btn-yellow big reveal"
          style={{ transitionDelay: "210ms" }}
        >
          {t("뇌 비우러 가기 →", "Empty your head →")}
        </Link>
        <div className="micro reveal" style={{ transitionDelay: "280ms" }}>
          {t(
            "무료 · 로그인 없이도 사용 가능 · 설치 없음",
            "Free · works without signing in · no install",
          )}
        </div>
      </section>

      <footer className="lfoot">
        <div className="lfoot-logo">
          ItJima<span className="hl-dot">.</span>
        </div>
        <div className="lfoot-tag">{t("기억하지 말고 맡겨라.", "Don't memorize. Offload it.")}</div>
        <div className="lfoot-cp">© 2026 ItJima</div>
      </footer>
    </div>
  );
}

const LANDING_CSS = `
.landing{
  --yellow:#FFE033;
  --ink:#0A0A0A;
  --muted:#444;
  --soft:#999;
  --line:#E8E8E8;
  font-family:'Pretendard',-apple-system,'Helvetica Neue',sans-serif;
  background:#FFFFFF;
  color:var(--ink);
  position:relative;
  min-height:100vh;
  overflow-x:hidden;
  -webkit-font-smoothing:antialiased;
}
.landing *{box-sizing:border-box}

.landing .blobs{position:fixed; inset:0; z-index:0; pointer-events:none; overflow:hidden}
.landing .blob{position:absolute; border-radius:50%; filter:blur(90px); opacity:0.55}
.landing .blob-y{width:480px;height:480px;background:#FFE033;top:-120px;left:-100px;animation:floatA 12s ease-in-out infinite}
.landing .blob-s{width:560px;height:560px;background:#9CD6FF;bottom:-180px;right:-140px;animation:floatB 18s ease-in-out infinite}
.landing .blob-y2{width:360px;height:360px;background:#FFE033;top:45%;left:55%;opacity:0.35;animation:floatC 22s ease-in-out infinite}
@keyframes floatA{0%,100%{transform:translate(0,0)}50%{transform:translate(40px,60px)}}
@keyframes floatB{0%,100%{transform:translate(0,0)}50%{transform:translate(-60px,-40px)}}
@keyframes floatC{0%,100%{transform:translate(0,0)}50%{transform:translate(-50px,50px)}}

.landing .lnav{
  position:sticky; top:0; z-index:10;
  padding:16px 22px;
  display:flex; align-items:center; justify-content:space-between;
  background:rgba(255,255,255,0.85);
  backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
  border-bottom:1px solid var(--line);
}
.landing .lnav-logo{font-size:17px;font-weight:900;letter-spacing:-0.02em;color:var(--ink);text-decoration:none}
.landing .lnav-logo span{color:var(--ink)}
.landing .lnav-right{display:flex; align-items:center; gap:10px}
.landing .lnav-cta{
  background:var(--ink); color:#fff;
  border-radius:999px; padding:9px 18px; font-size:13px; font-weight:700;
  text-decoration:none;
}

.landing section{
  position:relative; z-index:1;
  max-width:720px; margin:0 auto;
  padding:96px 24px;
  text-align:center;
}
.landing .hero{padding-top:80px; padding-bottom:96px}
.landing .badge{
  display:inline-block;
  border:1.5px solid var(--ink);
  border-radius:999px; padding:6px 14px;
  font-size:12px; font-weight:700; color:var(--ink);
  margin-bottom:28px;
  background:transparent;
}
.landing h1{
  font-size:clamp(44px,8vw,72px);
  font-weight:900; letter-spacing:-0.04em;
  line-height:1.02; color:var(--ink);
  margin:0 0 22px;
}
.landing .hl{
  background:linear-gradient(transparent 60%, var(--yellow) 60%);
  padding:0 0.05em;
}
.landing .hl-dot{color:var(--yellow)}
.landing .hero-sub{
  font-size:clamp(15px,2.4vw,17px); color:var(--muted);
  line-height:1.65; margin:0 0 32px; font-weight:500;
}
.landing .hero-btns{display:flex; gap:10px; justify-content:center; flex-wrap:wrap}
.landing .btn-yellow{
  background:var(--yellow); color:var(--ink);
  border-radius:999px; padding:15px 28px;
  font-size:15px; font-weight:800; letter-spacing:-0.01em;
  text-decoration:none; display:inline-block;
  transition:transform .15s ease;
}
.landing .btn-yellow:hover{transform:translateY(-2px)}
.landing .btn-yellow.big{padding:18px 36px; font-size:16px; margin-top:8px}
.landing .btn-ghost{
  background:transparent; color:var(--ink);
  border:1.5px solid var(--ink);
  border-radius:999px; padding:13.5px 26px;
  font-size:15px; font-weight:700;
  text-decoration:none; display:inline-block;
}
.landing .micro{margin-top:18px; font-size:12px; color:var(--soft)}

.landing .rule{height:1px; background:var(--line); width:100%; max-width:none; margin:0}
.landing .rule.thin{max-width:720px; margin:0 auto; opacity:0.7}

.landing .eyebrow{
  font-size:11px; font-weight:800; letter-spacing:0.18em;
  text-transform:uppercase; color:var(--ink);
  margin-bottom:40px; opacity:0.6;
}

.landing .story{display:flex; flex-direction:column; gap:0}
.landing .story-item{padding:32px 0; text-align:center}
.landing .story-line{
  font-size:clamp(22px,4vw,34px);
  font-weight:700; letter-spacing:-0.03em;
  line-height:1.3; color:var(--ink);
}
.landing .story-cap{
  margin-top:12px; font-size:14px; color:var(--soft);
  line-height:1.55;
}

.landing .me-list{list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:14px}
.landing .me-item{
  display:flex; align-items:center; gap:14px;
  padding:14px 18px;
  border:1px solid var(--line); border-radius:16px;
  background:#fff;
  text-align:left;
}
.landing .me-tag{
  background:var(--yellow); color:var(--ink);
  font-size:12px; font-weight:800;
  padding:5px 11px; border-radius:999px;
  flex-shrink:0;
}
.landing .me-text{
  font-size:clamp(15px,2.2vw,17px); font-weight:600; color:var(--ink);
}

.landing .quote-sec{padding:120px 24px}
.landing .quote{
  font-size:clamp(32px,6.5vw,56px);
  font-weight:900; letter-spacing:-0.04em;
  line-height:1.12; color:var(--ink); margin:0 0 28px;
}
.landing .quote-sub{
  font-size:clamp(14px,2.2vw,16px); color:var(--muted);
  line-height:1.65; margin:0; font-weight:500;
}

.landing .how-item{padding:36px 0; text-align:center}
.landing .how-n{
  font-size:12px; font-weight:800; letter-spacing:0.18em;
  text-transform:uppercase; color:var(--soft);
  margin-bottom:10px;
}
.landing .how-t{
  font-size:clamp(22px,3.6vw,30px);
  font-weight:800; letter-spacing:-0.03em;
  color:var(--ink); margin-bottom:10px;
}
.landing .how-d{
  font-size:15px; color:var(--muted); line-height:1.65; font-weight:500;
  max-width:480px; margin:0 auto;
}

.landing .phil-item{
  padding:28px 0;
  display:flex; align-items:baseline; gap:14px; justify-content:center;
  flex-wrap:wrap;
}
.landing .phil-n{
  font-size:clamp(20px,3vw,26px); font-weight:900;
  color:var(--ink); letter-spacing:-0.02em;
}
.landing .phil-sep{color:var(--soft); font-weight:400}
.landing .phil-t{
  font-size:clamp(17px,2.6vw,22px); font-weight:700;
  color:var(--ink); letter-spacing:-0.02em;
}

.landing .cta{padding:120px 24px}
.landing .cta-h{
  font-size:clamp(36px,7vw,64px);
  font-weight:900; letter-spacing:-0.04em;
  line-height:1.08; color:var(--ink); margin:0 0 22px;
}
.landing .cta-sub{
  font-size:clamp(15px,2.2vw,17px); color:var(--muted);
  line-height:1.6; margin:0 0 32px; font-weight:500;
}

.landing .lfoot{
  position:relative; z-index:1;
  text-align:center; padding:48px 22px 80px;
  font-size:13px; color:var(--soft);
  border-top:1px solid var(--line);
  line-height:1.7;
}
.landing .lfoot-logo{font-size:20px; font-weight:900; color:var(--ink); margin-bottom:8px; letter-spacing:-0.02em}
.landing .lfoot-tag{color:var(--muted); font-weight:600; margin-bottom:14px}
.landing .lfoot-cp{font-size:12px; color:var(--soft)}

.landing .reveal{opacity:0; transform:translateY(20px); transition:opacity .6s ease, transform .6s ease}
.landing .reveal.in{opacity:1; transform:translateY(0)}

@media (max-width:520px){
  .landing section{padding:72px 22px}
  .landing .hero{padding-top:56px}
  .landing .quote-sec, .landing .cta{padding:88px 22px}
}
`;
