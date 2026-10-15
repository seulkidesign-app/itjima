# 저장된 협찬 기본 정보 수정 P0 · 2026-10-16

기준 `7b27f77e`, 브랜치 `codex/v03-influencer-mvp`.

## 범위와 보존

상세의 `현재 운영 정보`에서 기존 이름·메모와 콘텐츠별 플랫폼을 표시한다. `기본 정보 수정`은 기존 값을 채우며 저장/취소를 제공한다. 이름은 필수(120자), 메모는 선택(5,000자), 플랫폼은 선택(120자)이다. 빈 메모·플랫폼은 null/입력하지 않음으로 저장하며 원문 미기재로 판단하지 않는다.

플랫폼은 Content 필드다. 콘텐츠가 한 개면 해당 대상을 명시하고, 여러 개면 기본값은 `플랫폼 수정 안 함 · 이름/메모만`이다. 콘텐츠 번호·이름·현재 플랫폼으로 선택 대상을 구분하며 선택한 ID만 RPC로 보낸다. 다른 콘텐츠의 플랫폼/제목은 변경하지 않는다. 협찬 이름 변경도 콘텐츠 제목 일괄 변경으로 취급하지 않는다.

현재 필드와 최초 수동 입력 snapshot을 별도로 보여준다. 수동 snapshot이 없으면 최초 값을 추정하지 않는다. 기존 mock의 플랫폼 Constraint는 현재 운영 플랫폼과 혼동하지 않도록 `최초 검토 플랫폼 · 참고`로 표시한다. Source·Import payload·Review는 쓰지 않으며 초기값을 현재값으로 덮어쓰지 않는다.

상태/일정/Task 완료는 자동 변경하지 않는다. 기존 상태/Task/일정 RPC는 수정하거나 재검증하지 않았다. 후속 가이드·날짜 제거 의미·AI/OCR·알림·V02/main은 범위 밖이다.

## 적용 migration

프로젝트 ID `zzuytanimpiflygrwqfb`와 미적용 상태를 확인한 뒤 Management API/PAT로 아래 새 파일만 적용했다.

1. `202610160001_v03_basic_info.sql`: Content revision, owner SELECT RLS receipt 테이블, `v03_update_basic_info` 추가.
2. `202610160002_v03_basic_whitespace.sql`: 탭/줄바꿈/유니코드 공백만 있는 이름을 거부하고 선택 필드도 브라우저 trim과 같이 정규화. 첫 파일 적용 후 검증 보강이 필요해 별도 migration으로 추가했다. 첫 파일은 존재 검사 후 건너뛰었으며 재실행하지 않았다.

기준 커밋의 초기/progress/schedule/manual migration 4개는 파일 변경·원격 재실행 모두 없다. 이미 적용한 첫 basic migration도 수정하지 않았다.

RPC는 auth.uid 소유권, 콘텐츠의 해당 협찬 소속, 이름/빈 값/길이, 두 기대 버전을 검증한다. Collaboration revision은 기존 상태 변경과 공유하므로 중간 상태 변경도 충돌로 감지한다. 선택 Content revision은 별도로 비교한다. 행 잠금 후 이름/메모와 선택 플랫폼 및 receipt를 한 transaction으로 저장한다. 직접 테이블 쓰기와 내부 정규화 helper의 클라이언트 실행은 차단한다.

동일 사용자·대상·기대 버전·정규화된 값·요청 UUID의 재시도는 기존 receipt를 반환한다. 다른 값/대상/사용자는 거부한다. UI는 오래된 receipt로 값을 덮어쓰지 않고 현재 DB를 다시 읽는다. 충돌 시 재조회 후 재입력하며, 저장 중 중복/취소를 막고 15초 결과 미확인·동일 요청 재시도 및 로그아웃/이탈 후 늦은 응답 무시를 처리한다.

## 로컬 검증

- `npx vitest run tests/basic.test.ts tests/basic-schema.test.ts tests/collaboration.test.ts tests/home.test.ts`: **33개 통과**. 새 기본 정보 단위/SQL 16개와 조회 관련 테스트를 선택 실행했다.
- PGlite는 독립 임시 DB에 fixture 스키마를 구성한다. 실제 원격 기존 migration 재실행이 아니다.
- `npx playwright test --config=playwright.storage.config.ts e2e/storage/basic.spec.ts`: **7개 통과**, 모바일 Chromium / Supabase 응답 mock.
- 항목: 기존 값/취소/빈 이름, 현재값·최초값 분리, 홈·새로고침, 다중 콘텐츠 명시적 선택/다른 콘텐츠 불변, 선택 필드 제거, Content 충돌, 응답 유실 후 동일 UUID/최신값 재조회, 중복 조작 차단·로그아웃 늦은 응답, 15초 제한시간 복구. 가로 넘침 없음.
- 타입 검사·프로덕션 빌드 통과. 새 의존성 없음.
- 저장소 루트에서 잘못 실행된 빌드 명령은 vitest를 찾지 못했다. V03 앱 경로를 명시한 빌드는 통과했으며 루트 파일 변경이나 V02 테스트 실행은 없었다.

## 실제 원격 SDK 검증

명령 `npm run admin:verify:basic`, 스크립트 `apps/v03/scripts/verify-basic.mjs`.

최종 실행 **34개 assertion 통과**(Auth 로그인 2회/정리 포함). 공백 검증 보강 전 실행도 통과했지만 개수를 합산하지 않는다.

- 이름/메모/선택 플랫폼의 원자적 저장 및 DB roundtrip.
- 다른 콘텐츠 불변, 콘텐츠 없는 공통 정보만의 저장, 다른 협찬 콘텐츠 ID 주입 거부.
- 소유권·익명 거부·타인 receipt 재생 거부·receipt RLS·기존 직접 쓰기 차단.
- 공백/탭/줄바꿈/유니코드 공백 이름 및 길이 초과 거부, 선택 필드 비우기/null 정규화.
- 실제 동시 두 작성자 중 한 요청만 성공, Collaboration/Content stale version 각각 거부.
- 동일 요청 재시도/동시 중복 요청 한 번 적용, 오래된 receipt가 최신 값을 덮어쓰지 않음, 다른 값의 UUID 재사용 거부.
- Source/Review/manual 입력 snapshot/Import/Task/일정 metadata snapshot 동일, 상태 유지. 완료 Task baseline은 합성 데이터에 관리자 SQL로 설정했으며 기존 완료 RPC는 호출하지 않았다.
- 특정 합성 요청 UUID에만 실패하는 임시 receipt trigger로 후반 오류 유도. 협찬/선택 콘텐츠 값과 두 버전 모두 rollback 확인. 임시 trigger/function 제거.

각 실행에서 생성한 합성 계정 2개와 관련 데이터를 finally로 정리했다. Auth/Storage/V03 11개 테이블/임시 trigger·function 잔여 **0건** 확인. journal은 Git 제외 `.tmp`에만 보관한다. 키·계정 ID·개인 데이터·payload 값은 출력하지 않았다.

## 실제 브라우저 검증 — SDK/mock과 별도

실제 `http://127.0.0.1:5183/` 앱과 실제 Supabase를 사용했다. 별도 합성 계정 1개 및 수동 등록 fixture를 준비했으며 세션 주입/브라우저 응답 mock은 없다.

1. 로그인 → 저장된 합성 협찬 상세 → 이름/메모/플랫폼 기존 값 채움 확인.
2. 이름 변경 후 취소 → 다시 열면 원래 값 복원 확인.
3. 이름·메모·플랫폼 수정 후 저장, 상세 재조회/수동 snapshot 펼침으로 현재와 최초 정보 구분 확인.
4. 홈에 새 협찬 이름 반영, 홈 새로고침 및 상세 새로고침 후 편집 폼의 새 이름/메모/플랫폼 재조회 확인.
5. 메모·플랫폼을 빈 값으로 저장하면 ‘입력하지 않음’으로 표시, 최초 메모/플랫폼 snapshot은 그대로 표시됨을 확인.
6. 로그아웃 후 전용 계정·데이터 정리. Auth/Storage/V03 11개 테이블 잔여 **0건** 확인.

화면 증거는 Git 제외 `.tmp/basic-real-browser.jpg`다. 실제 브라우저에서는 기본 편집 흐름, 동시/오류·격리는 위 원격 SDK 및 mock E2E로 구분한다.

## 미검증·제한

- iOS Safari/Android Chrome 실기기와 다중 실제 브라우저 탭 동시 조작은 미검증이다.
- 현재 값/최초 manual snapshot 비교를 제공하며 전체 변경 이력 UI는 추가하지 않는다. 이후 추가된 다른 콘텐츠의 최초 플랫폼을 등록 당시 기본 제작물 플랫폼으로 추정하지 않는다.
- 홈은 협찬 이름을 반영한다. 플랫폼/메모를 홈 핵심 영역에 새로 노출하지 않는다.
- 화면 이탈/로그아웃은 이미 시작된 서버 transaction의 취소를 보장하지 않는다. 모호한 결과는 재로그인 후 DB를 다시 조회한다.
