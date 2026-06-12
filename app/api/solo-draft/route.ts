import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { createSoloDraft, listSoloDrafts } from "@/lib/game/solo-draft";

const CreateSchema = z.object({
  setCode: z.string().min(2).max(10),
  difficulty: z.enum(["easy", "medium", "hard"]),
  numPacks: z.number().int().min(1).max(3).default(3),
});

export async function GET() {
  const guard = await guardApiRequest("solo-draft-list");
  if (!guard.ok) return guard.response;

  const sessions = await listSoloDrafts(guard.user.uid);
  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  const guard = await guardApiRequest("solo-draft-create", { limit: 10, windowMs: 60_000 });
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.issues }, { status: 422 });
  }

  try {
    const view = await createSoloDraft(guard.user.uid, parsed.data.setCode, parsed.data.difficulty, parsed.data.numPacks);
    return NextResponse.json({ session: view }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
