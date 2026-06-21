import { describe, expect, it } from "vitest";
import { parseDecklist } from "@/lib/game/decklist";

describe("parseDecklist", () => {
  it("parses a plain quantity + name", () => {
    expect(parseDecklist("4 Lightning Bolt")).toEqual([{ name: "Lightning Bolt", quantity: 4 }]);
  });

  it("parses the Arena '4x' form", () => {
    expect(parseDecklist("4x Llanowar Elves")).toEqual([{ name: "Llanowar Elves", quantity: 4 }]);
  });

  it("defaults quantity to 1 when omitted", () => {
    expect(parseDecklist("Brainstorm")).toEqual([{ name: "Brainstorm", quantity: 1 }]);
  });

  it("strips a (SET) collectorNumber suffix into a set hint", () => {
    expect(parseDecklist("1 Brainstorm (STA) 13")).toEqual([
      { name: "Brainstorm", quantity: 1, setHint: "sta" },
    ]);
  });

  it("ignores section headers, comments and blank lines", () => {
    const text = ["Deck", "", "4 Forest", "// sideboard below", "Sideboard:", "2 Negate", "# note"].join("\n");
    expect(parseDecklist(text)).toEqual([
      { name: "Forest", quantity: 4 },
      { name: "Negate", quantity: 2 },
    ]);
  });

  it("handles multi-word names with apostrophes and commas", () => {
    expect(parseDecklist("3 Urza, Lord High Artificer")).toEqual([
      { name: "Urza, Lord High Artificer", quantity: 3 },
    ]);
  });

  it("trims trailing whitespace and CRLF line endings", () => {
    expect(parseDecklist("2 Island  \r\n1 Plains\r\n")).toEqual([
      { name: "Island", quantity: 2 },
      { name: "Plains", quantity: 1 },
    ]);
  });
});
