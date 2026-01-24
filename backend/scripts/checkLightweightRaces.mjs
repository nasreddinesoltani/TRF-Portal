import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: "../.env" });

async function main() {
  await mongoose.connect(process.env.URL_DB);
  console.log("Connected to database");

  // Find races linked to lightweight boat classes
  const races = await mongoose.connection.db
    .collection("competitionraces")
    .aggregate([
      {
        $lookup: {
          from: "boatclasses",
          localField: "boatClass",
          foreignField: "_id",
          as: "bc",
        },
      },
      { $unwind: { path: "$bc", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "cat",
        },
      },
      { $unwind: { path: "$cat", preserveNullAndEmptyArrays: true } },
      { $match: { "bc.weightClass": "lightweight" } },
      {
        $project: {
          order: 1,
          name: 1,
          "bc.code": 1,
          "bc.weightClass": 1,
          "bc.names.en": 1,
          "cat.titles.en": 1,
          "cat.abbreviation": 1,
        },
      },
    ])
    .limit(10)
    .toArray();

  console.log("\nRaces linked to lightweight boat classes:");
  races.forEach((r) =>
    console.log(
      `  - Race ${r.order} | ${r.name} | boat: ${r.bc?.code} (${r.bc?.weightClass}) | cat: ${r.cat?.abbreviation} - ${r.cat?.titles?.en}`,
    ),
  );

  // Also check all boat classes
  const boats = await mongoose.connection.db
    .collection("boatclasses")
    .find(
      {},
      { projection: { code: 1, discipline: 1, weightClass: 1, "names.en": 1 } },
    )
    .sort({ discipline: 1, code: 1, weightClass: 1 })
    .toArray();

  console.log("\n\nAll boat classes in database:");
  boats.forEach((b) =>
    console.log(
      `  - ${b.code} | ${b.discipline} | ${b.weightClass || "NO_WEIGHT"} | ${b.names?.en}`,
    ),
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
