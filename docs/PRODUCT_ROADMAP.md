# ItJima Product Roadmap v1

## Product Vision

ItJima is **NOT** another calendar.

It is **NOT** another note app.

It is **NOT** an AI chat.

**ItJima is the fastest way to move thoughts from your brain into action.**

## Core Experience

```
Capture → Understand → Organize → Execute → Remember
```

---

## Priority 1 — Home (Inbox)

**Reference:** KakaoTalk, Apple Notes

### Goals

- Ultra-fast capture
- Keyboard auto focus
- Voice capture
- Image capture
- One tap save
- No friction

### Brain Mirror

Only when needed. **Do NOT call AI every time.**

Trigger only when:

- Multiple actions
- Date words
- Organization needed

Otherwise: **Store immediately.**

### Swipe

Home messages support swipe.

| Direction | Action |
|-----------|--------|
| Right | Schedule |
| Left | Archive |
| Down | Delete |

**Undo always exists.**

### Focus Sorting

Restore Tinder mode.

- Real physics: rotation, spring, momentum, velocity, snap
- Next card animation

---

## Priority 2 — Schedule

**Reference:** Apple Reminders, Apple Calendar, TickTick

### Two Views

- Calendar
- List — **Default: List**

Every schedule has:

- Countdown Ring
- Remaining Time
- Quick Alarm
- Quick Timer
- Swipe complete
- Long press edit

### Quick Time

Today · Tomorrow · Tonight · Weekend · Custom · Wheel Picker

No page transition. Everything inside **Bottom Sheet**.

---

## Priority 3 — Archive

**Reference:** Apple Notes

Hybrid organization: **Manual + AI**

- Search
- Semantic search
- Group similar thoughts
- Related thoughts
- Recent thoughts

---

## Priority 4 — Smart Delete

AI suggests low-value thoughts (e.g. `asdf`, `ㅋㅋㅋ`, `ㅁㄴㅇㄹ`, `test`).

- **Only suggestion**
- **Never auto delete**
- **Always confirm**

---

## Priority 5 — Performance

Every interaction **under 150ms**, **60fps**, native feeling, Apple quality.

---

## AI Cost Strategy

Never call AI unnecessarily.

```
Rule Engine → Small AI → Large AI
```

### Rule Engine

- Date detection
- Action detection
- Simple classification

### Small AI

- Brain Mirror
- Simple understanding

### Large AI

- Weekly Review
- Thinking Insights
- Pattern Discovery
- Memory Digest — **only once per day**

---

## Version Milestones

| Version | Scope |
|---------|--------|
| **v0.1** | Capture, Brain Mirror, Swipe, Schedule, Archive, Delete |
| **v0.3** | Apple-quality Schedule — Countdown Ring, Alarm, Timer, Bottom Sheet |
| **v0.5** | Archive — Semantic Search, Related Thoughts, Hybrid Organization |
| **v1.0** | Thinking Insights, Repeated Thoughts, Memory Pattern, Long-term Trends, Weekly Brain Review |

---

## Absolute Rule

Never become another ChatGPT.

Never become another Notion.

Never become another Calendar.

Always remain:

```
Capture → Understand → Organize → Remember
```

---

## AI Budget Rules

Every new thought starts in **Rule Engine**.

| Condition | Action |
|-----------|--------|
| Rule Engine confidence > 90% | Never call AI |
| Simple schedule detection succeeds | Never call AI |
| Simple archive detection succeeds | Never call AI |

Only call AI when:

- Multiple intentions exist
- User wrote more than 2 actions
- User wrote long, messy thoughts
- Brain Mirror confidence is low
- User explicitly taps **「다시 이해해줘」**

**Maximum: 1 AI call per thought.**

Never call AI again unless user requests re-analysis.

**Thinking Insights:** Batch process once every 24 hours. Never process in real time.
