import { afterEach, describe, expect, it } from "vitest";
import {
  composerSafetyState,
  focusComposer,
} from "@/lib/composerSafety";

afterEach(() => {
  document.body.innerHTML = "";
});

function renderComposer(text = "", imageSrc?: string) {
  document.body.innerHTML = `
    <form>
      ${imageSrc ? `<img src="${imageSrc}" alt="" />` : ""}
      <textarea id="capture-input">${text}</textarea>
    </form>
  `;
}

describe("composer update safety", () => {
  it("allows an update when no composer is rendered", () => {
    expect(composerSafetyState()).toEqual({
      hasText: false,
      hasImages: false,
      dirty: false,
    });
  });

  it("blocks reload when unsent text remains", () => {
    renderComposer("아직 안 던진 생각");
    expect(composerSafetyState()).toEqual({
      hasText: true,
      hasImages: false,
      dirty: true,
    });
  });

  it("blocks reload when an attached image remains", () => {
    renderComposer("", "data:image/png;base64,abc");
    expect(composerSafetyState()).toEqual({
      hasText: false,
      hasImages: true,
      dirty: true,
    });
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
