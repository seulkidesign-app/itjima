import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workerSource = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
const loginSource = readFileSync(
  resolve(process.cwd(), "src/components/LoginSheet.tsx"),
  "utf8",
);
const vercelSource = readFileSync(resolve(process.cwd(), "vercel.json"), "utf8");

describe("app deep link contract", () => {
  it("routes direct app paths through the SPA entry", () => {
    expect(vercelSource).toContain('"destination": "/index.html"');
  });

  it("keeps schedule identifiers encoded in reminder links", () => {
    expect(workerSource).toContain("encodeURIComponent(String(scheduleId))");
    expect(workerSource).toContain("parsed.pathname");
    expect(workerSource).toContain("parsed.search");
    expect(workerSource).toContain("parsed.hash");
  });

  it("allows only same-app reminder paths", () => {
    expect(workerSource).toContain('value.startsWith("//")');
    expect(workerSource).toContain("parsed.origin !== self.location.origin");
  });

  it("finishes reminder navigation before focusing the app", () => {
    expect(workerSource).toContain("const navigated = await client.navigate(url)");
    expect(workerSource).toContain("return navigated.focus()");
  });

  it("keeps path, search, and hash during Google sign-in", () => {
    expect(loginSource).toContain("window.location.pathname");
    expect(loginSource).toContain("window.location.search");
    expect(loginSource).toContain("window.location.hash");
    expect(loginSource).toContain("signInWithGoogle(currentReturnPath())");
  });
});
