# Itjima Natural Language Scheduling — Beta Test Guide

## Test goal

Can users naturally write a thought and understand what Itjima did?

The Brain Mirror should feel like a short, warm confirmation — not an AI lecture. Users should know what was understood, what will happen when they tap the primary button, and where the item will land.

## Required tasks (5)

Ask each tester to complete these in order:

1. **Exact schedule** — type `내일 3시에 치과` and tap **일정에 추가**
2. **Clarification** — type `다음주쯤 보기`, pick a date chip or **날짜 고르기**
3. **Task** — type `엄마한테 전화하기` and tap **할 일로 넣기**
4. **Archive** — type `여권 번호`, read the privacy note, tap twice to **보관함에 맡기기**
5. **Free capture** — type something they usually forget in daily life (no script)

## Observer checklist

During the session, note:

- [ ] Did the user understand the Brain Mirror without explanation?
- [ ] Did they notice the primary action button?
- [ ] Did they use the calendar fallback (**날짜 고르기** / **날짜 추가**)?
- [ ] Did they correct the intent (**다르게 이해했나요?**)?
- [ ] Did they hesitate before tapping?
- [ ] Did they trust the result?
- [ ] Did they understand where the item went (일정 / 할 일 / 보관함 / 던진 곳)?

## Post-test questions

1. 이 앱이 무엇을 해주는 앱이라고 느꼈나요?
2. 가장 신기하거나 편했던 순간은 무엇이었나요?
3. 가장 헷갈렸던 부분은 무엇이었나요?
4. 평소 어떤 내용을 이 앱에 넣을 것 같나요?
5. 다시 사용할 의향이 있나요? 왜 그런가요?

## Debug mode (facilitators only)

Append `?nlDebug=1` to the beta URL to see intent, confidence, date/time flags, and parsing path. This panel is never shown to normal production users.

## What not to test in this beta

- Multi-thought splitting
- Calendar sync
- Conversational AI
- Automatic schedule creation without confirmation
