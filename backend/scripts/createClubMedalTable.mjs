/**
 * Create the "Club Medal Table" ranking system if it is missing.
 * Creates only — never overwrites an existing document, so UI customisation
 * on live systems is preserved (same philosophy as
 * scripts/setNationMedalJourneyMode.mjs).
 *
 * Usage (from the backend folder):  node scripts/createClubMedalTable.mjs
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

const CODE = "CLUB_MEDAL_TABLE";

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
        `Preset ${CODE} was not in the database — created it (entityType=club, scoringMode=medals, journeyMode=final_only).`
      );
    } else {
      console.log(
        `Preset ${CODE} already exists — nothing changed (entityType=${existing.entityType}, scoringMode=${existing.scoringMode}, journeyMode=${existing.journeyMode}).`
      );
    }

    const check = await RankingSystem.findOne({ code: CODE }).select(
      "code names.en entityType scoringMode journeyMode"
    );
    console.log("\nCurrent configuration:");
    console.log(
      `  ${check.code} — ${check.names?.en} | entityType=${check.entityType} | scoringMode=${check.scoringMode} | journeyMode=${check.journeyMode}`
    );
  } catch (error) {
    console.error("Error creating the club medal table:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

run();
