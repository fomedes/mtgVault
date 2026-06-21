import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { normalizeEmail } from "@/lib/auth/allowlist";
import { connectToDatabase } from "@/lib/db";
import { AllowlistEntry } from "@/lib/models/AllowlistEntry";
import { User } from "@/lib/models/User";

const addSchema = z.object({
  email: z.string().email(),
});

const deleteSchema = z.object({
  email: z.string().email(),
});

export async function GET() {
  const guard = await guardApiRequest("admin-allowlist-get", { limit: 60 });
  if (!guard.ok) return guard.response;
  if (guard.user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await connectToDatabase();

  const entries = await AllowlistEntry.find().lean();
  const emails = entries.map((e) => e.email);

  const users = emails.length > 0
    ? await User.find({ email: { $in: emails } }, { email: 1 }).lean()
    : [];
  const userEmails = new Set(users.map((u) => u.email));

  const whitelists = entries.map((entry) => ({
    email: entry.email,
    status: userEmails.has(entry.email) ? "active" : "pending",
    addedBy: entry.addedBy,
    createdAt: entry.createdAt,
  }));

  return NextResponse.json({ whitelists });
}

export async function POST(request: Request) {
  const guard = await guardApiRequest("admin-allowlist-add", { limit: 60 });
  if (!guard.ok) return guard.response;
  if (guard.user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const normalizedEmail = normalizeEmail(parsed.data.email);

  await connectToDatabase();

  const existing = await AllowlistEntry.findOne({ email: normalizedEmail });
  if (existing) {
    return NextResponse.json({ error: "already_allowlisted" }, { status: 409 });
  }

  const user = await User.findOne({ email: normalizedEmail }).lean();

  const entry = await AllowlistEntry.create({
    email: normalizedEmail,
    role: "user",
    addedBy: guard.user.displayName || guard.user.email,
  });

  return NextResponse.json({
    email: entry.email,
    status: user ? "active" : "pending",
    addedBy: entry.addedBy,
    createdAt: entry.createdAt,
  });
}

export async function DELETE(request: Request) {
  const guard = await guardApiRequest("admin-allowlist-delete", { limit: 60 });
  if (!guard.ok) return guard.response;
  if (guard.user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const normalizedEmail = normalizeEmail(parsed.data.email);

  await connectToDatabase();

  const result = await AllowlistEntry.deleteOne({ email: normalizedEmail });
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ email: normalizedEmail });
}
