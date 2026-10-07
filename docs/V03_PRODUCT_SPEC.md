# ItJima V03 — Contextual Resurfacing

Status: V03 experiment · separate from the V02 portfolio release

## 1. Why V03 exists

V02 reduced the effort required to capture schedules and tasks with natural language. The next product risk is no longer only whether people can enter a record easily. It is whether ItJima gives them a reason to return after capture.

V03 therefore moves the main hypothesis from **how to capture** to **when to bring a record back**.

> If ItJima quietly resurfaces a previously captured record at a useful moment, users will recover value from what they saved without feeling responsible for managing a backlog.

This is a NEXT hypothesis. Do not present it as validated before user evidence exists.

## 2. Product position

ItJima is not trying to become a general AI agent, another calendar, or another note database.

The V03 promise is:

> 생각나는 건 그냥 남겨두세요. 필요한 순간에 잊지마가 다시 꺼내드릴게요.

Working English line:

> Drop it now. Meet it again when it matters.

The product metaphor is a **living sticky note**: lightweight to create, easy to forget, and able to return when relevant.

## 3. Core loop

**Capture → Forget → Resurface → Act**

### Capture
- Keep V02 natural-language capture.
- The user must not choose between schedule / task / memo before writing.
- Unsafe date/time assumptions still require clarification.

### Forget
- No inbox-cleanup obligation should be introduced in V03.
- Records can remain quiet without demanding organization.

### Resurface
- Show one useful record rather than a feed of old records.
- Every resurfacing moment must have an explainable reason.
- V03 reasons are limited to:
  - `upcoming_schedule`: a linked schedule is approaching.
  - `long_unvisited`: an older record has not been revisited.
  - `quiet_revisit`: a lightweight revisit candidate when no stronger signal exists.
- First experimental resurfacing may occur after 8 hours so same-day UT is possible.
- After the first resurfacing, the default minimum record age is 3 days.

### Act
Every surfaced record must give the user control:
- `기록 보기` — open / expand the record.
- `나중에 다시` — snooze for 3 days.
- `그만 보기` — exclude the record from future resurfacing.

## 4. V03 MVP boundaries

### In scope
- Existing Capture flow.
- One-card contextual resurfacing experience.
- Candidate ranking using record age, visits, and linked upcoming schedule.
- Return-visit trigger for the experiment.
- Resurfacing analytics that do not send user-entered record content.
- User control: open, snooze, hide.

### Explicitly out of scope
- General-purpose agent actions.
- Automatic email / reservation / purchase execution.
- Location tracking for the first V03 experiment.
- Large AI-generated memory interpretation.
- AI grouping, thought maps, memory journeys, or cleanup surfaces.
- A new calendar UI.
- A backlog-management workflow.
- Multiple resurfacing cards in one session.

## 5. Validation plan

Use 5–8 external participants where possible. Prefer longitudinal use over a one-off prototype impression.

Evaluate four questions:
1. **Value** — Was the resurfaced record actually useful?
2. **Timing** — Did it appear at a reasonable moment?
3. **Control** — Were Later / Hide sufficient to prevent annoyance?
4. **Trust** — Did the user understand why this record returned?

Primary behavioral events:
- `rediscovery_impression`
- `rediscovery_open`
- `rediscovery_later`
- `rediscovery_hide`

Do not treat impressions as success. The experiment is promising only if users open useful records, tolerate timing, and retain a sense of control.

## 6. Portfolio boundary

The portfolio remains truthful as:

- **V02** — validated / observed natural-language capture experience and its limits.
- **V03** — NEXT hypothesis exploring whether contextual resurfacing can create a reason to return.

The V02 portfolio snapshot is preserved independently from V03 development. V03 evidence should only be added to the portfolio after actual testing.
