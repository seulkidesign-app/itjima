import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  authDebugGetSession,
  authDebugNavigateToAuth,
} from "@/lib/authDebug";
import { getMyAdminStatus } from "@/lib/admin.functions";
import { getE2eUserId } from "@/lib/store";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    if (!getE2eUserId()) {
      const { data } = await authDebugGetSession(
        "_authenticated/route.tsx:beforeLoad",
        () => supabase.auth.getSession(),
      );
      if (!data.session?.user) {
        authDebugNavigateToAuth("_authenticated/route.tsx:beforeLoad", {
          reason: "no session.user in beforeLoad",
        });
        throw redirect({ to: "/auth" });
      }
    }

    // Admin is a role-gated surface, not merely an authenticated route.
    // Never render the admin shell or bootstrap UI for a normal signed-in user.
    if (location.pathname.startsWith("/admin")) {
      const status = await getMyAdminStatus().catch(() => null);
      if (!status?.isAdmin) {
        throw redirect({ to: "/app" });
      }
    }
  },
  component: () => <Outlet />,
});
