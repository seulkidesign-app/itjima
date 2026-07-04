import { useEffect, useState } from "react";
import { useUserId } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";

export function useIsAdmin() {
  const userId = useUserId();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      return;
    }
    let alive = true;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setIsAdmin(!!data);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  return isAdmin;
}
