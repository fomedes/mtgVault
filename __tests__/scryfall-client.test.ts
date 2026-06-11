import { describe, expect, it } from "vitest";
import {
  createScryfallClient,
  ScryfallApiError,
  ScryfallNotFoundError,
} from "@/lib/mtg-api/client";
import type { ScryfallCard, ScryfallList } from "@/lib/mtg-api/types";

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** Returns each factory's response in order; repeats the last one after. */
function sequentialFetch(...factories: Array<() => Response | Error>) {
  const calls: string[] = [];
  let index = 0;
  const fetchFn = async (input: RequestInfo | URL): Promise<Response> => {
    calls.push(String(input));
    const factory = factories[Math.min(index, factories.length - 1)];
    index++;
    const result = factory();
    if (result instanceof Error) throw result;
    return result;
  };
  return { fetchFn: fetchFn as typeof fetch, calls };
}

/** Client with a frozen clock and a sleep that records requested delays. */
function createTestClient(
  fetchFn: typeof fetch,
  overrides: Parameters<typeof createScryfallClient>[0] = {},
) {
  const sleeps: number[] = [];
  const client = createScryfallClient({
    fetchFn,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    now: () => 0,
    ...overrides,
  });
  return { client, sleeps };
}

describe("scryfall client throttle", () => {
  it("spaces consecutive requests by at least 100 ms", async () => {
    const { fetchFn } = sequentialFetch(() => jsonResponse({ ok: true }));
    const { client, sleeps } = createTestClient(fetchFn);

    await client.request("/sets/neo");
    await client.request("/sets/dom");
    await client.request("/sets/blb");

    // The clock is frozen, so each later request waits for the slots queued
    // ahead of it: 100 ms, then 200 ms.
    expect(sleeps).toEqual([100, 200]);
  });

  it("counts every HTTP request including retries", async () => {
    const { fetchFn } = sequentialFetch(
      () => jsonResponse({}, 500),
      () => jsonResponse({ ok: true }),
    );
    const { client } = createTestClient(fetchFn);
    await client.request("/sets/neo");
    expect(client.requestCount()).toBe(2);
  });
});

describe("scryfall client retries", () => {
  it("retries 429 honouring Retry-After seconds", async () => {
    const { fetchFn, calls } = sequentialFetch(
      () => jsonResponse({}, 429, { "Retry-After": "2" }),
      () => jsonResponse({ id: "x" }),
    );
    const { client, sleeps } = createTestClient(fetchFn);

    const result = await client.request<{ id: string }>("/sets/neo");
    expect(result.id).toBe("x");
    expect(calls).toHaveLength(2);
    expect(sleeps).toContain(2000);
  });

  it("retries 5xx with exponential backoff", async () => {
    const { fetchFn, calls } = sequentialFetch(
      () => jsonResponse({}, 500),
      () => jsonResponse({}, 503),
      () => jsonResponse({ id: "x" }),
    );
    const { client, sleeps } = createTestClient(fetchFn, {
      backoffBaseMs: 500,
    });

    await client.request("/sets/neo");
    expect(calls).toHaveLength(3);
    expect(sleeps).toContain(500);
    expect(sleeps).toContain(1000);
  });

  it("gives up after maxRetries and surfaces the status", async () => {
    const { fetchFn, calls } = sequentialFetch(() => jsonResponse({}, 500));
    const { client } = createTestClient(fetchFn, { maxRetries: 2 });

    await expect(client.request("/sets/neo")).rejects.toBeInstanceOf(
      ScryfallApiError,
    );
    expect(calls).toHaveLength(3); // initial + 2 retries
  });

  it("retries network failures before giving up", async () => {
    const { fetchFn, calls } = sequentialFetch(
      () => new TypeError("fetch failed"),
      () => jsonResponse({ id: "x" }),
    );
    const { client } = createTestClient(fetchFn);
    const result = await client.request<{ id: string }>("/sets/neo");
    expect(result.id).toBe("x");
    expect(calls).toHaveLength(2);
  });

  it("does not retry 404 and throws ScryfallNotFoundError with details", async () => {
    const { fetchFn, calls } = sequentialFetch(() =>
      jsonResponse(
        { object: "error", code: "not_found", status: 404, details: "No set" },
        404,
      ),
    );
    const { client } = createTestClient(fetchFn);

    await expect(client.request("/sets/zzz")).rejects.toThrowError(
      ScryfallNotFoundError,
    );
    expect(calls).toHaveLength(1);
  });

  it("does not retry 4xx client errors", async () => {
    const { fetchFn, calls } = sequentialFetch(() =>
      jsonResponse(
        { object: "error", code: "bad_request", status: 400, details: "Bad" },
        400,
      ),
    );
    const { client } = createTestClient(fetchFn);

    await expect(client.request("/cards/search")).rejects.toThrowError(
      /Scryfall 400/,
    );
    expect(calls).toHaveLength(1);
  });
});

describe("scryfall client pagination", () => {
  const card = (id: string) => ({ id }) as unknown as ScryfallCard;
  const page = (
    data: ScryfallCard[],
    next?: string,
  ): ScryfallList<ScryfallCard> => ({
    object: "list",
    data,
    has_more: !!next,
    next_page: next,
  });

  it("follows next_page until exhausted", async () => {
    const { fetchFn, calls } = sequentialFetch(
      () =>
        jsonResponse(
          page(
            [card("a"), card("b")],
            "https://api.scryfall.com/cards/search?page=2",
          ),
        ),
      () => jsonResponse(page([card("c")])),
    );
    const { client } = createTestClient(fetchFn);

    const collected: ScryfallCard[] = [];
    for await (const batch of client.searchPrintsBySet("neo")) {
      collected.push(...batch);
    }

    expect(collected.map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(calls[0]).toContain("q=e%3Aneo");
    expect(calls[0]).toContain("unique=prints");
    expect(calls[1]).toBe("https://api.scryfall.com/cards/search?page=2");
  });

  it("treats a 404 search (zero results) as an empty set", async () => {
    const { fetchFn } = sequentialFetch(() =>
      jsonResponse(
        { object: "error", code: "not_found", status: 404, details: "none" },
        404,
      ),
    );
    const { client } = createTestClient(fetchFn);

    const collected: ScryfallCard[] = [];
    for await (const batch of client.searchPrintsBySet("zzz")) {
      collected.push(...batch);
    }
    expect(collected).toEqual([]);
  });
});
