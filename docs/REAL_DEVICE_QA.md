# Real-Device QA Checklist — Itjima Core Product Sprint

Manual verification for external beta. **Do not mark PASS unless tested on the stated platform.**

Last updated: 2026-07-25 (Core Product Completion sprint)

---

## Beta gate (minimum)

| Platform | Required | Status |
|----------|----------|--------|
| iPhone installed PWA | Core loop A–F | UNTESTED |
| Android installed PWA | Core loop A–F | UNTESTED |

**Beta blocked by reminder architecture** until at least one iOS PWA and one Android PWA complete notification tests with app closed.

---

## Core flows

| Flow | Description | iOS PWA | Android PWA | Notes |
|------|-------------|---------|-------------|-------|
| A | Text capture → Brain Mirror → schedule → detail | UNTESTED | UNTESTED | |
| B | Voice capture — exactly one thought | UNTESTED | UNTESTED | |
| C | Schedule reminder fires once; edit cancels old | UNTESTED | UNTESTED | SW + in-tab fallback |
| D | Archive group → detail → search → delete → undo | UNTESTED | UNTESTED | |
| E | Decision Deck — no overlay collision | UNTESTED | UNTESTED | |
| F | Reload persistence (schedule + archive + groups) | UNTESTED | UNTESTED | |

---

## Capture

| Check | iOS Safari | iOS PWA | Android Chrome | Android PWA |
|-------|------------|---------|----------------|-------------|
| Text capture — one thought per submit | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| Voice — no duplicate transcript | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| Newest thought visible after capture | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| Keyboard does not hide latest thought | UNTESTED | UNTESTED | UNTESTED | UNTESTED |
| "최신 생각 보기" when scrolled up | UNTESTED | UNTESTED | UNTESTED | UNTESTED |

---

## Schedule

| Check | iOS PWA | Android PWA |
|-------|---------|-------------|
| Quick dates [오늘][내일][이번 주말] sync with calendar | UNTESTED | UNTESTED |
| Start/end time; all-day | UNTESTED | UNTESTED |
| Overdue grouped under "지난 일정" | UNTESTED | UNTESTED |
| Detail/edit/delete | UNTESTED | UNTESTED |
| Reminder permission denied — UI shows state | UNTESTED | UNTESTED |
| Reminder while app closed | UNTESTED | UNTESTED |
| Reminder while device locked | UNTESTED | UNTESTED |
| Notification tap opens correct schedule | UNTESTED | UNTESTED |
| Edit schedule replaces reminder | UNTESTED | UNTESTED |

### Notification architecture limitations

- **In-tab timers**: reliable while app/tab is open (7-day horizon).
- **Service worker**: schedules background notifications on supported platforms (Android Chrome PWA best; iOS 16.4+ PWA limited).
- **iOS Safari tab closed**: reminders may not fire — **beta blocker** until verified on device.
- **Backend Web Push**: not implemented; required for guaranteed closed-app delivery on all platforms.

---

## Archive

| Check | iOS PWA | Android PWA |
|-------|---------|-------------|
| Groups visible (전체 default) | UNTESTED | UNTESTED |
| Row shows type, preview, group, date | UNTESTED | UNTESTED |
| Detail sheet complete | UNTESTED | UNTESTED |
| Search across title/body/url/group | UNTESTED | UNTESTED |
| Delete + undo snackbar | UNTESTED | UNTESTED |

---

## Semantic UI

| Check | Status | Notes |
|-------|--------|-------|
| Schedule = yellow | UNTESTED | |
| Task = blue | UNTESTED | |
| Archive = green | UNTESTED | |
| Keep = neutral gray | UNTESTED | |
| Destructive = red only | UNTESTED | |

---

## Sign-off

| Role | Name | Date | Beta-ready? |
|------|------|------|-------------|
| Product / Design | | | |
| Engineering | | | |
| QA | | | |

**Do not claim beta readiness without real-device notification verification.**
