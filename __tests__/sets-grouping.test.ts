import { describe, expect, it } from "vitest";
import { groupSetsByBlock, type SetSummary } from "@/lib/sets-grouping";

function makeSet(code: string, override: Partial<SetSummary> = {}): SetSummary {
  return {
    code,
    name: code.toUpperCase(),
    setType: "expansion",
    cardCount: 100,
    releasedAt: "2005-01-01T00:00:00.000Z",
    iconSvgUri: "",
    synced: true,
    block: "",
    blockName: "",
    blockOrder: 0,
    setOrderInBlock: 0,
    ...override,
  };
}

describe("groupSetsByBlock", () => {
  it("places sets without a block in standalone", () => {
    const sets = [makeSet("dom"), makeSet("neo")];
    const { blocks, standalone } = groupSetsByBlock(sets);
    expect(blocks).toHaveLength(0);
    expect(standalone).toHaveLength(2);
  });

  it("groups sets by block id", () => {
    const sets = [
      makeSet("rav", { block: "ravnica", blockName: "Ravnica Block", blockOrder: 30, setOrderInBlock: 1 }),
      makeSet("gpt", { block: "ravnica", blockName: "Ravnica Block", blockOrder: 30, setOrderInBlock: 2 }),
      makeSet("dis", { block: "ravnica", blockName: "Ravnica Block", blockOrder: 30, setOrderInBlock: 3 }),
    ];
    const { blocks, standalone } = groupSetsByBlock(sets);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].id).toBe("ravnica");
    expect(blocks[0].sets).toHaveLength(3);
    expect(standalone).toHaveLength(0);
  });

  it("sorts sets within a block by setOrderInBlock", () => {
    const sets = [
      makeSet("dis", { block: "ravnica", blockName: "Ravnica Block", blockOrder: 30, setOrderInBlock: 3 }),
      makeSet("rav", { block: "ravnica", blockName: "Ravnica Block", blockOrder: 30, setOrderInBlock: 1 }),
      makeSet("gpt", { block: "ravnica", blockName: "Ravnica Block", blockOrder: 30, setOrderInBlock: 2 }),
    ];
    const { blocks } = groupSetsByBlock(sets);
    expect(blocks[0].sets.map((s) => s.code)).toEqual(["rav", "gpt", "dis"]);
  });

  it("sorts blocks by blockOrder ascending", () => {
    const sets = [
      makeSet("rav", { block: "ravnica", blockName: "Ravnica Block", blockOrder: 30, setOrderInBlock: 1 }),
      makeSet("usg", { block: "urza", blockName: "Urza Block", blockOrder: 10, setOrderInBlock: 1 }),
    ];
    const { blocks } = groupSetsByBlock(sets);
    expect(blocks[0].id).toBe("urza");
    expect(blocks[1].id).toBe("ravnica");
  });

  it("handles mixed blocks and standalone", () => {
    const sets = [
      makeSet("dom"),
      makeSet("rav", { block: "ravnica", blockName: "Ravnica Block", blockOrder: 30, setOrderInBlock: 1 }),
    ];
    const { blocks, standalone } = groupSetsByBlock(sets);
    expect(blocks).toHaveLength(1);
    expect(standalone).toHaveLength(1);
    expect(standalone[0].code).toBe("dom");
  });

  it("sorts standalone by releasedAt descending", () => {
    const sets = [
      makeSet("old", { releasedAt: "2000-01-01T00:00:00.000Z" }),
      makeSet("new", { releasedAt: "2024-01-01T00:00:00.000Z" }),
    ];
    const { standalone } = groupSetsByBlock(sets);
    expect(standalone[0].code).toBe("new");
  });

  it("handles partial blocks (only some sets present)", () => {
    const sets = [
      makeSet("rav", { block: "ravnica", blockName: "Ravnica Block", blockOrder: 30, setOrderInBlock: 1 }),
      // gpt and dis not included
    ];
    const { blocks } = groupSetsByBlock(sets);
    expect(blocks[0].sets).toHaveLength(1);
  });
});
