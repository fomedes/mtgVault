"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SESSION_KEY = "daily-claim-date";

/**
 * Fires POST /api/daily-claim once per calendar day per browser session.
 * sessionStorage persists across in-session navigation (no re-fire on every
 * dashboard mount) and is cleared when the browser tab closes, so the next
 * session tries again (server is still idempotent — the second gate).
 */
export function DailyClaim() {
  const router = useRouter();
  const [bonus, setBonus] = useState(0);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10); // "2026-06-12"

    // Don't fire again if we already attempted a claim today in this session.
    if (sessionStorage.getItem(SESSION_KEY) === today) return;

    // Mark immediately before the fetch so concurrent mounts (Strict Mode)
    // don't both fire.
    sessionStorage.setItem(SESSION_KEY, today);

    fetch("/api/daily-claim", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (d: { claimed: boolean; bonus: number; isFirstTime?: boolean } | null) => {
          if (d?.claimed && d.bonus > 0) {
            setBonus(d.bonus);
            router.refresh();
          }
        },
      )
      .catch(() => undefined);
  }, [router]);

  if (!bonus) return null;

  return (
    <div
      role="status"
      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400"
    >
      +{bonus} Vault Coins — daily bonus claimed!
    </div>
  );
}
