const DRAFT_KEY = "itjima.composer.draft";

export function readComposerDraft(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeComposerDraft(text: string) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = text.trim();
    if (!trimmed) {
      localStorage.removeItem(DRAFT_KEY);
      return;
    }
    localStorage.setItem(DRAFT_KEY, trimmed);
  } catch {
    // ignore quota errors
  }
}

export function clearComposerDraft() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
