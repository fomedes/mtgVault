"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CardPreview } from "@/components/cards/card-preview";
import type { CardListItemDto } from "@/lib/api/card-dto";

interface CardPreviewContextValue {
  show: (card: CardListItemDto, anchor: DOMRect) => void;
  hide: () => void;
  previewHandlers: (card: CardListItemDto) => {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => void;
    onMouseLeave: () => void;
    onTouchStart: (e: React.TouchEvent<HTMLElement>) => void;
    onTouchEnd: () => void;
    onTouchCancel: () => void;
  };
}

const CardPreviewContext = createContext<CardPreviewContextValue | null>(null);

/**
 * Wraps a subtree with a shared card-preview portal (P9-03).
 * Any child can call `useCardPreviewContext().previewHandlers(card)` to opt in.
 */
export function CardPreviewProvider({ children }: { children: React.ReactNode }) {
  const [card, setCard] = useState<CardListItemDto | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((c: CardListItemDto, rect: DOMRect) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCard(c);
    setAnchorRect(rect);
  }, []);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCard(null);
    setAnchorRect(null);
  }, []);

  const previewHandlers = useCallback(
    (c: CardListItemDto) => ({
      onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
        show(c, e.currentTarget.getBoundingClientRect());
      },
      onMouseLeave: () => hide(),
      onTouchStart: (e: React.TouchEvent<HTMLElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        timerRef.current = setTimeout(() => show(c, rect), 400);
      },
      onTouchEnd: () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        hide();
      },
      onTouchCancel: () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        hide();
      },
    }),
    [show, hide],
  );

  return (
    <CardPreviewContext.Provider value={{ show, hide, previewHandlers }}>
      {children}
      <CardPreview card={card} anchorRect={anchorRect} />
    </CardPreviewContext.Provider>
  );
}

const NO_OP_HANDLERS = () => ({
  onMouseEnter: () => undefined,
  onMouseLeave: () => undefined,
  onTouchStart: () => undefined,
  onTouchEnd: () => undefined,
  onTouchCancel: () => undefined,
});

const NO_OP_CTX: CardPreviewContextValue = {
  show: () => undefined,
  hide: () => undefined,
  previewHandlers: NO_OP_HANDLERS,
};

/**
 * Returns the nearest provider's context, or a no-op fallback when used
 * outside a provider (so tiles work without requiring a wrapping provider).
 */
export function useCardPreviewContext(): CardPreviewContextValue {
  return useContext(CardPreviewContext) ?? NO_OP_CTX;
}
