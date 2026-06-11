import type { Types } from "mongoose";
import { toCardListItem, type CardListItemDto } from "@/lib/api/card-dto";
import type { CardDoc } from "@/lib/models/Card";
import type { CollectionEntry } from "@/lib/models/UserCollection";

export type ObtainedVia = "admin" | "draft" | "shop";

export interface CollectionEntryDto {
  cardId: string;
  quantity: number;
  obtainedVia: ObtainedVia[];
  firstObtainedAt: string;
  lastObtainedAt: string;
  card: CardListItemDto;
}

export function toCollectionEntryDto(
  entry: CollectionEntry,
  card: CardDoc,
): CollectionEntryDto {
  return {
    cardId: (entry.cardId as Types.ObjectId).toString(),
    quantity: entry.quantity,
    obtainedVia: entry.obtainedVia as ObtainedVia[],
    firstObtainedAt: entry.firstObtainedAt.toISOString(),
    lastObtainedAt: entry.lastObtainedAt.toISOString(),
    card: toCardListItem(card),
  };
}

/** Plain-text export line ("4x Lightning Bolt"). */
export function toTextLine(entry: CollectionEntryDto): string {
  return `${entry.quantity}x ${entry.card.name}`;
}

/** MTGO export line ("4 Lightning Bolt"). */
export function toMtgoLine(entry: CollectionEntryDto): string {
  return `${entry.quantity} ${entry.card.name}`;
}
