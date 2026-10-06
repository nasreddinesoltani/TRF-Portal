/**
 * Repair the lightweight boat classes deleted by the 2026-10-03 consolidation.
 *
 * The consolidation merged every duplicate-looking boat class into the first
 * one it found for a given `code`, ignoring `discipline` and `weightClass`.
 * That deleted all three lightweight boat classes and re-pointed 101 races,
 * 253 entries, 28 official results and 14 competition references at the open
 * equivalents. Lightweight is only ever expressed as
 * `boatClass.weightClass` (Category has no weight-class field at all), so the
 * concept became unrepresentable and every lightweight event silently
 * relabelled itself as its open equivalent.
 *
 * HOW THE IDENTITIES ARE RECOVERED
 * --------------------------------
 * `eventGroupId` is a composite string built by buildDefaultEventGroupId():
 *
 *     `${categoryId}::${boatClassId}::J${journeyIndex}`
 *
 * The consolidation only rewrote the `boatClass` field, so those strings
 * still embed the ORIGINAL boat-class id. That gives an exact, verifiable
 * mapping back to the lightweight boat classes. As a cross-check, the number
 * of official results recovered this way (16 + 12 = 28) matches the
 * `officialresults` counts recorded in docs/boatclass-consolidation-backup.json
 * exactly.
 *
 * USAGE
 *   node scripts/repairLightweightBoatClasses.mjs            # dry run (default)
 *   node scripts/repairLightweightBoatClasses.mjs --apply    # write to MongoDB
 *   node scripts/repairLightweightBoatClasses.mjs --apply --indoor
 *                                                            # + re-point indoor 1X
 *
 * `--indoor` is opt-in because it is a judgement call: the 60 indoor 1X
 * races/entries definitely used an *indoor* 1X boat class before (54 open,
 * 6 lightweight), but only the 6 lightweight ones cannot be told apart from
 * the current data. The flag moves all 60 to the indoor OPEN class, which is
 * exactly right for 54 of them.
 *
 * A full before-state is written to docs/lightweight-repair-rollback.json on
 * every --apply so the change can be reverted.
 */

import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { buildEventLabel } from "../Services/eventLabelService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const BACKUP = path.join(ROOT, "docs/boatclass-consolidation-backup.json");
const ROLLBACK = path.join(ROOT, "docs/lightweight-repair-rollback.json");

const APPLY = process.argv.includes("--apply");
const WITH_INDOOR = process.argv.includes("--indoor");

dotenv.config({ path: path.join(ROOT, ".env") });

const { ObjectId } = mongoose.Types;
const oid = (v) => new ObjectId(String(v));
const sid = (v) => String(v);

/** Boat classes the consolidation deleted, keyed by their original _id. */
const DELETED_IDS = [
  "69404f59e179b631837f8721", // 1X classic  lightweight
  "69404f59e179b631837f8722", // 2X classic  lightweight
  "6973837e9b663c8204702e5e", // 1X indoor   lightweight
  "6973869c5ec5027cea7eaf5e", // 1X indoor   open
];

const LIGHTWEIGHT_IDS = DELETED_IDS.filter((id) => id !== "6973869c5ec5027cea7eaf5e");

/** Parses `{catId}::{boatId}::J{n}`; returns null when absent/malformed. */
const parseEventGroupId = (value) => {
  const parts = String(value || "").split("::");
  if (parts.length !== 3) return null;
  const journey = Number(String(parts[2]).replace(/^J/i, ""));
  if (!Number.isFinite(journey)) return null;
  return { categoryId: parts[0], boatClassId: parts[1], journeyIndex: journey };
};

const main = async () => {
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
  console.log(APPLY ? "MODE: APPLY (writes enabled)" : "MODE: DRY RUN (no writes)");

  const backup = JSON.parse(fs.readFileSync(BACKUP, "utf8"));
  const duplicates = backup.backup?.duplicates || {};
  const rollback = {
    generatedAt: new Date().toISOString(),
    consolidationBackupDate: backup.backup?.date,
    boatClassesDeleted: [],
    races: [],
    officialResults: [],
    competitions: [],
    entries: [],
  };

  // ---------------------------------------------------------------- Phase A
  console.log("\n=== PHASE A: re-insert the deleted boat class documents ===");
  const toInsert = [];
  for (const id of DELETED_IDS) {
    const doc = duplicates[id];
    if (!doc) {
      console.log(`  ! ${id} has no backup document - SKIPPED`);
      continue;
    }
    const existing = await db.collection("boatclasses").findOne({ _id: oid(id) });
    if (existing) {
      console.log(`  = ${id} already present (${existing.code}/${existing.discipline}/${existing.weightClass})`);
      continue;
    }
    const { _id, ...rest } = doc;
    toInsert.push({ _id: oid(_id), ...rest });
    console.log(
      `  + ${id}  ${doc.code}/${doc.discipline}/${doc.weightClass}  "${doc.names?.en}"`,
    );
  }
  if (toInsert.length) {
    console.log(`  -> would insert ${toInsert.length} document(s)`);
    if (APPLY) {
      await db.collection("boatclasses").insertMany(toInsert, { ordered: true });
      rollback.boatClassesDeleted.push(
        ...toInsert.map((d) => ({ _id: String(d._id), code: d.code })),
      );
      console.log(`  -> inserted ${toInsert.length} document(s)`);
    }
  }

  // ---------------------------------------------------------------- Phase B
  console.log("\n=== PHASE B: re-point races and official results via eventGroupId ===");
  const races = await db
    .collection("competitionraces")
    .find({}, { projection: { category: 1, boatClass: 1, eventGroupId: 1, competition: 1, eventLabel: 1 } })
    .toArray();
  const results = await db
    .collection("officialresults")
    .find({}, { projection: { category: 1, boatClass: 1, eventGroupId: 1, competition: 1, eventLabel: 1 } })
    .toArray();

  /**
   * Groups documents whose eventGroupId still embeds a deleted boat-class id
   * into targetBoatClassId -> [document ids].
   */
  const recover = (docs) => {
    const byGroup = new Map();
    for (const doc of docs) {
      const parsed = parseEventGroupId(doc.eventGroupId);
      if (!parsed || !DELETED_IDS.includes(parsed.boatClassId)) continue;
      if (sid(doc.boatClass) === parsed.boatClassId) continue; // already correct
      if (!byGroup.has(parsed.boatClassId)) byGroup.set(parsed.boatClassId, []);
      byGroup.get(parsed.boatClassId).push(String(doc._id));
    }
    return byGroup;
  };

  const raceRecovery = recover(races);
  const resultRecovery = recover(results);

  const label = (id) => {
    const d = duplicates[id];
    return d ? `${d.code}/${d.discipline}/${d.weightClass}` : id;
  };

  for (const [target, ids] of raceRecovery) {
    console.log(`  races -> ${target} (${label(target)}): ${ids.length}`);
  }
  for (const [target, ids] of resultRecovery) {
    console.log(`  officialresults -> ${target} (${label(target)}): ${ids.length}`);
  }
  const raceTotal = [...raceRecovery.values()].reduce((n, ids) => n + ids.length, 0);
  const resultTotal = [...resultRecovery.values()].reduce((n, ids) => n + ids.length, 0);
  console.log(`  -> would re-point ${raceTotal} race(s) and ${resultTotal} official result(s)`);

  const recorded = (backup.changes || []).filter((c) => c.coll === "officialresults");
  console.log(
    `  -> cross-check vs backup: recovered ${resultTotal}, backup recorded ${recorded.reduce((n, c) => n + c.modified, 0)}`,
  );

  if (APPLY && raceTotal) {
    for (const [target, ids] of raceRecovery) {
      const before = await db
        .collection("competitionraces")
        .find({ _id: { $in: ids.map(oid) } })
        .project({ boatClass: 1 })
        .toArray();
      before.forEach((r) =>
        rollback.races.push({ _id: String(r._id), boatClass: sid(r.boatClass) }),
      );
      await db
        .collection("competitionraces")
        .updateMany({ _id: { $in: ids.map(oid) } }, { $set: { boatClass: oid(target) } });
      console.log(`     updated ${ids.length} race(s) -> ${target}`);
    }
    for (const [target, ids] of resultRecovery) {
      const oidList = ids.map(oid);
      const before = await db
        .collection("officialresults")
        .find({ _id: { $in: oidList } })
        .project({ boatClass: 1 })
        .toArray();
      before.forEach((r) =>
        rollback.officialResults.push({ _id: String(r._id), boatClass: sid(r.boatClass) }),
      );
      await db
        .collection("officialresults")
        .updateMany({ _id: { $in: oidList } }, { $set: { boatClass: oid(target) } });
      console.log(`     updated ${ids.length} official result(s) -> ${target}`);
    }
  }

  // ---------------------------------------------------------------- Phase C
  console.log("\n=== PHASE C: competitions.allowedBoatClasses ===");
  const competitions = await db
    .collection("competitions")
    .find({}, { projection: { code: 1, discipline: 1, allowedBoatClasses: 1 } })
    .toArray();
  const compById = new Map(competitions.map((c) => [sid(c._id), c]));
  const neededByComp = new Map();
  for (const race of races) {
    const parsed = parseEventGroupId(race.eventGroupId);
    if (!parsed || !LIGHTWEIGHT_IDS.includes(parsed.boatClassId)) continue;
    const key = sid(race.competition);
    if (!neededByComp.has(key)) neededByComp.set(key, new Set());
    neededByComp.get(key).add(parsed.boatClassId);
  }
  let compTouch = 0;
  for (const [compId, needed] of neededByComp) {
    const comp = compById.get(compId);
    if (!comp) continue;
    const current = new Set((comp.allowedBoatClasses || []).map(sid));
    const missing = [...needed].filter((id) => !current.has(id));
    if (!missing.length) continue;
    compTouch += 1;
    console.log(
      `  + ${comp.code}: add ${missing.map((m) => label(m)).join(", ")} (allowlist had been stripped)`,
    );
    if (APPLY) {
      rollback.competitions.push({
        _id: compId,
        allowedBoatClasses: (comp.allowedBoatClasses || []).map(sid),
      });
      await db
        .collection("competitions")
        .updateOne({ _id: oid(compId) }, { $push: { allowedBoatClasses: { $each: missing.map(oid) } } });
    }
  }
  if (!compTouch) console.log("  = every competition already allows its lightweight classes");

  // ---------------------------------------------------------------- Phase D
  console.log(
    "\n=== PHASE D: entries (only where the owning race is unambiguous) ===",
  );
  // Group races by the event they belong to, using the RECOVERED boat class.
  const raceByEvent = new Map();
  for (const race of races) {
    const parsed = parseEventGroupId(race.eventGroupId);
    const boatId = parsed && DELETED_IDS.includes(parsed.boatClassId)
      ? parsed.boatClassId
      : sid(race.boatClass);
    const catId = sid(race.category);
    const key = `${sid(race.competition)}|${catId}|${race.journeyIndex || 1}`;
    if (!raceByEvent.has(key)) raceByEvent.set(key, new Map());
    const byCode = raceByEvent.get(key);
    byCode.set(boatId, (byCode.get(boatId) || 0) + 1);
  }

  const entries = await db
    .collection("competitionentries")
    .find({}, { projection: { competition: 1, category: 1, boatClass: 1, journeyIndex: 1 } })
    .toArray();
  const boatsById = new Map(
    (await db.collection("boatclasses").find({}, { projection: { code: 1 } }).toArray()).map((b) => [
      sid(b._id),
      b.code,
    ]),
  );
  // The lightweight classes are re-inserted by Phase A, so during a dry run
  // they are still missing from the database. Seed them from the backup so the
  // dry run and the applied run classify entries identically.
  for (const [id, doc] of Object.entries(duplicates)) {
    if (!boatsById.has(id)) boatsById.set(id, doc.code);
  }

  const entryTargets = new Map();
  const ambiguous = [];
  for (const entry of entries) {
    const key = `${sid(entry.competition)}|${sid(entry.category)}|${entry.journeyIndex || 1}`;
    const byCode = raceByEvent.get(key);
    if (!byCode) continue;
    const fromCode = boatsById.get(sid(entry.boatClass));
    // Candidate races in this event that use the same boat code.
    const candidates = [...byCode.entries()].filter(([boatId]) => boatsById.get(boatId) === fromCode);
    if (candidates.length === 0) continue;
    if (candidates.length > 1) {
      ambiguous.push({ entry, key, candidates: candidates.map(([id]) => id) });
      continue;
    }
    const target = candidates[0][0];
    if (target === sid(entry.boatClass)) continue;
    if (!entryTargets.has(target)) entryTargets.set(target, []);
    entryTargets.get(target).push(String(entry._id));
  }

  let entryTotal = 0;
  for (const [target, ids] of entryTargets) {
    entryTotal += ids.length;
    console.log(`  entries -> ${target} (${label(target)}): ${ids.length}`);
  }
  console.log(`  -> would re-point ${entryTotal} entr(ies)`);
  console.log(
    `  -> ${ambiguous.length} entr(ies) skipped as AMBIGUOUS (an open and a lightweight race share the same event + boat code)`,
  );
  if (APPLY && entryTotal) {
    for (const [target, ids] of entryTargets) {
      const before = await db
        .collection("competitionentries")
        .find({ _id: { $in: ids.map(oid) } })
        .project({ boatClass: 1 })
        .toArray();
      before.forEach((e) =>
        rollback.entries.push({ _id: String(e._id), boatClass: sid(e.boatClass) }),
      );
      await db
        .collection("competitionentries")
        .updateMany({ _id: { $in: ids.map(oid) } }, { $set: { boatClass: oid(target) } });
    }
    console.log(`     updated ${entryTotal} entr(ies)`);
  }

  // ---------------------------------------------------------------- Phase E
  if (WITH_INDOOR) {
    console.log("\n=== PHASE E (--indoor): re-point indoor 1X to the indoor boat class ===");
    const indoorComps = competitions.filter((c) => c.discipline === "indoor");
    const indoorOpenId = "6973869c5ec5027cea7eaf5e";
    const canonical1X = "6915b96b925c07100b26120b";
    let indoorRaces = 0;
    let indoorEntries = 0;
    for (const comp of indoorComps) {
      const compId = oid(sid(comp._id));
      const r = await db
        .collection("competitionraces")
        .find({ competition: compId, boatClass: oid(canonical1X) })
        .project({ _id: 1 })
        .toArray();
      const e = await db
        .collection("competitionentries")
        .find({ competition: compId, boatClass: oid(canonical1X) })
        .project({ _id: 1 })
        .toArray();
      indoorRaces += r.length;
      indoorEntries += e.length;
      console.log(
        `  ${comp.code}: ${r.length} race(s), ${e.length} entr(ies) classic 1X -> indoor 1X (open)`,
      );
      if (APPLY) {
        r.forEach((d) => rollback.races.push({ _id: String(d._id), boatClass: canonical1X }));
        e.forEach((d) => rollback.entries.push({ _id: String(d._id), boatClass: canonical1X }));
        await db
          .collection("competitionraces")
          .updateMany({ competition: compId, boatClass: oid(canonical1X) }, { $set: { boatClass: oid(indoorOpenId) } });
        await db
          .collection("competitionentries")
          .updateMany({ competition: compId, boatClass: oid(canonical1X) }, { $set: { boatClass: oid(indoorOpenId) } });
      }
    }
    console.log(
      `  -> would re-point ${indoorRaces} race(s) and ${indoorEntries} entr(ies) to the indoor OPEN class`,
    );
    console.log(
      "  ! 6 of those were the indoor LIGHTWEIGHT class; they are listed in the worksheet for manual re-tagging.",
    );
  } else {
    console.log("\n=== PHASE E: skipped (pass --indoor to include) ===");
  }

  // ---------------------------------------------------------------- Phase F
  console.log("\n=== PHASE F: refresh the stored eventLabel of lightweight results ===");
  // The label is a denormalised copy of "<category> <boatCode>", which cannot
  // express a weight class, so every lightweight result published after the
  // consolidation is labelled as its open twin ("M 2X" instead of "LM 2X").
  // Only lightweight documents are touched: the same staleness also affects
  // open results whose category abbreviation was renamed (MM -> U15M), which is
  // a separate, unrelated change.
  const boatDocs = await db.collection("boatclasses").find({}).toArray();
  const categoryDocs = await db.collection("categories").find({}).toArray();
  const boatDocById = new Map(boatDocs.map((b) => [sid(b._id), b]));
  const categoryDocById = new Map(categoryDocs.map((c) => [sid(c._id), c]));

  const relabel = results.filter((doc) => {
    const boat = boatDocById.get(sid(doc.boatClass));
    if (boat?.weightClass !== "lightweight") return false;
    const category = categoryDocById.get(sid(doc.category));
    return buildEventLabel(category, boat) !== doc.eventLabel;
  });

  const relabelByLabel = new Map();
  for (const doc of relabel) {
    const want = buildEventLabel(
      categoryDocById.get(sid(doc.category)),
      boatDocById.get(sid(doc.boatClass)),
    );
    relabelByLabel.set(`${doc.eventLabel} -> ${want}`, (relabelByLabel.get(`${doc.eventLabel} -> ${want}`) || 0) + 1);
  }
  for (const [change, count] of [...relabelByLabel].sort()) {
    console.log(`  ${count} x  ${change}`);
  }
  console.log(`  -> would relabel ${relabel.length} official result(s)`);

  if (APPLY && relabel.length) {
    for (const doc of relabel) {
      const want = buildEventLabel(
        categoryDocById.get(sid(doc.category)),
        boatDocById.get(sid(doc.boatClass)),
      );
      rollback.officialResults.push({
        _id: String(doc._id),
        eventLabel: doc.eventLabel,
      });
      await db
        .collection("officialresults")
        .updateOne({ _id: doc._id }, { $set: { eventLabel: want } });
    }
    console.log(`     relabelled ${relabel.length} official result(s)`);
  }

  // ---------------------------------------------------------------- Worksheet
  console.log("\n=== WORKSHEET: items that need a human decision ===");
  const worksheet = [];
  const noEventGroupId = races.filter((r) => !parseEventGroupId(r.eventGroupId));
  const indoor1X = noEventGroupId.filter((r) => {
    const comp = compById.get(sid(r.competition));
    return comp?.discipline === "indoor" && boatsById.get(sid(r.boatClass)) === "1X";
  });
  console.log(
    `  indoor 1X races with no eventGroupId (6 were lightweight per the backup): ${indoor1X.length}`,
  );
  for (const race of indoor1X) {
    worksheet.push({
      kind: "race",
      _id: String(race._id),
      competition: compById.get(sid(race.competition))?.code,
      discipline: "indoor",
      reason: "indoor 1X; lightweight vs open indistinguishable",
    });
  }
  console.log(
    `  races with no eventGroupId outside indoor: ${noEventGroupId.length - indoor1X.length} (cannot be attributed at all)`,
  );
  console.log(`  entries skipped as ambiguous: ${ambiguous.length}`);
  for (const a of ambiguous) {
    worksheet.push({
      kind: "entry",
      _id: String(a.entry._id),
      competition: compById.get(sid(a.entry.competition))?.code,
      reason: "open and lightweight race share event + boat code",
      candidates: a.candidates.map(label),
    });
  }
  fs.writeFileSync(
    path.join(ROOT, "docs/lightweight-repair-worksheet.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), items: worksheet }, null, 2),
  );
  console.log("  -> wrote docs/lightweight-repair-worksheet.json");

  if (APPLY) {
    fs.writeFileSync(ROLLBACK, JSON.stringify(rollback, null, 2));
    console.log(`\nrollback state written: ${path.relative(ROOT, ROLLBACK)}`);
  } else {
    console.log("\nDRY RUN - nothing was written. Re-run with --apply to execute.");
  }

  await mongoose.disconnect();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});