import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "src/components/SettingsSheet.tsx"),
  "utf8",
);

describe("sign-out safety contract", () => {
  it("checks unsent composer content before calling sign out", () => {
    const draftCheck = source.indexOf("hasUnsentComposerContent()");
    const signOutCall = source.indexOf("supabase.auth.signOut()");
    expect(draftCheck).toBeGreaterThan(-1);
    expect(signOutCall).toBeGreaterThan(draftCheck);
  });

  it("does not claim success when the auth request fails", () => {
    expect(source).toContain("const { error } = await supabase.auth.signOut()");
    const errorCheck = source.indexOf("if (error)");
    const signedOutCopy = source.indexOf('t("로그아웃됨", "Signed out")');
    expect(errorCheck).toBeGreaterThan(-1);
    expect(signedOutCopy).toBeGreaterThan(errorCheck);
  });

  it("clears the shared draft only after successful sign out", () => {
    const signOutCall = source.indexOf("supabase.auth.signOut()");
    const errorCheck = source.indexOf("if (error)");
    const clearDraft = source.indexOf("clearComposerDraft()");
    expect(clearDraft).toBeGreaterThan(signOutCall);
    expect(clearDraft).toBeGreaterThan(errorCheck);
  });

  it("returns users with a draft to the capture composer", () => {
    expect(source).toContain('navigate({ to: "/" })');
    expect(source).toContain("focusComposer()");
  });
});
