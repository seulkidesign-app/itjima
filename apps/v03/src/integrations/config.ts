export const V02_REF = "bopiuworvbjsowfjbmfx";
export function connectionConfig(env: Record<string, string | undefined>) {
  const url = env.VITE_V03_SUPABASE_URL,
    key = env.VITE_V03_SUPABASE_PUBLISHABLE_KEY,
    ref = env.VITE_V03_SUPABASE_PROJECT_REF;
  if (!url && !key && !ref) return { config: null, error: null };
  if (!url || !key || !ref)
    return {
      config: null,
      error: "V03 전용 URL / project ref / publishable key 설정이 필요해요.",
    };
  let host: URL;
  try {
    host = new URL(url);
  } catch {
    return { config: null, error: "V03 URL 형식이 올바르지 않아요." };
  }
  if (ref === V02_REF || host.hostname === `${V02_REF}.supabase.co`)
    return { config: null, error: "V02 프로젝트 연결은 차단했어요." };
  if (
    !/^[a-z]{20}$/.test(ref) ||
    host.origin !== `https://${ref}.supabase.co` ||
    host.pathname !== "/" ||
    host.search ||
    host.hash ||
    host.username ||
    host.password
  )
    return {
      config: null,
      error: "V03 URL/ref가 일치하는 HTTPS 프로젝트를 설정해주세요.",
    };
  let role = "";
  try {
    role = JSON.parse(atob(key.split(".")[1])).role;
  } catch {
    /* opaque publishable key */
  }
  if (
    key.startsWith("sb_secret_") ||
    (!key.startsWith("sb_publishable_") && role !== "anon")
  )
    return {
      config: null,
      error: "공개 publishable/anon key만 사용할 수 있어요.",
    };
  return { config: { url: host.origin, key, ref }, error: null };
}
