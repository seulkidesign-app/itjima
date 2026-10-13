# V03 · 실행 계획

[제품](README.md)과 [계약](DATA_AND_REVIEW_CONTRACT.md)을 따른다. 과거 trust/resurfacing 구현의 병합은 포함하지 않는다.

## 독립 기반

`apps/v03/`에 자체 package/lockfile, Vite entry, 모바일 레이아웃, 라우팅, 테스트를 둔다. V02 root 실행/빌드·store·인증·migrations를 변경하지 않는다. UI/접근성 패턴만 참고하며 기존 앱 전체를 import하지 않는다. 별도 배포 origin을 권장한다.

Supabase 변수는 VITE_V03_SUPABASE_URL / VITE_V03_SUPABASE_PROJECT_REF / VITE_V03_SUPABASE_PUBLISHABLE_KEY만 사용한다. V02 변수 fallback, 알려진 V02 프로젝트, secret/service-role key를 차단한다.

## P0 · 브리프 가져오기와 검토

- 텍스트·이미지 입력, 선택 오류 처리, 원본 미리보기.
- mock 후보를 일정/해야 할 일/제작 제약조건으로 분리.
- 후보별 정보·검토 상태 및 수정/명시적 확인.
- 날짜의 독립 검토, 필수 후보 gate, 확인 후 로컬 payload 표시.
- 원본 대조, 작은 화면, 뒤로가기·취소·새로고침 동작 검증.
- AI/OCR 없이 샘플임을 표시. 확인 전 최종 기록 없음.

예정/구현 위치: src/domain, src/features, src/App.tsx, 단위·모바일 E2E.

## P0 · 저장 기반

- V03 전용 인증, SQL schema, 소유자 RLS와 복합 FK.
- Source 원문 및 private Storage manifest.
- 서버 review gate, RPC 트랜잭션, 요청 UUID 중복 방지.
- 실패 주입/응답 유실/보상 삭제/미완료 import 정리.
- 원격 적용은 별도 확인 후만 수행. 현재 작업에서는 SQL 준비·로컬 PostgreSQL 검증만 수행한다.

## 후속 제품 순서

1. 실제 V03 프로젝트 migration·Auth·Storage 적용 및 두 사용자 격리 검증.
2. 브리프 추출 어댑터: 텍스트/이미지에서 근거가 있는 검토 후보. 별도 지시 전 AI/OCR 연결 없음.
3. 협찬 상세: 실제 Notion 필드, 상태/보류, Task, 가이드, 조건, 보조 광고 코드/성과.
4. 홈: 진행 중 협찬, 다음 할 일, 가편/업로드, 상태, 가이드 접근. 날짜 없는 협찬도 보이게 한다.
5. 빠른 입력: 기존 협찬에 수정 요청/메모/날짜 후보 추가, 확인 후 연결.

일반 일정 자동 저장, 자동 상태 전이, 알림, resurfacing, 성과 자동 분석, CRM 확장은 하지 않는다.

## 검증·Git 보존

V03 단위/SQL/RLS·저장 실패·모바일 E2E·타입/빌드를 실행한다. V02 release 테스트와 빌드로 격리 확인한다. 기존 V02 결함은 수정하지 않고 별도로 보고한다.

V03 변경만 codex/v03-influencer-mvp에 commit/push한다. 키, .env.local, node_modules, dist, 테스트 산출물은 제외한다. 원격 migration은 실행하지 않는다.
