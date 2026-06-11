import type {
  ScryfallCard,
  ScryfallList,
  ScryfallRuling,
  ScryfallSet,
} from "@/lib/mtg-api/types";

const BASE_URL = "https://api.scryfall.com";
const USER_AGENT =
  "MTGVault/0.1 (private invite-only drafting app; contact fomedes.dev@gmail.com)";
/** Scryfall etiquette: ≤10 req/s with ~100 ms spacing between requests. */
const MIN_SPACING_MS = 100;
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 500;

export class ScryfallApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ScryfallApiError";
  }
}

export class ScryfallNotFoundError extends ScryfallApiError {
  constructor(message: string) {
    super(message, 404);
    this.name = "ScryfallNotFoundError";
  }
}

export interface ScryfallClientOptions {
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  minSpacingMs?: number;
  maxRetries?: number;
  backoffBaseMs?: number;
  baseUrl?: string;
}

export interface ScryfallClient {
  request<T>(path: string, params?: Record<string, string>): Promise<T>;
  getSet(code: string): Promise<ScryfallSet>;
  /** Yields one page of prints at a time for `q=e:<set> unique:prints`. */
  searchPrintsBySet(setCode: string): AsyncGenerator<ScryfallCard[]>;
  getRulings(scryfallCardId: string): Promise<ScryfallRuling[]>;
  /** Total HTTP requests issued (including retries) — used by sync logging and tests. */
  requestCount(): number;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createScryfallClient(
  options: ScryfallClientOptions = {},
): ScryfallClient {
  const {
    fetchFn = fetch,
    sleep = defaultSleep,
    now = Date.now,
    minSpacingMs = MIN_SPACING_MS,
    maxRetries = MAX_RETRIES,
    backoffBaseMs = BACKOFF_BASE_MS,
    baseUrl = BASE_URL,
  } = options;

  let nextSlotAt = 0;
  let requests = 0;

  /**
   * Reserves the next request slot synchronously (so concurrent callers
   * queue up at 1 slot per `minSpacingMs`), then waits until it arrives.
   */
  async function reserveSlot(): Promise<void> {
    const current = now();
    const wait = Math.max(0, nextSlotAt - current);
    nextSlotAt = Math.max(current, nextSlotAt) + minSpacingMs;
    if (wait > 0) await sleep(wait);
  }

  function buildUrl(path: string, params?: Record<string, string>): string {
    if (path.startsWith("http")) return path; // next_page links are absolute
    const url = new URL(baseUrl + path);
    for (const [key, value] of Object.entries(params ?? {})) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }

  async function request<T>(
    path: string,
    params?: Record<string, string>,
  ): Promise<T> {
    const url = buildUrl(path, params);

    for (let attempt = 0; ; attempt++) {
      await reserveSlot();
      requests++;

      let response: Response;
      try {
        response = await fetchFn(url, {
          headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        });
      } catch (error) {
        if (attempt >= maxRetries) {
          throw new ScryfallApiError(
            `Network failure calling Scryfall: ${error instanceof Error ? error.message : String(error)}`,
            0,
          );
        }
        await sleep(backoffBaseMs * 2 ** attempt);
        continue;
      }

      if (response.ok) return (await response.json()) as T;

      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < maxRetries) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const delay =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : backoffBaseMs * 2 ** attempt;
        await sleep(delay);
        continue;
      }

      let details = response.statusText;
      try {
        const body = (await response.json()) as { details?: string };
        if (body.details) details = body.details;
      } catch {
        // non-JSON error body; keep statusText
      }
      if (response.status === 404) {
        throw new ScryfallNotFoundError(`Scryfall 404: ${details}`);
      }
      throw new ScryfallApiError(
        `Scryfall ${response.status}: ${details}`,
        response.status,
      );
    }
  }

  async function getSet(code: string): Promise<ScryfallSet> {
    return request<ScryfallSet>(`/sets/${encodeURIComponent(code)}`);
  }

  async function* searchPrintsBySet(
    setCode: string,
  ): AsyncGenerator<ScryfallCard[]> {
    let url: string | null = buildUrl("/cards/search", {
      q: `e:${setCode}`,
      unique: "prints",
      order: "set",
    });
    while (url) {
      let page: ScryfallList<ScryfallCard>;
      try {
        page = await request<ScryfallList<ScryfallCard>>(url);
      } catch (error) {
        // Scryfall returns 404 for searches with zero results.
        if (error instanceof ScryfallNotFoundError) return;
        throw error;
      }
      yield page.data;
      url = page.has_more && page.next_page ? page.next_page : null;
    }
  }

  async function getRulings(scryfallCardId: string): Promise<ScryfallRuling[]> {
    const list = await request<ScryfallList<ScryfallRuling>>(
      `/cards/${encodeURIComponent(scryfallCardId)}/rulings`,
    );
    return list.data;
  }

  return {
    request,
    getSet,
    searchPrintsBySet,
    getRulings,
    requestCount: () => requests,
  };
}

/** Shared client for app code; tests build their own with injected fakes. */
export const scryfall: ScryfallClient = createScryfallClient();
