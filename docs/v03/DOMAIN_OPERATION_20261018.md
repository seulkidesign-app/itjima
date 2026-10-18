# 도메인 최종 운영 기준 · 2026-10-18

2026-10-18 사용자가 기존 메인의 V03 전환 계획을 취소했다. 2026-10-17 전환 계획을 대체한다.

| 역할 | 최종 URL | Vercel 프로젝트 |
| --- | --- | --- |
| V02 랜딩 | https://itjima.app | 기존 itjima / Production |
| V02 앱 | https://itjima.app/app | 기존 itjima / Production |
| V03 | https://v03.itjima.app | 별도 itjima-v03-alpha / Production |
| V03 기존 주소 유지 | https://itjima-v03-alpha.vercel.app | itjima-v03-alpha / Production |

## 최신 상태 · DNS 설정 후

사용자가 Namecheap에 요구 CNAME을 저장했다. 공개 DNS Google resolve 결과 Status 0, CNAME `d0d6eef7761369c3.vercel-dns-016.com.`을 확인했다. Vercel은 `v03.itjima.app`과 기존 `itjima-v03-alpha.vercel.app` 모두 Valid Configuration / Production을 표시했다. 표준 TLS 인증서 검증을 사용하는 HTTPS 요청에서 V03 및 V02 `/`, `/app` 모두 200. DNS·인증서 우회는 없다. Namecheap @·www·메일 레코드를 에이전트가 수정한 작업은 없다.

이제 승인된 UI 정리를 진행한다. 아래 DNS 대기 설명은 연결 준비 당시의 기록이며 최신 상태를 대체하지 않는다.

## 연결 준비 당시 확인과 수행

- 기존 `itjima.app`은 V02 프로젝트 Production 연결이 유지되어 있었다. 복원/이동/재배포를 하지 않았다. DNS Change Recommended 표시는 있으나 HTTPS 인증서를 검증하는 요청에서 `/` 및 `/app` 모두 200을 확인했다.
- 실제 브라우저에서 랜딩 제목·앱 열기 링크를 확인하고 링크를 눌러 `/app`의 기존 메모 입력·일정 메뉴가 렌더링되는 것을 확인했다. 입력·V02 로그인·데이터 쓰기는 하지 않았다.
- `v03.itjima.app`을 기존 별도 V03 프로젝트 Production에 추가했다. Redirect가 아닌 환경 연결이다. `itjima-v03-alpha.vercel.app`은 Valid Configuration으로 계속 유지했다.
- Vercel에서 표시한 DNS 제공자는 Namecheap이다. 현재 브라우저는 Namecheap 로그인 화면으로 연결되어 DNS 쓰기 인증이 없다. 따라서 DNS를 변경하지 않았다.
- 추가 후 `v03.itjima.app`은 Invalid Configuration이고 HTTPS 요청은 이름 해석 단계에서 실패했다. 인증서 오류 우회나 임의 hosts 설정은 하지 않았다. 아직 도메인 완료가 아니다.

## 필요한 DNS 레코드 — Vercel 실제 요구값

Namecheap → Domain List → itjima.app → Manage → Advanced DNS → Host Records에서 다음 레코드를 추가한다.

| Type | Host | Value | TTL |
| --- | --- | --- | --- |
| CNAME Record | v03 | d0d6eef7761369c3.vercel-dns-016.com | Automatic |

Vercel 표시 원문은 `d0d6eef7761369c3.vercel-dns-016.com.`이다. Namecheap에서 말단 점을 정규화해도 동일한 FQDN이다. 현재 @/www 및 MX·메일 TXT·nameserver를 변경하지 않는다. v03 이름의 충돌 레코드가 있으면 확인 후 해당 이름만 조정하며 다른 서브도메인은 삭제하지 않는다.

설정 후 V03 프로젝트 Domains의 Refresh로 Valid Configuration을 확인하고, 표준 인증서 검증으로 HTTPS를 확인한다. 이어 합성 계정으로 로그인→본인 협찬 조회→상세 직접 URL/새로고침을 검증하고 검증 데이터는 정리한다. 기존 vercel.app 주소도 유지되는지 확인한다. 현재 새 도메인의 로그인/조회/새로고침은 DNS 대기이므로 미검증이다. Supabase Auth 설정은 아직 변경하지 않았다.

## 보존용 서브도메인 현황 — 삭제 없음

- `v02-portfolio.itjima.app`: 기존 itjima 프로젝트의 `release/v02-portfolio-20261007` 연결, Invalid Configuration. 최종 V02 주소가 아니며 그대로 둔다.
- `v02.itjima.app`: 기존 itjima 프로젝트 Production, DNS Change Recommended. 최종 V02 주소가 아니며 그대로 둔다.
- `itjima.vercel.app`: 기존 itjima 프로젝트, `itjima.app`으로 307 redirect 유지.

V02 제품 코드·데이터·migration·프로젝트 설정은 변경하지 않았다. V03 제품 코드도 이번 도메인 준비 단계에서는 변경하지 않았다. 디자인 계승·가상 데이터 목업은 이전 작업에서 완료됐다. 추가 UI 정리 범위는 아래 사용자 지시로 확정됐으며 DNS 정상 연결 확인을 기다린다. 도메인 완료 전 UI 변경을 앞당기지 않는다.

## 확정된 UI 후속 범위 — 도메인 완료 후 착수

1. 모든 화면의 큰 로그인 카드를 헤더의 작은 계정 메뉴로 변경. 로그인·로그아웃·상태·키보드 접근·터치 영역을 유지한다.
2. 상세는 주요 일정·할 일·제작 조건·원본 가이드 조회를 우선한다. 기본 정보·상태·일정 수정 폼은 명시적 수정 버튼으로만 열고 저장·취소·충돌·재시도·미확인 결과 안내 계약을 유지한다.
3. ‘현재 운영 정보’ 등의 내부 용어와 반복 설명을 간소화하되 수동 출처·미입력·불명확·사용자 제거와 중요 실패 안내는 유지한다.
4. V02 디자인과 모바일 접근성을 유지하며 관련 UI 테스트·타입 검사·빌드 후 현재 V03 브랜치 commit/push 및 V03 프로젝트 재배포를 수행한다. V02 코드·데이터·배포·migration·AI/OCR은 변경하지 않는다.

재확인: Namecheap 로그인 화면이므로 DNS 저장 권한을 사용할 수 없다. Vercel은 여전히 Invalid Configuration과 같은 CNAME 요구값을 표시했다. V03 이름 해석 실패, V02 두 주소 HTTPS 200. 사용자 지정 순서에 따라 UI 구현과 재배포는 아직 시작하지 않았다.
