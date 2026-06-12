import { connectToDatabase } from "@/lib/db";
import { Deck, isBasicLand, type DeckCategory, type DeckDoc, type DeckCardEntry } from "@/lib/models/Deck";
import { UserCollection } from "@/lib/models/UserCollection";
import { Card } from "@/lib/models/Card";
import { deckCardToDto, type DeckDetailDto, type DeckSummaryDto } from "@/lib/api/deck-dto";
import type { Types } from "mongoose";

type CardSeedEntry = {
  cardId: Types.ObjectId;
  scryfallId: string;
  name: string;
  manaCost: string;
  typeLine: string;
  colors: string[];
  colorIdentity: string[];
  rarity: string;
  imageUris?: { small?: string | null; normal?: string | null };
  quantity: number;
};

/** Build an owned-quantity map keyed by cardId string for a user. */
async function getOwnedMap(userId: string): Promise<Map<string, number>> {
  const coll = await UserCollection.findOne({ userId }, { cards: 1 }).lean();
  if (!coll) return new Map();
  return new Map(
    coll.cards.map((e) => [e.cardId.toString(), e.quantity]),
  );
}

type DeckLike = {
  sourceDraftId?: string | null | undefined;
  cards: Pick<DeckCardEntry, "typeLine" | "cardId" | "quantity">[];
};

/** Compute category from a deck doc + owned map. */
export function computeCategory(
  deck: DeckLike,
  ownedMap: Map<string, number>,
): DeckCategory {
  if (deck.sourceDraftId) return "draft";

  const nonBasic = deck.cards.filter((c) => !isBasicLand(c.typeLine));
  if (nonBasic.length === 0) return "complete";

  const allOwned = nonBasic.every((c) => {
    const owned = ownedMap.get(c.cardId.toString()) ?? 0;
    return owned >= c.quantity;
  });
  return allOwned ? "complete" : "wishlist";
}

/** Extract the dominant color identity from all cards in a deck. */
function deckColors(deck: { cards: Pick<DeckCardEntry, "colorIdentity">[] }): string[] {
  const seen = new Set<string>();
  for (const card of deck.cards) {
    for (const c of card.colorIdentity) seen.add(c);
  }
  const ORDER = ["W", "U", "B", "R", "G"];
  return ORDER.filter((c) => seen.has(c));
}

export async function getDeckSummaries(userId: string): Promise<DeckSummaryDto[]> {
  await connectToDatabase();
  const [decks, ownedMap] = await Promise.all([
    Deck.find({ userId }).sort({ updatedAt: -1 }).lean(),
    getOwnedMap(userId),
  ]);

  return decks.map((deck) => ({
    id: deck._id.toString(),
    name: deck.name,
    cardCount: deck.cards.reduce((s, c) => s + c.quantity, 0),
    category: computeCategory(deck, ownedMap),
    sourceDraftId: deck.sourceDraftId ?? undefined,
    colors: deckColors(deck),
    createdAt: (deck.createdAt as Date).toISOString(),
    updatedAt: (deck.updatedAt as Date).toISOString(),
  }));
}

export async function getDeckDetail(
  deckId: string,
  userId: string,
): Promise<DeckDetailDto | null> {
  await connectToDatabase();
  const deck = await Deck.findOne({ _id: deckId, userId }).lean();
  if (!deck) return null;

  const ownedMap = await getOwnedMap(userId);
  const category = computeCategory(deck, ownedMap);

  const cards = deck.cards.map((entry) => {
    const ownedQty = isBasicLand(entry.typeLine)
      ? entry.quantity          // basic lands always "owned enough"
      : (ownedMap.get(entry.cardId.toString()) ?? 0);
    return deckCardToDto(entry, ownedQty);
  });

  return {
    id: deck._id.toString(),
    name: deck.name,
    cardCount: deck.cards.reduce((s, c) => s + c.quantity, 0),
    category,
    sourceDraftId: deck.sourceDraftId ?? undefined,
    colors: deckColors(deck),
    createdAt: (deck.createdAt as Date).toISOString(),
    updatedAt: (deck.updatedAt as Date).toISOString(),
    cards,
  };
}

export interface CreateDeckInput {
  name: string;
  sourceDraftId?: string;
  /** Card ObjectId strings to seed. Duplicates accumulate quantity. */
  cardIds?: string[];
}

export async function createDeck(
  userId: string,
  input: CreateDeckInput,
): Promise<DeckDetailDto> {
  await connectToDatabase();

  const seedCards: CardSeedEntry[] = [];
  if (input.cardIds && input.cardIds.length > 0) {
    const uniqueIds = [...new Set(input.cardIds)];
    const countMap = new Map<string, number>();
    for (const id of input.cardIds) {
      countMap.set(id, (countMap.get(id) ?? 0) + 1);
    }
    const cardDocs = await Card.find({ _id: { $in: uniqueIds } }).lean();
    for (const c of cardDocs) {
      seedCards.push({
        cardId: c._id as Types.ObjectId,
        scryfallId: c.scryfallId,
        name: c.name,
        manaCost: c.manaCost,
        typeLine: c.typeLine,
        colors: c.colors,
        colorIdentity: c.colorIdentity,
        rarity: c.rarity,
        imageUris: c.imageUris
          ? { small: c.imageUris.small, normal: c.imageUris.normal }
          : undefined,
        quantity: countMap.get(c._id.toString()) ?? 1,
      });
    }
  }

  const deck = await Deck.create({
    userId,
    name: input.name,
    cards: seedCards,
    sourceDraftId: input.sourceDraftId,
  });

  const result = await getDeckDetail(deck._id.toString(), userId);
  return result!;
}

export interface PatchDeckInput {
  name?: string;
  /** Add a card by its Scryfall ID. Increments quantity if already present. */
  addCardScryfallId?: string;
  /** Remove one copy of a card by scryfallId. Removes entry when qty reaches 0. */
  removeCardScryfallId?: string;
  /** Set quantity of a card directly by scryfallId (0 = remove). */
  setCardQty?: { scryfallId: string; quantity: number };
}

export async function patchDeck(
  deckId: string,
  userId: string,
  input: PatchDeckInput,
): Promise<DeckDetailDto | null> {
  await connectToDatabase();
  const deck = await Deck.findOne({ _id: deckId, userId });
  if (!deck) return null;

  if (input.name !== undefined) deck.name = input.name;

  if (input.addCardScryfallId) {
    const cardDoc = await Card.findOne({ scryfallId: input.addCardScryfallId }).lean();
    if (cardDoc) {
      const existing = deck.cards.find(
        (c) => c.scryfallId === input.addCardScryfallId,
      );
      if (existing) {
        existing.quantity += 1;
      } else {
        deck.cards.push({
          cardId: cardDoc._id as Types.ObjectId,
          scryfallId: cardDoc.scryfallId,
          name: cardDoc.name,
          manaCost: cardDoc.manaCost,
          typeLine: cardDoc.typeLine,
          colors: cardDoc.colors,
          colorIdentity: cardDoc.colorIdentity,
          rarity: cardDoc.rarity,
          imageUris: cardDoc.imageUris
            ? { small: cardDoc.imageUris.small, normal: cardDoc.imageUris.normal }
            : undefined,
          quantity: 1,
        });
      }
    }
  }

  if (input.removeCardScryfallId) {
    const idx = deck.cards.findIndex(
      (c) => c.scryfallId === input.removeCardScryfallId,
    );
    if (idx !== -1) {
      deck.cards[idx].quantity -= 1;
      if (deck.cards[idx].quantity <= 0) deck.cards.splice(idx, 1);
    }
  }

  if (input.setCardQty) {
    const { scryfallId, quantity } = input.setCardQty;
    const idx = deck.cards.findIndex((c) => c.scryfallId === scryfallId);
    if (idx !== -1) {
      if (quantity <= 0) {
        deck.cards.splice(idx, 1);
      } else {
        deck.cards[idx].quantity = quantity;
      }
    }
  }

  await deck.save();
  return getDeckDetail(deckId, userId);
}
