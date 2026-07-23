# Itjima Data Integrity Handoff

Branch: `codex/data-integrity-handoff`

## Why this exists

The current sync path in `src/lib/store.ts` can erase guest-local data after a partial upload failure.

Current behavior:

1. Read user-local + guest-local items.
2. Fetch cloud rows.
3. Build `toUpload`.
4. Call `cloudUpsertMany()`.
5. Ignore individual upload failures.
6. Clear the guest bucket unconditionally.

Relevant current code:

```ts
async function cloudUpsertMany<T extends { id: string }>(
  table: TableName,
  userId: string,
  items: T[],
) {
  if (!items.length) return;
  for (const it of items) {
    await cloudMutate("upsert", table, userId, it as Record<string, unknown>);
  }
}
```

and later:

```ts
if (toUpload.length) {
  await cloudUpsertMany(table, userId, toUpload);
}

// ...

if (guestItems.length) {
  writeLS(guestKey, []);
}
```

This violates the release invariant:

> Guest data may be cleared only after every guest item is confirmed uploaded.

## P0 patch required in `src/lib/store.ts`

### 1. Make bulk upsert return a result

Use an explicit result rather than `void`.

```ts
type BulkUploadResult = {
  ok: boolean;
  succeededIds: string[];
  failedIds: string[];
};

async function cloudUpsertMany<T extends { id: string }>(
  table: TableName,
  userId: string,
  items: T[],
): Promise<BulkUploadResult> {
  const succeededIds: string[] = [];
  const failedIds: string[] = [];

  for (const item of items) {
    const ok = await cloudMutate(
      "upsert",
      table,
      userId,
      item as Record<string, unknown>,
    );

    if (ok) succeededIds.push(item.id);
    else failedIds.push(item.id);
  }

  return {
    ok: failedIds.length === 0,
    succeededIds,
    failedIds,
  };
}
```

### 2. Keep guest rows until upload succeeds

Do not clear the guest bucket based only on `guestItems.length`.

Suggested flow:

```ts
const uploadResult = await cloudUpsertMany(table, userId, toUpload);

if (!uploadResult.ok) {
  writeLS(key, localAll);
  setSyncState("error");
  syncingRef.current = false;
  return;
}
```

Then clear only guest rows verified in cloud. The safest v1 behavior is all-or-nothing per bucket:

```ts
if (guestItems.length && uploadResult.ok) {
  writeLS(guestKey, []);
}
```

Do not treat an empty `toUpload` as automatic proof unless every guest ID already exists in `cloudIds`.

Recommended condition:

```ts
const allGuestItemsConfirmed = guestItems.every(
  (item) => cloudIds.has(item.id) || uploadResult.succeededIds.includes(item.id),
);

if (guestItems.length && allGuestItemsConfirmed) {
  writeLS(guestKey, []);
}
```

### 3. Preserve error state

On any failed guest upload:

- Keep guest storage unchanged.
- Keep merged user-local storage.
- Set sync state to `error`.
- Allow `retrySync()` to retry.
- Never silently continue to `ready`.

## P0 regression tests

Add Playwright coverage for these scenarios.

### A. Partial guest upload failure

1. Seed two guest inbox rows.
2. Sign in / inject E2E user.
3. Mock first upsert success and second upsert failure.
4. Assert guest bucket still contains both rows.
5. Assert sync state reports failure or retry UI is available.

### B. Retry after failure

1. Start from scenario A.
2. Change mock so every upsert succeeds.
3. Trigger retry.
4. Assert guest bucket is empty only after success.
5. Assert user bucket contains both rows.

### C. Guest rows already present in cloud

1. Seed guest rows.
2. Mock cloud fetch returning those IDs.
3. Assert no duplicate uploads.
4. Assert guest bucket clears because all IDs are confirmed in cloud.

## P0 tombstone requirement

Hard deletion currently removes local data and directly deletes the cloud row. If that network request fails, a later cloud fetch can resurrect the deleted item.

Required invariant:

> Local delete intent wins over any older cloud snapshot.

Implement tombstones before further sync refactoring.

Minimum local tombstone shape:

```ts
type LocalTombstone = {
  id: string;
  table: TableName;
  userId: string;
  deletedAt: string;
};
```

Suggested local key:

```ts
itjima.${userId}.tombstones
```

Sync order:

1. Read local tombstones.
2. Fetch cloud rows.
3. Exclude tombstoned IDs before merge.
4. Attempt cloud deletes.
5. Remove tombstones only after cloud deletion succeeds.
6. Keep failed tombstones for retry.

For v1, a local tombstone queue is safer and simpler than immediately introducing a new remote table. A remote `deleted_memories` table is needed for reliable multi-device propagation, but should be added with a Supabase migration and RLS policy only after local deletion retry is covered by tests.

## Cursor execution checklist

Run on `codex/data-integrity-handoff`:

```bash
npm install
npm run lint
npx tsc --noEmit
npm run build
npm run test:e2e
```

Do not merge to `main` until:

- Guest partial failure test passes.
- Retry test passes.
- Offline delete resurrection test passes.
- Lint/type/build are clean.
- Existing Playwright suite remains green.

## Scope guard

Do not add new UI features in this branch. Keep the patch limited to:

- guest upload verification
- tombstone/delete retry safety
- regression tests
- any minimal sync status wiring needed to expose failure/retry
