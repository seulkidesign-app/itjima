# V02 연결 링크 · V03 공개 랜딩

## 라우팅과 호환성

- V03 기본 진입 `https://v03.itjima.app/`: 공개 랜딩. `/#/landing`도 같은 랜딩이며 로그인 여부와 관계없이 유지한다.
- 앱 홈 `https://v03.itjima.app/#/`: 기존 URL 그대로. 상세 `/#/collaborations/<UUID>`, 등록 `/#/brief/new`, preview/manual/review 주소 및 새로고침 복구 계약을 바꾸지 않았다.
- 랜딩 CTA/내 협찬은 기존 홈으로 연결한다. 앱 헤더의 서비스 소개로 랜딩에 돌아갈 수 있다. 인증 상태를 이유로 랜딩에서 자동 이동시키지 않는다.
- 로그인 상태/등록 과정의 데이터, 저장/충돌/재시도 RPC·Supabase 계약·DB·migration은 변경하지 않았다.

## 랜딩 표현

V02에서 독립 계승한 V03 로고·Pretendard·크림/흰색/노랑·카드·필드·터치 크기를 유지했다. 크리에이터를 대상으로 ‘협찬의 다음 단계, 한곳에서.’와 ‘협찬 관리 시작하기’를 표시한다. 일정·할 일·제작 조건·원본 가이드와 실제 수동 등록 3단계를 소개한다. 모닝오브 · 아침의 루틴은 공개 기능 설명용 가상 데이터이며 실제 저장·사용자 데이터 조회로 사용하지 않는다. 자동 추출 없이 직접 입력하는 제품임을 명시하며 AI/OCR·알림 제공을 주장하지 않는다.

## V02 운영 소스 격리

읽기 전용 조사에서 Vercel `itjima` Production은 `feat/v03-resurfacing`의 `fec54adf77f34d1de27326e36e2900215c48517b`였다. 현재 V03 브랜치의 루트 소스는 운영 소스와 다른 제품 변경도 있으므로 전체 브랜치를 V02 Production으로 배포하지 않는다.

V02 운영 커밋에서 `codex/v02-v03-link-20261018`를 만들고 두 파일에 보조 링크 3줄만 독립 추가했다. SHA `9b1a66c82176d2807e4a36d36116653bcfe548bd`. `src/components/LandingV2.tsx` footer, `src/routes/__root.tsx`의 홈 전용 desktop/touch scroll footer만 변경한다. 링크는 `https://v03.itjima.app`. V02 기능·인증·데이터·기존 배포 브랜치 main 설정은 변경하지 않는다. 해당 소스는 독립 V03 앱 디렉터리를 포함하지 않는다.

동일한 두 파일 링크 변경은 사용자 요청대로 현재 V03 브랜치에도 기록한다. V03 프로젝트 `itjima-v03-alpha`는 Root Directory `apps/v03`, V02 프로젝트 `itjima`는 저장소 루트를 빌드한다. V02는 링크 전용 소스의 Production 환경 재빌드를 사용하고 Preview 빌드 결과를 강제 승격하지 않는다. 환경 값/도메인/DNS를 변경하지 않는다.

## 검증

- V03 mobile storage E2E 60개 통과: 새 랜딩 공개/비로그인 조회 없음/가상 표시/수동 표시/CTA/320~1024px 폭, 로그인 상태에서 랜딩↔홈·상세 직접 URL·새로고침·등록 주소 및 기존 기능 회귀.
- V03 비연결 모바일 E2E 8개 통과. 기존 첫 진입 테스트는 랜딩 CTA를 거치도록 갱신했다.
- V02 실제 운영 기준 링크 전용 소스에서 릴리스 테스트 714개 및 Vite production build·bundle budget 통과. 설치 audit는 기존 lockfile에서 22건(중간 3/높음 18/치명 1)을 보고했으나 이번 링크 범위에서는 의존성을 변경하지 않았다. happy-dom 테스트 종료 fetch abort 및 기존 dynamic import 경고가 있었으나 명령은 성공했다.
- 배포 후 실제 HTTPS의 V02 랜딩/앱 링크, V03 랜딩→앱 홈·서비스 소개·등록 직접 URL·상세/새로고침은 최종 보고에서 확인 항목을 구분한다.
- 실기기 iOS/Android와 신규 가입 이메일 redirect는 미검증이다. 원격 계약/migration은 반복하지 않는다.

자동 승인 검토가 브랜치 이름을 대상으로 한 cherry-pick 계획을 V03 반입 위험으로 거부했다. 해당 명령은 실행하지 않았고 실제 V02 운영 커밋에서 두 파일만 독립 편집해 diff를 확인했다. 병합/이력 재작성/강제 push는 하지 않았다.
