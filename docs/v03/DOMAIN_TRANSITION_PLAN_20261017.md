# 도메인 운영 기준·V02 보존 및 V03 전환 순서

2026-10-17 사용자 지시: `itjima.app`은 향후 V03 메인으로 사용하고 V02 랜딩/앱은 각각 v02가 포함된 주소로 보존한다. **현재 단계에서는 DNS·도메인 연결을 변경하지 않는다.** 아래 주소는 임의 예시가 아니라 실제 Vercel 등록 상태를 조회한 결과다.

## 현재 연결과 근거

| 주소 | 현재 프로젝트/연결 | 이번 읽기 전용 확인 | 판단 |
| --- | --- | --- | --- |
| `https://itjima.app/` | 기존 Vercel `itjima` / Production | HTTP 200, 기존 자연어 AI 메모·일정 앱 HTML. Vercel은 DNS Change Recommended 표시 | 현재 V02 계열 메인을 그대로 보존. V03으로 아직 이전하지 않음 |
| `https://v02-portfolio.itjima.app/` | 기존 `itjima` / `release/v02-portfolio-20261007` | Vercel Invalid Configuration, 표준 인증서 검증을 사용하는 HTTPS 요청 실패 | **현재 등록된 V02 랜딩 보존 주소**이나 정상 작동 미확인. 보존 완료로 간주하지 않음 |
| `https://v02.itjima.app/app` | 기존 `itjima` / Production의 `/app` 경로 | HTTP 200, 기존 V02 앱 HTML. 도메인은 DNS Change Recommended 표시 | **현재 등록된 V02 앱 보존 주소/경로**. 페이지 응답 확인과 로그인·데이터·원본 접근 정상 검증은 별개 |
| `https://itjima-v03-alpha.vercel.app/` | 별도 `itjima-v03-alpha` / Production / `apps/v03` | HTTP 200, V03 협찬 관리 HTML | 이번 디자인 적용·재배포 대상. 별도 도메인 이동 없이 유지 |

Vercel은 추가로 `itjima.vercel.app` → `itjima.app` 307 redirect를 표시했다. 이 주소는 메인 전환 후 V03으로 따라갈 수 있으므로 V02 보존 주소로 사용하면 안 된다. `v02.itjima.app`도 현재 V02 프로젝트 Production을 추적하므로 향후 해당 프로젝트의 다른 배포가 보존 상태를 바꾸지 않게 고정 기준/브랜치를 확인해야 한다.

기존 문서 `docs/SEO_SETUP.md`는 `itjima.app/`와 `/app`을 기존 제품 경로로 설명하고, `docs/v03/README.md`는 V02 기준점·별도 V03 프로젝트 원칙을 기록한다. `docs/v03/DEPLOYMENT_20261017.md`는 V03 알파 주소와 V02 미변경을 기록한다. 조사한 저장소 문서에서는 위 두 v02 주소를 확정한 별도 합의 문서를 찾지 못했다. 이번 사용자의 운영 지시가 향후 방향이며, 등록돼 있다는 이유만으로 보존 성공/전환 승인을 추정하지 않는다.

## 전환 순서 — 이번에는 실행하지 않음

1. 기존 V02 랜딩 및 앱의 정확한 보존 commit/배포 ID와 Git branch를 기록한다. 현재 랜딩 연결은 위 release 브랜치이며, 앱 Production의 실제 배포와 기능을 따로 확인한다.
2. 별도 작업에서 V02 랜딩 보존 주소의 Invalid Configuration 원인을 확인·수정한다. V02 앱 도메인의 DNS 권고도 진단한다. 주소 변경이 필요하면 실제 사용할 두 URL을 확정·기록하며 예시 주소를 자동 채택하지 않는다.
3. 두 보존 주소에서 HTTPS 인증서, 랜딩 자산/링크, 앱 진입·로그인·본인 데이터 조회·직접 URL/새로고침을 확인한다. 다른 origin의 세션·Auth redirect·service worker/cache 영향도 확인한다. 현재는 이 단계 **미완료**다.
4. 검증한 V02 배포가 계속 유지되도록 브랜치/alias 기준, 롤백 배포와 도메인 복귀 절차를 기록한다. V03 메인 링크와 V02 포트폴리오/앱 상호 링크는 별도 변경 범위로 검토한다.
5. V03 디자인 배포를 알파 주소에서 검증한다. V03 메인 전환에 필요한 Auth redirect/canonical/메타/링크 변경은 V03에만 별도로 준비한다.
6. **V02 두 보존 주소가 정상인 것을 확인한 뒤에만**, 별도 도메인 전환 작업에서 `itjima.app` 연결을 V03으로 이동한다. 이번 재배포 승인을 DNS/도메인 전환 승인으로 확대하지 않는다.
7. 메인 HTTPS·V03 로그인/조회·정적 자산 및 두 V02 보존 주소를 다시 확인한다. 문제가 있으면 기록한 도메인/배포 기준으로 복귀한다.

현재 결론: V02 랜딩 보존 주소가 정상 상태가 아니므로 메인 전환 조건을 충족하지 못했다. 이번에는 `itjima-v03-alpha`의 디자인 재배포만 수행하며 DNS·도메인 연결·V02 설정은 변경하지 않는다. 위 도메인 화면에서 Add/Edit/Buy/Save 등의 변경 조작을 하지 않았다.
