# V03 원격 적용·검증 기록 · 2026-10-15 (KST)

## 실제 적용

- 대상: `zzuytanimpiflygrwqfb`. Management API가 반환한 프로젝트 식별자와 로컬 공개 URL/ref를 대조했다.
- 적용 전 public 스키마에 V03 테이블이 없었다. V02 보호 대상 `inbox`, `schedules`도 없었다.
- `apps/v03/supabase/migrations/202610140001_v03_initial.sql`을 Management API/PAT로 한 번 실행했다. SQL 파일 자체의 BEGIN/COMMIT을 사용했다.
- 파일 SHA-256: `f72a02ed433a82d22bb2cf26e385b55467eee0ae7af237266458254bb0ce2cde`.
- V03 테이블 7개, 소유자 읽기 RLS, 검토/저장/중단 RPC, private `v03-sources` bucket 및 Storage 정책 4개를 확인했다.
- Supabase CLI migration 명령은 사용하지 않았다. 별도 migration history 행은 작성하지 않았다. 재적용 시 기존 스키마를 먼저 조회해야 한다.

## 실제 원격 검증

식별 가능한 `v03-qa-` 접두사의 임시 계정 2개, 합성 브리프와 PNG 이미지를 사용했다. 계정·토큰·비밀번호·원문·이미지 내용은 출력하지 않았다. 브라우저 UI 대신 실제 Supabase JS SDK와 앱의 `saveReviewed`/`cleanupExpired`를 Node에서 호출했다.

56개 검증 assertion이 통과했다.

- Auth 관리자 계정 생성, 이메일 확인된 계정의 password 로그인 및 로그아웃.
- private bucket, 10MB 제한, 전체 테이블 소유자 정책.
- 모든 테이블의 익명 읽기 거부, 익명 RPC 거부, 클라이언트 직접 쓰기 거부.
- 미확인 후보 payload 서버 거부 및 import 미생성.
- 검토 완료 payload와 실제 이미지 저장. Collaboration/Content/Source 각 1개, Task 5개, Constraint 4개, Review 9개 확인.
- 동일 요청 재시도 시 같은 결과 반환 및 도메인 데이터 중복 없음.
- 두 사용자 간 7개 테이블 양방향 읽기 격리. 타인 import ID 재사용·commit 거부.
- 소유자 원본 이미지 다운로드 성공. 타인·익명 다운로드 및 public URL 접근 실패.
- commit 이후 이미지 덮어쓰기·삭제 거부, manifest 밖 업로드 거부.
- 검증용 import에만 반응하는 임시 Task INSERT 실패 트리거로 commit 도중 오류 유도. 실제 앱 저장 함수가 최종 도메인 행을 남기지 않고 import를 aborted 처리하고 staging 이미지 bytes를 보상 삭제함을 확인.
- aborted import commit 거부 및 로그인 정리 함수의 재처리 성공.

추가 DB 카탈로그 점검: 모든 제약조건 validated, Storage 정책 4개, 검증용 임시 함수·트리거 0개. 테이블 ACL도 authenticated SELECT만 허용하고 INSERT/UPDATE/DELETE와 anon 접근을 차단하는지 확인했다.

## 정리

검증 계정 UUID에 한정해 Storage API로 이미지 bytes를 삭제하고, 관계 순서대로 V03 검증 행을 삭제한 후 Auth 관리자 API로 임시 계정을 삭제했다. 해당 계정·7개 테이블 행·Storage object가 모두 0개임을 재조회했다. 임시 실패 함수·트리거도 삭제했다. 실제 앱 스키마·bucket·정책은 유지했다.

## 실패·미검증 및 한계

- 이번 원격 검증에서 실패한 assertion이나 정리 실패는 없었다. 접근 거부·주입된 저장 실패는 기대한 성공 조건이다.
- 실제 브라우저 로그인 UI와 이메일 발송·가입 확인·비밀번호 재설정 흐름은 검증하지 않았다.
- 응답 유실·상태 조회 동시 실패, 브라우저 강제 종료, Storage 삭제 API 자체 실패, 24시간 경과 pending 정리, 동시 저장 경합은 이번 원격 테스트 대상이 아니었다.
- 모든 이미지 포맷·용량 경계와 장기 부하·성능은 이번 원격 테스트 대상이 아니었다.
- AI/OCR은 연결하지 않았다. V02 코드/main 및 기존 사용자 데이터는 변경하지 않았다. 커밋·push·배포는 하지 않았다.

## 재현용 SDK 검증 스크립트

Node 24.5 이상에서 `apps/v03`의 의존성을 `npm ci`로 설치하고, Git 제외 파일 `.env.local`에 V03 공개 설정, `scripts/.env.admin.local`에 관리자 PAT/secret을 직접 입력한다. 값을 커밋하거나 로그로 출력하지 않는다.

```bash
cd apps/v03
npm run admin:check
npm run admin:verify
```

`admin:verify`는 기존 스키마가 필요하며 migration을 실행하는 코드가 없다. 실제 계정·합성 데이터·이미지를 만들고 이번 import UUID에만 반응하는 임시 실패 트리거를 사용하므로 운영 데이터가 적은 시간에 실행한다. 정상 종료 및 잡힌 예외에서는 finally 정리를 수행한다. 프로세스 강제 종료·네트워크 단절 때 정리가 보장되지는 않는다. 복구용 계정 UUID·이미지 경로·결과 journal은 Git 제외 `apps/v03/.tmp/v03-qa-*-journal.json`에만 기록한다. journal은 커밋하지 않는다. 강제 종료 시 이 journal에 한정해 수동으로 정리해야 한다.

재현판은 원래 검증에 더해 기존 스키마/RLS 사전 조건과 실제 commit RPC의 주입된 오류 식별도 확인한다. 과거의 56개 기록과 재현판의 assertion 수는 구분한다. 브라우저 실제 검증은 별도 기록에 남긴다.

재현판 재실행 결과: 58개 assertion 통과, 계정·테이블 행·Storage object 잔여 0건. 실제 commit RPC의 `v03_qa_injected_failure` 응답 확인을 포함한다. 단위/SQL 테스트 46개와 타입 검사·빌드도 통과했다. Migration은 재실행하지 않았다.
