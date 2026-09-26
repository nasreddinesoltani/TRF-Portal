/**
 * Set the "Nation Medal Table" ranking system to journeyMode: "final_only".
 *
 * Why: with `journeyMode: "all"` a crew that wins its heat AND the final was
 * credited with two gold medals. Medals must come from the final only.
 *
 * Only the `journeyMode` field is written, so any customisation made through
 * the admin UI on that ranking system is preserved (unlike
 * `scripts/seedRankingPresets.mjs`, which re-applies every preset field).
 *
 * Usage (from the backend folder):  node scripts/setNationMedalJourneyMode.mjs
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import RankingSystem from "../Models/rankingSystemModel.js";
import { getPresetByCode } from "../Services/rankingPresets.js";

// Always read the repository-root .env, regardless of the working directory.
dotenv.config({ path: new URL("../../.env", import.meta.url) });

const MONGODB_URI =
  process.env.URL_DB ||
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/trf-portal";

const CODE = "NATION_MEDAL_TABLE";

async function run() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected.");

    const existing = await RankingSystem.findOne({ code: CODE });

    if (!existing) {
      const preset = getPresetByCode(CODE);
      if (!preset) {
        throw new Error(`Preset ${CODE} not found in rankingPresets.js`);
      }
      await RankingSystem.create(preset);
      console.log(
        `Preset ${CODE} was not in the database — created it with journeyMode="${preset.journeyMode}".`,
      );
    } else if (existing.journeyMode === "final_only") {
      console.log(`Preset ${CODE} already uses journeyMode="final_only".`);
    } else {
      await RankingSystem.updateOne(
        { _id: existing._id },
        { $set: { journeyMode: "final_only" } },
      );
      console.log(
        `Updated ${CODE}: journeyMode "${existing.journeyMode}" -> "final_only".`,
      );
    }

    const check = await RankingSystem.findOne({ code: CODE }).select(
      "code names.en entityType scoringMode journeyMode nationGrouping",
    );
    console.log("\nCurrent configuration:");
    console.log(
      `  ${check.code} — ${check.names?.en} | entityType=${check.entityType} | scoringMode=${check.scoringMode} | nationGrouping=${check.nationGrouping} | journeyMode=${check.journeyMode}`,
    );
  } catch (error) {
    console.error("Error updating the nation medal table:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

run();
