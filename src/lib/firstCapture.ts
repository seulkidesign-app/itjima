const KEY = "itjima.first_capture.done";

export function isFirstCapturePending(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) !== "1";
}

export function markFirstCaptureDone(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, "1");
}
