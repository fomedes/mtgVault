"use client";

import { useEffect, useState, type ReactNode } from "react";
import { RotateCw } from "lucide-react";

/**
 * The battlefield is a dense, height-driven stage — unusable in phone-portrait.
 * On phones held upright we show a rotate prompt; landscape phones, tablets and
 * desktops fall through to the board. Tablet/desktop portrait is allowed (the
 * `max-width: 767px` clause limits the block to phone-sized viewports).
 */
const PORTRAIT_PHONE = "(orientation: portrait) and (max-width: 767px)";

export function OrientationGuard({ children }: { children: ReactNode }) {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(PORTRAIT_PHONE);
    const update = () => setBlocked(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (blocked) {
    return (
      <div className="bg-background text-foreground flex h-full w-full flex-col items-center justify-center gap-4 px-8 text-center">
        <RotateCw
          className="text-muted-foreground size-10 animate-pulse"
          aria-hidden
        />
        <div>
          <p className="text-lg font-semibold">Rotate your device</p>
          <p className="text-muted-foreground mt-1 text-sm">
            The battlefield needs a landscape screen to fit every card without
            scrolling.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
