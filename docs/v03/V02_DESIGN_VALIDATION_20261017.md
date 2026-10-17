# V02 디자인 계승 구현 · 2026-10-17

기준 소스: 32b0e5271e7b9fff581762c3658f54f4732c9fea. 현재 V03 브랜치에서 디자인만 변경하며 V02 코드·배포 설정·데이터 계약·migration은 변경하지 않는다.

## 계승 근거와 적용

최초 조사: [디자인 계획](V02_DESIGN_INHERITANCE_PLAN.md). V02의 실제 `src/styles.css`, `src/ui-layout-system.css`, `src/ui-controls-system.css`, `src/ui-fields-and-states.css`, `src/ui-brand-v8-render-fix.css`에서 선택한 값을 V03의 `src/styles/tokens.css`로 독립 정의했다. 크림 캔버스 #FAF8F5, 흰 카드, 검정 본문, 노랑 #FFE033/액션 #FFD33D, 24px 패널·20px 협찬 카드·14px 필드·pill 버튼, 카드 그림자와 간격 scale을 계승했다. v8 로고 SVG와 favicon은 원본과 동일한 파일을 V03 public으로 복사했다.

V02가 사용하던 Pretendard Variable 1.3.9는 공식 배포 파일을 V03 내부에서 제공한다. `public/fonts/OFL.txt`를 동봉했고 font-display: swap과 시스템 fallback을 유지했다. 글꼴 원본: https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2 . 실행 중 외부 폰트 CDN 호출은 없다. 원본 variable 파일은 약 2.06MB이며 느린 모바일 네트워크 성능은 별도 실기기 점검 대상이다.

홈·수동 등록·상세·로그인·원본 미리보기·저장 확인과 기존 편집 화면에 공통 스타일을 적용했다. 폼과 상태 처리 로직은 유지했다. 48px 조작 영역과 16px 입력 글자, 24px 확인 checkbox, native date/select/file, 3px focus, safe-area, reduced motion을 유지했다. 보조 글자 #62626B/필드 경계 #85858B, 제목 조합 및 660px 읽기 레일은 V03 접근성과 레이아웃에 맞춘 선택이며 V02 전역 규칙으로 주장하지 않는다. V02 알림·자연어·resurfacing 로직과 신규 UI 라이브러리는 가져오지 않았다.

## 확인 결과

- `npm run build`: 타입 검사 및 Vite production build 통과. 폰트 누락 경고 없음.
- `npm run test:e2e:storage -- design.spec.ts home.spec.ts manual.spec.ts detail.spec.ts guide.spec.ts`: 27개 통과.
- 모바일 홈/수동 입력/선택 이미지 미리보기/확인 gate/저장/상세/후속 가이드와 오류·재시도·로그아웃 회귀를 확인했다. 이는 mock backend E2E이며 실제 원격 DB 검증과 구분한다.
- 신규 design E2E: 320/360/390/430/1024px 가로 넘침 없음, 로고 자산 로드, Pretendard/16px/필드 모서리, 확인 checkbox 및 reduced motion 확인.
- `.tmp/design/`에 로그인·홈·수동 등록·미리보기·요약·상세의 PNG를 생성한다. `e2e/storage/design.spec.ts`의 가상 브랜드/캠페인만 사용하며 원격 저장하지 않는다. 제품 실제 등록에는 가상 값 자동 채우기가 없다.
- 재현: 위 E2E 명령의 `design.spec.ts`만 실행하면 portfolio PNG가 다시 생성된다. 실제 사용자 정보/secret은 문서·스크린샷에 넣지 않는다.

## 배포와 제한

대상은 기존 `itjima-v03-alpha` 프로젝트이며 공개 환경변수·Root Directory·도메인 설정을 변경하지 않는다. commit/push 후 동일 SHA를 Production에 배포하고 실제 배포 식별은 Vercel Source 및 최종 작업 보고로 확인한다. 빌드 산출물에 관리자 환경 파일/키가 포함되지 않도록 확인한다.

iOS/Android 실기기, 실제 키보드·날짜 picker·접근성 확대·느린 회선은 미검증이다. 이번 CSS 변경으로 기존 원격 데이터 계약 검증/migration을 반복하지 않는다. 도메인 현재 상태와 전환 선행 조건은 [도메인 계획](DOMAIN_TRANSITION_PLAN_20261017.md)에 기록했다. V02 랜딩 보존 주소가 정상 확인되지 않았으므로 메인 도메인은 전환하지 않는다.
