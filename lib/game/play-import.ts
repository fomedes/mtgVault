/**
 * Import bridge (server-only, impure): turns a deck source — a saved Deck doc or
 * a pasted decklist — into a flat starting library of {cardObjectId, scryfallId}
 * entries consumed by createBoard. Ownership is enforced for saved decks.
 */

import { connectToDatabase } from "@/lib/db";
import { Deck } from "@/lib/models/Deck";
import { Card } from "@/lib/models/Card";
import { parseDecklist } from "@/lib/game/decklist";

export interface LibraryCard {
  cardObjectId: string;
  scryfallId: string;
}

export interface ResolvedLibrary {
  library: LibraryCard[];
  /** Decklist names that could not be matched against the cached Card cache. */
  unknownCards: string[];
}

/** Hard cap on a starting library to bound memory and abuse. */
export const MAX_LIBRARY = 250;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Expand a saved deck (ownership enforced) into a flat library. */
export async function resolveDeckLibrary(
  deckId: string,
  userId: string,
): Promise<ResolvedLibrary> {
  await connectToDatabase();
  const deck = await Deck.findOne({ _id: deckId, userId }).lean();
  if (!deck) return { library: [], unknownCards: [] };

  const library: LibraryCard[] = [];
  for (const entry of deck.cards) {
    for (let i = 0; i < entry.quantity && library.length < MAX_LIBRARY; i++) {
      library.push({
        cardObjectId: entry.cardId.toString(),
        scryfallId: entry.scryfallId,
      });
    }
  }
  return { library, unknownCards: [] };
}

/** Resolve a pasted decklist into a flat library, reporting unmatched names. */
export async function resolveDecklistLibrary(text: string): Promise<ResolvedLibrary> {
  await connectToDatabase();
  const entries = parseDecklist(text);
  if (entries.length === 0) return { library: [], unknownCards: [] };

  // Distinct names (preserve first-seen casing for error reporting).
  const byLower = new Map<string, string>();
  for (const e of entries) {
    const key = e.name.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, e.name);
  }

  const regexes = [...byLower.keys()].map(
    (n) => new RegExp(`^${escapeRegExp(n)}$`, "i"),
  );

  const docs = await Card.find(
    { $or: [{ name: { $in: regexes } }, { "cardFaces.name": { $in: regexes } }] },
    { scryfallId: 1, name: 1, cardFaces: 1, set: 1, collectorNumberValue: 1 },
  )
    .sort({ set: 1, collectorNumberValue: 1 })
    .lean();

  // Build a lowercased-name → first matching printing map (deterministic by sort).
  const printing = new Map<string, { cardObjectId: string; scryfallId: string }>();
  const register = (name: string, doc: (typeof docs)[number]) => {
    const key = name.toLowerCase();
    if (!printing.has(key)) {
      printing.set(key, { cardObjectId: String(doc._id), scryfallId: doc.scryfallId });
    }
  };
  for (const doc of docs) {
    register(doc.name, doc);
    for (const face of doc.cardFaces ?? []) register(face.name, doc);
  }

  const library: LibraryCard[] = [];
  const unknownCards: string[] = [];
  for (const entry of entries) {
    const match = printing.get(entry.name.toLowerCase());
    if (!match) {
      unknownCards.push(entry.name);
      continue;
    }
    for (let i = 0; i < entry.quantity && library.length < MAX_LIBRARY; i++) {
      library.push(match);
    }
  }

  return { library, unknownCards };
}
