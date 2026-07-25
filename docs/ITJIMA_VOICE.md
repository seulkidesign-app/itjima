# Itjima Voice System

Warmth must never reduce clarity. Every string passes two tests:

1. Can the user immediately understand what will happen?
2. Does it still feel like Itjima?

---

## Four layers

### 1. Action copy — clear and literal

Used on buttons, menu items, and primary CTAs.

| Context | KO | EN |
|---------|----|----|
| Schedule | 일정에 추가 | Add to schedule |
| Task | 할 일로 넣기 | Add as task |
| Archive | 보관함에 맡기기 | Save to vault |
| Pick date | 날짜 고르기 | Pick a date |
| Undo | 되돌리기 | Undo |
| Delete | 삭제하기 | Delete |

**Rules:** Noun/action forms. No conversational promises ("맡겨둘게요" on buttons).

---

### 2. Interpretation copy — warm and concise

Used in Brain Mirror only. Describes what Itjima understood — not what will happen.

**Good**
- "치과 예약이네요."
- "나중에 다시 보고 싶은 내용 같아요."
- "해야 할 일 같아요."

**Avoid**
- Motivation assumptions ("마음이 편해질 거예요")
- Importance claims ("분명 중요한 일")
- Fake empathy or long explanations

Source: `src/lib/warmMirrorCopy.ts` → `warmMirrorLine()`

---

### 3. Result copy — clear first, warm second

Used in toasts and snackbars after an action completes.

| Action | KO | EN |
|--------|----|----|
| Scheduled | 일정에 추가했어요 | Added to schedule |
| Archived | 보관함에 넣었어요 | Saved to vault |
| Task | 할 일로 넣었어요 | Added as a task |
| Kept | 그대로 두었어요 | Kept here |
| Deleted | 삭제했어요 · 되돌리기 | Deleted · Undo |

**Rules:** Describe what already happened. Match actual system behavior. Do not imply reminders unless created.

Supporting hint under Brain Mirror: `warmResultHint()` — literal outcome preview.

---

### 4. Emotional copy — empty, onboarding, completion only

Used when no action is pending.

**Examples**
- "떠오르면 여기 내려놓으세요."
- "머릿속이 조금 정돈됐네요."
- "하나 덜 기억해도 돼요."

**Never** on destructive actions, primary buttons, or toasts.

---

## Locale rules

- Korean locale: Korean copy only on user-facing surfaces.
- English locale: English copy only.
- Use `t(ko, en)` at call sites; never mix languages on one surface.

---

## Destructive actions

Always explicit. Never poetic.

- Button: **삭제하기**
- Toast: **삭제했어요 · 되돌리기**
- Confirm when undo unavailable: **이 생각을 삭제할까요?**

Do not use: "쉬게 두기", "보내기", "놓아주기"

---

## Brain Mirror consistency

Same thought → same interpretation line across Home, Decision Deck, and confirmations.

Do not vary phrasing by screen. One mapping source: `warmMirrorLine()`.
