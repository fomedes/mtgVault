/**
 * In-memory presence registry: tracks UIDs of currently connected socket
 * clients. Used by the Friends API to surface online status.
 *
 * Note: this is per-process memory. On a multi-instance deployment each
 * instance has its own set; for this invite-only app that is acceptable.
 * (The Next.js API routes import this module from the socket server process
 * via the shared in-process module cache only when co-located. For the
 * deployed split-process setup, the friends list API uses `lastLoginAt` as
 * the recency signal instead — see lib/game/dashboard.ts comment.)
 */

const connectedUids = new Set<string>();

export function markOnline(uid: string): void {
  connectedUids.add(uid);
}

export function markOffline(uid: string): void {
  connectedUids.delete(uid);
}

export function isOnline(uid: string): boolean {
  return connectedUids.has(uid);
}

export function getOnlineUids(): ReadonlySet<string> {
  return connectedUids;
}
