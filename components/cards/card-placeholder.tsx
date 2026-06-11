import { ManaCost } from "@/components/cards/mana-cost";
import { cn } from "@/lib/utils";

/** Mirrors the mana theme tokens in globals.css for inline gradients. */
const IDENTITY_COLORS: Record<string, string> = {
  W: "#f8f6d8",
  U: "#0e68ab",
  B: "#3b3346",
  R: "#d3202a",
  G: "#00733e",
};

function identityGradient(colorIdentity: string[]): string {
  const stops = colorIdentity
    .map((color) => IDENTITY_COLORS[color])
    .filter(Boolean);
  if (stops.length === 0) return "linear-gradient(135deg, #c8c4bf, #6b6760)";
  if (stops.length === 1)
    return `linear-gradient(135deg, ${stops[0]}, #1a1a1a)`;
  return `linear-gradient(135deg, ${stops.join(", ")})`;
}

/**
 * Stylised CSS stand-in for the rare card whose Scryfall image is missing
 * or fails to load (decision D6): a card frame with name, mana cost and a
 * colour-identity wash.
 */
export function CardPlaceholder({
  name,
  manaCost = "",
  typeLine = "",
  colorIdentity = [],
  className,
}: {
  name: string;
  manaCost?: string;
  typeLine?: string;
  colorIdentity?: string[];
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={name}
      className={cn(
        "flex aspect-5/7 w-full flex-col overflow-hidden rounded-[4.75%/3.43%] border border-neutral-700 bg-neutral-900 p-[5%] text-left",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-[0.65rem] leading-tight font-semibold text-neutral-100">
          {name}
        </p>
        <ManaCost cost={manaCost} />
      </div>
      <div
        className="my-[5%] min-h-0 flex-1 rounded-sm opacity-50"
        style={{ background: identityGradient(colorIdentity) }}
      />
      <p className="truncate text-[0.55rem] text-neutral-400">{typeLine}</p>
    </div>
  );
}
