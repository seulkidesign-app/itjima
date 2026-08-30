# v0.2 Full QA Checklist

Run once as a normal new user, then once as an abusive/edge-case user. Record each issue as Blocker / Major / Minor / Polish.

## 1. Entry / install / account

- Open landing from a fresh browser session.
- Confirm logo is lowercase `itjima` and uses Playpen Sans Medium.
- Confirm favicon shows the approved `ij` mark.
- Install PWA and confirm launcher icon uses the same `ij` artwork.
- Open installed app and confirm it lands in `/app`.
- Open settings/account from mobile chrome.
- Sign in, reload, sign out, and sign back in.
- Confirm non-admin account cannot access admin surfaces.

## 2. Natural-language capture contract

Try at minimum:

- `내일 청소`
- `내일 오전에 청소`
- `내일 오후에 청소`
- `내일 3시에 청소`
- `오후 5시에 청소`
- `30분 뒤에 청소`
- `내일 5시부터 6시까지 운동`
- `내일 오후 5시부터 6시까지 운동`
- `밥 먹고 청소`
- `나중에 청소`

No exact time may be fabricated when the input does not provide one. Ambiguous AM/PM must remain unresolved until the user clarifies.

## 3. Record lifecycle

- Add plain note, task-like note, and timed schedule.
- Edit text after creation.
- Open detail and close it with tap, gesture/back, and browser back where relevant.
- Delete a record and use Undo.
- Reload after mutations and verify persistence.
- Search/browse for old and new records.
- Verify schedule projection and original record stay consistent.

## 4. Schedule

- Create clear timed schedule.
- Create all-day/date-only record.
- Create ambiguous timed input and resolve it.
- Edit start/end time.
- Verify range input creates one event, not two.
- Verify repeated navigation between Home and Schedule does not move header/chrome.
- Test past time, midnight, month/year boundary, and timezone change if practical.

## 5. Rediscovery P1

With eligible aged fixture/data:

- At most one quiet rediscovery card appears.
- It does not duplicate a currently visible Home record.
- Clarification/recovery/scheduled records do not appear as passive rediscovery.
- `계속 두기` hides the card and reload does not immediately restore it.
- `열어보기` opens the existing record detail, not a separate rediscovery inbox.
- Tone should feel like “아 맞다, 이거 있었지,” not a task-completion demand.

## 6. Cleanup P2

- Exact duplicate records can be surfaced as cleanup candidates.
- Similar-but-not-identical records are not auto-merged.
- Old age alone never makes a record disposable.
- Timed/ambiguous/image records are protected.
- No item is preselected for deletion.
- Delete requires an explicit item action and confirmation.
- Cancel changes nothing.

## 7. Abuse / edge cases

- Empty input / spaces only.
- Very long Korean input.
- Very long English input.
- Emoji only.
- Repeated identical submissions quickly.
- Paste multiline text.
- Rapidly tap submit, back, delete, undo, and route tabs.
- Go offline during save, then reconnect.
- Reload during an open sheet.
- Narrow viewport / landscape / keyboard open.
- Browser back/forward repeatedly.
- Try direct legacy URLs such as `/rediscovery` and `/archive` and verify they do not create contradictory product semantics.

## 8. Visual / brand sweep

At Home, Schedule, Search/Browse, Settings, Auth, install surfaces:

- lowercase `itjima` in logo positions only.
- Playpen Sans Medium 500 for logo only.
- 56px mobile header.
- 20px mobile gutter.
- 44px minimum touch targets.
- No header/logo jump between routes.
- Resting composer baseline is stable.
- Bottom nav baseline is stable.
- No clipped Korean text at 320, 375, 390, and 430px widths.
- Sheets respect safe areas and keyboard.
- Launcher icon, favicon, and link preview all use the approved `ij` master.

## 9. Release gate

v0.2 can be frozen when:

- no Blockers remain;
- no known wrong-time scheduling paths remain;
- account/admin access behaves as intended;
- P1/P2 do not pressure or destructively modify records;
- primary mobile flows have no Major visual/layout defects;
- release tests and production build pass;
- production deployment is healthy after merge.
