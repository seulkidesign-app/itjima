import { useCallback, useEffect, useRef, useState } from "react";

const BOTTOM_THRESHOLD_PX = 120;

function getScrollContainer(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(".home-chat-lane") ??
    document.getElementById("phone-scroll")
  );
}

function isNearBottom(container: HTMLElement) {
  return (
    container.scrollHeight - container.scrollTop - container.clientHeight <=
    BOTTOM_THRESHOLD_PX
  );
}

/**
 * Scroll after React paint, motion layout and late content sizing.
 * Aborts if the user scrolls away mid-settle so we don't steal their place.
 */
function settleAtBottom(
  container: HTMLElement,
  behavior: ScrollBehavior,
  onSettled: () => void,
) {
  let frame = 0;
  let cancelled = false;
  let programmatic = false;

  const onScroll = () => {
    if (programmatic) return;
    if (frame > 0 && !isNearBottom(container)) cancelled = true;
  };
  container.addEventListener("scroll", onScroll, { passive: true });

  const finish = () => {
    container.removeEventListener("scroll", onScroll);
    onSettled();
  };

  const run = () => {
    if (cancelled) {
      finish();
      return;
    }
    const top = Math.max(0, container.scrollHeight - container.clientHeight);
    programmatic = true;
    if (behavior === "instant") container.scrollTop = top;
    else container.scrollTo({ top, behavior: frame === 0 ? behavior : "auto" });
    requestAnimationFrame(() => {
      programmatic = false;
    });

    frame += 1;
    if (frame < 3) {
      requestAnimationFrame(run);
      return;
    }
    finish();
  };
  requestAnimationFrame(run);
}

export function useHomeChatScroll(itemCount: number) {
  const nearBottomRef = useRef(true);
  const prevCountRef = useRef(itemCount);
  const initialScrollDoneRef = useRef(false);
  const submitScrollRef = useRef(false);
  const [unreadBelow, setUnreadBelow] = useState(0);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const container = getScrollContainer();
      if (!container) return;

      settleAtBottom(container, behavior, () => {
        nearBottomRef.current = true;
        setUnreadBelow(0);
      });
    },
    [],
  );

  useEffect(() => {
    const container = getScrollContainer();
    if (!container) return;

    const onScroll = () => {
      nearBottomRef.current = isNearBottom(container);
      if (nearBottomRef.current) setUnreadBelow(0);
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (initialScrollDoneRef.current) return;
    const container = getScrollContainer();
    if (!container) return;

    settleAtBottom(container, "instant", () => {
      nearBottomRef.current = true;
      initialScrollDoneRef.current = true;
    });
  }, []);

  useEffect(() => {
    const previous = prevCountRef.current;
    if (itemCount > previous) {
      const added = itemCount - previous;
      const submittedByThisComposer = submitScrollRef.current;

      if (submittedByThisComposer || nearBottomRef.current) {
        scrollToBottom(submittedByThisComposer ? "smooth" : "auto");
      } else {
        setUnreadBelow((count) => count + added);
      }
      submitScrollRef.current = false;
    }
    prevCountRef.current = itemCount;
  }, [itemCount, scrollToBottom]);

  const notifyThoughtSubmitted = useCallback(() => {
    submitScrollRef.current = true;
    nearBottomRef.current = true;
    setUnreadBelow(0);
    scrollToBottom("smooth");
  }, [scrollToBottom]);

  return {
    notifyThoughtSubmitted,
    scrollToBottom,
    unreadBelow,
    jumpToLatest: () => scrollToBottom("smooth"),
  };
}
