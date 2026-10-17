# V03 · V02 디자인 계승 분석 및 적용 계획

기준: `32b0e5271e7b9fff581762c3658f54f4732c9fea`의 V02 루트 `src/`, `public/`, `index.html`과 `apps/v03/` 실제 코드. 아래 본문은 최초 **분석·문서 작성 단계**의 기록이다. 이후 사용자 승인에 따른 구현 결과는 `V02_DESIGN_VALIDATION_20261017.md`에 기록했다. 최초 계획 당시에는 분석만 수행했다. CSS/컴포넌트/자산 복사, 의존성 설치, 제품 구현, migration 및 Supabase 설정 변경은 하지 않는다.

## 1. 조사 기준과 한계

V02의 실제 코드가 근거다. CSS 주석에 있는 Figma 화면명은 코드의 설명일 뿐 이번에 Figma 원본을 조회하거나 화면 일치를 검증한 것은 아니다. 현재 배포 V02의 스크린샷·런타임 computed style 및 iOS/Android 실기기는 이번에 확인하지 않았다.

[main.tsx](../../src/main.tsx)는 `styles.css` 뒤에 여러 `ui-*.css`를 순서대로 import한다. 특히 controls/fields, responsive/mobile-light, quietly-organized/post-72, brand-canonical, home-docked-composer, 마지막 brand-v8-render-fix가 공존한다. **파일 이름의 ‘final’만으로 최종 규칙이라고 판단하면 안 된다.** 실제 값은 대상 요소·미디어 쿼리·Tailwind layer·선택자 우선순위·`!important`·import 순서에 따라 결정된다.

따라서 아래에서 ‘기본 토큰’, ‘특정 컨트롤/화면 규칙’, ‘V03 적용 제안’을 구분한다. V02 전체 CSS를 복사하거나 마지막 파일 하나만 기준으로 삼지 않는다. 아래 선택은 코드에 존재하는 규칙 중 V03에 필요한 부분을 고르는 계획이며, 이미 적용된 결과가 아니다.

## 2. V02 실제 규칙과 V03 차이

| 항목 | V02 코드에서 확인한 내용 | 현재 V03 | 계승 방향·판단 |
| --- | --- | --- | --- |
| 색상 | [styles.css](../../src/styles.css)의 canvas `#FAF8F5`, surface/card `#FFFFFF`, ink `#1A1A1F`, card-foreground `#111111`, ink-soft `#8A8A94`, border `#E8E8E5`, brand/primary `#FFE033`, soft `#FFF8DC`. [controls](../../src/ui-controls-system.css)는 control-accent `#FFD33D`, label `#111113`를 별도 정의 | [styles.css](../../apps/v03/src/styles.css)의 배경 `#F8F6F1`, 패널 `#FFFEFA`, 본문 `#282720`, 보조 `#746E64`, 주 버튼 `#D65C43`+흰 글씨. 실제/샘플 선택은 녹색 `#3B6659` | 따뜻한 캔버스+흰 카드+검정 글씨+노랑 액션 계승. `#FFE033`과 `#FFD33D`는 실제 서로 다른 역할이므로 ‘V02의 유일한 노랑’으로 설명하지 않음 |
| 상태 색 | V02에는 schedule/task/archive/keep/danger semantic 토큰, [fields](../../src/ui-fields-and-states.css)의 success `#34C759`, warning `#FF9F0A`, danger `#FF3B30`도 존재. styles의 destructive는 검정이며 역할이 일관된 단일 색은 아님 | 오류 `#A53129`, 확인/수정 badge 녹색, 다수 협찬 상태는 같은 중립 badge | **V03 협찬 상태 7종의 색 대응은 V02에 없는 신규 설계**. 상태명을 유지하고 중립 표현부터 적용. V02의 일정/보관 색에 협찬 상태를 임의 대응하지 않음 |
| 글꼴 | [styles.css](../../src/styles.css) font-sans는 Pretendard → Pretendard Variable → Archivo → 시스템 폰트. display/num은 Bebas Neue·Archivo Black 계열. [index.html](../../index.html)은 Pretendard Variable 1.3.9 CDN과 Google Fonts를 실제 로드 | 시스템 폰트만 사용. 별도 폰트 로드 없음 | 본문/폼은 Pretendard 계열 우선. 표시용 영문 폰트를 한글 제목·날짜에 무조건 적용하지 않음. 외부 폰트 의존/실패 및 로컬 배포 여부는 적용 시 확인 |
| 타입 위계 | styles의 page-title `30px/650/1.16/-0.032em`, body `16px/500/1.55`, secondary `13px/450/1.45`. [layout](../../src/ui-layout-system.css)는 `.phone-frame .page-title`을 `32px/1.1/-0.042em !important`, page-eyebrow를 `15px/1.58`로 보정 | h1 `clamp(30px,7.8vw,40px)/1.3/-0.05em`, h2 `18px`, h3 `15px`, 보조 12px. 영문 eyebrow 10px·넓은 자간 | 페이지 제목/본문/메타 역할을 명시해 적용. 30과 32를 모두 ‘전역 제목 크기’로 단정하지 않음. 실제 협찬의 긴 한글 이름은 줄바꿈·확대 검증 후 결정 |
| 간격 | styles와 layout에 4/8/12/16/20/24/32/40/48px scale. layout-gutter 16px, reading 620px/work 720px/wide 920px. card-padding은 20px 22px | 셸 좌우 24px, 패널 20px, margin 16px. 14/18/28/30px 등 개별 값이 섞임 | 확인된 scale로 V03 토큰을 정리. 모든 예외를 4의 배수로 기계 변환하지 않음. V02 자체에도 개별 예외가 존재 |
| 모서리 | styles: sm 12/md 16/lg 24/pill 999px, card 24px. controls: 10/14/18px. [quietly](../../src/ui-quietly-organized.css)의 일정 카드·feedback-card는 20px. [apple](../../src/ui-apple-system.css)에 card 18px도 존재 | 패널 20px, 홈 카드 18px, 버튼 12px, 필드 10px, badge 7px | 기본 패널 24px·밀도 높은 협찬 카드 20px·필드 14px·주요 액션 pill을 **V03 적용안**으로 선택. 모든 V02 카드가 같은 radius라는 주장은 하지 않음 |
| 그림자 | styles shadow-card `0 10px 13px rgba(26,26,31,.06)`, float/input alpha .08, yellow `0 4px 5px ... .1`. controls는 별도의 얕은 복합 shadow. quietly는 카드 shadow 토큰 사용, 일부 nav는 shadow 없음 | 카드/버튼에 별도 box-shadow 없음. border 중심 | 카드와 주요 액션에 필요한 깊이만 계승. 중첩 패널마다 그림자를 누적하거나 V02의 과거 glass 효과를 일괄 이식하지 않음 |
| 버튼 | styles의 pill radius, [components](../../src/ui-components.css) 최소 터치 44px, controls의 높이 36/44/50px. `.pill-yellow` 노랑+검정, `.pill-black` 검정+흰색, `.pill-ghost` 흰색+border. hover/pressed/disabled/focus 규칙 별도 | 모든 button을 전역 full-width/최소 48px/12px radius로 지정. primary 코랄, 보조 베이지, text-button만 예외 | 시각적 variant와 배치(full-width/inline)를 분리. 현재 48px 터치 크기를 축소할 필요 없음. 저장/취소/원본 열람/할 일 전환의 의미와 disabled 계약 유지 |
| 입력창 | fields의 높이 48px, radius 토큰 14px, 흰색 alpha .96, 경계 alpha .14, 폰트 16px. focus 경계와 4px halo, checkbox/radio는 별도 20px·accent 노랑 | 높이 48px·16px 유지하나 배경 `#F9F7F2`, radius 10px. 전역 input 규칙과 manual-confirm의 24px checkbox 예외 공존 | native input/date/select/file 동작 유지, 흰 필드·role별 border/focus 계승. checkbox/radio/file은 일반 텍스트 필드 선택자에서 명확히 제외. V03의 명시적 확인 checkbox를 작은 조작으로 만들지 않음 |
| 카드·상태 화면 | quietly 일정 카드 20px/흰색/border/shadow, [EmptyState](../../src/components/EmptyState.tsx) role=status·제목/힌트, [Skeleton](../../src/components/Skeleton.tsx) aria-busy·shimmer | `.panel`, `.home-collaboration`, `.detail-list`, 로딩/오류/빈 목록 UI가 화면별 구현 | 외형/타입 위계를 통일하되 협찬/Task/원본 카드의 데이터 구조는 V03 유지. 상태 메시지·재시도·접근 불가를 단순 장식으로 대체하지 않음 |
| 모바일 레이아웃 | [responsive-master](../../src/ui-responsive-master.css)의 320px 하한·100svh/dvh·반응형 레일, [viewport-polish](../../src/ui-layout-viewport-polish.css)의 safe-area 및 640~1023/1024+ 분기. layout-gutter 16px 외에 clamp gutter도 존재 | 셸 max-width 640px, 360px 이하 좌우 16px, 기본 24px. 일정 480px에서 2열, 원본 대조 1000px에서 2열. 일반 문서 스크롤 | 모바일 좌우 16~20px 후보와 읽기 레일을 검토하되 **V03 적용안**으로 표시. V02의 고정 composer/하단 탭·데스크톱 사이드바를 새 기능처럼 가져오지 않음 |
| 브랜드 | [BrandLogo](../../src/components/BrandLogo.tsx)는 [v8 SVG](../../public/brand/itjima-wordmark-v8.svg), viewBox/크기 593×307. app/native/micro 크기와 [마지막 보정](../../src/ui-brand-v8-render-fix.css)의 app 70.4/native 112/micro 56px, height auto·contain·crop 금지 | [App.tsx](../../apps/v03/src/App.tsx)의 폰트 텍스트 `itjima`+코랄 점, favicon은 inline `ij` | 실제 v8 SVG를 apps/v03 내부 자산으로 독립 복사하는 안. 텍스트로 로고를 재제작하지 않음. 부모 홈 링크의 접근 가능한 이름 유지 |

### CSS 충돌과 접근성에 대한 별도 주의

- [mobile-light-contract](../../src/ui-mobile-light-contract.css)는 모바일 light-only와 흰 표면을 강제한다. 이후 quietly-organized가 일부 canvas를 `#FAF8F5`로 다시 지정한다. ‘V02 전체는 순백’ 또는 ‘모든 표면은 베이지’로 단순화하지 않는다. V03은 canvas/카드/필드를 명시적으로 나눠야 한다.
- V02의 [home-docked-composer](../../src/ui-home-docked-composer.css)는 키보드 inset·절대 위치 하단 nav/composer와 전용 스크롤 구조의 보정이다. 현재 V03에는 같은 구조가 없으므로 값/JS를 그대로 복사하면 오히려 하단 가림을 만들 수 있다.
- V02 focus halo·보조색이 존재한다는 사실이 모든 배경에서 접근성 대비를 통과했다는 증거는 아니다. V03의 현재 3px outline을 대비 검증 없이 제거하지 않는다. 약한 보조색에 필수 날짜·오류·정보 상태를 맡기지 않는다.
- V02 controls는 reduced-motion 및 coarse-pointer/hover 구분을 포함한다. V03은 reduced-motion 규칙이 있지만 애니메이션 계승은 선택이며, 장식 애니메이션 의존성을 추가할 필요는 없다.

## 3. 재사용할 것과 분리할 것

| V02 원천 | V03에서 재사용할 범위 | 그대로 복사하지 않는 이유 |
| --- | --- | --- |
| styles/layout/controls/fields CSS | 색·타입·간격·radius·shadow의 필요한 선언과 variant 상태. 출처를 V03 토큰 파일에 주석으로 기록 | Tailwind `@theme/@utility`, `.phone-frame`, 광범위 selector·보정 순서에 의존. 현재 V03은 일반 CSS이며 Tailwind 도입은 필수 아님 |
| BrandLogo.tsx + v8 SVG | 순수 이미지 표시 로직·비율·crop 방지, app 크기. V03 경로에 맞춘 별도 컴포넌트/자산 | V02 `/brand/` 경로에 런타임 의존하지 않기. aria-hidden인 로고의 부모 링크에 accessible name 필요 |
| EmptyState.tsx | 제목/설명/상태 역할과 여백 표현 | framer-motion·V02 i18n·motionLanguage 결합. 표현만 native React/CSS로 옮기고 문구·retry는 V03 유지 |
| Skeleton.tsx | aria-busy/aria-hidden 분리와 낮은 자극의 로딩 표현 | Inbox/Schedule/Archive 구조·i18n은 V03 도메인과 다름. 첫 적용에 skeleton 추가는 필수 아님 |
| TopNav.tsx | 로고·계정 조작·터치 크기·safe-area의 시각적 원칙 | V02 TanStack 경로·store·SettingsSheet·haptics·탭 구조 결합. V03 홈/상세/hash 경로와 AuthPanel 유지 |
| BottomSheet.tsx | 향후 모달이 필요할 때만 focus 복귀/trap/Escape 등 접근성 참고 | motion·i18n·haptics·swipePhysics·키보드/drag 처리 결합. 이번 외형 계승을 이유로 기존 inline 편집을 모달로 바꾸지 않음 |
| V02 폰트 로딩 | Pretendard 계열과 시스템 fallback | Google Fonts 전체를 복사하지 않음. 로컬 자산 사용 시 배포 가능한 파일·라이선스·크기를 확인한 후 V03 안에 보관 |

현재 조사한 V02 공통 버튼/입력창/카드의 주된 재사용 단위는 CSS utility·class이며, 존재하지 않는 `src/components/ui/button.tsx` 같은 파일을 원천 컴포넌트라고 가정하지 않는다. 아래 V03 공통 컴포넌트 이름은 **새로 만들 수 있는 후보**다.

## 4. 변경할 V03 파일 제안 — 아직 미구현

| 파일/영역 | 최소 변경 제안 |
| --- | --- |
| `apps/v03/src/styles/tokens.css` (신규 후보) | V02 출처 주석과 선택한 토큰만 수록. `--v03-*` 명칭은 V03의 새 격리용 이름이며 V02 원래 명칭이라고 주장하지 않음 |
| `apps/v03/src/styles.css` | hard-coded 색/간격을 토큰에 연결, panel/card/button/field/focus와 반응형 정리. 전역 button/input 선택자 영향 범위를 줄이고 native controls 예외 유지 |
| `apps/v03/src/main.tsx` | 필요한 경우 tokens→기존 styles의 명시적 import 순서만 추가. V02 main의 부트스트랩은 가져오지 않음 |
| `apps/v03/public/brand/itjima-wordmark-v8.svg` (신규 후보) | 검증된 V02 SVG를 독립 복사. 원본 파일은 수정하지 않음 |
| `apps/v03/src/components/BrandLogo.tsx` (신규 후보) | V03 자산 경로를 쓰는 순수 로고. 비율·높이 auto·접근성 유지 |
| `apps/v03/src/components/ui/` (필요 시 신규) | Button/Panel/Field/StateMessage 등 표현 공통화만. 초기에는 CSS class만으로 해결 가능하면 컴포넌트 파일을 늘리지 않음 |
| `apps/v03/src/App.tsx`, `apps/v03/index.html` | 로고/셸/폰트 및 theme-color 시각 정합성. 제목·V03 협찬 관리 식별·해시 라우팅·본문 포커스 유지. 폰트 로컬화가 결정되면 `apps/v03/public/fonts/` 안에서만 사용 |
| `features/AuthPanel.tsx`, `Home.tsx` | 계정/주 액션 variant, 협찬 카드·Task 목록·빈/오류 상태 표현. 정렬·목록 구분·기한 없음/기한 지남·로그아웃 동작 유지 |
| `features/CollaborationDetail.tsx`, `BasicInfoEditor.tsx`, `ScheduleEditor.tsx`, `ProgressControls.tsx` | 헤더·카드·메타·폼·저장/취소·충돌/재시도 상태의 외형. 원본/현재 정보·날짜 의미·Task 독립성·대상 콘텐츠 표시 유지 |
| `features/BriefImport.tsx`, `SourcePreview.tsx`, `ManualRegistration.tsx`, `BriefReview.tsx`, `FollowupGuide.tsx` | 실제/샘플 구분, 이미지 선택/preview, 원본 대조, 요약·확인 gate, 최초/후속 표기의 시각 통일. 데이터와 문구 의미·선택 순서·재시도 lock 유지 |
| `apps/v03/e2e/`, `docs/v03/ALPHA_VALIDATION.md` | 적용 후 변경된 화면의 표현/접근성 검증·합성 스크린샷과 실기기 결과만 추가. 기존 검증 기록은 덮어쓰지 않음 |

표의 `features/` 경로는 모두 `apps/v03/src/features/` 아래다. 이 계획 때문에 package/lockfile 변경이 필요한 것은 아니다. domain/integrations/hooks, Supabase 설정, RPC/payload, 기존·새 migration은 디자인 적용 대상에서 제외한다.

## 5. 최소 적용 순서와 검토 지점

1. **원천 규칙 확정**: 코드 근거와 실제 V02 앱의 대표 header/card/field/button computed style을 대조. 시각 계승의 기준 화면은 제품 앱이며 별도 랜딩의 대형 타이포·장식은 제외한다. 필요한 토큰별 원천/예외를 기록한다.
2. **토큰·브랜드·셸**: V03 안에 최소 토큰과 SVG를 독립 배치. canvas/white surface/검정 본문/노랑 액션, 폰트 fallback, 모바일 gutter와 읽기 폭을 먼저 검토한다. 본 문서의 구체적인 조합은 제안이며 최종 수치는 이 단계에서 확인한다.
3. **공통 조작·폼**: 버튼 variant·입력/선택·카드·상태 메시지를 맞춘다. 저장·확인·삭제/제거·취소를 같은 시각적 강도로 뭉개지 않는다. 단순 스타일 변경이면 TSX의 상태/이벤트 코드를 바꾸지 않는다.
4. **협찬 흐름 적용**: 홈→실제 수동 등록→상세→기본/일정/Task 조작→후속 가이드 순으로 동일한 표현을 적용. 샘플 예시·manual·미확정 날짜·최초 기록 표시는 보존한다. 전체 라우트·정보 구조를 재설계하는 작업은 분리한다.
5. **영향에 맞는 확인**: 타입/빌드, 변경한 화면의 E2E와 접근성/스크린샷, iOS Safari·Android Chrome 실기기. 기존 DB 계약을 바꾸지 않았다는 이유로 완료된 원격 검증 전체나 migration을 재실행하지 않는다. 별도 근거가 생긴 실패만 필요한 범위에서 조사한다.

### 향후 적용 완료 조건

- V02의 원본 코드/자산과 V03의 domain/integrations/hooks/DB·Supabase 설정에 의도치 않은 diff가 없다. V02 경로를 V03에서 직접 import하거나 root CSS를 외부 참조하지 않는다.
- 320/360/390/430px 및 넓은 화면에서 가로 넘침·본문 잘림이 없고, 긴 한글 협찬명·플랫폼·메모·원본과 이미지가 읽힌다. 이 폭 목록은 **V03 검증 계획**이며 V02 전체의 공식 breakpoint 목록이 아니다.
- 터치 크기·키보드 확대/가림·safe-area·사진/날짜 native picker를 확인한다. 조작 대상은 최소 44px 기준을 참고하되 기존 V03의 48px을 불필요하게 줄이지 않는다.
- 키보드 Tab/focus-visible, label/legend/summary, 체크박스와 disabled, aria-live/alert/busy, route 포커스와 reduced-motion 유지. 본문/보조/노랑·오류색 조합의 실제 대비를 측정한다.
- loading/empty/error/retry/unavailable/signed-out/conflict/saving/unknown 결과를 서로 구분한다. 색만으로 상태·기한 지남·확인 여부를 전달하지 않는다.
- 수동 등록/샘플 원격 저장 금지, private 이미지, 명시적 확인, 현재/최초 정보 분리, 원본 보존, 상태/Task/날짜 독립성, 동일 요청/충돌/실패 정리 등 기존 계약을 유지한다.

## 6. 가져오지 않을 것과 남은 결정

V02의 알림·push/service worker·resurfacing/재발견·자연어 일정 처리, 관련 store·API·환경 변수·설정 화면은 가져오지 않는다. Home composer의 자동 일정/음성/AI 표현, V02 하단 탭 및 사이드바 경로도 이식하지 않는다. `main.tsx`의 import 목록을 복제하지 않는다.

아직 결정/검증하지 않은 것은 V03 카드별 최종 radius·조합, 두 노랑 역할의 화면별 적용, 한글 장문 제목 크기, 폰트 로컬화와 라이선스/배포 용량, 상태별 표현의 대비, 실제 V02 런타임과의 시각 대조 및 실기기 결과다. 이러한 선택을 V02에 이미 확정된 규칙처럼 서술하지 않는다.

**이번 산출물은 이 계획 문서 한 파일이며 제품 구현은 시작하지 않았다.**
