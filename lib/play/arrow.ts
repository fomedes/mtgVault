/**
 * Ephemeral targeting arrows — purely cosmetic intent signalling in a manual
 * game (declare an attacker, point at a blocker, indicate a removal target).
 * Never persisted: broadcast like `play:reveal`, drawn briefly, then gone.
 */

export type ArrowTarget =
  | { kind: "seat"; seat: number }
  | { kind: "card"; instanceId: string };

export interface ArrowEvent {
  /** Seat that drew the arrow (derived server-side). */
  by: number;
  /** Source battlefield instanceId. */
  source: string;
  target: ArrowTarget;
  /** Server timestamp; the overlay fades the arrow out after a short TTL. */
  at: number;
}

/** Window CustomEvent name an attack handle dispatches to begin a drag. */
export const ARROW_START_EVENT = "play:arrow-start";

export interface ArrowStartDetail {
  sourceId: string;
  x: number;
  y: number;
}
