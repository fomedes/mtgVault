"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SavedDraftOption {
  sessionId: string;
  setCode: string;
  pickCount: number;
  completedAt: string;
}

type Mode = "pick" | "empty" | "collection" | "draft";

export function NewDeckDialog({ onCreated }: { onCreated: (deckId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("pick");
  const [name, setName] = useState("");
  const [drafts, setDrafts] = useState<SavedDraftOption[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && mode === "draft" && drafts.length === 0) {
      fetch("/api/history")
        .then((r) => r.json())
        .then((d: { drafts: SavedDraftOption[] }) => setDrafts(d.drafts ?? []))
        .catch(() => undefined);
    }
  }, [open, mode, drafts.length]);

  function reset() {
    setMode("pick");
    setName("");
    setSelectedDraftId("");
    setError(null);
  }

  async function handleCreate(source: "empty" | "collection" | "draft") {
    const deckName = name.trim() || defaultName(source);
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { name: deckName };
      if (source === "draft" && selectedDraftId) {
        body.sourceDraftId = selectedDraftId;
        // We don't pre-load cards here; the builder page can load them
      }
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { deck?: { id: string }; error?: string };
      if (!res.ok) { setError(data.error ?? "Failed to create deck"); return; }
      setOpen(false);
      reset();
      onCreated(data.deck!.id);
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function defaultName(source: "empty" | "collection" | "draft"): string {
    if (source === "draft") {
      const d = drafts.find((dr) => dr.sessionId === selectedDraftId);
      return d ? `Draft — ${d.setCode.toUpperCase()}` : "New Deck";
    }
    return "New Deck";
  }

  return (
    <>
      <Button onClick={() => { reset(); setOpen(true); }}>+ New Deck</Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) { setOpen(false); reset(); } }}>
        <DialogContent className="p-6">
          <DialogTitle>Create a new deck</DialogTitle>
          <DialogDescription>
            Choose how you want to start building.
          </DialogDescription>

          {mode === "pick" ? (
            <div className="mt-4 grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => setMode("empty")}
                className="bg-card hover:bg-muted/60 rounded-lg border px-4 py-4 text-left transition-colors"
              >
                <p className="font-semibold">Empty deck</p>
                <p className="text-muted-foreground text-sm">Start blank, add any card from the full database.</p>
              </button>
              <button
                type="button"
                onClick={() => setMode("collection")}
                className="bg-card hover:bg-muted/60 rounded-lg border px-4 py-4 text-left transition-colors"
              >
                <p className="font-semibold">From my collection</p>
                <p className="text-muted-foreground text-sm">Start blank, add cards from cards you already own.</p>
              </button>
              <button
                type="button"
                onClick={() => setMode("draft")}
                className="bg-card hover:bg-muted/60 rounded-lg border px-4 py-4 text-left transition-colors"
              >
                <p className="font-semibold">From a draft pick list</p>
                <p className="text-muted-foreground text-sm">Import picks from a completed draft as your starting list.</p>
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="deck-name">Deck name</label>
                <input
                  id="deck-name"
                  type="text"
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={defaultName(mode as "empty" | "collection" | "draft")}
                  className="border-input bg-background focus-visible:border-ring h-9 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                />
              </div>

              {mode === "draft" && (
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="draft-select">Pick list</label>
                  {drafts.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No completed drafts found.</p>
                  ) : (
                    <select
                      id="draft-select"
                      value={selectedDraftId}
                      onChange={(e) => setSelectedDraftId(e.target.value)}
                      className="border-input bg-background h-9 w-full rounded-lg border px-2 text-sm"
                    >
                      <option value="">Select a draft…</option>
                      {drafts.map((d) => (
                        <option key={d.sessionId} value={d.sessionId}>
                          {d.setCode.toUpperCase()} · {d.pickCount} picks ·{" "}
                          {new Date(d.completedAt).toLocaleDateString()}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {error ? <p className="text-destructive text-sm">{error}</p> : null}

              <div className="flex gap-2">
                <Button
                  onClick={() => handleCreate(mode as "empty" | "collection" | "draft")}
                  disabled={busy || (mode === "draft" && !selectedDraftId)}
                >
                  {busy ? "Creating…" : "Create deck"}
                </Button>
                <Button variant="ghost" onClick={() => setMode("pick")}>Back</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
