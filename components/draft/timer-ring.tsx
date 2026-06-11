"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const RADIUS = 18;
const CIRC = 2 * Math.PI * RADIUS;

export function TimerRing({
  expiresAt,
  totalMs,
  className,
}: {
  expiresAt: number | null;
  totalMs: number;
  className?: string;
}) {
  const [remaining, setRemaining] = useState(totalMs);

  useEffect(() => {
    if (!expiresAt) return;
    // Never call setRemaining synchronously — always defer to the interval.
    const id = setInterval(() => {
      setRemaining(Math.max(0, expiresAt - Date.now()));
    }, 200);
    return () => clearInterval(id);
  }, [expiresAt]);

  const frac = totalMs > 0 ? Math.min(1, remaining / totalMs) : 1;
  const strokeDash = frac * CIRC;
  const urgent = frac < 0.25;
  const seconds = Math.ceil(remaining / 1000);

  return (
    <svg
      width={44}
      height={44}
      viewBox="0 0 44 44"
      className={cn("rotate-[-90deg]", className)}
      aria-label={`${seconds}s remaining`}
      role="img"
    >
      <circle cx={22} cy={22} r={RADIUS} fill="none" strokeWidth={3} className="stroke-muted" />
      <circle
        cx={22}
        cy={22}
        r={RADIUS}
        fill="none"
        strokeWidth={3}
        strokeDasharray={`${strokeDash} ${CIRC}`}
        strokeLinecap="round"
        className={urgent ? "stroke-destructive" : "stroke-primary"}
      />
      <text
        x={22}
        y={22}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground font-mono"
        transform="rotate(90, 22, 22)"
        style={{ fontSize: 10 }}
      >
        {seconds}
      </text>
    </svg>
  );
}
