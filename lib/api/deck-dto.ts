import type { DeckCardEntry, DeckCategory } from "@/lib/models/Deck";

/** Pure helper — safe for both server and client bundles. */
export function isBasicLand(typeLine: string): boolean {
  return typeLine.startsWith("Basic Land");
}

export interface DeckCardDto {
  scryfallId: string;
  name: string;
  manaCost: string;
  typeLine: string;
  colors: string[];
  colorIdentity: string[];
  rarity: string;
  cmc: number;
  imageUris?: { small?: string; normal?: string };
  quantity: number;
  /** Quantity the user currently owns (null = not yet resolved). */
  ownedQty: number;
}

export interface DeckSummaryDto {
  id: string;
  name: string;
  cardCount: number;
  category: DeckCategory;
  sourceDraftId?: string;
  colors: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DeckDetailDto extends DeckSummaryDto {
  cards: DeckCardDto[];
}

export function deckCardToDto(
  entry: DeckCardEntry,
  ownedQty: number,
): DeckCardDto {
  return {
    scryfallId: entry.scryfallId,
    name: entry.name,
    manaCost: entry.manaCost,
    typeLine: entry.typeLine,
    colors: entry.colors,
    colorIdentity: entry.colorIdentity,
    rarity: entry.rarity,
    cmc: entry.cmc ?? 0,
    imageUris: entry.imageUris
      ? {
          small: entry.imageUris.small ?? undefined,
          normal: entry.imageUris.normal ?? undefined,
        }
      : undefined,
    quantity: entry.quantity,
    ownedQty,
  };
}
