import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: "../.env" });

/**
 * This migration updates Senior categories to have no maxAge limit.
 *
 * Rationale:
 * - Senior (M/W/SMix) should be the default category for all adults 19+
 * - U23 and Master are "secondary" categories that athletes can opt into at race time
 * - This allows Masters (27+) to be assigned Senior and compete in Senior races
 * - The race registration process will still validate age for specific categories (U23, Master)
 */
async function main() {
  await mongoose.connect(process.env.URL_DB);
  console.log("Connected to database\n");

  // Find Senior categories (M, W, SMix with "Senior" in title)
  const seniorCategories = await mongoose.connection.db
    .collection("categories")
    .find({
      $or: [
        { abbreviation: { $in: ["M", "W", "SM", "SW", "SMix"] } },
        { "titles.en": { $regex: /^Senior/i } },
      ],
    })
    .toArray();

  console.log("Found Senior categories:");
  seniorCategories.forEach((c) =>
    console.log(
      `  - ${c.abbreviation} | ${c.titles?.en} | age: ${c.minAge}-${c.maxAge}`,
    ),
  );

  if (seniorCategories.length === 0) {
    console.log("\nNo Senior categories found. Exiting.");
    await mongoose.disconnect();
    return;
  }

  // Update maxAge to null (unlimited) for Senior categories
  console.log("\nUpdating Senior categories to remove maxAge limit...");

  const result = await mongoose.connection.db
    .collection("categories")
    .updateMany(
      {
        _id: { $in: seniorCategories.map((c) => c._id) },
      },
      {
        $unset: { maxAge: "" }, // Remove maxAge field (or set to null)
      },
    );

  console.log(`Updated ${result.modifiedCount} categories.`);

  // Verify the update
  const updated = await mongoose.connection.db
    .collection("categories")
    .find({
      _id: { $in: seniorCategories.map((c) => c._id) },
    })
    .toArray();

  console.log("\nUpdated Senior categories:");
  updated.forEach((c) =>
    console.log(
      `  - ${c.abbreviation} | ${c.titles?.en} | age: ${c.minAge}-${c.maxAge ?? "∞"}`,
    ),
  );

  console.log("\n✓ Senior categories now accept all adults 19+");
  console.log("  Athletes will be assigned Senior by default.");
  console.log(
    "  U23 and Master eligibility checked at race registration time.",
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
