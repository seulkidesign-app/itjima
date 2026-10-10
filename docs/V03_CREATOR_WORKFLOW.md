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

## Environment and V02 safety
- V03 must use a separate Supabase environment/project from V02 production data.
- V02 and V03 user data must never be mixed.
- `main` remains V02 until V03 is ready.
- Frozen V02 snapshot: `archive/v02-portfolio-20261010`.
- V03 implementation branch: `codex/v03-creator-workflow`.
- Do not rewrite shared Git history; this repository is connected to Lovable.
- Preserve existing PWA/auth code only where it can safely point to the V03 environment.
- Before any preview or test deployment, verify that V03 environment variables do not point to the V02 Supabase project.

## V03 data model
The UI is content-centered, but the underlying data model must separate collaboration context, content, work items, and source evidence.

### Collaboration
Represents one brand collaboration or creator project context.
Suggested fields:
- id
- user_id
- brand_name (optional for organic content)
- collaboration_type: organic / gifted / paid / unknown
- collaboration_status (optional; stored for future use, not required in alpha UI)
- created_at / updated_at

### Content
Represents one actual piece of content.
Suggested fields:
- id
- collaboration_id (nullable for organic content)
- user_id
- title
- platform: Instagram / TikTok / YouTube Shorts / Other
- format: Reel / Story / Feed / Short / Other
- lifecycle_status: idea / working / waiting / ready / published / dropped
- notes
- created_at / updated_at / published_at

A collaboration may have multiple content items. A content item must not duplicate collaboration-level source material unless necessary for display or snapshotting.

### Task / Deadline
Represents actionable work or semantic dates attached to a content item.
Examples:
- shoot
- edit
- draft_due
- revision_due
- publish_due
- retention_end
- custom

Suggested fields:
- id
- content_id
- type
- title
- due_at (nullable)
- completed_at (nullable)
- status
- sort_order

Do not model the creator workflow as one rigid linear status machine. Shooting, editing, review, revision, and publishing should primarily be represented as tasks/deadlines. `lifecycle_status` stays intentionally coarse.

### Source
Represents the original collaboration evidence.
Alpha-supported source types:
- pasted text
- uploaded screenshot/image
- reference URL (stored as a reference only; alpha does not promise to fetch or parse arbitrary links)

Suggested fields:
- id
- collaboration_id
- source_type
- raw_text (nullable)
- image_path / attachment reference (nullable)
- reference_url (nullable)
- created_at

### Extracted requirement / evidence
Every AI-extracted fact must be reviewable and traceable to source evidence before save.
Suggested fields:
- id
- collaboration_id or content_id
- field_type
- value
- evidence_text or source location
- confidence (optional)
- confirmed_by_user
- created_at / updated_at

Relevant `field_type` values include:
- brand
- deliverable
- draft_deadline
- publish_date
- mandatory_requirement
- prohibited_requirement
- usage_rights
- retention_period

`usage_rights` and `retention_period` must distinguish at least:
- explicit value found in source;
- explicitly not mentioned in source;
- unknown / not yet reviewed.

## V02 / V03 coexistence rules
- V03 screens write only to V03 data structures and the V03 Supabase environment.
- Existing V02 records, schedule/archive flows, and V02 parsing storage must not receive V03 data.
- V03 quick capture creates a reviewable V03 draft, not a V02 record.
- V02 UI may remain in code during transition, but it should be hidden from the V03 alpha navigation unless explicitly required for testing.
- Do not delete V02 infrastructure until V03 alpha works end-to-end and the V02 snapshot is verified.

## First MVP scope
### 1. Brief import → structured review
This is the first usable value path for alpha.

Supported alpha inputs:
- pasted text from DM, email, KakaoTalk, Notion, or a guide;
- screenshots/images of DM or guide content;
- external links may be stored as references, but link crawling/parsing is not required in alpha.

Create a reviewable draft containing only clearly supported fields:
- brand
- deliverable / content format
- draft deadline
- publish date
- mandatory requirements
- prohibited requirements
- usage rights
- retention period

Rules:
- never invent missing dates or requirements;
- preserve source evidence for extracted fields;
- AI output must be editable;
- save only after explicit user review/confirmation.

### 2. Content detail
A lightweight detail view with:
- content title
- lifecycle status
- platform / format
- important tasks and semantic dates
- checklist / requirements
- notes
- source brief/evidence

Primary question: **What must I do for this piece of content, and what must I not miss?**

### 3. Today / This week home
Show what needs attention now, grouped by content item rather than raw calendar events.

Examples:
- 오늘 촬영 · 바나나에그 릴스
- D-2 초안 전달 · 브랜드 A
- 금요일 업로드 · 혼클 릴스

Primary question: **What should I work on next?**

### 4. Quick capture
Reuse Itjima's fast-input strength, but do not rely on unsafe multi-date auto-save behavior from V02.

Example input:
- 금요일까지 바나나에그 릴스 초안 보내고 23일 업로드
- 이번주 혼클 릴스 촬영

For V03 alpha:
- parse conservatively;
- generate a reviewable draft;
- show extracted dates separately;
- require confirmation before save when multiple dates or ambiguous dates are present;
- never silently convert ambiguous input into final dates.

## Product event logging (alpha scope)
Product analytics event logging is required in alpha. This is separate from creator/follower performance analytics, which remains out of scope.

At minimum log:
- app_opened
- content_created
- brief_import_started
- brief_import_reviewed
- brief_import_saved
- content_opened
- task_completed
- lifecycle_status_changed
- content_published

Each event should include, where applicable:
- user_id
- content_id
- collaboration_id
- timestamp
- entry_source / entry_path

`entry_source` must allow later comparison between organic/manual opens and future notification-driven opens.

The core retention analysis is not just WAU. We need to know whether the same real content item is reopened and updated across multiple days in one production cycle.

## Retention hypothesis
V02 optimized capture. V03 tests a different question:

> Does organizing work around active content items give creators a reason to reopen Itjima during the production cycle?

The product should support repeated visits during planning → shooting/editing → review → publish, instead of one-time schedule creation.

### Notification rule for alpha
- Start alpha without push notifications or other external reminder triggers.
- First test whether the workflow itself creates repeated use.
- If repeated use fails without a trigger, do **not** immediately conclude that the problem has no value.
- Run one follow-up validation with notifications/reminders enabled before making the final retention judgment.
- In exit interviews, explicitly ask whether users did not return because the product was not useful, because they forgot to open it, or because another tool remained easier.

## Alpha test design
### Duration
2 weeks.

### Recruitment target
Recruit 5–10 external creators using real content/collaboration work.
A low-cost first channel is the creator's existing Instagram Story / audience network, e.g. recruiting people who have started receiving collaborations. If that fails, treat it as evidence of a distribution/recruitment problem rather than silently substituting internal usage.

### Success
- at least 5 external creators activate with real content; and
- at least 3 creators reopen/update the same real content item across 2 or more distinct days in one production cycle.

### Retention failure
- at least 5 external creators activate with real content; but
- 2 or fewer creators reopen/update the same real content item across 2 or more distinct days during the 2-week test.

If this happens without reminders, run the defined notification/reminder follow-up test before deciding whether to stop.

### Recruitment / activation failure
Classify separately when fewer than 5 external creators successfully activate with real content during the 2-week window.
Do not interpret this as a retention failure. Investigate recruitment channel, onboarding friction, and whether the value proposition is understandable enough to earn a first real use.

### Qualitative questions
At the end of the cycle, ask at minimum:
- What made you reopen or not reopen Itjima?
- If you did not reopen, was it because you did not need it, forgot it existed, or preferred another tool?
- Which original source (DM/email/KakaoTalk/guide) did you still go back to despite using Itjima?
- What information did you still have to manage elsewhere?

## Explicitly out of scope for V03 alpha
- revenue / income tracking
- invoicing
- contract management
- visible brand CRM / sales pipeline UI
- automated negotiation
- follower / content performance analytics
- social API publishing
- team collaboration
- AI performance recommendations
- generic life calendar replacement

`collaboration_status` may exist as an optional data field for future compatibility, but proposal/pipeline management is not part of the alpha user experience.

## UX principles
- Mobile first. PWA remains the initial shipping format.
- Keep the existing Itjima brand unless user testing strongly contradicts it.
- Preserve fast capture, but never at the expense of correctness.
- Content is the organizing unit in the UI; calendar is secondary.
- Never fabricate ambiguous dates.
- Keep AI outputs editable, traceable, and confirmable.
- Prefer one clear next action over dashboards full of metrics.
- The home screen must answer "지금 뭘 해야 하지?" within a few seconds.

## First implementation milestone
Implement in this order:
1. V03 environment separation and data/event schema;
2. text + screenshot brief import and reviewable structured draft;
3. content detail with tasks/checklist/source evidence;
4. Today / This week work queue;
5. conservative quick capture with confirmation.

Do not remove V02 infrastructure until the V03 alpha flow works end-to-end.
