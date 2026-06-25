/**
 * Pure geometry for a battlefield lane: given the measured lane box and a card
 * count, work out how wide each card is (from the lane HEIGHT, so cards scale to
 * the viewport) and how much they must overlap to fit the lane WIDTH without
 * scrolling. The never-scroll guarantee lives here.
 */

/** MTG card aspect ratio (width / height). */
export const CARD_ASPECT = 5 / 7;

export interface LaneOverlap {
  /**
   * Card width in px. Normally lane height × aspect, but shrinks below that when
   * even a minimum-sliver overlap would overflow the lane (extreme card counts),
   * so the row always fits without scrolling.
   */
  cardWidth: number;
  /** Centre-to-centre distance between adjacent cards (px). */
  step: number;
  /** Per-card left offset after the first; negative when cards overlap. */
  overlapMargin: number;
  /** Total width the laid-out row occupies (px); never exceeds laneWidth. */
  rowWidth: number;
}

export interface LaneOverlapParams {
  count: number;
  laneWidth: number;
  laneHeight: number;
  /** Breathing room between cards when they fit, as a fraction of card width. */
  gapRatio?: number;
  /** Minimum visible sliver per card when compressed, as a fraction of width. */
  minStepRatio?: number;
}

export function computeLaneOverlap({
  count,
  laneWidth,
  laneHeight,
  gapRatio = 0.08,
  minStepRatio = 0.18,
}: LaneOverlapParams): LaneOverlap {
  const maxCardWidth = laneHeight * CARD_ASPECT;

  if (count <= 0 || maxCardWidth <= 0) {
    return {
      cardWidth: maxCardWidth,
      step: maxCardWidth,
      overlapMargin: 0,
      rowWidth: 0,
    };
  }
  if (count === 1) {
    return {
      cardWidth: maxCardWidth,
      step: maxCardWidth,
      overlapMargin: 0,
      rowWidth: maxCardWidth,
    };
  }

  const gap = gapRatio * maxCardWidth;
  const naturalWidth = count * maxCardWidth + (count - 1) * gap;

  let cardWidth = maxCardWidth;
  let step: number;

  if (naturalWidth <= laneWidth || laneWidth <= 0) {
    // Everything fits — space cards out with a positive gap.
    step = cardWidth + gap;
  } else {
    // Compress: distribute width so the last card's right edge lands at laneWidth.
    step = (laneWidth - cardWidth) / (count - 1);
    const minStep = minStepRatio * cardWidth;
    if (step < minStep) {
      // Even a minimum-sliver overlap overflows at full height — shrink the cards
      // (keeping the sliver ratio) so the whole row fits. cardWidth solves:
      //   cardWidth · (1 + minStepRatio·(count − 1)) = laneWidth
      cardWidth = laneWidth / (1 + minStepRatio * (count - 1));
      step = minStepRatio * cardWidth;
    }
  }

  const overlapMargin = step - cardWidth;
  const rowWidth = cardWidth + step * (count - 1);
  return { cardWidth, step, overlapMargin, rowWidth };
}
