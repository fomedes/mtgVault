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

/** Comma-separated set codes, max 20 entries. */
const setsListSchema = z
  .string()
  .transform((v) =>
    v
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
  .pipe(
    z
      .array(z.string().regex(/^[a-z0-9]{2,6}$/))
      .min(1)
      .max(20),
  );

/** Numeric power/toughness value: 0–20. */
const ptValueSchema = z.coerce.number().int().min(0).max(20);

export const cardListQuerySchema = z
  .object({
    /** Single set code (card browser). */
    set: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]{2,6}$/)
      .optional(),
    /** Comma-separated set codes (deck builder advanced filter). */
    sets: setsListSchema.optional(),
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
    /** Power numeric value (0–20). */
    power: ptValueSchema.optional(),
    /** "eq" = exact match (default), "gte" = at least N. */
    powerOp: z.enum(["eq", "gte"]).default("eq"),
    /** Toughness numeric value (0–20). */
    toughness: ptValueSchema.optional(),
    toughnessOp: z.enum(["eq", "gte"]).default("eq"),
    /** When true, the route filters to cards the authenticated user owns. */
    ownedOnly: z.coerce.boolean().default(false),
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

export function buildCardFilter(
  query: CardListQuery,
  /** MongoDB ObjectId strings for cards the user owns (for ownedOnly filter). */
  ownedCardIds?: string[],
): CardFilter {
  // Built loosely typed (dynamic `legalities.<format>` keys defeat the strict
  // filter type), cast once on return; every value is whitelisted or escaped.
  const filter: Record<string, unknown> = {};

  // `sets` (multi) takes priority over singular `set`.
  if (query.sets && query.sets.length > 0) {
    filter.set = { $in: query.sets };
  } else if (query.set) {
    filter.set = query.set;
  }

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

  // Power / toughness — numeric comparison via $expr/$toDouble so "*" strings
  // never match numeric predicates; non-numeric fields evaluate to null → false.
  if (query.power !== undefined) {
    if (query.powerOp === "gte") {
      filter.$expr = {
        ...(filter.$expr as object | undefined),
        $gte: [{ $toDouble: { $ifNull: ["$power", "-1"] } }, query.power],
      };
    } else {
      filter.power = String(query.power);
    }
  }
  if (query.toughness !== undefined) {
    if (query.toughnessOp === "gte") {
      const existing = filter.$expr as Record<string, unknown> | undefined;
      // Merge toughness into existing $expr if power already set one.
      filter.$expr = existing
        ? { $and: [existing, { $gte: [{ $toDouble: { $ifNull: ["$toughness", "-1"] } }, query.toughness] }] }
        : { $gte: [{ $toDouble: { $ifNull: ["$toughness", "-1"] } }, query.toughness] };
    } else {
      filter.toughness = String(query.toughness);
    }
  }

  // ownedOnly: caller resolves the user's card ObjectIds server-side.
  if (query.ownedOnly && ownedCardIds) {
    filter._id = { $in: ownedCardIds };
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
