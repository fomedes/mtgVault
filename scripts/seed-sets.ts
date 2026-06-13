import "@/lib/load-env";

import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { CardSet } from "@/lib/models/CardSet";
import { scryfall } from "@/lib/mtg-api/client";
import { getBlockEntry } from "@/lib/blocks";
import type { ScryfallList, ScryfallSet } from "@/lib/mtg-api/types";

/**
 * Set types that have draft/booster formats.
 * Excludes commander, token, promo, digital-only, un-sets, etc.
 */
const DRAFTABLE_TYPES = new Set([
  "expansion",
  "core",
  "draft_innovation",
  "masters",
]);

/**
 * Sets enabled for drafting by default. Admins can toggle more via the UI.
 * All other seeded sets default to enabled: false.
 */
const ENABLED_SET_CODES = new Set([
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
  "rtr", // Return to Ravnica
  "ons", // Onslaught
  "usg", // Urza's Saga
  "ulg", // Urza's Legacy
  "uds", // Urza's Destiny
  "rav", // Ravnica: City of Guilds
  "gpt", // Guildpact
  "dis", // Dissension
]);

async function main() {
  await connectToDatabase();

  console.log("Fetching set list from Scryfall...");
  const { data: allSets } = await scryfall.request<ScryfallList<ScryfallSet>>("/sets");

  const draftable = allSets.filter(
    (s) => DRAFTABLE_TYPES.has(s.set_type) && !s.digital,
  );
  console.log(
    `Found ${draftable.length} draftable sets out of ${allSets.length} total. Upserting...`,
  );

  let upserted = 0;
  for (const set of draftable) {
    const code = set.code.toLowerCase();
    const blockEntry = getBlockEntry(code);
    const blockFields = blockEntry
      ? {
          block: blockEntry.id,
          blockName: blockEntry.name,
          blockOrder: blockEntry.order,
          setOrderInBlock: blockEntry.setOrder,
        }
      : { block: "", blockName: "", blockOrder: 0, setOrderInBlock: 0 };

    await CardSet.updateOne(
      { code },
      {
        $set: {
          name: set.name,
          scryfallId: set.id,
          setType: set.set_type,
          cardCount: set.card_count,
          releasedAt: set.released_at ? new Date(set.released_at) : undefined,
          iconSvgUri: set.icon_svg_uri ?? "",
          ...blockFields,
        },
        // Only set enabled on insert; existing state (admin-configured) is preserved.
        $setOnInsert: { enabled: false },
      },
      { upsert: true },
    );
    upserted++;
  }

  // Ensure curated sets are enabled regardless of prior state.
  await CardSet.updateMany(
    { code: { $in: Array.from(ENABLED_SET_CODES) } },
    { $set: { enabled: true } },
  );

  const enabledCount = await CardSet.countDocuments({ enabled: true });
  console.log(
    `Seeded ${upserted} draftable sets (${enabledCount} enabled). Run "pnpm sync:set --all" to fetch card data.`,
  );
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
