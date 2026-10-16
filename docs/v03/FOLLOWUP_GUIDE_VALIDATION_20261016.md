# 후속 가이드 추가 P0 검증 · 2026-10-16

기준 `59978d0c`, 브랜치 `codex/v03-influencer-mvp`. docs/v03의 Source(원본)/Import(staging·중복 방지) 계약과 현재 최초 등록 RPC·private Storage 정책을 비교한 후 구현했다.

## 실제 변경

- 상세에서 텍스트·이미지 추가, 하나 이상 필수, 원본 미리보기 및 명시적 확인. 확인 전 업로드하지 않는다.
- 별도 후속 Import 준비/commit RPC로 기존 협찬에 Source만 추가한다. 새 Collaboration/Content/Review는 생성하지 않는다.
- 최초 원본·Import snapshot·Review와 협찬 상태/버전·콘텐츠·Task 날짜/완료·조건을 보존한다. 초기 등록 RPC 정의와 mock gate는 변경하지 않는다.
- 최초/후속 표시, 후속 등록 순서, 서버 등록 일시(한국 시간), 각 원본·private 이미지 재열람. 등록 일시는 브랜드 컨택 일자가 아니다.
- 과거 Source의 등록 시각을 소급 추정하지 않는다. 기존 null은 “등록 일시 기록 없음”, 새 Source는 삽입 시 서버 시각을 기록한다.
- UUID 동일 요청 retry, 소유권, 직접 쓰기 차단, transaction, abort 선점 후 이미지 보상 삭제. 성공 여부가 불명확하면 입력/UUID/파일을 유지한다. 서버가 확정 거부한 준비 요청은 입력 수정이 가능하다.
- 저장 중 중복 조작 차단, logout/라우트·세션 변경 뒤 늦은 UI 응답 무시, object URL 해제.

## 적용 migration

대상 프로젝트 `zzuytanimpiflygrwqfb`를 Management API/PAT로 확인했다. 기존 일곱 migration 파일은 변경·재실행하지 않았다.

| 새 파일 | 내용 | SHA-256 |
| --- | --- | --- |
| `202610160004_v03_followup_guides.sql` | Source metadata·후속 전용 validator/prepare/commit | `18352483165c93c5e8de860f69bb01039a0d38dda8da84341aecee97b1089693` |
| `202610160005_v03_guide_whitespace.sql` | 기존 공백 정규화 helper로 Unicode 공백만 있는 원본 거부 | `80f018bd22a9a5c8263f2cc092056016ab2069b5e37fa520072697c8635119d9` |

004 적용 전후 기존 Source 내용과 Review fingerprint가 같았다. 005는 함수 검증만 보강하며 데이터 변환이 없다. 005 적용 시 004의 존재를 확인하고 건너뛰었다. 적용 스크립트는 일부 schema만 존재하면 중단한다.

## 로컬 자동 검증

앱 디렉터리 `apps/v03`에서 실행했다.

```sh
npm test -- guide-schema guide-save save.test manual-schema
npm run test:e2e:storage -- guide.spec.ts
npm run build
```

- 단위·SQL/RLS·저장 회귀: **26개 통과**. 신규 guide SQL/저장 테스트 10개와 관련 초기 등록/보상 삭제 회귀 16개.
- 모바일 Chromium(Pixel 7) E2E: **4개 통과**.
  - 이미지 선택·preview·확인 gate·append·reload·private 이미지 열람 및 운영 정보 보존.
  - 불명확한 결과에서 입력을 동결하고 같은 UUID로 복구.
  - 저장 중 중복·취소 차단, 로그아웃 뒤 늦은 성공 무시.
  - 확정된 서버 준비 거부 후 입력 수정/취소와 기존 원본 보존.
- TypeScript 검사·production build: **통과**.

E2E는 가짜 Supabase 응답을 사용한다. 아래 원격 SDK 검증 및 실제 브라우저 검증과 구분한다. 완료된 상태/Task/기본 정보/일정 수정 검증을 다시 실행하지 않았다.

## 실제 Supabase SDK 검증

재현 명령: `npm run admin:verify:guide`. Git 제외 환경 파일의 키를 읽고 값·원문·사용자 데이터를 출력하지 않는다. 매 실행마다 식별 가능한 합성 계정 두 개를 만들며 finally에서 정리한다.

최종 **29개 체크 통과(정리 확인 포함)**:

- 실제 Auth 로그인, 타인/비로그인 추가와 receipt 접근 거부, Source RLS, 직접 INSERT/UPDATE 거부.
- private 이미지 소유자 다운로드 성공, 타인/비로그인 거부.
- 명시적 확인·텍스트/이미지 필수·길이·Unicode 공백·미허용 필드 검증.
- Source만 추가, 서버 등록 순서/시각, Review 없음, 최초 snapshot/원본과 전체 운영 정보 보존.
- 동일 UUID 재시도·다른 payload 거부, 동시 추가의 고유 순서.
- 실제 commit 성공 응답과 상태 조회를 의도적으로 유실시켜 파일 보존 확인 후 같은 UUID 복구.
- UUID 한 건에만 한정한 임시 trigger로 Source insert 뒤 Import 완료를 실패시켜 DB rollback 확인. abort 후 staging 이미지 보상 삭제.
- 이미지 단독 추가, 정확히 다섯 개 후속 Source만 저장되어 중복 없음.
- 임시 trigger/function 제거, Auth·Storage 및 V03 11개 테이블의 해당 QA 행/receipt **잔여 0건**.

초기 장애 주입 시 SDK 자동 재시도가 장애를 복구하여 “불명확 결과” 조건을 만들지 못했다. 주입 방식을 400 응답으로 보완해 검증했고 해당 초기 실행 데이터도 정리했다. 최초 Node 모듈 경로 및 sandbox의 로컬 포트 제한은 조정 후 통과했으며 현재 제품 실패로 남아 있지 않다.

## 실제 브라우저 검증

로컬 앱 `http://127.0.0.1:5183/`과 실제 Supabase를 사용했다. QA 전용 협찬을 SDK로 준비하고, 브라우저에서:

1. 합성 계정 로그인 → 기존 협찬 상세.
2. 후속 가이드 텍스트 입력 → OS 파일 선택으로 합성 PNG 선택 → 선택 이미지 표시.
3. 원본 미리보기 → 명시적 checkbox 확인 → 실제 추가 저장.
4. 새로고침 → 최초 가이드와 후속 가이드 1·등록 시각 구분.
5. 후속 원본 텍스트 및 인증된 private 이미지 다시 열람.
6. 로그아웃, QA 이미지·Source·협찬·계정 삭제 및 Auth/Storage/11개 V03 테이블 **잔여 0건** 확인.

파일 선택 도구 응답이 약 15분 지연됐으나 완료됐으며, 선택 이후 실제 저장·재조회·이미지 렌더링을 확인했다. 합성 이미지 외 실제 사용자 데이터는 사용하지 않았다. 화면 증거는 로컬 Git 제외 `.tmp/guide-real-browser.jpg`이며 repo에 검증 계정/이미지/journal은 포함하지 않는다.

## 미검증·범위 밖

- iOS Safari/Android Chrome **실기기 미검증**(접근 없음). 사진 권한/HEIC·여러 장 선택·앱 전환·메모리·네트워크 이탈을 실제 기기에서 점검해야 한다. 지원 형식은 JPG/PNG/WebP이며 HEIC 자동 변환은 없다.
- 미완료 입력/UUID는 메모리만 사용한다. 브라우저 종료 이후 요청 자동 복원은 제공하지 않으며 기존 24시간 임시 정리 계약을 따른다.
- 후속 원본 편집/삭제, 자동 추출·일정/할 일/조건 자동 반영·AI/OCR·알림은 이번 범위 밖이다.
- V02/main 및 기존 migration은 변경하지 않았다. 검증 완료 후 현재 V03 브랜치에 새 commit으로 push한다.
