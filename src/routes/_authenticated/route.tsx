import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  authDebugGetSession,
  authDebugNavigateToAuth,
} from "@/lib/authDebug";
import { getE2eUserId } from "@/lib/store";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    if (getE2eUserId()) return;
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
  },
  component: () => <Outlet />,
});
