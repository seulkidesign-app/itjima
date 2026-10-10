# Itjima V03 — Creator Workflow

## Goal
Build a mobile-first PWA for solo short-form creators who are starting to manage multiple content tasks and brand collaborations at once.

V03 is not a generic calendar and not a full creator CRM. The first release should help a creator turn scattered collaboration/content information into a simple, actionable workflow they will reopen several times per week.

## Primary user
Solo Instagram / TikTok / Reels creator, initially beauty/lifestyle oriented, who:
- plans and produces content alone;
- receives some brand collaboration requests via Instagram DM, email, KakaoTalk, Notion, Google Docs, or external guide links;
- currently re-organizes deadlines and requirements manually;
- does not need enterprise CRM, invoicing, pipeline management, or team collaboration.

## Core product promise
촬영할 것, 올릴 것, 협찬 마감까지 한곳에서.

Working English positioning:
Content and brand-deal workflow for solo creators.

## V03 product model
The primary object is **Content**, not an event.

A content item can contain:
- title
- brand / collaboration name (optional)
- platform: Instagram / TikTok / YouTube Shorts / Other
- type: organic / gifted / paid collaboration
- status
- key dates
- requirements / checklist
- source note or pasted brief

### Default workflow states
1. Idea
2. Planned
3. Shooting
4. Editing
5. Draft / Review
6. Scheduled
7. Published

Not every item needs every state.

## First MVP scope
### 1. Today / This week home
Show what needs attention now, grouped by content item rather than raw calendar events.

Examples:
- 오늘 촬영 · 바나나에그 릴스
- D-2 초안 전달 · 브랜드 A
- 금요일 업로드 · 혼클 릴스

Primary question: **What should I work on next?**

### 2. Content item
A lightweight detail view with:
- content title
- status
- platform
- important dates
- checklist / requirements
- notes / original brief

### 3. Quick capture
Reuse Itjima's existing fast-input strength.
Accept rough natural-language input such as:
- 금요일까지 바나나에그 릴스 초안 보내고 23일 업로드
- 이번주 혼클 릴스 촬영

For V03-alpha, parsing may be conservative. Do not invent dates or requirements that are not explicit.

### 4. Brand collaboration brief → structured draft
Paste text from DM / email / guide and create a reviewable draft containing only clearly supported fields:
- brand
- deliverable
- draft deadline
- publish date
- mandatory requirements
- prohibited requirements

All extracted information must be reviewable before save.

## Explicitly out of scope for V03-alpha
- revenue / income tracking
- invoicing
- contract management
- brand CRM / sales pipeline
- automated negotiation
- follower analytics
- social API publishing
- team collaboration
- AI performance recommendations
- generic life calendar replacement

## Retention hypothesis
V02 optimized capture. V03 must test a different question:

> Does organizing work around active content items give creators a reason to reopen Itjima during the production cycle?

The product should support repeated visits during idea → shooting → editing → publish, instead of one-time schedule creation.

## Success criteria for alpha
Do not optimize for signups yet.
Track:
- activation: user creates or imports at least 1 content item;
- weekly active use;
- number of days opened per week;
- content items updated after initial creation;
- 7-day and 14-day return;
- whether users complete real content work using the app.

Initial qualitative target:
- 5–10 external creators use it with real content;
- at least 3 reopen it multiple times across one content production cycle.

## UX principles
- Mobile first. PWA remains the initial shipping format.
- Keep the existing Itjima brand unless user testing strongly contradicts it.
- Preserve fast capture; remove generic productivity complexity.
- Content is the organizing unit; calendar is a secondary view.
- Never fabricate ambiguous dates.
- Keep AI outputs editable and confirmable.
- Prefer one clear next action over dashboards full of metrics.

## Migration / V02 safety
- `main` remains V02 until V03 is ready.
- Frozen V02 snapshot: `archive/v02-portfolio-20261010`.
- V03 implementation branch: `codex/v03-creator-workflow`.
- Do not rewrite shared Git history; this repository is connected to Lovable.

## First implementation milestone
Build only the shell necessary to test the new information architecture:
1. creator-focused home / work queue;
2. content item data model and sample states;
3. content detail view;
4. quick add flow;
5. retain PWA installability and existing authentication/infrastructure where possible.

Do not remove V02 infrastructure until the V03 alpha flow works end-to-end.
