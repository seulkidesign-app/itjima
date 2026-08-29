import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { RecordsBrowseSheet } from "@/components/RecordsBrowseSheet";
import { useInbox, type InboxItem } from "@/lib/store";

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

  return (
    <RecordsBrowseSheet
      open={open}
      items={inbox.allItems}
      onClose={() => setOpen(false)}
      onOpenRecord={openRecord}
    />
  );
}

export { OPEN_RECORD_DETAIL };