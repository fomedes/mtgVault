import { describe, it, expect } from "vitest";
import { getDefaultZone } from "@/lib/game/zone-routing";

describe("getDefaultZone", () => {
  it("routes Creature types to creatures zone", () => {
    expect(getDefaultZone("Creature")).toBe("creatures");
    expect(getDefaultZone("Creature — Human Wizard")).toBe("creatures");
    expect(getDefaultZone("Artifact Creature — Golem")).toBe("creatures");
    expect(getDefaultZone("Enchantment Creature — Spirit")).toBe("creatures");
  });

  it("routes Land types to lands zone", () => {
    expect(getDefaultZone("Land")).toBe("lands");
    expect(getDefaultZone("Land — Mountain")).toBe("lands");
    expect(getDefaultZone("Artifact Land")).toBe("lands");
  });

  it("routes other types to other zone", () => {
    expect(getDefaultZone("Artifact")).toBe("other");
    expect(getDefaultZone("Enchantment")).toBe("other");
    expect(getDefaultZone("Planeswalker")).toBe("other");
    expect(getDefaultZone("Instant")).toBe("other");
    expect(getDefaultZone("Sorcery")).toBe("other");
  });

  it("defaults to other zone for empty or missing type", () => {
    expect(getDefaultZone("")).toBe("other");
  });

  it("prioritizes Creature over Land when both present (hypothetically)", () => {
    // Edge case: if a card somehow had both, creature should win
    const hypothetical = "Creature Land";
    expect(getDefaultZone(hypothetical)).toBe("creatures");
  });
});
