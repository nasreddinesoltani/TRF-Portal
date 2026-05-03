import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
dotenv.config();

const fix = async () => {
  console.log("Connecting to database...");
  await connectDB();
  const db = mongoose.connection.db;

  const query = {
    $or: [{ journeyIndex: { $exists: false } }, { journeyIndex: null }],
  };
  const count = await db.collection("competitionentries").countDocuments(query);
  console.log("Found " + count + " ghost entries");

  if (count > 0) {
    console.log("Updating entries...");
    const res = await db
      .collection("competitionentries")
      .updateMany(query, { $set: { journeyIndex: 1 } });
    console.log("Updated " + res.modifiedCount + " entries to Journey 1.");
  }

  console.log("Done.");
  process.exit(0);
};

fix().catch((err) => {
  console.error(err);
  process.exit(1);
});
