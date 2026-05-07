import connectDB from "../config/db.js";
import CompetitionRace from "../Models/competitionRaceModel.js";

async function run() {
  await connectDB();
  console.log("Connected to DB — starting backfill");

  const races = await CompetitionRace.find({}).exec();
  let updatedCount = 0;

  for (const race of races) {
    let modified = false;
    const raceId = race._id;
    const raceOrder = race.order || null;

    if (!Array.isArray(race.lanes)) continue;

    for (let i = 0; i < race.lanes.length; i++) {
      const lane = race.lanes[i];
      if (!lane) continue;
      if (!lane.sourceRaceId) {
        lane.sourceRaceId = raceId;
        modified = true;
      }
      if (!lane.sourceRaceOrder && raceOrder != null) {
        lane.sourceRaceOrder = raceOrder;
        modified = true;
      }
    }

    if (modified) {
      await race.save();
      updatedCount++;
    }
  }

  console.log(`Backfill complete. Races updated: ${updatedCount}`);
  process.exit(0);
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
