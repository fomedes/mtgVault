/**
 * Post-draft completion: ingest all picks into collections, save SavedDecks,
 * award VC, fire first_draft achievement.
 */

import { Types } from "mongoose";
import { addCards } from "@/lib/game/collection";
import { GAME_CONFIG } from "@/lib/game/config";
import { creditWallet } from "@/lib/game/wallet";
import { awardAchievement } from "@/lib/game/achievements";
import { SavedDeck } from "@/lib/models/SavedDeck";
import type { DraftState } from "@/lib/game/draft";

export async function completeDraft(state: DraftState): Promise<void> {
  const ops: Promise<void>[] = [];

  for (const player of state.players) {
    const { uid, seatIndex } = player;
    const cardObjectIds = state.picks[seatIndex]
      .map((id) => {
        try {
          return new Types.ObjectId(id);
        } catch {
          return null;
        }
      })
      .filter((id): id is Types.ObjectId => id !== null);

    // 1. Ingest picks into the player's collection.
    if (cardObjectIds.length > 0) {
      ops.push(addCards(uid, cardObjectIds, "draft"));
    }

    // 2. Save the read-only draft deck.
    ops.push(
      SavedDeck.create({
        userId: uid,
        sessionId: state.sessionId,
        setCode: state.setCode,
        cardIds: state.picks[seatIndex],
        kind: 'multiplayer',
      }).then(() => undefined),
    );

    // 3. Award draft completion VC.
    ops.push(
      creditWallet(uid, GAME_CONFIG.DRAFT_REWARD_BASE, "draft_reward", {
        setCode: state.setCode,
      }).then(() => undefined),
    );

    // 4. Fire first_draft achievement (idempotent).
    ops.push(awardAchievement(uid, "first_draft").then(() => undefined));
  }

  await Promise.allSettled(ops);
}
