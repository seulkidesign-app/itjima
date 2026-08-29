import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { RecordsBrowseSheet } from "@/components/RecordsBrowseSheet";
import { useInbox, type InboxItem } from "@/lib/store";

const OPEN_BROWSE = "itjima:open-browse";
const OPEN_RECORD_DETAIL = "itjima:open-record-detail";

/** Always-mounted browse host — Home unmount must not break the search icon. */
export function AppBrowseHost() {
  const inbox = useInbox();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_BROWSE, onOpen);
    return () => window.removeEventListener(OPEN_BROWSE, onOpen);
  }, []);

  const openRecord = (item: InboxItem) => {
    setOpen(false);
    const dispatchDetail = () => {
      window.dispatchEvent(
        new CustomEvent(OPEN_RECORD_DETAIL, { detail: item }),
      );
    };
    if (pathname !== "/app") {
      void navigate({ to: "/app" }).then(() => {
        window.setTimeout(dispatchDetail, 80);
      });
      return;
    }
    dispatchDetail();
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
