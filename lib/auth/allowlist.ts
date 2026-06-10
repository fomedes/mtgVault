export type AllowlistRole = "user" | "admin";

export interface AllowlistDecision {
  allowed: boolean;
  role: AllowlistRole;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Pure decision logic, kept free of I/O so it is trivially unit-testable.
 * `entry` is the AllowlistEntry doc for the email, or null when absent.
 */
export function evaluateAllowlist(
  entry: { role?: string | null } | null | undefined,
): AllowlistDecision {
  if (!entry) return { allowed: false, role: "user" };
  return { allowed: true, role: entry.role === "admin" ? "admin" : "user" };
}
