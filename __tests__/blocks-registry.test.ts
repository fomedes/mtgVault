import { describe, expect, it } from "vitest";
import { BLOCK_REGISTRY, getBlockEntry } from "@/lib/blocks";

describe("BLOCK_REGISTRY", () => {
  it("has entries for all Ravnica block sets", () => {
    expect(BLOCK_REGISTRY.rav?.id).toBe("ravnica");
    expect(BLOCK_REGISTRY.gpt?.id).toBe("ravnica");
    expect(BLOCK_REGISTRY.dis?.id).toBe("ravnica");
  });

  it("has entries for all Urza block sets", () => {
    expect(BLOCK_REGISTRY.usg?.id).toBe("urza");
    expect(BLOCK_REGISTRY.ulg?.id).toBe("urza");
    expect(BLOCK_REGISTRY.uds?.id).toBe("urza");
  });

  it("Ravnica sets have ascending setOrder", () => {
    expect(BLOCK_REGISTRY.rav!.setOrder).toBeLessThan(BLOCK_REGISTRY.gpt!.setOrder);
    expect(BLOCK_REGISTRY.gpt!.setOrder).toBeLessThan(BLOCK_REGISTRY.dis!.setOrder);
  });

  it("Urza sets have ascending setOrder", () => {
    expect(BLOCK_REGISTRY.usg!.setOrder).toBeLessThan(BLOCK_REGISTRY.ulg!.setOrder);
    expect(BLOCK_REGISTRY.ulg!.setOrder).toBeLessThan(BLOCK_REGISTRY.uds!.setOrder);
  });

  it("Urza block has lower order than Ravnica block", () => {
    expect(BLOCK_REGISTRY.usg!.order).toBeLessThan(BLOCK_REGISTRY.rav!.order);
  });

  it("does not include standalone sets", () => {
    expect(BLOCK_REGISTRY.dom).toBeUndefined();
    expect(BLOCK_REGISTRY.mh2).toBeUndefined();
    expect(BLOCK_REGISTRY.neo).toBeUndefined();
  });

  it("includes rtr in return-to-ravnica block", () => {
    expect(BLOCK_REGISTRY.rtr?.id).toBe("return-to-ravnica");
  });
});

describe("getBlockEntry", () => {
  it("returns block entry for a known set code", () => {
    expect(getBlockEntry("rav")?.id).toBe("ravnica");
    expect(getBlockEntry("usg")?.id).toBe("urza");
  });

  it("is case-insensitive", () => {
    expect(getBlockEntry("RAV")?.id).toBe("ravnica");
    expect(getBlockEntry("USG")?.id).toBe("urza");
  });

  it("returns undefined for unknown codes", () => {
    expect(getBlockEntry("xxx")).toBeUndefined();
    expect(getBlockEntry("dom")).toBeUndefined();
  });
});
