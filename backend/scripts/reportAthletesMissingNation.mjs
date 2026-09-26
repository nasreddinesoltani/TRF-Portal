/**
 * D1 — report athletes in international competitions that carry no nation.
 * Read-only by default. Fix one athlete with: --fix <athleteId> <NATION>
 * Usage (from the backend folder):
 *   node scripts/reportAthletesMissingNation.mjs
 *   node scripts/reportAthletesMissingNation.mjs --fix <athleteId> <NATION>
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import Athlete from "../Models/athleteModel.js";
import Club from "../Models/clubModel.js";
import Competition from "../Models/competitionModel.js";
import CompetitionEntry from "../Models/competitionEntryModel.js";
import CompetitionRace from "../Models/competitionRaceModel.js";

// Always read the repository-root .env, regardless of the working directory.
dotenv.config({ path: new URL("../../.env", import.meta.url) });

const MONGODB_URI =
  process.env.URL_DB ||
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/trf-portal";

const normNation = (v) => {
  if (v === undefined || v === null) return "";
  const s = String(v).trim();
  return s ? s.toUpperCase() : "";
};

const athleteHasNation = (a) =>
  Boolean(
    normNation(a?.nationalityCode) ||
      normNation(a?.representingNation) ||
      normNation(a?.nationality)
  );

const clubCoversNation = (club) => {
  if (!club) return false;
  if (normNation(club.country)) return true;
  if (String(club.type || "").toLowerCase() === "country") return true;
  return /-C$/i.test(String(club.code || ""));
};

const personName = (p) =>
  `${p?.firstName || ""} ${p?.lastName || ""}`.trim() || "(unnamed)";

async function applyFix(athleteId, nationArg) {
  const code = normNation(nationArg);
  if (!/^[A-Z]{3}$/.test(code)) {
    console.error(
      `Refusing invalid nation "${nationArg}" (expected 3 letters, e.g. UAE).`
    );
    process.exitCode = 1;
    return;
  }
  const updated = await Athlete.findByIdAndUpdate(
    athleteId,
    {
      $set: {
        nationalityCode: code,
        representingNation: code,
        isForeign: code !== "TUN",
      },
    },
    { new: true }
  ).select("firstName lastName nationalityCode representingNation isForeign");
  if (!updated) {
    console.error(`Athlete ${athleteId} not found.`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `Fixed: ${personName(updated)} (${updated._id}) -> nationalityCode=${updated.nationalityCode}, representingNation=${updated.representingNation}, isForeign=${updated.isForeign}`
  );
}
async function run() {
  const [, , flag, athleteId, nationArg] = process.argv;
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected.\n");

    if (flag === "--fix") {
      if (!athleteId || !nationArg) {
        console.error("Usage: --fix <athleteId> <NATION>");
        process.exitCode = 1;
        return;
      }
      await applyFix(athleteId, nationArg);
      return;
    }

    const intlCompetitions = await Competition.find({
      "scope.type": {
        $in: [
          "international_hosted",
          "international_open",
          "international_outbound",
          "international_oaas",
        ],
      },
    })
      .select("name code scope.type")
      .lean();
    const intlIds = intlCompetitions.map((c) => c._id);
    console.log(`International competitions scanned: ${intlCompetitions.length}`);
    for (const c of intlCompetitions) {
      console.log(`  - ${c.code || c.name} (${c.scope?.type})`);
    }

    const entries = await CompetitionEntry.find({ competition: { $in: intlIds } })
      .populate({ path: "athlete", select: "firstName lastName nationalityCode representingNation nationality" })
      .populate({ path: "crew", select: "firstName lastName nationalityCode representingNation nationality" })
      .populate({ path: "club", select: "name code type country" })
      .populate({ path: "competition", select: "name code" })
      .lean();

    const missing = [];
    for (const entry of entries) {
      const people = [];
      if (entry.athlete && typeof entry.athlete === "object") {
        people.push({ person: entry.athlete, kind: "athlete" });
      }
      for (const m of entry.crew || []) {
        if (m && typeof m === "object" && m._id) {
          people.push({ person: m, kind: "crew" });
        }
      }
      for (const { person, kind } of people) {
        const covered =
          athleteHasNation(person) ||
          clubCoversNation(entry.club) ||
          Boolean(normNation(entry.representingNation));
        if (!covered) {
          missing.push({
            athleteId: String(person._id),
            name: personName(person),
            kind,
            competition: entry.competition?.code || entry.competition?.name || "?",
            club: entry.club?.code || "(no club)",
          });
        }
      }
    }
    console.log(`\nEntries missing nation (no fallback): ${missing.length}`);
    for (const m of missing) {
      console.log(`  - ${m.name} [${m.athleteId}] (${m.kind}, club=${m.club}) in ${m.competition}`);
      console.log(`    fix: node scripts/reportAthletesMissingNation.mjs --fix ${m.athleteId} <NATION>`);
    }

    const races = await CompetitionRace.find({ competition: { $in: intlIds } })
      .populate({ path: "lanes.athlete", select: "firstName lastName nationalityCode representingNation nationality" })
      .populate({ path: "lanes.crew", select: "firstName lastName nationalityCode representingNation nationality" })
      .populate({ path: "lanes.club", select: "name code type country" })
      .select("name order competition lanes")
      .lean();

    const laneMissing = [];
    for (const race of races) {
      for (const lane of race.lanes || []) {
        const people = [];
        if (lane.athlete && typeof lane.athlete === "object" && lane.athlete._id) {
          people.push(lane.athlete);
        }
        for (const m of lane.crew || []) {
          if (m && typeof m === "object" && m._id) people.push(m);
        }
        for (const person of people) {
          const covered =
            athleteHasNation(person) ||
            clubCoversNation(lane.club) ||
            Boolean(normNation(lane.representingNation));
          if (!covered) {
            laneMissing.push({
              athleteId: String(person._id),
              name: personName(person),
              race: race.name || `Race ${race.order}`,
              lane: lane.lane,
              club: lane.club?.code || "(no club)",
            });
          }
        }
      }
    }
    console.log(`\nRace lanes missing nation (no fallback): ${laneMissing.length}`);
    for (const m of laneMissing) {
      console.log(`  - ${m.name} [${m.athleteId}] lane ${m.lane} of "${m.race}" (club=${m.club})`);
      console.log(`    fix: node scripts/reportAthletesMissingNation.mjs --fix ${m.athleteId} <NATION>`);
    }
    if (!missing.length && !laneMissing.length) {
      console.log("\nAll clear — every lane is attributable to a nation.");
    }
  } catch (error) {
    console.error("Error generating the missing-nation report:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB.");
  }
}

run();

