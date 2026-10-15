# 가편 전달일·업로드 예정일 수정 P0 검증

2026-10-15, `codex/v03-influencer-mvp`, 기준 `95be79ef9aafb10c6d30d2c371cc28e5987bf14d`.

## 구현 확인 및 범위

기존 코드는 최초 브리프 검토 시 날짜 입력과 상세/홈 조회만 제공했다. 저장된 일정 수정 RPC/화면은 없었다. 이번 변경은 일정 수정만 추가한다. 완료로 인정된 상태 변경·Task 완료 작업의 테스트 또는 RPC 검증을 다시 실행하지 않았다. 일정 수정 전후 기존 상태/완료 값이 보존되는지만 확인했다.

- 제작물별 가편 전달일/업로드 예정일 독립 저장, 연도 포함 date-only 값. 과거 날짜도 허용한다.
- 현재 날짜는 기존 `v03_tasks.due_date`에 저장. Source/최초 Review/Import는 불변.
- 현재 정보 상태는 별도 `v03_schedule_states`에서 관리. 현재 미기재와 현재 불명확을 구분하고 최초 원문 상태와 혼동하지 않는다.
- 날짜를 비워도 기존 Task의 ID·완료 값 보존. 날짜 Task가 처음부터 없던 경우, 미확정 정보만으로는 생성하지 않는다. 명시적 날짜 지정 시 새 일정 Task를 미완료로 한 개 생성한다. 다른 Task/협찬 상태는 변경하지 않는다.
- 직접 쓰기 차단, 서버 소유권/허용 값/유효 날짜 검증. 일정 revision과 기존 Task revision을 모두 비교해 동시 덮어쓰기를 차단한다.
- 같은 UUID 재시도는 receipt를 반환하며 더 최신 날짜를 덮어쓰지 않는다. 성공 후 현재 DB 재조회. 충돌 시 재조회/재선택. 15초 결과 미확인·재시도, 중복 저장 차단, 로그아웃/화면 이탈 후 늦은 응답 무시.
- 같은 제작물/역할 Task가 여러 개면 임의 수정하지 않고 차단한다.

## 적용 내역

Management API/PAT로 프로젝트 ID `zzuytanimpiflygrwqfb`를 확인하고 새 테이블/RPC가 모두 없는 상태를 조회한 뒤 `202610150002_v03_schedule.sql`만 적용했다.

새 테이블: `v03_schedule_states`, `v03_schedule_requests` (owner SELECT RLS, 클라이언트 직접 쓰기 차단).
새 함수: `v03_update_schedule(uuid,text,text,text,bigint,bigint,uuid)`.

초기 migration `202610140001` 및 상태 migration `202610150001`은 수정하거나 원격 재실행하지 않았다. V02/main, AI/OCR, 알림 변경 없음. 관리자 키는 Git 제외 파일에서만 읽고 값은 출력하지 않았다.

## 로컬 자동 검증

- `npx vitest run tests/schedule.test.ts tests/schedule-schema.test.ts tests/collaboration.test.ts tests/home.test.ts`: **40개 통과**. 새 일정 경계/SQL/RLS와 조회 표시 검증만 선택 실행.
- PGlite의 독립 임시 DB에서는 fixture 구성을 위해 스키마 파일을 읽는다. 실제 원격 migration 재실행과 무관하다.
- `npx playwright test --config=playwright.storage.config.ts e2e/storage/schedule.spec.ts`: **6개 통과**, 모바일 Chromium / Supabase 응답 mock.
- 모바일 항목: 두 일정 독립 저장, 상세·홈·새로고침, 최초 검토 보존, 미기재/불명확/빈 날짜, 충돌 재조회, 동일 UUID 재시도, 최신 DB 읽기, 중복 조작 차단, 로그아웃 후 늦은 응답, 15초 제한시간 복구. 가로 넘침 없음.
- `npm run build`: 타입 검사 및 프로덕션 빌드 통과.

## 실제 원격 SDK 검증

재현 스크립트: `apps/v03/scripts/verify-schedule.mjs`, 명령 `npm run admin:verify:schedule`.

**32개 assertion 통과**(Auth 로그인 2회와 정리 확인 포함):

- 실제 일정 RPC의 가편/업로드 수정, 날짜 비우기/복원, 두 역할의 독립성.
- Source/Review/Import snapshot의 변경 없음. 협찬 status/revision 및 모든 기존 completed_at 불변. 완료 baseline은 해당 합성 계정 Task에 관리자 SQL로 설정했으며 기존 완료 RPC는 호출하지 않았다.
- 실제 동시 일정 요청에서 하나만 성공하고 하나는 충돌. stale revision 거부.
- 동일 UUID 재시도/동시 중복 요청 한 번 적용, 오래된 receipt 재생이 최신 날짜를 덮어쓰지 않음, 입력 변경 후 UUID 재사용 거부.
- 불명확한 일정은 Task를 만들지 않고 명시 날짜 지정에서만 일정 Task 한 개 생성.
- 타인 접근·receipt 재생 거부, 비로그인 거부, 신규 테이블 owner SELECT RLS, 직접 DELETE/Task 날짜 UPDATE 거부.
- 잘못된 날짜/0년/역할/정보 상태/날짜와 상태 불일치 거부.
- 합성 요청 UUID에만 실패하는 임시 receipt trigger로 실제 실패 유발. Task 날짜/metadata/revision 전체 rollback 확인, trigger/function 제거.

검증 중 생성된 계정 2개와 소유 데이터는 finally에서 정리했다. Auth 계정, V03 초기 7개 테이블, progress receipt 및 새 schedule 테이블 2개, 임시 trigger/function의 잔여 **0건**을 확인했다. 내부 recovery journal은 Git 제외 `.tmp`에만 보관하고 사용자 ID·검증 payload·자격증명을 commit하지 않는다.

## 실제 브라우저 검증

mock E2E와 별도로 `http://127.0.0.1:5183/`의 실제 앱에서 실제 Supabase Auth로 합성 검증 계정에 로그인했다.

1. 저장된 합성 협찬의 가편 전달일을 2026-10-20 → 2026-10-28로 수정, DB 재조회 후 주요 일정/Task 날짜 반영 확인.
2. 업로드 예정일을 2026-10-23 → 2026-11-02로 수정. 가편 날짜 유지 확인.
3. 두 최초 검토 펼침에는 원래 10월 20일/23일이 그대로 표시됨.
4. 홈 복귀 및 브라우저 새로고침 후 새 날짜가 다음 할 일/협찬 카드에 반영됨. 상태 및 Task 개수 유지.
5. 로그아웃 후 검증 전용 계정 1개와 데이터를 관리자 경로로 정리하고 Auth와 모든 V03 테이블 잔여 0건 확인.

실제 브라우저는 새 일정 입력/저장/최초 검토 비교/홈·새로고침 반영 흐름을 검증했다. 네트워크 유실/중복/로그아웃 중 늦은 응답은 위 mock E2E, 동시 충돌/rollback/소유권은 위 실제 원격 SDK 검증으로 구분한다.

## 미검증·제한

iOS Safari/Android 실기기와 다중 실제 브라우저 탭 동시 조작은 미검증이다. 모든 일정 변경의 전체 감사 이력 UI는 범위 밖이며 최초 검토와 현재 값을 보존한다. 이미 서버에 도착한 요청은 브라우저 취소/로그아웃만으로 rollback된다고 보장하지 않으므로 다시 로그인해 현재 DB를 조회해야 한다. AI/OCR·알림·실제 사용자 데이터는 사용하지 않았다.
