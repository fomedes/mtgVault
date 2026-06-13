import type { CardDoc } from "@/lib/models/Card";

/** Wire shapes for the card browser API — only what the UI consumes. */

export interface ImageUrisDto {
  small?: string;
  normal?: string;
  large?: string;
  artCrop?: string;
}

export interface CardFaceDto {
  name: string;
  manaCost: string;
  typeLine: string;
  oracleText: string;
  flavorText: string;
  colors: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  imageUris?: ImageUrisDto;
}

export interface CardListItemDto {
  scryfallId: string;
  name: string;
  set: string;
  collectorNumber: string;
  rarity: string;
  manaCost: string;
  typeLine: string;
  colors: string[];
  colorIdentity: string[];
  layout: string;
  cmc: number;
  oracleText: string;
  imageUris?: ImageUrisDto;
  cardFaces: CardFaceDto[];
}

export interface CardDetailDto extends CardListItemDto {
  // oracleText and cmc are now on CardListItemDto; kept here as type aliases
  // for consumers that reference CardDetailDto specifically.
  flavorText: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  legalities: Record<string, string>;
}

type LeanImageUris = NonNullable<CardDoc["imageUris"]>;

function toImageUrisDto(uris: LeanImageUris | null | undefined) {
  if (!uris) return undefined;
  return {
    small: uris.small ?? undefined,
    normal: uris.normal ?? undefined,
    large: uris.large ?? undefined,
    artCrop: uris.artCrop ?? undefined,
  };
}

function toCardFaceDto(face: CardDoc["cardFaces"][number]): CardFaceDto {
  return {
    name: face.name,
    manaCost: face.manaCost,
    typeLine: face.typeLine,
    oracleText: face.oracleText,
    flavorText: face.flavorText,
    colors: face.colors,
    power: face.power ?? undefined,
    toughness: face.toughness ?? undefined,
    loyalty: face.loyalty ?? undefined,
    imageUris: toImageUrisDto(face.imageUris),
  };
}

export function toCardListItem(card: CardDoc): CardListItemDto {
  return {
    scryfallId: card.scryfallId,
    name: card.name,
    set: card.set,
    collectorNumber: card.collectorNumber,
    rarity: card.rarity,
    manaCost: card.manaCost,
    typeLine: card.typeLine,
    colors: card.colors,
    colorIdentity: card.colorIdentity,
    layout: card.layout,
    cmc: card.cmc,
    oracleText: card.oracleText,
    imageUris: toImageUrisDto(card.imageUris),
    cardFaces: card.cardFaces.map(toCardFaceDto),
  };
}

export function toCardDetail(card: CardDoc): CardDetailDto {
  // lean() returns Map fields as plain objects; hydrated docs return Maps.
  const legalities =
    card.legalities instanceof Map
      ? Object.fromEntries(card.legalities)
      : ((card.legalities ?? {}) as unknown as Record<string, string>);

  return {
    ...toCardListItem(card),
    // oracleText and cmc are already included via toCardListItem.
    flavorText: card.flavorText,
    power: card.power ?? undefined,
    toughness: card.toughness ?? undefined,
    loyalty: card.loyalty ?? undefined,
    legalities,
  };
}
