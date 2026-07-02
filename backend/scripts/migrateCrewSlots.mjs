/**
 * migrateCrewSlots.mjs
 * ---------------------------------------------------------------------------
 * Fixes crew numbering so a crew SLOT (e.g. "EPT 1") is persistent across
 * journeys, scoped per (club + category + boat class). Singles (crewSize <= 1)
 * are skipped — they get no crew number (points/medals go to the athlete).
 *
 * What it does, per competition, per (club | category | boatClass) group:
 *   1. The EARLIEST journey seeds the slots, keeping the crew numbers already
 *      stored there (they are treated as the source of truth).
 *   2. Later journeys reuse a slot when their crew shares at least one athlete
 *      with that slot's most recent crew (athlete-overlap matching) -> the
 *      continuing crew keeps its number.
 *   3. Crews in later journeys that match no existing slot get the next free
 *      number in the group (instead of max+1 leaving gaps).
 *   4. Both CompetitionEntry.crewNumber AND the denormalised CompetitionRace
 *      lane.crewNumber are updated to match.
 *
 * SAFE BY DEFAULT: runs in DRY-RUN mode and only prints what it WOULD change.
 * Pass --apply to actually write. Review the dry-run output first.
 *
 * Usage (from backend/):
 *   node scripts/migrateCrewSlots.mjs --competition=<competitionId>
 *   node scripts/migrateCrewSlots.mjs --competition=<id> --apply
 *   node scripts/migrateCrewSlots.mjs --all                  # dry-run all comps
 *   node scripts/migrateCrewSlots.mjs --competition=<id> --overrides=./map.json
 *
 * overrides JSON (optional, for the ambiguous cases the heuristic can't decide):
 *   { "<competitionEntryId>": 1, "<anotherEntryId>": 2 }
 *   These force a specific slot number for those entries.
 * ---------------------------------------------------------------------------
 */
import mongoose from "mongoose";
import dns from "node:dns";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import Competition from "../Models/competitionModel.js";
import CompetitionEntry from "../Models/competitionEntryModel.js";
import CompetitionRace from "../Models/competitionRaceModel.js";
import BoatClass from "../Models/boatClassModel.js";
// Imported so Mongoose registers these schemas for .populate() (crew/athlete -> Athlete).
import Athlete from "../Models/athleteModel.js";
import Club from "../Models/clubModel.js";
import Category from "../Models/categoryModel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") }); // fallback

const MONGO_URI =
  process.env.URL_DB || process.env.MONGO_URI || process.env.MONGODB_URI;

// ----- args -----
const args = process.argv.slice(2);
const getArg = (name) => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  const eq = hit.indexOf("=");
  return eq === -1 ? true : hit.slice(eq + 1);
};
const APPLY = Boolean(getArg("apply"));
const ALL = Boolean(getArg("all"));
const COMPETITION_ID = getArg("competition");
const OVERRIDES_PATH = getArg("overrides");

const idStr = (v) =>
  v == null ? null : v._id ? String(v._id) : String(v.toString ? v.toString() : v);
const sortedCrewIds = (crewArr) =>
  (crewArr || []).map(idStr).filter(Boolean).sort();
const crewKey = (club, category, boatClass, journey, crewArr) =>
  `${idStr(club)}|${idStr(category)}|${idStr(boatClass)}|J${journey ?? 1}|${sortedCrewIds(
    crewArr,
  ).join("+")}`;
const athleteName = (a) =>
  a && (a.firstName || a.lastName)
    ? `${a.firstName || ""} ${a.lastName || ""}`.trim()
    : idStr(a);

async function run() {
  if (!MONGO_URI) {
    console.error("❌ No Mongo connection string (URL_DB / MONGO_URI) found in .env");
    process.exit(1);
  }
  if (!ALL && !COMPETITION_ID) {
    console.error("❌ Specify --competition=<id> or --all");
    process.exit(1);
  }

  let overrides = {};
  if (OVERRIDES_PATH) {
    overrides = JSON.parse(fs.readFileSync(path.resolve(OVERRIDES_PATH), "utf8"));
    console.log(`Loaded ${Object.keys(overrides).length} override(s) from ${OVERRIDES_PATH}`);
  }

  // Match the app's DNS handling for mongodb+srv:// (Atlas) connections.
  // Fixes "querySrv ECONNREFUSED" when the local resolver won't do SRV lookups.
  if (MONGO_URI.startsWith("mongodb+srv://")) {
    const dnsServers = (process.env.MONGO_DNS_SERVERS || "8.8.8.8,1.1.1.1")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (dnsServers.length) {
      dns.setServers(dnsServers);
      console.log(`Using DNS servers: ${dnsServers.join(", ")}`);
    }
  }

  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 30000 });
  console.log(`Connected to MongoDB${APPLY ? "" : "  (DRY-RUN — no writes)"}\n`);

  // crewSize lookup
  const boatClasses = await BoatClass.find({}).select("code crewSize names").lean();
  const crewSizeMap = new Map(boatClasses.map((b) => [String(b._id), b]));

  const compFilter = ALL ? {} : { _id: COMPETITION_ID };

  // Friendly guard: invalid/placeholder competition id -> list options instead of crashing.
  if (!ALL && !mongoose.Types.ObjectId.isValid(COMPETITION_ID)) {
    console.error(`\n❌ "${COMPETITION_ID}" is not a valid competition id (need a 24-char hex _id).\n`);
    const all = await Competition.find({}).select("name season").lean();
    console.log("Available competitions:");
    all.forEach((c) => console.log(`   ${c._id}   ${c.name} (${c.season ?? ""})`));
    console.log("\nRe-run with:  node scripts/migrateCrewSlots.mjs --competition=<one-of-the-ids-above>");
    await mongoose.disconnect();
    return;
  }

  const competitions = await Competition.find(compFilter).select("name season scope").lean();
  if (!competitions.length) {
    console.error("No competitions matched.");
    await mongoose.disconnect();
    return;
  }

  const entryUpdates = []; // { _id, old, new }
  let laneUpdatesTotal = 0;
  const warnings = [];

  for (const comp of competitions) {
    const entries = await CompetitionEntry.find({
      competition: comp._id,
      status: { $ne: "withdrawn" },
    })
      .populate("crew", "firstName lastName")
      .populate("athlete", "firstName lastName")
      .select("club category boatClass journeyIndex crewNumber crew athlete status")
      .lean();

    // group by club|category|boatClass, crew boats only
    const groups = new Map();
    for (const e of entries) {
      const crewArr = e.crew && e.crew.length ? e.crew : e.athlete ? [e.athlete] : [];
      const bc = crewSizeMap.get(idStr(e.boatClass));
      const size = bc?.crewSize ?? crewArr.length;
      if (size <= 1) continue; // singles -> no crew number
      const gkey = `${idStr(e.club)}|${idStr(e.category)}|${idStr(e.boatClass)}`;
      if (!groups.has(gkey)) groups.set(gkey, []);
      groups.get(gkey).push({ ...e, _crewArr: crewArr });
    }

    // entryId -> assigned slot number (for lane sync)
    const slotByCrewKey = new Map();
    let compHasChanges = false;
    const compLines = [];

    for (const [gkey, gEntries] of groups) {
      // journeys ascending
      const journeys = [
        ...new Set(gEntries.map((e) => Number(e.journeyIndex) || 1)),
      ].sort((a, b) => a - b);

      const slots = []; // { number, lastSet:Set<string>, history:[{journey, entry}] }
      const usedNumbers = new Set();
      const nextFree = () => {
        let n = 1;
        while (usedNumbers.has(n)) n++;
        return n;
      };

      for (const j of journeys) {
        const jEntries = gEntries
          .filter((e) => (Number(e.journeyIndex) || 1) === j)
          .sort(
            (a, b) =>
              (Number(a.crewNumber) || 999) - (Number(b.crewNumber) || 999),
          );

        const slotUsedThisJourney = new Set();

        // 1) overrides first (hard constraint)
        const pending = [];
        for (const e of jEntries) {
          const ov = overrides[idStr(e)];
          if (ov != null) {
            let slot = slots.find((s) => s.number === Number(ov));
            if (!slot) {
              slot = { number: Number(ov), lastSet: new Set(), history: [] };
              slots.push(slot);
              usedNumbers.add(slot.number);
            }
            assign(slot, e, j, slotUsedThisJourney, slotByCrewKey, comp);
          } else {
            pending.push(e);
          }
        }

        if (j === journeys[0]) {
          // earliest journey seeds slots — keep existing numbers where valid
          for (const e of pending) {
            const cur = Number(e.crewNumber);
            let num =
              Number.isInteger(cur) && cur > 0 && !usedNumbers.has(cur)
                ? cur
                : nextFree();
            const slot = { number: num, lastSet: new Set(), history: [] };
            slots.push(slot);
            usedNumbers.add(num);
            assign(slot, e, j, slotUsedThisJourney, slotByCrewKey, comp);
          }
        } else {
          // later journeys: best athlete-overlap match to an unused slot
          const scored = [];
          for (const e of pending) {
            const set = new Set(sortedCrewIds(e._crewArr));
            for (const slot of slots) {
              const overlap = [...set].filter((x) => slot.lastSet.has(x)).length;
              if (overlap > 0) scored.push({ e, slot, overlap });
            }
          }
          scored.sort((a, b) => b.overlap - a.overlap);
          const matchedEntries = new Set();
          for (const { e, slot, overlap } of scored) {
            if (matchedEntries.has(idStr(e))) continue;
            if (slotUsedThisJourney.has(slot.number)) continue;
            // ambiguity guard: another slot with equal overlap for same entry
            const ties = scored.filter(
              (s) =>
                idStr(s.e) === idStr(e) &&
                s.overlap === overlap &&
                s.slot.number !== slot.number &&
                !slotUsedThisJourney.has(s.slot.number),
            );
            if (ties.length) {
              warnings.push(
                `AMBIGUOUS: ${comp.name} J${j} — entry ${idStr(
                  e,
                )} (${e._crewArr.map(athleteName).join(" / ")}) overlaps slots ${[
                  slot.number,
                  ...ties.map((t) => t.slot.number),
                ].join(", ")} equally. Used slot ${slot.number}. Use --overrides to force.`,
              );
            }
            assign(slot, e, j, slotUsedThisJourney, slotByCrewKey, comp);
            matchedEntries.add(idStr(e));
          }
          // unmatched -> new slot
          for (const e of pending) {
            if (matchedEntries.has(idStr(e))) continue;
            const num = nextFree();
            const slot = { number: num, lastSet: new Set(), history: [] };
            slots.push(slot);
            usedNumbers.add(num);
            assign(slot, e, j, slotUsedThisJourney, slotByCrewKey, comp);
          }
        }
      }

      // collect entry changes + build readable lines
      for (const slot of slots) {
        for (const { journey, entry } of slot.history) {
          const oldN = Number(entry.crewNumber) || null;
          if (oldN !== slot.number) {
            entryUpdates.push({ _id: entry._id, old: oldN, new: slot.number });
            compHasChanges = true;
            compLines.push(
              `   slot ${slot.number}  J${journey}  ${entry._crewArr
                .map(athleteName)
                .join(" / ")}   ${oldN ?? "—"} -> ${slot.number}`,
            );
          } else {
            compLines.push(
              `   slot ${slot.number}  J${journey}  ${entry._crewArr
                .map(athleteName)
                .join(" / ")}   (unchanged: ${slot.number})`,
            );
          }
        }
      }
    }

    if (compLines.length) {
      console.log(`\n=== ${comp.name} (${comp.season ?? ""})  [_id: ${comp._id}]  ===`);
      console.log(compLines.join("\n"));
    }

    // ----- sync race lanes for this competition -----
    const races = await CompetitionRace.find({ competition: comp._id }).select(
      "category boatClass journeyIndex lanes raceNumber",
    );
    const laneChanges = [];
    for (const race of races) {
      let raceDirty = false;
      for (const lane of race.lanes || []) {
        if (!Array.isArray(lane.crew) || lane.crew.length <= 1) continue;
        const key = crewKey(
          lane.club,
          race.category,
          race.boatClass,
          Number(race.journeyIndex) || 1,
          lane.crew,
        );
        const target = slotByCrewKey.get(key);
        if (target != null && Number(lane.crewNumber) !== target) {
          laneChanges.push(
            `   race ${race.raceNumber} lane ${lane.lane}: ${
              lane.crewNumber ?? "—"
            } -> ${target}`,
          );
          if (APPLY) {
            lane.crewNumber = target;
            raceDirty = true;
          }
        }
      }
      if (APPLY && raceDirty) await race.save();
    }
    if (laneChanges.length) {
      console.log(`   --- race lanes ---\n${laneChanges.join("\n")}`);
      laneUpdatesTotal += laneChanges.length;
    }
  }

  // ----- apply entry updates -----
  if (APPLY && entryUpdates.length) {
    const ops = entryUpdates.map((u) => ({
      updateOne: { filter: { _id: u._id }, update: { $set: { crewNumber: u.new } } },
    }));
    const res = await CompetitionEntry.bulkWrite(ops);
    console.log(`\n✅ Applied ${res.modifiedCount} entry updates, ${laneUpdatesTotal} lane updates.`);
  }

  console.log("\n----------------------------------------");
  console.log(`Entries to change: ${entryUpdates.length}`);
  console.log(`Race lanes to change: ${laneUpdatesTotal}`);
  if (warnings.length) {
    console.log(`\n⚠️  ${warnings.length} ambiguous case(s) — review and use --overrides:`);
    warnings.forEach((w) => console.log("   " + w));
  }
  if (!APPLY) console.log("\nDRY-RUN only. Re-run with --apply to write changes.");
  await mongoose.disconnect();
}

function assign(slot, entry, journey, slotUsedThisJourney, slotByCrewKey, comp) {
  slot.lastSet = new Set(sortedCrewIds(entry._crewArr));
  slot.history.push({ journey, entry });
  slotUsedThisJourney.add(slot.number);
  slotByCrewKey.set(
    crewKey(entry.club, entry.category, entry.boatClass, journey, entry._crewArr),
    slot.number,
  );
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
