# V02 랜딩 계승 보정 · 2026-10-18

## 사용자 요청과 적용

- V02 hero의 ‘10초 데모 보기’ CTA를 제거하고 주 CTA 아래 작은 크리에이터 링크로 교체했다. V02 앱과 기존 footer도 ‘크리에이터 일정 관리 잊지마 →’로 통일했다. 첫 요청의 ‘잊자마’는 브랜드 표기 ‘잊지마’로 정리했다.
- V03 앱의 헤더 로고는 홈이 아닌 `#/landing`으로 이동한다. 홈 이동 링크 `#/`, 상세/등록 경로, 인증/저장 계약은 유지한다.
- V03 기존 랜딩 내용과 수동 등록/가상 데이터 표시를 보존하며, V02의 실제 전체 폭 레이아웃·floating pill nav·중앙 hero·밑줄 강조·dark pill CTA·노랑 demo stage·3개 cream/yellow/blue 카드·하늘색 최종 섹션·큰 브랜드 sign-off를 적용했다.

## 근거와 독립 구성

V02 `src/ui-landing-v2.css`, `src/ui-landing-v2-polish.css`를 `apps/v03/src/styles/landing-v2-base.css`, `landing-v2-polish.css`에 독립 복사했다. polish의 외부 Playpen Sans import는 가져오지 않고, 기존 V03 로컬 Pretendard와 실제 v8 SVG를 사용한다. V02 코드에 있던 Figma 주석은 원본 코드의 주석이며 별도로 Figma를 조회해 일치를 주장한 것이 아니다.

`LandingV2.tsx`의 Reveal(0.72s, y28, once/amount.18, ease .22/1/.36/1), workflow(0.7s, delay index*.11, y42/rotate, hover y-8), demo(3600ms, .36s 전환), aside spring(260/22, hover y-6/rotate-.25)를 같은 framer-motion 버전 12.42.2로 V03 안에 구성했다. V02 자연어/AI 로직이나 인증/데이터 코드는 가져오지 않았다. demo 내용은 일정·할 일·원본 가이드의 가상 수동 등록 예시다.

`landing-adapter.css`는 V03 기존 전역 스타일과의 격리, 실제 SVG 로고/폰트, 작은 계정 메뉴/모바일 폭, 44~48px 조작 크기·focus, auto demo 일시정지·hover/focus 정지·reduced-motion 대응을 위한 V03 adapter다. 이를 모두 V02의 기존 규칙이라고 주장하지 않는다. 랜딩 모션 코드는 React.lazy로 분리해 앱 홈/상세의 초기 JS에 포함하지 않는다. 기본 JS 약467KB, 랜딩 청크 약133KB(각 gzip133KB/44KB).

## 소스·배포 범위

V02는 기존 Production 소스 `9b1a66c82176d2807e4a36d36116653bcfe548bd`에서 이어지는 `codex/v02-v03-link-20261018`에 두 UI 파일만 수정한다. 이 브랜치에는 독립 V03 앱 코드가 없다. main과 V02 기능/인증/데이터, 프로젝트 설정을 변경하지 않는다. 기존 V02 프로젝트에서 정확한 소스를 Production 환경으로 재빌드한다.

V03은 현재 `codex/v03-influencer-mvp`와 Root Directory `apps/v03`의 기존 프로젝트를 사용한다. 동일 V02 문구 변경은 현재 브랜치에도 보관한다. DB·migration·Supabase 환경은 변경하지 않는다.

## 확인

- V03 storage 모바일 E2E 61개 통과. 기존 URL·등록·저장·상세·로그아웃 회귀와 로고 랜딩 이동, 수동 예시 전환·pause·reduced-motion 검증 포함.
- V03 비연결/샘플 모바일 E2E 8개 통과.
- V03 타입 검사·분할 production build 통과. 로컬 브라우저에서 V02형 전체 폭 nav/hero 렌더링 확인.
- V02 링크 전용 운영 소스의 npm run build(714개 릴리스 테스트와 Vite·bundle budget) 통과. 기존 테스트 종료 localhost fetch 경고는 있으나 명령은 성공했다.
- 실기기 iOS/Android는 접근하지 않아 미검증. 배포 후 실제 URL/문구/로고/랜딩 전환은 최종 보고 및 로컬 release evidence에서 대조한다.
