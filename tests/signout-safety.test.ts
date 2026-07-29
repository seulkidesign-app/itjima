import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const settingsSource = readFileSync(
  resolve(process.cwd(), "src/components/SettingsSheet.tsx"),
  "utf8",
);
const pushSignOutSource = readFileSync(
  resolve(process.cwd(), "src/lib/push/pushSignOut.ts"),
  "utf8",
);

describe("sign-out safety contract", () => {
  it("checks unsent composer content before calling sign out", () => {
    const handleSignOut = settingsSource.slice(
      settingsSource.indexOf("const handleSignOut"),
      settingsSource.indexOf("return (", settingsSource.indexOf("const handleSignOut")),
    );
    const draftCheck = handleSignOut.indexOf("hasUnsentComposerContent()");
    const signOutCall = handleSignOut.indexOf("signOutWithPushCleanup");
    expect(draftCheck).toBeGreaterThan(-1);
    expect(signOutCall).toBeGreaterThan(draftCheck);
  });

  it("does not claim success when the auth request fails", () => {
    expect(settingsSource).toContain("const { error } = await signOutWithPushCleanup");
    const errorCheck = settingsSource.indexOf("if (error)");
    const signedOutCopy = settingsSource.indexOf('t("로그아웃됨", "Signed out")');
    expect(errorCheck).toBeGreaterThan(-1);
    expect(signedOutCopy).toBeGreaterThan(errorCheck);
  });

  it("clears the shared draft only after successful sign out", () => {
    const signOutCall = settingsSource.indexOf("signOutWithPushCleanup");
    const errorCheck = settingsSource.indexOf("if (error)");
    const clearDraft = settingsSource.indexOf("clearComposerDraft()");
    expect(clearDraft).toBeGreaterThan(signOutCall);
    expect(clearDraft).toBeGreaterThan(errorCheck);
  });

  it("returns users with a draft to the capture composer", () => {
    expect(settingsSource).toContain('navigate({ to: "/" })');
    expect(settingsSource).toContain("focusComposer()");
  });

  it("revokes push before auth sign-out", () => {
    expect(pushSignOutSource).toContain("revokePushBeforeSignOut");
    expect(pushSignOutSource).toContain("unsubscribeBrowserPushSubscription");
    expect(pushSignOutSource).toContain("supabase.auth.signOut");
  });
});
