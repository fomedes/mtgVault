"use client";

import { motion } from "motion/react";
import { RefreshCwIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { CardImage } from "@/components/cards/card-image";
import { ManaCost } from "@/components/cards/mana-cost";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCardAnimations } from "@/lib/animations/card";
import type { CardDetailDto, CardFaceDto } from "@/lib/api/card-dto";
import type { RulingEntry } from "@/lib/mtg-api/rulings";

interface CardDetailResponse {
  card: CardDetailDto;
  rulings: RulingEntry[];
}

function OracleText({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="space-y-1.5">
      {text.split("\n").map((paragraph, index) => (
        <p key={index} className="text-sm leading-snug">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

function FaceDetails({ face }: { face: CardFaceDto }) {
  return (
    <section className="space-y-1.5">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{face.name}</h3>
        <ManaCost cost={face.manaCost} />
      </header>
      <p className="text-muted-foreground text-xs">{face.typeLine}</p>
      <OracleText text={face.oracleText} />
      {face.flavorText ? (
        <p className="text-muted-foreground text-xs italic">
          {face.flavorText}
        </p>
      ) : null}
      {face.power && face.toughness ? (
        <p className="text-sm font-semibold">
          {face.power}/{face.toughness}
        </p>
      ) : null}
      {face.loyalty ? (
        <p className="text-sm font-semibold">Loyalty {face.loyalty}</p>
      ) : null}
    </section>
  );
}

/** A card is flippable when both faces carry their own imagery (DFC). */
function isFlippable(card: CardDetailDto): boolean {
  return (
    card.cardFaces.length >= 2 &&
    card.cardFaces.slice(0, 2).every((face) => face.imageUris?.normal)
  );
}

function FlippableArt({ card }: { card: CardDetailDto }) {
  const { cardFlip } = useCardAnimations();
  const [showBack, setShowBack] = useState(false);
  const [front, back] = card.cardFaces;

  if (!isFlippable(card)) {
    const image = card.imageUris ?? card.cardFaces[0]?.imageUris;
    return (
      <CardImage
        name={card.name}
        imageUrl={image?.large ?? image?.normal}
        manaCost={card.manaCost}
        typeLine={card.typeLine}
        colorIdentity={card.colorIdentity}
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="aspect-5/7 w-full" style={{ perspective: 1200 }}>
        <motion.div
          data-testid="dfc-flipper"
          variants={cardFlip}
          initial={false}
          animate={showBack ? "back" : "front"}
          className="relative size-full"
          style={{ transformStyle: "preserve-3d" }}
        >
          <div
            className="absolute inset-0"
            style={{ backfaceVisibility: "hidden" }}
          >
            <CardImage
              name={front.name}
              imageUrl={front.imageUris?.large ?? front.imageUris?.normal}
              manaCost={front.manaCost}
              typeLine={front.typeLine}
              colorIdentity={card.colorIdentity}
            />
          </div>
          <div
            className="absolute inset-0"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <CardImage
              name={back.name}
              imageUrl={back.imageUris?.large ?? back.imageUris?.normal}
              manaCost={back.manaCost}
              typeLine={back.typeLine}
              colorIdentity={card.colorIdentity}
            />
          </div>
        </motion.div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => setShowBack((value) => !value)}
      >
        <RefreshCwIcon data-icon="inline-start" />
        Flip card
      </Button>
    </div>
  );
}

interface FetchResult {
  id: string;
  data?: CardDetailResponse;
  failed?: boolean;
}

export function CardDetailModal({
  cardId,
  onClose,
}: {
  cardId: string | null;
  onClose: () => void;
}) {
  // Keyed by card id so stale results are ignored instead of reset in the effect.
  const [result, setResult] = useState<FetchResult | null>(null);

  useEffect(() => {
    if (!cardId) return;
    const controller = new AbortController();
    fetch(`/api/cards/${cardId}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<CardDetailResponse>;
      })
      .then((data) => setResult({ id: cardId, data }))
      .catch(() => {
        if (!controller.signal.aborted) setResult({ id: cardId, failed: true });
      });
    return () => controller.abort();
  }, [cardId]);

  const current = result?.id === cardId ? result : null;
  const detail = current?.data ?? null;
  const error = !!current?.failed;
  const card = detail?.card;

  return (
    <Dialog open={!!cardId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="p-5 sm:p-6">
        {error ? (
          <div className="py-10 text-center">
            <DialogTitle>Card unavailable</DialogTitle>
            <DialogDescription>
              Something went wrong loading this card. Close and try again.
            </DialogDescription>
          </div>
        ) : !card ? (
          <div className="flex flex-col gap-4 sm:flex-row" aria-busy>
            <div className="bg-muted aspect-5/7 w-full max-w-72 animate-pulse self-center rounded-[4.75%/3.43%] sm:self-start" />
            <div className="flex-1 space-y-3 py-1">
              <DialogTitle className="sr-only">Loading card…</DialogTitle>
              <div className="bg-muted h-5 w-2/3 animate-pulse rounded" />
              <div className="bg-muted h-4 w-1/3 animate-pulse rounded" />
              <div className="bg-muted h-24 w-full animate-pulse rounded" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="w-full max-w-72 shrink-0 self-center sm:self-start">
              <FlippableArt card={card} />
            </div>
            <div className="min-w-0 flex-1 space-y-4 pr-6">
              <header className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <DialogTitle>{card.name}</DialogTitle>
                  <ManaCost cost={card.manaCost} />
                </div>
                <DialogDescription>
                  {card.typeLine} · {card.set.toUpperCase()} #
                  {card.collectorNumber} ·{" "}
                  <span className="capitalize">{card.rarity}</span>
                </DialogDescription>
              </header>

              {card.cardFaces.length >= 2 ? (
                <div className="space-y-4">
                  {card.cardFaces.map((face) => (
                    <FaceDetails key={face.name} face={face} />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <OracleText text={card.oracleText} />
                  {card.flavorText ? (
                    <p className="text-muted-foreground text-xs italic">
                      {card.flavorText}
                    </p>
                  ) : null}
                  {card.power && card.toughness ? (
                    <p className="text-sm font-semibold">
                      {card.power}/{card.toughness}
                    </p>
                  ) : null}
                  {card.loyalty ? (
                    <p className="text-sm font-semibold">
                      Loyalty {card.loyalty}
                    </p>
                  ) : null}
                </div>
              )}

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Rulings</h3>
                {detail.rulings.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    No rulings for this card.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {detail.rulings.map((ruling, index) => (
                      <li key={index} className="text-xs leading-snug">
                        <span className="text-muted-foreground">
                          {ruling.publishedAt}
                        </span>{" "}
                        — {ruling.comment}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
