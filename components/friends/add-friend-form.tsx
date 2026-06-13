"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";

interface AddFriendFormProps {
  onRequestSent?: () => void;
}

/** Format a raw digit string as "XXXX-XXXX" while typing. */
function formatInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

export function AddFriendForm({ onRequestSent }: AddFriendFormProps) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue(formatInput(e.target.value));
    setStatus("idle");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const digits = value.replace(/\D/g, "");
    if (digits.length !== 8) return;

    setBusy(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendCode: digits }),
      });
      if (res.ok) {
        setStatus("sent");
        setValue("");
        onRequestSent?.();
      } else if (res.status === 429) {
        setStatus("error");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  const digits = value.replace(/\D/g, "");

  return (
    <div className="bg-card rounded-lg border p-5 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Add a Friend
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="space-y-1">
          <label htmlFor="friend-code-input" className="text-sm font-medium">
            Enter their 8-digit code
          </label>
          <input
            ref={inputRef}
            id="friend-code-input"
            type="text"
            inputMode="numeric"
            value={value}
            onChange={handleChange}
            placeholder="1234-5678"
            maxLength={9}
            className="border-input bg-background h-9 w-full rounded-lg border px-3 font-mono text-sm tracking-widest"
          />
        </div>

        {status === "sent" && (
          <p className="text-sm text-green-500">
            Request sent! If the code is valid, your friend will be notified.
          </p>
        )}
        {status === "error" && (
          <p className="text-sm text-destructive">
            Something went wrong. Please try again.
          </p>
        )}

        <Button
          type="submit"
          disabled={busy || digits.length !== 8}
          size="sm"
          className="w-full sm:w-auto"
        >
          {busy ? "Sending…" : "Send request"}
        </Button>
      </form>
    </div>
  );
}
