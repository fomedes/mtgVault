import { mkdtemp, rm } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

/**
 * Integration suite against an in-memory MongoDB (P1-12): set sync vs a
 * mocked Scryfall client, the rulings cache, and the card filter API
 * exercised through the real route handlers. Auth is mocked at the session
 * module boundary so no Firebase credentials are needed.
 */

const { getCurrentUserMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: getCurrentUserMock }));

import { GET as getCardDetail } from "@/app/api/cards/[id]/route";
import { GET as getCards } from "@/app/api/cards/route";
import { GET as getSets } from "@/app/api/sets/route";
import { getRulingsForCard } from "@/lib/mtg-api/rulings";
import { syncSet } from "@/lib/mtg-api/sync";
import type { ScryfallClient } from "@/lib/mtg-api/client";
import type {
  ScryfallCard,
  ScryfallRuling,
  ScryfallSet,
} from "@/lib/mtg-api/types";
import { Card } from "@/lib/models/Card";
import { CardSet } from "@/lib/models/CardSet";
import { Ruling } from "@/lib/models/Ruling";

const IDS = {
  lions: "3f2a1c9e-5b7d-4e2f-9a1b-2c3d4e5f6a01",
  counterspell: "3f2a1c9e-5b7d-4e2f-9a1b-2c3d4e5f6a02",
  solRing: "3f2a1c9e-5b7d-4e2f-9a1b-2c3d4e5f6a03",
  pathway: "3f2a1c9e-5b7d-4e2f-9a1b-2c3d4e5f6a04",
};

const setFixture: ScryfallSet = {
  id: "3f2a1c9e-5b7d-4e2f-9a1b-2c3d4e5f6a99",
  code: "tst",
  name: "Test Set",
  set_type: "expansion",
  card_count: 4,
  released_at: "2026-01-15",
  icon_svg_uri: "https://svgs.scryfall.io/tst.svg",
};

const cardFixtures: ScryfallCard[] = [
  {
    id: IDS.lions,
    oracle_id: "aaaa0000-5b7d-4e2f-9a1b-2c3d4e5f6a01",
    name: "Savannah Lions",
    set: "tst",
    collector_number: "1",
    rarity: "common",
    layout: "normal",
    colors: ["W"],
    color_identity: ["W"],
    type_line: "Creature — Cat",
    mana_cost: "{W}",
    cmc: 1,
    legalities: { standard: "legal" },
    booster: true,
  },
  {
    id: IDS.counterspell,
    oracle_id: "aaaa0000-5b7d-4e2f-9a1b-2c3d4e5f6a02",
    name: "Counterspell",
    set: "tst",
    collector_number: "2",
    rarity: "rare",
    layout: "normal",
    colors: ["U"],
    color_identity: ["U"],
    type_line: "Instant",
    mana_cost: "{U}{U}",
    cmc: 2,
    legalities: { standard: "not_legal" },
    booster: true,
  },
  {
    id: IDS.solRing,
    oracle_id: "aaaa0000-5b7d-4e2f-9a1b-2c3d4e5f6a03",
    name: "Sol Ring",
    set: "tst",
    collector_number: "3",
    rarity: "uncommon",
    layout: "normal",
    colors: [],
    color_identity: [],
    type_line: "Artifact",
    mana_cost: "{1}",
    cmc: 1,
    legalities: { standard: "not_legal" },
    booster: true,
  },
  {
    id: IDS.pathway,
    oracle_id: "aaaa0000-5b7d-4e2f-9a1b-2c3d4e5f6a04",
    name: "Branchloft Pathway // Boulderloft Pathway",
    set: "tst",
    collector_number: "4",
    rarity: "mythic",
    layout: "modal_dfc",
    color_identity: ["G", "W"],
    cmc: 0,
    card_faces: [
      {
        name: "Branchloft Pathway",
        type_line: "Land",
        colors: ["G"],
        image_uris: { normal: "https://cards.scryfall.io/front.jpg" },
      },
      {
        name: "Boulderloft Pathway",
        type_line: "Land",
        colors: ["W"],
        image_uris: { normal: "https://cards.scryfall.io/back.jpg" },
      },
    ],
    legalities: { standard: "not_legal" },
    booster: true,
  },
];

const rulingFixture: ScryfallRuling = {
  source: "wotc",
  published_at: "2020-01-01",
  comment: "A test ruling.",
};

function createFakeScryfall() {
  let requests = 0;
  const calls = { getSet: 0, search: 0, rulings: 0 };
  const client: ScryfallClient = {
    request: async () => {
      throw new Error("not used");
    },
    getSet: async () => {
      requests++;
      calls.getSet++;
      return setFixture;
    },
    searchPrintsBySet: async function* () {
      requests++;
      calls.search++;
      yield cardFixtures.slice(0, 3);
      requests++;
      yield cardFixtures.slice(3);
    },
    getRulings: async () => {
      requests++;
      calls.rulings++;
      return [rulingFixture];
    },
    requestCount: () => requests,
  };
  return { client, calls };
}

const noop = () => {};
let mongod: MongoMemoryServer;
let dbPath: string;
const fake = createFakeScryfall();

beforeAll(async () => {
  // Keep mongod's data dir inside the project: the OS temp dir can sit on
  // a different (possibly full) drive, which makes mongod fassert at boot.
  const tmpRoot = path.resolve(
    import.meta.dirname,
    "../../node_modules/.cache/mongodb-tmp",
  );
  mkdirSync(tmpRoot, { recursive: true });
  dbPath = await mkdtemp(path.join(tmpRoot, "data-"));

  mongod = await MongoMemoryServer.create({ instance: { dbPath } });
  process.env.MONGODB_URI = mongod.getUri();
  process.env.FIREBASE_ADMIN_PROJECT_ID = "test-project";
  process.env.FIREBASE_ADMIN_CLIENT_EMAIL = "test@test.example";
  process.env.FIREBASE_ADMIN_PRIVATE_KEY = "test-key";
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
  if (dbPath) await rm(dbPath, { recursive: true, force: true });
});

beforeEach(() => {
  getCurrentUserMock.mockResolvedValue({
    uid: "tester",
    email: "tester@example.com",
    displayName: "Tester",
    photoURL: "",
    role: "user",
    vaultCoins: 0,
    isAllowlisted: true,
  });
});

describe("syncSet", () => {
  it("cold sync fetches metadata + cards and preserves the enabled flag", async () => {
    // Simulates the seed script: enabled stub exists before the first sync.
    const { connectToDatabase } = await import("@/lib/db");
    await connectToDatabase();
    await CardSet.updateOne(
      { code: "tst" },
      { $set: { enabled: true } },
      { upsert: true },
    );

    const result = await syncSet("tst", { client: fake.client, log: noop });

    expect(result.setRefreshed).toBe(true);
    expect(result.cardsRefreshed).toBe(true);
    expect(result.cardsUpserted).toBe(4);
    expect(result.scryfallRequests).toBeGreaterThan(0);

    const set = await CardSet.findOne({ code: "tst" }).lean();
    expect(set?.name).toBe("Test Set");
    expect(set?.enabled).toBe(true);
    expect(set?.cachedAt).toBeInstanceOf(Date);
    expect(set?.cardsSyncedAt).toBeInstanceOf(Date);
    expect(await Card.countDocuments({ set: "tst" })).toBe(4);
  });

  it("warm sync makes zero Scryfall requests", async () => {
    const result = await syncSet("tst", { client: fake.client, log: noop });
    expect(result.scryfallRequests).toBe(0);
    expect(result.setRefreshed).toBe(false);
    expect(result.cardsRefreshed).toBe(false);
  });

  it("force resync re-fetches but stays idempotent", async () => {
    const result = await syncSet("tst", {
      client: fake.client,
      log: noop,
      force: true,
    });
    expect(result.scryfallRequests).toBeGreaterThan(0);
    expect(await Card.countDocuments({ set: "tst" })).toBe(4);
  });
});

describe("getRulingsForCard", () => {
  const counterspell = {
    scryfallId: IDS.counterspell,
    oracleId: "aaaa0000-5b7d-4e2f-9a1b-2c3d4e5f6a02",
  };

  it("fetches once and then serves from cache", async () => {
    const before = fake.calls.rulings;
    const first = await getRulingsForCard(counterspell, {
      client: fake.client,
    });
    expect(first).toHaveLength(1);
    expect(first[0].comment).toBe("A test ruling.");
    expect(fake.calls.rulings).toBe(before + 1);

    await getRulingsForCard(counterspell, { client: fake.client });
    expect(fake.calls.rulings).toBe(before + 1); // cache hit
  });

  it("refetches once the cache entry is stale", async () => {
    const before = fake.calls.rulings;
    await Ruling.updateOne(
      { oracleId: counterspell.oracleId },
      { $set: { cachedAt: new Date("2020-01-01") } },
    );
    await getRulingsForCard(counterspell, { client: fake.client });
    expect(fake.calls.rulings).toBe(before + 1);
  });
});

describe("GET /api/sets", () => {
  it("returns only enabled, synced sets", async () => {
    const response = await getSets();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { sets: Array<{ code: string }> };
    expect(body.sets.map((set) => set.code)).toEqual(["tst"]);
  });

  it("rejects unauthenticated callers", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    const response = await getSets();
    expect(response.status).toBe(401);
  });
});

describe("GET /api/cards", () => {
  async function query(params: string) {
    const response = await getCards(
      new Request(`http://localhost/api/cards?${params}`),
    );
    return response;
  }

  async function names(params: string): Promise<string[]> {
    const response = await query(params);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      cards: Array<{ name: string }>;
    };
    return body.cards.map((card) => card.name);
  }

  it("filters by color", async () => {
    expect(await names("set=tst&colors=U")).toEqual(["Counterspell"]);
  });

  it("matches colorless via C", async () => {
    expect(await names("set=tst&colors=C")).toEqual(["Sol Ring"]);
  });

  it("matches partial name case-insensitively", async () => {
    expect(await names("set=tst&name=counter")).toEqual(["Counterspell"]);
  });

  it("treats regex metacharacters in the name as literals", async () => {
    expect(await names("set=tst&name=.%2B")).toEqual([]); // ".+"
  });

  it("filters by rarity and returns DFC faces", async () => {
    const response = await query("set=tst&rarity=mythic");
    const body = (await response.json()) as {
      cards: Array<{ name: string; cardFaces: Array<{ name: string }> }>;
    };
    expect(body.cards).toHaveLength(1);
    expect(body.cards[0].cardFaces).toHaveLength(2);
  });

  it("filters by cmc range and legality", async () => {
    expect(await names("set=tst&cmcMin=2&cmcMax=2")).toEqual(["Counterspell"]);
    expect(await names("set=tst&legal=standard")).toEqual(["Savannah Lions"]);
  });

  it("sorts by collector number by default and paginates", async () => {
    const response = await query("set=tst&pageSize=6");
    const body = (await response.json()) as {
      cards: Array<{ collectorNumber: string }>;
      total: number;
      hasMore: boolean;
    };
    expect(body.total).toBe(4);
    expect(body.hasMore).toBe(false);
    expect(body.cards.map((card) => card.collectorNumber)).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);
  });

  it("rejects malformed filter params", async () => {
    expect((await query("set=%24ne")).status).toBe(400); // "$ne"
    expect((await query("set=tst&rarity=legendary")).status).toBe(400);
    expect((await query("set=tst&cmcMin=9&cmcMax=1")).status).toBe(400);
  });

  it("rejects unauthenticated callers", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    expect((await query("set=tst")).status).toBe(401);
  });
});

describe("GET /api/cards/[id]", () => {
  function detailRequest(id: string) {
    return getCardDetail(new Request(`http://localhost/api/cards/${id}`), {
      params: Promise.resolve({ id }),
    });
  }

  it("returns the card with cached rulings", async () => {
    const response = await detailRequest(IDS.counterspell);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      card: { name: string; legalities: Record<string, string> };
      rulings: Array<{ comment: string }>;
    };
    expect(body.card.name).toBe("Counterspell");
    expect(body.card.legalities.standard).toBe("not_legal");
    expect(body.rulings).toHaveLength(1);
  });

  it("404s on an unknown id and 400s on a malformed one", async () => {
    expect(
      (await detailRequest("3f2a1c9e-5b7d-4e2f-9a1b-2c3d4e5f6aff")).status,
    ).toBe(404);
    expect((await detailRequest("not-a-uuid")).status).toBe(400);
  });
});
