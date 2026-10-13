import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import {
  mockExtract,
  editCandidate,
  confirmCandidate,
  buildPayload,
} from "../src/domain/brief";
const migration = readFileSync(
  new URL(
    "../supabase/migrations/202610140001_v03_initial.sql",
    import.meta.url,
  ),
  "utf8",
);
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222",
  ID = "33333333-3333-4333-8333-333333333333";
let db: PGlite;
function payload() {
  let d = mockExtract({ text: "원본 협찬 가이드", images: [] });
  for (const c of d.candidates) {
    if (c.group === "schedules")
      d = editCandidate(d, c.id, { dueDate: "2026-10-20" });
    if (c.id === "usage_rights")
      d = editCandidate(d, c.id, { informationState: "not_mentioned" });
    d = confirmCandidate(d, c.id);
  }
  return buildPayload(d, "브랜드 A");
}
async function user(id: string) {
  await db.exec(
    `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`,
  );
}
async function prepare(id: string, p = payload()) {
  return db.query("select public.v03_prepare_import($1,$2::jsonb)", [
    id,
    JSON.stringify(p),
  ]);
}
describe("PostgreSQL transaction and RLS", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key);insert into auth.users values('${A}'),('${B}');create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,storage,public to authenticated,anon;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;grant all on storage.objects to authenticated;set v03.project_ref='zzuytanimpiflygrwqfb';`,
    );
    await db.exec(migration);
  }, 30000);
  afterAll(async () => {
    await db.close();
  });
  it("rejects unreviewed, missing mandatory and invalid date candidates", async () => {
    await user(A);
    const p = payload();
    p.review[0].review_state = "unreviewed";
    await expect(prepare(ID, p)).rejects.toThrow("unreviewed_candidate");
    p.review[0].review_state = "edited";
    p.review[0].due_date = "2026-02-30";
    await expect(prepare(ID, p)).rejects.toThrow();
    p.review[0].due_date = "2026-10-20";
    p.review.pop();
    await expect(prepare(ID, p)).rejects.toThrow("required_candidate_missing");
    expect(
      (await db.query("select * from public.v03_imports")).rows,
    ).toHaveLength(0);
  });
  it("requires an authenticated identity before preparing", async () => {
    await user("");
    await expect(prepare(ID)).rejects.toThrow("authentication_required");
  });
  it("commits all reviewed domain data and retries without duplicates", async () => {
    await user(A);
    await prepare(ID);
    const first = await db.query("select public.v03_commit_import($1) as id", [
      ID,
    ]);
    expect(
      (await db.query("select public.v03_commit_import($1) as id", [ID])).rows,
    ).toEqual(first.rows);
    expect(
      (await db.query("select * from public.v03_tasks")).rows,
    ).toHaveLength(5);
    expect(
      (await db.query("select * from public.v03_constraints")).rows,
    ).toHaveLength(4);
    expect(
      (
        await db.query<{ raw_text: string }>(
          "select raw_text from public.v03_sources",
        )
      ).rows[0].raw_text,
    ).toBe("원본 협찬 가이드");
    await expect(
      db.query(
        "insert into public.v03_tasks(user_id,content_id,type,title) values($1,$2,'custom','bypass')",
        [A, ID],
      ),
    ).rejects.toThrow("permission denied");
  });
  it("isolates all data from another user", async () => {
    await user(B);
    for (const table of [
      "v03_imports",
      "v03_collaborations",
      "v03_contents",
      "v03_tasks",
      "v03_sources",
      "v03_constraints",
      "v03_reviews",
    ])
      expect(
        (await db.query(`select * from public.${table}`)).rows,
      ).toHaveLength(0);
    await expect(prepare(ID)).rejects.toThrow("invalid_import_retry");
    await expect(
      db.query("select public.v03_commit_import($1)", [ID]),
    ).rejects.toThrow("import_not_found");
  });
  it("rolls back failure after parent rows have been created", async () => {
    await db.exec(
      "reset role;create function public.fail_test() returns trigger language plpgsql as $$ begin raise exception 'injected_failure';end $$;create trigger fail_test before insert on public.v03_tasks for each row execute function public.fail_test();",
    );
    await user(A);
    const id = "44444444-4444-4444-8444-444444444444";
    await prepare(id);
    await expect(
      db.query("select public.v03_commit_import($1)", [id]),
    ).rejects.toThrow("injected_failure");
    expect(
      (await db.query("select * from public.v03_collaborations")).rows,
    ).toHaveLength(1);
    expect(
      (await db.query("select * from public.v03_sources")).rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query<{ state: string }>(
          "select state from public.v03_imports where id=$1",
          [id],
        )
      ).rows[0].state,
    ).toBe("pending");
    await db.exec("reset role;drop trigger fail_test on public.v03_tasks;");
  });
  it("requires private image manifest and blocks committed image mutation", async () => {
    await user(A);
    const id = "55555555-5555-4555-8555-555555555555",
      img = "66666666-6666-4666-8666-666666666666";
    const p = payload();
    p.source.images = [
      { id: img, name: "guide.png", size: 100, type: "image/png" },
    ];
    await prepare(id, p);
    await expect(
      db.query("select public.v03_commit_import($1)", [id]),
    ).rejects.toThrow("source_image_missing");
    const path = `${A}/${id}/${img}`;
    await db.query(
      "insert into storage.objects(bucket_id,name,metadata) values('v03-sources',$1,'{\"size\":100}')",
      [path],
    );
    await user(B);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values('v03-sources',$1)",
        [path],
      ),
    ).rejects.toThrow("row-level security");
    await user(A);
    await db.query("select public.v03_commit_import($1)", [id]);
    expect(
      (await db.query("delete from storage.objects returning *")).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query<{ v03_abort_import: boolean }>(
          "select public.v03_abort_import($1)",
          [id],
        )
      ).rows[0].v03_abort_import,
    ).toBe(false);
    await db.exec("reset role");
    expect(
      (
        await db.query<{ public: boolean }>(
          "select public from storage.buckets where id='v03-sources'",
        )
      ).rows[0].public,
    ).toBe(false);
  });
  it("only cleans staged images after atomic abort", async () => {
    await user(A);
    const id = "77777777-7777-4777-8777-777777777777",
      img = "88888888-8888-4888-8888-888888888888";
    const p = payload();
    p.source.images = [
      { id: img, name: "guide.png", size: 100, type: "image/png" },
    ];
    await prepare(id, p);
    const path = `${A}/${id}/${img}`;
    await db.query(
      "insert into storage.objects(bucket_id,name,metadata) values('v03-sources',$1,'{\"size\":100}')",
      [path],
    );
    expect(
      (
        await db.query(
          "delete from storage.objects where name=$1 returning *",
          [path],
        )
      ).rows,
    ).toHaveLength(0);
    await db.query("select public.v03_abort_import($1)", [id]);
    expect(
      (
        await db.query(
          "delete from storage.objects where name=$1 returning *",
          [path],
        )
      ).rows,
    ).toHaveLength(1);
    await expect(
      db.query("select public.v03_commit_import($1)", [id]),
    ).rejects.toThrow("import_aborted");
  });
});
describe("migration target guard", () => {
  it.each(["ref", "tables"])(
    "refuses V02 target %s",
    async (mode) => {
      const probe = new PGlite();
      try {
        await probe.exec(
          mode === "ref"
            ? "set v03.project_ref='bopiuworvbjsowfjbmfx'"
            : "set v03.project_ref='zzuytanimpiflygrwqfb';create table public.inbox(id uuid)",
        );
        await expect(probe.exec(migration)).rejects.toThrow(
          "V02 database is forbidden",
        );
      } finally {
        await probe.close();
      }
    },
    30000,
  );
});
