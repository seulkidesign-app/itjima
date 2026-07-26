/**
 * TEMPORARY OAuth investigation instrumentation — remove after root cause is confirmed.
 */
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import type { AnyRouter } from "@tanstack/react-router";

const PREFIX = "[auth-debug]";

/** Dev-only; never install hooks or log in production builds. */
const AUTH_DEBUG_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_E2E !== "true";

/** Every automatic /auth destination in the codebase (for audit). */
export const AUTH_LOGIN_ROUTE_SOURCES = [
  {
    id: "auth.callback.failure",
    file: "src/routes/auth.callback.tsx",
    trigger: "completeAuthCallback() returns ok:false",
    mechanism: "window.location.replace('/auth')",
  },
  {
    id: "authenticated.beforeLoad",
    file: "src/routes/_authenticated/route.tsx",
    trigger: "getSession() has no session.user on /admin/*",
    mechanism: "throw redirect({ to: '/auth' })",
  },
  {
    id: "auth.page.session",
    file: "src/routes/auth.tsx",
    trigger: "User lands on /auth (usually from callback failure)",
    mechanism: "Route renders login page — not a redirect source",
  },
  {
    id: "link.settings",
    file: "src/components/SettingsSheet.tsx",
    trigger: "User taps Sign in link",
    mechanism: "<Link to='/auth'>",
  },
  {
    id: "link.loginSheet",
    file: "src/components/LoginSheet.tsx",
    trigger: "User taps email sign-in link",
    mechanism: "<Link to='/auth'>",
  },
  {
    id: "link.sideNav",
    file: "src/components/SideNav.tsx",
    trigger: "User taps Sign in link",
    mechanism: "<Link to='/auth'>",
  },
] as const;

export const AUTH_SIGN_OUT_SOURCES = [
  {
    id: "settings.signOut",
    file: "src/components/SettingsSheet.tsx",
    mechanism: "supabase.auth.signOut()",
  },
  {
    id: "sideNav.signOut",
    file: "src/components/SideNav.tsx",
    mechanism: "supabase.auth.signOut()",
  },
] as const;

function captureStack() {
  return new Error("auth-debug stack").stack;
}

export function authDebug(
  step: string,
  data: Record<string, unknown> = {},
) {
  if (!AUTH_DEBUG_ENABLED || typeof window === "undefined") return;
  console.log(PREFIX, step, {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    ...data,
  });
}

export function authDebugNavigateToAuth(
  origin: string,
  detail: Record<string, unknown> = {},
) {
  authDebug("NAVIGATE → /auth", {
    origin,
    stack: captureStack(),
    ...detail,
  });
}

export function authDebugAuthStateChange(
  event: AuthChangeEvent,
  session: Session | null,
  source: string,
) {
  authDebug("onAuthStateChange", {
    source,
    event,
    userId: session?.user?.id ?? null,
    hasSession: !!session,
  });
}

export function authDebugExchangeCodeForSession(
  source: string,
  code: string,
) {
  authDebug("exchangeCodeForSession CALLED", {
    source,
    codePrefix: code.slice(0, 8),
    stack: captureStack(),
  });
}

export async function authDebugGetSession(
  source: string,
  getSession: () => ReturnType<
    import("@supabase/supabase-js").SupabaseAuthClient["getSession"]
  >,
) {
  const result = await getSession();
  authDebug("getSession", {
    source,
    userId: result.data.session?.user?.id ?? null,
    hasSession: !!result.data.session,
    error: result.error?.message ?? null,
  });
  return result;
}

export function authDebugSignOut(source: string) {
  authDebug("signOut CALLED", {
    source,
    stack: captureStack(),
  });
}

let installed = false;

export function installAuthDebugInstrumentation(router: AnyRouter) {
  if (!AUTH_DEBUG_ENABLED || typeof window === "undefined") return;
  if (installed) return;
  installed = true;

  authDebug("instrumentation installed", {
    href: window.location.href,
    loginRouteSources: AUTH_LOGIN_ROUTE_SOURCES.map((s) => s.id),
    signOutSources: AUTH_SIGN_OUT_SOURCES.map((s) => s.id),
  });

  void import("@/integrations/supabase/client").then(({ supabase }) => {
    supabase.auth.onAuthStateChange((event, session) => {
      authDebugAuthStateChange(event, session, "global:main");
    });
  });

  router.subscribe("onResolved", (event) => {
    const pathname = event.toLocation.pathname;
    if (pathname.startsWith("/auth")) {
      authDebug("router.onResolved → /auth", {
        from: event.fromLocation?.pathname ?? null,
        to: pathname,
        href: event.toLocation.href,
      });
    }
  });

  router.subscribe("onBeforeNavigate", (event) => {
    const pathname = event.toLocation.pathname;
    if (pathname.startsWith("/auth")) {
      authDebug("router.onBeforeNavigate → /auth", {
        from: event.fromLocation?.pathname ?? null,
        to: pathname,
        stack: captureStack(),
      });
    }
  });
}
