"use client";

import { useState } from "react";
import { CheckIcon, PaletteIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BACKGROUNDS, type BackgroundPreset } from "@/lib/backgrounds";
import { usePreferencesStore } from "@/store/preferences-store";
import { cn } from "@/lib/utils";

function swatchStyle(preset: BackgroundPreset): React.CSSProperties {
  if (preset.kind === "image") {
    return {
      backgroundImage: `url(${preset.file})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  if (preset.kind === "gradient") return { background: preset.css };
  return {};
}

/** Appearance picker (D14) — palette button in the nav, opens a background grid. */
export function BackgroundPicker() {
  const backgroundId = usePreferencesStore((s) => s.backgroundId);
  const setBackgroundId = usePreferencesStore((s) => s.setBackgroundId);
  const [saving, setSaving] = useState(false);

  async function choose(id: string) {
    if (id === backgroundId) return;
    const previous = backgroundId;
    setBackgroundId(id); // optimistic
    setSaving(true);
    try {
      const res = await fetch("/api/me/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ background: id }),
      });
      if (!res.ok) setBackgroundId(previous); // revert on failure
    } catch {
      setBackgroundId(previous);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog>
      <DialogTrigger
        aria-label="Appearance"
        className="text-muted-foreground hover:text-foreground hover:bg-muted/50 focus-visible:ring-ring/50 flex h-8 w-8 shrink-0 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-2"
      >
        <PaletteIcon className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="p-6 sm:max-w-md">
        <DialogTitle>Appearance</DialogTitle>
        <DialogDescription>
          Pick a background. It stays subtle behind your cards.
        </DialogDescription>
        <div
          className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"
          role="radiogroup"
          aria-label="Background"
        >
          {BACKGROUNDS.map((preset) => {
            const active = preset.id === backgroundId;
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={saving}
                onClick={() => choose(preset.id)}
                className={cn(
                  "group relative overflow-hidden rounded-lg border text-left transition-colors disabled:opacity-60",
                  active
                    ? "border-foreground ring-ring ring-2"
                    : "border-border hover:border-foreground/40",
                )}
              >
                <span
                  className={cn(
                    "bg-background block h-16 w-full",
                    preset.kind === "none" &&
                      "from-muted to-background bg-gradient-to-br",
                  )}
                  style={swatchStyle(preset)}
                />
                <span className="block px-2 py-1.5 text-xs font-medium">
                  {preset.label}
                </span>
                {active ? (
                  <span className="bg-foreground text-background absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full">
                    <CheckIcon className="size-3" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
