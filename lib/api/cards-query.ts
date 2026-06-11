import type { QueryFilter } from "mongoose";
import { z } from "zod";
import { RARITIES, type CardDoc } from "@/lib/models/Card";

export type CardFilter = QueryFilter<CardDoc>;

/**
 * Query parsing + Mongo filter construction for GET /api/cards, kept pure
 * so the injection-safety and filter logic are unit-testable (P1-11/P1-12).
 */

export const LEGALITY_FORMATS = [
  "standard",
  "pioneer",
  "modern",
  "legacy",
  "vintage",
  "commander",
  "pauper",
  "brawl",
] as const;

const rarityListSchema = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  )
  .pipe(z.array(z.enum(RARITIES)).min(1).max(RARITIES.length));

const typeTermSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[a-z' -]+$/i, "letters, spaces, hyphens and apostrophes only");

export const cardListQuerySchema = z
  .object({
    set: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]{2,6}$/)
      .optional(),
    name: z.string().trim().min(1).max(80).optional(),
    colors: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[WUBRGC]{1,6}$/)
      .optional(),
    rarity: rarityListSchema.optional(),
    type: typeTermSchema.optional(),
    subtype: typeTermSchema.optional(),
    legal: z.enum(LEGALITY_FORMATS).optional(),
    layout: z
      .string()
      .trim()
      .regex(/^[a-z_]{3,30}$/)
      .optional(),
    cmcMin: z.coerce.number().int().min(0).max(30).optional(),
    cmcMax: z.coerce.number().int().min(0).max(30).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    pageSize: z.coerce.number().int().min(6).max(100).default(60),
    sort: z.enum(["collector", "name", "cmc", "rarity"]).default("collector"),
  })
  .refine(
    (query) =>
      query.cmcMin === undefined ||
      query.cmcMax === undefined ||
      query.cmcMin <= query.cmcMax,
    { message: "cmcMin must not exceed cmcMax", path: ["cmcMin"] },
  );

export type CardListQuery = z.infer<typeof cardListQuerySchema>;

/** User text only ever reaches Mongo as an escaped, literal regex. */
export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildCardFilter(query: CardListQuery): CardFilter {
  // Built loosely typed (dynamic `legalities.<format>` keys defeat the strict
  // filter type), cast once on return; every value is whitelisted or escaped.
  const filter: Record<string, unknown> = {};

  if (query.set) filter.set = query.set;
  if (query.name) {
    filter.name = { $regex: escapeRegExp(query.name), $options: "i" };
  }

  if (query.colors) {
    const letters = Array.from(new Set(query.colors.split("")));
    const colored = letters.filter((letter) => letter !== "C");
    const clauses: Record<string, unknown>[] = [];
    if (colored.length > 0) clauses.push({ colorIdentity: { $in: colored } });
    if (letters.includes("C")) clauses.push({ colorIdentity: { $size: 0 } });
    if (clauses.length === 1) Object.assign(filter, clauses[0]);
    else if (clauses.length > 1) filter.$or = clauses;
  }

  if (query.rarity) filter.rarity = { $in: query.rarity };

  const typeTerms = [query.type, query.subtype].filter(
    (term): term is string => !!term,
  );
  if (typeTerms.length === 1) {
    filter.typeLine = { $regex: escapeRegExp(typeTerms[0]), $options: "i" };
  } else if (typeTerms.length === 2) {
    filter.$and = typeTerms.map((term) => ({
      typeLine: { $regex: escapeRegExp(term), $options: "i" },
    }));
  }

  // `legal` comes from the LEGALITY_FORMATS enum, so the key is never user-shaped.
  if (query.legal) filter[`legalities.${query.legal}`] = "legal";
  if (query.layout) filter.layout = query.layout;

  if (query.cmcMin !== undefined || query.cmcMax !== undefined) {
    const cmc: Record<string, number> = {};
    if (query.cmcMin !== undefined) cmc.$gte = query.cmcMin;
    if (query.cmcMax !== undefined) cmc.$lte = query.cmcMax;
    filter.cmc = cmc;
  }

  return filter as CardFilter;
}

export function buildCardSort(
  sort: CardListQuery["sort"],
): Record<string, 1 | -1> {
  switch (sort) {
    case "name":
      return { name: 1, collectorNumberValue: 1 };
    case "cmc":
      return { cmc: 1, name: 1 };
    case "rarity":
      return { rarityValue: -1, collectorNumberValue: 1 };
    default:
      return { set: 1, collectorNumberValue: 1, collectorNumber: 1 };
  }
}
