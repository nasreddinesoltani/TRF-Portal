import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import CompetitionRace from "../Models/competitionRaceModel.js";
import Competition from "../Models/competitionModel.js";

const run = async () => {
  try {
    await mongoose.connect(process.env.URL_DB);
    console.log("Connected to MongoDB");

    // List all competitions first
    const allComps = await Competition.find({})
      .select("name names discipline code")
      .lean();
    console.log("All competitions:");
    allComps.forEach((c) =>
      console.log(
        `  - ${c.names?.en || c.name} (${c.discipline}) [${c.code}] - ${c._id}`,
      ),
    );

    // Check each competition for races
    console.log("\n--- Race counts per competition ---");
    for (const comp of allComps) {
      const raceCount = await CompetitionRace.countDocuments({
        competition: comp._id,
      });
      console.log(`${comp.name}: ${raceCount} races`);
    }
  } catch (err) {
    console.error("Error:", err);
  }

  process.exit(0);
};

run();
