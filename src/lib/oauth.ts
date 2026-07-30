import { supabase } from "@/integrations/supabase/client";
import { authDebug, authDebugAuthStateChange, authDebugGetSession } from "@/lib/authDebug";

/** Supabase Dashboard → Authentication → URL Configuration 에 등록 필요 */
export const AUTH_REDIRECT_PATHS = {
  production: "https://itjima.app/auth/callback",
  local: "http://localhost:5173/auth/callback",
  supabaseCallback: "https://bopiuworvbjsowfjbmfx.supabase.co/auth/v1/callback",
} as const;

const AUTH_NEXT_KEY = "itjima.auth.next";
const OAUTH_HANDLED_CODE_KEY = "itjima.oauth.handledCode";
const OAUTH_ERROR_KEY = "itjima.oauth.lastError";

/** Dev-only OAuth diagnostics — never logs tokens. */
const OAUTH_DIAG_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_E2E !== "true";

export function oauthDiag(
  step: string,
  data: Record<string, unknown> = {},
) {
  if (!OAUTH_DIAG_ENABLED || typeof window === "undefined") return;
  console.log("[oauth-diag]", step, {
    pathname: window.location.pathname,
    search: window.location.search,
    ...data,
  });
}

/** Supabase auth-js PKCE verifier key: `${storageKey}-code-verifier`. */
export function getPkceVerifierStorageKey() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) return null;
  try {
    const projectRef = new URL(url).hostname.split(".")[0];
    return `sb-${projectRef}-auth-token-code-verifier`;
  } catch {
    return null;
  }
}

/** DEV-only: log localStorage auth keys and PKCE verifier presence (never token values). */
export function oauthPkceStorageDiag(
  phase: string,
  extra: Record<string, unknown> = {},
) {
  if (!OAUTH_DIAG_ENABLED || typeof window === "undefined") return;
  const verifierKey = getPkceVerifierStorageKey();
  const authKeys = Object.keys(localStorage)
    .filter((k) => k.startsWith("sb-") || k.includes("auth"))
    .sort();
  oauthDiag(`pkce-storage:${phase}`, {
    origin: window.location.origin,
    verifierKey,
    hasVerifier: verifierKey ? localStorage.getItem(verifierKey) != null : null,
    verifierLength: verifierKey
      ? (localStorage.getItem(verifierKey)?.length ?? 0)
      : null,
    authLocalStorageKeys: authKeys,
    ...extra,
  });
}

function hasOAuthReturnInUrl() {
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash;
  return (
    params.has("code") ||
    params.has("error") ||
    hash.includes("access_token") ||
    hash.includes("error")
  );
}

export function purgeOAuthFromUrl() {
  if (typeof window === "undefined") return;
  window.history.replaceState({}, document.title, window.location.pathname);
}

/** Send ?code= / hash tokens to /auth/callback once — prevents redirect loops. */
export function maybeRouteOAuthCallback() {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/auth/callback") return;
  if (!hasOAuthReturnInUrl()) return;

  const code = new URLSearchParams(window.location.search).get("code");
  if (code && sessionStorage.getItem(OAUTH_HANDLED_CODE_KEY) === code) {
    authDebug("maybeRouteOAuthCallback: handled code, purging URL only", {
      codePrefix: code.slice(0, 8),
    });
    purgeOAuthFromUrl();
    return;
  }

  authDebug("maybeRouteOAuthCallback: redirecting to /auth/callback", {
    codePrefix: code?.slice(0, 8) ?? null,
  });
  window.location.replace(
    `/auth/callback${window.location.search}${window.location.hash}`,
  );
}

function markOAuthCodeHandled(code: string | null) {
  if (code) sessionStorage.setItem(OAUTH_HANDLED_CODE_KEY, code);
}

export function clearOAuthCodeHandled() {
  sessionStorage.removeItem(OAUTH_HANDLED_CODE_KEY);
}

function allowedOrigin(origin: string) {
  return (
    origin === "https://itjima.app" ||
    origin === "https://www.itjima.app" ||
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

export function validateSupabaseConfig():
  | { ok: true }
  | { ok: false; message: string } {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
    | string
    | undefined;

  if (!url || !key) {
    return {
      ok: false,
      message:
        "Supabase 연결 정보가 없어요. VITE_SUPABASE_URL과 VITE_SUPABASE_PUBLISHABLE_KEY를 확인해 주세요.",
    };
  }

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) {
    return {
      ok: false,
      message:
        "Supabase URL 형식이 올바르지 않아요. 프로젝트 URL을 다시 확인해 주세요.",
    };
  }

  // Common typo: ...fcgvcd (gv) vs correct ...fcfgvcd (fg)
  if (url.includes("qikgvovbzliqcfcgvcd")) {
    return {
      ok: false,
      message:
        "Supabase URL 오타예요. bopiuworvbjsowfjbmfx (Itjima production)로 수정한 뒤 Vercel에서 Redeploy 해 주세요.",
    };
  }

  return { ok: true };
}

export function saveAuthReturnPath(path = "/") {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(AUTH_NEXT_KEY, path.startsWith("/") ? path : "/");
}

export function consumeAuthReturnPath() {
  if (typeof window === "undefined") return "/";
  const next = sessionStorage.getItem(AUTH_NEXT_KEY) || "/";
  sessionStorage.removeItem(AUTH_NEXT_KEY);
  if (next === "/auth" || next.startsWith("/auth/callback")) return "/";
  return next.startsWith("/") ? next : "/";
}

export function stashOAuthError(message: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(OAUTH_ERROR_KEY, message);
}

export function consumeOAuthError() {
  if (typeof window === "undefined") return null;
  const message = sessionStorage.getItem(OAUTH_ERROR_KEY);
  sessionStorage.removeItem(OAUTH_ERROR_KEY);
  return message;
}

function waitForAuthSession(timeoutMs = 12000): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean, via: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sub.subscription.unsubscribe();
      authDebug("waitForAuthSession: resolved", { ok, via, timeoutMs });
      resolve(ok);
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish(true, "getSession");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      authDebugAuthStateChange(event, session, "waitForAuthSession");
      if (session) finish(true, `onAuthStateChange:${event}`);
    });

    const timer = setTimeout(() => finish(false, "timeout"), timeoutMs);
  });
}

export async function signInWithGoogle(returnPath?: string) {
  const config = validateSupabaseConfig();
  if (!config.ok) {
    return {
      error: new Error(config.message),
      redirected: false as const,
      url: null,
    };
  }

  saveAuthReturnPath(returnPath ?? window.location.pathname);

  const redirectTo = authRedirectUrl();
  oauthPkceStorageDiag("signInWithGoogle:before", { redirectTo });
  oauthDiag("signInWithGoogle", {
    redirectTo,
    returnPath: returnPath ?? window.location.pathname,
    flowType: "pkce",
  });
  authDebug("signInWithGoogle", { redirectTo });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });

  oauthPkceStorageDiag("signInWithGoogle:after", {
    redirectTo,
    oauthError: error?.message ?? null,
    willRedirect: Boolean(data.url),
  });

  if (error) {
    return { error, redirected: false as const, url: null };
  }

  if (data.url) {
    window.location.assign(data.url);
  }

  return {
    error: null,
    redirected: Boolean(data.url),
    url: data.url ?? null,
  };
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

export async function sendPasswordResetEmail(email: string) {
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : undefined;
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  return { data, error };
}

export function mapAuthError(message: string, lang: "ko" | "en") {
  const lower = message.toLowerCase();

  const ko: Record<string, string> = {
    "Invalid login credentials": "이메일 또는 비밀번호가 올바르지 않아요.",
    "User already registered": "이미 가입된 이메일이에요. 로그인해 주세요.",
    "Email not confirmed":
      "이메일 인증이 필요해요. 받은편지함을 확인해 주세요.",
    "Password should be at least 6 characters":
      "비밀번호는 6자 이상이어야 해요.",
    access_denied: "로그인이 취소됐어요. 다시 시도해 주세요.",
    "Unable to exchange external code":
      "로그인 연결에 문제가 있어요. 잠시 후 다시 시도해 주세요.",
    "Error getting user email from external provider":
      "Google 계정 이메일을 가져오지 못했어요. Google 로그인 설정을 확인해 주세요.",
    "OAuth state parameter missing":
      "로그인 세션이 만료됐어요. 다시 시도해 주세요.",
    "OAuth callback error": "로그인 중 오류가 발생했어요. 다시 시도해 주세요.",
    "Request rate limit reached":
      "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.",
    "Auth session missing!": "로그인 세션이 없어요. 다시 로그인해 주세요.",
    "PKCE code verifier not found in storage":
      "로그인 세션이 만료됐어요. 다시 Google 로그인을 시도해 주세요.",
    "Unsupported provider: missing OAuth secret":
      "Google 로그인 설정이 아직 완료되지 않았어요. Supabase에서 Google Client ID/Secret을 등록해 주세요.",
    validation_failed:
      "로그인 설정 오류예요. Supabase Google OAuth 설정을 확인해 주세요.",
  };

  const en: Record<string, string> = {
    "Invalid login credentials": "Invalid email or password.",
    "User already registered":
      "This email is already registered. Please sign in.",
    "Email not confirmed": "Please confirm your email before signing in.",
    "Password should be at least 6 characters":
      "Password must be at least 6 characters.",
    access_denied: "Sign-in was cancelled. Please try again.",
    "Unable to exchange external code":
      "Could not complete sign-in. Please try again.",
    "Error getting user email from external provider":
      "Could not read your Google email. Check OAuth settings.",
    "OAuth state parameter missing":
      "Sign-in session expired. Please try again.",
    "OAuth callback error": "Something went wrong during sign-in.",
    "Request rate limit reached":
      "Too many attempts. Please wait and try again.",
    "Auth session missing!": "No active session. Please sign in again.",
    "Unsupported provider: missing OAuth secret":
      "Google sign-in is not configured yet. Add Google Client ID/Secret in Supabase.",
    validation_failed:
      "Sign-in configuration error. Check Supabase Google OAuth settings.",
  };

  const table = lang === "ko" ? ko : en;

  if (table[message]) return table[message];
  if (lower.includes("access_denied")) return table.access_denied;
  if (lower.includes("exchange") && lower.includes("code"))
    return table["Unable to exchange external code"];
  if (lower.includes("email") && lower.includes("provider")) {
    return table["Error getting user email from external provider"];
  }

  if (lower.includes("missing oauth secret")) {
    return table["Unsupported provider: missing OAuth secret"];
  }
  if (
    lower.includes("validation_failed") ||
    lower.includes("unsupported provider")
  ) {
    return table.validation_failed;
  }

  return lang === "ko" ? `로그인 오류: ${message}` : message;
}

export type AuthCallbackResult =
  | { ok: true; nextPath: string }
  | { ok: false; message: string };

/** Survives React StrictMode remounts — prevents double PKCE exchange. */
let authCallbackInFlight: Promise<AuthCallbackResult> | null = null;

function failCallback(
  message: string,
  reason?: string,
): AuthCallbackResult {
  authDebug("completeAuthCallback FAIL", {
    reason: reason ?? "unspecified",
    message,
  });
  oauthDiag("callback:fail", { message, reason: reason ?? "unspecified" });
  stashOAuthError(message);
  purgeOAuthFromUrl();
  return { ok: false, message };
}

function sessionExpiredMessage(lang: "ko" | "en"): string {
  return lang === "ko"
    ? "로그인 세션이 만료됐어요. 다시 Google 로그인을 시도해 주세요."
    : "Sign-in session expired. Please try Google sign-in again.";
}

function succeedCallback(reason: string, code?: string | null): AuthCallbackResult {
  if (code) markOAuthCodeHandled(code);
  const nextPath = consumeAuthReturnPath();
  authDebug("completeAuthCallback SUCCESS", { reason, nextPath });
  oauthDiag("callback:success", { reason, nextPath, hasCode: !!code });
  purgeOAuthFromUrl();
  clearOAuthCodeHandled();
  return { ok: true, nextPath };
}

async function completeAuthCallbackOnce(
  lang: "ko" | "en",
): Promise<AuthCallbackResult> {
  oauthDiag("callback:start", {
    href: window.location.href,
    handledCode: sessionStorage.getItem(OAUTH_HANDLED_CODE_KEY),
  });
  oauthPkceStorageDiag("callback:start", {
    hasCode: new URLSearchParams(window.location.search).has("code"),
  });
  authDebug("completeAuthCallback START", {
    lang,
    handledCode: sessionStorage.getItem(OAUTH_HANDLED_CODE_KEY),
  });

  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(
    window.location.hash.replace(/^#/, ""),
  );

  const oauthError = params.get("error") || hashParams.get("error");
  const oauthDescription =
    params.get("error_description") || hashParams.get("error_description");
  if (oauthError) {
    return failCallback(
      mapAuthError(oauthDescription || oauthError, lang),
      "oauth_error_in_url",
    );
  }

  const code = params.get("code");
  oauthDiag("callback:params", {
    hasCode: !!code,
    codePrefix: code?.slice(0, 8) ?? null,
    hashHasTokens: hashParams.has("access_token"),
  });
  authDebug("completeAuthCallback params", {
    hasCode: !!code,
    codePrefix: code?.slice(0, 8) ?? null,
    hashHasTokens: hashParams.has("access_token"),
  });

  const { data: existing } = await authDebugGetSession(
    "completeAuthCallback:initial",
    () => supabase.auth.getSession(),
  );
  oauthDiag("callback:getSession:initial", {
    hasSession: !!existing.session,
    userId: existing.session?.user?.id ?? null,
  });
  if (existing.session) {
    return succeedCallback("session_already_present", code);
  }

  if (code && sessionStorage.getItem(OAUTH_HANDLED_CODE_KEY) === code) {
    const { data: retrySession } = await authDebugGetSession(
      "completeAuthCallback:handled_code_retry",
      () => supabase.auth.getSession(),
    );
    oauthDiag("callback:handled_code_retry", {
      hasSession: !!retrySession.session,
      userId: retrySession.session?.user?.id ?? null,
    });
    if (retrySession.session) {
      return succeedCallback("handled_code_but_session_exists", code);
    }
    return failCallback(
      sessionExpiredMessage(lang),
      "duplicate_handled_code_no_session",
    );
  }

  if (code) {
    oauthPkceStorageDiag("callback:before-exchange", {
      codePrefix: code.slice(0, 8),
    });
    oauthDiag("callback:exchange:start", { codePrefix: code.slice(0, 8) });
    authDebug("completeAuthCallback: exchangeCodeForSession", {
      codePrefix: code.slice(0, 8),
    });
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    oauthDiag("callback:exchange:result", {
      hasSession: !!data.session,
      userId: data.session?.user?.id ?? null,
      error: error?.message ?? null,
    });
    oauthPkceStorageDiag("callback:after-exchange", {
      hasSession: !!data.session,
      exchangeError: error?.message ?? null,
    });
    authDebug("completeAuthCallback: exchange result", {
      hasSession: !!data.session,
      error: error?.message ?? null,
    });
    if (error) {
      const { data: afterError } = await authDebugGetSession(
        "completeAuthCallback:after_exchange_error",
        () => supabase.auth.getSession(),
      );
      oauthDiag("callback:getSession:after_exchange_error", {
        hasSession: !!afterError.session,
        userId: afterError.session?.user?.id ?? null,
      });
      if (afterError.session) {
        return succeedCallback("session_present_after_exchange_error", code);
      }
      return failCallback(
        mapAuthError(error.message, lang),
        "exchangeCodeForSession_error",
      );
    }
    if (data.session) {
      return succeedCallback("exchangeCodeForSession_ok", code);
    }
  } else if (
    hashParams.has("access_token") ||
    hashParams.has("refresh_token") ||
    hashParams.has("type")
  ) {
    authDebug("completeAuthCallback: hash token wait", { timeoutMs: 4000 });
    oauthDiag("callback:hash_token_wait", { timeoutMs: 4000 });
    const hasSession = await waitForAuthSession(4000);
    oauthDiag("callback:hash_token_wait:result", { hasSession });
    authDebug("completeAuthCallback: hash token wait result", { hasSession });
    if (hasSession) {
      return succeedCallback("hash_token_wait_ok");
    }
  } else {
    authDebug("completeAuthCallback: waiting for detectSessionInUrl", {
      timeoutMs: 5000,
    });
    oauthDiag("callback:detectSessionInUrl_wait", { timeoutMs: 5000 });
    const hasSession = await waitForAuthSession(5000);
    oauthDiag("callback:detectSessionInUrl_wait:result", { hasSession });
    authDebug("completeAuthCallback: waitForAuthSession result", { hasSession });
    if (hasSession) {
      return succeedCallback("detectSessionInUrl_ok");
    }
  }

  const { data: sessionCheck } = await authDebugGetSession(
    "completeAuthCallback:final_check",
    () => supabase.auth.getSession(),
  );
  oauthDiag("callback:getSession:final", {
    hasSession: !!sessionCheck.session,
    userId: sessionCheck.session?.user?.id ?? null,
  });
  if (!sessionCheck.session) {
    return failCallback(
      mapAuthError("Auth session missing!", lang),
      "final_session_check_null",
    );
  }

  return succeedCallback("final_session_check_ok", code);
}

/** OAuth/email confirmation callback — call only on /auth/callback */
export function completeAuthCallback(
  lang: "ko" | "en" = "ko",
): Promise<AuthCallbackResult> {
  if (authCallbackInFlight) {
    authDebug("completeAuthCallback DEDUPED (in-flight)", { lang });
    return authCallbackInFlight;
  }

  authCallbackInFlight = completeAuthCallbackOnce(lang).finally(() => {
    authCallbackInFlight = null;
  });

  return authCallbackInFlight;
}
