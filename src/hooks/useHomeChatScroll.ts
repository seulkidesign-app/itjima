import { useCallback, useEffect, useRef, useState } from "react";

const BOTTOM_THRESHOLD_PX = 120;

function getScrollContainer() {
  return document.getElementById("phone-scroll");
}

function isNearBottom(container: HTMLElement) {
  return (
    container.scrollHeight - container.scrollTop - container.clientHeight <=
    BOTTOM_THRESHOLD_PX
  );
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
      const top = Math.max(0, container.scrollHeight - container.clientHeight);

      if (behavior === "instant") {
        container.scrollTop = top;
        nearBottomRef.current = true;
        setUnreadBelow(0);
        return;
      }

      container.scrollTo({ top, behavior });
      nearBottomRef.current = true;
      setUnreadBelow(0);
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
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToBottom("instant");
        nearBottomRef.current = true;
        initialScrollDoneRef.current = true;
      });
    });
  }, [scrollToBottom]);

  useEffect(() => {
    const prev = prevCountRef.current;
    if (itemCount > prev) {
      const added = itemCount - prev;
      if (submitScrollRef.current || nearBottomRef.current) {
        requestAnimationFrame(() => {
          scrollToBottom(submitScrollRef.current ? "smooth" : "smooth");
          if (submitScrollRef.current) nearBottomRef.current = true;
        });
      } else {
        setUnreadBelow((n) => n + added);
      }
      submitScrollRef.current = false;
    }
    prevCountRef.current = itemCount;
  }, [itemCount, scrollToBottom]);

  const notifyThoughtSubmitted = useCallback(() => {
    submitScrollRef.current = true;
    nearBottomRef.current = true;
    setUnreadBelow(0);
    requestAnimationFrame(() => {
      scrollToBottom("smooth");
      submitScrollRef.current = false;
    });
  }, [scrollToBottom]);

  return {
    notifyThoughtSubmitted,
    scrollToBottom,
    unreadBelow,
    jumpToLatest: () => scrollToBottom("smooth"),
  };
}
