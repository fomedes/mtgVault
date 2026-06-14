"use client";

import { cn } from "@/lib/utils";
import type { DeckStatsResult } from "@/lib/game/deck-stats";

const COLOR_ORDER = ["W", "U", "B", "R", "G", "C"] as const;

const RARITY_COLOR: Record<string, string> = {
  common: "bg-muted-foreground/40",
  uncommon: "bg-rarity-uncommon",
  rare: "bg-rarity-rare",
  mythic: "bg-rarity-mythic",
};

function StatRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function ManaCurve({ curve }: { curve: number[] }) {
  const max = Math.max(...curve, 1);
  const labels = ["0", "1", "2", "3", "4", "5", "6", "7+"];
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Mana Curve</p>
      <div className="flex items-end gap-0.5 h-12">
        {curve.map((count, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
            <div
              className="w-full rounded-t bg-primary/60 transition-all min-h-[1px]"
              style={{ height: `${(count / max) * 44}px` }}
              title={`CMC ${labels[i]}: ${count}`}
            />
            <span className="text-muted-foreground text-[9px] leading-none">{labels[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ColorBar({ colors }: { colors: DeckStatsResult["colors"] }) {
  const present = COLOR_ORDER.filter((c) => colors[c] > 0);
  if (present.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Colours</p>
      <div className="flex flex-wrap gap-1.5">
        {present.map((c) => (
          <div key={c} className="flex items-center gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/mana_symbols/${c}.svg`} alt={c} className="h-4 w-4 flex-shrink-0" />
            <span className="text-xs tabular-nums">{colors[c]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RarityBar({ rarity }: { rarity: DeckStatsResult["rarity"] }) {
  const total = Object.values(rarity).reduce((s, n) => s + n, 0);
  if (total === 0) return null;
  const rarities = ["mythic", "rare", "uncommon", "common"] as const;
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Rarity</p>
      <div className="flex h-2 w-full overflow-hidden rounded-full">
        {rarities.map((r) =>
          rarity[r] > 0 ? (
            <div
              key={r}
              className={cn("h-full transition-all", RARITY_COLOR[r])}
              style={{ width: `${(rarity[r] / total) * 100}%` }}
              title={`${r}: ${rarity[r]}`}
            />
          ) : null,
        )}
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
        {rarities.map((r) =>
          rarity[r] > 0 ? (
            <span key={r} className="text-[10px] text-muted-foreground tabular-nums">
              {rarity[r]} {r.slice(0, 1).toUpperCase()}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

/** Compact sidebar variant — fits in a ~200 px column. */
function CompactStats({ stats }: { stats: DeckStatsResult }) {
  const { counts, avgCmc, tags, archetypeHint } = stats;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        <div className="bg-muted/40 rounded px-2 py-1.5">
          <p className="text-muted-foreground text-[10px]">Spells</p>
          <p className="font-bold tabular-nums">{counts.nonland}</p>
        </div>
        <div className="bg-muted/40 rounded px-2 py-1.5">
          <p className="text-muted-foreground text-[10px]">Lands</p>
          <p className="font-bold tabular-nums">{counts.lands}</p>
        </div>
        <div className="bg-muted/40 rounded px-2 py-1.5">
          <p className="text-muted-foreground text-[10px]">Creatures</p>
          <p className="font-bold tabular-nums">{counts.creatures}</p>
        </div>
        <div className="bg-muted/40 rounded px-2 py-1.5">
          <p className="text-muted-foreground text-[10px]">Avg CMC</p>
          <p className="font-bold tabular-nums">{avgCmc.toFixed(2)}</p>
        </div>
      </div>

      <ColorBar colors={stats.colors} />
      <ManaCurve curve={stats.curve} />

      {archetypeHint ? (
        <div className="rounded border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
          {archetypeHint}
        </div>
      ) : null}

      {(tags.removal > 0 || tags.cardAdvantage > 0) && (
        <div className="flex gap-2">
          {tags.removal > 0 && (
            <span className="text-[10px] rounded bg-red-500/15 px-1.5 py-0.5 text-red-400">
              {tags.removal} removal
            </span>
          )}
          {tags.cardAdvantage > 0 && (
            <span className="text-[10px] rounded bg-blue-500/15 px-1.5 py-0.5 text-blue-400">
              {tags.cardAdvantage} CA
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Expanded full-panel variant — more room for every metric. */
function ExpandedStats({ stats }: { stats: DeckStatsResult }) {
  const { counts, avgCmc, tags, archetypeHint, rarity } = stats;

  return (
    <div className="space-y-4">
      {archetypeHint ? (
        <div className="rounded border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
          {archetypeHint}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Total", value: counts.total },
          { label: "Spells", value: counts.nonland },
          { label: "Lands", value: counts.lands },
          { label: "Creatures", value: counts.creatures },
          { label: "Instants", value: counts.instants },
          { label: "Sorceries", value: counts.sorceries },
          { label: "Artifacts", value: counts.artifacts },
          { label: "Enchantments", value: counts.enchantments },
          { label: "Planeswalkers", value: counts.planeswalkers },
        ].map(({ label, value }) => (
          <div key={label} className="bg-muted/40 rounded-md px-2.5 py-2 text-center">
            <p className="text-muted-foreground text-[10px]">{label}</p>
            <p className="text-sm font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <StatRow label="Avg CMC (nonland)" value={avgCmc.toFixed(2)} />
        <StatRow label="Removal" value={tags.removal} />
        <StatRow label="Card advantage" value={tags.cardAdvantage} />
      </div>

      <ColorBar colors={stats.colors} />
      <ManaCurve curve={stats.curve} />
      <RarityBar rarity={rarity} />
    </div>
  );
}

/**
 * Presentational stats panel (P9-04). Accepts pre-computed `DeckStatsResult`
 * from `computeDeckStats`. Use `variant="compact"` in sidebars, `"expanded"`
 * for full-screen or completion screens.
 */
export function DeckStatsPanel({
  stats,
  variant = "compact",
  className,
}: {
  stats: DeckStatsResult;
  variant?: "compact" | "expanded";
  className?: string;
}) {
  return (
    <div className={cn("text-sm", className)}>
      {variant === "compact" ? (
        <CompactStats stats={stats} />
      ) : (
        <ExpandedStats stats={stats} />
      )}
    </div>
  );
}

/** Alias: same component, just semantically signals it's a draft pool. */
export const PoolStatsPanel = DeckStatsPanel;
