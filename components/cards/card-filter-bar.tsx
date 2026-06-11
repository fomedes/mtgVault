"use client";

import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CMC_KEYS,
  hasActiveFilters,
  type CardFilterState,
} from "@/components/cards/filter-state";
import { cn } from "@/lib/utils";

const COLOR_OPTIONS = [
  { key: "W", label: "White", className: "bg-mana-white" },
  { key: "U", label: "Blue", className: "bg-mana-blue" },
  { key: "B", label: "Black", className: "bg-mana-black" },
  { key: "R", label: "Red", className: "bg-mana-red" },
  { key: "G", label: "Green", className: "bg-mana-green" },
  { key: "C", label: "Colorless", className: "bg-mana-colorless" },
];

const RARITY_OPTIONS = [
  { key: "common", label: "Common", dotClass: "bg-rarity-common" },
  { key: "uncommon", label: "Uncommon", dotClass: "bg-rarity-uncommon" },
  { key: "rare", label: "Rare", dotClass: "bg-rarity-rare" },
  { key: "mythic", label: "Mythic", dotClass: "bg-rarity-mythic" },
];

const TYPE_OPTIONS = [
  "Creature",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Planeswalker",
  "Battle",
  "Land",
];

const LEGAL_OPTIONS = [
  { key: "standard", label: "Standard" },
  { key: "pioneer", label: "Pioneer" },
  { key: "modern", label: "Modern" },
  { key: "legacy", label: "Legacy" },
  { key: "vintage", label: "Vintage" },
  { key: "commander", label: "Commander" },
  { key: "pauper", label: "Pauper" },
];

const SORT_OPTIONS = [
  { key: "collector", label: "Collector #" },
  { key: "name", label: "Name" },
  { key: "cmc", label: "Mana value" },
  { key: "rarity", label: "Rarity" },
];

const selectClass =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-lg border px-2 text-sm outline-none focus-visible:ring-3";

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((entry) => entry !== value)
    : [...list, value];
}

export function CardFilterBar({
  filters,
  onChange,
}: {
  filters: CardFilterState;
  onChange: (filters: CardFilterState) => void;
}) {
  const patch = (changes: Partial<CardFilterState>) =>
    onChange({ ...filters, ...changes });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={filters.name}
          onChange={(event) => patch({ name: event.target.value })}
          placeholder="Search card name…"
          aria-label="Search card name"
          className={cn(selectClass, "w-full min-w-0 sm:w-56")}
        />

        <div
          className="flex items-center gap-1"
          role="group"
          aria-label="Filter by color"
        >
          {COLOR_OPTIONS.map((color) => (
            <button
              key={color.key}
              type="button"
              aria-pressed={filters.colors.includes(color.key)}
              aria-label={color.label}
              title={color.label}
              onClick={() =>
                patch({ colors: toggleValue(filters.colors, color.key) })
              }
              className={cn(
                "size-7 cursor-pointer rounded-full border-2 transition-all",
                color.className,
                filters.colors.includes(color.key)
                  ? "border-foreground scale-110"
                  : "border-transparent opacity-40 hover:opacity-80",
              )}
            />
          ))}
        </div>

        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label="Filter by rarity"
        >
          {RARITY_OPTIONS.map((rarity) => (
            <button
              key={rarity.key}
              type="button"
              aria-pressed={filters.rarity.includes(rarity.key)}
              onClick={() =>
                patch({ rarity: toggleValue(filters.rarity, rarity.key) })
              }
              className={cn(
                "flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
                filters.rarity.includes(rarity.key)
                  ? "border-foreground/60 bg-muted"
                  : "border-border text-muted-foreground hover:bg-muted/50",
              )}
            >
              <span className={cn("size-2 rounded-full", rarity.dotClass)} />
              {rarity.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filters.type}
          onChange={(event) => patch({ type: event.target.value })}
          aria-label="Filter by card type"
          className={selectClass}
        >
          <option value="">Any type</option>
          {TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <select
          value={filters.cmc}
          onChange={(event) => patch({ cmc: event.target.value })}
          aria-label="Filter by mana value"
          className={selectClass}
        >
          <option value="">Any mana value</option>
          {CMC_KEYS.map((cmc) => (
            <option key={cmc} value={cmc}>
              {cmc === "7+" ? "Mana value 7+" : `Mana value ${cmc}`}
            </option>
          ))}
        </select>

        <select
          value={filters.legal}
          onChange={(event) => patch({ legal: event.target.value })}
          aria-label="Filter by format legality"
          className={selectClass}
        >
          <option value="">Any format</option>
          {LEGAL_OPTIONS.map((format) => (
            <option key={format.key} value={format.key}>
              Legal in {format.label}
            </option>
          ))}
        </select>

        <select
          value={filters.sort}
          onChange={(event) => patch({ sort: event.target.value })}
          aria-label="Sort cards"
          className={selectClass}
        >
          {SORT_OPTIONS.map((sort) => (
            <option key={sort.key} value={sort.key}>
              Sort: {sort.label}
            </option>
          ))}
        </select>

        {hasActiveFilters(filters) ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              patch({
                ...filters,
                name: "",
                colors: [],
                rarity: [],
                type: "",
                legal: "",
                cmc: "",
              })
            }
          >
            <XIcon data-icon="inline-start" />
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
