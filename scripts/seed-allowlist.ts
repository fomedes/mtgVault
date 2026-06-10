import "@/lib/load-env";

import mongoose from "mongoose";
import { normalizeEmail } from "@/lib/auth/allowlist";
import { connectToDatabase } from "@/lib/db";
import { AllowlistEntry } from "@/lib/models/AllowlistEntry";

function parseArgs(argv: string[]): { email?: string; role: "user" | "admin" } {
  const result: { email?: string; role: "user" | "admin" } = { role: "user" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--email") result.email = argv[++i];
    if (argv[i] === "--role") {
      const role = argv[++i];
      if (role !== "user" && role !== "admin") {
        throw new Error(`--role must be "user" or "admin", got "${role}"`);
      }
      result.role = role;
    }
  }
  return result;
}

async function main() {
  const { email, role } = parseArgs(process.argv.slice(2));
  if (!email) {
    console.log(
      "Usage: pnpm seed:allowlist --email someone@gmail.com [--role admin]",
    );
    process.exit(1);
  }

  await connectToDatabase();
  const entry = await AllowlistEntry.findOneAndUpdate(
    { email: normalizeEmail(email) },
    { $set: { role, addedBy: "seed-script" } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  console.log(`Allowlisted ${entry?.email} as ${entry?.role}`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
