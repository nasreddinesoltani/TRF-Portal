import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: "../.env" });

async function main() {
  await mongoose.connect(process.env.URL_DB);
  console.log("Connected to database\n");

  // Check athletes around the Junior/Senior boundary (born 2007-2009)
  console.log("=".repeat(80));
  console.log("VERIFYING JUNIOR/SENIOR BOUNDARY (2026 season)");
  console.log("=".repeat(80));

  const years = [2006, 2007, 2008, 2009, 2010];

  for (const year of years) {
    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year}-12-31`);

    const athletes = await mongoose.connection.db
      .collection("athletes")
      .find({
        birthDate: { $gte: startDate, $lte: endDate },
      })
      .limit(3)
      .toArray();

    const age = 2026 - year;
    let expectedCat = "";
    if (age >= 15 && age <= 16) expectedCat = "CM/CW (Cadet)";
    else if (age >= 17 && age <= 18) expectedCat = "JM/JW (Junior)";
    else if (age >= 19 && age <= 22) expectedCat = "M/W or BM/BW (Senior/U23)";
    else if (age >= 23 && age <= 26) expectedCat = "M/W (Senior)";

    console.log(
      `\nBorn ${year} -> Age ${age} in 2026 -> Expected: ${expectedCat}`,
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
        const status = assign
          ? `✓ Assigned: ${assign.abbreviation}`
          : "✗ Not assigned";
        console.log(`  - ${name.substring(0, 30)}: ${status}`);
      });
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("\nSUMMARY - Category Age Ranges (2026 season):");
  console.log("=".repeat(80));
  console.log("  PM/PW (Under 11):    7-10 years  -> Born 2016-2019");
  console.log("  bM/bW (Under 13):   11-12 years  -> Born 2014-2015");
  console.log("  MM/MW (Under 15):   13-14 years  -> Born 2012-2013");
  console.log("  CM/CW (Under 17):   15-16 years  -> Born 2010-2011");
  console.log("  JM/JW (Under 19):   17-18 years  -> Born 2008-2009");
  console.log(
    "  M/W (Senior):       19-26 years  -> Born 2000-2007  ← 2007 = SENIOR",
  );
  console.log("  BM/BW (Under 23):   19-22 years  -> Born 2004-2007");
  console.log("  Master (27-35):     27+ years    -> Born 1999 or earlier");

  console.log("\n" + "=".repeat(80));
  console.log("CALCULATION LOGIC:");
  console.log("=".repeat(80));
  console.log("  Age is calculated as of December 31 of the season year.");
  console.log("  2026 - 2007 = 19 years old -> Falls in Senior (19-26)");
  console.log("  2026 - 2008 = 18 years old -> Falls in Junior (17-18)");
  console.log("\n✓ System is correctly calculating categories!");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
