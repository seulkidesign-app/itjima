import{a as e}from"./rolldown-runtime-CNC7AqOf.js";import{i as t,t as n}from"./vendor-react-Bf8O_g7K.js";import{c as r}from"./vendor-tanstack-DZ2WFaAe.js";import{_t as i,ht as a}from"./index-C-3PhCX6.js";var o=e(t()),s=n();function c(){let e=i();(0,o.useEffect)(()=>{let e=document.querySelectorAll(`.reveal`),t=new IntersectionObserver(e=>{e.forEach(e=>{e.isIntersecting&&(e.target.classList.add(`in`),t.unobserve(e.target))})},{threshold:.12});return e.forEach(e=>t.observe(e)),()=>t.disconnect()},[]);let t=[{line:`아침에 일어나자마자 "아 맞다" 한 번.`,cap:``},{line:`나에게 카톡 보내고 나중에 못 찾음.`,cap:`카카오톡 나에게 보내기는 훌륭한 메모앱입니다. 찾기 전까지는.`},{line:`노션 새 페이지 열고 3초 만에 닫음.`,cap:`빈 페이지는 생각보다 무겁습니다.`},{line:`알람 27개 설정. 전부 무시함.`,cap:`이미 알고 있었죠. 알람은 끄려고 보는 거라는 걸.`},{line:`자기 전에 갑자기 할 일 8개가 생각남.`,cap:`뇌는 당신이 쉬려는 순간을 좋아합니다.`}],n=[`메모앱이 세 개 이상인 사람`,`브라우저 탭이 항상 20개 넘는 사람`,`스크린샷이 사실상 메모장인 사람`,`링크 저장해두고 한 번도 안 본 사람`,`벼락치기가 가장 생산적인 사람`,`생각은 많은데 시작이 어려운 사람`,`"아 맞다"를 하루 세 번 이상 하는 사람`],c=[{n:`01`,t:`떠오르면 그냥 던진다.`,d:`카테고리 없음. 태그 없음. 생각 날 때 0.5초 안에 기록하는 게 전부입니다.`},{n:`02`,t:`스와이프로 0.5초 결정.`,d:`오른쪽 = 일정. 왼쪽 = 보관. 틴더처럼. 그게 전부입니다.`},{n:`03`,t:`알람이 울리면 그때 생각한다.`,d:`팝업이 아니라 알람처럼 울립니다. 그래야 실제로 움직이니까요.`}],u=[{n:`01`,t:`정리하려 하지 마세요. 일단 버리세요.`},{n:`02`,t:`완벽한 메모 필요 없습니다. 대충 써도 됩니다.`},{n:`03`,t:`AI가 분류하지 않습니다. 당신이 결정합니다.`},{n:`04`,t:`팝업 알림 없습니다. 알람처럼 울립니다.`}];return(0,s.jsxs)(`div`,{className:`landing`,children:[(0,s.jsx)(`style`,{children:l}),(0,s.jsxs)(`div`,{className:`blobs`,"aria-hidden":!0,children:[(0,s.jsx)(`div`,{className:`blob blob-y`}),(0,s.jsx)(`div`,{className:`blob blob-s`}),(0,s.jsx)(`div`,{className:`blob blob-y2`})]}),(0,s.jsxs)(`nav`,{className:`lnav`,children:[(0,s.jsxs)(r,{to:`/about`,className:`lnav-logo`,children:[`It`,(0,s.jsx)(`span`,{children:`Jima.`})]}),(0,s.jsxs)(`div`,{className:`lnav-right`,children:[(0,s.jsx)(a,{}),(0,s.jsx)(r,{to:`/`,className:`lnav-cta`,children:e(`앱 열기 →`,`Open app →`)})]})]}),(0,s.jsxs)(`section`,{className:`hero`,children:[(0,s.jsx)(`div`,{className:`badge reveal`,children:`Mental Inbox · Beta`}),(0,s.jsxs)(`h1`,{className:`reveal`,style:{transitionDelay:`70ms`},children:[`기억하지 말고`,(0,s.jsx)(`br`,{}),(0,s.jsx)(`span`,{className:`hl`,children:`맡겨라.`})]}),(0,s.jsxs)(`p`,{className:`hero-sub reveal`,style:{transitionDelay:`140ms`},children:[`머릿속이 복잡한 건 의지력 문제가 아닙니다.`,(0,s.jsx)(`br`,{}),`그냥 뇌가 저장공간이 아닌 거예요.`]}),(0,s.jsxs)(`div`,{className:`hero-btns reveal`,style:{transitionDelay:`210ms`},children:[(0,s.jsx)(r,{to:`/`,className:`btn-yellow`,children:`지금 던지러 가기 →`}),(0,s.jsx)(`a`,{href:`#me`,className:`btn-ghost`,children:`이거 나인데?`})]}),(0,s.jsx)(`div`,{className:`micro reveal`,style:{transitionDelay:`280ms`},children:`무료 · 설치 없음 · 30초면 시작`})]}),(0,s.jsx)(`div`,{className:`rule`}),(0,s.jsxs)(`section`,{className:`sec`,children:[(0,s.jsx)(`div`,{className:`eyebrow reveal`,children:`당신의 하루`}),(0,s.jsx)(`div`,{className:`story`,children:t.map((e,n)=>(0,s.jsxs)(`div`,{children:[(0,s.jsxs)(`div`,{className:`story-item reveal`,style:{transitionDelay:`${n*70}ms`},children:[(0,s.jsx)(`div`,{className:`story-line`,children:e.line}),e.cap&&(0,s.jsx)(`div`,{className:`story-cap`,children:e.cap})]}),n<t.length-1&&(0,s.jsx)(`div`,{className:`rule thin`})]},n))})]}),(0,s.jsx)(`div`,{className:`rule`}),(0,s.jsxs)(`section`,{id:`me`,className:`sec`,children:[(0,s.jsx)(`div`,{className:`eyebrow reveal`,children:`혹시 이런 사람?`}),(0,s.jsx)(`ul`,{className:`me-list`,children:n.map((e,t)=>(0,s.jsxs)(`li`,{className:`me-item reveal`,style:{transitionDelay:`${t*70}ms`},children:[(0,s.jsx)(`span`,{className:`me-tag`,children:`나인데`}),(0,s.jsx)(`span`,{className:`me-text`,children:e})]},e))})]}),(0,s.jsx)(`div`,{className:`rule`}),(0,s.jsxs)(`section`,{className:`sec quote-sec`,children:[(0,s.jsxs)(`h2`,{className:`quote reveal`,children:[`당신 머릿속은`,(0,s.jsx)(`br`,{}),(0,s.jsx)(`span`,{className:`hl`,children:`꽉 찬 게 아니라`}),(0,s.jsx)(`br`,{}),`그냥 안 비운 거예요.`]}),(0,s.jsxs)(`p`,{className:`quote-sub reveal`,style:{transitionDelay:`140ms`},children:[`ItJima는 뇌의 저장공간 문제를 해결합니다.`,(0,s.jsx)(`br`,{}),`메모앱도, 일정관리 앱도 아닌 — 기억 외주 서비스.`]})]}),(0,s.jsx)(`div`,{className:`rule`}),(0,s.jsxs)(`section`,{className:`sec`,children:[(0,s.jsx)(`div`,{className:`eyebrow reveal`,children:`어떻게 쓰나요`}),(0,s.jsx)(`div`,{className:`how`,children:c.map((e,t)=>(0,s.jsxs)(`div`,{children:[(0,s.jsxs)(`div`,{className:`how-item reveal`,style:{transitionDelay:`${t*70}ms`},children:[(0,s.jsxs)(`div`,{className:`how-n`,children:[`Step `,e.n]}),(0,s.jsx)(`div`,{className:`how-t`,children:e.t}),(0,s.jsx)(`div`,{className:`how-d`,children:e.d})]}),t<c.length-1&&(0,s.jsx)(`div`,{className:`rule thin`})]},e.n))})]}),(0,s.jsx)(`div`,{className:`rule`}),(0,s.jsxs)(`section`,{className:`sec`,children:[(0,s.jsx)(`div`,{className:`eyebrow reveal`,children:`ItJima 철학`}),(0,s.jsx)(`div`,{className:`phil`,children:u.map((e,t)=>(0,s.jsxs)(`div`,{children:[(0,s.jsxs)(`div`,{className:`phil-item reveal`,style:{transitionDelay:`${t*70}ms`},children:[(0,s.jsx)(`span`,{className:`phil-n`,children:e.n}),(0,s.jsx)(`span`,{className:`phil-sep`,children:`—`}),(0,s.jsx)(`span`,{className:`phil-t`,children:e.t})]}),t<u.length-1&&(0,s.jsx)(`div`,{className:`rule thin`})]},e.n))})]}),(0,s.jsx)(`div`,{className:`rule`}),(0,s.jsxs)(`section`,{className:`sec cta`,children:[(0,s.jsxs)(`h2`,{className:`cta-h reveal`,children:[`지금 머릿속에`,(0,s.jsx)(`br`,{}),`맴도는 거`,(0,s.jsx)(`br`,{}),(0,s.jsx)(`span`,{className:`hl`,children:`있잖아요.`})]}),(0,s.jsx)(`p`,{className:`cta-sub reveal`,style:{transitionDelay:`140ms`},children:`그거 지금 던지세요. 30초면 됩니다.`}),(0,s.jsx)(r,{to:`/`,className:`btn-yellow big reveal`,style:{transitionDelay:`210ms`},children:`뇌 비우러 가기 →`}),(0,s.jsx)(`div`,{className:`micro reveal`,style:{transitionDelay:`280ms`},children:`무료 · 회원가입 없음 · 설치 없음`})]}),(0,s.jsxs)(`footer`,{className:`lfoot`,children:[(0,s.jsxs)(`div`,{className:`lfoot-logo`,children:[`ItJima`,(0,s.jsx)(`span`,{className:`hl-dot`,children:`.`})]}),(0,s.jsx)(`div`,{className:`lfoot-tag`,children:`기억하지 말고 맡겨라.`}),(0,s.jsx)(`div`,{className:`lfoot-cp`,children:`© 2026 ItJima`})]})]})}var l=`
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
`;export{c as component};