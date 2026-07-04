import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getE2eUserId } from "@/lib/store";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    if (getE2eUserId()) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) {
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});
