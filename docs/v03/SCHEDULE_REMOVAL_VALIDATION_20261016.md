# 날짜의 명시적 사용자 제거 의미 분리 · 2026-10-16

기준 커밋 `dfe72881`, 브랜치 `codex/v03-influencer-mvp`.

## 계약 확인과 변경

기존 원문 미기재/불명확은 Review, manual 미입력은 최초 Review의 `input_state=not_entered`, 저장 후 기존 일정 수정 상태는 `v03_schedule_states.information_state`에 있었다. 기존 nullable Task 날짜만으로는 사용자 제거를 증명할 수 없으므로 이를 추정/분류하지 않는다.

| 의미 | 저장 근거 | 현재 표시 |
|---|---|---|
| 원문에 미기재 | 최초 Review `information_state=not_mentioned` | 원문에 미기재 |
| 불명확/판독 불가 | 최초 Review `information_state=uncertain` | 불명확 · 판독 불가 |
| 수동 등록 때 미입력 | 최초 manual Review `input_state=not_entered` | 수동 등록 시 입력하지 않음 |
| 명시적 사용자 제거 | 현재 metadata `date_state=removed`, `information_state=null`, 기존 Task `due_date=null` | 사용자가 날짜 제거함 |

기존 현재 metadata의 not_mentioned/uncertain은 기존 `현재 일정 미기재` / `현재 일정 불명확` 표시를 유지한다. marker가 없거나 Task 날짜만 null이라고 제거로 해석하지 않는다. 최초에 날짜가 있었더라도 현재 metadata가 없으면 `확정 일정 없음`이며 제거라고 추정하지 않는다.

새 UI는 기존 날짜가 있을 때만 `제거` → `제거 확인`을 제공한다. 취소는 저장 요청을 보내지 않는다. 날짜 input을 비우는 것만으로 제거하지 않으며 별도 명시적 조작이 필요하다. 원문/기존 정보 상태는 편집 화면에서 읽기 전용으로 남긴다. 제거 후에는 날짜 지정/복원으로 같은 Task의 날짜를 다시 저장한다.

## 적용 migration과 데이터 보존

프로젝트 `zzuytanimpiflygrwqfb` 및 미적용 상태 확인 후 **새 `202610160003_v03_schedule_removal.sql`만 Management API/PAT로 적용**했다. 기준 커밋의 기존 migration 6개는 수정하거나 재실행하지 않았다.

- metadata에 nullable `date_state` 컬럼 추가. 기존 행은 null 그대로이며 backfill/UPDATE/일괄 분류 없음.
- 제거일 때만 information_state=null을 허용하는 cross-field CHECK 추가. 원문 정보 상태로 사용자 제거를 위장하지 않는다.
- 기존 `v03_update_schedule` signature/소유권/두 revision/동일 UUID receipt 계약 유지. 역사적 파라미터 `p_information_state`의 새 command 값 `removed`를 명시적 요청으로만 허용한다. 기존 세 command 의미는 유지한다.
- 제거는 실제 날짜가 있는 단일 Task에서만 가능하다. Task가 없거나 날짜가 이미 없으면 거부한다. 동일 UUID retry는 기존 receipt를 반환하므로 정상 재시도는 이 guard 이전에 처리된다.
- Task ID/completed_at, 협찬 상태, 다른 날짜, Source/Import/manual snapshot/Review를 쓰지 않는다. 날짜 복원은 marker를 null로 해제하고 같은 Task를 사용한다.
- 적용 스크립트는 일정 metadata(새 컬럼 제외)와 모든 과거 receipt의 fingerprint를 적용 전후 비교했다. **동일함 확인**, 새 marker의 초기 비-null 행 0건 확인. fingerprint나 사용자 데이터 값은 출력하지 않았다.

## 로컬 검증

- `npx vitest run tests/removal.test.ts tests/removal-schema.test.ts tests/schedule.test.ts tests/manual.test.ts tests/collaboration.test.ts tests/home.test.ts`: **47개 통과**.
- 새 제거 단위/SQL 12개 포함. 4가지 의미/기존 값 추정 금지, completed Task 제거·복원, 같은 ID/다른 날짜/상태/증거 보존, 날짜 없는 제거 거부, stale version/타인/익명/직접 쓰기/다른 payload 재시도 거부, 후반 실패 rollback, manual 미입력→날짜 추가→제거→복원 후 최초 미입력 보존 검증.
- 독립 PGlite fixture 구성을 위해 스키마 파일을 읽은 것이며 실제 원격 기존 migration을 재실행한 것이 아니다.
- `npx playwright test --config=playwright.storage.config.ts e2e/storage/removal.spec.ts e2e/storage/schedule.spec.ts`: **15개 통과**(새 제거 9개 + 변경 영향을 받는 기존 일정 화면 6개), 모바일 Chromium / Supabase 응답 mock.
- 명시적 제거 확인/취소, 완료 Task 보존, 날짜 복원, 최초 날짜 표시, 홈·새로고침, 미완료 제거 Task 유지, 3가지 초기 미확정 상태/기존 metadata 의미, 충돌 재조회, 응답 유실 후 동일 UUID/최신 복원값 조회, 중복 조작 차단·로그아웃 후 늦은 응답을 확인했다. 기존 일정 제한시간 복구도 해당 화면 회귀에 포함한다.
- 타입 검사·프로덕션 빌드 통과. 추가 의존성 없음. 상태/Task 완료/기본 정보 편집의 완료된 검증은 반복하지 않았다.

## 실제 Supabase SDK 검증

`npm run admin:verify:removal` / `apps/v03/scripts/verify-removal.mjs`: **31개 assertion 통과**(Auth 로그인 2회/정리 포함).

- 실제 제거 marker/null 날짜/같은 Task ID 및 completed_at 유지, 다른 날짜/상태/revision 유지.
- 같은 Task로 복원, marker 해제, 오래된 제거 receipt가 새 복원 날짜를 덮어쓰지 않음.
- 실제 동시 동일 UUID는 한 번 적용, 제거/날짜 변경 경쟁은 하나 성공/하나 충돌.
- 날짜가 없는 신규 제거/미입력 제거/날짜를 포함한 제거 거부, 일정/Task stale version 각각 거부.
- 합성 legacy Review fixture의 원문 미기재/불명확, manual 미입력 snapshot, 기존 unresolved metadata의 marker 없음 확인. legacy fixture는 테스트 계정에만 관리자 경로로 구성했으며 실제 기존 사용자 데이터는 분류하지 않았다.
- 소유권·receipt RLS·익명/타인 거부·직접 metadata UPDATE 차단, 전체 Source/Import/manual snapshot/Review 불변.
- 합성 request UUID에 한정한 receipt INSERT 실패 trigger로 실제 rollback 확인. Task 날짜·metadata·revision 모두 보존되고 trigger/function 제거됨.

검증 계정 2개와 관련 데이터를 finally로 정리했다. Auth/Storage/V03 11개 테이블/임시 trigger·function 잔여 **0건** 확인. 복구 journal은 Git 제외 `.tmp`에만 있으며 키·계정 ID·payload 값은 출력하지 않았다.

## 실제 브라우저 검증 — SDK/mock과 별도

실제 `http://127.0.0.1:5183/` 앱과 Supabase를 사용했다. 별도 합성 계정 1개에 날짜 있는 협찬, 수동 미입력 협찬, 원문 미기재/불명확 legacy fixture 협찬을 준비했다. 실제 사용자 데이터나 브라우저 응답 mock/세션 주입은 없다.

1. 로그인 후 홈에서 원문 미기재/불명확과 수동 등록 시 미입력을 각각 확인.
2. 날짜 있는 협찬의 제거 확인 화면 → 취소 → 다시 명시적으로 제거. 가편 날짜만 `사용자가 날짜 제거함` 표시.
3. 최초 수동 입력 펼침에는 원래 날짜(2026-10-25)가 그대로 있고, 기존 completed Task의 되돌리기 버튼 유지. 업로드 날짜는 2026-11-08 그대로임을 확인.
4. 홈 복귀 및 새로고침 후 제거 표시 유지.
5. 날짜 지정/복원으로 2026-11-02 저장. 상세 새로고침 및 홈에서 복원된 날짜 확인, completed 값과 다른 날짜 유지.
6. 별도 원격 읽기로 같은 Task ID/완료 값·최초 날짜·다른 날짜·협찬 상태 및 복원 metadata를 확인.
7. 로그아웃 후 합성 계정·세 협찬·관련 데이터를 정리하고 Auth/Storage/V03 11개 테이블 잔여 **0건** 확인.

화면 증거는 Git 제외 `.tmp/removal-real-browser.jpg`다. 이미지 업로드 등 이전 완료 기능은 반복 검증하지 않았다.

## 미검증·제한

iOS Safari/Android Chrome 실기기 및 다중 실제 탭 동시 조작은 미검증이다. 동시성은 실제 SDK 병렬 요청으로 검증했다. 전체 변경 이력 UI는 추가하지 않으며 최초 기록과 현재 값 및 기존 receipt를 보존한다. 이미 시작된 transaction은 화면 이탈/로그아웃만으로 취소가 보장되지 않으므로 다시 로그인해 현재 DB를 조회한다. 후속 가이드·AI/OCR·알림·V02/main 변경 없음.
