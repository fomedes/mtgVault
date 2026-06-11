import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { creditWallet } from "@/lib/game/wallet";
import { User } from "@/lib/models/User";

const grantSchema = z.object({
  amount: z.number().int().min(1).max(10_000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  const guard = await guardApiRequest("admin-wallet-grant", { limit: 60 });
  if (!guard.ok) return guard.response;
  if (guard.user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { uid: targetUid } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = grantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const target = await User.findOne({ uid: targetUid }, { uid: 1 }).lean();
  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const { newBalance } = await creditWallet(
    targetUid,
    parsed.data.amount,
    "admin_grant",
    { grantedBy: guard.user.uid },
  );

  return NextResponse.json({ granted: parsed.data.amount, newBalance });
}
