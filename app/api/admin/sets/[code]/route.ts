import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { CardSet } from "@/lib/models/CardSet";

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  boosterPrice: z.number().int().min(0).max(10_000).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const guard = await guardApiRequest("admin-set-patch", { limit: 60 });
  if (!guard.ok) return guard.response;
  if (guard.user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { code } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "no_fields_to_update" }, { status: 400 });
  }

  await connectToDatabase();

  const updated = await CardSet.findOneAndUpdate(
    { code: code.toLowerCase() },
    { $set: parsed.data },
    { new: true },
  ).lean();

  if (!updated) {
    return NextResponse.json({ error: "set_not_found" }, { status: 404 });
  }

  return NextResponse.json({
    code: updated.code,
    enabled: updated.enabled,
    boosterPrice: updated.boosterPrice,
  });
}
