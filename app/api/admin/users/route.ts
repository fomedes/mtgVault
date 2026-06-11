import { NextResponse } from "next/server";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";

export async function GET() {
  const guard = await guardApiRequest("admin-users", { limit: 30 });
  if (!guard.ok) return guard.response;

  if (guard.user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await connectToDatabase();

  const users = await User.find(
    {},
    { uid: 1, email: 1, displayName: 1, role: 1, vaultCoins: 1, isAllowlisted: 1, lastLoginAt: 1 },
  )
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ users });
}
