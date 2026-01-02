/**
 * Ranking Service
 *
 * Calculates rankings and points for competitions based on configurable ranking systems.
 *
 * Key Features:
 * - Point calculation based on finish position
 * - DNF special rules (gets points only if <8 crews finished)
 * - Combines multiple races in same category by total time
 * - Groups rankings by gender, category, or category+gender
 * - Supports skiff (athlete points) vs crew (club points) modes
 * - Configurable tie-breakers
 */

import mongoose from "mongoose";
import CompetitionRace from "../Models/competitionRaceModel.js";
import Competition from "../Models/competitionModel.js";
import Category from "../Models/categoryModel.js";
import BoatClass from "../Models/boatClassModel.js";
import RankingSystem, {
  DEFAULT_POINT_TABLE,
} from "../Models/rankingSystemModel.js";

/**
 * Get points for a finish position using the ranking system's point table
 * @param {number} position - Finish position (1-based)
 * @param {object} rankingSystem - The ranking system configuration
 * @returns {number} Points for this position
 */
export function getPointsForPosition(position, rankingSystem = null) {
  if (!position || position < 1) return 0;

  const pointTable = rankingSystem?.effectivePointTable || DEFAULT_POINT_TABLE;
  return pointTable[position] || 0;
}

/**
 * Calculate points for a single race result, applying DNF special rules
 *
 * Rules:
 * - OK: Gets points based on finishPosition
 * - DNS/DSQ/ABS: 0 points
 * - DNF: Gets points ONLY if fewer than maxScoringPosition (usually 8) crews finished
 *        In that case, shares position after last finisher
 *
 * @param {object} laneResult - Lane result with status, finishPosition, elapsedMs
 * @param {object} raceContext - Context about the race (totalFinishers, lastFinisherPosition)
 * @param {object} rankingSystem - The ranking system configuration
 * @returns {object} { points, effectivePosition, appliedDnfRule }
 */
export function calculateLanePoints(
  laneResult,
  raceContext,
  rankingSystem = null
) {
  const maxScoring = rankingSystem?.maxScoringPosition || 8;
  const dnfGetsPoints = rankingSystem?.dnfGetsPointsIfFewFinishers !== false;

  const result = {
    points: 0,
    effectivePosition: null,
    appliedDnfRule: false,
    status: laneResult.status,
  };

  switch (laneResult.status) {
    case "ok":
      result.effectivePosition = laneResult.finishPosition;
      result.points = getPointsForPosition(
        laneResult.finishPosition,
        rankingSystem
      );
      break;

    case "dnf":
      // DNF special rule: gets points if fewer than maxScoring crews finished
      if (dnfGetsPoints && raceContext.totalOkFinishers < maxScoring) {
        // DNF gets position after last finisher
        result.effectivePosition = raceContext.lastFinisherPosition + 1;
        result.points = getPointsForPosition(
          result.effectivePosition,
          rankingSystem
        );
        result.appliedDnfRule = true;
      }
      break;

    case "dns":
    case "dsq":
    case "abs":
    default:
      // No points for DNS, DSQ, ABS
      result.points = 0;
      break;
  }

  return result;
}

/**
 * Analyze a race to get context needed for point calculation
 * @param {object} race - Race document with lanes populated
 * @returns {object} Race context
 */
export function analyzeRaceContext(race) {
  let totalOkFinishers = 0;
  let lastFinisherPosition = 0;
  let dnfCount = 0;

  for (const lane of race.lanes || []) {
    if (lane.result?.status === "ok" && lane.result?.finishPosition) {
      totalOkFinishers++;
      lastFinisherPosition = Math.max(
        lastFinisherPosition,
        lane.result.finishPosition
      );
    } else if (lane.result?.status === "dnf") {
      dnfCount++;
    }
  }

  return {
    totalOkFinishers,
    lastFinisherPosition,
    dnfCount,
    totalParticipants: (race.lanes || []).length,
  };
}

/**
 * Calculate combined time ranking for races in the same category
 * Used when multiple races (e.g., heats) need to be combined by total time
 *
 * @param {Array} races - Array of race documents in the same category
 * @returns {Array} Sorted entries with combined times and positions
 */
export function calculateCombinedTimeRanking(races) {
  // Map to track total time per club/crew
  const crewTimes = new Map(); // key: `${clubId}_${categoryId}_${boatClassId}`

  for (const race of races) {
    for (const lane of race.lanes || []) {
      if (lane.result?.status === "ok" && lane.result?.elapsedMs) {
        const key = `${lane.club}_${race.category}_${race.boatClass}`;

        if (!crewTimes.has(key)) {
          crewTimes.set(key, {
            clubId: lane.club,
            categoryId: race.category,
            boatClassId: race.boatClass,
            totalTime: 0,
            raceCount: 0,
            times: [],
            positions: [],
          });
        }

        const entry = crewTimes.get(key);
        entry.totalTime += lane.result.elapsedMs;
        entry.raceCount++;
        entry.times.push(lane.result.elapsedMs);
        entry.positions.push(lane.result.finishPosition);
      }
    }
  }

  // Sort by total time
  const sorted = Array.from(crewTimes.values()).sort(
    (a, b) => a.totalTime - b.totalTime
  );

  // Assign combined positions
  sorted.forEach((entry, index) => {
    entry.combinedPosition = index + 1;
  });

  return sorted;
}

/**
 * Build competition ranking based on a ranking system configuration
 *
 * @param {string} competitionId - Competition ID
 * @param {string} rankingSystemId - Ranking system ID (or null for default)
 * @param {object} options - Additional options
 * @returns {object} Ranking results grouped as configured
 */
export async function buildCompetitionRanking(
  competitionId,
  rankingSystemId = null,
  options = {}
) {
  // Load competition with stages
  const competition = await Competition.findById(competitionId)
    .populate("allowedCategories")
    .populate("allowedBoatClasses");

  if (!competition) {
    throw new Error("Competition not found");
  }

  // Load ranking system (or use default)
  let rankingSystem = null;
  if (rankingSystemId) {
    rankingSystem = await RankingSystem.findById(rankingSystemId);
  }

  // Default configuration if no ranking system specified
  const config = rankingSystem || {
    groupBy: "category_gender",
    journeyMode: "all",
    pointMode: "mixed",
    maxScoringPosition: 8,
    dnfGetsPointsIfFewFinishers: true,
    effectivePointTable: DEFAULT_POINT_TABLE,
  };

  // Load all completed races for this competition
  const races = await CompetitionRace.find({
    competition: competitionId,
    status: "completed",
  })
    .populate("category")
    .populate("boatClass")
    .populate("lanes.club")
    .populate("lanes.athlete")
    .populate("lanes.crew");

  // Filter by journey mode
  let filteredRaces = races;
  if (config.journeyMode === "final_only") {
    // Get final stage index
    const finalStageIndex = competition.stages?.findIndex((s) => s.isFinalDay);
    if (finalStageIndex >= 0) {
      filteredRaces = races.filter((r) => r.journeyIndex === finalStageIndex);
    }
  }

  // Filter by allowed boat classes if specified
  if (config.allowedBoatClasses?.length > 0) {
    const allowedIds = config.allowedBoatClasses.map((bc) => bc.toString());
    filteredRaces = filteredRaces.filter((r) =>
      allowedIds.includes(
        r.boatClass?._id?.toString() || r.boatClass?.toString()
      )
    );
  }

  // Group races based on configuration
  const groups = groupRaces(filteredRaces, config.groupBy);

  // Calculate ranking for each group
  const rankings = {};

  for (const [groupKey, groupRaces] of Object.entries(groups)) {
    rankings[groupKey] = calculateGroupRanking(groupRaces, config);
  }

  return {
    competition: {
      _id: competition._id,
      code: competition.code,
      names: competition.names,
    },
    rankingSystem: rankingSystem
      ? {
          _id: rankingSystem._id,
          code: rankingSystem.code,
          names: rankingSystem.names,
        }
      : null,
    groupBy: config.groupBy,
    rankings,
    generatedAt: new Date(),
  };
}

/**
 * Group races based on groupBy configuration
 * @param {Array} races - Race documents
 * @param {string} groupBy - Grouping method
 * @returns {object} Grouped races
 */
function groupRaces(races, groupBy) {
  const groups = {};

  for (const race of races) {
    let groupKey;

    switch (groupBy) {
      case "gender":
        // Group by category gender (Men's Cup, Women's Cup)
        groupKey = race.category?.gender || "unknown";
        break;

      case "category":
        // Group by category abbreviation (Senior, Junior, etc.)
        groupKey =
          race.category?.abbreviation ||
          race.category?._id?.toString() ||
          "unknown";
        break;

      case "category_gender":
      default:
        // Group by category + gender combination
        const cat = race.category?.abbreviation || "?";
        const gen = race.category?.gender || "?";
        groupKey = `${cat}_${gen}`;
        break;
    }

    if (!groups[groupKey]) {
      groups[groupKey] = {
        races: [],
        metadata: {
          gender: race.category?.gender,
          category: race.category,
          groupKey,
        },
      };
    }

    groups[groupKey].races.push(race);
  }

  return groups;
}

/**
 * Calculate ranking for a group of races
 * @param {object} group - Group with races and metadata
 * @param {object} config - Ranking system configuration
 * @returns {Array} Ranked entries
 */
function calculateGroupRanking(group, config) {
  const { races } = group;

  // Aggregate points by entity (athlete for skiff, club for crew)
  const pointsMap = new Map(); // key: entityId, value: ranking entry

  for (const race of races) {
    const raceContext = analyzeRaceContext(race);
    const boatClass = race.boatClass;
    const isSkiff = boatClass?.crewSize === 1;

    // Determine point mode for this race
    let useAthletePoints;
    if (config.pointMode === "skiff_athlete") {
      useAthletePoints = true;
    } else if (config.pointMode === "crew_club") {
      useAthletePoints = false;
    } else {
      // Mixed mode: skiff → athlete, crew → club
      useAthletePoints = isSkiff;
    }

    for (const lane of race.lanes || []) {
      const pointResult = calculateLanePoints(
        lane.result || {},
        raceContext,
        config
      );

      // Get athlete from either single athlete field or crew array
      const athleteEntity = lane.athlete || lane.crew?.[0];

      // Determine the entity to attribute points to
      const entityId = useAthletePoints
        ? athleteEntity?._id?.toString() || athleteEntity?.toString()
        : lane.club?._id?.toString() || lane.club?.toString();

      if (!entityId) continue;

      if (!pointsMap.has(entityId)) {
        pointsMap.set(entityId, {
          entityId,
          entityType: useAthletePoints ? "athlete" : "club",
          entity: useAthletePoints ? athleteEntity : lane.club,
          totalPoints: 0,
          raceResults: [],
          positionCounts: {}, // For tie-breaking: { 1: 2, 2: 1 } = two 1st places, one 2nd place
          totalTime: 0,
          // Track non-scoring statuses for display
          statusCounts: { dns: 0, dnf: 0, dsq: 0, abs: 0 },
        });
      }

      const entry = pointsMap.get(entityId);
      entry.totalPoints += pointResult.points;
      entry.totalTime += lane.result?.elapsedMs || 0;
      entry.raceResults.push({
        raceId: race._id,
        raceNumber: race.raceNumber,
        boatClass: boatClass?.code,
        category: race.category?.abbreviation,
        position: pointResult.effectivePosition,
        points: pointResult.points,
        time: lane.result?.elapsedMs,
        status: lane.result?.status,
        appliedDnfRule: pointResult.appliedDnfRule,
      });

      // Track position counts for tie-breaking
      if (pointResult.effectivePosition) {
        entry.positionCounts[pointResult.effectivePosition] =
          (entry.positionCounts[pointResult.effectivePosition] || 0) + 1;
      }

      // Track non-scoring statuses (DNS, DNF, DSQ, ABS)
      const status = lane.result?.status;
      if (
        status &&
        entry.statusCounts &&
        entry.statusCounts[status] !== undefined
      ) {
        entry.statusCounts[status]++;
      }
    }
  }

  // Convert to array and sort
  let rankings = Array.from(pointsMap.values());

  // Sort by total points (descending), then apply tie-breakers
  rankings.sort((a, b) => {
    // Primary: total points (descending)
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }

    // Tie-breakers
    const tieBreakers = config.tieBreakers || [
      { method: "more_first_places" },
      { method: "more_second_places" },
      { method: "total_time" },
    ];

    for (const tb of tieBreakers) {
      const result = applyTieBreaker(a, b, tb.method);
      if (result !== 0) return result;
    }

    return 0;
  });

  // Assign ranking positions
  let currentRank = 1;
  rankings.forEach((entry, index) => {
    if (index > 0) {
      const prev = rankings[index - 1];
      // Same rank if same points (simplified - could also check tie-breaker equality)
      if (entry.totalPoints === prev.totalPoints) {
        entry.rank = prev.rank;
      } else {
        entry.rank = currentRank;
      }
    } else {
      entry.rank = 1;
    }
    currentRank++;
  });

  return rankings;
}

/**
 * Apply a tie-breaker comparison
 * @returns {number} -1 if a wins, 1 if b wins, 0 if still tied
 */
function applyTieBreaker(a, b, method) {
  switch (method) {
    case "more_first_places":
      return (b.positionCounts[1] || 0) - (a.positionCounts[1] || 0);

    case "more_second_places":
      return (b.positionCounts[2] || 0) - (a.positionCounts[2] || 0);

    case "total_time":
      // Lower time wins (ascending)
      return (a.totalTime || Infinity) - (b.totalTime || Infinity);

    case "best_time":
      const aBest = Math.min(...a.raceResults.map((r) => r.time || Infinity));
      const bBest = Math.min(...b.raceResults.map((r) => r.time || Infinity));
      return aBest - bBest;

    case "alphabetical":
      const aName = a.entity?.name || a.entity?.firstName || "";
      const bName = b.entity?.name || b.entity?.firstName || "";
      return aName.localeCompare(bName);

    default:
      return 0;
  }
}

/**
 * Get ranking summary for display (simplified view)
 * @param {string} competitionId - Competition ID
 * @param {string} rankingSystemId - Ranking system ID
 * @returns {object} Simplified ranking for display
 */
export async function getRankingSummary(competitionId, rankingSystemId = null) {
  const fullRanking = await buildCompetitionRanking(
    competitionId,
    rankingSystemId
  );

  // Simplify for display
  const summary = {
    ...fullRanking,
    rankings: {},
  };

  for (const [groupKey, entries] of Object.entries(fullRanking.rankings)) {
    summary.rankings[groupKey] = entries.map((entry) => ({
      rank: entry.rank,
      entityType: entry.entityType,
      entityId: entry.entityId,
      entityName:
        entry.entity?.name ||
        `${entry.entity?.firstName || ""} ${
          entry.entity?.lastName || ""
        }`.trim() ||
        "Unknown",
      totalPoints: entry.totalPoints,
      raceCount: entry.raceResults.length,
      firstPlaces: entry.positionCounts[1] || 0,
      secondPlaces: entry.positionCounts[2] || 0,
      thirdPlaces: entry.positionCounts[3] || 0,
      // Include status counts for DNS/DNF/DSQ/ABS display
      dnsCount: entry.statusCounts?.dns || 0,
      dnfCount: entry.statusCounts?.dnf || 0,
      dsqCount: entry.statusCounts?.dsq || 0,
      absCount: entry.statusCounts?.abs || 0,
    }));
  }

  return summary;
}

export default {
  getPointsForPosition,
  calculateLanePoints,
  analyzeRaceContext,
  calculateCombinedTimeRanking,
  buildCompetitionRanking,
  getRankingSummary,
};
