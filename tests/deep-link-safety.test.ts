import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workerSource = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
const loginSource = readFileSync(
  resolve(process.cwd(), "src/components/LoginSheet.tsx"),
  "utf8",
);
const vercel = JSON.parse(
  readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"),
) as { rewrites?: Array<{ source: string; destination: string }> };

describe("app deep link contract", () => {
  it("routes direct app paths through the SPA entry", () => {
    expect(
      vercel.rewrites?.some(
        (rule) => rule.destination === "/index.html" && rule.source.includes("api/"),
      ),
    ).toBe(true);
  });

  it("keeps schedule identifiers encoded in reminder links", () => {
    expect(workerSource).toMatch(
      /encodeURIComponent\(\s*String\(scheduleId\)\s*\)/,
    );
    expect(workerSource).toContain("function safeAppPath");
    expect(workerSource).toContain("parsed.pathname");
    expect(workerSource).toContain("parsed.search");
    expect(workerSource).toContain("parsed.hash");
  });

  it("allows only same-app reminder paths", () => {
    expect(workerSource).toMatch(/startsWith\(\s*"\/\/"\s*\)/);
    expect(workerSource).toMatch(
      /parsed\.origin\s*!==\s*self\.location\.origin/,
    );
  });

  it("finishes reminder navigation before focusing the app", () => {
    expect(workerSource).toMatch(/await\s+client\.navigate\(url\)/);
    expect(workerSource).toMatch(/await\s+self\.clients\.matchAll/);
    expect(workerSource).toContain("navigated.focus()");
  });

  it("keeps path, search, and hash during Google sign-in", () => {
    expect(loginSource).toContain("function currentReturnPath");
    expect(loginSource).toContain("window.location.pathname");
    expect(loginSource).toContain("window.location.search");
    expect(loginSource).toContain("window.location.hash");
    expect(loginSource).toContain("signInWithGoogle(currentReturnPath())");
  });
});
