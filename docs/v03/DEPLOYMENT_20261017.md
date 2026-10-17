# V03 Vercel Production 배포 · 2026-10-17

## 배포 식별

- 사용자 승인 범위: 현재 브랜치 최신 커밋을 V03 별도 프로젝트에 배포. 디자인/AI/OCR/알림/DB 변경 제외.
- 팀/새 프로젝트: `Itjima / itjima-v03-alpha`.
- 공개 HTTPS 주소: https://itjima-v03-alpha.vercel.app/
- 상태: **Ready / Production**.
- 소스 브랜치: `codex/v03-influencer-mvp`.
- 배포 소스 SHA: **`32b0e5271e7b9fff581762c3658f54f4732c9fea`**. 로컬 HEAD와 원격 HEAD 일치 확인 후 SHA를 직접 지정했다.
- 배포 ID: `dpl_CaZzZsGKuN4RnNkyHhSKzHRCLRWu`.
- [배포 상세](https://vercel.com/itjima/itjima-v03-alpha/CaZzZsGKuN4RnNkyHhSKzHRCLRWu).
- 고유 배포 호스트: `itjima-v03-alpha-by2g2yqe4-itjima.vercel.app`. Standard Protection이 적용될 수 있으므로 휴대폰 점검에는 위 공개 Production 주소를 사용한다.

이 문서와 기존 미커밋 디자인 계획은 배포 소스에 포함하지 않았다. 이번 배포를 위해 제품 소스 commit을 새로 만들거나 최신 SHA를 바꾸지 않았다.

## 새 V03 프로젝트 설정

- Root Directory: **`apps/v03`**. 루트 밖 파일의 build 포함은 해제.
- Framework: Vite / Node.js 24.x.
- Install: `npm ci` / Build: `npm run build` / Output: `dist`.
- Production branch tracking: `codex/v03-influencer-mvp`.
- Production 환경에 아래 **3개 공개 변수만** 추가했다. 값은 기록하지 않는다.
  - `VITE_V03_SUPABASE_URL`
  - `VITE_V03_SUPABASE_PROJECT_REF`
  - `VITE_V03_SUPABASE_PUBLISHABLE_KEY`
- 관리자 PAT/secret은 Vercel에 등록·업로드하지 않았다. 로컬 관리자 파일은 배포 소스/빌드에 포함하지 않았다.
- V02의 기존 `itjima` 프로젝트·도메인·설정에는 쓰기 작업을 하지 않았다.

처음 연결 도구의 프로젝트 생성이 403으로 거부됐으며, 사용자가 브라우저에 로그인한 뒤 새 프로젝트만 생성했다. 초기 가져오기 화면의 기본 main은 배포하지 않고, V03 root/브랜치/환경 설정을 저장한 다음 정확한 SHA를 Production으로 배포했다. 환경 설정 중 첫 배포가 없어 자동 재배포를 찾지 못한다는 안내가 있었지만, 이후 명시적 SHA 배포가 정상 완료됐다.

## 실제 확인

1. 정확한 커밋의 로컬 snapshot에서 타입 검사·빌드 통과. Vercel 원격 빌드도 `itjima-v03` 타입 검사·Vite build 완료, 상태 Ready 확인.
2. 별도 인증 없이 공개 Production HTTPS 주소가 HTTP 200으로 V03 HTML/정적 자산을 제공한다. 임시 터널이나 Mac 실행에 의존하지 않는다.
3. 실제 Production 브라우저에서 QA 전용 합성 계정으로 Supabase 이메일·비밀번호 로그인 성공.
4. 해당 계정 소유 합성 협찬 1건을 홈에서 조회, 링크로 상세 진입, 플랫폼/메모/일정/원본 표시 확인.
5. 상세 URL 새로고침 후 같은 협찬과 최초 원본 재조회 성공.
6. 로그아웃 후 로그인 필요 안내 확인.
7. 실제 Production HTML·JS/CSS 응답에서 로컬 관리자 값과 관리자 변수 이름이 포함되지 않은 것을 값 출력 없이 검사.
8. `/.env.local`, `/scripts/.env.admin.local`, `/.git/config`, `/src/integrations/client.ts`는 Vercel SPA fallback 때문에 **HTTP 200으로 동일한 앱 HTML을 반환**한다. 파일 내용이 제공되는 것은 아니며, 404 차단이라고 보고하지 않는다. 실제 응답이 홈 HTML과 byte 단위로 같고 관리자 값이 없는 것을 확인했다.

QA 계정·협찬은 로컬 SDK로 준비했으며 이는 Production 화면에서 새 협찬 등록을 검증했다는 뜻이 아니다. 관리자 키는 로컬 준비/정리에서만 사용하고 브라우저나 Vercel에 넣지 않았다. 실제 사용자 협찬은 사용하지 않았다. 화면 증거는 Git 제외 `apps/v03/.tmp/vercel-production-20261017.jpg`에만 보관한다.

## 정리와 제한

- QA 계정과 소유 협찬/Source/Review/Task/Import를 정리하고 Auth·Storage·V03 11개 테이블의 해당 QA 잔여 **0건을 확인했다**. 비밀 값·QA 계정 식별자·원문·경로는 이 문서에 기록하지 않는다.
- 이번에 실제 확인한 인증은 이메일·비밀번호 로그인이다. 해당 로그인/조회에는 Supabase Auth URL 설정 변경이 필요하지 않아 **변경하지 않았다**. 이메일 확인·가입·magic link·비밀번호 재설정 redirect는 미검증이다.
- iOS/Android 실기기, 실제 협찬, Production 주소에서 새 등록/저장·이미지 업로드·후속 가이드·수정/충돌 등 전체 기능은 이번 배포 점검에서 재검증하지 않았다. 기존 기능 검증 기록과 이번 배포 smoke test를 구분한다.
- migration은 신규 적용·기존 재실행 모두 **없음**. Supabase 설정·V02/main·디자인·AI/OCR·알림 변경 없음.
- 배포 후 개선은 `apps/v03` 범위에서 진행하고 기존 migration은 반복하지 않는다.
