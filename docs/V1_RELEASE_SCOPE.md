# Itjima v1 release scope

## Product promise

생각나는 대로 던져두면, 잊지 않도록 다시 꺼내주는 기억 인박스.

## Included

- 원문 그대로 빠르게 저장
- 최신 기록으로 자동 이동
- 음성, 이미지, 낙서 입력
- Decision Deck: 일정 / 그대로 / 보관
- 되돌리기
- 로컬 날짜 파서를 이용한 일정 제안과 일정 폼
- 일정 생성, 수정, 완료, 삭제
- 보관함 검색과 원문 확인
- 로그인 전후 데이터 보존과 동기화 상태
- 모바일, 태블릿, 데스크톱 반응형 UI

## Excluded from v1

- AI 채팅 모드
- Brain Mirror 자동 해석
- `AI가 이해했어요` 카드
- AI 자동 카테고리와 자동 제목
- AI 기반 보관함 그룹화
- 사용자의 확인 없는 자동 일정 생성
- 범용 질문 답변과 장기 대화 기억

## AI beta boundary

The Anthropic endpoint is disabled unless the deployment explicitly sets:

```text
ENABLE_AI_BETA=true
```

AI beta must remain hidden until all of the following are met:

- 5-person usability test completed
- supported-input evaluation dataset prepared
- field-level date/time/title accuracy reaches the agreed release threshold
- no unconfirmed database writes
- per-user and monthly cost limits implemented
- failure always falls back to the manual schedule form without losing the original text

## Release-critical flow

```text
던지기 → 원문 저장 → 하나씩 정리 → 일정 / 그대로 / 보관
```

Any new feature that delays or obscures this flow is out of scope for v1.
