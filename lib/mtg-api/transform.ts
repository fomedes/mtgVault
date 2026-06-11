import { RARITY_VALUES, type Rarity } from "@/lib/models/Card";
import type {
  ScryfallCard,
  ScryfallCardFace,
  ScryfallImageUris,
  ScryfallSet,
} from "@/lib/mtg-api/types";

/** Pure Scryfall → Mongoose document mappers, kept I/O-free for unit tests. */

function toImageUris(uris: ScryfallImageUris | undefined) {
  if (!uris) return undefined;
  return {
    small: uris.small,
    normal: uris.normal,
    large: uris.large,
    png: uris.png,
    artCrop: uris.art_crop,
    borderCrop: uris.border_crop,
  };
}

function toCardFace(face: ScryfallCardFace) {
  return {
    name: face.name,
    manaCost: face.mana_cost ?? "",
    typeLine: face.type_line ?? "",
    oracleText: face.oracle_text ?? "",
    flavorText: face.flavor_text ?? "",
    colors: face.colors ?? [],
    power: face.power,
    toughness: face.toughness,
    loyalty: face.loyalty,
    imageUris: toImageUris(face.image_uris),
  };
}

/** "123a" → 123; tokens without a numeric prefix sort last. */
export function parseCollectorNumber(collectorNumber: string): number {
  const match = /^\d+/.exec(collectorNumber);
  return match ? Number.parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER;
}

export function toCardDocument(card: ScryfallCard, cachedAt: Date) {
  // DFC layouts carry colors only on their faces; aggregate the union.
  const colors =
    card.colors ??
    Array.from(new Set((card.card_faces ?? []).flatMap((f) => f.colors ?? [])));

  return {
    scryfallId: card.id,
    oracleId: card.oracle_id ?? "",
    name: card.name,
    set: card.set.toLowerCase(),
    collectorNumber: card.collector_number,
    collectorNumberValue: parseCollectorNumber(card.collector_number),
    rarity: card.rarity,
    rarityValue: RARITY_VALUES[card.rarity as Rarity] ?? 1,
    colors,
    colorIdentity: card.color_identity ?? [],
    typeLine: card.type_line ?? "",
    manaCost: card.mana_cost ?? "",
    cmc: card.cmc ?? 0,
    oracleText: card.oracle_text ?? "",
    flavorText: card.flavor_text ?? "",
    power: card.power,
    toughness: card.toughness,
    loyalty: card.loyalty,
    imageUris: toImageUris(card.image_uris),
    cardFaces: (card.card_faces ?? []).map(toCardFace),
    layout: card.layout,
    legalities: card.legalities ?? {},
    inBooster: card.booster ?? false,
    cachedAt,
  };
}

export function toSetDocument(set: ScryfallSet, cachedAt: Date) {
  return {
    code: set.code.toLowerCase(),
    name: set.name,
    scryfallId: set.id,
    setType: set.set_type,
    cardCount: set.card_count,
    releasedAt: set.released_at ? new Date(set.released_at) : undefined,
    iconSvgUri: set.icon_svg_uri ?? "",
    cachedAt,
  };
}
