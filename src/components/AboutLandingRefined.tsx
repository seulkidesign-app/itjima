import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { AboutLanding } from "@/components/AboutLanding";

export function AboutLandingRefined() {
  const t = useT();
  const [hasScrolled, setHasScrolled] = useState(false);
  const [finalCtaVisible, setFinalCtaVisible] = useState(false);

  useEffect(() => {
    const previewButtons = document.querySelectorAll<HTMLButtonElement>(
      ".about-v2 .preview-buttons button",
    );

    previewButtons.forEach((button) => {
      button.tabIndex = -1;
      button.setAttribute("aria-hidden", "true");
    });

    const onScroll = () => setHasScrolled(window.scrollY > 460);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const finalCta = document.querySelector<HTMLElement>(
      ".about-v2 .final-cta-section",
    );
    const observer = finalCta
      ? new IntersectionObserver(
          ([entry]) => setFinalCtaVisible(entry.isIntersecting),
          { threshold: 0.08 },
        )
      : null;

    if (finalCta && observer) observer.observe(finalCta);

    return () => {
      window.removeEventListener("scroll", onScroll);
      observer?.disconnect();
    };
  }, []);

  const stickyVisible = hasScrolled && !finalCtaVisible;

  return (
    <>
      <AboutLanding />
      <style>{REFINEMENT_CSS}</style>
      <div
        className={`mobile-sticky-cta ${stickyVisible ? "is-visible" : ""}`}
        aria-hidden={!stickyVisible}
      >
        <div className="mobile-sticky-inner">
          <div className="mobile-sticky-copy">
            <strong>{t("첫 생각 던져보세요", "Drop your first thought")}</strong>
            <span>{t("설치 없이 바로 시작", "Start instantly, no install")}</span>
          </div>
          <Link
            to="/"
            className="mobile-sticky-button"
            tabIndex={stickyVisible ? 0 : -1}
            aria-label={t("잊지마 무료로 시작하기", "Start Itjima for free")}
          >
            {t("시작하기", "Start")}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </>
  );
}

const REFINEMENT_CSS = `
.about-v2 .site-header{
  border-bottom-color:rgba(17,17,17,.08);
}
.about-v2 a:focus-visible,
.mobile-sticky-cta a:focus-visible{
  outline:3px solid #2f6fff;
  outline-offset:3px;
}
.about-v2 .preview-buttons{
  pointer-events:none;
  user-select:none;
}
.about-v2 .preview-buttons button{
  cursor:default;
}
.about-v2 .secondary-button:hover{
  transform:translateY(-1px);
  background:#fffefa;
}
.about-v2 .text-link{
  text-underline-offset:4px;
}
.about-v2 .faq-item summary:focus-visible{
  outline:3px solid #2f6fff;
  outline-offset:5px;
  border-radius:5px;
}
.mobile-sticky-cta{
  position:fixed;
  z-index:80;
  left:0;
  right:0;
  bottom:0;
  padding:10px 12px calc(10px + env(safe-area-inset-bottom));
  opacity:0;
  pointer-events:none;
  transform:translateY(115%);
  transition:opacity .24s ease,transform .32s cubic-bezier(.2,.8,.2,1);
}
.mobile-sticky-cta.is-visible{
  opacity:1;
  pointer-events:auto;
  transform:translateY(0);
}
.mobile-sticky-inner{
  width:min(100%,520px);
  min-height:68px;
  margin:0 auto;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:10px 10px 10px 15px;
  border:1px solid rgba(17,17,17,.08);
  border-radius:18px;
  background:rgba(255,255,255,.96);
  box-shadow:0 12px 40px rgba(17,17,17,.12);
  backdrop-filter:blur(16px);
  -webkit-backdrop-filter:blur(16px);
}
.mobile-sticky-copy{
  min-width:0;
  display:flex;
  flex-direction:column;
  gap:3px;
}
.mobile-sticky-copy strong{
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  color:#111111;
  font-size:13px;
  font-weight:900;
  letter-spacing:-.025em;
}
.mobile-sticky-copy span{
  color:#9a9a90;
  font-size:10px;
  font-weight:700;
}
.mobile-sticky-button{
  min-width:104px;
  min-height:46px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:7px;
  flex-shrink:0;
  padding:0 15px;
  border:none;
  border-radius:13px;
  background:#ffd43b;
  color:#111111;
  text-decoration:none;
  font-size:13px;
  font-weight:900;
}
@media (max-width:520px){
  .about-v2{
    padding-bottom:94px;
  }
  .about-v2 h1{
    font-size:clamp(45px,13.3vw,58px);
    line-height:1.01;
  }
  .about-v2 .eyebrow-pill{
    margin-bottom:20px;
    padding:7px 10px;
    font-size:10px;
  }
  .about-v2 .hero-section{
    padding-top:42px;
    padding-bottom:38px;
  }
  .about-v2 .hero-grid{
    gap:34px;
  }
  .about-v2 .hero-description{
    margin-top:22px;
    line-height:1.62;
  }
  .about-v2 .hero-actions{
    margin-top:25px;
  }
  .about-v2 .product-stage{
    min-height:435px;
  }
  .about-v2 .browser-card{
    border-radius:21px;
    transform:rotate(.45deg);
  }
  .about-v2 .browser-top{
    height:39px;
  }
  .about-v2 .app-preview{
    min-height:388px;
    padding-top:17px;
  }
  .about-v2 .preview-date{
    margin-top:16px;
  }
  .about-v2 .understood-card{
    padding:14px;
  }
  .about-v2 .floating-note{
    padding:8px 10px;
    box-shadow:0 6px 18px rgba(17,17,17,.08);
  }
  .about-v2 .comparison-strip{
    margin-bottom:48px;
  }
  .about-v2 .section{
    padding:76px 0;
  }
  .about-v2 .section-heading h2,
  .about-v2 .faq-heading h2{
    font-size:clamp(34px,9.5vw,45px);
    line-height:1.08;
  }
  .about-v2 .pain-card{
    min-height:245px;
    padding:22px;
  }
  .about-v2 .pain-card h3{
    margin-top:33px;
    font-size:25px;
  }
  .about-v2 .how-section{
    padding-top:76px;
    padding-bottom:76px;
  }
  .about-v2 .step-card{
    min-height:248px;
    padding:22px;
  }
  .about-v2 .step-card h3{
    margin-top:58px;
  }
  .about-v2 .bento-card{
    min-height:250px;
    padding:22px;
  }
  .about-v2 .bento-icon{
    margin-bottom:28px;
  }
  .about-v2 blockquote{
    font-size:clamp(36px,10.5vw,48px);
  }
  .about-v2 .final-cta{
    padding-top:48px;
    padding-bottom:48px;
  }
  .about-v2 .legal-section{
    padding-bottom:38px;
  }
  .about-v2 .site-footer{
    padding-bottom:110px;
  }
}
@media (max-width:390px){
  .about-v2 .floating-note.note-two{
    display:none;
  }
  .about-v2 .brand-name{
    font-size:16px;
  }
  .mobile-sticky-copy span{
    display:none;
  }
  .mobile-sticky-button{
    min-width:96px;
  }
}
@media (min-width:769px){
  .mobile-sticky-cta{
    display:none;
  }
}
@media (prefers-reduced-motion:reduce){
  .mobile-sticky-cta{
    transition:none;
  }
}
`;
