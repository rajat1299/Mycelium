"use client";

import {
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { ChevronDown } from "lucide-react";

const NEAR_BOTTOM_THRESHOLD_PX = 180;
const FOLLOW_UP_SCROLL_RETRY_MS = 120;

function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function distanceFromBottom(element: HTMLElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight;
}

function isNearBottom(element: HTMLElement) {
  return distanceFromBottom(element) < NEAR_BOTTOM_THRESHOLD_PX;
}

function scrollElementToBottom(
  element: HTMLElement,
  behavior: ScrollBehavior = "auto"
) {
  const top = element.scrollHeight;

  if (typeof element.scrollTo === "function") {
    element.scrollTo({ top, behavior });
    return;
  }

  element.scrollTop = top;
}

type OutcomeTranscriptViewportProps = {
  children: ReactNode;
};

export function OutcomeTranscriptViewport({
  children
}: OutcomeTranscriptViewportProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  const isNearBottomRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const smoothScrollBehavior = useMemo<ScrollBehavior>(
    () => (prefersReducedMotion() ? "auto" : "smooth"),
    []
  );

  const syncDetachedState = (nextNearBottom: boolean) => {
    isNearBottomRef.current = nextNearBottom;
    setShowJumpToLatest(!nextNearBottom);
  };

  const cancelScheduledScroll = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (scrollTimeoutRef.current !== null) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
  };

  const scheduleScrollToBottom = ({
    force = false,
    behavior = "auto"
  }: {
    force?: boolean;
    behavior?: ScrollBehavior;
  } = {}) => {
    cancelScheduledScroll();

    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null;
      const container = scrollContainerRef.current;

      if (!container) {
        return;
      }

      const shouldStick = force || isNearBottomRef.current || isNearBottom(container);

      if (!shouldStick) {
        syncDetachedState(false);
        return;
      }

      scrollElementToBottom(container, behavior);
      syncDetachedState(true);

      scrollTimeoutRef.current = window.setTimeout(() => {
        scrollTimeoutRef.current = null;
        const latest = scrollContainerRef.current;

        if (!latest || !isNearBottomRef.current) {
          return;
        }

        scrollElementToBottom(latest, "auto");
        syncDetachedState(true);
      }, FOLLOW_UP_SCROLL_RETRY_MS);
    });
  };

  useEffect(() => {
    scheduleScrollToBottom({ force: true, behavior: "auto" });

    return cancelScheduledScroll;
  }, []);

  useEffect(() => {
    const content = contentRef.current;

    if (!content || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      scheduleScrollToBottom({ behavior: "auto" });
    });

    observer.observe(content);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="relative flex min-h-0 flex-1">
      <div
        ref={scrollContainerRef}
        className="outcome-transcript-scroll flex-1 overflow-y-auto custom-scrollbar scroll-smooth px-4 pb-44 sm:px-6 lg:px-8"
        onScroll={(event) => {
          const container = event.currentTarget;
          const nearBottom = isNearBottom(container);
          syncDetachedState(nearBottom);
        }}
      >
        <div
          ref={contentRef}
          className="outcome-transcript-content mx-auto w-full max-w-3xl space-y-6 py-6"
        >
          {children}
        </div>
      </div>

      {showJumpToLatest ? (
        <button
          type="button"
          aria-label="Jump to latest"
          className="absolute bottom-36 left-1/2 z-20 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-panel-line/70 bg-surface-elevated/90 text-muted shadow-card backdrop-blur-sm transition-all duration-150 hover:bg-surface-elevated hover:text-ink active:scale-95"
          onClick={() => {
            syncDetachedState(true);
            scheduleScrollToBottom({ force: true, behavior: smoothScrollBehavior });
          }}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
