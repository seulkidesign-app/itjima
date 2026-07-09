import { useEffect, useState } from "react";
import { useUserId } from "@/lib/store";
import { checkIsAdmin } from "@/lib/admin.functions";

export function useIsAdmin() {
  const userId = useUserId();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      return;
    }
    let alive = true;
    checkIsAdmin()
      .then(({ isAdmin: ok }) => {
        if (alive) setIsAdmin(ok);
      })
      .catch(() => {
        if (alive) setIsAdmin(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  return isAdmin;
}
