import { useEffect } from "react";
import { setArchiveMetaUserId } from "@/lib/archiveMeta";
import {
  scheduleArchiveMetaPush,
  syncArchiveMetaFromCloud,
} from "@/lib/archiveMetaSync";
import { useUserId } from "@/lib/store";

/** Keeps archive pins/titles/groups in sync for signed-in users. */
export function useArchiveMetaSync() {
  const userId = useUserId();

  useEffect(() => {
    setArchiveMetaUserId(userId);
    if (!userId) return;
    void syncArchiveMetaFromCloud(userId);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const onChange = () => scheduleArchiveMetaPush(userId);
    window.addEventListener("itjima:archive-meta", onChange);
    return () => window.removeEventListener("itjima:archive-meta", onChange);
  }, [userId]);
}
