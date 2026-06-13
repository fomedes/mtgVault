"use client";

import { useEffect } from "react";
import { getBackground } from "@/lib/backgrounds";
import { usePreferencesStore } from "@/store/preferences-store";

/**
 * Fixed, dimmed/blurred backdrop behind all app content (D14). Renders nothing
 * for the "none" default. Seeded from the persisted server value, then driven
 * by the appearance picker via the shared store.
 */
export function BackgroundLayer({
  initialBackground,
}: {
  initialBackground: string;
}) {
  const backgroundId = usePreferencesStore((s) => s.backgroundId);
  const setBackgroundId = usePreferencesStore((s) => s.setBackgroundId);

  // Seed the store from the server-persisted preference on first mount.
  useEffect(() => {
    setBackgroundId(initialBackground);
  }, [initialBackground, setBackgroundId]);

  const preset = getBackground(backgroundId);
  if (preset.kind === "none") return null;

  const style =
    preset.kind === "image"
      ? {
          backgroundImage: `url(${preset.file})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : { background: preset.css };

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      <div className="absolute inset-0" style={style} />
      {/* Scrim keeps foreground text/cards readable over the wallpaper. */}
      <div className="bg-background/80 absolute inset-0 backdrop-blur-[2px]" />
    </div>
  );
}
