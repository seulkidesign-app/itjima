import { readComposerDraft } from "@/lib/composerDraft";

export type ComposerSafetyState = {
  hasText: boolean;
  hasImages: boolean;
  dirty: boolean;
};

/** Read the currently rendered capture composer without coupling global UI to React state. */
export function composerSafetyState(
  doc: Document = document,
): ComposerSafetyState {
  const input = doc.getElementById("capture-input") as HTMLTextAreaElement | null;
  if (!input) return { hasText: false, hasImages: false, dirty: false };

  const hasText = input.value.trim().length > 0;
  const form = input.closest("form");
  const hasImages = Boolean(
    form?.querySelector("img[src^='data:'], img[src^='blob:']"),
  );
  return { hasText, hasImages, dirty: hasText || hasImages };
}

/** Includes the debounced local draft even when the home composer is not mounted. */
export function hasUnsentComposerContent(doc: Document = document): boolean {
  return composerSafetyState(doc).dirty || readComposerDraft().trim().length > 0;
}

export function focusComposer(doc: Document = document): boolean {
  const input = doc.getElementById("capture-input") as HTMLTextAreaElement | null;
  if (!input) return false;
  input.focus({ preventScroll: false });
  input.scrollIntoView({ block: "center", behavior: "smooth" });
  return true;
}
