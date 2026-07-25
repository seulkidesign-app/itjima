const KEY = "itjima.feedback.draft";

export type FeedbackDraft = {
  category: string;
  message: string;
  email: string;
  includeDiagnostics: boolean;
};

export function readFeedbackDraft(): FeedbackDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FeedbackDraft;
  } catch {
    return null;
  }
}

export function writeFeedbackDraft(draft: FeedbackDraft) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(draft));
}

export function clearFeedbackDraft() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
