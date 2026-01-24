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
 * @param {object} options - Runtime options
 * @param {boolean} options.includeMasters - Whether to include masters categories (default: from system or true)
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
    entityType: "club",
    boatClassFilter: "all",
    includeMastersDefault: true,
    maxScoringPosition: 8,
    dnfGetsPointsIfFewFinishers: true,
    effectivePointTable: DEFAULT_POINT_TABLE,
  };

  // Runtime options override defaults
  const includeMasters =
    options.includeMasters !== undefined
      ? options.includeMasters
      : config.includeMastersDefault !== false;

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

  // Filter by allowed boat classes if specified in ranking system
  if (config.allowedBoatClasses?.length > 0) {
    const allowedIds = config.allowedBoatClasses.map((bc) => bc.toString());
    filteredRaces = filteredRaces.filter((r) =>
      allowedIds.includes(
        r.boatClass?._id?.toString() || r.boatClass?.toString()
      )
    );
  }

  // Filter by boat class filter (skiff_only)
  if (config.boatClassFilter === "skiff_only") {
    filteredRaces = filteredRaces.filter((r) => {
      const crewSize = r.boatClass?.crewSize || 1;
      return crewSize === 1;
    });
  }

  // Filter out masters categories if not included
  if (!includeMasters) {
    filteredRaces = filteredRaces.filter((r) => {
      const catAbbr = r.category?.abbreviation?.toUpperCase() || "";
      // Masters categories typically have "MAS" or "VET" in abbreviation
      return !catAbbr.includes("MAS") && !catAbbr.includes("VET");
    });
  }

  // Group races based on configuration
  const groups = groupRaces(filteredRaces, config.groupBy);

  // Calculate ranking for each group and collect metadata
  const rankings = {};
  const groupMetadata = {};

  for (const [groupKey, groupData] of Object.entries(groups)) {
    rankings[groupKey] = calculateGroupRanking(groupData, config);
    // Store metadata for each group (includes full category info)
    groupMetadata[groupKey] = {
      gender: groupData.metadata?.gender,
      categoryAbbr: groupData.metadata?.category?.abbreviation,
      categoryNames: groupData.metadata?.category?.titles,
    };
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
          scoringMode: rankingSystem.scoringMode,
        }
      : null,
    groupBy: config.groupBy,
    entityType: config.entityType || "club",
    scoringMode: config.scoringMode || "points",
    rankings,
    groupMetadata,
    // Include stage/journey info for display
    stages: (competition.stages || []).map((s, idx) => ({
      index: idx,
      name: s.name,
      date: s.date,
    })),
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
 * @returns {Array} Ranked entries (clubs or athletes based on entityType)
 */
function calculateGroupRanking(group, config) {
  const { races } = group;
  const entityType = config.entityType || "club";

  // Map to track points - key depends on entityType
  const pointsMap = new Map();

  for (const race of races) {
    const raceContext = analyzeRaceContext(race);
    const boatClass = race.boatClass;

    for (const lane of race.lanes || []) {
      const pointResult = calculateLanePoints(
        lane.result || {},
        raceContext,
        config
      );

      const clubId = lane.club?._id?.toString() || lane.club?.toString();
      if (!clubId) continue;

      // Get all athletes in this entry (single athlete or crew)
      const athletes =
        lane.crew?.length > 0 ? lane.crew : lane.athlete ? [lane.athlete] : [];

      const raceResult = {
        raceId: race._id,
        raceNumber: race.raceNumber,
        journeyIndex: race.journeyIndex,
        boatClass: boatClass?.code,
        boatClassName: boatClass?.names?.en || boatClass?.code,
        category: race.category?.abbreviation,
        position: pointResult.effectivePosition,
        points: pointResult.points,
        time: lane.result?.elapsedMs,
        status: lane.result?.status,
        appliedDnfRule: pointResult.appliedDnfRule,
      };

      if (entityType === "athlete") {
        // ATHLETE RANKING: Each athlete gets points individually
        // Only makes sense for skiff races (which should be filtered beforehand)
        for (const athlete of athletes) {
          const athleteId = athlete?._id?.toString() || athlete?.toString();
          if (!athleteId) continue;

          if (!pointsMap.has(athleteId)) {
            pointsMap.set(athleteId, {
              entityId: athleteId,
              entityType: "athlete",
              entity: {
                _id: athlete._id,
                firstName: athlete.firstName,
                lastName: athlete.lastName,
                fullName:
                  athlete.fullName ||
                  `${athlete.firstName || ""} ${athlete.lastName || ""}`.trim(),
                licenseNumber: athlete.licenseNumber,
              },
              club: lane.club,
              clubId: clubId,
              totalPoints: 0,
              raceResults: [],
              positionCounts: {},
              journeyPoints: {}, // Points per journey (journeyIndex -> points)
              totalTime: 0,
              statusCounts: { dns: 0, dnf: 0, dsq: 0, abs: 0 },
            });
          }

          const entry = pointsMap.get(athleteId);
          entry.totalPoints += pointResult.points;
          entry.totalTime += lane.result?.elapsedMs || 0;
          entry.raceResults.push({ ...raceResult });

          // Track points per journey
          const journeyIdx = race.journeyIndex ?? 0;
          entry.journeyPoints[journeyIdx] =
            (entry.journeyPoints[journeyIdx] || 0) + pointResult.points;

          if (pointResult.effectivePosition) {
            entry.positionCounts[pointResult.effectivePosition] =
              (entry.positionCounts[pointResult.effectivePosition] || 0) + 1;
          }

          const status = lane.result?.status;
          if (status && entry.statusCounts[status] !== undefined) {
            entry.statusCounts[status]++;
          }
        }
      } else {
        // CLUB RANKING: Club collects all points from their athletes
        if (!pointsMap.has(clubId)) {
          pointsMap.set(clubId, {
            entityId: clubId,
            entityType: "club",
            entity: lane.club,
            totalPoints: 0,
            raceResults: [],
            positionCounts: {},
            totalTime: 0,
            statusCounts: { dns: 0, dnf: 0, dsq: 0, abs: 0 },
          });
        }

        const entry = pointsMap.get(clubId);
        entry.totalPoints += pointResult.points;
        entry.totalTime += lane.result?.elapsedMs || 0;
        entry.raceResults.push({
          ...raceResult,
          athletes: athletes.map((a) => ({
            _id: a._id,
            firstName: a.firstName,
            lastName: a.lastName,
            fullName:
              a.fullName || `${a.firstName || ""} ${a.lastName || ""}`.trim(),
          })),
        });

        if (pointResult.effectivePosition) {
          entry.positionCounts[pointResult.effectivePosition] =
            (entry.positionCounts[pointResult.effectivePosition] || 0) + 1;
        }

        const status = lane.result?.status;
        if (status && entry.statusCounts[status] !== undefined) {
          entry.statusCounts[status]++;
        }
      }
    }
  }

  // Sort and rank
  let rankings = Array.from(pointsMap.values());
  rankings = sortAndAssignRanks(rankings, config);

  return rankings;
}

/**
 * Sort entries and assign ranks
 */
function sortAndAssignRanks(entries, config) {
  const scoringMode = config.scoringMode || "points";

  // Sort based on scoring mode
  entries.sort((a, b) => {
    if (scoringMode === "medals") {
      // MEDAL MODE: Sort like Olympic medal table
      // 1. Most golds (1st places)
      const goldDiff = (b.positionCounts[1] || 0) - (a.positionCounts[1] || 0);
      if (goldDiff !== 0) return goldDiff;

      // 2. Most silvers (2nd places)
      const silverDiff =
        (b.positionCounts[2] || 0) - (a.positionCounts[2] || 0);
      if (silverDiff !== 0) return silverDiff;

      // 3. Most bronzes (3rd places)
      const bronzeDiff =
        (b.positionCounts[3] || 0) - (a.positionCounts[3] || 0);
      if (bronzeDiff !== 0) return bronzeDiff;

      // 4. Total time (ascending - faster is better)
      if (a.totalTime !== b.totalTime) {
        return a.totalTime - b.totalTime;
      }

      return 0;
    } else {
      // POINTS MODE: Sort by total points (descending)
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
    }
  });

  // Assign ranking positions
  let currentRank = 1;
  entries.forEach((entry, index) => {
    // Add medal counts for display (regardless of scoring mode)
    entry.medals = {
      gold: entry.positionCounts[1] || 0,
      silver: entry.positionCounts[2] || 0,
      bronze: entry.positionCounts[3] || 0,
      total:
        (entry.positionCounts[1] || 0) +
        (entry.positionCounts[2] || 0) +
        (entry.positionCounts[3] || 0),
    };

    if (index > 0) {
      const prev = entries[index - 1];

      // Check if tied based on scoring mode
      let isTied = false;
      if (scoringMode === "medals") {
        isTied =
          entry.medals.gold === prev.medals.gold &&
          entry.medals.silver === prev.medals.silver &&
          entry.medals.bronze === prev.medals.bronze;
      } else {
        isTied = entry.totalPoints === prev.totalPoints;
      }

      if (isTied) {
        entry.rank = prev.rank;
      } else {
        entry.rank = currentRank;
      }
    } else {
      entry.rank = 1;
    }
    currentRank++;
  });

  // Also add the scoringMode to help frontend display
  entries.scoringMode = scoringMode;

  return entries;
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
 * @param {object} options - Runtime options (includeMasters, etc.)
 * @returns {object} Simplified ranking for display
 */
export async function getRankingSummary(
  competitionId,
  rankingSystemId = null,
  options = {}
) {
  const fullRanking = await buildCompetitionRanking(
    competitionId,
    rankingSystemId,
    options
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
      entity: entry.entity,
      club: entry.club, // For athlete rankings - their club
      clubId: entry.clubId,
      totalPoints: entry.totalPoints,
      raceResults: entry.raceResults,
      positionCounts: entry.positionCounts,
      raceCount: entry.raceResults?.length || 0,
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
