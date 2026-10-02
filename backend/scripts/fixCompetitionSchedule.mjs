/**
 * One-shot schedule/data fix for a competition:
 *   node scripts/fixCompetitionSchedule.mjs <competitionId>
 *
 * 1. Event numbers: assigns the official programme number (1..N) to every
 *    event group (category + boatClass), ordered alphabetically by category
 *    abbreviation then boat code — the same ordering the Race Planner UI uses.
 * 2. Start times: re-anchors each journey's races to 08:00 local time on that
 *    journey's stage date (fallback: competition start date), preserving the
 *    original gaps between consecutive races. Fixes drifted dates (e.g. 2027).
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

// Node's c-ares SRV lookup fails on this machine (virtual-adapter DNS), so
// convert the SRV URI into a direct mongodb:// URI with pre-resolved hosts.
const hosts =
  "ac-eqwm8a1-shard-00-00.9zejq23.mongodb.net:27017,ac-eqwm8a1-shard-00-01.9zejq23.mongodb.net:27017,ac-eqwm8a1-shard-00-02.9zejq23.mongodb.net:27017";
const uri = process.env.URL_DB.replace(
  /^mongodb\+srv:\/\/([^@]+)@[^/]+/,
  `mongodb://$1@${hosts}`,
);
if (uri.includes("mongodb+srv")) throw new Error("URL_DB not in expected SRV format");
await mongoose.connect(uri, { tls: true, authSource: "admin" });

const { default: Competition } = await import(
  new URL("../Models/competitionModel.js", import.meta.url).href
);
const { default: CompetitionRace } = await import(
  new URL("../Models/competitionRaceModel.js", import.meta.url).href
);
await import(new URL("../Models/categoryModel.js", import.meta.url).href);
await import(new URL("../Models/boatClassModel.js", import.meta.url).href);

const competitionId = process.argv[2];
if (!competitionId) {
  console.error("Usage: node scripts/fixCompetitionSchedule.mjs <competitionId>");
  process.exit(1);
}

const competition = await Competition.findById(competitionId).lean();
if (!competition) {
  console.error("Competition not found:", competitionId);
  process.exit(1);
}
console.log(`Competition: ${competition.names?.en} (${competition._id})`);

const races = await CompetitionRace.find({ competition: competition._id })
  .populate("category", "abbreviation")
  .populate("boatClass", "code")
  .select("journeyIndex order name startTime eventNumber category boatClass")
  .sort({ journeyIndex: 1, order: 1 })
  .lean();
console.log(`Races: ${races.length}`);

// === 1. Event numbers ======================================================

// Group by category + boat-class CODE (not the boat-class doc id): the
// competition has duplicate 1X/2X boat-class documents, and numbering by id
// would give the same real event two different numbers.
const groups = new Map(); // key -> { abbr, code, raceIds }
for (const race of races) {
  const abbr = race.category?.abbreviation || "";
  const code = race.boatClass?.code || "";
  const key = `${race.category?._id ?? "unknown"}::${code || "open"}`;
  if (!groups.has(key)) {
    groups.set(key, { abbr, code, raceIds: [] });
  }
  groups.get(key).raceIds.push(race._id);
}

const ordered = [...groups.values()].sort(
  (a, b) =>
    a.abbr.localeCompare(b.abbr) || a.code.localeCompare(b.code),
);
console.log("\nEvent numbers (alphabetical by category, then boat class):");
for (const [index, group] of ordered.entries()) {
  const label = `${group.abbr || "?"}${group.code || ""}`;
  console.log(`  ${String(index + 1).padStart(3)}  ${label}  (${group.raceIds.length} races)`);
  await CompetitionRace.updateMany(
    { _id: { $in: group.raceIds } },
    { $set: { eventNumber: index + 1 } },
  );
}

// === 2. Start times ========================================================

console.log("\nStart-time re-anchoring (08:00 local on the stage date):");
const journeys = [...new Set(races.map((race) => Number(race.journeyIndex) || 1))].sort(
  (a, b) => a - b,
);

for (const journeyIndex of journeys) {
  const stage = (competition.stages || []).find(
    (stage) => Number(stage?.order) === Number(journeyIndex),
  );
  const stageDate = stage?.date
    ? new Date(stage.date)
    : competition.startDate
      ? new Date(competition.startDate)
      : null;
  const journeyRaces = races
    .filter((race) => (Number(race.journeyIndex) || 1) === journeyIndex)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  if (!journeyRaces.length) continue;

  if (!stageDate || isNaN(stageDate.getTime())) {
    console.log(`  J${journeyIndex}: no stage date and no competition start date — skipped`);
    continue;
  }

  const dayStart = new Date(
    stageDate.getFullYear(),
    stageDate.getMonth(),
    stageDate.getDate(),
    0,
    0,
    0,
    0,
  );
  const anchor = new Date(dayStart.getTime());
  anchor.setHours(8, 0, 0, 0);

  // Preserve the original gaps between consecutive races (min 1 minute,
  // 10 minutes when the previous race had no time to measure the gap).
  const newTimes = [];
  let previousOld = null;
  let previousNew = anchor;
  for (const race of journeyRaces) {
    if (previousOld == null) {
      newTimes.push(new Date(anchor));
    } else {
      const oldTime = race.startTime ? new Date(race.startTime) : null;
      // Clamp: drifted historical times (e.g. 2027) must not propagate —
      // a gap over an hour is treated as data noise and replaced by 10 min.
      let gap = 10 * 60000;
      if (oldTime && !isNaN(oldTime.getTime())) {
        gap = Math.min(Math.max(oldTime.getTime() - previousOld.getTime(), 60000), 3600000);
      }
      newTimes.push(new Date(previousNew.getTime() + gap));
    }
    previousOld = race.startTime ? new Date(race.startTime) : previousOld;
    previousNew = newTimes[newTimes.length - 1];
  }

  const oldFirst = journeyRaces[0].startTime;
  const oldLast = journeyRaces[journeyRaces.length - 1].startTime;
  const fmt = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate(),
    ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
      date.getMinutes(),
    ).padStart(2, "0")}`;
  console.log(
    `  J${journeyIndex} (${fmt(anchor)}): ${journeyRaces.length} races  ` +
      `${oldFirst ? fmt(new Date(oldFirst)) : "—"}..${oldLast ? fmt(new Date(oldLast)) : "—"}` +
      `  ->  ${fmt(newTimes[0])}..${fmt(newTimes[newTimes.length - 1])}`,
  );

  for (const [index, race] of journeyRaces.entries()) {
    race.startTime = newTimes[index];
  }
  await Promise.all(
    journeyRaces.map((race) =>
      CompetitionRace.updateOne(
        { _id: race._id },
        { $set: { startTime: race.startTime } },
      ),
    ),
  );
}

console.log("\nDone.");
await mongoose.disconnect();
