import { useCallback, useEffect, useRef } from "react";

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

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const container = getScrollContainer();
      if (!container) return;
      const top = Math.max(0, container.scrollHeight - container.clientHeight);

      if (behavior === "instant") {
        container.scrollTop = top;
        return;
      }

      container.scrollTo({ top, behavior });
    },
    [],
  );

  useEffect(() => {
    const container = getScrollContainer();
    if (!container) return;

    const onScroll = () => {
      nearBottomRef.current = isNearBottom(container);
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
      if (submitScrollRef.current || nearBottomRef.current) {
        requestAnimationFrame(() => {
          scrollToBottom(submitScrollRef.current ? "smooth" : "smooth");
          if (submitScrollRef.current) nearBottomRef.current = true;
        });
      }
      submitScrollRef.current = false;
    }
    prevCountRef.current = itemCount;
  }, [itemCount, scrollToBottom]);

  const notifyThoughtSubmitted = useCallback(() => {
    submitScrollRef.current = true;
    nearBottomRef.current = true;
    requestAnimationFrame(() => {
      scrollToBottom("smooth");
      submitScrollRef.current = false;
    });
  }, [scrollToBottom]);

  return { notifyThoughtSubmitted, scrollToBottom };
}
