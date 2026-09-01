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
- The UT must use normal canonical Capture records as its primary source. Archive-only seeding does not validate the core product promise.
- Opening a resurfaced record stays inside Rediscovery; do not send the participant into legacy Archive IA during the value test.

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

Best: participants use Itjima naturally long enough to accumulate their own Capture records.

If time does not allow a longitudinal setup, seed realistic **canonical records** with the participant before the session and preserve at least these differences:

- 3–6 day old record
- 7–20 day old record
- 21+ day old record
- one record related to an upcoming schedule when available
- one record the participant no longer cares about

Do not require the participant to organize or archive these records first. That would test a different hypothesis.
Never seed deleted, completed, or unresolved-clarification content as a Rediscovery candidate.

## Session flow

1. Let the participant use Capture normally first.
2. Present Rediscovery without explaining why the item was chosen.
3. Ask them to think aloud only after they have read the resurfaced record.
4. Let them choose naturally among the existing actions.
5. If they choose `기록 보기`, expand the full record in place and observe what they want to do next without sending them to another product area.
6. `나중에 다시` snoozes the record for 3 days; `그만 보기` permanently excludes that record from Rediscovery selection.
7. After the interaction, ask the short interview questions below.

Do not frame `나중에 다시` as failure. It is timing evidence: the record may be valuable but the current moment may be wrong.

## Instrumented events

No event may contain record id, title, text, raw text, tags, or other user-entered content.

Events:

- `rediscovery_impression`
- `rediscovery_open`
- `rediscovery_later`
- `rediscovery_hide`

Allowed context only:

- `reason`: `upcoming_schedule | long_unvisited | quiet_revisit`
- `age_bucket`: `3_6d | 7_20d | 21_59d | 60d_plus`
- `visit_bucket`: `0 | 1 | 2_plus`
- `has_related_schedule`: boolean
- `repeat_visit`: boolean
- `source`: `record | archive`

`source` exists only to verify that real Capture records, rather than legacy Archive-only data, are powering the UT. It contains no user content.

## What to observe

### Primary qualitative evidence

- Participant immediately recognizes the resurfaced record.
- Participant can explain in their own words why seeing it now is useful or not useful.
- Participant takes a meaningful next action without being told what to do.
- The surface feels like help, not work.

### Directional behavioral signals

Use counts, not statistically framed rates, with N=5–8:

- surfaced → opened
- surfaced → later
- surfaced → hidden
- surfaced → ignored / session ended
- later → useful when it eventually returns vs still irrelevant
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
- Same item returns again in the same session or often enough to annoy.
- User cannot tell the difference between `나중에 다시` and `그만 보기`.
- A user who only used Capture never receives a candidate because they did not manually archive anything.
- Deleted, completed, or unresolved content returns.
- Resurfaced content differs from the current canonical record.
- Opening Rediscovery mutates schedule/canonical state unexpectedly.
- Opening the record forces the participant into legacy Archive IA and confounds the test.

Any deleted-record resurrection or cross-account content leak is P0 and blocks further UT.

## Decision after 5–8 sessions

Do **not** start by tuning ranking weights.

First classify evidence into:

1. **Value** — did resurfacing recover something the user cared about?
2. **Timing** — was now a believable moment?
3. **Control** — could the user defer/dismiss without management burden?
4. **Trust** — did the surfaced content/state remain correct?

Only then decide whether to adjust candidate age, cooldown/repetition, action semantics, or placement.

## Portfolio claim discipline

Before evidence:

> NEXT · “다시 꺼내기가 실제로 관리 부담과 재방문을 줄이는가?” 검증 예정

After evidence, claim only what participants actually demonstrated. Do not convert small-N directional observations into broad retention or productivity claims.
