import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";
import { BACKGROUND_IDS } from "@/lib/backgrounds";

/** Background id is constrained to the manifest — never a free string/path. */
const bodySchema = z.object({
  background: z.enum(BACKGROUND_IDS as [string, ...string[]]),
});

export async function PATCH(request: Request) {
  const guard = await guardApiRequest("me-preferences");
  if (!guard.ok) return guard.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  await connectToDatabase();
  await User.updateOne(
    { uid: guard.user.uid },
    { $set: { "preferences.background": parsed.data.background } },
  );

  return NextResponse.json({ ok: true, background: parsed.data.background });
}
