/**
 * Final-journey qualification verification script.
 *
 * Scenario mode (always runs, no database needed):
 *   node scripts/testFinalQualification.mjs
 *
 * Live mode (additionally runs the computation against a real competition):
 *   node scripts/testFinalQualification.mjs <competitionId>
 *
 * Exits non-zero if any scenario fails.
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import {
  computeFinalQualification,
  computeQualificationStandings,
  selectQualifiedCrews,
  QUALIFYING_LANE_PATTERN,
  DEFAULT_QUALIFY_TOP_N,
} from "../Services/qualificationService.js";

// === Test harness ==========================================================

const failures = [];
let scenarioNumber = 0;

function scenario(name, fn) {
  scenarioNumber += 1;
  try {
    fn();
    console.log(`PASS  ${scenarioNumber}. ${name}`);
  } catch (error) {
    failures.push({ scenario: name, error });
    console.log(`FAIL  ${scenarioNumber}. ${name}`);
    console.log(`      ${error.message}`);
  }
}

function assertEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${message}\n      expected: ${e}\n      actual:   ${a}`);
  }
}

function assertTrue(value, message) {
  if (!value) throw new Error(message);
}

// === Fixture builders ======================================================

// Default federation point table (rankingSystemModel DEFAULT_POINT_TABLE).
// 1st=20, 2nd=12, 3rd=8, 4th=6, 5th=4, 6th=3, 7th=2, 8th=1, 9+=0.

const club = (id, code) => ({ _id: id, code, name: code });

let raceCounter = 0;
function makeRace({ journeyIndex, phase = "Heat 1", name, lanes, category = "cat-1", boatClass = "boat-1" }) {
  raceCounter += 1;
  return {
    _id: `race-${raceCounter}`,
    category,
    boatClass,
    journeyIndex,
    name: name || `Race ${raceCounter}`,
    phase,
    status: "completed",
    lanes,
  };
}

// slot: { club, crewNumber, crew } — a crew slot entered across journeys.
function lane(laneNumber, slot, { status = "ok", finishPosition, elapsedMs } = {}) {
  return {
    lane: laneNumber,
    club: slot.club,
    crewNumber: slot.crewNumber,
    crew: slot.crew,
    result: { status, finishPosition, elapsedMs },
  };
}

function slot(clubCode, { crewNumber, crew = [] } = {}) {
  return { club: club(`club-${clubCode.toLowerCase()}`, clubCode), crewNumber, crew };
}

function qualify(races, options = {}) {
  // Scenario competitions race preliminary journeys 1 and 2; the final
  // journey (3) exists but is not raced yet, so it must be stated explicitly
  // (the API derives it from the competition's isFinalDay stage).
  const events = computeFinalQualification(races, {
    topN: DEFAULT_QUALIFY_TOP_N,
    finalJourneyIndex: 3,
    ...options,
  });
  assertTrue(events.length > 0, "expected at least one event group");
  return events[0];
}

const labels = (event) => event.qualified.map((crew) => crew.label);
const lanes = (event) => event.qualified.map((crew) => crew.lane);
const via = (event) => event.qualified.map((crew) => crew.qualifiedVia);

// === Scenarios =============================================================

console.log("=".repeat(80));
console.log("FINAL-JOURNEY QUALIFICATION — SCENARIO TESTS");
console.log("=".repeat(80));

// 1. Points accumulate over journeys (1st+3rd = 28 outranks 2nd+4th = 18).
scenario("points accumulate across journeys and order the standings", () => {
  const A = slot("ASL", { crewNumber: 1, crew: ["ath-a"] });
  const B = slot("EPT", { crewNumber: 1, crew: ["ath-b"] });
  const C = slot("CSN", { crewNumber: 1, crew: ["ath-c"] });
  const D = slot("ASC", { crewNumber: 1, crew: ["ath-d"] });

  const races = [
    makeRace({ journeyIndex: 1, lanes: [
      lane(3, A, { finishPosition: 1, elapsedMs: 600 }),
      lane(4, B, { finishPosition: 2, elapsedMs: 610 }),
      lane(2, C, { finishPosition: 3, elapsedMs: 620 }),
      lane(5, D, { finishPosition: 4, elapsedMs: 630 }),
    ]}),
    makeRace({ journeyIndex: 2, lanes: [
      lane(3, C, { finishPosition: 1, elapsedMs: 500 }),
      lane(4, D, { finishPosition: 2, elapsedMs: 510 }),
      lane(2, A, { finishPosition: 3, elapsedMs: 560 }),
      lane(5, B, { finishPosition: 4, elapsedMs: 570 }),
    ]}),
  ];

  const event = qualify(races);
  const byLabel = Object.fromEntries(event.standings.map((c) => [c.label, c]));
  assertEqual(byLabel.ASL1.totalPoints, 28, "ASL1 = 1st (20) + 3rd (8)");
  assertEqual(byLabel.CSN1.totalPoints, 28, "CSN1 = 3rd (8) + 1st (20)");
  assertEqual(byLabel.ASC1.totalPoints, 18, "ASC1 = journey rank 4 (6) + rank 2 (12)");
  assertEqual(byLabel.EPT1.totalPoints, 18, "EPT1 = journey rank 2 (12) + rank 4 (6)");
  // ASL1/CSN1 tie on points -> total time decides (1120 < 1160).
  assertEqual(labels(event), ["CSN1", "ASL1", "ASC1", "EPT1"], "standings order");
});

// 2. Doubles: points go to the crew SLOT (ASL1) even when athletes change.
scenario("doubles: points accrue to the crew slot despite athlete substitution", () => {
  const aslJourney1 = slot("ASL", { crewNumber: 1, crew: ["ath-asl-rower-1"] });
  const aslJourney2 = slot("ASL", { crewNumber: 1, crew: ["ath-asl-rower-2"] }); // substituted
  const ept = slot("EPT", { crewNumber: 1, crew: ["ath-ept-rower-1"] });
  const f1 = slot("FF1", { crew: ["ath-f1"] });
  const f2 = slot("FF2", { crew: ["ath-f2"] });

  const races = [
    makeRace({ journeyIndex: 1, boatClass: "boat-2x", lanes: [
      lane(3, aslJourney1, { finishPosition: 1, elapsedMs: 300 }),
      lane(4, ept, { finishPosition: 2, elapsedMs: 310 }),
      lane(2, f1, { finishPosition: 3, elapsedMs: 320 }),
      lane(5, f2, { finishPosition: 4, elapsedMs: 330 }),
    ]}),
    makeRace({ journeyIndex: 2, boatClass: "boat-2x", lanes: [
      lane(3, ept, { finishPosition: 1, elapsedMs: 320 }),
      lane(4, aslJourney2, { finishPosition: 2, elapsedMs: 340 }),
    ]}),
  ];

  const event = qualify(races);
  const aslEntries = event.standings.filter((c) => c.label === "ASL1");
  assertEqual(aslEntries.length, 1, "ASL1 must be ONE standing despite different athletes");
  assertEqual(aslEntries[0].totalPoints, 32, "ASL1 = 1st (20) + 2nd (12)");
  assertEqual(aslEntries[0].appearances.length, 2, "two journey appearances");
  assertEqual(aslEntries[0].crew, ["ath-asl-rower-2"], "latest crew line-up reported");
  assertEqual(labels(event), ["EPT1", "ASL1", "FF1", "FF2"], "EPT1 ahead on total time (630 < 640)");
});

// 3. 12 crews across 2 journeys -> exactly the top 6 qualify, in order.
scenario("12 crews: exactly the top 6 qualify in order, strict cut", () => {
  const crews = [];
  for (let i = 1; i <= 12; i += 1) {
    crews.push(slot(`C${String(i).padStart(2, "0")}`, { crew: [`ath-c${i}`] }));
  }
  const journey1Lanes = crews.map((s, i) =>
    lane(i + 1, s, { finishPosition: i + 1, elapsedMs: 600 + 10 * (i + 1) }),
  );
  const journey2Lanes = crews.map((s, i) => {
    const position = 12 - i; // c12 wins journey 2, c1 is last
    return lane(i + 1, s, { finishPosition: position, elapsedMs: 700 + 15 * position });
  });

  const event = qualify([
    makeRace({ journeyIndex: 1, lanes: journey1Lanes }),
    makeRace({ journeyIndex: 2, lanes: journey2Lanes }),
  ]);

  // Points: c12 20, c1 20, c11 12, c2 12, c10 8, c3 8, c9 6, c4 6, c8 5, c7 5, c6 5, c5 5.
  // Ties resolved by total time (see fixture times).
  assertEqual(labels(event), ["C12", "C01", "C11", "C02", "C10", "C03"], "top 6 in order");
  assertEqual(event.qualified[6 - 1].label, "C03", "6th qualified crew");
  assertEqual(
    event.standings.slice(6).map((c) => c.label),
    ["C09", "C04", "C08", "C07", "C06", "C05"],
    "C09 (6 pts) misses the cut on total time",
  );
  assertEqual(event.totalQualified, 6, "exactly six qualify");
});

// 4. Two crews tied on POINTS at 6th place -> BOTH qualify (7-boat final),
// even when their total times differ — time only decides lane order.
scenario("equal points at 6th place expands the final to 7 boats", () => {
  const A = slot("A", { crewNumber: 1, crew: ["ath-a"] });
  const B = slot("B", { crewNumber: 1, crew: ["ath-b"] });
  const C = slot("C", { crewNumber: 1, crew: ["ath-c"] });
  const D = slot("D", { crewNumber: 1, crew: ["ath-d"] });
  const E = slot("E", { crewNumber: 1, crew: ["ath-e"] });
  const X = slot("X", { crewNumber: 1, crew: ["ath-x"] });
  const Y = slot("Y", { crewNumber: 1, crew: ["ath-y"] });

  const races = [
    makeRace({ journeyIndex: 1, lanes: [
      lane(3, A, { finishPosition: 1, elapsedMs: 600 }),
      lane(4, B, { finishPosition: 2, elapsedMs: 610 }),
      lane(2, C, { finishPosition: 3, elapsedMs: 620 }),
      lane(5, D, { finishPosition: 4, elapsedMs: 630 }),
      lane(1, E, { finishPosition: 5, elapsedMs: 640 }),
      lane(6, X, { finishPosition: 6, elapsedMs: 760 }),
      lane(7, Y, { finishPosition: 7, elapsedMs: 780 }),
    ]}),
    makeRace({ journeyIndex: 2, lanes: [
      lane(3, A, { finishPosition: 1, elapsedMs: 600 }),
      lane(4, B, { finishPosition: 2, elapsedMs: 610 }),
      lane(2, C, { finishPosition: 3, elapsedMs: 620 }),
      lane(5, D, { finishPosition: 4, elapsedMs: 630 }),
      lane(1, E, { finishPosition: 5, elapsedMs: 640 }),
      lane(6, Y, { finishPosition: 6, elapsedMs: 780 }),
      lane(7, X, { finishPosition: 7, elapsedMs: 790 }),
    ]}),
  ];

  const event = qualify(races);
  // X and Y both total 5 points (3 + 2 / 2 + 3) — a tie on points at the
  // cut, so both go to the final. Their total times differ (1530 vs 1570);
  // that only puts X ahead of Y for the better lane.
  assertEqual(event.totalQualified, 7, "final rowed with 7 boats");
  assertEqual(labels(event), ["A1", "B1", "C1", "D1", "E1", "X1", "Y1"], "X and Y both in");
  assertEqual(via(event), ["points", "points", "points", "points", "points", "points", "tie_expansion"], "Y enters via tie expansion");
  assertEqual(event.exceedsLaneLimit, false, "7 boats still fit 8 lanes");
  assertEqual(lanes(event), [3, 4, 2, 5, 1, 6, 7], "chevron lanes for 7 boats");
});

// 5. Equal points WITH a tie-breaker difference (more first places) -> cut stays at 6.
scenario("equal points resolved by more first places; cut stays at 6", () => {
  const A = slot("A", { crewNumber: 1, crew: ["ath-a"] });
  const B = slot("B", { crewNumber: 1, crew: ["ath-b"] });
  const C = slot("C", { crewNumber: 1, crew: ["ath-c"] });
  const D = slot("D", { crewNumber: 1, crew: ["ath-d"] });
  const E = slot("E", { crewNumber: 1, crew: ["ath-e"] });
  const F = slot("F", { crewNumber: 1, crew: ["ath-f"] });
  const X = slot("X", { crewNumber: 1, crew: ["ath-x"] });
  const Y = slot("Y", { crewNumber: 1, crew: ["ath-y"] });

  const races = [
    makeRace({ journeyIndex: 1, lanes: [
      lane(3, X, { finishPosition: 1, elapsedMs: 610 }),
      lane(4, Y, { finishPosition: 2, elapsedMs: 620 }),
      lane(2, A, { finishPosition: 3, elapsedMs: 630 }),
      lane(5, B, { finishPosition: 4, elapsedMs: 640 }),
      lane(1, C, { finishPosition: 5, elapsedMs: 650 }),
      lane(6, D, { finishPosition: 6, elapsedMs: 660 }),
      lane(7, E, { finishPosition: 7, elapsedMs: 670 }),
      lane(8, F, { finishPosition: 8, elapsedMs: 680 }),
    ]}),
    makeRace({ journeyIndex: 2, lanes: [
      lane(3, A, { finishPosition: 1, elapsedMs: 700 }),
      lane(4, Y, { finishPosition: 2, elapsedMs: 720 }),
      lane(2, B, { finishPosition: 3, elapsedMs: 730 }),
      lane(5, C, { finishPosition: 4, elapsedMs: 740 }),
      lane(1, X, { finishPosition: 5, elapsedMs: 750 }),
      lane(6, D, { finishPosition: 6, elapsedMs: 760 }),
      lane(7, E, { finishPosition: 7, elapsedMs: 770 }),
      lane(8, F, { finishPosition: 8, elapsedMs: 780 }),
    ]}),
  ];

  const event = qualify(races);
  const x = event.standings.find((c) => c.label === "X1");
  const y = event.standings.find((c) => c.label === "Y1");
  assertEqual(x.totalPoints, 24, "X = 1st (20) + 5th (4)");
  assertEqual(y.totalPoints, 24, "Y = 2nd (12) + 2nd (12)");
  assertTrue(x.rank < y.rank, `X (more first places) must rank above Y, got ${x.rank} vs ${y.rank}`);
  assertEqual(event.totalQualified, 6, "no tie at the cut -> exactly 6 boats");
  assertEqual(labels(event), ["A1", "X1", "Y1", "B1", "C1", "D1"], "qualification order");
});

// 6. DNF crews backfill empty slots when fewer than 6 crews qualified.
scenario("DNF backfill when only 4 crews scored; DSQ never qualifies", () => {
  const A = slot("ASL", { crewNumber: 1, crew: ["ath-a"] });
  const B = slot("EPT", { crewNumber: 1, crew: ["ath-b"] });
  const C = slot("CSN", { crewNumber: 1, crew: ["ath-c"] });
  const D = slot("ASC", { crewNumber: 1, crew: ["ath-d"] });
  const X = slot("XXX", { crewNumber: 1, crew: ["ath-x"] });
  const Y = slot("YYY", { crewNumber: 1, crew: ["ath-y"] });
  const Z = slot("ZZZ", { crewNumber: 1, crew: ["ath-z"] });

  const races = [
    makeRace({ journeyIndex: 1, lanes: [
      lane(3, A, { finishPosition: 1, elapsedMs: 600 }),
      lane(4, B, { finishPosition: 2, elapsedMs: 610 }),
      lane(2, C, { finishPosition: 3, elapsedMs: 620 }),
      lane(5, D, { finishPosition: 4, elapsedMs: 630 }),
      lane(6, X, { status: "dnf" }),
      lane(7, Y, { status: "dnf" }),
      lane(1, Z, { status: "dsq" }),
    ]}),
    makeRace({ journeyIndex: 2, lanes: [
      lane(3, B, { finishPosition: 1, elapsedMs: 600 }),
      lane(4, C, { finishPosition: 2, elapsedMs: 610 }),
      lane(2, D, { finishPosition: 3, elapsedMs: 620 }),
      lane(5, A, { finishPosition: 4, elapsedMs: 630 }),
      lane(6, X, { status: "dnf" }),
      lane(7, Y, { status: "dnf" }),
    ]}),
  ];

  // DNF crews score no points under the consolidation convention, so the
  // backfill path applies naturally.
  const event = qualify(races);
  assertEqual(labels(event), ["EPT1", "ASL1", "CSN1", "ASC1", "XXX1", "YYY1"], "DNF crews fill slots 5-6");
  assertEqual(via(event), ["points", "points", "points", "points", "backfill", "backfill"], "X and Y enter via backfill");
  assertEqual(event.backfilling, true, "backfill mode flagged");
  assertEqual(event.pointQualifiedCount, 4, "only four crews scored points");
  assertTrue(
    !event.qualified.some((c) => c.label === "ZZZ1"),
    "DSQ-only crew must never qualify",
  );
  assertEqual(
    event.ineligible.map((c) => c.label),
    ["ZZZ1"],
    "DSQ-only crew listed as ineligible",
  );
});

// 7. DNF/untimed crews score no points (consolidation convention).
scenario("DNF crews score no points and only enter via backfill", () => {
  const A = slot("ASL", { crewNumber: 1, crew: ["ath-a"] });
  const B = slot("EPT", { crewNumber: 1, crew: ["ath-b"] });
  const C = slot("CSN", { crewNumber: 1, crew: ["ath-c"] });
  const X = slot("XXX", { crewNumber: 1, crew: ["ath-x"] });

  const race = (journeyIndex) => makeRace({ journeyIndex, lanes: [
    lane(3, A, { finishPosition: 1, elapsedMs: 600 }),
    lane(4, B, { finishPosition: 2, elapsedMs: 610 }),
    lane(2, C, { finishPosition: 3, elapsedMs: 620 }),
    lane(5, X, { status: "dnf" }),
  ]});

  const event = qualify([race(1), race(2)]);
  const x = event.standings.find((c) => c.label === "XXX1");
  assertEqual(x.totalPoints, 0, "DNF scores no points in any journey");
  assertEqual(x.appearances[0].rank, null, "no journey rank for DNF");
  assertEqual(x.appearances[0].status, "dnf", "journey row reports the DNF status");
  assertEqual(event.pointQualifiedCount, 3, "only the three finishers scored");
  assertEqual(event.backfilling, true, "X only enters via backfill");
  assertEqual(event.qualified[event.qualified.length - 1].label, "XXX1", "X takes the last slot");
});

// 7b. Journeys consolidate their races BY TIME (ranking system convention):
// a heat winner in a slow heat earns few points — the daouey/Herichi case.
scenario("journey points consolidate all heats by time, not per heat", () => {
  const H = slot("ASL", { crewNumber: 1, crew: ["ath-herichi"] });
  const S = slot("CNMT", { crewNumber: 1, crew: ["ath-seddik"] });
  const T = slot("CTASAD", { crewNumber: 1, crew: ["ath-bentkayat"] });
  const D = slot("CTASAD2", { crewNumber: 1, crew: ["ath-daouey"] });
  const L = slot("EPT", { crewNumber: 1, crew: ["ath-laouer"] });

  const races = [
    makeRace({ journeyIndex: 3, name: "CM 1", lanes: [
      lane(1, H, { finishPosition: 1, elapsedMs: 496680 }),
      lane(2, S, { finishPosition: 2, elapsedMs: 497530 }),
      lane(3, T, { finishPosition: 3, elapsedMs: 526120 }),
    ]}),
    makeRace({ journeyIndex: 3, name: "CM 2", lanes: [
      lane(1, D, { finishPosition: 1, elapsedMs: 586810 }),
      lane(2, L, { finishPosition: 2, elapsedMs: 594940 }),
    ]}),
  ];

  const event = qualify(races, { finalJourneyIndex: 4 });
  const byLabel = Object.fromEntries(event.standings.map((c) => [c.label, c]));
  assertEqual(byLabel.ASL1.totalPoints, 20, "fastest of the journey -> 20 pts");
  assertEqual(byLabel.CNMT1.totalPoints, 12, "second-fastest -> 12 pts");
  assertEqual(byLabel.CTASAD1.totalPoints, 8, "third-fastest -> 8 pts");
  assertEqual(
    byLabel.CTASAD21.totalPoints,
    6,
    "heat winner of the SLOW heat -> consolidated rank 4 -> 6 pts (not 20)",
  );
  assertEqual(byLabel.EPT1.totalPoints, 4, "consolidated rank 5 -> 4 pts");
});

// 8. DSQ / DNS / ABS / withdrawn / hors_course never qualify.
scenario("DNS/DSQ/ABS/withdrawn crews are ineligible; hors_course invisible", () => {
  const A = slot("ASL", { crewNumber: 1, crew: ["ath-a"] });
  const B = slot("EPT", { crewNumber: 1, crew: ["ath-b"] });
  const C = slot("CSN", { crewNumber: 1, crew: ["ath-c"] });
  const W = slot("WWW", { crewNumber: 1, crew: ["ath-w"] });
  const X = slot("XXX", { crewNumber: 1, crew: ["ath-x"] });
  const Y = slot("YYY", { crewNumber: 1, crew: ["ath-y"] });
  const Z = slot("ZZZ", { crewNumber: 1, crew: ["ath-z"] });
  const H = slot("HHH", { crewNumber: 1, crew: ["ath-h"] });

  const statusLane = (laneNumber, s, status) => lane(laneNumber, s, { status });
  const races = [
    makeRace({ journeyIndex: 1, lanes: [
      lane(3, A, { finishPosition: 1, elapsedMs: 600 }),
      lane(4, B, { finishPosition: 2, elapsedMs: 610 }),
      lane(2, C, { finishPosition: 3, elapsedMs: 620 }),
      statusLane(5, W, "dns"),
      statusLane(6, X, "dsq"),
      statusLane(7, Y, "abs"),
      statusLane(1, Z, "withdrawn"),
      statusLane(8, H, "hors_course"),
    ]}),
    makeRace({ journeyIndex: 2, lanes: [
      lane(3, A, { finishPosition: 1, elapsedMs: 600 }),
      lane(4, B, { finishPosition: 2, elapsedMs: 610 }),
      lane(2, C, { finishPosition: 3, elapsedMs: 620 }),
      statusLane(5, W, "dns"),
      statusLane(6, X, "dsq"),
      statusLane(7, Y, "abs"),
      statusLane(1, Z, "withdrawn"),
      statusLane(8, H, "hors_course"),
    ]}),
  ];

  const event = qualify(races);
  assertEqual(labels(event), ["ASL1", "EPT1", "CSN1"], "only healthy crews qualify");
  const ineligibleLabels = event.ineligible.map((c) => c.label).sort();
  assertEqual(ineligibleLabels, ["WWW1", "XXX1", "YYY1", "ZZZ1"], "dns/dsq/abs/withdrawn crews ineligible");
  assertTrue(
    !event.standings.some((c) => c.label === "HHH1") &&
      !event.ineligible.some((c) => c.label === "HHH1"),
    "hors_course crew excluded from ranking entirely",
  );
});

// 9. Final journey and "Final B" phase races never feed qualification.
scenario("final journey and final-phase races are excluded from points", () => {
  const A = slot("ASL", { crewNumber: 1, crew: ["ath-a"] });
  const B = slot("EPT", { crewNumber: 1, crew: ["ath-b"] });

  const races = [
    makeRace({ journeyIndex: 1, lanes: [
      lane(3, A, { finishPosition: 1, elapsedMs: 600 }),
      lane(4, B, { finishPosition: 2, elapsedMs: 610 }),
    ]}),
    makeRace({ journeyIndex: 2, lanes: [
      lane(3, B, { finishPosition: 1, elapsedMs: 600 }),
      lane(4, A, { finishPosition: 2, elapsedMs: 610 }),
    ]}),
    makeRace({ journeyIndex: 2, phase: "Final B", lanes: [
      lane(3, B, { finishPosition: 1, elapsedMs: 590 }),
      lane(4, A, { finishPosition: 2, elapsedMs: 600 }),
    ]}),
    makeRace({ journeyIndex: 3, phase: "Heat 1", lanes: [
      lane(3, A, { finishPosition: 1, elapsedMs: 580 }),
      lane(4, B, { finishPosition: 2, elapsedMs: 590 }),
    ]}),
  ];

  // Derivation: no explicit final journey -> highest journey (3) is the final.
  const derived = computeFinalQualification(races);
  assertEqual(derived[0].finalJourneyIndex, 3, "final journey derived as highest journey");
  const event = derived[0];
  const byLabel = Object.fromEntries(event.standings.map((c) => [c.label, c]));
  assertEqual(byLabel.ASL1.totalPoints, 32, "ASL1 = heats only (20 + 12), final not counted");
  assertEqual(byLabel.EPT1.totalPoints, 32, "EPT1 = heats only (12 + 20), Final B not counted");
  assertEqual(event.finalJourneyIndex, 3, "final journey = highest journey");
  assertEqual(
    event.excludedRaces.map((r) => r.reason),
    ["final_phase", "final_journey"],
    "Final B (phase) and Final A (journey) excluded",
  );

  // Explicit override: only journey 1 counts.
  const overridden = qualify(races, { finalJourneyIndex: 2 });
  const byLabelOverridden = Object.fromEntries(overridden.standings.map((c) => [c.label, c]));
  assertEqual(byLabelOverridden.ASL1.totalPoints, 20, "override: journey 1 only");
  assertEqual(byLabelOverridden.EPT1.totalPoints, 12, "override: journey 1 only");
});

// 10. Fewer than 6 crews entered -> all qualify.
scenario("fewer than 6 crews entered: everyone qualifies", () => {
  const A = slot("ASL", { crewNumber: 1, crew: ["ath-a"] });
  const B = slot("EPT", { crewNumber: 1, crew: ["ath-b"] });
  const C = slot("CSN", { crewNumber: 1, crew: ["ath-c"] });

  const races = [
    makeRace({ journeyIndex: 1, lanes: [
      lane(3, A, { finishPosition: 1, elapsedMs: 600 }),
      lane(4, B, { finishPosition: 2, elapsedMs: 610 }),
      lane(2, C, { finishPosition: 3, elapsedMs: 620 }),
    ]}),
    makeRace({ journeyIndex: 2, lanes: [
      lane(3, C, { finishPosition: 1, elapsedMs: 600 }),
      lane(4, A, { finishPosition: 2, elapsedMs: 610 }),
      lane(2, B, { finishPosition: 3, elapsedMs: 620 }),
    ]}),
  ];

  const event = qualify(races);
  assertEqual(event.totalQualified, 3, "all three crews qualify");
  assertEqual(labels(event), ["ASL1", "CSN1", "EPT1"], "ordered by points (32, 28, 16)");
  assertEqual(lanes(event), [3, 4, 2], "chevron lanes for 3 boats");
  assertEqual(event.backfilling, false, "no backfill needed");
});

// 11. Lane assignment follows the international seeding chevron by rank.
scenario("lanes follow the chevron pattern with seed = qualification rank", () => {
  assertEqual(QUALIFYING_LANE_PATTERN, [3, 4, 2, 5, 1, 6, 7, 8], "chevron pattern");
  // Reuse the 7-boat scenario data shape with clearly separated points.
  const crews = ["A", "B", "C", "D", "E", "F", "G"].map((code) =>
    slot(code, { crewNumber: 1, crew: [`ath-${code.toLowerCase()}`] }),
  );
  const races = [1, 2].map((journeyIndex) =>
    makeRace({
      journeyIndex,
      lanes: crews.map((s, i) =>
        lane(i + 1, s, {
          finishPosition: i + 1,
          elapsedMs: 600 + 10 * (i + 1) + (journeyIndex - 1) * 100,
        }),
      ),
    }),
  );
  const event = qualify(races, { topN: 7 });
  assertEqual(labels(event), ["A1", "B1", "C1", "D1", "E1", "F1", "G1"], "points order preserved");
  assertEqual(lanes(event), [3, 4, 2, 5, 1, 6, 7], "rank 1 -> lane 3, rank 2 -> lane 4, rank 3 -> lane 2...");
  event.qualified.forEach((crew, index) => {
    assertEqual(crew.seed, index + 1, `seed = qualification rank for ${crew.label}`);
  });
});

// 12. Time-only races: finish positions derived from elapsedMs.
scenario("time-only race: positions derived from elapsed time", () => {
  const A = slot("ASL", { crewNumber: 1, crew: ["ath-a"] });
  const B = slot("EPT", { crewNumber: 1, crew: ["ath-b"] });
  const C = slot("CSN", { crewNumber: 1, crew: ["ath-c"] });

  const races = [
    makeRace({ journeyIndex: 1, lanes: [
      lane(3, B, { elapsedMs: 610 }), // no finishPosition entered
      lane(4, A, { elapsedMs: 600 }),
      lane(2, C, { elapsedMs: 620 }),
    ]}),
  ];

  const { standings } = computeQualificationStandings(races);
  const byLabel = Object.fromEntries(standings.map((c) => [c.label, c]));
  assertEqual(byLabel.ASL1.totalPoints, 20, "fastest time -> 1st place points");
  assertEqual(byLabel.EPT1.totalPoints, 12, "second time -> 2nd place points");
  assertEqual(byLabel.CSN1.totalPoints, 8, "third time -> 3rd place points");
});

// 13. Regression (real-data bug, 2026 Championships U17M1x): unlabeled heats
// on J1 and J3, final on J3, final journey = 5 from the isFinalDay stage.
// Journeys consolidate their heats BY TIME: Herichi wins his J3 heat (20 pts)
// but was only 3rd-fastest of J1 (8 pts) — Seddik totals 32 and ranks first.
scenario("unlabeled heats count from every journey before the final journey", () => {
  const seddik = { _id: "ath-seddik", firstName: "Fares", lastName: "Seddik" };
  const herichi = { _id: "ath-herichi", firstName: "Zakaria", lastName: "Herichi" };
  const bentkayat = { _id: "ath-bentkayat", firstName: "Karem", lastName: "Ben Tkayat" };
  const singles = (clubCode, athlete) => ({
    club: club(`club-${clubCode.toLowerCase()}`, clubCode),
    crew: [athlete],
  });

  const races = [
    makeRace({ journeyIndex: 1, phase: "", name: "CM 1", lanes: [
      lane(3, singles("CNMT", seddik), { finishPosition: 1, elapsedMs: 502790 }),
      lane(4, singles("CTASAD", bentkayat), { finishPosition: 2, elapsedMs: 527800 }),
    ]}),
    makeRace({ journeyIndex: 1, phase: "", name: "CM 2", lanes: [
      lane(3, singles("ASL", herichi), { finishPosition: 1, elapsedMs: 531970 }),
    ]}),
    makeRace({ journeyIndex: 3, phase: "", name: "CM 1", lanes: [
      lane(3, singles("ASL", herichi), { finishPosition: 1, elapsedMs: 496680 }),
      lane(4, singles("CNMT", seddik), { finishPosition: 2, elapsedMs: 497530 }),
      lane(2, singles("CTASAD", bentkayat), { finishPosition: 3, elapsedMs: 526120 }),
    ]}),
    makeRace({ journeyIndex: 3, phase: "Final A", name: "Final", lanes: [
      lane(3, singles("ASL", herichi), { finishPosition: 1, elapsedMs: 480000 }),
    ]}),
    makeRace({ journeyIndex: 5, phase: "Final A", name: "Final A", lanes: [
      lane(3, singles("CNMT", seddik), { finishPosition: 1, elapsedMs: 480000 }),
    ]}),
  ];

  // finalJourneyIndex comes from the stage flagged isFinalDay (order 5).
  const event = qualify(races, { finalJourneyIndex: 5 });
  const seddikRow = event.standings.find((c) => c.crewKey === `A:${seddik._id}`);
  assertTrue(Boolean(seddikRow), "Seddik must have a standing row");
  assertEqual(seddikRow.totalPoints, 32, "Seddik = J1 fastest (20) + J3 second (12)");
  assertEqual(seddikRow.rank, 1, "Seddik ranks first with 32 points");
  assertEqual(seddikRow.label, "Fares Seddik", "singles show the athlete name");
  const herichiRow = event.standings.find((c) => c.crewKey === `A:${herichi._id}`);
  assertEqual(herichiRow.totalPoints, 28, "Herichi = J1 3rd-fastest (8) + J3 fastest (20)");
  assertEqual(
    event.excludedRaces.map((r) => `${r.journeyIndex}:${r.reason}`),
    ["3:final_phase", "5:final_phase"],
    "only the Final A races are excluded, the J3 heat counts",
  );
  assertEqual(labels(event)[0], "Fares Seddik", "Seddik qualifies first");
});

// 14. Singles: the same athlete rows for different club entries across
// journeys -> ONE standing, points accumulated (athlete identity).
scenario("singles key on the athlete even when the stored club differs", () => {
  const athleteId = "ath-one";
  const races = [
    makeRace({ journeyIndex: 1, lanes: [
      lane(3, { club: club("club-a", "CLUBA"), crew: [athleteId] }, { finishPosition: 1, elapsedMs: 600 }),
      lane(4, { club: club("club-b", "CLUBB"), crew: ["ath-other"] }, { finishPosition: 2, elapsedMs: 610 }),
    ]}),
    makeRace({ journeyIndex: 2, lanes: [
      lane(3, { club: club("club-c", "CLUBC"), crew: [athleteId] }, { finishPosition: 2, elapsedMs: 620 }),
      lane(4, { club: club("club-b", "CLUBB"), crew: ["ath-other"] }, { finishPosition: 1, elapsedMs: 605 }),
    ]}),
  ];

  const event = qualify(races);
  const athleteRows = event.standings.filter((c) => c.crewKey === `A:${athleteId}`);
  assertEqual(athleteRows.length, 1, "one row for the athlete despite different clubs");
  assertEqual(athleteRows[0].totalPoints, 32, "20 (J1 1st) + 12 (J2 2nd)");
  assertEqual(event.totalCrews, 2, "two crews total, not three");
});

// === Summary ===============================================================

console.log("=".repeat(80));
if (failures.length) {
  console.log(`RESULT: ${scenarioNumber - failures.length}/${scenarioNumber} scenarios passed, ${failures.length} FAILED`);
  process.exitCode = 1;
} else {
  console.log(`RESULT: all ${scenarioNumber} scenarios passed`);
}

// === Live mode (optional) ==================================================

if (process.argv[2]) {
  await runLiveMode(process.argv[2]);
}

async function runLiveMode(competitionId) {
  dotenv.config({ path: "../.env" });
  if (!process.env.URL_DB) {
    console.log("\nLIVE MODE SKIPPED: URL_DB is not set (backend/.env)");
    return;
  }

  const { default: Competition } = await import("../Models/competitionModel.js");
  const { default: CompetitionRace } = await import("../Models/competitionRaceModel.js");

  await mongoose.connect(process.env.URL_DB);
  console.log("\n" + "=".repeat(80));
  console.log(`LIVE MODE — competition ${competitionId}`);
  console.log("=".repeat(80));

  try {
    const competition = await Competition.findById(competitionId).lean();
    if (!competition) {
      console.log("Competition not found.");
      process.exitCode = 1;
      return;
    }

    const finalStage = (competition.stages || []).find((stage) => stage?.isFinalDay);
    const finalJourneyIndex = finalStage ? Number(finalStage.order) : undefined;
    if (!finalJourneyIndex) {
      console.log(
        "NOTE: no stage flagged isFinalDay — the highest journey is treated as the final journey.",
      );
    }

    const races = await CompetitionRace.find({
      competition: competition._id,
      status: "completed",
    })
      .populate("category", "abbreviation titles")
      .populate("boatClass", "code names")
      .populate("lanes.club", "name code")
      .lean();

    if (!races.length) {
      console.log("No completed races for this competition.");
      return;
    }

    const events = computeFinalQualification(races, {
      topN: DEFAULT_QUALIFY_TOP_N,
      finalJourneyIndex,
    });

    for (const event of events) {
      const title = [event.categoryLabel, event.boatClassLabel]
        .filter(Boolean)
        .join(" ");
      console.log(`\nEvent ${title || event.eventKey}`);
      console.log(
        `  final journey: J${event.finalJourneyIndex} | crews: ${event.totalCrews} | ` +
          `qualified: ${event.totalQualified}/${event.topN}` +
          (event.backfilling ? ` (backfill, ${event.pointQualifiedCount} scored)` : "") +
          (event.exceedsLaneLimit ? " | EXCEEDS 8-LANE LIMIT" : ""),
      );
      for (const crew of event.qualified) {
        const journeySummary = crew.appearances
          .map((a) => `J${a.journeyIndex}:${a.status}${a.points ? `+${a.points}` : ""}`)
          .join(", ");
        console.log(
          `  #${crew.seed} lane ${crew.lane ?? "?"}  ${(crew.label || crew.crewKey).padEnd(12)} ` +
            `${String(crew.totalPoints).padStart(3)} pts  [${journeySummary}]  via ${crew.qualifiedVia}`,
        );
      }
    }
  } finally {
    await mongoose.disconnect();
  }
}
