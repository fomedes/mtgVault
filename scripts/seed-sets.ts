import "@/lib/load-env";

import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { CardSet } from "@/lib/models/CardSet";

/**
 * Initial curated draftable sets (D2), confirmed by the owner 2026-06-11.
 * Expand via the admin UI (Phase 3) — never a code change.
 */
const CURATED_SET_CODES = [
  "ktk", // Khans of Tarkir
  "dom", // Dominaria
  "mh2", // Modern Horizons 2
  "neo", // Kamigawa: Neon Dynasty
  "one", // Phyrexia: All Will Be One
  "ltr", // The Lord of the Rings: Tales of Middle-earth
  "woe", // Wilds of Eldraine
  "lci", // The Lost Caverns of Ixalan
  "mkm", // Murders at Karlov Manor
  "otj", // Outlaws of Thunder Junction
  "blb", // Bloomburrow
  "dsk", // Duskmourn: House of Horror
];

async function main() {
  await connectToDatabase();
  for (const code of CURATED_SET_CODES) {
    await CardSet.updateOne(
      { code },
      { $set: { enabled: true } },
      { upsert: true },
    );
  }
  const enabled = await CardSet.countDocuments({ enabled: true });
  console.log(
    `Seeded ${CURATED_SET_CODES.length} curated sets (${enabled} enabled total). Run "pnpm sync:set --all" to fetch card data.`,
  );
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
