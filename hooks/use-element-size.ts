"use client";

import { useLayoutEffect, useRef, useState } from "react";

export interface ElementSize {
  width: number;
  height: number;
}

/**
 * Tracks an element's content-box size via ResizeObserver, rAF-batched so a
 * burst of resize callbacks collapses into a single state update (no observer
 * thrash, no resize loop). Drives the battlefield's height-relative card sizing.
 */
export function useElementSize<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    const apply = (width: number, height: number) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setSize((prev) =>
          prev.width === width && prev.height === height
            ? prev
            : { width, height },
        );
      });
    };

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) apply(rect.width, rect.height);
    });
    ro.observe(el);

    const rect = el.getBoundingClientRect();
    apply(rect.width, rect.height);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, []);

  return { ref, width: size.width, height: size.height };
}
