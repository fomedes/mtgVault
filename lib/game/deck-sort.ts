import type { DeckCardDto } from "@/lib/api/deck-dto";

export const TYPE_GROUPS = [
  {
    key: "Creatures",
    label: "Creatures",
    test: (tl: string) =>
      /\bCreature\b/i.test(tl) &&
      !/\bArtifact\b/i.test(tl) &&
      !/\bEnchantment\b/i.test(tl),
  },
  { key: "Instants", label: "Instants", test: (tl: string) => /\bInstant\b/i.test(tl) },
  { key: "Sorceries", label: "Sorceries", test: (tl: string) => /\bSorcery\b/i.test(tl) },
  { key: "Artifacts", label: "Artifacts", test: (tl: string) => /\bArtifact\b/i.test(tl) },
  {
    key: "Enchantments",
    label: "Enchantments",
    test: (tl: string) => /\bEnchantment\b/i.test(tl),
  },
  {
    key: "Planeswalkers",
    label: "Planeswalkers",
    test: (tl: string) => /\bPlaneswalker\b/i.test(tl),
  },
  { key: "Battles", label: "Battles", test: (tl: string) => /\bBattle\b/i.test(tl) },
  { key: "Lands", label: "Lands", test: (tl: string) => /\bLand\b/i.test(tl) },
  { key: "Other", label: "Other", test: () => true },
] as const;

export const COLOR_RANK: Record<string, number> = { W: 0, U: 1, B: 2, R: 3, G: 4 };

export function dominantColorRank(colors: string[]): number {
  if (colors.length === 0) return 10;
  return Math.min(...colors.map((c) => COLOR_RANK[c] ?? 5));
}

export function groupAndSort(
  cards: DeckCardDto[],
): { key: string; label: string; cards: DeckCardDto[] }[] {
  const buckets = new Map<string, DeckCardDto[]>(TYPE_GROUPS.map((g) => [g.key, []]));

  for (const card of cards) {
    const group = TYPE_GROUPS.find((g) => g.test(card.typeLine));
    buckets.get(group!.key)!.push(card);
  }

  const sorted = (arr: DeckCardDto[]) =>
    [...arr].sort((a, b) => {
      if (a.cmc !== b.cmc) return a.cmc - b.cmc;
      const cr =
        dominantColorRank(a.colorIdentity) - dominantColorRank(b.colorIdentity);
      if (cr !== 0) return cr;
      return a.name.localeCompare(b.name);
    });

  return TYPE_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    cards: sorted(buckets.get(g.key)!),
  })).filter((g) => g.cards.length > 0);
}
