# Rediscovery UT v1 — Value Validation

Status: **NEXT hypothesis · not yet validated**

## What we are testing

Rediscovery is not being tested as a parser feature or as another inbox to clear.

**Hypothesis**

> When Itjima quietly resurfaces an older record at a useful moment, users can recover value from what they already captured without feeling responsible for managing a backlog.

The test is successful only if participants understand why a record came back, can decide what to do without instruction, and do not experience the surface as another queue to maintain.

## Release boundary

- `REDISCOVERY` remains off by default.
- `/rediscovery` must not expose the experimental surface unless the existing local feature override enables `REDISCOVERY`.
- Do not ship a public navigation entry before this validation.
- Do not change candidate ranking during the first UT round unless a P0/P1 integrity defect is found.

Prepared participant environments may enable the existing override:

```js
localStorage.setItem(
  "itjima.__feature_overrides__",
  JSON.stringify({ REDISCOVERY: true }),
);
```

Then reload and open `/rediscovery`.

## Participants

- 5–8 external participants.
- Prefer people who naturally use personal notes, self-chat, simple reminders, or lightweight memo tools.
- Do not recruit only power users of Notion/task managers.
- Do not explain the Rediscovery concept before the first encounter.

Small-N results are directional evidence. Do not report conversion percentages as proof.

## Test setup

Best: participants use Itjima naturally long enough to accumulate their own records.

If time does not allow a longitudinal setup, seed realistic records with the participant before the session and preserve at least these differences:

- 3–6 day old record
- 7–20 day old record
- 21+ day old record
- one record related to an upcoming schedule when available
- one record the participant no longer cares about

Never seed deleted content as a Rediscovery candidate.

## Session flow

1. Let the participant use Capture normally first.
2. Present Rediscovery without explaining why the item was chosen.
3. Ask them to think aloud only after they have read the resurfaced record.
4. Let them choose naturally among the existing actions.
5. If they open the record, observe what they do next without prompting an edit/schedule action.
6. After the interaction, ask the short interview questions below.

Do not tell the participant that `완료했어요` and `다시 보지 않기` currently both remove the item from future Rediscovery selection. Their differing intent is measured separately and is a decision input for the next iteration.

## Instrumented events

No event may contain record id, title, text, raw text, tags, or other user-entered content.

Events:

- `rediscovery_impression`
- `rediscovery_open`
- `rediscovery_done`
- `rediscovery_hide`

Allowed context only:

- `reason`: `upcoming_schedule | long_unvisited | quiet_revisit`
- `age_bucket`: `3_6d | 7_20d | 21_59d | 60d_plus`
- `visit_bucket`: `0 | 1 | 2_plus`
- `has_related_schedule`: boolean
- `repeat_visit`: boolean

## What to observe

### Primary qualitative evidence

- Participant immediately recognizes the resurfaced record.
- Participant can explain in their own words why seeing it now is useful or not useful.
- Participant takes a meaningful next action without being told what to do.
- The surface feels like help, not work.

### Directional behavioral signals

Use counts, not statistically framed rates, with N=5–8:

- surfaced → opened
- surfaced → done
- surfaced → hidden
- surfaced → ignored / session ended
- repeated item → opened vs annoyance
- upcoming-schedule reason → perceived timing relevance

### Short interview after the action

Ask in this order:

1. “왜 이게 지금 다시 나온 것 같았어요?”
2. “이게 다시 나온 게 도움이 됐나요, 아니면 방해됐나요? 왜요?”
3. “이 기록을 원래 직접 찾으러 갔을 것 같아요?”
4. “다음에 또 이런 식으로 예전 기록이 나오면 어떤 느낌일 것 같아요?”
5. “이 화면에서 해야 할 일이 쌓여 있다고 느껴졌나요?”

Do not ask “재발견 기능 어때요?” before these questions.

## Failure signals

Treat these as product evidence, not participant error:

- “왜 이게 나왔지?” with no plausible value.
- Resurfacing feels creepy, intrusive, or too personal.
- User thinks there is a Rediscovery inbox they must clear.
- Same item returns often enough to annoy.
- User cannot distinguish `완료했어요` from `다시 보지 않기` in intent.
- Deleted content returns.
- A completed/no-longer-relevant item returns as if still actionable.
- Resurfaced content differs from the current canonical record.
- Opening Rediscovery mutates schedule/canonical state unexpectedly.

Any deleted-record resurrection or cross-account content leak is P0 and blocks further UT.

## Decision after 5–8 sessions

Do **not** start by tuning ranking weights.

First classify evidence into:

1. **Value** — did resurfacing recover something the user cared about?
2. **Timing** — was now a believable moment?
3. **Control** — could the user dismiss/act without management burden?
4. **Trust** — did the surfaced content/state remain correct?

Only then decide whether to adjust candidate age, cooldown/repetition, action semantics, or placement.

## Portfolio claim discipline

Before evidence:

> NEXT · “다시 꺼내기가 실제로 관리 부담과 재방문을 줄이는가?” 검증 예정

After evidence, claim only what participants actually demonstrated. Do not convert small-N directional observations into broad retention or productivity claims.
