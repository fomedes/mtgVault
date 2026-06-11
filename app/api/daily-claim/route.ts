import { NextResponse } from "next/server";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { GAME_CONFIG } from "@/lib/game/config";
import { creditWallet } from "@/lib/game/wallet";
import { User } from "@/lib/models/User";

export async function POST() {
  const guard = await guardApiRequest("daily-claim", { limit: 10 });
  if (!guard.ok) return guard.response;

  await connectToDatabase();

  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);

  // Read the user first so we can check isFirstTime and return the
  // pre-update balance if the claim has already been made today.
  const user = await User.findOne(
    { uid: guard.user.uid },
    { lastDailyBonusAt: 1, vaultCoins: 1 },
  ).lean();

  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  // Fast-path: already claimed today — skip the write entirely.
  if (user.lastDailyBonusAt && user.lastDailyBonusAt >= todayUtc) {
    return NextResponse.json({
      claimed: false,
      bonus: 0,
      newBalance: user.vaultCoins ?? 0,
    });
  }

  // Atomically stamp today's UTC date.  updateOne returns matchedCount so we
  // know unambiguously whether another concurrent request beat us to it.
  const result = await User.updateOne(
    {
      uid: guard.user.uid,
      $or: [
        { lastDailyBonusAt: { $exists: false } },
        { lastDailyBonusAt: { $lt: todayUtc } },
      ],
    },
    { $set: { lastDailyBonusAt: new Date() } },
  );

  if (result.matchedCount === 0) {
    // Race condition — another request claimed first.
    return NextResponse.json({
      claimed: false,
      bonus: 0,
      newBalance: user.vaultCoins ?? 0,
    });
  }

  const isFirstTime = !user.lastDailyBonusAt;
  const reason = isFirstTime ? "first_time_bonus" : "daily_bonus";
  const amount = isFirstTime
    ? GAME_CONFIG.FIRST_TIME_BONUS
    : GAME_CONFIG.DAILY_BONUS;

  const { newBalance } = await creditWallet(guard.user.uid, amount, reason);

  return NextResponse.json({ claimed: true, bonus: amount, newBalance, isFirstTime });
}
