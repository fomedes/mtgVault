/**
 * Tests for the DraftSummary component (components/draft/draft-summary.tsx).
 *
 * Mock strategy — DraftSummary has a deep dependency tree that is unsuitable
 * for rendering in a unit-test environment without mocks:
 *   - next/link             → rendered as a plain <a> tag
 *   - CardPreviewProvider   → renders children directly (no context portal)
 *   - CardImage             → renders a <div data-testid="card-image"> placeholder
 *   - PoolStats             → renders a <div data-testid="pool-stats"> placeholder
 *   - @/components/ui/button → renders a plain <button> element
 *
 * We verify structural output (headings, badges, action buttons/links) which is
 * the correct abstraction level for a component test of this kind.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { CardListItemDto } from "@/lib/api/card-dto";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// next/link — render as <a> so href-based assertions work in happy-dom.
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// CardPreviewProvider — just render children directly; no portal needed.
vi.mock("@/components/cards/card-preview-provider", () => ({
  CardPreviewProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useCardPreviewContext: () => ({
    previewHandlers: () => ({}),
    show: vi.fn(),
    hide: vi.fn(),
  }),
}));

// CardImage — lightweight placeholder so we don't need canvas/image APIs.
vi.mock("@/components/cards/card-image", () => ({
  CardImage: ({ name }: { name?: string }) => (
    <div data-testid="card-image" aria-label={name ?? "card"} />
  ),
}));

// PoolStats — lightweight placeholder; its logic is tested in pool-stats.test.tsx.
vi.mock("@/components/draft/pool-stats", () => ({
  PoolStats: () => <div data-testid="pool-stats" />,
}));

// @/components/ui/button — render as a plain button so we avoid @base-ui deps.
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, className }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
  buttonVariants: () => "button-ghost",
}));

// Unmount all rendered components between tests so the DOM stays clean.
afterEach(cleanup);

// ─── Import after mocks ───────────────────────────────────────────────────────

// Dynamic import so all mocks above are in place before the module resolves.
const { DraftSummary } = await import("@/components/draft/draft-summary");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCardCache(count = 2): Map<string, CardListItemDto> {
  const cache = new Map<string, CardListItemDto>();
  for (let i = 0; i < count; i++) {
    cache.set(`card-${i}`, {
      scryfallId: `card-${i}`,
      name: `Card ${i}`,
      set: "neo",
      collectorNumber: `${i + 1}`,
      rarity: "common",
      manaCost: "{1}{W}",
      typeLine: "Creature — Spirit",
      colors: ["W"],
      colorIdentity: ["W"],
      layout: "normal",
      cmc: 2,
      oracleText: "",
      cardFaces: [],
    });
  }
  return cache;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DraftSummary — phantom kind", () => {
  const baseProps = {
    sessionId: "session-1",
    setCode: "neo",
    kind: "phantom" as const,
    cardIds: ["card-0", "card-1"],
    cardCache: makeCardCache(2),
  };

  it('renders "Draft Complete" heading', () => {
    render(<DraftSummary {...baseProps} />);
    expect(screen.getByText("Draft Complete")).toBeTruthy();
  });

  it('renders a "Phantom" badge', () => {
    render(<DraftSummary {...baseProps} />);
    expect(screen.getByText("Phantom")).toBeTruthy();
  });

  it('renders a "Build a Deck" action button', () => {
    render(<DraftSummary {...baseProps} />);
    // Button text starts as "Build a Deck" when not loading.
    const btn = screen.getByText("Build a Deck");
    expect(btn).toBeTruthy();
  });

  it('renders an "Export" button', () => {
    render(<DraftSummary {...baseProps} />);
    expect(screen.getByText("Export")).toBeTruthy();
  });

  it('renders a "New Draft" link pointing to /solo-draft', () => {
    render(<DraftSummary {...baseProps} />);
    const link = screen.getByText("New Draft") as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/solo-draft");
  });

  it('does NOT render a "Back to Lobby" link', () => {
    render(<DraftSummary {...baseProps} />);
    const lobbyLink = screen.queryByText("Back to Lobby");
    expect(lobbyLink).toBeNull();
  });

  it("renders the PoolStats component when cardIds is non-empty", () => {
    render(<DraftSummary {...baseProps} />);
    expect(screen.getByTestId("pool-stats")).toBeTruthy();
  });

  it("renders pick count in the section heading", () => {
    render(<DraftSummary {...baseProps} />);
    // The component renders "Your Picks (N)" where N = cardIds.length.
    expect(screen.getByText(/Your Picks \(2\)/)).toBeTruthy();
  });
});

describe("DraftSummary — multiplayer kind", () => {
  const baseProps = {
    sessionId: "session-2",
    setCode: "mom",
    kind: "multiplayer" as const,
    cardIds: ["card-0"],
    cardCache: makeCardCache(1),
  };

  it('renders a "Multiplayer" badge', () => {
    render(<DraftSummary {...baseProps} />);
    expect(screen.getByText("Multiplayer")).toBeTruthy();
  });

  it('renders a "Back to Lobby" link pointing to /draft', () => {
    render(<DraftSummary {...baseProps} />);
    const link = screen.getByText("Back to Lobby") as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/draft");
  });

  it('does NOT render a "New Draft" link', () => {
    render(<DraftSummary {...baseProps} />);
    expect(screen.queryByText("New Draft")).toBeNull();
  });

  it('still renders "Draft Complete" heading', () => {
    render(<DraftSummary {...baseProps} />);
    expect(screen.getByText("Draft Complete")).toBeTruthy();
  });

  it('renders "Build a Deck" and "Export" buttons for multiplayer too', () => {
    render(<DraftSummary {...baseProps} />);
    expect(screen.getByText("Build a Deck")).toBeTruthy();
    expect(screen.getByText("Export")).toBeTruthy();
  });
});

describe("DraftSummary — difficulty badge", () => {
  it('shows "Easy" difficulty badge when kind=phantom and difficulty=easy', () => {
    const cache = makeCardCache(1);
    render(
      <DraftSummary
        sessionId="s3"
        setCode="neo"
        kind="phantom"
        difficulty="easy"
        cardIds={["card-0"]}
        cardCache={cache}
      />,
    );
    expect(screen.getByText("Easy")).toBeTruthy();
  });

  it('shows "Medium" difficulty badge', () => {
    const cache = makeCardCache(1);
    render(
      <DraftSummary
        sessionId="s4"
        setCode="neo"
        kind="phantom"
        difficulty="medium"
        cardIds={["card-0"]}
        cardCache={cache}
      />,
    );
    expect(screen.getByText("Medium")).toBeTruthy();
  });

  it('shows "Hard" difficulty badge', () => {
    const cache = makeCardCache(1);
    render(
      <DraftSummary
        sessionId="s5"
        setCode="neo"
        kind="phantom"
        difficulty="hard"
        cardIds={["card-0"]}
        cardCache={cache}
      />,
    );
    expect(screen.getByText("Hard")).toBeTruthy();
  });

  it("renders no difficulty badge when difficulty is omitted", () => {
    const cache = makeCardCache(1);
    render(
      <DraftSummary
        sessionId="s6"
        setCode="neo"
        kind="phantom"
        cardIds={["card-0"]}
        cardCache={cache}
      />,
    );
    // None of the difficulty labels should appear.
    expect(screen.queryByText("Easy")).toBeNull();
    expect(screen.queryByText("Medium")).toBeNull();
    expect(screen.queryByText("Hard")).toBeNull();
  });
});

describe("DraftSummary — empty pool", () => {
  it("renders without crashing even when cardIds is empty", () => {
    expect(() =>
      render(
        <DraftSummary
          sessionId="s7"
          setCode="neo"
          kind="phantom"
          cardIds={[]}
          cardCache={new Map()}
        />,
      ),
    ).not.toThrow();
  });

  it("does NOT render PoolStats or pick grid when cardIds is empty", () => {
    render(
      <DraftSummary
        sessionId="s8"
        setCode="neo"
        kind="phantom"
        cardIds={[]}
        cardCache={new Map()}
      />,
    );
    expect(screen.queryByTestId("pool-stats")).toBeNull();
    expect(screen.queryByTestId("card-image")).toBeNull();
  });
});
