import type { SupabaseClient } from "@supabase/supabase-js";
import type { Status } from "../domain/brief";
import { DetailError, type SavedReview, type SavedTask } from "./collaboration";

export type HomeCollaboration = {
  id: string;
  title: string;
  status: Status;
  v03_contents: { id: string; title: string; v03_tasks: SavedTask[] }[];
  v03_sources: { v03_reviews: SavedReview[] }[];
};
export type HomeTask = SavedTask & {
  collaborationId: string;
  collaborationTitle: string;
  collaborationStatus: Status;
  contentTitle: string;
};

// Explicit pages avoid Supabase's default top-level row limit. Never filter by due date.
export async function loadHome(
  client: SupabaseClient,
  userId: string,
  signal: AbortSignal,
): Promise<HomeCollaboration[]> {
  const rows = new Map<string, HomeCollaboration>();
  let after: string | undefined;
  for (;;) {
    let query = client.from("v03_collaborations")
      .select(`id,title,status,
        v03_contents(id,title,v03_tasks(id,type,title,due_date,completed_at)),
        v03_sources(v03_reviews(candidate))`)
      .eq("user_id", userId)
      .order("id", { ascending: true })
      .limit(100)
      .retry(false)
      .abortSignal(signal);
    if (after) query = query.gt("id", after);
    const { data, error, status } = await query;
    if (error) throw new DetailError(status === 401 ? "signin" : "network");
    if (signal.aborted) throw new DetailError("network");
    const page = data as HomeCollaboration[] | null;
    if (!page) throw new DetailError("network");
    for (const row of page) rows.set(row.id, row);
    if (page.length < 100) return [...rows.values()];
    const next = page.at(-1)!.id;
    if (next === after) throw new DetailError("network");
    after = next;
  }
}
export function isActive(item: HomeCollaboration) {
  return item.status !== "completed" && item.status !== "on_hold";
}
export function pendingTasks(items: HomeCollaboration[]): HomeTask[] {
  return items.flatMap((item) => item.v03_contents.flatMap((content) =>
    content.v03_tasks.filter((task) => !task.completed_at).map((task) => ({
      ...task,
      collaborationId: item.id,
      collaborationTitle: item.title,
      collaborationStatus: item.status,
      contentTitle: content.title,
    })),
  )).sort((a, b) => {
    if (a.due_date !== b.due_date) {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date < b.due_date ? -1 : 1;
    }
    return a.collaborationId.localeCompare(b.collaborationId) || a.id.localeCompare(b.id);
  });
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function dueState(due: string | null, today: string) {
  return !due ? "기한 없음" : due < today ? "기한 지남 · 미완료" : due === today ? "오늘" : "예정";
}
