/**
 * Qualification Service
 *
 * Identifies the crews qualified for the final journey of a competition.
 *
 * Rules implemented (per federation requirements):
 * 1. Points accumulated over the preliminary journeys decide qualification.
 *    Points go to the CREW SLOT (club + crewNumber, e.g. "ASL1", "EPT2";
 *    singles count as the ATHLETE), so athlete substitutions between
 *    journeys do not split a crew. Within a journey the event's races are
 *    CONSOLIDATED BY TIME — every crew is ranked by its best elapsedMs of
 *    that journey across its heats and the point table awards that rank —
 *    exactly how the ranking system and published official results count.
 * 2. A crew whose best status is DNF is only accepted when fewer than the
 *    required number of crews qualified — it backfills the empty slots
 *    (DNS / DSQ / ABS / withdrawn / hors_course crews never qualify).
 * 3. Ties on accumulated POINTS at the cut line are not broken: all tied
 *    crews qualify, so the final may be rowed with 7+ boats. Tie-breakers
 *    (first places, total time, ...) only decide the lane order.
 * 4. Qualified crews are assigned lanes with the World Rowing "chevron"
 *    pattern used by the international competition seeding (best rank ->
 *    lane 3, then 4, 2, 5, 1, 6, 7, 8); seed = qualification rank.
 *
 * The core functions are pure (no DB access) so they can be verified by
 * scripts/testFinalQualification.mjs without a database.
 */

import { DEFAULT_POINT_TABLE } from "../Models/rankingSystemModel.js";

// Same ordering as the race generator's LANE_PATTERN (international seeding):
// the best seed always gets lane 3, then 4, then 2, then 5, then 1, then 6...
export const QUALIFYING_LANE_PATTERN = [3, 4, 2, 5, 1, 6, 7, 8];
export const DEFAULT_QUALIFY_TOP_N = 6;

// "Final", "Final A" ... "Final Z" — but not "Semi-Final" or "Final B heat".
const FINAL_PHASE_REGEX = /^final(\s+[a-z])?$/i;

// Crews whose results are all in these statuses can never qualify.
const NON_QUALIFYING_STATUSES = new Set(["dns", "dsq", "abs", "withdrawn"]);

const normaliseStatus = (lane) =>
  String(lane?.result?.status || "ok").toLowerCase();

// Reporting order for a crew's single journey row (best status wins).
const STATUS_ORDER = {
  ok: 1,
  dnf: 2,
  dns: 3,
  abs: 4,
  withdrawn: 5,
  dsq: 6,
  hors_course: 7,
};

/**
 * True for races that are finals by phase label ("Final", "Final A/B/C...").
 * Finals never feed qualification, wherever they are scheduled.
 */
export function isFinalPhaseRace(race) {
  const phase = String(race?.phase || "").trim();
  return phase ? FINAL_PHASE_REGEX.test(phase) : false;
}

/**
 * Stable identity of the crew SLOT a lane represents.
 *
 * Points accumulate per slot across journeys (rule 1). Multi-athlete boats
 * key on the crew slot — club + crewNumber (e.g. ASL1 vs EPT2), falling back
 * to the exact crew members. Singles and unnamed entries key on the ATHLETE
 * alone (club-independent), matching the athlete ranking system.
 * Nation entries key on the nation code.
 */
export function getCrewSlotKey(lane) {
  const memberIds = (Array.isArray(lane?.crew) && lane.crew.length
    ? lane.crew
    : lane?.athlete
      ? [lane.athlete]
      : []
  )
    .map((member) => String(member?._id ?? member))
    .filter((id) => id && id !== "undefined" && id !== "null");
  if (!memberIds.length) return null;

  const crewNumber = Number(lane?.crewNumber);
  const hasCrewNumber = Number.isInteger(crewNumber) && crewNumber > 0;
  const nation = lane?.representingNation
    ? String(lane.representingNation).trim()
    : "";
  const isNationEntry =
    lane?.representingType === "nation" || (!lane?.club && Boolean(nation));
  const clubId = lane?.club ? String(lane.club?._id ?? lane.club) : null;

  if (isNationEntry) {
    if (hasCrewNumber) return `N:${nation}:slot:${crewNumber}`;
    if (memberIds.length > 1) return `N:${nation}:crew:${memberIds.join("+")}`;
    return `N:${nation}:athlete:${memberIds[0]}`;
  }
  if (hasCrewNumber && clubId) return `C:${clubId}:slot:${crewNumber}`;
  if (hasCrewNumber) return `S:${crewNumber}`;
  if (memberIds.length > 1) {
    return clubId
      ? `C:${clubId}:crew:${memberIds.join("+")}`
      : `A:${memberIds.join("+")}`;
  }
  // Single rower: the points belong to the athlete, whatever club is stored.
  return `A:${memberIds[0]}`;
}

/**
 * Short display label for a crew slot. Crew slots with a crewNumber render as
 * club code + number (e.g. "ASL1"); singles and unnamed slots render the
 * athlete's name, falling back to the club name. Returns null when nothing
 * readable is available (callers fall back to the crew key).
 */
export function getCrewLabel(lane) {
  const crewNumber = Number(lane?.crewNumber);
  const hasCrewNumber =
    Number.isInteger(crewNumber) && crewNumber > 0;
  const nation = lane?.representingNation
    ? String(lane.representingNation).trim()
    : "";
  const isNationEntry =
    lane?.representingType === "nation" || (!lane?.club && Boolean(nation));

  if (isNationEntry && nation) {
    return hasCrewNumber ? `${nation}${crewNumber}` : nation;
  }

  const club = lane?.club && typeof lane.club === "object" ? lane.club : null;
  const clubLabel = club
    ? String(club.code || club.name || "").trim()
    : lane?.club
      ? ""
      : "";

  if (hasCrewNumber && clubLabel) return `${clubLabel}${crewNumber}`;

  // Singles / unnamed slots: the athlete's own name reads best. The rower
  // may sit in `athlete` or as the first member of `crew` (populated docs).
  const athleteDoc =
    lane?.athlete && typeof lane.athlete === "object" ? lane.athlete : null;
  const firstMember =
    Array.isArray(lane?.crew) && lane.crew[0] && typeof lane.crew[0] === "object"
      ? lane.crew[0]
      : null;
  const athlete = athleteDoc || firstMember;
  const athleteName = athlete
    ? [athlete.firstName, athlete.lastName].filter(Boolean).join(" ").trim()
    : "";
  if (athleteName) return athleteName;

  return clubLabel || null;
}

// Identity fields of the crew slot as entered on one lane.
function readCrewIdentity(lane) {
  // Singles may carry the member only in `athlete` (generator convention),
  // multi-athlete boats in `crew` — normalise to a member id list.
  const memberIds = (Array.isArray(lane?.crew) && lane.crew.length
    ? lane.crew
    : lane?.athlete
      ? [lane.athlete]
      : []
  ).map((member) => String(member?._id ?? member));
  return {
    label: getCrewLabel(lane),
    club: lane?.club ? String(lane.club?._id ?? lane.club) : null,
    clubCode:
      lane?.club && typeof lane.club === "object"
        ? String(lane.club.code || lane.club.name || "").trim() || null
        : null,
    crewNumber:
      Number.isInteger(Number(lane?.crewNumber)) && Number(lane?.crewNumber) > 0
        ? Number(lane.crewNumber)
        : null,
    crew: memberIds,
    representingNation: lane?.representingNation || null,
    representingType: lane?.representingType || null,
  };
}

/**
 * Aggregate the preliminary races of ONE event (same category + boatClass)
 * into per-crew-slot standings. Pure: `races` are plain race objects with
 * `lanes[].result` (as produced by .lean() queries or test fixtures).
 *
 * Points follow the ranking system's convention: within a journey, ALL races
 * of the event are consolidated by time — each crew is ranked by its best
 * elapsedMs of that journey across its heats, and the point table awards
 * that consolidated rank (a heat winner in a slow heat earns few points).
 * Crews without a time in a journey (DNF, DNS, DSQ, ABS, withdrawn, or ok
 * but untimed) score no points there; hors_course lanes are invisible.
 */
export function computeQualificationStandings(races, options = {}) {
  const pointTable = options.pointTable || DEFAULT_POINT_TABLE;
  const crews = new Map();
  let skippedFinalPhaseRaces = 0;

  // Points are decided per journey, so group the pool by journey first.
  const journeys = new Map();
  for (const race of races || []) {
    if (isFinalPhaseRace(race)) {
      skippedFinalPhaseRaces += 1;
      continue;
    }
    const journey = Number(race?.journeyIndex) || 1;
    if (!journeys.has(journey)) journeys.set(journey, []);
    journeys.get(journey).push(race);
  }

  for (const [journeyIndex, journeyRaces] of journeys) {
    // Pass 1: collect every crew's rides of this journey.
    const rides = new Map(); // crewKey -> ride records
    for (const race of journeyRaces) {
      const lanes = Array.isArray(race?.lanes) ? race.lanes : [];
      for (const lane of lanes) {
        const crewKey = getCrewSlotKey(lane);
        if (!crewKey) continue;
        const status = normaliseStatus(lane);
        // hors_course crews participate but are excluded from ranking.
        if (status === "hors_course") continue;

        let crewRides = rides.get(crewKey);
        if (!crewRides) {
          crewRides = [];
          rides.set(crewKey, crewRides);
        }
        crewRides.push({
          lane,
          status,
          raceName: race?.name ?? null,
          elapsedMs: Number.isFinite(lane.result?.elapsedMs)
            ? lane.result.elapsedMs
            : null,
          finishPosition:
            Number.isInteger(lane.result?.finishPosition) &&
            lane.result.finishPosition >= 1
              ? lane.result.finishPosition
              : null,
        });
      }
    }

    // Pass 2: consolidate the journey by time and award the point table.
    const journeyEntries = [...rides.entries()].map(([crewKey, crewRides]) => {
      const timed = crewRides.filter((ride) => ride.elapsedMs != null);
      const bestRide = timed.length
        ? timed.reduce((best, ride) =>
            ride.elapsedMs < best.elapsedMs ? ride : best,
          )
        : null;
      const bestStatus = crewRides.reduce(
        (best, ride) =>
          (STATUS_ORDER[ride.status] ?? 99) < (STATUS_ORDER[best] ?? 99)
            ? ride.status
            : best,
        "withdrawn",
      );
      return { crewKey, crewRides, bestTime: bestRide?.elapsedMs ?? null, bestRide, bestStatus };
    });

    const ranked = journeyEntries
      .filter((entry) => entry.bestTime != null)
      .sort(
        (a, b) =>
          a.bestTime - b.bestTime || a.crewKey.localeCompare(b.crewKey),
      );
    const rankByCrew = new Map();
    ranked.forEach((entry, index) => rankByCrew.set(entry.crewKey, index + 1));

    for (const entry of journeyEntries) {
      // Create/refresh the aggregate (latest line-up wins).
      let crew = crews.get(entry.crewKey);
      const identity = readCrewIdentity(
        entry.crewRides[entry.crewRides.length - 1].lane,
      );
      if (!crew) {
        crew = {
          crewKey: entry.crewKey,
          ...identity,
          totalPoints: 0,
          firstPlaces: 0,
          secondPlaces: 0,
          totalTimeMs: null,
          bestTimeMs: null,
          okCount: 0,
          dnfCount: 0,
          appearances: [],
        };
        crews.set(entry.crewKey, crew);
      } else {
        if (identity.label) crew.label = identity.label;
        crew.club = identity.club;
        crew.clubCode = identity.clubCode;
        crew.crewNumber = identity.crewNumber;
        crew.crew = identity.crew;
        crew.representingNation = identity.representingNation;
        crew.representingType = identity.representingType;
      }

      let rank = rankByCrew.get(entry.crewKey) ?? null;
      let points = 0;
      if (rank != null) {
        points = pointTable[rank] || 0;
        crew.totalPoints += points;
        if (rank === 1) crew.firstPlaces += 1;
        if (rank === 2) crew.secondPlaces += 1;
        crew.totalTimeMs = (crew.totalTimeMs ?? 0) + entry.bestTime;
        crew.bestTimeMs =
          crew.bestTimeMs == null
            ? entry.bestTime
            : Math.min(crew.bestTimeMs, entry.bestTime);
      }
      if (entry.bestStatus === "ok") {
        crew.okCount += 1;
      } else if (entry.bestStatus === "dnf") {
        crew.dnfCount += 1;
      }

      crew.appearances.push({
        journeyIndex,
        raceName: entry.bestRide
          ? entry.bestRide.raceName
          : (entry.crewRides[0]?.raceName ?? null),
        status: entry.bestStatus,
        finishPosition: entry.bestRide
          ? entry.bestRide.finishPosition
          : (entry.crewRides.find((ride) => ride.finishPosition != null)
              ?.finishPosition ?? null),
        elapsedMs: entry.bestTime,
        rank,
        points,
      });
    }
  }

  const allCrews = [...crews.values()];
  // Only crews that actually raced to a result (finished or DNF) can qualify;
  // the rest are listed with the reason for their exclusion.
  const standings = allCrews.filter((crew) => crew.okCount > 0 || crew.dnfCount > 0);
  const ineligible = allCrews
    .filter((crew) => crew.okCount === 0 && crew.dnfCount === 0)
    .map((crew) => ({
      ...crew,
      reason: "no_qualifying_result",
      statuses: [
        ...new Set(crew.appearances.map((appearance) => appearance.status)),
      ],
    }));

  sortStandings(standings);
  standings.forEach((crew, index) => {
    crew.rank = index + 1;
  });

  return { standings, ineligible, skippedFinalPhaseRaces };
}

// Full ranking chain: points desc -> more first places -> more second places
// -> total time asc -> alphabetical (deterministic last resort).
function compareCrews(a, b) {
  if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
  if (b.firstPlaces !== a.firstPlaces) return b.firstPlaces - a.firstPlaces;
  if (b.secondPlaces !== a.secondPlaces) return b.secondPlaces - a.secondPlaces;
  const timeA = a.totalTimeMs ?? Number.POSITIVE_INFINITY;
  const timeB = b.totalTimeMs ?? Number.POSITIVE_INFINITY;
  if (timeA !== timeB) return timeA - timeB;
  const labelA = a.label || a.crewKey;
  const labelB = b.label || b.crewKey;
  if (labelA !== labelB) return labelA < labelB ? -1 : 1;
  return a.crewKey < b.crewKey ? -1 : a.crewKey > b.crewKey ? 1 : 0;
}

function sortStandings(standings) {
  return standings.sort(compareCrews);
}

// True equality for the cut line: same accumulated POINTS. Tie-breakers
// (first places, total time, alphabetical) only order crews — they never
// keep an equal-points crew out of the final (rule 3).
function crewsTiedOnPoints(a, b) {
  return a.totalPoints === b.totalPoints;
}

/**
 * Apply the qualification cut to ranked standings.
 *
 * - The first `topN` crews qualify (they all have points when enough
 *   point-scoring crews exist, because the ranking is points-first).
 * - Backfill: when fewer than `topN` crews scored points, the remaining
 *   slots go to the best non-scoring crews (DNF-only after ok crews).
 * - Tie expansion: when the cut lands on real results, every crew with the
 *   same accumulated POINTS as the last qualified crew also qualifies
 *   (the final is then rowed with more than `topN` boats).
 *
 * Every qualified crew leaves with `seed` (qualification rank) and `lane`
 * from the chevron pattern, or `lane: null` beyond 8 boats.
 */
export function selectQualifiedCrews(standings, options = {}) {
  const topN = Number(options.topN) || DEFAULT_QUALIFY_TOP_N;
  const ranked = [...standings].sort(compareCrews);
  const cut = Math.min(Math.max(1, topN), ranked.length);

  const pointQualifiedCount = ranked.filter((crew) => crew.totalPoints > 0).length;
  const backfilling = pointQualifiedCount < cut;

  const qualified = ranked.slice(0, cut).map((crew) => ({
    ...crew,
    qualifiedVia: crew.totalPoints > 0 ? "points" : "backfill",
  }));

  // Rule 3: equal points at the cut line are not broken. Only applied when
  // the boundary crew has real points — equal "did not finish" crews are not
  // equal boats, so backfilled finals stay at `topN`.
  const expansion = [];
  if (!backfilling && ranked.length > cut) {
    let index = cut;
    while (index < ranked.length && crewsTiedOnPoints(qualified[qualified.length - 1], ranked[index])) {
      expansion.push({ ...ranked[index], qualifiedVia: "tie_expansion" });
      index += 1;
    }
  }

  const finalQualified = [...qualified, ...expansion];
  finalQualified.forEach((crew, index) => {
    crew.seed = index + 1;
    crew.lane =
      index < QUALIFYING_LANE_PATTERN.length ? QUALIFYING_LANE_PATTERN[index] : null;
  });

  return {
    qualified: finalQualified,
    exceedsLaneLimit: finalQualified.length > QUALIFYING_LANE_PATTERN.length,
    backfilling,
    pointQualifiedCount,
  };
}

/**
 * Full per-event qualification for a competition's completed races.
 *
 * Groups races by category + boatClass, determines the final journey
 * (options.finalJourneyIndex, else the highest journeyIndex present — the
 * same convention as rankingService's "final_only" mode), excludes the final
 * journey and final-phase races from the points pool, then computes
 * standings and the qualified (lane-assigned) crews per event.
 */
export function computeFinalQualification(races, options = {}) {
  const topN = Number(options.topN) || DEFAULT_QUALIFY_TOP_N;

  const groups = new Map();
  for (const race of races || []) {
    const categoryId = race?.category
      ? String(race.category?._id ?? race.category)
      : "unknown";
    const boatClassId = race?.boatClass
      ? String(race.boatClass?._id ?? race.boatClass)
      : "open";
    const key = `${categoryId}::${boatClassId}`;
    if (!groups.has(key)) {
      groups.set(key, { categoryId, boatClassId, races: [] });
    }
    groups.get(key).races.push(race);
  }

  const events = [];
  for (const group of groups.values()) {
    // Deterministic processing order (by journey, then race order) so that
    // "latest crew line-up" and appearance lists are stable.
    const orderedRaces = [...group.races].sort(
      (a, b) =>
        (Number(a?.journeyIndex) || 1) - (Number(b?.journeyIndex) || 1) ||
        (Number(a?.order) || 0) - (Number(b?.order) || 0),
    );
    const maxJourney = group.races.reduce(
      (max, race) => Math.max(max, Number(race?.journeyIndex) || 1),
      1,
    );
    const override = Number(options.finalJourneyIndex);
    const finalJourneyIndex =
      Number.isInteger(override) && override >= 1 ? override : maxJourney;

    const pool = [];
    const excludedRaces = [];
    for (const race of orderedRaces) {
      const journey = Number(race?.journeyIndex) || 1;
      // Finals never feed qualification — by phase label wherever they sit
      // (a final may share its journey with preliminary heats).
      if (isFinalPhaseRace(race)) {
        excludedRaces.push({
          raceId: race?._id ?? null,
          name: race?.name ?? null,
          journeyIndex: journey,
          phase: race?.phase ?? null,
          reason: "final_phase",
        });
        continue;
      }
      // Strict rule: points come from ALL journeys BEFORE the final journey.
      if (journey >= finalJourneyIndex) {
        excludedRaces.push({
          raceId: race?._id ?? null,
          name: race?.name ?? null,
          journeyIndex: journey,
          phase: race?.phase ?? null,
          reason: "final_journey",
        });
        continue;
      }
      pool.push(race);
    }

    const { standings, ineligible } = computeQualificationStandings(pool, options);
    const selection = selectQualifiedCrews(standings, { topN });

    const firstRace = group.races[0] || {};
    const category = firstRace.category && typeof firstRace.category === "object" ? firstRace.category : null;
    const boatClass = firstRace.boatClass && typeof firstRace.boatClass === "object" ? firstRace.boatClass : null;

    events.push({
      eventKey: `${group.categoryId}::${group.boatClassId}`,
      categoryId: group.categoryId,
      boatClassId: group.boatClassId,
      categoryLabel: category
        ? category.abbreviation || category.titles?.en || null
        : null,
      boatClassLabel: boatClass
        ? boatClass.code || boatClass.names?.en || null
        : null,
      finalJourneyIndex,
      topN,
      totalCrews: standings.length + ineligible.length,
      totalQualified: selection.qualified.length,
      pointQualifiedCount: selection.pointQualifiedCount,
      backfilling: selection.backfilling,
      exceedsLaneLimit: selection.exceedsLaneLimit,
      qualified: selection.qualified,
      standings,
      ineligible,
      excludedRaces,
    });
  }

  events.sort((a, b) => a.eventKey.localeCompare(b.eventKey));
  return events;
}
