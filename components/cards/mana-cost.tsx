import { cn } from "@/lib/utils";

/** "{2}{W/U}{G}" → ["2", "W/U", "G"] */
export function parseManaSymbols(manaCost: string): string[] {
  return Array.from(manaCost.matchAll(/\{([^}]+)\}/g), (match) => match[1]);
}

/** Converts a Scryfall symbol code to its local SVG filename (no extension). */
export function symbolToFilename(symbol: string): string {
  return symbol
    .replace(/\//g, "")
    .replace("½", "HALF")
    .replace("∞", "INFINITY");
}

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
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${symbol}-${index}`}
          src={`/mana_symbols/${symbolToFilename(symbol)}.svg`}
          alt={symbol}
          aria-hidden
          className="inline-block size-4"
          width={16}
          height={16}
        />
      ))}
    </span>
  );
}
