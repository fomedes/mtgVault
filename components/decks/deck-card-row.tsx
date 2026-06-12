import { CardImage } from "@/components/cards/card-image";
import { isBasicLand, type DeckCardDto } from "@/lib/api/deck-dto";
import { cn } from "@/lib/utils";

const RARITY_DOT: Record<string, string> = {
  common: "bg-rarity-common",
  uncommon: "bg-rarity-uncommon",
  rare: "bg-rarity-rare",
  mythic: "bg-rarity-mythic",
};

interface DeckCardRowProps {
  card: DeckCardDto;
  onAdd?: () => void;
  onRemove?: () => void;
  readonly?: boolean;
}

export function DeckCardRow({ card, onAdd, onRemove, readonly }: DeckCardRowProps) {
  const isBasic = isBasicLand(card.typeLine);
  const fullyOwned = isBasic || card.ownedQty >= card.quantity;
  const partiallyOwned = !isBasic && card.ownedQty > 0 && card.ownedQty < card.quantity;
  const notOwned = !isBasic && card.ownedQty === 0;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted/30",
        notOwned && "opacity-50",
      )}
    >
      {/* Tiny card thumbnail */}
      <div className="h-9 w-7 shrink-0 overflow-hidden rounded-sm">
        <CardImage
          name={card.name}
          imageUrl={card.imageUris?.small}
          manaCost={card.manaCost}
          typeLine={card.typeLine}
          colorIdentity={card.colors}
          className="h-full w-full object-cover"
        />
      </div>

      {/* Name + type */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "h-2 w-2 shrink-0 rounded-full",
              RARITY_DOT[card.rarity] ?? "bg-muted",
            )}
            aria-hidden
          />
          <span className="truncate text-sm font-medium">{card.name}</span>
        </div>
        <p className="text-muted-foreground truncate text-xs">{card.typeLine}</p>
      </div>

      {/* Ownership indicator */}
      {!isBasic && (
        <span
          className={cn(
            "shrink-0 text-xs",
            fullyOwned
              ? "text-emerald-400"
              : partiallyOwned
                ? "text-amber-400"
                : "text-muted-foreground",
          )}
          title={
            fullyOwned
              ? "Owned"
              : partiallyOwned
                ? `Own ${card.ownedQty} of ${card.quantity}`
                : "Not in collection"
          }
        >
          {fullyOwned ? "✓" : partiallyOwned ? `${card.ownedQty}/${card.quantity}` : "✕"}
        </span>
      )}

      {/* Quantity controls */}
      {!readonly && (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove one ${card.name}`}
            className="text-muted-foreground hover:text-destructive flex h-6 w-6 items-center justify-center rounded text-base transition-colors"
          >
            −
          </button>
          <span className="w-4 text-center text-sm font-mono font-semibold">
            {card.quantity}
          </span>
          <button
            type="button"
            onClick={onAdd}
            aria-label={`Add one more ${card.name}`}
            className="text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center rounded text-base transition-colors"
          >
            +
          </button>
        </div>
      )}
      {readonly && (
        <span className="text-muted-foreground w-6 shrink-0 text-center text-sm font-mono font-semibold">
          {card.quantity}
        </span>
      )}
    </div>
  );
}
