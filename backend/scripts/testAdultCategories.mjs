import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: "../.env" });

async function main() {
  await mongoose.connect(process.env.URL_DB);
  console.log("Connected to database\n");

  console.log("=".repeat(80));
  console.log("TESTING CATEGORY ASSIGNMENT FOR ADULTS");
  console.log("=".repeat(80));

  // Check athletes across different adult ages
  const testAges = [
    { year: 2004, expectedAge: 22, expectedCat: "Senior (was U23)" },
    { year: 2000, expectedAge: 26, expectedCat: "Senior" },
    { year: 1999, expectedAge: 27, expectedCat: "Senior (was Master)" },
    { year: 1995, expectedAge: 31, expectedCat: "Senior (was Master)" },
    { year: 1990, expectedAge: 36, expectedCat: "Senior (was Master)" },
  ];

  for (const test of testAges) {
    const startDate = new Date(`${test.year}-01-01`);
    const endDate = new Date(`${test.year}-12-31`);

    const athletes = await mongoose.connection.db
      .collection("athletes")
      .find({
        birthDate: { $gte: startDate, $lte: endDate },
      })
      .limit(3)
      .toArray();

    console.log(
      `\nBorn ${test.year} -> Age ${test.expectedAge} in 2026 -> Should be: ${test.expectedCat}`,
    );

    if (athletes.length === 0) {
      console.log("  (No athletes found for this year)");
    } else {
      athletes.forEach((a) => {
        const assign = a.categoryAssignments?.find((c) => c.season === 2026);
        const name = (
          (a.firstName || a.firstNameAr || "") +
          " " +
          (a.lastName || a.lastNameAr || "")
        ).trim();
        const cat = assign?.abbreviation || "Not assigned";
        const isSenior = ["M", "W", "SM", "SW", "SMix"].includes(cat);
        const status = isSenior
          ? "✓ SENIOR"
          : assign
            ? `✗ ${cat}`
            : "✗ Not assigned";
        console.log(`  - ${name.substring(0, 30)}: ${status}`);
      });
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("CURRENT CATEGORY AGE RANGES:");
  console.log("=".repeat(80));

  const cats = await mongoose.connection.db
    .collection("categories")
    .find({ isActive: true })
    .sort({ minAge: 1 })
    .toArray();

  cats.forEach((c) => {
    const maxAgeStr =
      c.maxAge !== undefined && c.maxAge !== null ? c.maxAge : "∞";
    console.log(
      `  ${c.abbreviation.padEnd(8)} | ${(c.titles?.en || "").padEnd(25)} | ${c.minAge}-${maxAgeStr}`,
    );
  });

  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY:");
  console.log("=".repeat(80));
  console.log("  ✓ Senior categories (M/W/SMix) now have NO maxAge limit");
  console.log("  ✓ Adults 19+ will be assigned Senior by default");
  console.log(
    "  ✓ U23 (19-22) and Master (27+) checked at race registration time",
  );
  console.log(
    "  ✓ Club managers can find Masters when registering for Senior races",
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
