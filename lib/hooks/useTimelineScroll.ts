import { useCallback, useEffect, useRef, useState } from "react";

type UseTimelineScrollOptions = {
  windowStart: number;
  yearWidthPx: number;
  windowSizePx: number;
  yearMin: number;
  yearMax: number;
  isPlaying: boolean;
  onWindowStartChange: (start: number) => void;
  clampWindowStart: (start: number) => number;
};

/**
 * Custom hook for timeline scroll and drag functionality
 * Manages scroll position, drag state, and container dimensions
 */
export function useTimelineScroll({
  windowStart,
  yearWidthPx,
  windowSizePx,
  yearMin,
  yearMax,
  isPlaying,
  onWindowStartChange,
  clampWindowStart,
}: UseTimelineScrollOptions) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, scrollLeft: 0 });
  const userScrolledRef = useRef(false);
  const [containerWidth, setContainerWidth] = useState(400);

  // Conversion functions
  const scrollLeftToWindowStart = useCallback(
    (scrollLeft: number) => {
      const yearIndex = (scrollLeft + (containerWidth - windowSizePx) / 2) / yearWidthPx;
      return clampWindowStart(yearMin + Math.round(yearIndex));
    },
    [containerWidth, yearMin, clampWindowStart, yearWidthPx, windowSizePx]
  );

  const windowStartToScrollLeft = useCallback(
    (start: number) => {
      const yearIndex = start - yearMin;
      return yearIndex * yearWidthPx - (containerWidth - windowSizePx) / 2;
    },
    [containerWidth, yearMin, yearWidthPx, windowSizePx]
  );

  // Observe container size changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    
    return () => ro.disconnect();
  }, []);

  // Sync scroll position with window start (programmatic changes only)
  useEffect(() => {
    if (!scrollRef.current || isDraggingRef.current || userScrolledRef.current) return;
    
    const targetScroll = Math.max(
      0,
      Math.min(
        scrollRef.current.scrollWidth - scrollRef.current.clientWidth,
        windowStartToScrollLeft(windowStart)
      )
    );
    
    if (Math.abs(scrollRef.current.scrollLeft - targetScroll) > 2) {
      scrollRef.current.scrollLeft = targetScroll;
    }
  }, [windowStart, windowStartToScrollLeft]);

  // Handle scroll events (user interaction)
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || isDraggingRef.current || isPlaying) return;
    
    userScrolledRef.current = true;
    const start = scrollLeftToWindowStart(scrollRef.current.scrollLeft);
    onWindowStartChange(start);
    
    requestAnimationFrame(() => {
      userScrolledRef.current = false;
    });
  }, [onWindowStartChange, scrollLeftToWindowStart, isPlaying]);

  // Drag handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    if (scrollRef.current) {
      dragStartRef.current = { x: e.clientX, scrollLeft: scrollRef.current.scrollLeft };
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current || !scrollRef.current) return;
      
      const dx = dragStartRef.current.x - e.clientX;
      let newScroll = dragStartRef.current.scrollLeft + dx;
      const maxScroll = scrollRef.current.scrollWidth - scrollRef.current.clientWidth;
      newScroll = Math.max(0, Math.min(maxScroll, newScroll));
      
      scrollRef.current.scrollLeft = newScroll;
      const start = scrollLeftToWindowStart(newScroll);
      onWindowStartChange(start);
    },
    [onWindowStartChange, scrollLeftToWindowStart]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  return {
    scrollRef,
    containerWidth,
    handleScroll,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
