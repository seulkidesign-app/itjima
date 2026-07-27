import { afterEach, describe, expect, it } from "vitest";
import {
  composerSafetyState,
  focusComposer,
  hasUnsentComposerContent,
} from "@/lib/composerSafety";
import { clearComposerDraft, writeComposerDraft } from "@/lib/composerDraft";

afterEach(() => {
  document.body.innerHTML = "";
  clearComposerDraft();
});

function renderComposer(text = "", imageSrc?: string) {
  document.body.innerHTML = `
    <form>
      ${imageSrc ? `<img src="${imageSrc}" alt="" />` : ""}
      <textarea id="capture-input">${text}</textarea>
    </form>
  `;
}

describe("composer update and account safety", () => {
  it("allows an update when no composer or persisted draft exists", () => {
    expect(composerSafetyState()).toEqual({
      hasText: false,
      hasImages: false,
      dirty: false,
    });
    expect(hasUnsentComposerContent()).toBe(false);
  });

  it("blocks reload when unsent text remains", () => {
    renderComposer("아직 안 던진 생각");
    expect(composerSafetyState()).toEqual({
      hasText: true,
      hasImages: false,
      dirty: true,
    });
    expect(hasUnsentComposerContent()).toBe(true);
  });

  it("blocks reload when an attached image remains", () => {
    renderComposer("", "data:image/png;base64,abc");
    expect(composerSafetyState()).toEqual({
      hasText: false,
      hasImages: true,
      dirty: true,
    });
    expect(hasUnsentComposerContent()).toBe(true);
  });

  it("blocks account changes for a persisted draft when home is not mounted", () => {
    writeComposerDraft("다른 화면에서 아직 안 던진 초안");
    expect(document.getElementById("capture-input")).toBeNull();
    expect(hasUnsentComposerContent()).toBe(true);
  });

  it("ignores unrelated page images outside the composer", () => {
    document.body.innerHTML = `
      <img src="data:image/png;base64,cover" alt="" />
      <form><textarea id="capture-input"></textarea></form>
    `;
    expect(composerSafetyState().dirty).toBe(false);
  });

  it("can return keyboard focus to the capture field", () => {
    renderComposer();
    expect(focusComposer()).toBe(true);
    expect(document.activeElement?.id).toBe("capture-input");
  });
});
