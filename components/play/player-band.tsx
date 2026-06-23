"use client";

import { ReactNode } from "react";

export function PlayerBand({
  seat,
  isMe,
  children,
}: {
  seat: number;
  isMe: boolean;
  children: ReactNode;
}) {
  return (
    <div
      data-seat={seat}
      style={!isMe ? { transform: "rotate(180deg)" } : undefined}
      className={`flex flex-col gap-3 rounded-lg border p-4 ${
        isMe
          ? "border-border bg-muted/20"
          : "border-border bg-muted/10"
      }`}
    >
      {children}
    </div>
  );
}
