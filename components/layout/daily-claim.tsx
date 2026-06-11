"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Fires POST /api/daily-claim exactly once per mount (guarded by ref so React
 * Strict Mode double-invoke does not trigger a second claim). If the server
 * awards a bonus it calls router.refresh() so the server-rendered balance
 * on the dashboard updates without a full reload.
 */
export function DailyClaim() {
  const router = useRouter();
  const firedRef = useRef(false);
  const [bonus, setBonus] = useState(0);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    fetch("/api/daily-claim", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (d: { claimed: boolean; bonus: number; isFirstTime?: boolean } | null) => {
          if (d?.claimed && d.bonus > 0) {
            setBonus(d.bonus);
            router.refresh(); // re-fetches server components so balance is current
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
