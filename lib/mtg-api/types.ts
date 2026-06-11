/**
 * Subset of Scryfall's API objects that MTG Vault consumes.
 * Field names mirror Scryfall's snake_case wire format; `transform.ts`
 * maps them onto our camelCase Mongoose documents.
 * Reference: https://scryfall.com/docs/api
 */

export interface ScryfallImageUris {
  small?: string;
  normal?: string;
  large?: string;
  png?: string;
  art_crop?: string;
  border_crop?: string;
}

export interface ScryfallCardFace {
  name: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  flavor_text?: string;
  colors?: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  image_uris?: ScryfallImageUris;
}

export type ScryfallRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "mythic"
  | "special"
  | "bonus";

export interface ScryfallCard {
  id: string;
  oracle_id?: string;
  name: string;
  set: string;
  set_name?: string;
  collector_number: string;
  rarity: ScryfallRarity;
  layout: string;
  colors?: string[];
  color_identity: string[];
  type_line?: string;
  mana_cost?: string;
  cmc?: number;
  oracle_text?: string;
  flavor_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  image_uris?: ScryfallImageUris;
  card_faces?: ScryfallCardFace[];
  legalities?: Record<string, string>;
  booster?: boolean;
}

export interface ScryfallSet {
  id: string;
  code: string;
  name: string;
  set_type: string;
  card_count: number;
  released_at?: string;
  icon_svg_uri?: string;
  digital?: boolean;
}

export interface ScryfallRuling {
  oracle_id?: string;
  source: string;
  published_at: string;
  comment: string;
}

export interface ScryfallList<T> {
  object: "list";
  data: T[];
  has_more: boolean;
  next_page?: string;
  total_cards?: number;
}

export interface ScryfallErrorBody {
  object: "error";
  code: string;
  status: number;
  details: string;
}
