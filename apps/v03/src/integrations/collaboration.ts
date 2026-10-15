import type { SupabaseClient } from "@supabase/supabase-js";
import type { InformationState, Status } from "../domain/brief";

export type SavedTask = {
  id: string;
  type: string;
  title: string;
  due_date: string | null;
  completed_at: string | null;
};
export type SavedReview = {
  candidate: {
    candidate_id: string;
    information_state: InformationState;
    origin?: string;
  };
};
export type SavedSource = {
  id: string;
  raw_text: string;
  images: { path: string; name: string; type: string; size: number }[];
  v03_reviews: SavedReview[];
};
export type Collaboration = {
  id: string;
  title: string;
  status: Status;
  contact_date: string | null;
  notes: string | null;
  v03_contents: {
    id: string;
    title: string;
    platform: string | null;
    v03_tasks: SavedTask[];
  }[];
  v03_constraints: {
    id: string;
    type: string;
    value: string | null;
    information_state: InformationState;
    review_state: "confirmed" | "edited";
  }[];
  v03_sources: SavedSource[];
};
export const isCollaborationId = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export class DetailError extends Error {
  constructor(public kind: "unavailable" | "signin" | "network") {
    super(kind);
  }
}
export async function loadCollaboration(
  client: SupabaseClient,
  id: string,
  userId: string,
  signal?: AbortSignal,
): Promise<Collaboration | null> {
  if (!isCollaborationId(id)) return null;
  let query = client
    .from("v03_collaborations")
    .select(`id,title,status,contact_date,notes,
      v03_contents(id,title,platform,v03_tasks(id,type,title,due_date,completed_at)),
      v03_constraints(id,type,value,information_state,review_state),
      v03_sources(id,raw_text,images,v03_reviews(candidate))`)
    .eq("id", id)
    .eq("user_id", userId)
    .retry(false);
  if (signal) query = query.abortSignal(signal);
  const { data, error, status } = await query.maybeSingle();
  if (error) {
    if (status === 401) throw new DetailError("signin");
    if (status === 403 || status === 404) throw new DetailError("unavailable");
    throw new DetailError("network");
  }
  return data as Collaboration | null;
}
export function informationLabel(state?: InformationState) {
  return state === "not_mentioned"
    ? "원문에 미기재"
    : state === "uncertain"
      ? "불명확 · 판독 불가"
      : "확인 정보 없음";
}
export function dateLabel(date: string) {
  const [year, month, day] = date.split("-");
  return `${year}. ${month}. ${day}.`;
}
// A confirmed Task is the date source. Review explains why no Task exists.
export function scheduleSummary(
  detail: { v03_contents: { v03_tasks: SavedTask[] }[]; v03_sources: { v03_reviews: SavedReview[] }[] },
  type: string,
  candidate: string,
) {
  const tasks = detail.v03_contents.flatMap((content) =>
    content.v03_tasks.filter((task) => task.type === type && task.due_date),
  );
  if (tasks.length) return tasks.map((task) => dateLabel(task.due_date!)).join(" / ");
  const reviews = detail.v03_sources.flatMap((source) => source.v03_reviews)
    .filter((review) => review.candidate.candidate_id === candidate);
  if (!reviews.length) return "확인 정보 없음";
  return [...new Set(reviews.map(({ candidate: review }) =>
    review.information_state === "present" ? "확정 일정 없음" : informationLabel(review.information_state),
  ))].join(" / ");
}
