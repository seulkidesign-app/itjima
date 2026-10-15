# Itjima V03 · 독립 협찬 앱

[제품 기준](../../docs/v03/README.md) / [검토 계약](../../docs/v03/DATA_AND_REVIEW_CONTRACT.md).

```bash
cd apps/v03
npm ci
npm run dev
```

Node 22.12 이상. 개발 5183 / preview 4183. 자체 root/envDir/package-lock을 사용하며 V02 root package·실행·빌드는 변경하지 않는다.

```bash
npm test
npm run build
V03_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
V03_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e:storage
```

일반 환경에서는 `npx playwright install chromium` 후 npm run test:e2e를 사용한다. 테스트는 별도 가짜 설정으로 실행하며 실제 DB에 접근하지 않는다.

## 동작

`#/` → `#/brief/new` → `#/brief/preview` → `#/brief/review`.

텍스트/스크린샷 선택, 원본 미리보기, 일정/할 일/제작 제약조건 mock 검토. 후보는 예시이며 실제 원본 분석이 아니다. 이미지는 압축하지 않고 최대 4장, 각 10MB의 JPG/PNG/WebP를 허용한다. 손상 이미지는 거부한다.

정보 상태와 검토 상태를 별도로 관리한다. 수정하면 미확인으로 돌아가며 명시적으로 후보 확인이 필요하다. 날짜는 각각 연도를 선택하거나 불명확/미기재로 남긴다. 모든 후보와 협찬 이름 확인 전에는 payload를 만들지 않는다.

DB 설정이 없으면 버튼은 로컬 payload만 표시한다. URL/ref/key와 V03 로그인 연결 시 서버 검증 후 실제 저장한다. 저장 시도 후 같은 내용으로 재시도하며 중복 제출을 방지한다. 앱 입력은 메모리만 사용하고 새로고침 시 사라진다. 로그인 세션만 V03 전용 키에 보관한다. 별도 draft 영구 복원은 아직 없다.

## Supabase 설정

`.env.example`을 참고해 앱 `.env.local` 또는 환경 설정에 다음을 입력한다. key는 커밋하지 않는다.

- VITE_V03_SUPABASE_URL=https://zzuytanimpiflygrwqfb.supabase.co
- VITE_V03_SUPABASE_PROJECT_REF=zzuytanimpiflygrwqfb
- VITE_V03_SUPABASE_PUBLISHABLE_KEY: 해당 프로젝트 공개 key

V02 변수 fallback, 알려진 V02 ref, service-role/secret key는 차단한다. Site URL/redirect URL은 V03 origin으로 설정한다. 가입 이메일 확인 정책을 따른다. 제한된 cloud egress에는 실제 프로젝트 hostname이 필요하다.

[초기 SQL migration](supabase/migrations/202610140001_v03_initial.sql)은 V03 프로젝트에 이미 적용했다. [원격 적용 기록](../../docs/v03/REMOTE_VALIDATION_20261015.md)을 참고하며 재실행하지 않는다. DB 변경은 별도 migration으로 추가한다. 공개 key로 DDL을 적용하지 않으며 V02 테이블/ref가 감지되면 중단한다.

테이블: v03_collaborations / contents / tasks / sources / constraints / reviews / imports. 각 소유자 RLS 및 관계 복합 FK, 클라이언트 직접 쓰기 금지, RPC-only 쓰기. private v03-sources bucket의 경로는 user/import/image ID이며 manifest 밖 접근은 거부한다.

## transaction과 파일 보상

prepare RPC에서 검토 완료 payload 재검증 → private 이미지 staging → commit RPC에서 모든 도메인 행을 단일 트랜잭션으로 생성한다. 중간 실패 시 DB 전체 rollback, 동일 request UUID 재시도는 기존 결과를 반환한다. 서버는 client의 tasks/constraints projection 대신 검토 목록에서 최종 행을 만든다.

이미지 bytes는 DB transaction과 별개다. 실패 시 상태 조회로 이미 성공한 요청인지 확인하고, pending import를 원자적으로 aborted 처리한 뒤 보상 삭제한다. 상태 조회도 실패하면 파일을 삭제하지 않고 같은 UUID로 재시도한다. 파일 정리 실패/브라우저 종료로 임시 파일이 남을 수 있으며 aborted 및 24시간 지난 pending import를 다음 로그인에서 재정리한다. 재로그인하지 않으면 정리가 지연될 수 있고 server cleanup job은 아직 없다. 최종 domain 데이터와 기술적 staging import를 구분한다.

## 미연결 범위

실제 AI/OCR, 빠른 입력, 알림, resurfacing, V02 자동 일정 저장은 연결하지 않았다. 실제 원격 migration·Auth·Storage 검증은 별도 단계다. PGlite의 실제 PostgreSQL SQL/RLS 테스트와 Supabase 응답 mock을 사용하는 SDK 모바일 테스트를 실제 운영 검증으로 주장하지 않는다.

## 재구성 검증

V03 단위/실제 PostgreSQL SQL·RLS 테스트 41개, 모바일 E2E 8개, SDK 인증·RPC 저장 mock E2E 1개, 타입 검사·빌드·소스 lint 통과. V02 release 705개와 빌드·번들 예산 검사 통과. 실제 원격 Supabase migration이나 실제 Auth/Storage 호출 검증은 수행하지 않았다.

## 최신 키 기반 서버 검증

Migration은 Management API/PAT를 우선 사용한다. 서버 전용 변수는 `V03_SUPABASE_ACCESS_TOKEN`과 `V03_SUPABASE_SECRET_KEY` (`sb_secret_…`)이며 `V03_SUPABASE_SERVICE_ROLE_KEY` fallback은 없다. Secret key는 브라우저/VITE 변수/.env.example에 넣지 않는다. Auth admin 검증에서는 `apikey`로만 전송하고 JWT/Bearer로 취급하지 않는다. PAT의 Bearer 헤더는 api.supabase.com에만 사용한다.

Node 24.5 이상과 해당 실행 환경의 proxy/CA trust를 유지한 상태에서 `npm run admin:check`로 읽기 검증한다. `npm run admin:apply`는 별도로 승인된 migration 적용용이며 예상 V03 ref와 기존 schema 여부를 확인한 뒤 Management API로 SQL을 전송한다. 이번 변경에서 원격 migration을 실행하지 않았다. `--use-env-proxy`를 사용하며 네트워크 제한을 우회하지 않는다.

필요한 hostname은 `api.supabase.com`, `zzuytanimpiflygrwqfb.supabase.co`다. Cloud draft 저장과 실제 실행 환경 반영을 구분한다. 현재 인스턴스에 변수/네트워크가 없으면 새로 게시된 환경에 연결한 뒤 검증해야 한다. 기존 SERVICE_ROLE_KEY 요구사항이 UI에 남아 있으면 제거하고 SECRET_KEY binding을 사용한다.


## 협찬 상세 · 조회 P0

저장 성공 시 `#/collaborations/<UUID>`로 이동한다. 같은 URL을 새로고침하거나 직접 열어도 V03 로그인 세션으로 Supabase를 다시 조회한다. 로그인하지 않았다면 URL을 유지하고 로그인 안내를 표시한다. RLS로 숨겨진 협찬과 없는 협찬은 같은 접근 불가 안내를 사용한다.

브랜드/캠페인 이름, 사용자가 저장한 상태, 가편/업로드 날짜, 할 일, 제작 조건, 원본 텍스트와 private 이미지를 조회한다. 날짜는 Task에서 읽고, 날짜/값이 없는 이유는 Review의 미기재·불명확 상태를 보존한다. 원본 이미지는 버튼을 눌렀을 때 인증된 Storage download를 사용하며 메모리 blob URL은 화면을 떠날 때 폐기한다. 상태/할 일 외의 편집·자동 상태 전이·알림은 추가하지 않았다.

상세 조회는 내부 자동 재시도 없이 오류를 표시하며 15초 후 연결 오류로 전환한다. 재시도 버튼을 제공한다. 로그아웃하면 상세와 원본을 숨긴다. 기존 migration 변경·재실행은 없다.

단위/SQL 테스트 53개, 기존 모바일 브리프 E2E 8개, 상세·저장 mock E2E 10개 및 타입 검사·빌드를 확인했다. 실제 로컬 브라우저 + 원격 Supabase 검증 결과는 [상세 P0 검증](../../docs/v03/COLLABORATION_DETAIL_VALIDATION_20261015.md)을 참고한다.


## 홈 · 조회 P0

`#/`는 현재 V03 로그인 사용자의 협찬·Task·일정 검토 상태를 조회한다. 진행 중, 보류, 완료를 구분하고 협찬/할 일을 누르면 기존 상세로 이동한다. 브리프 가져오기는 로그인/빈 목록/오류 상태에서도 진입할 수 있다.

다음 해야 할 일은 진행 중 협찬의 미완료 Task를 기한 오름차순(지난 기한 포함), 기한 없는 항목 순으로 모두 표시한다. 보류·완료 협찬의 남은 미완료 Task는 해당 목록 안에 계속 표시한다. 날짜가 불명확/미기재인 경우 Task나 날짜를 새로 만들지 않으며 가편/업로드 표시에는 기존 Review 상태를 보존한다. 날짜 기준은 브라우저 기기의 달력 날짜이며 상태 자동 전이는 없다.

조회는 소유자 조건과 RLS를 사용하고 ID cursor로 100개씩 순회한다. 원본 텍스트·이미지·성과·광고 코드는 홈 조회에 요청하지 않는다. 로그인 필요, 로딩, 빈 목록, 오류/재시도, 15초 제한과 로그아웃 후 정보 제거를 처리한다. [홈 검증 기록](../../docs/v03/HOME_VALIDATION_20261015.md)을 참고한다.


## 협찬 상태·할 일 완료 변경

상세에서 상태 7종을 자유롭게 건너뛰거나 되돌릴 수 있고, 할 일은 독립적으로 완료/미완료로 바꾼다. 상태 완료가 Task를 완료하거나 모든 Task 완료가 상태를 바꾸는 동작은 없다. 저장 성공 후 실제 DB를 재조회하며 홈 복귀·새로고침에도 반영된다.

새 migration `202610150001_v03_progress.sql`은 각 행의 revision과 요청 receipts, 소유권/허용 값/CAS 검증 RPC를 추가한다. 기존 직접 쓰기 차단은 유지한다. 이번 V03 프로젝트에는 이 새 migration만 추가 적용했으며 초기 migration은 재실행하지 않았다.

저장 중에는 모든 변경 버튼을 잠근다. 연결 오류/응답 유실은 같은 UUID 요청으로 재시도할 수 있고, 충돌은 최신 내용 재조회 후 다시 선택해야 한다. 로그아웃/화면 이탈 이후 응답은 UI에 반영하지 않는다. 요청 취소가 이미 시작된 DB transaction을 취소했다는 뜻은 아니므로 결과가 모호하면 재조회해야 한다.

```bash
# 새 migration 상태 조회만 수행 (적용 없음)
npm run admin:apply:progress
# 적용된 스키마에 대한 실제 원격 검증; 임시 계정/데이터 생성 후 정리
npm run admin:verify:progress
```

관리자 명령은 Git 제외 환경 파일만 읽으며 브라우저에 관리자 키를 전달하지 않는다. 적용되지 않은 환경에 새 migration을 적용할 때만 별도 승인 범위에서 `npm run admin:apply:progress -- --apply`를 사용한다. 이미 존재하면 재실행하지 않으며 부분 스키마는 중단한다. 상세 내용은 [상태·할 일 변경 검증](../../docs/v03/PROGRESS_VALIDATION_20261015.md)을 참고한다.
