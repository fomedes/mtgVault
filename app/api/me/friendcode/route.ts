import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";

/**
 * GET /api/me/friendcode
 * Returns the current user's 8-digit friend code, generating it lazily if
 * it doesn't exist yet. Rate-limited to 30 req/min.
 */
export async function GET() {
  const guard = await guardApiRequest("me:friendcode", {
    limit: 30,
    windowMs: 60_000,
  });
  if (!guard.ok) return guard.response;

  await connectToDatabase();

  const user = await User.findOne(
    { uid: guard.user.uid },
    { friendCode: 1 },
  ).lean();

  if (user?.friendCode) {
    return NextResponse.json({ friendCode: user.friendCode });
  }

  // Lazily generate a unique 8-digit numeric code.
  let code: string;
  let attempts = 0;
  do {
    // randomInt(min, max) returns integer in [min, max)
    // 10_000_000–99_999_999 guarantees exactly 8 digits.
    code = randomInt(10_000_000, 100_000_000).toString();
    attempts++;
    if (attempts > 20) {
      return NextResponse.json(
        { error: "could not generate unique code" },
        { status: 500 },
      );
    }
  } while (await User.exists({ friendCode: code }));

  await User.updateOne({ uid: guard.user.uid }, { $set: { friendCode: code } });

  return NextResponse.json({ friendCode: code });
}
