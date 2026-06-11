"use client";

import { AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { PackCard, type PackInfo } from "@/components/shop/pack-card";
import { PackOpening } from "@/components/shop/pack-opening";
import type { CardListItemDto } from "@/lib/api/card-dto";

interface ShopData {
  packs: PackInfo[];
  balance: number;
}

interface PurchaseResult {
  cards: CardListItemDto[];
  newBalance: number;
  packCount: number;
}

export function ShopBrowser() {
  const [data, setData] = useState<ShopData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [opening, setOpening] = useState<PurchaseResult | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/shop")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load shop");
        return r.json();
      })
      .then((d: ShopData) => {
        setData(d);
        setIsLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setIsLoading(false);
      });
  }, []);

  async function handleBuy(setCode: string) {
    if (!data) return;
    setBuying(setCode);
    setPurchaseError(null);

    try {
      const res = await fetch("/api/shop/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setCode, quantity: 1 }),
      });
      const body = (await res.json()) as PurchaseResult & { error?: string };

      if (!res.ok) {
        if (body.error === "insufficient_funds") {
          setPurchaseError("Not enough Vault Coins.");
        } else {
          setPurchaseError("Purchase failed. Try again.");
        }
        return;
      }

      setData((prev) =>
        prev ? { ...prev, balance: body.newBalance } : prev,
      );
      setOpening(body);
    } catch {
      setPurchaseError("Purchase failed. Try again.");
    } finally {
      setBuying(null);
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="bg-muted h-36 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-muted-foreground py-16 text-center text-sm">{error}</p>
    );
  }

  if (!data || data.packs.length === 0) {
    return (
      <p className="text-muted-foreground py-16 text-center text-sm">
        No packs available right now.
      </p>
    );
  }

  return (
    <>
      {purchaseError ? (
        <p className="text-destructive text-sm">{purchaseError}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.packs.map((pack) => (
          <PackCard
            key={pack.setCode}
            pack={pack}
            balance={data.balance}
            buying={buying === pack.setCode}
            onBuy={() => handleBuy(pack.setCode)}
          />
        ))}
      </div>

      <AnimatePresence>
        {opening ? (
          <PackOpening
            cards={opening.cards}
            packCount={opening.packCount}
            onClose={() => setOpening(null)}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}
