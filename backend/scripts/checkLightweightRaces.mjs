/**
 * Lightweight regression guard.
 *
 * Lightweight is expressed ONLY as `boatClass.weightClass` — Category has no
 * weight-class field — and a lightweight boat keeps the same code as its open
 * twin ("1X"). Anything that derives an event identity or a display label from
 * the boat code alone therefore silently collapses lightweight onto open.
 *
 * This used to be a print-only diagnostic; it now fails (exit code 1) so it can
 * guard a deploy. Run it after any boat-class migration:
 *
 *   node scripts/checkLightweightRaces.mjs
 */

import dns from "node:dns";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { buildEventLabel } from "../Services/eventLabelService.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BACKUP = path.join(ROOT, "docs/boatclass-consolidation-backup.json");

dotenv.config({ path: "../.env" });

const failures = [];
const fail = (message) => failures.push(message);

/** `{catId}::{boatId}::J{n}` -> { categoryId, boatClassId, journeyIndex }. */
const parseEventGroupId = (value) => {
  const parts = String(value || "").split("::");
  if (parts.length !== 3) return null;
  const journeyIndex = Number(String(parts[2]).replace(/^J/i, ""));
  if (!Number.isFinite(journeyIndex)) return null;
  return { categoryId: parts[0], boatClassId: parts[1], journeyIndex };
};

async function main() {
  const dnsServers = (process.env.MONGO_DNS_SERVERS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (dnsServers.length) dns.setServers(dnsServers);

  await mongoose.connect(process.env.URL_DB || process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 25000,
  });
  const db = mongoose.connection.db;
  console.log(`connected: ${mongoose.connection.host}/${db.databaseName}`);

  const boats = await db.collection("boatclasses").find({}).toArray();
  const categories = await db.collection("categories").find({}).toArray();
  const boatById = new Map(boats.map((b) => [String(b._id), b]));
  const categoryById = new Map(categories.map((c) => [String(c._id), c]));

  // 1. Every boat class the consolidation deleted must be back. The backup is
  //    the authoritative list; "a lightweight version of every boat code"
  //    would be wrong (there is no lightweight coxless four, for instance).
  let expectedLightweight = [];
  try {
    const backup = JSON.parse(fs.readFileSync(BACKUP, "utf8"));
    expectedLightweight = Object.values(backup.backup?.duplicates || {}).filter(
      (doc) => doc.weightClass === "lightweight",
    );
  } catch {
    fail(`cannot read ${path.relative(ROOT, BACKUP)}`);
  }

  const presentLightweight = boats.filter((b) => b.weightClass === "lightweight");
  console.log(
    `\nlightweight boat classes present: ${presentLightweight.length}` +
      (presentLightweight.length
        ? ` (${presentLightweight.map((b) => `${b.code}/${b.discipline}`).join(", ")})`
        : ""),
  );
  for (const expected of expectedLightweight) {
    const match = presentLightweight.find(
      (b) => b.code === expected.code && b.discipline === expected.discipline,
    );
    if (!match) {
      fail(
        `${expected.discipline} ${expected.code} lightweight: deleted by the consolidation and still missing`,
      );
      continue;
    }
    console.log(
      `  = ${expected.discipline} ${expected.code} lightweight restored as ${String(match._id)}`,
    );
  }

  // 2. eventGroupId and boatClass must never disagree: the id is the historical
  //    record of which boat class a race really belonged to.
  for (const coll of ["competitionraces", "officialresults"]) {
    let checked = 0;
    const mismatched = [];
    for await (const doc of db
      .collection(coll)
      .find({}, { projection: { eventGroupId: 1, boatClass: 1 } })) {
      const parsed = parseEventGroupId(doc.eventGroupId);
      if (!parsed) continue;
      checked += 1;
      if (parsed.boatClassId !== String(doc.boatClass)) {
        mismatched.push({
          _id: String(doc._id),
          eventGroupSays: boatById.get(parsed.boatClassId)
            ? `${boatById.get(parsed.boatClassId).code}/${boatById.get(parsed.boatClassId).weightClass}`
            : parsed.boatClassId,
          fieldSays: boatById.get(String(doc.boatClass))
            ? `${boatById.get(String(doc.boatClass)).code}/${boatById.get(String(doc.boatClass)).weightClass}`
            : String(doc.boatClass),
        });
      }
    }
    console.log(`\n${coll}: ${checked} document(s) with an eventGroupId, ${mismatched.length} mismatch(es)`);
    mismatched.slice(0, 10).forEach((m) =>
      console.log(`  ! ${m._id}  eventGroupId=${m.eventGroupSays}  boatClass=${m.fieldSays}`),
    );
    if (mismatched.length) {
      fail(`${coll}: ${mismatched.length} document(s) whose boatClass contradicts their eventGroupId`);
    }
  }

  // 3. No dangling boat-class references.
  for (const coll of ["competitionraces", "officialresults", "competitionentries"]) {
    const dangling = await db
      .collection(coll)
      .aggregate([
        { $match: { boatClass: { $ne: null } } },
        {
          $lookup: {
            from: "boatclasses",
            localField: "boatClass",
            foreignField: "_id",
            as: "bc",
          },
        },
        { $match: { bc: { $size: 0 } } },
        { $count: "n" },
      ])
      .toArray();
    const n = dangling[0]?.n || 0;
    console.log(`${coll}: ${n} dangling boatClass reference(s)`);
    if (n) fail(`${coll}: ${n} document(s) point at a boat class that does not exist`);
  }

  // 4. Every lightweight official result must carry the lightweight marker in
  //    its stored label — this is what users see in the UI and in the PDF.
  let lwResults = 0;
  const mislabelled = [];
  for await (const doc of db.collection("officialresults").find({})) {
    const boat = boatById.get(String(doc.boatClass));
    if (boat?.weightClass !== "lightweight") continue;
    lwResults += 1;
    const want = buildEventLabel(categoryById.get(String(doc.category)), boat);
    if (doc.eventLabel !== want) mislabelled.push({ _id: String(doc._id), got: doc.eventLabel, want });
  }
  console.log(
    `\nlightweight official results: ${lwResults}, mislabelled: ${mislabelled.length}`,
  );
  mislabelled.slice(0, 10).forEach((m) =>
    console.log(`  ! ${m._id}  "${m.got}" should be "${m.want}"`),
  );
  if (mislabelled.length) {
    fail(
      `officialresults: ${mislabelled.length} lightweight result(s) labelled as their open twin`,
    );
  }

  // 5. Report the lightweight footprint so a silent wipe is visible.
  const raceCount = await db.collection("competitionraces").countDocuments({
    boatClass: { $in: boats.filter((b) => b.weightClass === "lightweight").map((b) => b._id) },
  });
  console.log(`races using a lightweight boat class: ${raceCount}`);

  await mongoose.disconnect();

  if (failures.length) {
    console.error(`\nFAILED (${failures.length}):`);
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }
  console.log("\nOK - no lightweight regressions detected.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});