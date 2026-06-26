/**
 * CORS origin policy for the Socket.io server.
 *
 * The connection's real security gate is the handshake middleware (Firebase ID
 * token + allowlist re-check in server/index.ts) — CORS only decides which
 * browser origins may *attempt* a connection. To stop a drifting LAN IP from
 * silently breaking cross-device play, we allow, in addition to the configured
 * production origins, localhost and any private-LAN host. Everything else is
 * rejected (and logged once).
 */

/** Split a comma-separated `SOCKET_CORS_ORIGIN` env value into trimmed origins. */
export function parseOrigins(envOrigins: string): string[] {
  return envOrigins
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

/** True for RFC 1918 private IPv4 hosts (10/8, 172.16/12, 192.168/16). */
function isPrivateLanHost(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const octets = m.slice(1).map(Number);
  if (octets.some((n) => n > 255)) return false;
  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/**
 * Decide whether a browser `Origin` may open a socket connection.
 * A missing Origin (non-browser clients: curl, the node test client,
 * server-to-server) is allowed — CORS is a browser-only control.
 */
export function isOriginAllowed(
  origin: string | undefined,
  envOrigins: string,
): boolean {
  if (!origin) return true;
  if (parseOrigins(envOrigins).includes(origin)) return true;

  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return false;
  }
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return true;
  }
  return isPrivateLanHost(host);
}

type OriginCallback = (err: Error | null, allow?: boolean) => void;

/**
 * Build the `cors.origin` function Socket.io expects. Allowed origins are
 * reflected; unknown origins are denied (no `Access-Control-Allow-Origin`
 * header) and logged once so a misconfiguration is visible in the server logs
 * instead of presenting as a silent client hang.
 */
export function makeOriginValidator(
  envOrigins: string,
): (origin: string | undefined, callback: OriginCallback) => void {
  const rejected = new Set<string>();
  return (origin, callback) => {
    if (isOriginAllowed(origin, envOrigins)) return callback(null, true);
    if (origin && !rejected.has(origin)) {
      rejected.add(origin);
      console.warn(`[socket] rejected CORS origin: ${origin}`);
    }
    callback(null, false);
  };
}
