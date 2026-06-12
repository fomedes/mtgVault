"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface AvailableSet {
  code: string;
  name: string;
}

interface Props {
  availableSets: AvailableSet[];
}

const DIFFICULTY_OPTIONS = [
  { value: "easy", label: "Easy — bots pick randomly" },
  { value: "medium", label: "Medium — bots prefer 2-colour builds" },
  { value: "hard", label: "Hard — bots optimise rarity, curve, and colour" },
] as const;

const PACK_OPTIONS = [
  { value: 1, label: "1 pack (15 picks)" },
  { value: 2, label: "2 packs (30 picks)" },
  { value: 3, label: "3 packs (45 picks)" },
  { value: 4, label: "4 packs (60 picks)" },
  { value: 5, label: "5 packs (75 picks)" },
] as const;

type Difficulty = "easy" | "medium" | "hard";

export function SoloDraftSetup({ availableSets }: Props) {
  const router = useRouter();
  const [setCode, setSetCode] = useState(availableSets[0]?.code ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [numPacks, setNumPacks] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    if (!setCode) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/solo-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setCode, difficulty, numPacks }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "Failed to start draft");
      }

      const data = await res.json() as { session: { sessionId: string } };
      router.push(`/solo-draft/${data.session.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start draft");
      setLoading(false);
    }
  }

  if (availableSets.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No sets are available for drafting. Ask an admin to sync a set first.
      </p>
    );
  }

  const selectClass =
    "w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50";

  return (
    <div className="space-y-4 rounded-lg border p-6 max-w-sm">
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="setCode">
          Set
        </label>
        <select
          id="setCode"
          value={setCode}
          onChange={(e) => setSetCode(e.target.value)}
          className={selectClass}
        >
          {availableSets.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="difficulty">
          Difficulty
        </label>
        <select
          id="difficulty"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          className={selectClass}
        >
          {DIFFICULTY_OPTIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="numPacks">
          Boosters per player
        </label>
        <select
          id="numPacks"
          value={numPacks}
          onChange={(e) => setNumPacks(Number(e.target.value))}
          className={selectClass}
        >
          {PACK_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Button
        onClick={handleStart}
        disabled={loading || !setCode}
        className="w-full"
      >
        {loading ? "Starting…" : "Start Solo Draft"}
      </Button>
    </div>
  );
}
