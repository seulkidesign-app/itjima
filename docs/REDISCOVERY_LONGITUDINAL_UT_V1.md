# Rediscovery Longitudinal UT v1 — Return + Value

Status: **NEXT hypothesis · not yet validated**

This is the primary 7–10 day value study. `REDISCOVERY_UT_V1.md` remains the single-encounter/session protocol and implementation boundary.

## One question

> When people return to Itjima on their own after a few days, does a resurfaced record create real value?

Both parts are required:

1. **Return** — the participant comes back without a researcher reminder or test-session prompt.
2. **Value** — the resurfaced record is recognized as useful, changes what the participant remembers/decides/does, or is deliberately deferred/dismissed for a reason they can explain.

Do not mix this with the already-observed question of whether natural-language Capture feels convenient.

## Participants and duration

- 5–8 external participants.
- 7–10 days.
- Prefer people who already use self-chat, Notes, simple reminders, or lightweight memo tools.
- Do not recruit only power users of Notion/task managers.
- Participants should use Itjima normally; there is no daily task quota.

Small-N evidence is directional. Use participant counts and observed behavior, not statistical claims.

## Day 0

- Enable the existing local `REDISCOVERY` feature override for the participant environment.
- Explain only normal Capture: leave thoughts, tasks, and schedules as they naturally occur.
- Do **not** explain Rediscovery, candidate ranking, age thresholds, or the study hypothesis.
- Do not seed old records unless longitudinal timing is impossible. Natural canonical Capture records are preferred.

The first study visit never auto-opens Rediscovery, even if an eligible old record already exists. This prevents onboarding from becoming a Rediscovery demo.

## Days 1–10

- No researcher reminder to reopen the app.
- No message such as “check what came back.”
- A new study visit is counted after at least 30 minutes away from the previous visit.
- On a genuine return visit, if an eligible Rediscovery candidate exists, the experimental surface may open automatically.
- Refresh/back navigation inside the same visit must not count as another return.

Instrumented visit event:

- `rediscovery_session_start`
  - `return_gap_bucket`: `first | 30m_23h | 1_2d | 3_6d | 7d_plus`
  - `study_age_bucket`: `day_0_2 | day_3_6 | day_7_plus`

Combine it with the existing privacy-safe events:

- `rediscovery_impression`
- `rediscovery_open`
- `rediscovery_later`
- `rediscovery_hide`

No analytics event may contain record id, text, raw text, title, tags, user-entered content, or account identifiers.

## What counts as a meaningful Rediscovery

A meaningful Rediscovery requires all of the following:

1. The app visit was spontaneous — no researcher prompt triggered the return.
2. A Rediscovery impression occurred on that visit.
3. In the exit interview, the participant can point to a concrete value or reasoned non-value, rather than merely saying the screen looked nice.

Strong examples:

- “아, 이거 까먹고 있었네” and they act on it or change a decision.
- The record reconnects them to something they intended to revisit.
- `나중에 다시` is chosen because the record matters but the timing is wrong.

Not enough by itself:

- Opening the app once because the researcher asked.
- Tapping `기록 보기` only because they are in a usability test.
- Saying “좋아요” without explaining why the resurfaced record mattered.

## Exit interview

Keep it short, 10–15 minutes. Ask in this order:

1. “테스트 기간 동안 앱을 다시 열게 된 순간이 있었나요? 왜 열었어요?”
2. “예전에 남긴 기록이 다시 나온 순간이 기억나요?”
3. “그 기록이 안 나왔어도 직접 다시 찾았을 것 같아요?”
4. “다시 나온 기록 때문에 실제로 기억하거나, 결정하거나, 행동한 게 있었나요?”
5. “도움이라기보다 해야 할 일이 하나 더 생긴 느낌은 없었나요?”
6. “너무 자주 나오거나, 왜 나왔는지 이상했던 순간이 있었나요?”

Do not ask “재발견 기능 어때요?” before these questions.

## Pre-committed decision rule

Use this as a product-decision threshold, not statistical proof.

- **Weak positive** — at least half of participants have at least one meaningful Rediscovery from a spontaneous return visit.
- **Stronger signal** — multiple participants experience meaningful Rediscovery more than once without describing it as repetitive work.
- **Ambiguous** — people return and see records, but value is mostly cosmetic/curiosity and does not affect memory, decisions, or action.
- **Negative** — almost nobody returns on their own, or resurfaced records repeatedly feel irrelevant/annoying/queue-like.

Any deleted-record resurrection, cross-account leak, or canonical/projection mismatch is a P0 integrity failure and stops the study until fixed.

## After the study

Classify evidence in this order:

1. **Return** — did they come back on their own?
2. **Value** — did a resurfaced record matter?
3. **Timing** — was that moment believable?
4. **Control** — did `나중에 다시` / `그만 보기` avoid management burden?
5. **Trust** — was the record/state correct?

Do not tune ranking weights before separating these five causes.

## Portfolio claim discipline

Before evidence:

> NEXT · “다시 꺼내기가 실제로 관리 부담과 재방문을 줄이는가?” 검증 예정

After evidence, claim only what this 5–8 person study actually demonstrates. Do not call directional small-N observations retention proof.
