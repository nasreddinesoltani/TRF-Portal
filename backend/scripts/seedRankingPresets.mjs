/**
 * Seed Ranking System Presets
 *
 * Run this script to populate the database with default ranking system presets.
 * Usage: node scripts/seedRankingPresets.mjs
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import RankingSystem from "../Models/rankingSystemModel.js";
import { getAllPresets } from "../Services/rankingPresets.js";

// Load environment variables
dotenv.config();

const MONGODB_URI =
  process.env.URL_DB ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/trf-portal";

async function seedRankingPresets() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    const presets = getAllPresets();
    console.log(`Found ${presets.length} presets to seed`);

    for (const preset of presets) {
      // Check if preset already exists
      const existing = await RankingSystem.findOne({ code: preset.code });

      if (existing) {
        console.log(`  Updating existing preset: ${preset.code}`);
        await RankingSystem.findOneAndUpdate(
          { code: preset.code },
          { $set: preset },
          { new: true }
        );
      } else {
        console.log(`  Creating new preset: ${preset.code}`);
        await RankingSystem.create(preset);
      }
    }

    console.log("\nRanking presets seeded successfully!");
    console.log("\nAvailable ranking systems:");

    const all = await RankingSystem.find({ isPreset: true }).sort({
      sortOrder: 1,
    });
    for (const rs of all) {
      console.log(`  - ${rs.code}: ${rs.names.en} (groupBy: ${rs.groupBy})`);
    }
  } catch (error) {
    console.error("Error seeding ranking presets:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

seedRankingPresets();
