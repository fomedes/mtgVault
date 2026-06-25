"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const noopSubscribe = () => () => {};

/** True only after the client has mounted — avoids an SSR/hydration mismatch
 * without a setState-in-effect. */
function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Mounts the active match as a full-screen surface via a portal to `document.body`,
 * so it escapes the app nav, BackgroundLayer and `max-w` wrappers without editing
 * the layout tree. Locks page scroll while mounted and reverts on unmount, so the
 * user is never trapped — the board's own top bar always carries a Leave control.
 *
 * `100dvh/100dvw` (with `inset-0` as the fallback) keeps the stage exactly one
 * viewport tall on mobile browsers whose URL bar changes the visible height.
 */
export function ImmersiveStage({ children }: { children: ReactNode }) {
  const mounted = useMounted();

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      data-immersive-stage
      className="bg-background text-foreground fixed inset-0 z-50 overflow-hidden"
      style={{ height: "100dvh", width: "100dvw" }}
    >
      {children}
    </div>,
    document.body,
  );
}
