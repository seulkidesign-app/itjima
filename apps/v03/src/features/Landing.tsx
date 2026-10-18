import {useEffect,useState,type ReactNode} from 'react';
import {AnimatePresence,motion,useReducedMotion} from 'framer-motion';
import {BrandLogo} from '../components/BrandLogo';
// V02 LandingV2 motion values; product content stays manual and fictional.
const ease=[0.22,1,0.36,1] as const;
function Reveal({children,className='',delay=0}:{children:ReactNode;className?:string;delay?:number}){
 const reduced=useReducedMotion();
 return <motion.div className={className} initial={reduced?false:{opacity:0,y:28}} whileInView={reduced?undefined:{opacity:1,y:0}} viewport={{once:true,amount:0.18}} transition={{duration:0.72,delay,ease}}>{children}</motion.div>;
}
function Rule({label}:{label:string}){return <div className="lv2-rule" aria-hidden="true"><span className="lv2-rule-label">{label}</span></div>}
function Start(){return <a className="lv2-pill lv2-pill-dark" href="#/"><span>협찬 관리 시작하기</span><span aria-hidden="true">→</span></a>}
function ProductDemo(){
 const reduced=useReducedMotion();const [index,setIndex]=useState(0),[paused,setPaused]=useState(false),[hovered,setHovered]=useState(false),[focused,setFocused]=useState(false);
 useEffect(()=>{if(reduced||paused||hovered||focused)return;const timer=window.setInterval(()=>setIndex(v=>(v+1)%3),3600);return()=>window.clearInterval(timer);},[reduced,paused,hovered,focused]);
 const names=['일정 예시','할 일 예시','원본 가이드 예시'];
 return <div className="lv2-hero-stage" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocusCapture={()=>setFocused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setFocused(false)}}>
  <div className="lv2-demo-main"><p className="lv2-demo-kicker">내 협찬 한눈에 보기 · 가상 데이터</p><p className="v03-demo-disclaimer">기능 소개를 위한 가상 브랜드·캠페인이에요.</p>
   <div className="v03-demo-controls" aria-label="협찬 예시 선택">{names.map((name,i)=><button type="button" key={name} aria-pressed={index===i} onClick={()=>setIndex(i)}>{name}</button>)}{!reduced&&<button type="button" aria-pressed={paused} onClick={()=>setPaused(v=>!v)}>{paused?'자동 전환 재생':'자동 전환 일시정지'}</button>}</div>
   <div className="v03-demo-screen"><AnimatePresence mode="wait" initial={false}><motion.div key={index} initial={reduced?false:{opacity:0,y:10,scale:0.985}} animate={{opacity:1,y:0,scale:1}} exit={reduced?undefined:{opacity:0,y:-6,scale:0.99}} transition={{duration:0.36,ease}}>
    <div className="lv2-input-shell"><strong className="lv2-input-copy">모닝오브 · 아침의 루틴</strong><span className="badge">제작 중</span></div><p className="small muted">Instagram Reels · 직접 입력</p>
    {index===0?<div className="lv2-parsed lv2-tone-paper"><strong>가편 전달일 · 2026. 11. 10.</strong><span>업로드 예정일 · 2026. 11. 12.</span></div>:index===1?<div className="lv2-parsed lv2-tone-yellow"><strong>다음 해야 할 일</strong><span>제품과 함께하는 아침 장면 촬영</span><span>미완료 · 기한 입력하지 않음</span></div>:<div className="lv2-parsed lv2-tone-blue"><strong>제작 조건과 원본 가이드</strong><span>썸네일에 제품 가격 표시 금지</span><span>전달받은 텍스트·이미지를 협찬과 함께 보관</span></div>}
   </motion.div></AnimatePresence></div>
  </div>
  <motion.aside className="lv2-micro-promise" whileHover={reduced?undefined:{y:-6,rotate:-0.25}} transition={{type:'spring',stiffness:260,damping:22}}><span className="badge">가상 데이터</span><h3>협찬마다 흩어진 내용을 한곳에</h3><p>일정 · 다음 할 일<br/>제작 조건 · 원본 가이드</p><Start/></motion.aside>
 </div>;
}
const values=[{title:'가편·업로드 일정',label:'SCHEDULE',tone:'paper',text:'입력한 날짜와 현재 진행 상태를 확인하세요. 날짜가 없거나 불명확한 정보도 구분해요.'},{title:'다음 할 일',label:'NEXT STEP',tone:'yellow',text:'협찬별 해야 할 일을 모아 보고, 끝낸 일은 완료로 표시하세요.'},{title:'제작 조건·원본 가이드',label:'ORIGINAL GUIDE',tone:'blue',text:'조건을 확인하고 텍스트·이미지 원본을 다시 열어보세요. 후속 가이드도 추가할 수 있어요.'}];
export function Landing(){
 const reduced=useReducedMotion();
 return <div className="v03-landing-content">
  <section className="lv2-hero" aria-labelledby="landing-title"><Reveal className="lv2-hero-copy"><p className="lv2-eyebrow">FOR CREATORS · ITJIMA</p><div className="lv2-hero-title-wrap"><h1 id="landing-title">협찬의 다음 단계,<br/><span>한곳에서.</span></h1></div><p className="lv2-lead">브랜드 협찬을 관리하는 크리에이터를 위해.<br/>가편부터 업로드까지, 지금 해야 할 일을 놓치지 않게 정리하세요.</p><div className="lv2-hero-cta-row"><Start/></div><p className="lv2-no-setup">직접 입력하고 확인하는 수동 등록 제품이에요.</p></Reveal><Reveal className="lv2-hero-demo-wrap" delay={0.12}><ProductDemo/></Reveal></section>
  <section className="lv2-section lv2-how" aria-labelledby="landing-value-title"><div className="lv2-container"><Rule label="FOR YOUR COLLABORATIONS"/><Reveal className="lv2-centered-head"><h2 id="landing-value-title">협찬마다 흩어진 내용을 한곳에</h2></Reveal><div className="lv2-workflow">{values.map((v,i)=><motion.article key={v.label} className={`lv2-work-card ${v.tone}`} initial={reduced?false:{opacity:0,y:42,rotate:i===1?0:i===0?-1.4:1.4}} whileInView={reduced?undefined:{opacity:1,y:0,rotate:0}} viewport={{once:true,amount:0.35}} transition={{duration:0.7,delay:i*0.11,ease}} whileHover={reduced?undefined:{y:-8}}><span className="lv2-step-number">0{i+1}</span><h3>{v.title}</h3><p className="lv2-card-label">{v.label}</p><div className="lv2-work-rows"><p className="lv2-mini-row">{v.text}</p></div></motion.article>)}</div></div></section>
  <section className="lv2-final" aria-labelledby="landing-process-title"><div className="lv2-container"><Rule label="MANUAL REGISTRATION"/><Reveal className="lv2-centered-head"><h2 id="landing-process-title">가이드를 보며 직접 등록해요</h2><ol className="v03-manual-steps"><li>브리프 텍스트·이미지 가져오기</li><li>이름·일정·할 일·제작 조건 직접 입력</li><li>요약을 확인하고 저장</li></ol><p>자동 추출 없이 사용자가 입력한 내용으로 등록해요. 입력하지 않은 값을 임의로 채우지 않아요.</p><div className="lv2-final-cta"><Start/></div></Reveal></div></section>
  <footer className="lv2-footer"><div className="lv2-container"><Rule label="ITJIMA"/><div className="lv2-footer-row"><strong>크리에이터의 협찬 관리, 잊지마</strong><div className="lv2-footer-links"><a href="https://itjima.app">메모·일정 서비스 잊지마 →</a><a href="#/">내 협찬</a></div></div></div></footer>
  <section className="lv2-brand-band" aria-label="잊지마 브랜드"><div className="lv2-container lv2-brand-band-inner"><p className="lv2-brand-band-kicker">ITJIMA · FOR CREATORS</p><p className="lv2-brand-band-copy">협찬의 다음 단계, 한곳에서.</p><div className="v03-brand-signoff"><BrandLogo/></div></div></section>
 </div>;
}
