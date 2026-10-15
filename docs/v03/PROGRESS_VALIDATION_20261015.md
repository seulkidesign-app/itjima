# 협찬 상태·Task 완료 P0 · 2026-10-15 (KST)

## 기준 및 실제 DB 적용

기준은 `codex/v03-influencer-mvp`의 `20de0ebb64e2cbb499515d74c36795690fe596f5`다.

대상 `zzuytanimpiflygrwqfb`를 Management API로 확인하고 progress 컬럼/receipt/RPC가 없는 상태를 조회했다. 새 migration `apps/v03/supabase/migrations/202610150001_v03_progress.sql`만 PAT/Management API로 한 번 추가 적용했다. 초기 migration은 수정하거나 원격 재실행하지 않았다.

새 SQL SHA-256: `d3317754dd5cd6ec6231fcb2c2961d6e84a133ddc3a92a63cf63c874ad934bc9`.

- 협찬과 Task 각각에 독립적인 revision을 추가했다. 기존 행의 초기값은 0이다.
- 상태 7종 및 완료 boolean을 서버에서 검사하고, auth.uid() 소유자 조건으로 행을 lock한 뒤 expected revision을 비교한다. 건너뛰기/복귀를 허용하며 다른 도메인을 자동 변경하지 않는다.
- 같은 요청 ID를 transaction advisory lock으로 직렬화하고, 행 변경과 receipt 생성을 동일 transaction에 저장한다. 동일 입력 재시도는 원래 결과를 반환하며 다른 사용자/입력의 ID 재사용은 거부한다.
- 새 receipt 테이블도 소유자 SELECT RLS와 직접 쓰기 차단을 적용했다. 내부 helper 실행 권한은 클라이언트에 없다. 기존 테이블의 쓰기 권한은 확대하지 않았다.
- Supabase CLI migration history에는 별도 행을 추가하지 않았다. 적용 도구는 이미 존재하는 progress 스키마를 재실행하지 않고 부분 상태에서는 중단한다.

## UI 및 클라이언트

상세에서 협찬 상태와 할 일 완료/미완료를 각각 조작한다. 저장 중에는 shared lock/ref와 비활성 버튼으로 중복 조작을 막는다. 성공 후 현재 DB 상태를 재조회하며 홈 복귀와 새로고침에도 반영된다. 오래된 성공 receipt가 반환돼도 그 값을 화면에 직접 덮어쓰지 않는다.

실패하면 원문 서버 오류 대신 고정된 안내를 표시한다. 결과 불명확/15초 제한 시 같은 request UUID로 재시도하거나 최신 내용을 조회할 수 있다. 충돌은 최신 내용을 읽고 사용자가 다시 선택하게 하며 자동 재적용/강제 덮어쓰기를 하지 않는다. 로그아웃·세션/라우트 변경 후 도착한 응답은 반영하지 않는다.

## 로컬 자동화 (실제 원격 DB 사용 안 함)

- 단위/실제 PGlite PostgreSQL·RLS 테스트: 9개 파일, 76개 통과.
- 새 SQL 테스트는 7개 상태·역방향/건너뛰기, 전체 Task 완료의 독립성, 미완료 복귀, 동일 요청 재시도·입력 변경 거부, stale/ABA 충돌, 소유권/익명/receipt RLS, 허용 값과 직접 쓰기 차단, receipt 실패 시 원자적 rollback을 검증한다.
- 모바일 브리프 E2E 8개 + Supabase 응답 mock 홈/상세/저장/변경 E2E 24개, 총 32개 통과.
- 변경 E2E는 상태 7종, 완료·취소와 홈 반영, 충돌 후 재조회/재선택, 응답 유실 시 동일 요청 재시도 및 더 최신 값 유지, 중복 클릭 방지, 로그아웃 후 늦은 응답 무시, 저장 시간 초과 후 receipt 복구를 포함한다.
- 타입 검사·프로덕션 빌드 통과. 신규 의존성은 없다. 캡처는 합성 fixture이며 Git 제외 산출물이다.

## 실제 Supabase SDK 검증

`npm run admin:verify:progress`를 실행해 41개 assertion이 통과했다. 식별 가능한 임시 Auth 계정 2개와 합성 협찬/Task를 사용했고 자격증명·계정 UUID·원문을 출력하지 않았다.

- 실제 Auth 로그인, 상태 7종과 복귀, 서버 완료 시각과 미완료 복귀 확인.
- 협찬을 완료해도 Task가 미완료로 남으며 모든 Task를 완료해도 협찬 상태가 유지됨을 확인.
- 실제 동시 다른 요청은 하나만 성공하고 다른 요청은 conflict, revision도 한 번만 증가함을 확인.
- 상태가 바뀌었다 돌아와도 오래된 revision을 거부함을 확인.
- 같은 요청의 동시 호출은 한 번만 적용됐고, 이후 다른 수정이 있어도 과거 receipt 재생이 현재 데이터를 바꾸지 않음을 확인.
- 타인 상태/Task 변경 및 receipt 재생, 익명 실행, 잘못된 상태/null 완료/음수 버전, 직접 UPDATE 거부 확인.
- 이번 검증 요청 UUID에만 작동하는 임시 receipt INSERT 실패 트리거로 실제 행 변경 후 실패를 유도했다. 상태와 revision이 함께 rollback됨을 확인했다.
- finally에서 임시 함수·트리거, 검증 계정과 도메인 데이터를 삭제했다. Auth, 8개 V03 테이블(receipts 포함), 임시 함수/트리거 잔여 0건을 확인했다.

## 실제 로컬 브라우저 검증

SDK 검증과 별도로 임시 계정 1개 및 합성 협찬 4건을 준비해 `http://127.0.0.1:5183/`을 실제 Auth/DB에 연결했다.

- 상세에서 제작 중 → 완료로 건너뛰기 및 홈의 완료 목록 반영, 미완료 Task 5개 유지 확인.
- 완료 → 제안/협의 복귀 후 가편 Task 완료 처리. 협찬 상태는 그대로이며 홈 진행 중 미완료 Task가 8개에서 7개로 바뀜을 확인.
- Task를 미완료로 되돌리고 새로고침해도 유지됨을 확인.
- 상세가 읽은 이후 별도의 실제 로그인 세션에서 더 최신 상태를 저장했다. 브라우저의 오래된 저장은 충돌 안내 및 조작 잠금으로 처리됐고 최신 내용 재조회 시 별도 세션의 값이 보존됐다. 다시 명시적으로 선택한 변경만 저장됐다.
- 로그아웃 후 편집 UI와 데이터가 사라짐을 확인했다. 검증 계정과 연결 행/receipts를 정리하고 잔여 0건을 재조회했다.

## 재현·한계

Node 24.5 이상, V03 의존성과 Git 제외 공개/관리자 환경 파일이 필요하다.

```bash
cd apps/v03
npm run admin:apply:progress           # 상태 조회만 수행
npm run admin:verify:progress          # 합성 계정·데이터 생성, 실제 검증, finally 정리
npm test
npm run test:e2e
npm run test:e2e:storage
npm run build
```

원격 검증 journal은 Git 제외 `.tmp/v03-qa-progress-*-journal.json`에만 남긴다. 프로세스 강제 종료나 네트워크 단절로 finally 정리가 실패하면 journal에 한정해 수동 정리해야 한다. 실제 인증/DB와의 동시 충돌은 검증했으나 실제 브라우저 네트워크 단절/응답 유실은 mock E2E로 검증했다. 대량/장시간 부하 및 receipt 만료·정리 작업은 범위 밖이다.

요청 취소나 화면 이탈이 이미 시작된 DB transaction을 되돌렸다는 뜻은 아니다. 같은 요청 재시도 또는 재조회가 필요하다. 탭 간 실시간 푸시는 추가하지 않았으며 다른 열린 화면은 재조회할 때 반영된다. 관리자 등 RPC 밖 직접 수정이 revision을 올리지 않으면 그 변경은 CAS 감지 범위 밖이다.

V02/main, AI/OCR, 알림은 변경하지 않았다. 기존 migration은 보존했다. 비밀 값·검증 데이터·journal·node_modules·빌드/테스트 산출물은 커밋하지 않는다.
