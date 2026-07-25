# Swipe Experience — Decision Deck

Commercial-quality swipe interaction for Itjima’s dedicated processing space.

## Interaction audit (before → after)

| Aspect | Before | After |
|--------|--------|-------|
| Swipe right | Later (medium) | **Schedule** (`today`) |
| Swipe left | Today | **Archive** (`archive`) |
| Swipe down | Deck navigation (skip) | **Keep here** (`later`) |
| Swipe up | Previous card | Removed (no upward decision) |
| Action buttons | Secondary / inconsistent | Persistent `[보관][그대로][일정]` — same handlers as gestures |
| Preview labels | At commit threshold only | Appear at **12%** drag, full emphasis at **31%** |
| Empty vs complete | `items.length === 0` showed empty mid-session | Uses `initialTotal === 0` for true empty; completion when deck clears |
| Undo on last card | Hidden on completion screen | **Undo visible** on completion + snackbar |
| Tutorial | None | One-time overlay; replay from Brand Hub |
| Analytics | Basic `decision_*` | Full `swipe_*` privacy-safe events |

## Final direction mapping

| Gesture / button | Outcome | Data action | Toast |
|------------------|---------|-------------|-------|
| Right / 일정 | `today` | Move to schedule | 일정으로 보냈어요 · 되돌리기 |
| Left / 보관 | `archive` | Move to vault | 보관함에 넣었어요 · 되돌리기 |
| Down / 그대로 | `later` | Mark kept in inbox | 그대로 두었어요 |

## Thresholds (`src/lib/swipeInteraction.ts`)

| Token | Value | Purpose |
|-------|-------|---------|
| `SWIPE_DISTANCE_RATIO` | 0.31 (31%) | Horizontal commit |
| `SWIPE_KEEP_RATIO` | 0.25 (25%) | Downward keep commit |
| `SWIPE_PREVIEW_START_RATIO` | 0.12 (12%) | Label preview begins |
| `SWIPE_PREVIEW_PROGRESS` | 0.28 | Minimum progress before label renders |
| `SWIPE_THRESHOLD_PROGRESS` | 0.92 | Single haptic tick at near-commit |
| `SWIPE_VELOCITY_X` | 720 px/s | Horizontal fling commit |
| `SWIPE_VELOCITY_Y` | 680 px/s | Downward fling commit |
| `SWIPE_MAX_ROTATE` | 6° | Horizontal drag rotation cap |
| `SWIPE_DRAG_START_PX` | 8px | Delay before drag (link/tap safety) |
| `SWIPE_EDGE_EXCLUSION_PX` | 20px | No horizontal swipe from screen edges |
| `STACK_SCALE` | 0.97, 0.94 | Second/third card peek |

## Gesture conflict handling

- **Axis lock**: horizontal vs vertical once movement dominates (1.15× ratio).
- **Edge exclusion**: pointer down within 20px of viewport edge ignored for horizontal swipe.
- **touch-action**: `touch-pan-y` on active card — vertical page scroll preserved.
- **Interactive targets**: buttons, links, inputs marked `[data-no-drag]` skip drag initiation.
- **Snap-back cancel**: ongoing spring animation stopped on new pointer down.
- **Interaction lock**: `actingRef` + `exiting` prevent duplicate commits from gesture + button.

## Motion tokens

Defined in `src/lib/motion.ts` and `src/lib/motionLanguage.ts`:

| Tier | Duration |
|------|----------|
| instant | 120ms |
| micro | 180ms |
| component | 250ms |
| sheet/page | 320ms |

Easing: `cubic-bezier(0.2, 0.8, 0.2, 1)` (standard), `cubic-bezier(0.4, 0, 1, 1)` (exit).

Card exit springs: medium-high stiffness, medium damping, low overshoot (`MOTION_SCHEDULE`, `MOTION_ARCHIVE`).

## Spacing tokens

4px grid in `src/styles.css`: `--space-1` through `--space-12`.

Decision Deck uses `--space-4` gutters (16px compact), `--space-6` bottom safe-area padding, 44px min touch targets on action buttons.

## Key files

| File | Role |
|------|------|
| `src/components/DecisionDeck.tsx` | Full swipe deck UI |
| `src/lib/decision.ts` | Axis lock, preview, commit logic |
| `src/lib/swipeInteraction.ts` | Shared thresholds |
| `src/lib/swipeAnalytics.ts` | Privacy-safe events |
| `src/lib/swipeTutorial.ts` | Tutorial persistence |
| `src/components/DeckCardContent.tsx` | Card hierarchy + Brain Mirror |
| `src/components/SwipeTutorial.tsx` | First-visit overlay |
| `e2e/decision-deck.spec.ts` | Swipe E2E suite |
| `tests/decision-swipe.test.ts` | Unit tests for gesture model |

## Accessibility

- Persistent action buttons with `aria-label` per direction.
- Keyboard: arrow keys + Enter/Space (when focused).
- `aria-live="polite"` for decisions and undo restoration.
- Reduced motion: rotation suppressed, shorter travel.
- Undo button on completion screen + snackbar.

## Analytics events

`swipe_session_started`, `swipe_card_shown`, `swipe_started`, `swipe_cancelled`, `swipe_committed`, `swipe_undo_used`, `swipe_session_completed`, `swipe_tutorial_shown`, `swipe_tutorial_dismissed` — never includes thought text.

## Test commands

```bash
npm run test:nl          # 100 unit tests incl. decision-swipe
npm run build
npm run test:e2e -- e2e/decision-deck.spec.ts   # 13 swipe tests
npm run test:e2e         # full suite
```

## Remaining risks

- Mouse-based E2E may not fully simulate touch pointer capture on all devices.
- Brain Mirror on neutral test strings can still classify ambiguous phrases as vault — use neutral fixtures in tests.
- 3 pre-existing flaky home-capture scroll tests unrelated to swipe.
- Visual QA screenshots require local Playwright run with `e2e/design-polish-screenshots.spec.ts`.
