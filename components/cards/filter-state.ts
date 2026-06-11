/**
 * Client-side filter state for the card browser plus (de)serializers for
 * the page URL (shareable views) and the /api/cards query string.
 */

export interface CardFilterState {
  name: string;
  colors: string[]; // W U B R G C
  rarity: string[]; // common | uncommon | rare | mythic
  type: string;
  legal: string;
  cmc: string; // "" | "0".."6" | "7+"
  sort: string; // collector | name | cmc | rarity
}

export const DEFAULT_FILTERS: CardFilterState = {
  name: "",
  colors: [],
  rarity: [],
  type: "",
  legal: "",
  cmc: "",
  sort: "collector",
};

export const COLOR_KEYS = ["W", "U", "B", "R", "G", "C"] as const;
export const RARITY_KEYS = ["common", "uncommon", "rare", "mythic"] as const;
export const CMC_KEYS = ["0", "1", "2", "3", "4", "5", "6", "7+"] as const;
export const SORT_KEYS = ["collector", "name", "cmc", "rarity"] as const;

export function filtersFromSearchParams(
  params: URLSearchParams,
): CardFilterState {
  const colors = (params.get("colors") ?? "")
    .toUpperCase()
    .split("")
    .filter((c) => (COLOR_KEYS as readonly string[]).includes(c));
  const rarity = (params.get("rarity") ?? "")
    .toLowerCase()
    .split(",")
    .filter((r) => (RARITY_KEYS as readonly string[]).includes(r));
  const cmc = params.get("cmc") ?? "";
  const sort = params.get("sort") ?? "collector";
  return {
    name: (params.get("name") ?? "").slice(0, 80),
    colors,
    rarity,
    type: params.get("type") ?? "",
    legal: params.get("legal") ?? "",
    cmc: (CMC_KEYS as readonly string[]).includes(cmc) ? cmc : "",
    sort: (SORT_KEYS as readonly string[]).includes(sort) ? sort : "collector",
  };
}

/** Page URL params — defaults are omitted to keep URLs clean. */
export function filtersToSearchParams(
  filters: CardFilterState,
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.name) params.set("name", filters.name);
  if (filters.colors.length > 0) params.set("colors", filters.colors.join(""));
  if (filters.rarity.length > 0) params.set("rarity", filters.rarity.join(","));
  if (filters.type) params.set("type", filters.type);
  if (filters.legal) params.set("legal", filters.legal);
  if (filters.cmc) params.set("cmc", filters.cmc);
  if (filters.sort !== "collector") params.set("sort", filters.sort);
  return params;
}

/** /api/cards params — the cmc chip expands to a min/max range. */
export function filtersToApiParams(
  filters: CardFilterState,
  set: string,
): URLSearchParams {
  const params = new URLSearchParams({ set });
  if (filters.name) params.set("name", filters.name);
  if (filters.colors.length > 0) params.set("colors", filters.colors.join(""));
  if (filters.rarity.length > 0) params.set("rarity", filters.rarity.join(","));
  if (filters.type) params.set("type", filters.type);
  if (filters.legal) params.set("legal", filters.legal);
  if (filters.cmc === "7+") {
    params.set("cmcMin", "7");
  } else if (filters.cmc) {
    params.set("cmcMin", filters.cmc);
    params.set("cmcMax", filters.cmc);
  }
  params.set("sort", filters.sort);
  return params;
}

export function hasActiveFilters(filters: CardFilterState): boolean {
  return (
    filters.name !== "" ||
    filters.colors.length > 0 ||
    filters.rarity.length > 0 ||
    filters.type !== "" ||
    filters.legal !== "" ||
    filters.cmc !== ""
  );
}
