"use client";

import { useEffect, useRef, useState } from "react";
import { FilterIcon, XIcon } from "lucide-react";
import { CardImage } from "@/components/cards/card-image";
import { useCardPreviewContext } from "@/components/cards/card-preview-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CardListItemDto } from "@/lib/api/card-dto";
import { cn } from "@/lib/utils";

// ── Filter state ─────────────────────────────────────────────────────────────

export interface SourceFilterState {
  type: string;
  colors: string[];
  cmcMin: number | "";
  cmcMax: number | "";
  power: number | "";
  powerOp: "eq" | "gte";
  toughness: number | "";
  toughnessOp: "eq" | "gte";
  rarity: string[];
  ownedOnly: boolean;
}

const DEFAULT_FILTERS: SourceFilterState = {
  type: "",
  colors: [],
  cmcMin: "",
  cmcMax: "",
  power: "",
  powerOp: "eq",
  toughness: "",
  toughnessOp: "eq",
  rarity: [],
  ownedOnly: false,
};

function isFiltersActive(f: SourceFilterState): boolean {
  return (
    !!f.type ||
    f.colors.length > 0 ||
    f.cmcMin !== "" ||
    f.cmcMax !== "" ||
    f.power !== "" ||
    f.toughness !== "" ||
    f.rarity.length > 0 ||
    f.ownedOnly
  );
}

function filtersToParams(filters: SourceFilterState): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.type) p.set("type", filters.type);
  if (filters.colors.length > 0) p.set("colors", filters.colors.join(""));
  if (filters.cmcMin !== "") p.set("cmcMin", String(filters.cmcMin));
  if (filters.cmcMax !== "") p.set("cmcMax", String(filters.cmcMax));
  if (filters.power !== "") {
    p.set("power", String(filters.power));
    p.set("powerOp", filters.powerOp);
  }
  if (filters.toughness !== "") {
    p.set("toughness", String(filters.toughness));
    p.set("toughnessOp", filters.toughnessOp);
  }
  if (filters.rarity.length > 0) p.set("rarity", filters.rarity.join(","));
  if (filters.ownedOnly) p.set("ownedOnly", "true");
  return p;
}

// ── Types, colours, rarities ─────────────────────────────────────────────────

const CARD_TYPES = ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker", "Land", "Battle"];
const COLORS = [
  { code: "W", label: "W", title: "White", bg: "bg-mana-white" },
  { code: "U", label: "U", title: "Blue", bg: "bg-mana-blue" },
  { code: "B", label: "B", title: "Black", bg: "bg-mana-black" },
  { code: "R", label: "R", title: "Red", bg: "bg-mana-red" },
  { code: "G", label: "G", title: "Green", bg: "bg-mana-green" },
  { code: "C", label: "C", title: "Colorless", bg: "bg-mana-colorless" },
];
const RARITIES = ["common", "uncommon", "rare", "mythic"];

// ── Filter overlay dialog ────────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-primary border-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

function NumericInput({
  value,
  onChange,
  placeholder,
  min = 0,
  max = 20,
}: {
  value: number | "";
  onChange: (v: number | "") => void;
  placeholder?: string;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
      className="border-input bg-background h-8 w-full rounded border px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    />
  );
}

function OpToggle({
  value,
  onChange,
}: {
  value: "eq" | "gte";
  onChange: (v: "eq" | "gte") => void;
}) {
  return (
    <div className="flex rounded border overflow-hidden text-xs">
      {(["eq", "gte"] as const).map((op) => (
        <button
          key={op}
          type="button"
          onClick={() => onChange(op)}
          className={cn(
            "flex-1 py-1 transition-colors",
            value === op
              ? "bg-primary text-primary-foreground font-medium"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {op === "eq" ? "=" : "≥"}
        </button>
      ))}
    </div>
  );
}

function FilterDialog({
  open,
  onOpenChange,
  filters,
  onChange,
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: SourceFilterState;
  onChange: (f: SourceFilterState) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState(filters);

  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  function toggleColor(code: string) {
    setDraft((prev) => ({
      ...prev,
      colors: prev.colors.includes(code)
        ? prev.colors.filter((c) => c !== code)
        : [...prev.colors, code],
    }));
  }

  function toggleRarity(r: string) {
    setDraft((prev) => ({
      ...prev,
      rarity: prev.rarity.includes(r)
        ? prev.rarity.filter((x) => x !== r)
        : [...prev.rarity, r],
    }));
  }

  function handleApply() {
    onChange(draft);
    onOpenChange(false);
  }

  function handleReset() {
    setDraft(DEFAULT_FILTERS);
    onReset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <div className="pb-2">
          <DialogTitle>Filter Cards</DialogTitle>
        </div>

        <div className="space-y-4 py-2">
          {/* Type */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</p>
            <div className="flex flex-wrap gap-1.5">
              {CARD_TYPES.map((t) => (
                <FilterChip
                  key={t}
                  label={t}
                  active={draft.type === t}
                  onClick={() => setDraft((prev) => ({ ...prev, type: prev.type === t ? "" : t }))}
                />
              ))}
            </div>
          </div>

          {/* Colours */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Colour</p>
            <div className="flex gap-2">
              {COLORS.map(({ code, label, title, bg }) => (
                <button
                  key={code}
                  type="button"
                  title={title}
                  onClick={() => toggleColor(code)}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-bold transition-all",
                    bg,
                    draft.colors.includes(code)
                      ? "border-white/80 scale-110 shadow-md"
                      : "border-transparent opacity-50 hover:opacity-80",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* CMC */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mana Value (CMC)</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Min</p>
                <NumericInput
                  value={draft.cmcMin}
                  onChange={(v) => setDraft((p) => ({ ...p, cmcMin: v }))}
                  placeholder="0"
                  max={30}
                />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">Max</p>
                <NumericInput
                  value={draft.cmcMax}
                  onChange={(v) => setDraft((p) => ({ ...p, cmcMax: v }))}
                  placeholder="∞"
                  max={30}
                />
              </div>
            </div>
          </div>

          {/* Power */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Power</p>
            <div className="grid grid-cols-2 gap-2">
              <NumericInput
                value={draft.power}
                onChange={(v) => setDraft((p) => ({ ...p, power: v }))}
                placeholder="—"
              />
              <OpToggle
                value={draft.powerOp}
                onChange={(v) => setDraft((p) => ({ ...p, powerOp: v }))}
              />
            </div>
          </div>

          {/* Toughness */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Toughness</p>
            <div className="grid grid-cols-2 gap-2">
              <NumericInput
                value={draft.toughness}
                onChange={(v) => setDraft((p) => ({ ...p, toughness: v }))}
                placeholder="—"
              />
              <OpToggle
                value={draft.toughnessOp}
                onChange={(v) => setDraft((p) => ({ ...p, toughnessOp: v }))}
              />
            </div>
          </div>

          {/* Rarity */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rarity</p>
            <div className="flex flex-wrap gap-1.5">
              {RARITIES.map((r) => (
                <FilterChip
                  key={r}
                  label={r.charAt(0).toUpperCase() + r.slice(1)}
                  active={draft.rarity.includes(r)}
                  onClick={() => toggleRarity(r)}
                />
              ))}
            </div>
          </div>

          {/* Owned only */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.ownedOnly}
              onChange={(e) => setDraft((p) => ({ ...p, ownedOnly: e.target.checked }))}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-sm">Owned cards only</span>
          </label>
        </div>

        <div className="flex gap-2 pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={handleReset} className="flex-1">
            Reset
          </Button>
          <Button size="sm" onClick={handleApply} className="flex-1">
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── CardSourcePane ───────────────────────────────────────────────────────────

type SourceTab = "all" | "collection";

interface CardSourcePaneProps {
  onAdd: (cardId: string) => void;
  addingId: string | null;
}

interface CollectionCard {
  cardId: string;
  card: CardListItemDto;
  quantity: number;
}

interface SearchCard {
  id: string;
  scryfallId: string;
  name: string;
  typeLine: string;
  manaCost: string;
  rarity: string;
  colorIdentity: string[];
  imageUris?: { small?: string; normal?: string };
}

export function CardSourcePane({ onAdd, addingId }: CardSourcePaneProps) {
  const [tab, setTab] = useState<SourceTab>("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filters, setFilters] = useState<SourceFilterState>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);

  const [searchResults, setSearchResults] = useState<SearchCard[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [collection, setCollection] = useState<CollectionCard[]>([]);
  const [collLoaded, setCollLoaded] = useState(false);
  const [collLoading, setCollLoading] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  useEffect(() => {
    if (tab === "collection" && !collLoaded && !collLoading) {
      setCollLoading(true);
      fetch("/api/collection")
        .then((r) => r.json())
        .then((d: { entries: CollectionCard[] }) => {
          setCollection(d.entries ?? []);
          setCollLoaded(true);
        })
        .catch(() => undefined)
        .finally(() => setCollLoading(false));
    }
  }, [tab, collLoaded, collLoading]);

  useEffect(() => {
    if (tab !== "all") return;
    const hasFilters = isFiltersActive(filters);
    if (!debouncedQuery.trim() && !hasFilters) { setSearchResults([]); return; }
    setSearchLoading(true);
    const params = filtersToParams(filters);
    if (debouncedQuery.trim()) params.set("name", debouncedQuery);
    params.set("pageSize", "30");
    fetch(`/api/cards?${params}`)
      .then((r) => r.json())
      .then((d: { cards: Array<{ _id?: string; scryfallId: string; name: string; typeLine: string; manaCost: string; rarity: string; colorIdentity?: string[]; imageUris?: { small?: string; normal?: string } }> }) => {
        setSearchResults(
          (d.cards ?? []).map((c) => ({
            id: c._id ?? c.scryfallId,
            scryfallId: c.scryfallId,
            name: c.name,
            typeLine: c.typeLine,
            manaCost: c.manaCost,
            rarity: c.rarity,
            colorIdentity: c.colorIdentity ?? [],
            imageUris: c.imageUris,
          })),
        );
      })
      .catch(() => undefined)
      .finally(() => setSearchLoading(false));
  }, [tab, debouncedQuery, filters]);

  const filteredCollection =
    tab === "collection" && debouncedQuery
      ? collection.filter((e) =>
          e.card.name.toLowerCase().includes(debouncedQuery.toLowerCase()),
        )
      : collection;

  const tabClass = (active: boolean) =>
    cn(
      "flex-1 rounded-md py-1.5 text-sm transition-colors",
      active
        ? "bg-primary text-primary-foreground font-medium"
        : "text-muted-foreground hover:bg-muted",
    );

  const filtersActive = isFiltersActive(filters);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-lg border p-1">
        <button type="button" onClick={() => setTab("all")} className={tabClass(tab === "all")}>
          All Cards
        </button>
        <button type="button" onClick={() => setTab("collection")} className={tabClass(tab === "collection")}>
          My Collection
        </button>
      </div>

      <div className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tab === "all" ? "Search all cards…" : "Filter collection…"}
          className="border-input bg-background h-9 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Search cards"
        />
        {tab === "all" && (
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            aria-label="Advanced filters"
            className={cn(
              "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
              filtersActive
                ? "border-primary bg-primary/10 text-primary"
                : "border-input text-muted-foreground hover:bg-muted",
            )}
          >
            <FilterIcon className="size-4" />
            {filtersActive && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" aria-label="Filters active" />
            )}
          </button>
        )}
      </div>

      {/* Active filter chips */}
      {tab === "all" && filtersActive && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.type && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
              {filters.type}
              <button type="button" onClick={() => setFilters((p) => ({ ...p, type: "" }))} aria-label="Remove type filter">
                <XIcon className="size-2.5" />
              </button>
            </span>
          )}
          {filters.colors.map((c) => (
            <span key={c} className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
              {c}
              <button type="button" onClick={() => setFilters((p) => ({ ...p, colors: p.colors.filter((x) => x !== c) }))} aria-label={`Remove ${c} filter`}>
                <XIcon className="size-2.5" />
              </button>
            </span>
          ))}
          {filters.ownedOnly && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
              Owned only
              <button type="button" onClick={() => setFilters((p) => ({ ...p, ownedOnly: false }))} aria-label="Remove owned-only filter">
                <XIcon className="size-2.5" />
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="text-[10px] text-muted-foreground underline"
          >
            Clear all
          </button>
        </div>
      )}

      {tab === "all" ? (
        <div className="space-y-1 overflow-y-auto" style={{ maxHeight: "400px" }}>
          {!debouncedQuery.trim() && !filtersActive ? (
            <p className="text-muted-foreground py-6 text-center text-xs">Type or use filters to search cards</p>
          ) : searchLoading ? (
            <p className="text-muted-foreground py-6 text-center text-xs">Searching…</p>
          ) : searchResults.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-xs">No cards found</p>
          ) : (
            searchResults.map((card) => (
              <SourceCardRow
                key={card.scryfallId}
                card={card}
                onAdd={onAdd}
                adding={addingId === card.id}
              />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-1 overflow-y-auto" style={{ maxHeight: "400px" }}>
          {collLoading ? (
            <p className="text-muted-foreground py-6 text-center text-xs">Loading…</p>
          ) : filteredCollection.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-xs">
              {debouncedQuery ? "No matching cards" : "Collection is empty"}
            </p>
          ) : (
            filteredCollection.map((entry) => (
              <SourceCardRow
                key={entry.cardId}
                card={{
                  id: entry.card.scryfallId,
                  scryfallId: entry.card.scryfallId,
                  name: entry.card.name,
                  typeLine: entry.card.typeLine,
                  manaCost: entry.card.manaCost,
                  rarity: entry.card.rarity,
                  colorIdentity: entry.card.colorIdentity,
                  imageUris: entry.card.imageUris,
                }}
                badge={`×${entry.quantity}`}
                onAdd={onAdd}
                adding={addingId === entry.card.scryfallId}
              />
            ))
          )}
        </div>
      )}

      <FilterDialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters(DEFAULT_FILTERS)}
      />
    </div>
  );
}

// ── Source card row ──────────────────────────────────────────────────────────

function SourceCardRow({
  card,
  badge,
  onAdd,
  adding,
}: {
  card: SearchCard;
  badge?: string;
  onAdd: (id: string) => void;
  adding: boolean;
}) {
  const { previewHandlers } = useCardPreviewContext();

  const RARITY_DOT: Record<string, string> = {
    common: "bg-rarity-common",
    uncommon: "bg-rarity-uncommon",
    rare: "bg-rarity-rare",
    mythic: "bg-rarity-mythic",
  };

  return (
    <button
      type="button"
      onClick={() => onAdd(card.id)}
      disabled={adding}
      {...previewHandlers(card)}
      aria-label={`Add ${card.name} to deck`}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/40 disabled:opacity-60"
    >
      <div className="h-9 w-7 shrink-0 overflow-hidden rounded-sm">
        <CardImage
          name={card.name}
          imageUrl={card.imageUris?.small}
          manaCost={card.manaCost}
          typeLine={card.typeLine}
          colorIdentity={card.colorIdentity}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn("h-2 w-2 shrink-0 rounded-full", RARITY_DOT[card.rarity] ?? "bg-muted")}
            aria-hidden
          />
          <span className="truncate text-sm">{card.name}</span>
        </div>
        <p className="text-muted-foreground truncate text-xs">{card.typeLine}</p>
      </div>
      {badge && <span className="text-muted-foreground shrink-0 text-xs">{badge}</span>}
      <span className="text-muted-foreground shrink-0 text-sm">{adding ? "…" : "+"}</span>
    </button>
  );
}
