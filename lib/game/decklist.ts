/**
 * Pure decklist parser — zero I/O. Turns a pasted Arena/MTGO-style decklist
 * into structured line entries. Name → card resolution against the cached Card
 * collection happens later in lib/game/play-import.ts (which is impure).
 */

export interface DecklistEntry {
  name: string;
  quantity: number;
  /** Optional set hint from a "(SET) 123" suffix — used only as a tie-breaker. */
  setHint?: string;
}

/** Headers we skip outright (case-insensitive, optional trailing colon). */
const SECTION_HEADERS = new Set(["deck", "sideboard", "commander", "companion", "maybeboard"]);

/**
 * Matches an optional leading quantity then the card name, optionally followed
 * by a "(SET) collectorNumber" printing hint.
 *   "4 Lightning Bolt"
 *   "4x Lightning Bolt"
 *   "1 Brainstorm (STA) 13"
 *   "Llanowar Elves"          → quantity defaults to 1
 */
const LINE_RE =
  /^(?:(\d+)\s*[xX]?\s+)?(.+?)(?:\s+\(([A-Za-z0-9]{2,5})\)(?:\s+\S+)?)?\s*$/;

export function parseDecklist(text: string): DecklistEntry[] {
  const entries: DecklistEntry[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("//") || line.startsWith("#")) continue;

    const headerKey = line.replace(/:$/, "").toLowerCase();
    if (SECTION_HEADERS.has(headerKey)) continue;

    const m = LINE_RE.exec(line);
    if (!m) continue;

    const quantity = m[1] ? Math.max(1, parseInt(m[1], 10)) : 1;
    const name = m[2].trim();
    if (!name) continue;

    const setHint = m[3]?.toLowerCase();
    entries.push(setHint ? { name, quantity, setHint } : { name, quantity });
  }

  return entries;
}
