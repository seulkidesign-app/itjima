# NL Intent States — Routing Reference

## Active routing intents

| Intent | Trigger | Visible UI | Primary action | Secondary action | Fallback | Failure behavior |
|--------|---------|------------|----------------|------------------|----------|------------------|
| `schedule_exact` | Date detected + not clarify + not time-only | Brain Mirror card with title, when, `→ 일정에 추가돼요` | **일정에 추가** | **수정** → 날짜 고르기 / 할 일 / 보관 / 내려놓기 | Calendar via **날짜 고르기** | `nl_parse_failed` toast; thought stays in inbox |
| `schedule_clarify` | Vague when, next week/month window, weekend meeting | Mirror + up to 3 date chips + **그대로 두기** | Chip pick (contextual) | **날짜 고르기** | Calendar sheet | Commit error toast; card remains |
| `task` | Task verb without schedule date | Mirror `→ 날짜 없이 할 일로` | **할 일로 넣기** | **날짜 추가** | Calendar for optional date | Update error toast |
| `archive` | Reference/sensitive/link cues | Mirror + privacy warning if sensitive | **보관함에 맡기기** (double-tap if sensitive) | **수정** menu | — | Archive error toast |
| `keep` | Low confidence / plain note / junk | No Brain Mirror | — | — | — | Thought stays in inbox |
| `parse_failed` | Analytics event only — missing date on confirm or commit error | Toast message | — | — | User keeps thought | Never removes thought |
| `corrected_intent` | Analytics event when user picks **다르게 이해했나요?** | Correction menu | User-selected intent action | — | Calendar if schedule chosen without date | Routes to chosen handler |

## Confidence tiers

- **high** — one-tap primary action (`schedule_exact`, `task`, `archive`)
- **medium** — clarify chips or pick-a-date (`schedule_clarify`)
- **low** — no Brain Mirror (`keep`)

## Primary flow guarantees

1. Thought saved to inbox immediately on submit
2. NL parsing is synchronous on render (rule-based, no LLM wait)
3. Parse failure never deletes the thought
4. `withNlConfirmGuard` prevents duplicate commits
5. Dismissed cards persisted in `localStorage` (`itjima.nl.acknowledged.{userId}`)
6. Calendar never opens automatically on capture
