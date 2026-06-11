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

  // Atomically claim the bonus for today if it hasn't been claimed yet.
  const before = await User.findOneAndUpdate(
    {
      uid: guard.user.uid,
      $or: [
        { lastDailyBonusAt: { $exists: false } },
        { lastDailyBonusAt: { $lt: todayUtc } },
      ],
    },
    { $set: { lastDailyBonusAt: new Date() } },
    { returnDocument: "before" },
  ).lean();

  if (!before) {
    // Already claimed today — return current balance.
    const user = await User.findOne(
      { uid: guard.user.uid },
      { vaultCoins: 1 },
    ).lean();
    return NextResponse.json({
      claimed: false,
      bonus: 0,
      newBalance: user?.vaultCoins ?? 0,
    });
  }

  const isFirstTime = !before.lastDailyBonusAt;
  const reason = isFirstTime ? "first_time_bonus" : "daily_bonus";
  const amount = isFirstTime
    ? GAME_CONFIG.FIRST_TIME_BONUS
    : GAME_CONFIG.DAILY_BONUS;

  const { newBalance } = await creditWallet(guard.user.uid, amount, reason);

  return NextResponse.json({ claimed: true, bonus: amount, newBalance, isFirstTime });
}
