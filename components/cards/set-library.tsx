"use client";

import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { BlockGroup, SetSummary } from "@/lib/sets-grouping";

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  storageKey: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function useCollapseState(key: string, defaultOpen: boolean) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) setOpen(stored === "1");
    } catch { /* ignore */ }
  }, [key]);
  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem(key, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }, [key]);
  return [open, toggle] as const;
}

function CollapsibleSection({ title, subtitle, storageKey, children, defaultOpen = true }: CollapsibleSectionProps) {
  const [open, toggle] = useCollapseState(storageKey, defaultOpen);
  return (
    <section>
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 py-2 text-left transition-colors hover:opacity-80"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDownIcon className="size-4 shrink-0" />
        ) : (
          <ChevronRightIcon className="size-4 shrink-0" />
        )}
        <span className="font-semibold tracking-tight">{title}</span>
        {subtitle && (
          <span className="text-muted-foreground text-sm font-normal">{subtitle}</span>
        )}
      </button>
      {open ? children : null}
    </section>
  );
}

function SetTile({ set }: { set: SetSummary }) {
  const icon = set.iconSvgUri ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={set.iconSvgUri}
      alt=""
      aria-hidden
      className={`size-9 shrink-0 invert${!set.synced ? " opacity-40" : ""}`}
    />
  ) : (
    <div className="bg-muted size-9 shrink-0 rounded-full" />
  );

  const text = (
    <div className="min-w-0">
      <p className={`truncate font-semibold${!set.synced ? " text-muted-foreground" : ""}`}>
        {set.name || set.code.toUpperCase()}
      </p>
      <p className="text-muted-foreground text-sm">
        {set.code.toUpperCase()}
        {set.releasedAt ? ` · ${new Date(set.releasedAt).getFullYear()}` : ""}
        {set.synced ? ` · ${set.cardCount} cards` : " · Coming soon"}
      </p>
    </div>
  );

  if (!set.synced) {
    return (
      <div className="bg-card/60 flex cursor-not-allowed items-center gap-4 rounded-lg border border-dashed p-4 opacity-60">
        {icon}
        {text}
      </div>
    );
  }

  return (
    <Link
      href={`/cards/${set.code}`}
      className="bg-card hover:bg-muted/60 focus-visible:ring-ring/50 flex items-center gap-4 rounded-lg border p-4 transition-colors outline-none focus-visible:ring-3"
    >
      {icon}
      {text}
    </Link>
  );
}

export interface SetLibraryProps {
  blocks: BlockGroup[];
  standalone: SetSummary[];
  standaloneYearRange?: string | null;
}

export function SetLibrary({ blocks, standalone, standaloneYearRange }: SetLibraryProps) {
  if (blocks.length === 0 && standalone.length === 0) {
    return (
      <div className="bg-card rounded-lg border p-8 text-center">
        <p className="font-semibold">No sets available</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Run <code className="font-mono">pnpm seed:sets</code> and then{" "}
          <code className="font-mono">pnpm sync:set --all</code> to fill the vault.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {standalone.length > 0 && (
        <CollapsibleSection
          title="Recent Sets"
          subtitle={standaloneYearRange ?? undefined}
          storageKey="set-block-open:standalone"
        >
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {standalone.map((set) => (
              <SetTile key={set.code} set={set} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {blocks.map((block) => (
        <CollapsibleSection
          key={block.id}
          title={block.name}
          subtitle={block.yearRange ?? undefined}
          storageKey={`set-block-open:${block.id}`}
        >
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {block.sets.map((set) => (
              <SetTile key={set.code} set={set} />
            ))}
          </div>
        </CollapsibleSection>
      ))}
    </div>
  );
}
