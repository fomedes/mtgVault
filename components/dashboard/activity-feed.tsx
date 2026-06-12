import type { FeedEvent } from "@/lib/game/dashboard";

function FeedIcon({ type }: { type: FeedEvent["type"] }) {
  if (type === "achievement") {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-yellow-500/20 text-xs text-yellow-400">
        ★
      </span>
    );
  }
  if (type === "draft_complete") {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs text-violet-400">
        ⚔
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs text-emerald-400">
      ◈
    </span>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function ActivityFeed({ feed }: { feed: FeedEvent[] }) {
  if (feed.length === 0) {
    return (
      <p className="text-muted-foreground py-4 text-center text-sm">
        No activity yet — open a booster pack or join a draft to get started.
      </p>
    );
  }

  return (
    <ol className="space-y-1">
      {feed.map((event, i) => (
        <li key={i} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/40">
          <FeedIcon type={event.type} />
          <span className="min-w-0 flex-1">
            <span className="text-sm font-medium">{event.label}</span>
            {event.detail ? (
              <span className="text-muted-foreground ml-2 text-xs">{event.detail}</span>
            ) : null}
          </span>
          <span className="text-muted-foreground shrink-0 text-xs">{timeAgo(event.date)}</span>
        </li>
      ))}
    </ol>
  );
}
