import type { DeckDetailDto } from "@/lib/api/deck-dto";
import { cn } from "@/lib/utils";

const CATEGORY_STYLE: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-violet-500/20 text-violet-300" },
  complete: { label: "Complete", className: "bg-emerald-500/20 text-emerald-300" },
  wishlist: { label: "Wishlist", className: "bg-amber-500/20 text-amber-300" },
};

const COLOR_DOT: Record<string, string> = {
  W: "bg-mana-white",
  U: "bg-mana-blue",
  B: "bg-mana-black",
  R: "bg-mana-red",
  G: "bg-mana-green",
};
const COLOR_ORDER = ["W", "U", "B", "R", "G"];

function ManaCurve({ cards }: { cards: DeckDetailDto["cards"] }) {
  const CMC_BUCKETS = [0, 1, 2, 3, 4, 5, 6];
  const counts = new Array(CMC_BUCKETS.length).fill(0) as number[];

  for (const card of cards) {
    const cost = card.manaCost.replace(/\{[^}]+\}/g, (tok) => {
      if (/^\{\d+\}$/.test(tok)) return tok.slice(1, -1);
      if (/^\{[WUBRG]\}$/i.test(tok)) return "1";
      return "0";
    });
    const cmc = cost.split("").reduce((s, ch) => {
      const n = parseInt(ch, 10);
      return s + (isNaN(n) ? 1 : n);
    }, 0);
    const bucket = Math.min(cmc, 6);
    counts[bucket] += card.quantity;
  }

  const max = Math.max(...counts, 1);
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Mana Curve</p>
      <div className="flex items-end gap-1 h-12">
        {CMC_BUCKETS.map((cmc, i) => (
          <div key={cmc} className="flex flex-1 flex-col items-center gap-0.5">
            <div
              className="w-full rounded-t bg-primary/60 transition-all"
              style={{ height: `${(counts[i] / max) * 44}px` }}
              title={`CMC ${cmc === 6 ? "6+" : cmc}: ${counts[i]}`}
            />
            <span className="text-muted-foreground text-[10px]">{cmc === 6 ? "6+" : cmc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ColorBreakdown({ cards }: { cards: DeckDetailDto["cards"] }) {
  const counts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  let total = 0;
  for (const card of cards) {
    if (card.colors.length === 0) { counts.C += card.quantity; total += card.quantity; }
    else { for (const c of card.colors) { counts[c] = (counts[c] ?? 0) + card.quantity; total += card.quantity; } }
  }
  if (total === 0) return null;

  const present = COLOR_ORDER.filter((c) => counts[c] > 0);
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Colours</p>
      <div className="flex flex-wrap gap-1.5">
        {present.map((c) => (
          <div key={c} className="flex items-center gap-1">
            <span className={cn("h-3 w-3 rounded-full border border-black/30", COLOR_DOT[c])} />
            <span className="text-xs">{counts[c]}</span>
          </div>
        ))}
        {counts.C > 0 && (
          <div className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-full border border-black/30 bg-mana-colorless" />
            <span className="text-xs">{counts.C}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function DeckStats({ deck }: { deck: DeckDetailDto }) {
  const cat = CATEGORY_STYLE[deck.category] ?? CATEGORY_STYLE.wishlist;
  const nonlandCount = deck.cards
    .filter((c) => !c.typeLine.includes("Land"))
    .reduce((s, c) => s + c.quantity, 0);
  const landCount = deck.cards
    .filter((c) => c.typeLine.includes("Land"))
    .reduce((s, c) => s + c.quantity, 0);
  const ownedCount = deck.cards
    .filter((c) => !c.typeLine.startsWith("Basic Land"))
    .reduce((s, c) => s + Math.min(c.ownedQty, c.quantity), 0);
  const totalNonBasic = deck.cards
    .filter((c) => !c.typeLine.startsWith("Basic Land"))
    .reduce((s, c) => s + c.quantity, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", cat.className)}>
          {cat.label}
        </span>
        <span className="text-muted-foreground text-xs">{deck.cardCount} cards</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-muted/40 rounded-md px-3 py-2">
          <p className="text-muted-foreground text-xs">Spells</p>
          <p className="font-bold">{nonlandCount}</p>
        </div>
        <div className="bg-muted/40 rounded-md px-3 py-2">
          <p className="text-muted-foreground text-xs">Lands</p>
          <p className="font-bold">{landCount}</p>
        </div>
      </div>

      {totalNonBasic > 0 && deck.category !== "complete" && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
          <span className="font-medium text-amber-300">
            {ownedCount}/{totalNonBasic} non-basics owned
          </span>
        </div>
      )}

      <ColorBreakdown cards={deck.cards} />
      <ManaCurve cards={deck.cards} />
    </div>
  );
}
