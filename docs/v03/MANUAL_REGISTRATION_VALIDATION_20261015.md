# 실제 협찬 수동 등록 P0 검증 · 2026-10-15

기준 커밋 `9d8eff6b`, 브랜치 `codex/v03-influencer-mvp`.

## 구현 및 서버 계약

- 실제 등록은 빈 입력/빈 목록이며 샘플 체험은 명시적으로 분리된다. 모드 변경 시 원본/입력은 초기화한다.
- 이름/플랫폼/메모 입력, 선택 가편·업로드 날짜, 자유 할 일·제작 조건 추가/수정/삭제. 원본 텍스트·이미지 대조와 사용자용 요약 후 최종 체크박스 확인으로 저장한다.
- 미입력은 null/빈 목록 및 날짜의 `input_state=not_entered`로 남기고 원문 미기재/불명확을 추정하지 않는다. 고정 후보 9개 확인을 요구하지 않는다.
- 수동 정보는 `origin=manual`. 입력 snapshot과 최초 날짜 기록에 AI 근거나 후보 review_state를 만들지 않는다. 수동 조건은 `review_state=manual`로 기록한다. 서버는 owner를 auth.uid()에서 결정한다.
- 샘플 화면의 원격 저장 경로를 제거했다. 새 migration에서 기존 mock prepare/commit 클라이언트 실행 권한도 제거했다. 과거 mock validator 및 기존 migration 본문은 유지한다.
- 새 수동 validator는 허용 필드/타입/길이/배열 수/날짜/이미지 manifest를 별도로 검증한다. 미허용 owner/status/review 필드를 받지 않는다.
- 기존 Import/private Storage 경계를 재사용한다. 동일 payload/UUID retry는 중복 생성하지 않으며 다른 입력/사용자는 거부한다. 실패 시 transaction rollback과 abort 이후 이미지 보상 삭제를 수행한다. 모호한 결과에서는 파일을 삭제하지 않고 같은 요청을 유지한다.
- 저장 후 기본 정보 편집·후속 가이드 추가·기존 날짜 제거 의미 변경은 추가하지 않았다.

## 적용

프로젝트 ID `zzuytanimpiflygrwqfb` 확인 후 manual validator/prepare/commit 함수가 모두 없는 것을 조회하고 Management API/PAT로 **`202610150003_v03_manual.sql`만 적용**했다. 기존 세 migration 파일을 수정하거나 원격 재실행하지 않았다.

새 함수 3개와 수동 조건의 review_state를 추가하고 기존 mock 저장 실행 권한을 제거했다. authenticated 직접 테이블 쓰기는 계속 차단된다. 기존 원본 조회와 상태/Task/일정 RPC는 변경하지 않았다.

## 로컬 테스트

- 선택 실행: `npx vitest run tests/manual.test.ts tests/manual-schema.test.ts tests/domain.test.ts tests/save.test.ts tests/collaboration.test.ts tests/home.test.ts` — **59개 통과**.
- 새 manual 단위·SQL 12개와 수동 저장 복구 3개 포함. 이름/날짜/길이·수동 출처·미입력·목록·서버 shape/권한/소유권/중복·late rollback 검증.
- PGlite 독립 fixture에서 스키마를 구성한 것은 원격 기존 migration 재실행이 아니다.
- 수동 등록·저장 mock 모바일 E2E **6개 통과**: 빈 초기값, 자유 목록 수정/삭제, 선택 날짜, 최종 요약 확인 gate, 로그인 중 샘플 원격 쓰기 0회, 이미지 선택/미리보기/수동 업로드, 저장 후 상세·새로고침, V02 sentinel 보존, 모호한 결과의 동일 요청 재시도, 원본 수정 후 입력 보존.
- 변경한 샘플 진입/로컬 검토 모바일 E2E **8개 통과**. 기존 9개 후보 검토 gate는 유지했다.
- 타입 검사·프로덕션 빌드 통과. 새 의존성 없음.

완료된 상태 변경/Task 완료 및 일정 수정 E2E/원격 검증은 다시 실행하지 않았다.

## 실제 원격 SDK — 26개 assertion 통과

재현: `npm run admin:verify:manual` / `apps/v03/scripts/verify-manual.mjs`.

합성 계정 2개와 합성 PNG 사용. 실제 manual RPC 등록, 이름/플랫폼/메모/선택 날짜/할 일/조건의 DB roundtrip, manual 출처·미입력 상태, owner 이미지 bytes roundtrip, 타인 DB/이미지·commit 및 익명 쓰기 거부, 동일/동시 UUID 중복 방지, 다른 payload retry 거부, 서버 잘못된 값/확인 누락/미허용 필드 거부, mock 저장 권한 제거, 직접 쓰기 차단을 확인했다.

이 run/user에만 반응하는 임시 Constraint INSERT 실패 trigger로 도메인 생성 후반의 실패를 유도했다. 협찬 등 최종 행 rollback, Import aborted, 업로드 PNG 보상 삭제를 실제로 확인했다. trigger/function은 제거했다.

finally에서 검증 계정·도메인·Import·Storage 파일을 정리했다. Auth/Storage/V03 전체 10개 테이블과 임시 trigger/function 잔여 **0건** 확인. ID/경로/recovery journal은 Git 제외 `.tmp`에만 두며 키·계정·payload 내용을 출력하지 않는다.

## 실제 브라우저 — mock E2E와 별도

실제 앱 `http://127.0.0.1:5183/`와 Supabase Auth/Storage/DB 사용. UI 응답 mock이나 세션 주입 없음.

1. 별도 합성 계정 로그인 → 실제 등록의 빈 텍스트/입력과 샘플 분리 확인.
2. 로컬 합성 PNG(600×320)를 브라우저 파일 선택 창으로 선택. 선택한 썸네일 및 원본 미리보기에서 이미지 표시 확인.
3. 텍스트 원본과 이미지 대조 화면에서 이름·플랫폼·메모·할 일 1개·조건 1개를 직접 입력. 날짜 둘은 비움.
4. 사용자용 요약에서 수동 출처, 입력하지 않은 날짜, 입력한 항목과 이미지 1장 확인. 체크박스 전 저장 비활성, 확인 후 실제 저장.
5. 상세에서 수동 출처, 메모/플랫폼/입력 항목, 두 날짜 ‘입력하지 않음’ 표시 확인.
6. `원본 이미지 보기`로 실제 private Storage 이미지 열람 및 다운로드 링크 표시. 새로고침 후에도 다시 열람 성공.
7. 관리자 읽기 집계로 manual committed Import 1개·메모 있는 협찬 1개·Storage 이미지 1개·manual provenance 기록 3개 확인.
8. 로그아웃 후 합성 계정·데이터·이미지를 삭제하고 Auth/Storage/V03 10개 테이블 잔여 **0건** 확인.

파일 선택 자동화에서 stale backend 오류가 발생했다. 새 파일 선택 창으로 다시 선택한 뒤 최종 흐름을 완료했다. 이를 제품 이미지 저장 결함으로 분류하지 않는다. 계정·키·실제 사용자 데이터는 기록/commit하지 않았다. 화면 증거는 Git 제외 `.tmp/manual-real-browser.jpg`다.

## 미검증 및 한계

- iOS Safari/Android Chrome **실기기 접근 없음**. 실제 모바일 날짜 picker·사진 보관함·회전 이미지·HEIC 안내·키보드 가림은 미검증이다.
- 입력은 메모리이며 저장 전 새로고침 시 사라진다. 원본 수정/요약 수정으로 돌아갈 때 수동 필드는 보존하지만 저장 시도 후 payload는 고정한다.
- 이미 시작된 서버 transaction은 화면 이탈/로그아웃만으로 취소가 보장되지 않는다. 모호한 저장은 동일 요청으로 확인하고 임시 파일 자동 정리는 다음 로그인에 의존한다. 강제 프로세스 종료 시 journal 기준 수동 정리가 필요할 수 있다.
- 기존 기본 정보 편집·후속 가이드 추가·사용자 날짜 제거 사유 분리는 후속 P0다. V02/main·AI/OCR·알림 변경 없음.
