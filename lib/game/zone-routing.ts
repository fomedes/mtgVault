import type { BattlefieldZone } from "./play";

/**
 * Determine the default zone for a card based on its type line.
 * Type routing priority: Creature → Land → Other
 */
export function getDefaultZone(typeLine: string): BattlefieldZone {
  if (!typeLine) return "other";

  // Creature type takes precedence
  if (typeLine.includes("Creature")) return "creatures";

  // Land type
  if (typeLine.includes("Land")) return "lands";

  // Everything else
  return "other";
}
