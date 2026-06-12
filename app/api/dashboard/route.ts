import { NextResponse } from "next/server";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { getDashboardData } from "@/lib/game/dashboard";

export async function GET() {
  const guard = await guardApiRequest("dashboard");
  if (!guard.ok) return guard.response;

  const data = await getDashboardData(guard.user.uid, guard.user.vaultCoins);
  return NextResponse.json(data);
}
