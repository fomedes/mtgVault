"use client";

import { useCallback, useRef, useState } from "react";
import type { CardListItemDto } from "@/lib/api/card-dto";

export interface CardPreviewState {
  card: CardListItemDto | null;
  anchorRect: DOMRect | null;
}

/**
 * Minimal hook that tracks which card should be shown in the preview portal.
 * Any component in the tree can call the returned handlers without needing
 * access to a shared context — the preview lives in one place (the layout)
 * via the `CardPreviewPortal` component.
 */
export function useCardPreview() {
  const [state, setState] = useState<CardPreviewState>({
    card: null,
    anchorRect: null,
  });
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((card: CardListItemDto, anchorRect: DOMRect) => {
    setState({ card, anchorRect });
  }, []);

  const hide = useCallback(() => {
    setState({ card: null, anchorRect: null });
  }, []);

  /** Desktop: show on hover-enter, hide on hover-leave. */
  const hoverHandlers = useCallback(
    (card: CardListItemDto) => ({
      onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
        show(card, e.currentTarget.getBoundingClientRect());
      },
      onMouseLeave: () => hide(),
    }),
    [show, hide],
  );

  /** Touch: show on 400 ms long-press, hide on pointer-up/cancel. */
  const touchHandlers = useCallback(
    (card: CardListItemDto) => ({
      onTouchStart: (e: React.TouchEvent<HTMLElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        longPressTimerRef.current = setTimeout(() => show(card, rect), 400);
      },
      onTouchEnd: () => {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        hide();
      },
      onTouchCancel: () => {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        hide();
      },
    }),
    [show, hide],
  );

  const previewHandlers = useCallback(
    (card: CardListItemDto) => ({
      ...hoverHandlers(card),
      ...touchHandlers(card),
    }),
    [hoverHandlers, touchHandlers],
  );

  return { state, show, hide, previewHandlers };
}
