# Real-Device QA Checklist — Itjima Beta RC

Manual verification for external beta (5–10 testers). **Do not mark PASS unless tested on the stated platform.**

Last updated: 2026-07-25 (RC verification sprint)

---

## How to use

1. Install the beta build (production URL or PWA install prompt).
2. Complete each section on the listed device/browser.
3. Record: **PASS** / **FAIL** / **UNTESTED** + notes.
4. File P0/P1 bugs before inviting external testers.

---

## iOS Safari

| Check | Status | Notes |
|-------|--------|-------|
| Home capture + send | UNTESTED | |
| Brain Mirror appears after capture | UNTESTED | |
| NL schedule confirm sheet | UNTESTED | |
| Decision Deck swipe (right=schedule, left=archive, down=keep) | UNTESTED | |
| Swipe responsiveness / no browser back conflict | UNTESTED | |
| Archive swipe delete + undo snackbar | UNTESTED | |
| Schedule Today tab | UNTESTED | |
| Schedule Calendar tab + date select | UNTESTED | |
| Bottom sheet open/close (Brand Hub, detail) | UNTESTED | |
| Keyboard does not cover primary actions | UNTESTED | |
| Safe area / home indicator (no overlap) | UNTESTED | |
| Reload persistence (thoughts, schedule, archive) | UNTESTED | |
| Offline capture → reconnect sync | UNTESTED | |
| Voice input — no duplicate submission | UNTESTED | |
| Links inside thoughts open correctly | UNTESTED | |
| Copy/paste in input | UNTESTED | |
| Reduced motion (`Settings → Accessibility`) | UNTESTED | |
| Large text (`Dynamic Type`) | UNTESTED | |

---

## iOS installed PWA (Add to Home Screen)

| Check | Status | Notes |
|-------|--------|-------|
| Install prompt / Add to Home Screen | UNTESTED | |
| Launch in standalone (no Safari chrome) | UNTESTED | |
| Safe area in standalone layout | UNTESTED | |
| Status bar / home indicator spacing | UNTESTED | |
| Reload after force-quit | UNTESTED | |
| Offline capture in PWA | UNTESTED | |
| Swipe vs edge gesture conflict | UNTESTED | |
| Haptic on swipe commit (if supported) | UNTESTED | |
| Notification permission (if shown) | UNTESTED | |

---

## Android Chrome

| Check | Status | Notes |
|-------|--------|-------|
| Home capture flow | UNTESTED | |
| Decision Deck swipes | UNTESTED | |
| Archive delete + undo | UNTESTED | |
| Schedule Calendar month navigation (44px targets) | UNTESTED | |
| Sheet backdrop + drag-to-dismiss | UNTESTED | |
| Keyboard viewport resize | UNTESTED | |
| Safe area / gesture nav bar | UNTESTED | |
| Reload persistence | UNTESTED | |
| Offline → online sync | UNTESTED | |
| Voice input duplicate prevention | UNTESTED | |
| Text selection in archive detail | UNTESTED | |

---

## Android installed PWA

| Check | Status | Notes |
|-------|--------|-------|
| Install prompt (Chrome menu → Install app) | UNTESTED | |
| Standalone launch | UNTESTED | |
| Safe area / nav bar overlap | UNTESTED | |
| Reload persistence in PWA | UNTESTED | |
| Offline capture in PWA | UNTESTED | |
| Swipe scroll conflict in sheets | UNTESTED | |

---

## Cross-platform regression spots

These areas were changed in the RC sprint — prioritize on real devices:

- **Destructive copy**: Archive swipe label `삭제하기`, snackbar `삭제했어요 · 되돌리기`
- **Calendar polish**: month nav touch targets, today vs selected rings, event dots
- **Sheet transitions**: Login, Brand Hub, NL schedule — backdrop `ink/35` + blur
- **Schedule delete toast**: `삭제했어요` (calendar event menu)

---

## Beta safety (smoke on any device)

| Check | Status | Notes |
|-------|--------|-------|
| No NL debug panel in production URL | UNTESTED | `?nlDebug=1` should not enable in prod |
| No console errors on Home → capture → Home | UNTESTED | |
| No thought text visible in network analytics | UNTESTED | Inspect devtools Network tab |

---

## Sign-off

| Role | Name | Date | Beta-ready? |
|------|------|------|-------------|
| Product / Design | | | |
| Engineering | | | |
| QA | | | |

**Minimum for external beta:** All P0 flows PASS on at least one iOS and one Android device; PWA install tested once per platform.
