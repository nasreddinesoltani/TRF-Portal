import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import {
  assignNationalCategoriesForSeason,
  getSeasonYear,
} from "../Services/categoryAssignmentService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadEnvironment = () => {
  const candidates = [
    path.resolve(__dirname, "../../.env"),
    path.resolve(__dirname, "../.env"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate });
      console.log(`Loaded environment from ${candidate}`);
      return;
    }
  }

  dotenv.config();
  console.warn("Loaded environment from process cwd (fallback)");
};

loadEnvironment();

const run = async () => {
  const arg = process.argv[2];
  const seasonYear = arg ? Number(arg) : getSeasonYear();

  if (!Number.isFinite(seasonYear) || seasonYear < 1900) {
    throw new Error(
      "Provide a valid season year (e.g. `node recomputeCategories.mjs 2025`)"
    );
  }

  await connectDB();

  try {
    console.log(`Recomputing national categories for season ${seasonYear}...`);
    const result = await assignNationalCategoriesForSeason(seasonYear);
    console.log(
      `Done. Updated ${result.updated} out of ${result.total} eligible athletes.`
    );
  } finally {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  run().catch((error) => {
    console.error("Category recompute failed", error);
    process.exitCode = 1;
  });
}

export default run;
