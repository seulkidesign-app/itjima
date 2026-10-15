# V03 · 실행 계획

[제품](README.md)과 [계약](DATA_AND_REVIEW_CONTRACT.md)을 따른다. 과거 trust/resurfacing 구현의 병합은 포함하지 않는다.

## 독립 기반

`apps/v03/`에 자체 package/lockfile, Vite entry, 모바일 레이아웃, 라우팅, 테스트를 둔다. V02 root 실행/빌드·store·인증·migrations를 변경하지 않는다. UI/접근성 패턴만 참고하며 기존 앱 전체를 import하지 않는다. 별도 배포 origin을 권장한다.

Supabase 변수는 VITE_V03_SUPABASE_URL / VITE_V03_SUPABASE_PROJECT_REF / VITE_V03_SUPABASE_PUBLISHABLE_KEY만 사용한다. V02 변수 fallback, 알려진 V02 프로젝트, secret/service-role key를 차단한다.

## P0 · 브리프 가져오기와 검토

- 텍스트·이미지 입력, 선택 오류 처리, 원본 미리보기.
- 실제 등록은 빈 수동 입력으로 시작하며 일정/할 일/제작 조건을 직접 입력한다. 샘플 후보 검토는 로컬 체험으로 분리한다.
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
- 승인된 V03 프로젝트에 초기·progress·schedule·manual migration 적용 완료. 후속 변경은 승인된 새 migration으로만 추가한다.

## 후속 제품 순서

1. 완료: 실제 V03 migration·Auth·Storage 적용 및 사용자 격리 검증.
2. 완료: AI/OCR 없는 실제 수동 등록. 추출 어댑터는 이후 별도 범위이며 현재 연결하지 않는다.
3. 협찬 상세: 실제 Notion 필드, 상태/보류, Task, 가이드, 조건, 보조 광고 코드/성과.
4. 홈: 진행 중 협찬, 다음 할 일, 가편/업로드, 상태, 가이드 접근. 날짜 없는 협찬도 보이게 한다.
5. 빠른 입력: 기존 협찬에 수정 요청/메모/날짜 후보 추가, 확인 후 연결.

일반 일정 자동 저장, 자동 상태 전이, 알림, resurfacing, 성과 자동 분석, CRM 확장은 하지 않는다.

## 검증·Git 보존

V03 단위/SQL/RLS·저장 실패·모바일 E2E·타입/빌드를 실행한다. V02 release 테스트와 빌드로 격리 확인한다. 기존 V02 결함은 수정하지 않고 별도로 보고한다.

V03 변경만 codex/v03-influencer-mvp에 commit/push한다. 키, .env.local, node_modules, dist, 테스트 산출물은 제외한다. 원격 migration은 명시적으로 승인된 새 migration만 적용하며 이미 적용된 파일은 실행하지 않는다.


## 2026-10-15 · 협찬 상세 조회 P0

저장 성공 후 `#/collaborations/<UUID>`로 이동하며, URL에서 식별자를 읽어 새로고침 시 실제 Supabase를 재조회한다. 협찬·콘텐츠/Task·조건·원본/Review를 한 관계 조회로 읽고 소유자 RLS를 따른다. 미기재와 불명확 정보는 Review에서 구분한다. 모바일 로딩·연결 오류/재시도·로그인 필요·접근 불가 상태, 비공개 이미지 원본 보기를 제공한다.

이번 범위는 조회만 지원한다. 상세 편집, 홈 목록, 빠른 입력, AI/OCR, 알림 및 기존 migration 재실행은 포함하지 않는다. [구현 검증 기록](COLLABORATION_DETAIL_VALIDATION_20261015.md)을 참고한다.


## 2026-10-15 · 홈 조회 P0

로그인 사용자 소유 협찬을 cursor 페이지로 조회해 진행 중/보류/완료와 가편·업로드 일정을 표시한다. 다음 할 일은 진행 중 협찬의 모든 미완료 Task이며, 지난 기한과 날짜 없는 항목도 유지한다. 보류·완료 상태에 남은 미완료 Task도 각 목록에 표시한다. 미기재·불명확 날짜를 임의 확정하지 않는다. 협찬/할 일에서 상세로 이동하고 브리프 가져오기 진입을 제공한다.

성과·광고 코드·원본 bytes는 홈 조회에서 제외한다. 로딩·빈 목록·오류/재시도·로그아웃을 처리하며 수정/자동 상태 전이/알림은 추가하지 않았다. [홈 검증 기록](HOME_VALIDATION_20261015.md)을 참고한다.


## 2026-10-15 · 협찬 상태·Task 완료 P0

상세에 상태 변경과 Task 완료/미완료를 추가했다. 상태/Task를 독립적으로 변경하며 저장 후 DB를 재조회한다. 새 progress migration에 per-row revision, 요청 receipt, 소유자/CAS 검증 RPC를 추가했다. 기존 직접 쓰기 차단과 초기 migration은 보존했다. 충돌은 최신 내용을 읽은 뒤 명시적으로 다시 선택한다. [검증 기록](PROGRESS_VALIDATION_20261015.md)을 참고한다.


## 2026-10-15 · 실제 수동 등록 P0 완료

실제 등록과 샘플을 분리했다. 실제 등록은 빈 협찬 이름/플랫폼/메모, 선택 날짜, 사용자가 추가·수정·삭제하는 할 일·조건으로 구성한다. 원본 텍스트·이미지를 대조하고 사용자용 요약/명시적 저장 확인 후 저장한다. manual 출처 및 미입력 상태를 보존하며 고정 후보 9개 gate를 사용하지 않는다.

샘플 검토는 기존 gate를 그대로 유지한 로컬 체험이다. 새 migration은 수동 등록 검증/RPC만 추가하고 기존 mock 저장 RPC의 클라이언트 실행 권한을 제거했다. 기존 mock validator와 기존 migration 파일은 변경하지 않았다. 현재 원격 검증 명령은 `admin:verify:manual`이며 이전 mock 저장 검증 문서/스크립트는 당시 커밋의 역사 기록이다.

원격 수동 등록·격리·transaction/보상 삭제 및 실제 브라우저 합성 이미지 선택→미리보기→저장→상세 원본 열람을 완료했다. [검증 기록](MANUAL_REGISTRATION_VALIDATION_20261015.md).

### 다음 알파 잔여 P0

- 저장 후 이름·플랫폼·메모 수정, 기존 원본을 보존한 후속 가이드 추가.
- 현재 날짜 제거 사유를 사용자 제거/불명확/미기재와 분리하는 후속 계약. 이번에는 기존 날짜 제거 의미를 변경하지 않았다.
- iOS Safari/Android Chrome 실기기의 날짜 입력·사진 선택 점검. 현재 모바일 Chromium 자동화와 데스크톱 내장 브라우저 검증만 완료했다.

상태·Task 완료·홈·상세·일정 수정 완료 항목은 반복 검증 대상으로 돌리지 않는다. 위 과거 날짜별 구현 기록의 제외 범위는 해당 작업 당시 기준이다.
