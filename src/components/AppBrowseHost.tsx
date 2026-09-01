import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { RecordsBrowseSheet } from "@/components/RecordsBrowseSheet";
import {
  useInbox,
  useSchedules,
  type InboxItem,
  type ScheduleItem,
} from "@/lib/store";

const OPEN_BROWSE = "itjima:open-browse";
const OPEN_RECORD_DETAIL = "itjima:open-record-detail";

function dispatchRecordDetail(item: InboxItem) {
  window.dispatchEvent(
    new CustomEvent(OPEN_RECORD_DETAIL, { detail: item }),
  );
}

/** Always-mounted browse host — Home unmount must not break the search icon. */
export function AppBrowseHost() {
  const inbox = useInbox();
  const schedules = useSchedules();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [pendingDetail, setPendingDetail] = useState<InboxItem | null>(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_BROWSE, onOpen);
    return () => window.removeEventListener(OPEN_BROWSE, onOpen);
  }, []);

  // Route state, not an arbitrary millisecond delay, decides when the Home
  // detail event may fire. One animation frame lets the route child mount its
  // listener before the event is dispatched.
  useEffect(() => {
    if (pathname !== "/app" || !pendingDetail) return;
    const frame = window.requestAnimationFrame(() => {
      dispatchRecordDetail(pendingDetail);
      setPendingDetail(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, pendingDetail]);

  const openRecord = (item: InboxItem) => {
    setOpen(false);
    if (pathname !== "/app") {
      setPendingDetail(item);
      void navigate({ to: "/app" });
      return;
    }
    dispatchRecordDetail(item);
  };

  const openStandaloneSchedule = (schedule: ScheduleItem) => {
    setOpen(false);
    sessionStorage.setItem("itjima.openScheduleEdit", schedule.id);
    if (pathname === "/schedule") {
      // The Schedule route opens the requested row on mount. A same-route
      // navigation is a no-op, so legacy standalone rows need one clean remount.
      window.location.assign("/schedule");
      return;
    }
    void navigate({ to: "/schedule" });
  };

  return (
    <RecordsBrowseSheet
      open={open}
      items={inbox.allItems}
      schedules={schedules.items}
      onClose={() => setOpen(false)}
      onOpenRecord={openRecord}
      onOpenSchedule={openStandaloneSchedule}
    />
  );
}

export { OPEN_RECORD_DETAIL };
