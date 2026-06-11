import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { AllowlistEntry } from "@/lib/models/AllowlistEntry";
import { User } from "@/lib/models/User";

const toggleSchema = z.object({
  allowed: z.boolean(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ uid: string }> },
) {
  const guard = await guardApiRequest("admin-allowlist", { limit: 60 });
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

  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  await connectToDatabase();

  const target = await User.findOne({ uid: targetUid }).lean();
  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  if (parsed.data.allowed) {
    await AllowlistEntry.findOneAndUpdate(
      { email: target.email },
      { $set: { email: target.email, role: target.role ?? "user" } },
      { upsert: true },
    );
  } else {
    await AllowlistEntry.deleteOne({ email: target.email });
  }

  await User.updateOne({ uid: targetUid }, { $set: { isAllowlisted: parsed.data.allowed } });

  return NextResponse.json({ uid: targetUid, allowed: parsed.data.allowed });
}
