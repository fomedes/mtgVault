import Link from "next/link";

export function AchievementsProgress({
  earned,
  total,
}: {
  earned: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((earned / total) * 100) : 0;

  return (
    <section className="bg-card rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Achievements</h2>
        <Link
          href="/achievements"
          className="text-muted-foreground hover:text-foreground text-xs"
        >
          View all →
        </Link>
      </div>
      <p className="text-sm">
        <span className="font-bold tabular-nums">{earned}</span>
        <span className="text-muted-foreground"> / {total} unlocked</span>
      </p>
      <div
        className="bg-muted mt-2 h-2 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={earned}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Achievements unlocked"
      >
        <div
          className="bg-primary h-full rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </section>
  );
}
