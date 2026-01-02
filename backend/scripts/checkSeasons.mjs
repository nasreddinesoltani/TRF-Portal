import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGODB_URI = process.env.URL_DB;

async function checkSeasons() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    const db = mongoose.connection.db;

    // Check unique seasons in memberships
    const seasons = await db
      .collection("athletes")
      .aggregate([
        { $unwind: "$memberships" },
        { $group: { _id: "$memberships.season", count: { $sum: 1 } } },
        { $sort: { _id: -1 } },
      ])
      .toArray();

    console.log("\nSeasons found in memberships:");
    console.log(JSON.stringify(seasons, null, 2));

    // Check membership statuses
    const statuses = await db
      .collection("athletes")
      .aggregate([
        { $unwind: "$memberships" },
        { $group: { _id: "$memberships.status", count: { $sum: 1 } } },
      ])
      .toArray();

    console.log("\nMembership statuses:");
    console.log(JSON.stringify(statuses, null, 2));

    // Sample a few athletes with memberships
    const samples = await db
      .collection("athletes")
      .find({ "memberships.0": { $exists: true } })
      .limit(3)
      .toArray();

    console.log("\nSample athletes with memberships:");
    samples.forEach((a) => {
      console.log(
        `- ${a.firstName} ${a.lastName}: memberships=`,
        JSON.stringify(a.memberships)
      );
    });

    // Count athletes with NO memberships
    const noMemberships = await db.collection("athletes").countDocuments({
      $or: [{ memberships: { $exists: false } }, { memberships: { $size: 0 } }],
    });
    console.log(`\nAthletes without memberships: ${noMemberships}`);

    // Count total athletes
    const total = await db.collection("athletes").countDocuments();
    console.log(`Total athletes: ${total}`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

checkSeasons();
