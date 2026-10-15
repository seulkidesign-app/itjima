import type { SupabaseClient } from "@supabase/supabase-js";
import { STATUS_LABELS, type Status } from "../domain/brief";
import { isCollaborationId } from "./collaboration";
export type ProgressOperation = {
  kind: "status" | "task";
  id: string;
  revision: number;
  value: Status | boolean;
  requestId: string;
};
export class ProgressError extends Error {
  constructor(public kind: "conflict" | "signin" | "unavailable" | "invalid" | "unknown") { super(kind); }
}
export async function saveProgress(client: SupabaseClient, operation: ProgressOperation, signal: AbortSignal) {
  const { kind, id, revision, value, requestId } = operation;
  if (!isCollaborationId(id) || !isCollaborationId(requestId) || !Number.isSafeInteger(revision) || revision < 0 ||
    (kind === "status" ? typeof value !== "string" || !Object.hasOwn(STATUS_LABELS, value) : typeof value !== "boolean")) {
    throw new ProgressError("invalid");
  }
  const { data, error, status } = await client.rpc(
    kind === "status" ? "v03_update_collaboration_status" : "v03_set_task_completed",
    { p_id: id, p_expected_revision: revision, p_request_id: requestId, ...(kind === "status" ? { p_status: value } : { p_completed: value }) },
  ).abortSignal(signal).retry(false);
  if (error) {
    if (error.message === "v03_progress_conflict") throw new ProgressError("conflict");
    if (status === 401 || error.message === "v03_progress_auth_required") throw new ProgressError("signin");
    if (error.message === "v03_progress_unavailable") throw new ProgressError("unavailable");
    if (["v03_progress_invalid", "v03_progress_invalid_retry"].includes(error.message)) throw new ProgressError("invalid");
    throw new ProgressError("unknown");
  }
  if (!data || data.id !== id || !Number.isSafeInteger(data.revision) || data.revision <= revision ||
    (kind === "status" ? data.status !== value : (value ? typeof data.completed_at !== "string" : data.completed_at !== null))) {
    throw new ProgressError("unknown");
  }
}
