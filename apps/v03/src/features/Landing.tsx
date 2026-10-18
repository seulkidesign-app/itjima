/** Public product introduction. Fictional display data never enters registration or Supabase. */
export function Landing(){
 return <div className="landing">
  <section className="intro landing-hero" aria-labelledby="landing-title">
   <p className="eyebrow">FOR CREATORS · ITJIMA</p>
   <h1 id="landing-title">협찬의 다음 단계,<br/>한곳에서.</h1>
   <p className="landing-lead">브랜드 협찬을 관리하는 크리에이터를 위해.<br/>가편부터 업로드까지, 지금 해야 할 일을 놓치지 않게 정리하세요.</p>
   <a className="button primary" href="#/">협찬 관리 시작하기</a>
   <p className="small muted">직접 입력하고 확인하는 수동 등록 제품이에요.</p>
  </section>
  <section className="panel landing-product" aria-labelledby="product-example-title">
   <div className="section-heading"><h2 id="product-example-title">내 협찬 한눈에 보기</h2><span className="badge">가상 데이터</span></div>
   <p className="small muted">기능 소개를 위한 가상 브랜드·캠페인이에요.</p>
   <div className="home-collaboration">
    <span className="badge">제작 중</span><h3>모닝오브 · 아침의 루틴</h3><p className="small muted">Instagram Reels · 직접 입력</p>
    <dl className="detail-dates"><div><dt>가편 전달일</dt><dd>2026. 11. 10.</dd></div><div><dt>업로드 예정일</dt><dd>2026. 11. 12.</dd></div></dl>
   </div>
   <div className="landing-example"><h3>다음 해야 할 일</h3><p>제품과 함께하는 아침 장면 촬영</p><span className="small muted">미완료 · 기한 입력하지 않음</span></div>
   <div className="landing-example"><h3>제작 조건과 원본 가이드</h3><p>썸네일에 제품 가격 표시 금지</p><p className="small muted">전달받은 텍스트·이미지를 협찬과 함께 보관</p></div>
  </section>
  <section aria-labelledby="landing-value-title"><h2 id="landing-value-title">협찬마다 흩어진 내용을 한곳에</h2><div className="landing-values">
   <article className="panel"><p className="eyebrow">01 · SCHEDULE</p><h3>가편·업로드 일정</h3><p>입력한 날짜와 현재 진행 상태를 확인하세요. 날짜가 없거나 불명확한 정보도 구분해요.</p></article>
   <article className="panel"><p className="eyebrow">02 · NEXT STEP</p><h3>다음 할 일</h3><p>협찬별 해야 할 일을 모아 보고, 끝낸 일은 완료로 표시하세요.</p></article>
   <article className="panel"><p className="eyebrow">03 · ORIGINAL GUIDE</p><h3>제작 조건·원본 가이드</h3><p>조건을 확인하고 텍스트·이미지 원본을 다시 열어보세요. 후속 가이드도 추가할 수 있어요.</p></article>
  </div></section>
  <section className="panel landing-process" aria-labelledby="landing-process-title"><h2 id="landing-process-title">가이드를 보며 직접 등록해요</h2><ol><li>브리프 텍스트·이미지 가져오기</li><li>이름·일정·할 일·제작 조건 직접 입력</li><li>요약을 확인하고 저장</li></ol><p className="small muted">자동 추출 없이 사용자가 입력한 내용으로 등록해요. 입력하지 않은 값을 임의로 채우지 않아요.</p><a className="button primary" href="#/">협찬 관리 시작하기</a></section>
  <footer className="landing-footer"><a href="https://itjima.app">메모·일정 서비스 잊지마 →</a></footer>
 </div>;
}
