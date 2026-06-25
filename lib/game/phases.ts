/**
 * Manual turn-phase model. The engine enforces no rules, so phases are a shared,
 * advisory marker (like flipping a phase card on a physical table) — purely to
 * keep players in sync about where the turn is. Pure + unit-testable; no I/O.
 */

export const PHASES = [
  "untap",
  "upkeep",
  "draw",
  "main1",
  "combat",
  "main2",
  "end",
] as const;

export type Phase = (typeof PHASES)[number];

export const FIRST_PHASE: Phase = PHASES[0];

/** Short human labels for the phase bar. */
export const PHASE_LABELS: Record<Phase, string> = {
  untap: "Untap",
  upkeep: "Upkeep",
  draw: "Draw",
  main1: "Main 1",
  combat: "Combat",
  main2: "Main 2",
  end: "End",
};

/** Advance to the next phase, clamping at the final ("end") phase. */
export function nextPhase(phase: Phase): Phase {
  const i = PHASES.indexOf(phase);
  if (i < 0) return FIRST_PHASE;
  return PHASES[Math.min(i + 1, PHASES.length - 1)];
}

/** True when the phase is the last one in the turn (no further `nextPhase`). */
export function isLastPhase(phase: Phase): boolean {
  return phase === PHASES[PHASES.length - 1];
}
