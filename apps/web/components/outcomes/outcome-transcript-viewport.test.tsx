import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutcomeTranscriptViewport } from "./outcome-transcript-viewport";

type ResizeObserverCallbackEntry = {
  callback: ResizeObserverCallback;
  elements: Set<Element>;
};

const resizeObserverEntries: ResizeObserverCallbackEntry[] = [];

class MockResizeObserver {
  private readonly entry: ResizeObserverCallbackEntry;

  constructor(callback: ResizeObserverCallback) {
    this.entry = {
      callback,
      elements: new Set()
    };
    resizeObserverEntries.push(this.entry);
  }

  observe(element: Element) {
    this.entry.elements.add(element);
  }

  unobserve(element: Element) {
    this.entry.elements.delete(element);
  }

  disconnect() {
    this.entry.elements.clear();
  }
}

function triggerResize(element: Element) {
  for (const entry of resizeObserverEntries) {
    if (!entry.elements.has(element)) {
      continue;
    }

    entry.callback(
      [
        {
          target: element,
          contentRect: {
            width: 0,
            height: 0,
            x: 0,
            y: 0,
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            toJSON() {
              return {};
            }
          }
        } as ResizeObserverEntry
      ],
      {} as ResizeObserver
    );
  }
}

function configureScrollableMetrics(
  element: HTMLElement,
  initial: {
    clientHeight: number;
    scrollHeight: number;
    scrollTop: number;
  }
) {
  let clientHeight = initial.clientHeight;
  let scrollHeight = initial.scrollHeight;
  let scrollTop = initial.scrollTop;

  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    get: () => clientHeight
  });
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    get: () => scrollHeight
  });
  Object.defineProperty(element, "scrollTop", {
    configurable: true,
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = value;
    }
  });

  const scrollTo = vi.fn(
    ({ top }: { top?: number; behavior?: ScrollBehavior } = {}) => {
      scrollTop = top ?? scrollTop;
    }
  );
  element.scrollTo = scrollTo as typeof element.scrollTo;

  return {
    scrollTo,
    setMetrics(next: Partial<{ clientHeight: number; scrollHeight: number; scrollTop: number }>) {
      if (typeof next.clientHeight === "number") {
        clientHeight = next.clientHeight;
      }
      if (typeof next.scrollHeight === "number") {
        scrollHeight = next.scrollHeight;
      }
      if (typeof next.scrollTop === "number") {
        scrollTop = next.scrollTop;
      }
    },
    getScrollTop() {
      return scrollTop;
    }
  };
}

describe("OutcomeTranscriptViewport", () => {
  beforeEach(() => {
    resizeObserverEntries.length = 0;
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    vi.spyOn(window, "setTimeout").mockImplementation(((callback: TimerHandler) => {
      if (typeof callback === "function") {
        callback();
      }
      return 1;
    }) as typeof window.setTimeout);
    vi.spyOn(window, "clearTimeout").mockImplementation(() => {});
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("auto-follows transcript growth while the user is near the bottom", () => {
    const { container } = render(
      <OutcomeTranscriptViewport>
        <div style={{ height: 200 }}>Turn one</div>
      </OutcomeTranscriptViewport>
    );

    const scrollContainer = container.querySelector(
      ".outcome-transcript-scroll"
    ) as HTMLElement;
    const transcriptContent = container.querySelector(
      ".outcome-transcript-content"
    ) as HTMLElement;
    const metrics = configureScrollableMetrics(scrollContainer, {
      clientHeight: 400,
      scrollHeight: 2_000,
      scrollTop: 1_520
    });

    fireEvent.scroll(scrollContainer);
    metrics.scrollTo.mockClear();
    metrics.setMetrics({ scrollHeight: 2_320 });

    act(() => {
      triggerResize(transcriptContent);
    });

    expect(metrics.scrollTo).toHaveBeenCalledWith({
      top: 2_320,
      behavior: "auto"
    });
    expect(screen.queryByRole("button", { name: /jump to latest/i })).not.toBeInTheDocument();
  });

  it("does not force-scroll when the user has detached from the live bottom", () => {
    const { container } = render(
      <OutcomeTranscriptViewport>
        <div style={{ height: 200 }}>Turn one</div>
      </OutcomeTranscriptViewport>
    );

    const scrollContainer = container.querySelector(
      ".outcome-transcript-scroll"
    ) as HTMLElement;
    const transcriptContent = container.querySelector(
      ".outcome-transcript-content"
    ) as HTMLElement;
    const metrics = configureScrollableMetrics(scrollContainer, {
      clientHeight: 400,
      scrollHeight: 2_000,
      scrollTop: 900
    });

    fireEvent.scroll(scrollContainer);
    metrics.scrollTo.mockClear();
    metrics.setMetrics({ scrollHeight: 2_260 });

    act(() => {
      triggerResize(transcriptContent);
    });

    expect(metrics.scrollTo).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /jump to latest/i })).toBeInTheDocument();
  });

  it("shows the jump-to-latest control while detached and hides it at the live bottom", () => {
    const { container } = render(
      <OutcomeTranscriptViewport>
        <div style={{ height: 200 }}>Turn one</div>
      </OutcomeTranscriptViewport>
    );

    const scrollContainer = container.querySelector(
      ".outcome-transcript-scroll"
    ) as HTMLElement;
    const metrics = configureScrollableMetrics(scrollContainer, {
      clientHeight: 400,
      scrollHeight: 2_000,
      scrollTop: 900
    });

    fireEvent.scroll(scrollContainer);
    expect(screen.getByRole("button", { name: /jump to latest/i })).toBeInTheDocument();

    metrics.setMetrics({ scrollTop: 1_640 });
    fireEvent.scroll(scrollContainer);

    expect(screen.queryByRole("button", { name: /jump to latest/i })).not.toBeInTheDocument();
  });

  it("restores live follow mode when jump-to-latest is clicked", () => {
    const { container } = render(
      <OutcomeTranscriptViewport>
        <div style={{ height: 200 }}>Turn one</div>
      </OutcomeTranscriptViewport>
    );

    const scrollContainer = container.querySelector(
      ".outcome-transcript-scroll"
    ) as HTMLElement;
    const transcriptContent = container.querySelector(
      ".outcome-transcript-content"
    ) as HTMLElement;
    const metrics = configureScrollableMetrics(scrollContainer, {
      clientHeight: 400,
      scrollHeight: 2_000,
      scrollTop: 900
    });

    fireEvent.scroll(scrollContainer);
    metrics.scrollTo.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /jump to latest/i }));

    expect(metrics.scrollTo).toHaveBeenCalledWith({
      top: 2_000,
      behavior: "smooth"
    });
    expect(screen.queryByRole("button", { name: /jump to latest/i })).not.toBeInTheDocument();

    metrics.scrollTo.mockClear();
    metrics.setMetrics({ scrollHeight: 2_320 });

    act(() => {
      triggerResize(transcriptContent);
    });

    expect(metrics.scrollTo).toHaveBeenCalledWith({
      top: 2_320,
      behavior: "auto"
    });
  });

  it("uses instant scrolling when reduced motion is preferred", () => {
    (window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    const { container } = render(
      <OutcomeTranscriptViewport>
        <div style={{ height: 200 }}>Turn one</div>
      </OutcomeTranscriptViewport>
    );

    const scrollContainer = container.querySelector(
      ".outcome-transcript-scroll"
    ) as HTMLElement;
    const metrics = configureScrollableMetrics(scrollContainer, {
      clientHeight: 400,
      scrollHeight: 2_000,
      scrollTop: 900
    });

    fireEvent.scroll(scrollContainer);
    metrics.scrollTo.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /jump to latest/i }));

    expect(metrics.scrollTo).toHaveBeenCalledWith({
      top: 2_000,
      behavior: "auto"
    });
  });
});
