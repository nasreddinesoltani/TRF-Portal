import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function migrate() {
  if (!MONGO_URI) {
    console.error("MONGO_URI not set in environment");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db;
  const competitions = db.collection("competitions");

  // Set scope.type = "national" on every document where scope is missing or scope.type is not set
  const result = await competitions.updateMany(
    {
      $or: [
        { scope: { $exists: false } },
        { "scope.type": { $exists: false } },
        { "scope.type": null },
      ],
    },
    { $set: { "scope.type": "national" } },
  );

  console.log(
    `Updated ${result.matchedCount} matched, ${result.modifiedCount} modified documents`,
  );

  await mongoose.disconnect();
  console.log("Done");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
