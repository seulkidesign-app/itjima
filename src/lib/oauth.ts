import { supabase } from "@/integrations/supabase/client";

/** Supabase Dashboard → Authentication → URL Configuration 에 등록 필요 */
export const AUTH_REDIRECT_PATHS = {
  production: "https://itjima.com/auth/callback",
  local: "http://localhost:5173/auth/callback",
} as const;

const AUTH_NEXT_KEY = "itjima.auth.next";

function allowedOrigin(origin: string) {
  return (
    origin === "https://itjima.com" ||
    origin === "http://localhost:5173" ||
    origin.endsWith(".vercel.app") ||
    origin.endsWith(".lovable.app") ||
    origin.endsWith(".lovableproject.com")
  );
}

export function authRedirectUrl() {
  if (typeof window === "undefined") return undefined;
  const { origin } = window.location;
  if (!allowedOrigin(origin)) {
    console.warn("[auth] Unexpected origin for OAuth redirect:", origin);
  }
  return `${origin}/auth/callback`;
}

export function saveAuthReturnPath(path = "/") {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(AUTH_NEXT_KEY, path.startsWith("/") ? path : "/");
}

export function consumeAuthReturnPath() {
  if (typeof window === "undefined") return "/";
  const next = sessionStorage.getItem(AUTH_NEXT_KEY) || "/";
  sessionStorage.removeItem(AUTH_NEXT_KEY);
  return next.startsWith("/") ? next : "/";
}

export async function signInWithGoogle(returnPath?: string) {
  saveAuthReturnPath(returnPath ?? window.location.pathname);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: authRedirectUrl(),
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });

  if (error) {
    return { error, redirected: false as const, url: null };
  }

  if (data.url) {
    window.location.assign(data.url);
  }

  return { error: null, redirected: !!data.url as const, url: data.url ?? null };
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: authRedirectUrl(),
    },
  });

  return { data, error };
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { data, error };
}

export function mapAuthError(message: string, lang: "ko" | "en") {
  const lower = message.toLowerCase();

  const ko: Record<string, string> = {
    "Invalid login credentials": "이메일 또는 비밀번호가 올바르지 않아요.",
    "User already registered": "이미 가입된 이메일이에요. 로그인해 주세요.",
    "Email not confirmed": "이메일 인증이 필요해요. 받은편지함을 확인해 주세요.",
    "Password should be at least 6 characters": "비밀번호는 6자 이상이어야 해요.",
    access_denied: "로그인이 취소됐어요. 다시 시도해 주세요.",
    "Unable to exchange external code": "로그인 연결에 문제가 있어요. 잠시 후 다시 시도해 주세요.",
    "Error getting user email from external provider":
      "Google 계정 이메일을 가져오지 못했어요. Google 로그인 설정을 확인해 주세요.",
    "OAuth state parameter missing": "로그인 세션이 만료됐어요. 다시 시도해 주세요.",
    "OAuth callback error": "로그인 중 오류가 발생했어요. 다시 시도해 주세요.",
    "Request rate limit reached": "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.",
    "Auth session missing!": "로그인 세션이 없어요. 다시 로그인해 주세요.",
  };

  const en: Record<string, string> = {
    "Invalid login credentials": "Invalid email or password.",
    "User already registered": "This email is already registered. Please sign in.",
    "Email not confirmed": "Please confirm your email before signing in.",
    "Password should be at least 6 characters": "Password must be at least 6 characters.",
    access_denied: "Sign-in was cancelled. Please try again.",
    "Unable to exchange external code": "Could not complete sign-in. Please try again.",
    "Error getting user email from external provider":
      "Could not read your Google email. Check OAuth settings.",
    "OAuth state parameter missing": "Sign-in session expired. Please try again.",
    "OAuth callback error": "Something went wrong during sign-in.",
    "Request rate limit reached": "Too many attempts. Please wait and try again.",
    "Auth session missing!": "No active session. Please sign in again.",
  };

  const table = lang === "ko" ? ko : en;

  if (table[message]) return table[message];
  if (lower.includes("access_denied")) return table.access_denied;
  if (lower.includes("exchange") && lower.includes("code")) return table["Unable to exchange external code"];
  if (lower.includes("email") && lower.includes("provider")) {
    return table["Error getting user email from external provider"];
  }

  return lang === "ko" ? `로그인 오류: ${message}` : message;
}

export type AuthCallbackResult =
  | { ok: true; nextPath: string }
  | { ok: false; message: string };

/** OAuth/email confirmation callback — call only on /auth/callback */
export async function completeAuthCallback(): Promise<AuthCallbackResult> {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  const oauthError = params.get("error") || hashParams.get("error");
  const oauthDescription = params.get("error_description") || hashParams.get("error_description");
  if (oauthError) {
    return {
      ok: false,
      message: mapAuthError(oauthDescription || oauthError, "ko"),
    };
  }

  const code = params.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return { ok: false, message: mapAuthError(error.message, "ko") };
    }
  } else if (
    hashParams.has("access_token") ||
    hashParams.has("refresh_token") ||
    hashParams.has("type")
  ) {
    const { error } = await supabase.auth.getSession();
    if (error) {
      return { ok: false, message: mapAuthError(error.message, "ko") };
    }
  } else {
    const { data, error } = await supabase.auth.getSession();
    if (error) return { ok: false, message: mapAuthError(error.message, "ko") };
    if (!data.session) {
      return { ok: false, message: mapAuthError("Auth session missing!", "ko") };
    }
  }

  window.history.replaceState({}, document.title, "/auth/callback");
  return { ok: true, nextPath: consumeAuthReturnPath() };
}
