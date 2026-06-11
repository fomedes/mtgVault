import "@/lib/load-env";

import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { syncSet } from "@/lib/mtg-api/sync";
import { CardSet } from "@/lib/models/CardSet";

function parseArgs(argv: string[]): {
  codes: string[];
  all: boolean;
  force: boolean;
} {
  const codes: string[] = [];
  let all = false;
  let force = false;
  for (const arg of argv) {
    if (arg === "--all") all = true;
    else if (arg === "--force") force = true;
    else if (!arg.startsWith("-")) codes.push(arg);
  }
  return { codes, all, force };
}

async function main() {
  const { codes, all, force } = parseArgs(process.argv.slice(2));

  await connectToDatabase();
  let targets = codes;
  if (all) {
    const enabled = await CardSet.find({ enabled: true })
      .sort({ code: 1 })
      .lean();
    targets = enabled.map((set) => set.code);
  }
  if (targets.length === 0) {
    console.log("Usage: pnpm sync:set <code> [<code> ...] [--force]");
    console.log("       pnpm sync:set --all [--force]   (all enabled sets)");
    process.exit(1);
  }

  let failures = 0;
  for (const code of targets) {
    try {
      await syncSet(code, { force });
    } catch (error) {
      failures++;
      console.error(
        `[sync:${code}] FAILED:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  await mongoose.disconnect();
  if (failures > 0) {
    console.error(`${failures} of ${targets.length} sets failed to sync.`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Sync failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
