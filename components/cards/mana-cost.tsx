import { cn } from "@/lib/utils";

/** "{2}{W/U}{G}" → ["2", "W/U", "G"] */
export function parseManaSymbols(manaCost: string): string[] {
  return Array.from(manaCost.matchAll(/\{([^}]+)\}/g), (match) => match[1]);
}

const SYMBOL_CLASSES: Record<string, string> = {
  W: "bg-mana-white text-neutral-900",
  U: "bg-mana-blue text-white",
  B: "bg-mana-black text-white",
  R: "bg-mana-red text-white",
  G: "bg-mana-green text-white",
  C: "bg-mana-colorless text-neutral-900",
};

export function ManaCost({
  cost,
  className,
}: {
  cost: string;
  className?: string;
}) {
  const symbols = parseManaSymbols(cost);
  if (symbols.length === 0) return null;
  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-0.5", className)}
      aria-label={`Mana cost ${cost}`}
    >
      {symbols.map((symbol, index) => (
        <span
          key={`${symbol}-${index}`}
          aria-hidden
          className={cn(
            "flex size-4 items-center justify-center rounded-full text-[0.55rem] leading-none font-bold",
            // Hybrid/Phyrexian/generic symbols fall back to colorless styling.
            SYMBOL_CLASSES[symbol] ?? SYMBOL_CLASSES.C,
          )}
        >
          {symbol}
        </span>
      ))}
    </span>
  );
}
