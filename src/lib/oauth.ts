import { supabase } from "@/integrations/supabase/client";

function authRedirectUrl() {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}/`;
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: authRedirectUrl(),
      queryParams: {
        access_type: "offline",
        prompt: "consent",
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
  const ko: Record<string, string> = {
    "Invalid login credentials": "이메일 또는 비밀번호가 올바르지 않아요.",
    "User already registered": "이미 가입된 이메일이에요. 로그인해 주세요.",
    "Email not confirmed": "이메일 인증이 필요해요. 받은편지함을 확인해 주세요.",
    "Password should be at least 6 characters": "비밀번호는 6자 이상이어야 해요.",
  };
  const en: Record<string, string> = {
    "Invalid login credentials": "Invalid email or password.",
    "User already registered": "This email is already registered. Please sign in.",
    "Email not confirmed": "Please confirm your email before signing in.",
    "Password should be at least 6 characters": "Password must be at least 6 characters.",
  };
  const table = lang === "ko" ? ko : en;
  return table[message] ?? message;
}

/** Handle OAuth/email confirmation redirects on app load. */
export async function recoverAuthSession() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    return supabase.auth.getSession();
  }

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const hasHashAuth =
    hashParams.has("access_token") || hashParams.has("error") || hashParams.has("error_description");

  if (hasHashAuth) {
    const { data, error } = await supabase.auth.getSession();
    if (!error && data.session) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    return { data, error };
  }

  return supabase.auth.getSession();
}
