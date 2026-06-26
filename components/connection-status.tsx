"use client";

import { Loader2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { retryConnection } from "@/hooks/use-socket";
import { useConnectionStore } from "@/store/connection-store";
import { cn } from "@/lib/utils";

/**
 * Surfaces the shared socket's connection state so a failed handshake (CORS,
 * expired token, server unreachable) never presents as a silent, infinite
 * "Connecting…". Renders nothing once connected.
 */
export function ConnectionStatus({ className }: { className?: string }) {
  const status = useConnectionStore((s) => s.status);
  const error = useConnectionStore((s) => s.error);

  if (status === "connected") return null;

  if (status === "error") {
    return (
      <div
        role="alert"
        className={cn(
          "border-border bg-card flex items-center gap-3 rounded-md border border-red-500/40 p-3 text-sm",
          className,
        )}
      >
        <WifiOff className="size-4 shrink-0 text-red-500" />
        <span className="flex-1 text-red-500">
          {error ?? "Connection error"}
        </span>
        <Button size="sm" variant="secondary" onClick={retryConnection}>
          Retry
        </Button>
      </div>
    );
  }

  // idle / connecting
  return (
    <div
      className={cn(
        "text-muted-foreground flex items-center gap-2 text-xs",
        className,
      )}
    >
      <Loader2 className="size-3.5 animate-spin" />
      <span>Connecting to the server…</span>
    </div>
  );
}
