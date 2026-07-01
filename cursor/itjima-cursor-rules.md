# ItJima — Cursor Rules

# Product Constitution + Architecture + AI Behavior + UX Behavior 기반

# 이 규칙은 모든 구현 작업에 적용된다.

---

## 절대 규칙 (위반 불가)

- 라우팅을 변경하지 않는다
- 탭 이름(생각/일정/보관)을 변경하지 않는다
- 전역 레이아웃/스타일을 재작성하지 않는다
- 기존 페이지(archive, schedule, \_\_root)를 PRD 범위 외로 건드리지 않는다
- 모든 작업은 계획을 먼저 보여주고 승인 후에만 파일을 수정한다
- 한 번에 하나의 기능만 구현한다

---

## 제품 철학

ItJima는 메모 앱이 아니다. AI가 먼저 이해하는 앱이다.

핵심 흐름:
사용자가 생각을 던진다 → AI가 먼저 이해한다 → AI가 ItJima 내부에서만 먼저 행동한다 → 사용자는 확인하거나 되돌린다

절대 하지 말 것:

- "어떻게 정리할까요?" 같은 질문형 UI
- "정리했어요", "넣었어요" 같은 완료형 카피 → 반드시 "~생각 같아요", "~관련된 것 같아요" 해석형으로
- 노션/생산성툴 느낌의 복잡한 UI
- AI 실패를 사용자에게 노출 (에러 토스트, 재시도 버튼 금지)

---

## 데이터 모델 규칙

```ts
// rawText는 절대 수정 불가 — immutable
// Thought.view 만 변경 (NOW / TIME / MEMORY)
// Thought.status 는 view와 독립적 (active / done / archived / deleted)
// BrainMirror는 Thought를 변경하지 않고 별도 row로만 존재
// BrainMirror.version, isCurrent 필드 유지 (v0.1은 항상 1, true)
```

---

## Brain Mirror 규칙

Trigger: 의미있는 문자 2개 이상이면 시도. AI와 Validator가 판단.

파이프라인:

1. needOrganization(rawText) → 통과하면
2. LLM 1차 호출 (생성)
3. Validator 2차 호출 (검증)
4. pass → 카드 표시 / fail → 조용히 원문만 유지

카드 카피 규칙:

- suggestedAction: "내일과 관련된 생각 같아요." (해석형, 완료형 금지)
- 버튼: "되돌리기" (취소 아님)
- 레이블: "🧠 이렇게 이해했어요"

Thinking Indicator:

- 0~300ms: 표시 안 함
- 300ms~3s: 점 3개 + "생각을 읽는 중..."
- 3s~8s: "조금 더 들여다보고 있어요"
- 8s+: 타임아웃, 조용히 숨김

실패 처리:
모든 실패(trigger 미통과, LLM 실패, Validator 거부, timeout)는
사용자에게 동일하게 보여야 한다 → thought 카드만 남고 에러 없음

---

## Action Level 규칙

Level 0 (자동): BrainMirror 생성, 제목/체크리스트/태그
Level 1 (자동): Thought.view / status 변경, ItJima 내부 이동
Level 2 (승인 필요): 알림 예약 — 10초 유예, fireAt 10분 미만이면 명시적 승인
Level 3 (반드시 승인): Google Calendar 등 외부 시스템 — v0.1 범위 밖

---

## UI 규칙

디자인 방향: 애플워치 / 애플헬스 — 크고 둥글고 직관적, 라이트모드

- 카드 border-radius: 24px
- 버튼: border-radius 100px (완전 둥근)
- 그림자: 부드럽고 퍼진 것, harsh shadow 금지
- 색상: 흰/검/노랑(#FFE033)만, 파랑/보라/초록 강조색 금지
- 타이포: 800weight 헤딩, 600weight 카드 본문, 여백 넉넉하게
- 입력창: min-height 72px, border-radius 28px, font-size 16px

스와이프:

- 카드 기울기(rotation) 없음 — translateX만 사용
- 스와이프 목적지 레이블은 부드럽게 등장

Brain Mirror 카드:

- 다크(#111111) 배경 유지 — thought 카드(라이트)와 시각적 구분
- translateY(8px)→0, opacity 0→1 등장 애니메이션
- items 0.1s 간격 순차 fade-in

---

## v0.1 범위

포함:

- Thought 저장 (즉시, 네트워크 무관)
- Brain Mirror 생성 + Validator
- Thinking Indicator (Latency Policy)
- Inline Card (모달 금지)
- 되돌리기 (Level 1)
- Trigger Logic
- 인박스 정리 모드 (수동)
- 일정 카드 하루종일/반복 체크박스

제외 (v0.2 이후):

- 알림/ScheduledNotification
- Google Calendar 연동
- Pattern Analysis
- Memory Recall
- AI Reflection
- 채팅 기능
