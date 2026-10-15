import type { SupabaseClient } from "@supabase/supabase-js";
import type { InformationState } from "../domain/brief";
import { validDate } from "../domain/brief";
import { isCollaborationId, type SavedTask, type SavedReview, type ScheduleState } from "./collaboration";
import { ProgressError } from "./progress";
export const validScheduleDate = (date: string) => validDate(date) && !date.startsWith("0000-");
export type ScheduleContent = { id: string; v03_tasks: SavedTask[]; v03_schedule_states?: ScheduleState[] };
export type ScheduleOperation = {
  contentId: string; type: "draft_delivery" | "publish";
  informationState: InformationState; dueDate: string | null;
  revision: number; taskRevision: number | null; requestId: string;
};
export function currentSchedule(content: ScheduleContent, reviews: SavedReview[], type: ScheduleOperation["type"]) {
  const tasks = content.v03_tasks.filter((task) => task.type === type);
  const state = content.v03_schedule_states?.find((item) => item.type === type);
  const initial = reviews.find((r) => r.candidate.candidate_id === (type === "draft_delivery" ? "draft_due" : "publish_due"))?.candidate;
  return {
    informationState: state?.information_state ?? (tasks[0]?.due_date ? "present" : initial?.information_state === "present" ? undefined : initial?.information_state),
    dueDate: tasks[0]?.due_date ?? null,
    revision: state?.revision ?? 0,
    taskRevision: tasks[0]?.revision ?? null,
    edited: Boolean(state), ambiguous: tasks.length > 1, initial,
  };
}
export async function saveSchedule(client: SupabaseClient, operation: ScheduleOperation, signal: AbortSignal) {
  const { contentId, type, informationState, dueDate, revision, taskRevision, requestId } = operation;
  if (!isCollaborationId(contentId) || !isCollaborationId(requestId) || !["draft_delivery", "publish"].includes(type) ||
    !["present", "not_mentioned", "uncertain"].includes(informationState) || !Number.isSafeInteger(revision) || revision < 0 ||
    (taskRevision !== null && (!Number.isSafeInteger(taskRevision) || taskRevision < 0)) ||
    (informationState === "present" ? !dueDate || !validScheduleDate(dueDate) : dueDate !== null)) throw new ProgressError("invalid");
  const { data, error, status } = await client.rpc("v03_update_schedule", {
    p_content_id: contentId, p_type: type, p_information_state: informationState, p_due_date: dueDate,
    p_expected_revision: revision, p_expected_task_revision: taskRevision, p_request_id: requestId,
  }).abortSignal(signal).retry(false);
  if (error) {
    if (error.message === "v03_schedule_conflict") throw new ProgressError("conflict");
    if (status === 401 || error.message === "v03_schedule_auth_required") throw new ProgressError("signin");
    if (error.message === "v03_schedule_unavailable") throw new ProgressError("unavailable");
    if (["v03_schedule_invalid", "v03_schedule_invalid_retry", "v03_schedule_ambiguous"].includes(error.message)) throw new ProgressError("invalid");
    throw new ProgressError("unknown");
  }
  if (!data || data.content_id !== contentId || data.type !== type || !Number.isSafeInteger(data.revision) || data.revision <= revision) throw new ProgressError("unknown");
}
