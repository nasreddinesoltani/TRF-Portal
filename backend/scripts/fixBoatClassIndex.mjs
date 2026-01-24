/**
 * Migration script to fix boat class indexes
 *
 * This script updates the unique constraint to include weightClass,
 * allowing same boat code for different weight classes (e.g., 1X open and 1X lightweight)
 *
 * Run with: node backend/scripts/fixBoatClassIndex.mjs
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from root .env file
dotenv.config({ path: join(__dirname, "..", "..", ".env") });

const MONGO_URI = process.env.URL_DB || "mongodb://localhost:27017/trf-portal";

async function fixIndexes() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected successfully.\n");

    const db = mongoose.connection.db;

    // Check if collection exists
    const collections = await db
      .listCollections({ name: "boatclasses" })
      .toArray();
    if (collections.length === 0) {
      console.log("Collection 'boatclasses' does not exist yet.");
      console.log(
        "The new index structure will be created when the first boat class is added.",
      );
      console.log(
        "\n✅ No migration needed - collection will use correct indexes when created.",
      );
      return;
    }

    const collection = db.collection("boatclasses");

    // Get current indexes
    const indexes = await collection.indexes();
    console.log("Current indexes:");
    indexes.forEach((idx) => {
      console.log(
        `  - ${idx.name}: ${JSON.stringify(idx.key)}${idx.unique ? " (unique)" : ""}`,
      );
    });
    console.log("");

    // Find and drop the old unique index on discipline + code (without weightClass)
    const oldCompoundIndex = indexes.find(
      (idx) =>
        idx.key.discipline === 1 &&
        idx.key.code === 1 &&
        !idx.key.weightClass &&
        idx.unique === true,
    );

    if (oldCompoundIndex) {
      console.log(`Dropping old compound index: ${oldCompoundIndex.name}`);
      await collection.dropIndex(oldCompoundIndex.name);
      console.log("Old index dropped successfully.\n");
    } else {
      console.log("No old discipline+code unique index found.\n");
    }

    // Ensure the new compound index with weightClass exists
    console.log(
      "Creating new compound index on { discipline: 1, code: 1, weightClass: 1 }...",
    );
    await collection.createIndex(
      { discipline: 1, code: 1, weightClass: 1 },
      { unique: true, name: "discipline_code_weightClass_unique" },
    );
    console.log("New compound index created.\n");

    // Show final indexes
    const finalIndexes = await collection.indexes();
    console.log("Final indexes:");
    finalIndexes.forEach((idx) => {
      console.log(
        `  - ${idx.name}: ${JSON.stringify(idx.key)}${idx.unique ? " (unique)" : ""}`,
      );
    });

    console.log("\n✅ Index migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB.");
  }
}

fixIndexes();
