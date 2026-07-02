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
import CompetitionPenalty from "../Models/competitionPenaltyModel.js";

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
  rankingSystem = null,
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
        rankingSystem,
      );
      break;

    case "dnf":
      // DNF gets points for the position AFTER the last "ok" finisher
      // Rule: DNF rank = lastFinisherPosition + 1
      // Note: If no one finished (lastFinisherPosition is 0), DNF gets rank 1
      // but user usually wants points only if someone finished.
      // However, the requested rule is simply "position after last completed".

      if (dnfGetsPoints) {
        result.effectivePosition = (raceContext.lastFinisherPosition || 0) + 1;
        result.points = getPointsForPosition(
          result.effectivePosition,
          rankingSystem,
        );
        result.appliedDnfRule = true;
      }
      break;

    case "dns":
    case "dsq":
    case "abs":
    case "hors_course":
    default:
      // No points for DNS, DSQ, ABS, or Hors Course
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
    // Hors-course athletes are invisible to race context
    if (lane.result?.status === "hors_course") continue;

    if (lane.result?.status === "ok" && lane.result?.finishPosition) {
      totalOkFinishers++;
      lastFinisherPosition = Math.max(
        lastFinisherPosition,
        lane.result.finishPosition,
      );
    } else if (lane.result?.status === "dnf") {
      dnfCount++;
    }
  }

  // Exclude hors_course lanes from total participant count
  const hcCount = (race.lanes || []).filter(
    (l) => l.result?.status === "hors_course",
  ).length;

  return {
    totalOkFinishers,
    lastFinisherPosition,
    dnfCount,
    totalParticipants: (race.lanes || []).length - hcCount,
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
    (a, b) => a.totalTime - b.totalTime,
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
  options = {},
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
  const includePenalties = options.includePenalties === true;

  // Load all completed races for this competition
  const races = await CompetitionRace.find({
    competition: competitionId,
    status: "completed",
  })
    .populate("category")
    .populate("boatClass")
    .populate("lanes.club")
    .populate("lanes.athlete")
    .populate("lanes.crew")
    .lean(); // Use lean() so populated subdocuments serialize to plain objects cleanly

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
        r.boatClass?._id?.toString() || r.boatClass?.toString(),
      ),
    );
  }

  // Filter by boat class filter
  if (config.boatClassFilter === "skiff_only") {
    filteredRaces = filteredRaces.filter((r) => {
      const crewSize = r.boatClass?.crewSize || 1;
      return crewSize === 1;
    });
  } else if (config.boatClassFilter === "crew_only") {
    // Only multi-person boats (2x, 4x, 8+, etc.) — singles are excluded because
    // points/medals go to the individual athlete, not the crew slot.
    filteredRaces = filteredRaces.filter((r) => {
      const crewSize = r.boatClass?.crewSize || 1;
      return crewSize > 1;
    });
  }

  // Filter out masters categories if not included
  if (!includeMasters) {
    filteredRaces = filteredRaces.filter((r) => {
      const abbreviation = r.category?.abbreviation?.toUpperCase() || "";
      const enTitle = r.category?.titles?.en?.toUpperCase() || "";
      const frTitle = r.category?.titles?.fr?.toUpperCase() || "";

      // Check for common patterns:
      // 1. MinAge >= 27 (Standard Masters age)
      // 2. "MAS" or "VET" in abbreviation
      // 3. "MASTER" or "VETERAN" in titles
      const isMaster =
        r.category?.minAge >= 27 ||
        abbreviation.includes("MAS") ||
        abbreviation.includes("VET") ||
        enTitle.includes("MASTER") ||
        frTitle.includes("MASTER") ||
        enTitle.includes("VETERAN") ||
        frTitle.includes("VETERAN");

      return !isMaster;
    });
  }

  // For category-based rankings, merge PARA races into equivalent non-PARA
  // age/gender categories (ranking-only behavior; does not alter category data).
  const needsParaCategoryNormalization =
    (config.groupBy === "category" || config.groupBy === "category_gender") &&
    filteredRaces.some((race) => Boolean(race?.category?.isPara));

  let groupingCategories = [];
  if (needsParaCategoryNormalization) {
    const categoryTypes = [
      ...new Set(
        filteredRaces.map((race) => race?.category?.type).filter(Boolean),
      ),
    ];

    const categoryFilter = {
      isActive: true,
      isPara: { $ne: true },
    };
    if (categoryTypes.length > 0) {
      categoryFilter.type = { $in: categoryTypes };
    }

    groupingCategories = await Category.find(categoryFilter)
      .select("_id type abbreviation gender minAge maxAge titles isPara")
      .lean();
  }

  // Group races based on configuration
  const groups = groupRaces(filteredRaces, config.groupBy, groupingCategories);

  let penaltiesByCategoryClub = new Map();
  if (includePenalties) {
    const penalties = await CompetitionPenalty.find({
      competition: competitionId,
      isActive: true,
    })
      .select("club category journeyIndex penaltyPoints")
      .lean();

    penaltiesByCategoryClub = penalties.reduce((acc, penalty) => {
      const categoryId = penalty?.category?.toString?.();
      const clubId = penalty?.club?.toString?.();
      const journeyIndex = penalty?.journeyIndex;
      const points = Number(penalty?.penaltyPoints);
      if (!categoryId || !clubId || !Number.isFinite(points) || points <= 0) {
        return acc;
      }
      const key = `${categoryId}::${clubId}::${
        Number.isFinite(Number(journeyIndex)) && Number(journeyIndex) > 0
          ? `J${Number(journeyIndex)}`
          : "ALL"
      }`;
      acc.set(key, (acc.get(key) || 0) + points);
      return acc;
    }, new Map());
  }

  // Calculate ranking for each group and collect metadata
  const rankings = {};
  const groupMetadata = {};

  for (const [groupKey, groupData] of Object.entries(groups)) {
    const calculated = calculateGroupRanking(groupData, config);

    if (
      includePenalties &&
      config.entityType === "club" &&
      (config.scoringMode || "points") === "points"
    ) {
      const categoryId =
        groupData?.metadata?.category?._id?.toString?.() ||
        groupData?.metadata?.category?.toString?.() ||
        null;

      calculated.forEach((entry) => {
        entry.basePoints = Number(entry.totalPoints || 0);

        if (!categoryId) {
          entry.penaltyPoints = 0;
          return;
        }

        const journeyKeys = new Set(
          (entry.raceResults || [])
            .map((raceResult) => Number(raceResult?.journeyIndex) || 1)
            .filter((journey) => Number.isFinite(journey) && journey > 0),
        );

        let penaltyPoints = Number(
          penaltiesByCategoryClub.get(
            `${categoryId}::${entry.entityId}::ALL`,
          ) || 0,
        );

        for (const journey of journeyKeys) {
          penaltyPoints += Number(
            penaltiesByCategoryClub.get(
              `${categoryId}::${entry.entityId}::J${journey}`,
            ) || 0,
          );
        }

        entry.penaltyPoints = penaltyPoints;
        entry.totalPoints = entry.basePoints - penaltyPoints;
      });

      rankings[groupKey] = sortAndAssignRanks(calculated, config);
    } else {
      calculated.forEach((entry) => {
        entry.basePoints = Number(entry.totalPoints || 0);
        entry.penaltyPoints = 0;
      });
      rankings[groupKey] = calculated;
    }

    // Store metadata for each group (includes full category info)
    groupMetadata[groupKey] = {
      gender: groupData.metadata?.gender,
      categoryAbbr: groupData.metadata?.category?.abbreviation,
      categoryNames: groupData.metadata?.category?.titles,
      categoryId:
        groupData.metadata?.category?._id?.toString?.() ||
        groupData.metadata?.category?.toString?.() ||
        null,
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
    includePenalties,
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
function isSecondaryAdultCategory(category) {
  const abbr = (category?.abbreviation || "").toLowerCase();
  const titleEn = (category?.titles?.en || "").toLowerCase();

  if (
    abbr === "bm" ||
    abbr === "bw" ||
    abbr === "bmix" ||
    titleEn.includes("under 23") ||
    titleEn.includes("u23")
  ) {
    return true;
  }

  if (
    titleEn.includes("master") ||
    abbr.includes("27") ||
    abbr.includes("35") ||
    abbr.includes("43") ||
    abbr.includes("50")
  ) {
    return true;
  }

  return false;
}

function isSeniorCategory(category) {
  const abbr = (category?.abbreviation || "").toLowerCase();
  const titleEn = (category?.titles?.en || "").toLowerCase();

  return (
    abbr === "m" ||
    abbr === "w" ||
    abbr === "sm" ||
    abbr === "sw" ||
    abbr === "smix" ||
    // Lightweight Senior categories (LWM, LWW, LW2x, LW4x...) are a weight class
    // of Senior, so they rank together with Seniors.
    abbr.startsWith("lw") ||
    (titleEn.includes("senior") && !titleEn.includes("master")) ||
    (titleEn.includes("lightweight") && !titleEn.includes("master"))
  );
}

function pickMostSpecificCategory(categories) {
  if (!Array.isArray(categories) || categories.length === 0) {
    return null;
  }

  let bestMatch = null;

  for (const category of categories) {
    const minAge = Number.isFinite(category?.minAge)
      ? category.minAge
      : -Infinity;
    const maxAge = Number.isFinite(category?.maxAge)
      ? category.maxAge
      : Infinity;

    if (!bestMatch) {
      bestMatch = category;
      continue;
    }

    const bestMin = Number.isFinite(bestMatch?.minAge)
      ? bestMatch.minAge
      : -Infinity;
    const bestMax = Number.isFinite(bestMatch?.maxAge)
      ? bestMatch.maxAge
      : Infinity;

    if (minAge > bestMin) {
      bestMatch = category;
      continue;
    }

    if (minAge === bestMin && maxAge > bestMax) {
      bestMatch = category;
      continue;
    }

    if (minAge === bestMin && maxAge === bestMax) {
      const currentLabel = (
        category?.abbreviation ||
        category?.titles?.en ||
        ""
      ).toString();
      const bestLabel = (
        bestMatch?.abbreviation ||
        bestMatch?.titles?.en ||
        ""
      ).toString();

      if (currentLabel.localeCompare(bestLabel) < 0) {
        bestMatch = category;
      }
    }
  }

  return bestMatch;
}

function pickEquivalentNonParaCategory(categories, ageProbe) {
  if (!Array.isArray(categories) || categories.length === 0) {
    return null;
  }

  const matching = categories.filter((category) => {
    const minAge = Number.isFinite(category?.minAge)
      ? category.minAge
      : -Infinity;
    const maxAge = Number.isFinite(category?.maxAge)
      ? category.maxAge
      : Infinity;
    return ageProbe >= minAge && ageProbe <= maxAge;
  });

  if (matching.length === 0) {
    return null;
  }

  if (ageProbe >= 19) {
    const primarySenior = matching.find(
      (category) =>
        isSeniorCategory(category) && !isSecondaryAdultCategory(category),
    );
    if (primarySenior) {
      return primarySenior;
    }

    const primaryCategories = matching.filter(
      (category) => !isSecondaryAdultCategory(category),
    );
    if (primaryCategories.length > 0) {
      return pickMostSpecificCategory(primaryCategories);
    }
  }

  return pickMostSpecificCategory(matching);
}

function buildNonParaCategoryLookup(categories = []) {
  const lookup = new Map();

  for (const category of categories) {
    if (!category || category.isPara) {
      continue;
    }

    const type = category.type || "national";
    const gender = category.gender || "mixed";
    const key = `${type}::${gender}`;

    if (!lookup.has(key)) {
      lookup.set(key, []);
    }
    lookup.get(key).push(category);
  }

  return lookup;
}

function resolveGroupingCategoryForRace(category, nonParaCategoryLookup) {
  if (!category || !category.isPara) {
    return category;
  }

  const categoryType = category.type || "national";
  const categoryGender = category.gender || "mixed";
  const lookupKey = `${categoryType}::${categoryGender}`;
  const candidates = nonParaCategoryLookup.get(lookupKey) || [];

  if (candidates.length === 0) {
    return category;
  }

  const ageProbe = Number.isFinite(category.minAge)
    ? category.minAge
    : Number.isFinite(category.maxAge)
      ? category.maxAge
      : null;

  if (ageProbe === null) {
    return category;
  }

  return pickEquivalentNonParaCategory(candidates, ageProbe) || category;
}

function groupRaces(races, groupBy, groupingCategories = []) {
  const groups = {};
  const nonParaCategoryLookup = buildNonParaCategoryLookup(groupingCategories);

  for (const race of races) {
    const groupingCategory = resolveGroupingCategoryForRace(
      race.category,
      nonParaCategoryLookup,
    );

    let groupKey;

    switch (groupBy) {
      case "gender":
        // Group by category gender (Men's Cup, Women's Cup)
        groupKey =
          groupingCategory?.gender || race.category?.gender || "unknown";
        break;

      case "category": {
        // Group by category abbreviation — normalize LW to Senior so
        // Lightweight races count within the Senior group.
        const rawAbbr =
          groupingCategory?.abbreviation || race.category?.abbreviation;
        const catForGroup = groupingCategory || race.category;
        if (
          rawAbbr &&
          rawAbbr.toLowerCase().startsWith("lw") &&
          isSeniorCategory(catForGroup)
        ) {
          // Find the actual non-LW Senior category in the competition's category list
          // so we use the federation's real abbreviation (SM, M, Senior, etc.)
          const seniorAbbr =
            groupingCategories.find(
              (c) =>
                isSeniorCategory(c) &&
                !c.abbreviation?.toLowerCase().startsWith("lw"),
            )?.abbreviation || "Senior";
          groupKey = seniorAbbr;
        } else {
          groupKey =
            rawAbbr ||
            groupingCategory?._id?.toString() ||
            race.category?._id?.toString() ||
            "unknown";
        }
        break;
      }

      case "global":
        // All categories and genders combined
        groupKey = "all";
        break;

      case "category_gender":
      default: {
        // Group by category + gender combination.
        // Normalize LW categories into their Senior gender group so Lightweight
        // races count within Senior Men / Senior Women rather than a separate group.
        const rawCat =
          groupingCategory?.abbreviation || race.category?.abbreviation || "?";
        const gen =
          groupingCategory?.gender || race.category?.gender || "?";
        const catGroupObj = groupingCategory || race.category;
        let cat = rawCat;
        if (
          rawCat.toLowerCase().startsWith("lw") &&
          isSeniorCategory(catGroupObj)
        ) {
          // Find the actual non-LW Senior category in the competition's category
          // list for this gender, using the federation's real abbreviation.
          const seniorMatch = groupingCategories.find(
            (c) =>
              isSeniorCategory(c) &&
              !c.abbreviation?.toLowerCase().startsWith("lw") &&
              (c.gender === gen || c.gender === "mixed" || !c.gender),
          );
          cat =
            seniorMatch?.abbreviation ||
            (gen === "men" ? "SM" : gen === "women" ? "SW" : "SMIX");
        }
        groupKey = `${cat}_${gen}`;
        break;
      }
    }

    if (!groups[groupKey]) {
      groups[groupKey] = {
        races: [],
        metadata: {
          gender: groupingCategory?.gender || race.category?.gender,
          category: groupingCategory || race.category,
          groupKey,
        },
      };
    }

    groups[groupKey].races.push(race);
  }

  return groups;
}

function getEffectiveEventGroupKey(race) {
  if (race?.eventGroupId && typeof race.eventGroupId === "string") {
    return race.eventGroupId;
  }

  const categoryId =
    race?.category?._id?.toString?.() ||
    race?.category?.toString?.() ||
    "unknown";
  const boatClassId =
    race?.boatClass?._id?.toString?.() ||
    race?.boatClass?.toString?.() ||
    "open";
  const journeyPart = Number(race?.journeyIndex) || 1;
  return `${categoryId}::${boatClassId}::J${journeyPart}`;
}

function getLaneCompetitorKeys(lane, race, entityType) {
  if (entityType === "athlete") {
    const athletes =
      lane?.crew?.length > 0 ? lane.crew : lane?.athlete ? [lane.athlete] : [];

    return athletes
      .map((athlete) => {
        const athleteId = athlete?._id?.toString?.() || athlete?.toString?.();
        if (!athleteId) {
          return null;
        }
        return {
          key: `athlete:${athleteId}`,
          entityId: athleteId,
        };
      })
      .filter(Boolean);
  }

  if (entityType === "nation") {
    // Use the lane's representingNation, falling back to athlete data
    let nationCode = lane?.representingNation;
    if (!nationCode) {
      const athlete = lane?.athlete || lane?.crew?.[0];
      nationCode =
        athlete?.nationalityCode || athlete?.representingNation || null;
    }
    if (!nationCode) {
      return [];
    }
    // Single key per nation per lane (not per crew member)
    return [{ key: `nation:${nationCode}`, nationCode }];
  }

  const clubId = lane?.club?._id?.toString?.() || lane?.club?.toString?.();
  if (!clubId) {
    return [];
  }

  const crewIds = (lane?.crew || [])
    .map((athlete) => athlete?._id?.toString?.() || athlete?.toString?.())
    .filter(Boolean)
    .sort();

  if (crewIds.length > 0) {
    // For crew boats: key on the crew SLOT (crewNumber) rather than the exact
    // athlete set, so points accumulate to the same crew identity across journeys
    // even when individual rowers rotate (e.g. a substitute in a later journey).
    const crewNumber = lane?.crewNumber;
    if (crewNumber != null && Number.isInteger(Number(crewNumber))) {
      const catId =
        race?.category?._id?.toString?.() ||
        race?.category?.toString?.() ||
        "nocat";
      const boatClassId =
        race?.boatClass?._id?.toString?.() ||
        race?.boatClass?.toString?.() ||
        "noboat";
      return [
        {
          key: `club:${clubId}:cat:${catId}:boat:${boatClassId}:slot:${Number(crewNumber)}`,
          clubId,
          crewNumber: Number(crewNumber),
        },
      ];
    }
    // Fallback (no crewNumber stored): use athlete set (legacy/singles without crewNumber)
    return [
      {
        key: `club:${clubId}:crew:${crewIds.join("+")}`,
        clubId,
      },
    ];
  }

  const athleteId =
    lane?.athlete?._id?.toString?.() || lane?.athlete?.toString?.();
  if (athleteId) {
    return [
      {
        key: `club:${clubId}:athlete:${athleteId}`,
        clubId,
      },
    ];
  }

  return [
    {
      key: `club:${clubId}:fallback:${race?._id?.toString?.() || "race"}:${lane?.lane || 0}`,
      clubId,
    },
  ];
}

function resolveBetterMergedCandidate(current, candidate) {
  if (!current) return candidate;

  const currentTimed =
    current.status === "ok" && Number.isFinite(current.elapsedMs);
  const candidateTimed =
    candidate.status === "ok" && Number.isFinite(candidate.elapsedMs);

  if (candidateTimed && !currentTimed) return candidate;
  if (candidateTimed && currentTimed) {
    return candidate.elapsedMs < current.elapsedMs ? candidate : current;
  }

  const currentPos = Number.isInteger(current.finishPosition)
    ? current.finishPosition
    : Number.MAX_SAFE_INTEGER;
  const candidatePos = Number.isInteger(candidate.finishPosition)
    ? candidate.finishPosition
    : Number.MAX_SAFE_INTEGER;
  if (candidatePos < currentPos) return candidate;

  const statusPriority = {
    ok: 1,
    dnf: 2,
    dns: 3,
    abs: 4,
    dsq: 5,
    hors_course: 6,
  };
  const currentStatus = statusPriority[current.status] || 99;
  const candidateStatus = statusPriority[candidate.status] || 99;
  if (candidateStatus < currentStatus) return candidate;

  return current;
}

function buildMergedEventCandidates(races, entityType) {
  const candidateMap = new Map();

  for (const race of races) {
    for (const lane of race.lanes || []) {
      // Hors-course athletes are excluded from ranking pipeline
      const laneStatus = (lane.result?.status || "ok").toLowerCase();
      if (laneStatus === "hors_course") continue;

      const competitorKeys = getLaneCompetitorKeys(lane, race, entityType);
      if (!competitorKeys.length) continue;

      const result = lane.result || {};
      const status = result.status || "ok";

      const candidate = {
        sourceRace: race,
        lane,
        status,
        elapsedMs:
          Number.isFinite(result.elapsedMs) && result.elapsedMs >= 0
            ? Number(result.elapsedMs)
            : undefined,
        finishPosition: Number.isInteger(result.finishPosition)
          ? result.finishPosition
          : undefined,
      };

      for (const competitor of competitorKeys) {
        const existing = candidateMap.get(competitor.key);
        candidateMap.set(
          competitor.key,
          resolveBetterMergedCandidate(existing, {
            ...candidate,
            // Preserve entity identifiers for downstream aggregation
            entityId: competitor.entityId,
            clubId: competitor.clubId,
            nationCode: competitor.nationCode,
          }),
        );
      }
    }
  }

  return Array.from(candidateMap.values());
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

  const racesByEvent = new Map();
  for (const race of races) {
    const eventKey = getEffectiveEventGroupKey(race);
    if (!racesByEvent.has(eventKey)) {
      racesByEvent.set(eventKey, []);
    }
    racesByEvent.get(eventKey).push(race);
  }

  for (const eventRaces of racesByEvent.values()) {
    const mergedCandidates = buildMergedEventCandidates(eventRaces, entityType);
    const timedFinishers = mergedCandidates
      .filter((c) => c.status === "ok" && Number.isFinite(c.elapsedMs))
      .sort((a, b) => a.elapsedMs - b.elapsedMs);

    timedFinishers.forEach((candidate, index) => {
      candidate.effectivePosition = index + 1;
      candidate.points = getPointsForPosition(
        candidate.effectivePosition,
        config,
      );
      candidate.appliedDnfRule = false;
    });

    const lastFinisherPosition = timedFinishers.length;

    for (const candidate of mergedCandidates) {
      if (candidate.points === undefined) {
        if (candidate.status === "ok") {
          candidate.effectivePosition = candidate.finishPosition || null;
          candidate.points = getPointsForPosition(
            candidate.effectivePosition,
            config,
          );
          candidate.appliedDnfRule = false;
        } else if (candidate.status === "dnf") {
          // DNF always scores after the last normal finisher for the merged event.
          // Ignore stored finishPosition to avoid accidental high-point scoring.
          candidate.effectivePosition = lastFinisherPosition + 1;
          candidate.points = getPointsForPosition(
            candidate.effectivePosition,
            config,
          );
          candidate.appliedDnfRule = true;
        } else {
          candidate.effectivePosition = null;
          candidate.points = 0;
          candidate.appliedDnfRule = false;
        }
      }

      const race = candidate.sourceRace;
      const lane = candidate.lane;
      const boatClass = race.boatClass;
      const clubId = lane?.club?._id?.toString() || lane?.club?.toString();
      const athletes =
        lane?.crew?.length > 0
          ? lane.crew
          : lane?.athlete
            ? [lane.athlete]
            : [];

      const raceResult = {
        raceId: race._id,
        raceNumber: race.raceNumber,
        journeyIndex: race.journeyIndex,
        boatClass: boatClass?.code,
        boatClassName: boatClass?.names?.en || boatClass?.code,
        category: race.category?.abbreviation,
        position: candidate.effectivePosition,
        points: candidate.points,
        time: candidate.elapsedMs,
        status: candidate.status,
        appliedDnfRule: candidate.appliedDnfRule,
      };

      if (entityType === "athlete") {
        const athlete =
          lane?.athlete ||
          lane?.crew?.find((a) => {
            const athleteId = a?._id?.toString() || a?.toString();
            return athleteId === candidate.entityId;
          });

        if (!athlete || !candidate.entityId) {
          continue;
        }

        if (!pointsMap.has(candidate.entityId)) {
          pointsMap.set(candidate.entityId, {
            entityId: candidate.entityId,
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
            journeyPoints: {},
            totalTime: 0,
            statusCounts: { dns: 0, dnf: 0, dsq: 0, abs: 0 },
          });
        }

        const entry = pointsMap.get(candidate.entityId);
        entry.totalPoints += candidate.points;
        entry.totalTime += candidate.elapsedMs || 0;
        entry.raceResults.push({ ...raceResult });

        const journeyIdx = race.journeyIndex ?? 0;
        entry.journeyPoints[journeyIdx] =
          (entry.journeyPoints[journeyIdx] || 0) + candidate.points;

        if (candidate.effectivePosition) {
          entry.positionCounts[candidate.effectivePosition] =
            (entry.positionCounts[candidate.effectivePosition] || 0) + 1;
        }

        const status = candidate.status;
        if (status && entry.statusCounts[status] !== undefined) {
          entry.statusCounts[status]++;
        }
      } else if (entityType === "nation") {
        const nationCode = candidate.nationCode;
        if (!nationCode) {
          continue;
        }

        if (!pointsMap.has(nationCode)) {
          pointsMap.set(nationCode, {
            entityId: nationCode,
            entityType: "nation",
            entity: { code: nationCode, name: nationCode },
            nationCode: nationCode,
            totalPoints: 0,
            raceResults: [],
            positionCounts: {},
            totalTime: 0,
            statusCounts: { dns: 0, dnf: 0, dsq: 0, abs: 0 },
          });
        }

        const entry = pointsMap.get(nationCode);
        entry.totalPoints += candidate.points;
        entry.totalTime += candidate.elapsedMs || 0;
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

        if (candidate.effectivePosition) {
          entry.positionCounts[candidate.effectivePosition] =
            (entry.positionCounts[candidate.effectivePosition] || 0) + 1;
        }

        const status = candidate.status;
        if (status && entry.statusCounts[status] !== undefined) {
          entry.statusCounts[status]++;
        }
      } else if (entityType === "crew") {
        // Crew-slot ranking: points accumulate per (club + category + boatClass + crewNumber).
        // EPT 1 accumulates J1 + J3 points even when athletes rotate between journeys.
        const crewNumber = candidate.lane?.crewNumber ?? candidate.crewNumber;
        if (!clubId || crewNumber == null) {
          continue;
        }
        const catId =
          race?.category?._id?.toString?.() ||
          race?.category?.toString?.() ||
          "nocat";
        const boatClassId =
          race?.boatClass?._id?.toString?.() ||
          race?.boatClass?.toString?.() ||
          "noboat";
        const crewSlotId = `club:${clubId}:cat:${catId}:boat:${boatClassId}:slot:${Number(crewNumber)}`;

        if (!pointsMap.has(crewSlotId)) {
          pointsMap.set(crewSlotId, {
            entityId: crewSlotId,
            entityType: "crew",
            entity: {
              club: lane.club,
              crewNumber: Number(crewNumber),
              boatClass: race.boatClass,
              category: race.category,
              // `name` is what getEntityName reads for display (e.g. "EPT 1", "ASL 2")
              name: `${lane.club?.name || lane.club?.code || clubId} ${crewNumber}`,
              label: `${lane.club?.code || clubId} ${crewNumber}`,
            },
            club: lane.club,
            clubId,
            totalPoints: 0,
            raceResults: [],
            positionCounts: {},
            journeyPoints: {},
            totalTime: 0,
            statusCounts: { dns: 0, dnf: 0, dsq: 0, abs: 0 },
          });
        }

        const crewEntry = pointsMap.get(crewSlotId);
        crewEntry.totalPoints += candidate.points;
        crewEntry.totalTime += candidate.elapsedMs || 0;
        crewEntry.raceResults.push({
          ...raceResult,
          athletes: athletes.map((a) => ({
            _id: a._id,
            firstName: a.firstName,
            lastName: a.lastName,
            fullName:
              a.fullName || `${a.firstName || ""} ${a.lastName || ""}`.trim(),
          })),
        });
        const journeyIdx = race.journeyIndex ?? 0;
        crewEntry.journeyPoints[journeyIdx] =
          (crewEntry.journeyPoints[journeyIdx] || 0) + candidate.points;
        if (candidate.effectivePosition) {
          crewEntry.positionCounts[candidate.effectivePosition] =
            (crewEntry.positionCounts[candidate.effectivePosition] || 0) + 1;
        }
        const crewStatus = candidate.status;
        if (crewStatus && crewEntry.statusCounts[crewStatus] !== undefined) {
          crewEntry.statusCounts[crewStatus]++;
        }
      } else {
        if (!clubId) {
          continue;
        }

        if (!pointsMap.has(clubId)) {
          // Normalize club entity so it always has a top-level `name` field,
          // even when the Club model stores names in a nested `names: {en,fr,ar}` object.
          const clubDoc = lane.club;
          const clubEntity = clubDoc
            ? {
                _id: clubDoc._id,
                code: clubDoc.code,
                name:
                  clubDoc.name ||
                  clubDoc.names?.fr ||
                  clubDoc.names?.en ||
                  clubDoc.code ||
                  null,
                nameAr: clubDoc.nameAr || clubDoc.names?.ar || null,
              }
            : null;
          pointsMap.set(clubId, {
            entityId: clubId,
            entityType: "club",
            entity: clubEntity,
            totalPoints: 0,
            raceResults: [],
            positionCounts: {},
            totalTime: 0,
            statusCounts: { dns: 0, dnf: 0, dsq: 0, abs: 0 },
          });
        }

        const entry = pointsMap.get(clubId);
        entry.totalPoints += candidate.points;
        entry.totalTime += candidate.elapsedMs || 0;
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

        if (candidate.effectivePosition) {
          entry.positionCounts[candidate.effectivePosition] =
            (entry.positionCounts[candidate.effectivePosition] || 0) + 1;
        }

        const status = candidate.status;
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
  options = {},
) {
  const fullRanking = await buildCompetitionRanking(
    competitionId,
    rankingSystemId,
    options,
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
      basePoints: entry.basePoints,
      penaltyPoints: entry.penaltyPoints,
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
