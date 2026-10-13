import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreationPayload, Source } from "../domain/brief";
export class AbortedSaveError extends Error {}
export async function saveReviewed(
  client: SupabaseClient,
  id: string,
  payload: CreationPayload,
  source: Source,
) {
  if (payload.review.some((c) => c.review_state === "unreviewed"))
    throw new Error("미확인 후보는 저장할 수 없어요.");
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new Error("V03 계정으로 로그인해주세요.");
  const prepared = await client.rpc("v03_prepare_import", {
    p_id: id,
    p_payload: payload,
  });
  if (prepared.error)
    throw new Error("저장 준비에 실패했어요. 설정과 검토 결과를 확인해주세요.");
  if (prepared.data.state === "committed")
    return prepared.data.collaboration_id as string;
  const paths = source.images.map((image) => `${user.id}/${id}/${image.id}`);
  try {
    for (let i = 0; i < source.images.length; i++) {
      const uploaded = await client.storage
        .from("v03-sources")
        .upload(paths[i], source.images[i].file, {
          upsert: true,
          contentType: source.images[i].type,
        });
      if (uploaded.error) throw uploaded.error;
    }
    const committed = await client.rpc("v03_commit_import", { p_id: id });
    if (committed.error) throw committed.error;
    return committed.data as string;
  } catch {
    const state = await client
      .from("v03_imports")
      .select("state,collaboration_id")
      .eq("id", id)
      .single();
    if (state.error)
      throw new Error(
        "저장 결과 확인이 필요해요. 같은 요청으로 재시도해주세요.",
      );
    if (state.data.state === "committed")
      return state.data.collaboration_id as string;
    const aborted = await client.rpc("v03_abort_import", { p_id: id });
    if (aborted.error || !aborted.data)
      throw new Error(
        "저장 결과 확인이 필요해요. 같은 요청으로 재시도해주세요.",
      );
    if (paths.length) {
      const removed = await client.storage.from("v03-sources").remove(paths);
      if (removed.error)
        throw new AbortedSaveError(
          "최종 데이터는 rollback했지만 임시 이미지 정리가 필요해요. 다음 로그인에서 재시도해요.",
        );
    }
    throw new AbortedSaveError(
      "저장 실패로 최종 데이터와 임시 이미지를 rollback했어요. 다시 시도해주세요.",
    );
  }
}
export async function cleanupExpired(client: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) return;
  const pending = await client
    .from("v03_imports")
    .select("id,state,payload,created_at")
    .eq("user_id", user.id)
    .neq("state", "committed");
  if (pending.error) throw new Error("임시 저장 목록을 확인하지 못했어요.");
  for (const item of pending.data) {
    if (
      item.state === "pending" &&
      Date.parse(item.created_at) > Date.now() - 86400000
    )
      continue;
    if (item.state === "pending") {
      const claim = await client.rpc("v03_abort_import", { p_id: item.id });
      if (claim.error) throw claim.error;
      if (!claim.data) continue;
    }
    const paths = item.payload.source.images.map(
      (image: { id: string }) => `${user.id}/${item.id}/${image.id}`,
    );
    if (paths.length) {
      const result = await client.storage.from("v03-sources").remove(paths);
      if (result.error) throw result.error;
    }
  }
}
