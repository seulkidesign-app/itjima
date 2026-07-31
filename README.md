# 잊지마 · Itjima

자연어로 말하듯 남기면, 확실한 일정 정보는 채우고 애매한 부분만 확인하는 일정 캡처 도구입니다.

## Product focus

Itjima reduces the work between remembering something and turning it into a usable schedule.

Core flow:

1. Type or speak a rough plan.
2. Interpret it as a schedule or a later task.
3. Show what the system understood.
4. Ask only when a date or time includes an unsafe assumption.
5. Add the confirmed result to the schedule.

Examples:

- `내일 오후 3시에 치과` → one-tap schedule creation
- `내일 3시에 치과` → confirm AM/PM before creation
- `주말에 수진이 만나기` → confirm the weekend date
- `엄마한테 전화하기` → keep as a later task or add a date

## Product principles

- **Say it roughly. Confirm only what matters.**
- Do not silently change a date when the stated time has already passed.
- Do not present deterministic parsing as generative AI.
- Keep notification delivery separate from the core schedule-capture value.

## Architecture

- React 19 + TypeScript + Vite
- TanStack Router and React Query
- Supabase authentication, sync, RLS, Edge Functions, and scheduled reminder queue
- PWA service worker and Web Push
- Deterministic Korean/English natural-language rules on the hot path
- Optional server-side Anthropic endpoint, disabled in the v1 product surface

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

Set the public Supabase and VAPID variables described in `.env.example`. Server-only keys must stay in Vercel or Supabase function secrets.

## Validation

```bash
npm run test:release
npm run test:nl
npm run test:e2e
```

The release build runs schedule parsing, confirmation safety, notification, sync, accessibility, and deep-link regression tests before Vite builds the app.

## Current scope

The portfolio MVP focuses on natural-language schedule and task capture. Archive intelligence, rediscovery, AI grouping, and broader memory-lifecycle experiments remain feature-gated until separately validated with users.
