import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Competition from "../Models/competitionModel.js";
import CompetitionRace, {
  LANE_RESULT_STATUSES,
  RACE_STATUSES,
} from "../Models/competitionRaceModel.js";
import Category from "../Models/categoryModel.js";
import BoatClass from "../Models/boatClassModel.js";
import Athlete from "../Models/athleteModel.js";
import CompetitionEntry from "../Models/competitionEntryModel.js";
import RankingSystem, {
  DEFAULT_POINT_TABLE,
} from "../Models/rankingSystemModel.js";
import OfficialResult from "../Models/officialResultModel.js";
import CompetitionPenalty from "../Models/competitionPenaltyModel.js";

// Lane limits per discipline
// Classic: 8 lanes (standard water lanes)
// Coastal: 20 lanes (larger fields in coastal rowing)
// Beach: 100 lanes (time trials can have many athletes running 1-2 at a time)
// Indoor: 100 lanes (ergometer competitions can have many participants)
const LANE_LIMITS = {
  classic: 8,
  coastal: 20,
  beach: 100,
  indoor: 100,
};

const getMaxLanesForDiscipline = (discipline) => {
  return LANE_LIMITS[discipline] || 8;
};

const MAX_LANES = 8; // Default for backward compatibility

const toObjectId = (value) => {
  if (!value) {
    return null;
  }
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }
  if (mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return null;
};

const toStringId = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (value instanceof mongoose.Types.ObjectId) {
    return value.toString();
  }
  if (typeof value === "object") {
    if (value._id) {
      return toStringId(value._id);
    }
    if (value.id) {
      return toStringId(value.id);
    }
    if (typeof value.toString === "function") {
      try {
        const converted = value.toString();
        return converted && converted !== "[object Object]" ? converted : null;
      } catch {
        return null;
      }
    }
  }
  return null;
};

const toSortedUniqueIds = (values) =>
  Array.from(new Set((values || []).filter(Boolean))).sort();

const buildAssignmentKey = ({
  categoryId,
  boatClassId,
  clubId,
  athleteId,
  crewIds,
}) => {
  const normalizedCrewIds = toSortedUniqueIds(crewIds);
  const participantKey = normalizedCrewIds.length
    ? `crew:${normalizedCrewIds.join("|")}`
    : athleteId
      ? `athlete:${athleteId}`
      : "";

  if (!participantKey) {
    return null;
  }

  return [
    categoryId || "-",
    boatClassId || "-",
    clubId || "-",
    participantKey,
  ].join("::");
};

const buildEventKey = ({ categoryId, boatClassId }) =>
  [categoryId || "-", boatClassId || "-"].join("::");

const laneHasAssignment = (lane) => {
  if (!lane) {
    return false;
  }
  if (lane.athlete) {
    return true;
  }
  return Array.isArray(lane.crew) && lane.crew.length > 0;
};

const buildEntryAssignmentKey = (entry) => {
  const categoryId = toStringId(entry?.category);
  const boatClassId = toStringId(entry?.boatClass);
  const clubId = toStringId(entry?.club);
  const crewIds = toSortedUniqueIds(
    (entry?.crew || []).map((member) => toStringId(member)),
  );
  const athleteId = crewIds.length ? null : toStringId(entry?.athlete);

  return buildAssignmentKey({
    categoryId,
    boatClassId,
    clubId,
    athleteId,
    crewIds,
  });
};

const buildLaneAssignmentKey = (race, lane) => {
  const categoryId = toStringId(lane?.category) || toStringId(race?.category);
  const boatClassId =
    toStringId(lane?.boatClass) || toStringId(race?.boatClass);
  const clubId = toStringId(lane?.club);
  const crewIds = toSortedUniqueIds(
    (lane?.crew || []).map((member) => toStringId(member)),
  );
  const athleteId = crewIds.length ? null : toStringId(lane?.athlete);

  return buildAssignmentKey({
    categoryId,
    boatClassId,
    clubId,
    athleteId,
    crewIds,
  });
};

const annotateRacesWithRegistrationStatus = (
  races,
  competitionEntries = [],
) => {
  if (!Array.isArray(races) || races.length === 0) {
    return [];
  }

  if (!Array.isArray(competitionEntries) || competitionEntries.length === 0) {
    return races;
  }

  const activeEntryKeys = new Set();
  const eventEntryKeys = new Set();

  competitionEntries.forEach((entry) => {
    const eventKey = buildEventKey({
      categoryId: toStringId(entry?.category),
      boatClassId: toStringId(entry?.boatClass),
    });
    eventEntryKeys.add(eventKey);

    if (String(entry?.status || "").toLowerCase() === "withdrawn") {
      return;
    }

    const assignmentKey = buildEntryAssignmentKey(entry);
    if (assignmentKey) {
      activeEntryKeys.add(assignmentKey);
    }
  });

  return races.map((race) => {
    const raceEventKey = buildEventKey({
      categoryId: toStringId(race?.category),
      boatClassId: toStringId(race?.boatClass),
    });
    const hasRegistrationDataForEvent = eventEntryKeys.has(raceEventKey);

    const lanes = Array.isArray(race?.lanes)
      ? race.lanes.map((lane) => {
          if (!laneHasAssignment(lane)) {
            return lane;
          }

          // Preserve hors_course status — never overwrite with withdrawn
          if (
            String(lane?.result?.status || "").toLowerCase() === "hors_course"
          ) {
            return lane;
          }

          const explicitWithdrawn =
            String(lane?.registrationStatus || "").toLowerCase() ===
              "withdrawn" ||
            String(lane?.result?.status || "").toLowerCase() === "withdrawn";

          let inferredWithdrawn = false;
          if (hasRegistrationDataForEvent) {
            const laneKey = buildLaneAssignmentKey(race, lane);
            inferredWithdrawn = Boolean(
              laneKey && !activeEntryKeys.has(laneKey),
            );
          }

          if (!explicitWithdrawn && !inferredWithdrawn) {
            if (lane?.registrationStatus) {
              return lane;
            }
            return { ...lane, registrationStatus: "active" };
          }

          const nextLane = {
            ...lane,
            registrationStatus: "withdrawn",
          };

          const nextResult = lane?.result ? { ...lane.result } : {};
          if ((nextResult.status || "ok") === "ok") {
            nextResult.status = "withdrawn";
            nextResult.finishPosition = undefined;
            nextResult.elapsedMs = undefined;
            nextResult.notes = nextResult.notes || "Withdrawn";
          }
          if (Object.keys(nextResult).length > 0) {
            nextLane.result = nextResult;
          }

          return nextLane;
        })
      : race?.lanes;

    return {
      ...race,
      lanes,
    };
  });
};

const ensureCompetition = async (competitionId) => {
  const id = toObjectId(competitionId);
  if (!id) {
    const error = new Error("Invalid competition identifier");
    error.statusCode = 400;
    throw error;
  }
  const competition = await Competition.findById(id).lean();
  if (!competition) {
    const error = new Error("Competition not found");
    error.statusCode = 404;
    throw error;
  }
  return competition;
};

const resolveCompetitionOrRespond = async (competitionId, res) => {
  try {
    return await ensureCompetition(competitionId);
  } catch (error) {
    const statusCode = error.statusCode || 400;
    if (!res.headersSent) {
      res.status(statusCode).json({ message: error.message });
    }
    return null;
  }
};

const shuffleArray = (items) => {
  const clone = [...items];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const j = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[j]] = [clone[j], clone[index]];
  }
  return clone;
};

const normaliseString = (value) =>
  typeof value === "string" ? value.trim() : undefined;

const resolveClubForAthlete = (athlete, competitionSeason, explicitClubId) => {
  if (explicitClubId) {
    return explicitClubId;
  }

  const memberships = Array.isArray(athlete?.memberships)
    ? athlete.memberships
    : [];

  // Prioritize active membership
  const activeMatch = memberships.find(
    (membership) => membership?.club && membership.status === "active",
  );
  if (activeMatch?.club) {
    return activeMatch.club;
  }

  // Then match by season
  if (competitionSeason) {
    const seasonMatch = memberships.find(
      (membership) =>
        membership?.club &&
        (membership.season === competitionSeason ||
          Number(membership.season) === Number(competitionSeason)),
    );
    if (seasonMatch?.club) {
      return seasonMatch.club;
    }
  }

  // Fallback: any club
  const anyClub = memberships.find((membership) => membership?.club);
  return anyClub?.club || null;
};

const sanitiseLanes = (lanes = [], discipline = "classic") => {
  if (!Array.isArray(lanes)) {
    throw new Error("Lane assignments must be an array");
  }

  const maxLanes = getMaxLanesForDiscipline(discipline);

  if (lanes.length > maxLanes) {
    throw new Error(
      `A race cannot have more than ${maxLanes} lanes for ${discipline} discipline`,
    );
  }

  const result = [];
  const seen = new Set();

  for (const laneCandidate of lanes) {
    if (!laneCandidate) {
      continue;
    }
    const laneNumber = Number(laneCandidate.lane ?? laneCandidate.laneNumber);
    if (
      !Number.isInteger(laneNumber) ||
      laneNumber < 1 ||
      laneNumber > maxLanes
    ) {
      throw new Error(`Lane numbers must be between 1 and ${maxLanes}`);
    }
    if (seen.has(laneNumber)) {
      throw new Error("Lane numbers must be unique within a race");
    }
    seen.add(laneNumber);

    const lane = {
      lane: laneNumber,
    };

    const athleteId = toObjectId(laneCandidate.athlete);
    if (athleteId) {
      lane.athlete = athleteId;
    }

    if (Array.isArray(laneCandidate.crew)) {
      lane.crew = laneCandidate.crew
        .map(toObjectId)
        .filter((id) => id !== null);
    }

    const crewNumberValue = Number(laneCandidate.crewNumber);
    if (
      Array.isArray(lane.crew) &&
      lane.crew.length > 1 &&
      Number.isInteger(crewNumberValue) &&
      crewNumberValue > 0
    ) {
      lane.crewNumber = crewNumberValue;
    }

    const clubId = toObjectId(
      laneCandidate.club || laneCandidate.clubId || laneCandidate.club_id,
    );
    if (clubId) {
      lane.club = clubId;
    }
    if (laneCandidate.seed !== undefined && laneCandidate.seed !== null) {
      const seedValue = Number(laneCandidate.seed);
      if (!Number.isNaN(seedValue)) {
        lane.seed = seedValue;
      }
    }
    if (laneCandidate.notes) {
      lane.notes = laneCandidate.notes.toString().trim();
    }

    if (laneCandidate.result) {
      const resultPayload = laneCandidate.result;
      const result = {};
      if (resultPayload.status) {
        if (!LANE_RESULT_STATUSES.includes(resultPayload.status)) {
          throw new Error("Unsupported lane result status");
        }
        result.status = resultPayload.status;
      }
      if (resultPayload.finishPosition !== undefined) {
        const finishPosition = Number(resultPayload.finishPosition);
        if (Number.isInteger(finishPosition) && finishPosition > 0) {
          result.finishPosition = finishPosition;
        }
      }
      if (resultPayload.elapsedMs !== undefined) {
        const elapsedMs = Number(resultPayload.elapsedMs);
        if (!Number.isNaN(elapsedMs) && elapsedMs >= 0) {
          result.elapsedMs = elapsedMs;
        }
      }
      if (resultPayload.notes) {
        result.notes = resultPayload.notes.toString().trim();
      }
      if (Object.keys(result).length > 0) {
        lane.result = result;
      }
    }

    result.push(lane);
  }

  return result;
};

const sanitiseRacePayload = (body, discipline = "classic") => {
  const payload = {};

  if (body.category) {
    const categoryId = toObjectId(body.category);
    if (!categoryId) {
      throw new Error("Invalid category identifier");
    }
    payload.category = categoryId;
  }

  if (body.boatClass) {
    const boatClassId = toObjectId(body.boatClass);
    if (!boatClassId) {
      throw new Error("Invalid boat class identifier");
    }
    payload.boatClass = boatClassId;
  }

  if (body.eventGroupId !== undefined) {
    payload.eventGroupId = body.eventGroupId
      ? body.eventGroupId.toString().trim()
      : undefined;
  }

  if (body.journeyIndex !== undefined) {
    const journeyIndex = Number(body.journeyIndex);
    if (!Number.isInteger(journeyIndex) || journeyIndex < 1) {
      throw new Error("Journey index must be a positive integer");
    }
    payload.journeyIndex = journeyIndex;
  }

  if (body.sessionLabel !== undefined) {
    payload.sessionLabel = body.sessionLabel
      ? body.sessionLabel.toString().trim()
      : undefined;
  }

  if (body.name !== undefined) {
    payload.name = body.name ? body.name.toString().trim() : undefined;
  }

  if (body.order !== undefined) {
    const orderValue = Number(body.order);
    if (Number.isNaN(orderValue)) {
      throw new Error("Order must be a number");
    }
    payload.order = orderValue;
  }

  if (body.startTime !== undefined) {
    const startTime = body.startTime ? new Date(body.startTime) : null;
    if (startTime && Number.isNaN(startTime.getTime())) {
      throw new Error("Start time is not a valid date");
    }
    payload.startTime = startTime || undefined;
  }

  if (body.distanceOverride !== undefined) {
    const distance = Number(body.distanceOverride);
    if (!Number.isNaN(distance) && distance >= 0) {
      payload.distanceOverride = distance;
    } else {
      payload.distanceOverride = undefined;
    }
  }

  if (body.status) {
    if (!RACE_STATUSES.includes(body.status)) {
      throw new Error("Unsupported race status");
    }
    payload.status = body.status;
  }

  if (body.notes !== undefined) {
    payload.notes = body.notes ? body.notes.toString().trim() : undefined;
  }

  if (body.lanes !== undefined) {
    payload.lanes = sanitiseLanes(body.lanes, discipline);
  }

  return payload;
};

const chunkArray = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const ORDERABLE_STRATEGIES = ["random", "seeded"];

const resolveEntriesForAutoGeneration = async (entries, competition) => {
  const competitionSeason = competition.season;
  if (!Array.isArray(entries) || !entries.length) {
    throw new Error("Entries payload must contain at least one entry");
  }

  const normalised = entries.map((entry, index) => {
    const athleteId = toObjectId(
      entry.athleteId || entry.athlete || entry.id || null,
    );

    let crewIds = [];
    if (Array.isArray(entry.crew)) {
      crewIds = entry.crew
        .map((c) => toObjectId(c.id || c._id || c))
        .filter((id) => id !== null);
    }

    const licenseNumber = normaliseString(entry.licenseNumber);
    if (!athleteId && !licenseNumber && crewIds.length === 0) {
      throw new Error(
        "Each entry must include an athlete id, license number, or crew",
      );
    }
    const seedValue =
      entry.seed !== undefined && entry.seed !== null
        ? Number(entry.seed)
        : index + 1;

    return {
      raw: entry,
      athleteId,
      crewIds,
      licenseNumber,
      seed: Number.isFinite(seedValue) ? seedValue : index + 1,
      clubId: toObjectId(entry.clubId || entry.club || null),
      notes: normaliseString(entry.notes),
      crewNumber: entry.crewNumber,
    };
  });

  const athleteIdSet = new Set();
  const licenseNumberSet = new Set();

  normalised.forEach((entry) => {
    if (entry.athleteId) {
      athleteIdSet.add(entry.athleteId.toString());
    }
    entry.crewIds.forEach((id) => athleteIdSet.add(id.toString()));

    if (entry.licenseNumber) {
      licenseNumberSet.add(entry.licenseNumber);
    }
  });

  const orConditions = [];
  if (athleteIdSet.size) {
    orConditions.push({ _id: { $in: [...athleteIdSet] } });
  }
  if (licenseNumberSet.size) {
    orConditions.push({ licenseNumber: { $in: [...licenseNumberSet] } });
  }

  let athletes = [];
  if (orConditions.length > 0) {
    athletes = await Athlete.find({ $or: orConditions })
      .select(
        "firstName lastName firstNameAr lastNameAr licenseNumber memberships club",
      )
      .lean();
  }

  // Fetch crew numbers from CompetitionEntry
  const allInvolvedIds = [];
  normalised.forEach((e) => {
    if (e.athleteId) allInvolvedIds.push(e.athleteId);
    e.crewIds.forEach((id) => allInvolvedIds.push(id));
  });

  const compEntries = await CompetitionEntry.find({
    competition: competition._id,
    $or: [
      { athlete: { $in: allInvolvedIds } },
      { crew: { $in: allInvolvedIds } },
    ],
  })
    .select("athlete crew crewNumber")
    .lean();

  const crewNumberMap = new Map();
  for (const ce of compEntries) {
    if (ce.athlete) crewNumberMap.set(ce.athlete.toString(), ce.crewNumber);
    if (Array.isArray(ce.crew)) {
      ce.crew.forEach((mid) =>
        crewNumberMap.set(mid.toString(), ce.crewNumber),
      );
    }
  }

  const athleteById = new Map();
  const athleteByLicense = new Map();
  for (const athlete of athletes) {
    athleteById.set(athlete._id.toString(), athlete);
    if (athlete.licenseNumber) {
      athleteByLicense.set(athlete.licenseNumber, athlete);
    }
  }

  const seenAthletes = new Set();
  const resolved = normalised.map((entry, index) => {
    let athleteDoc = null;
    if (entry.athleteId) {
      athleteDoc = athleteById.get(entry.athleteId.toString());
    }
    if (!athleteDoc && entry.licenseNumber) {
      athleteDoc = athleteByLicense.get(entry.licenseNumber);
    }

    const crewDocs = [];
    for (const cId of entry.crewIds) {
      const doc = athleteById.get(cId.toString());
      if (doc) crewDocs.push(doc);
    }

    if (!athleteDoc && crewDocs.length === 0) {
      throw new Error(`Unable to resolve athlete/crew for entry #${index + 1}`);
    }

    const currentEntryAthleteIds = new Set();
    if (athleteDoc) currentEntryAthleteIds.add(athleteDoc._id.toString());
    crewDocs.forEach((d) => currentEntryAthleteIds.add(d._id.toString()));

    for (const id of currentEntryAthleteIds) {
      if (seenAthletes.has(id)) {
        throw new Error("Duplicate athlete detected in entries payload");
      }
      seenAthletes.add(id);
    }

    const representative = athleteDoc || crewDocs[0];
    const clubId = resolveClubForAthlete(
      representative,
      competitionSeason,
      entry.clubId,
    );

    // Use crewNumber from request if provided, otherwise fallback to CompetitionEntry lookup
    const crewNumber =
      entry.crewNumber !== undefined
        ? entry.crewNumber
        : crewNumberMap.get(representative._id.toString());

    const isCrewEntry =
      Array.isArray(entry.crewIds) && entry.crewIds.length > 1;
    return {
      athlete: athleteDoc,
      crew: crewDocs,
      clubId,
      seed: entry.seed,
      notes: entry.notes,
      crewNumber: isCrewEntry ? crewNumber : undefined,
    };
  });

  return resolved;
};

export const autoGenerateRaces = asyncHandler(async (req, res) => {
  const { competitionId } = req.params;
  const competition = await resolveCompetitionOrRespond(competitionId, res);
  if (!competition) {
    return;
  }

  const {
    category,
    boatClass,
    journeyIndex,
    sessionLabel,
    racePrefix,
    strategy = "random",
    lanesPerRace = MAX_LANES,
    entries = [],
    overwriteExisting = true,
    startRaceNumber,
    startTime,
    intervalMinutes = 0,
    distance,
  } = req.body || {};

  const categoryId = toObjectId(category);
  if (!categoryId) {
    return res.status(400).json({ message: "Category is required" });
  }

  if (!journeyIndex || !Number.isInteger(Number(journeyIndex))) {
    return res
      .status(400)
      .json({ message: "Journey index must be a positive integer" });
  }

  const journeyValue = Number(journeyIndex);
  if (journeyValue < 1) {
    return res
      .status(400)
      .json({ message: "Journey index must be greater than zero" });
  }

  const boatClassId = toObjectId(boatClass);

  if (
    competition.allowedCategories?.length &&
    !competition.allowedCategories.some((allowed) => allowed.equals(categoryId))
  ) {
    return res.status(400).json({
      message: "Selected category is not allowed for this competition",
    });
  }

  if (
    boatClassId &&
    competition.allowedBoatClasses?.length &&
    !competition.allowedBoatClasses.some((allowed) =>
      allowed.equals(boatClassId),
    )
  ) {
    return res.status(400).json({
      message: "Selected boat class is not allowed for this competition",
    });
  }

  if (!ORDERABLE_STRATEGIES.includes(strategy)) {
    return res.status(400).json({ message: "Unsupported allocation strategy" });
  }

  const resolvedEntries = await resolveEntriesForAutoGeneration(
    entries,
    competition,
  );

  const maxLanes = getMaxLanesForDiscipline(competition.discipline);
  const seatsPerRace = Math.max(
    1,
    Math.min(Number(lanesPerRace) || maxLanes, maxLanes),
  );

  let orderedEntries = resolvedEntries;
  if (strategy === "random") {
    orderedEntries = shuffleArray(resolvedEntries);
  } else if (strategy === "seeded") {
    orderedEntries = [...resolvedEntries].sort((a, b) => a.seed - b.seed);
  }

  const entryChunks = chunkArray(orderedEntries, seatsPerRace);

  const filter = {
    competition: competition._id,
    category: categoryId,
    journeyIndex: journeyValue,
  };
  if (boatClassId) {
    filter.boatClass = boatClassId;
  }

  if (overwriteExisting) {
    await CompetitionRace.deleteMany(filter);
  }

  // Determine starting race number (order)
  let nextOrder = 1;
  if (startRaceNumber !== undefined && startRaceNumber !== null) {
    nextOrder = Number(startRaceNumber);
  } else {
    // Find the highest existing race number in the entire competition
    const maxRace = await CompetitionRace.findOne({
      competition: competition._id,
    })
      .sort({ order: -1 })
      .select("order")
      .lean();
    if (maxRace && maxRace.order) {
      nextOrder = maxRace.order + 1;
    }
  }

  // Determine starting time
  let nextStartTime = null;
  let effectiveInterval = Number(intervalMinutes);
  if (isNaN(effectiveInterval) || effectiveInterval < 0) {
    effectiveInterval = 0;
  }

  if (startTime) {
    nextStartTime = new Date(startTime);
  } else {
    // Auto-schedule: Find the race with the latest start time
    // Ensure we only look at races with valid start times
    const lastRace = await CompetitionRace.findOne({
      competition: competition._id,
      startTime: { $exists: true, $ne: null },
    })
      .sort({ startTime: -1 })
      .select("startTime")
      .lean();

    if (lastRace && lastRace.startTime) {
      // Use provided interval or default to 10 minutes for auto-scheduling
      if (effectiveInterval <= 0) {
        effectiveInterval = 10;
      }
      // Ensure lastRace.startTime is a Date object
      const lastTime = new Date(lastRace.startTime);
      if (!isNaN(lastTime.getTime())) {
        nextStartTime = new Date(
          lastTime.getTime() + effectiveInterval * 60000,
        );
      }
    }
  }

  const categoryDoc = await Category.findById(categoryId)
    .select("abbreviation titles")
    .lean();
  const prefixLabel =
    racePrefix ||
    categoryDoc?.abbreviation ||
    categoryDoc?.titles?.en ||
    "Race";

  const racesToInsert = entryChunks.map((chunk, index) => {
    // Sort chunk by seed to ensure seeds are in order within the race
    const sortedChunk = [...chunk].sort(
      (a, b) => (a.seed || 0) - (b.seed || 0),
    );

    const lanes = sortedChunk.map((entry, laneIndex) => ({
      // Lane number matches the position (1, 2, 3...) based on seed order
      lane: laneIndex + 1,
      // Only set athlete if it's NOT a crew boat (or crew is empty)
      // This prevents the frontend from prioritizing the single athlete display over the crew display
      athlete:
        Array.isArray(entry.crew) && entry.crew.length > 0
          ? undefined
          : entry.athlete?._id,
      crew: Array.isArray(entry.crew) ? entry.crew.map((c) => c._id) : [],
      club: entry.clubId || undefined,
      seed: entry.seed,
      notes: entry.notes,
      crewNumber:
        Array.isArray(entry.crew) && entry.crew.length > 1
          ? entry.crewNumber
          : undefined,
    }));

    const currentOrder = nextOrder + index;

    let currentStartTime = undefined;
    if (nextStartTime && !isNaN(nextStartTime.getTime())) {
      currentStartTime = new Date(
        nextStartTime.getTime() + index * effectiveInterval * 60000,
      );
    }

    return {
      competition: competition._id,
      category: categoryId,
      boatClass: boatClassId || undefined,
      eventGroupId:
        normaliseString(req.body?.eventGroupId) ||
        `${categoryId.toString()}::${
          boatClassId ? boatClassId.toString() : "open"
        }::J${journeyValue}`,
      journeyIndex: journeyValue,
      sessionLabel: normaliseString(sessionLabel),
      name: `${prefixLabel} ${index + 1}`, // Keep name as "Heat 1", "Heat 2" etc. relative to this batch
      order: currentOrder,
      startTime: currentStartTime,
      distanceOverride: distance ? Number(distance) : undefined,
      status: "scheduled",
      lanes,
      createdBy: req.user?.id,
      updatedBy: req.user?.id,
    };
  });

  const inserted = await CompetitionRace.insertMany(racesToInsert);

  return res.status(201).json(inserted.map((race) => race.toObject()));
});

export const listRaces = asyncHandler(async (req, res) => {
  const { competitionId } = req.params;
  const competition = await resolveCompetitionOrRespond(competitionId, res);
  if (!competition) {
    return;
  }

  const query = { competition: competition._id };

  if (req.query.category) {
    const categoryId = toObjectId(req.query.category);
    if (!categoryId) {
      return res.status(400).json({ message: "Invalid category filter" });
    }
    query.category = categoryId;
  }

  if (req.query.boatClass) {
    const boatClassId = toObjectId(req.query.boatClass);
    if (!boatClassId) {
      return res.status(400).json({ message: "Invalid boat class filter" });
    }
    query.boatClass = boatClassId;
  }

  if (req.query.journey) {
    const journeyIndex = Number(req.query.journey);
    if (!Number.isInteger(journeyIndex) || journeyIndex < 1) {
      return res
        .status(400)
        .json({ message: "Journey filter must be numeric" });
    }
    query.journeyIndex = journeyIndex;
  }

  if (req.query.status) {
    if (!RACE_STATUSES.includes(req.query.status)) {
      return res.status(400).json({ message: "Unsupported status filter" });
    }
    query.status = req.query.status;
  }

  const races = await CompetitionRace.find(query)
    .sort({ journeyIndex: 1, order: 1, startTime: 1 })
    .populate({
      path: "category",
      select: "abbreviation titles type gender",
    })
    .populate({
      path: "boatClass",
      select: "code names discipline crewSize",
    })
    .populate({
      path: "lanes.athlete",
      select:
        "firstName lastName firstNameAr lastNameAr licenseNumber birthDate gender",
    })
    .populate({
      path: "lanes.crew",
      select:
        "firstName lastName firstNameAr lastNameAr licenseNumber birthDate gender",
    })
    .populate({
      path: "lanes.club",
      select: "name nameAr code",
    })
    .lean();

  const competitionEntries = await CompetitionEntry.find({
    competition: competition._id,
  })
    .select("athlete crew club category boatClass status")
    .lean();

  const annotatedRaces = annotateRacesWithRegistrationStatus(
    races,
    competitionEntries,
  );

  return res.json(annotatedRaces);
});

export const getRace = asyncHandler(async (req, res) => {
  const { competitionId, raceId } = req.params;
  const competition = await resolveCompetitionOrRespond(competitionId, res);
  if (!competition) {
    return;
  }

  const race = await CompetitionRace.findOne({
    _id: raceId,
    competition: competition._id,
  })
    .populate({
      path: "category",
      select: "abbreviation titles name gender ageGroup",
    })
    .populate({
      path: "boatClass",
      select: "abbreviation names crewSize",
    })
    .populate({
      path: "lanes.athlete",
      select:
        "firstName lastName firstNameAr lastNameAr licenseNumber birthDate gender",
    })
    .populate({
      path: "lanes.crew",
      select:
        "firstName lastName firstNameAr lastNameAr licenseNumber birthDate gender",
    })
    .populate({
      path: "lanes.club",
      select: "name nameAr code",
    })
    .lean();

  if (!race) {
    return res.status(404).json({ message: "Race not found" });
  }

  const competitionEntries = await CompetitionEntry.find({
    competition: competition._id,
  })
    .select("athlete crew club category boatClass status")
    .lean();

  const [annotatedRace] = annotateRacesWithRegistrationStatus(
    [race],
    competitionEntries,
  );

  return res.json(annotatedRace || race);
});

export const createRace = asyncHandler(async (req, res) => {
  const { competitionId } = req.params;
  const competition = await resolveCompetitionOrRespond(competitionId, res);
  if (!competition) {
    return;
  }

  const payload = sanitiseRacePayload(req.body || {}, competition.discipline);

  if (!payload.category) {
    return res.status(400).json({ message: "Category is required" });
  }

  if (!payload.journeyIndex) {
    return res.status(400).json({ message: "Journey index is required" });
  }

  if (
    competition.allowedCategories?.length &&
    !competition.allowedCategories.some((categoryId) =>
      categoryId.equals(payload.category),
    )
  ) {
    return res.status(400).json({
      message: "Selected category is not allowed for this competition",
    });
  }

  if (
    payload.boatClass &&
    competition.allowedBoatClasses?.length &&
    !competition.allowedBoatClasses.some((boatClassId) =>
      boatClassId.equals(payload.boatClass),
    )
  ) {
    return res.status(400).json({
      message: "Selected boat class is not allowed for this competition",
    });
  }

  payload.competition = competition._id;
  payload.createdBy = req.user?.id;
  payload.updatedBy = req.user?.id;

  const race = await CompetitionRace.create(payload);

  return res.status(201).json(race.toObject());
});

export const updateRace = asyncHandler(async (req, res) => {
  const { competitionId, raceId } = req.params;
  const competition = await resolveCompetitionOrRespond(competitionId, res);
  if (!competition) {
    return;
  }

  const payload = sanitiseRacePayload(req.body || {}, competition.discipline);
  payload.updatedBy = req.user?.id;

  const race = await CompetitionRace.findOneAndUpdate(
    { _id: raceId, competition: competition._id },
    { $set: payload },
    { new: true },
  ).lean();

  if (!race) {
    return res.status(404).json({ message: "Race not found" });
  }

  return res.json(race);
});

export const deleteRace = asyncHandler(async (req, res) => {
  const { competitionId, raceId } = req.params;
  const competition = await resolveCompetitionOrRespond(competitionId, res);
  if (!competition) {
    return;
  }

  const result = await CompetitionRace.findOneAndDelete({
    _id: raceId,
    competition: competition._id,
  }).lean();

  if (!result) {
    return res.status(404).json({ message: "Race not found" });
  }

  return res.json({ success: true });
});

export const updateRaceLanes = asyncHandler(async (req, res) => {
  const { competitionId, raceId } = req.params;
  const competition = await resolveCompetitionOrRespond(competitionId, res);
  if (!competition) {
    return;
  }

  const lanes = sanitiseLanes(req.body?.lanes || [], competition.discipline);

  const race = await CompetitionRace.findOneAndUpdate(
    { _id: raceId, competition: competition._id },
    {
      $set: {
        lanes,
        updatedBy: req.user?.id,
      },
    },
    { new: true },
  ).lean();

  if (!race) {
    return res.status(404).json({ message: "Race not found" });
  }

  return res.json(race);
});

const pickLaneAssignment = (lane, raceContext = null) => {
  const defaultCategory = raceContext?.category || undefined;
  const defaultBoatClass = raceContext?.boatClass || undefined;

  if (!lane) {
    return {
      athlete: undefined,
      crew: [],
      crewNumber: undefined,
      club: undefined,
      category: defaultCategory,
      boatClass: defaultBoatClass,
      seed: undefined,
      notes: undefined,
      result: undefined,
    };
  }
  return {
    athlete: lane.athlete || undefined,
    crew: Array.isArray(lane.crew) ? lane.crew : [],
    crewNumber: lane.crewNumber || undefined,
    club: lane.club || undefined,
    category: lane.category || defaultCategory,
    boatClass: lane.boatClass || defaultBoatClass,
    seed: lane.seed || undefined,
    notes: lane.notes || undefined,
    result:
      lane.result && typeof lane.result === "object"
        ? (lane.result.toObject?.() ?? { ...lane.result })
        : undefined,
  };
};

const assignLaneDetails = (lane, details) => {
  lane.athlete = details.athlete ?? null;
  lane.crew = Array.isArray(details.crew) ? details.crew : [];
  lane.crewNumber = details.crewNumber ?? undefined;
  lane.club = details.club ?? null;
  lane.category = details.category || undefined;
  lane.boatClass = details.boatClass || undefined;
  lane.seed = details.seed || undefined;
  lane.notes = details.notes || undefined;
  lane.result = details.result || undefined;
};

const lanePayloadHasCompetitor = (payload) => {
  if (!payload) {
    return false;
  }
  if (payload.athlete) {
    return true;
  }
  return Array.isArray(payload.crew) && payload.crew.length > 0;
};

const pruneUnassignedLanes = (raceDoc) => {
  raceDoc.lanes = raceDoc.lanes.filter((lane) => {
    const hasAthlete = Boolean(lane?.athlete);
    const hasCrew = Array.isArray(lane?.crew) && lane.crew.length > 0;
    return hasAthlete || hasCrew;
  });
};

export const swapRaceLanes = asyncHandler(async (req, res) => {
  const { competitionId } = req.params;
  const competition = await resolveCompetitionOrRespond(competitionId, res);
  if (!competition) {
    return;
  }

  const { source, target } = req.body || {};
  if (!source?.raceId || !target?.raceId) {
    return res
      .status(400)
      .json({ message: "Source and target race identifiers are required" });
  }

  const sourceLaneNumber = Number(source.lane);
  const targetLaneNumber = Number(target.lane);

  if (
    !Number.isInteger(sourceLaneNumber) ||
    sourceLaneNumber < 1 ||
    sourceLaneNumber > MAX_LANES
  ) {
    return res.status(400).json({ message: "Source lane must be between 1-8" });
  }
  if (
    !Number.isInteger(targetLaneNumber) ||
    targetLaneNumber < 1 ||
    targetLaneNumber > MAX_LANES
  ) {
    return res.status(400).json({ message: "Target lane must be between 1-8" });
  }

  const sourceRace = await CompetitionRace.findOne({
    _id: source.raceId,
    competition: competition._id,
  });
  if (!sourceRace) {
    return res.status(404).json({ message: "Source race not found" });
  }

  const isSameRace = source.raceId === target.raceId;
  const targetRace = isSameRace
    ? sourceRace
    : await CompetitionRace.findOne({
        _id: target.raceId,
        competition: competition._id,
      });
  if (!targetRace) {
    return res.status(404).json({ message: "Target race not found" });
  }

  const ensureLaneExists = (raceDoc, laneNumber) => {
    let laneDoc = raceDoc.lanes.find((lane) => lane.lane === laneNumber);
    if (!laneDoc) {
      laneDoc = raceDoc.lanes.create({ lane: laneNumber });
      raceDoc.lanes.push(laneDoc);
    }
    return laneDoc;
  };

  const sourceLane = ensureLaneExists(sourceRace, sourceLaneNumber);
  const targetLane = ensureLaneExists(targetRace, targetLaneNumber);

  const sourcePayload = pickLaneAssignment(sourceLane, sourceRace);
  const targetPayload = pickLaneAssignment(targetLane, targetRace);

  const sourceHasCompetitor = lanePayloadHasCompetitor(sourcePayload);
  const targetHasCompetitor = lanePayloadHasCompetitor(targetPayload);

  if (sourceHasCompetitor && !targetHasCompetitor) {
    // Move source competitor into empty target lane and clear source lane.
    assignLaneDetails(targetLane, sourcePayload);
    assignLaneDetails(sourceLane, pickLaneAssignment(null, sourceRace));
  } else if (!sourceHasCompetitor && targetHasCompetitor) {
    // Move target competitor into empty source lane and clear target lane.
    assignLaneDetails(sourceLane, targetPayload);
    assignLaneDetails(targetLane, pickLaneAssignment(null, targetRace));
  } else {
    // Regular occupied<->occupied swap (or both empty no-op).
    assignLaneDetails(sourceLane, targetPayload);
    assignLaneDetails(targetLane, sourcePayload);
  }

  pruneUnassignedLanes(sourceRace);
  if (!isSameRace) {
    pruneUnassignedLanes(targetRace);
  }

  sourceRace.markModified("lanes");
  sourceRace.updatedBy = req.user?.id;
  if (!isSameRace) {
    targetRace.markModified("lanes");
    targetRace.updatedBy = req.user?.id;
  }

  if (isSameRace) {
    await sourceRace.save();
    return res.json({ race: sourceRace.toObject() });
  }

  await Promise.all([sourceRace.save(), targetRace.save()]);

  return res.json({
    source: sourceRace.toObject(),
    target: targetRace.toObject(),
  });
});

const sanitiseResultsUpdate = (lanes = []) => {
  if (!Array.isArray(lanes)) {
    throw new Error("Results payload must be an array");
  }

  const updates = [];

  for (const laneResult of lanes) {
    if (!laneResult) {
      continue;
    }
    const laneNumber = Number(laneResult.lane ?? laneResult.laneNumber);
    if (!Number.isInteger(laneNumber) || laneNumber < 1 || laneNumber > 100) {
      throw new Error("Lane numbers must be between 1 and 100");
    }

    const update = {
      lane: laneNumber,
      result: {},
    };

    // Support both flat structure and nested result object
    const resultData = laneResult.result || laneResult;

    if (resultData.status) {
      if (!LANE_RESULT_STATUSES.includes(resultData.status)) {
        throw new Error("Unsupported lane result status");
      }
      update.result.status = resultData.status;
    }

    if (resultData.finishPosition !== undefined) {
      const finishPosition = Number(resultData.finishPosition);
      if (!Number.isInteger(finishPosition) || finishPosition < 1) {
        throw new Error("Finish position must be a positive integer");
      }
      update.result.finishPosition = finishPosition;
    }

    if (resultData.elapsedMs !== undefined) {
      const elapsedMs = Number(resultData.elapsedMs);
      if (Number.isNaN(elapsedMs) || elapsedMs < 0) {
        throw new Error("Elapsed time must be zero or greater");
      }
      update.result.elapsedMs = elapsedMs;
    }

    if (resultData.notes) {
      update.result.notes = resultData.notes.toString().trim();
    }

    updates.push(update);
  }

  return updates;
};

export const recordRaceResults = asyncHandler(async (req, res) => {
  const { competitionId, raceId } = req.params;
  const competition = await resolveCompetitionOrRespond(competitionId, res);
  if (!competition) {
    return;
  }

  const updates = sanitiseResultsUpdate(req.body?.lanes || []);
  const race = await CompetitionRace.findOne({
    _id: raceId,
    competition: competition._id,
  });

  if (!race) {
    return res.status(404).json({ message: "Race not found" });
  }

  const lanesByNumber = new Map();
  for (const lane of race.lanes) {
    lanesByNumber.set(lane.lane, lane);
  }

  for (const update of updates) {
    const lane = lanesByNumber.get(update.lane);
    if (!lane) {
      throw new Error(`Lane ${update.lane} is not assigned in this race`);
    }
    const existingResult =
      lane.result && typeof lane.result === "object"
        ? (lane.result.toObject?.() ?? lane.result)
        : {};
    lane.result = {
      ...existingResult,
      ...update.result,
    };
  }

  if (req.body.status && RACE_STATUSES.includes(req.body.status)) {
    race.status = req.body.status;
  } else if (req.body.markCompleted) {
    race.status = "completed";
  }

  race.updatedBy = req.user?.id;
  await race.save();

  return res.json(race.toObject());
});

const bestTimeSorter = (a, b) => {
  if (a.elapsedMs !== b.elapsedMs) {
    if (a.elapsedMs === undefined) {
      return 1;
    }
    if (b.elapsedMs === undefined) {
      return -1;
    }
    return a.elapsedMs - b.elapsedMs;
  }
  if (a.finishPosition !== b.finishPosition) {
    if (a.finishPosition === undefined) {
      return 1;
    }
    if (b.finishPosition === undefined) {
      return -1;
    }
    return a.finishPosition - b.finishPosition;
  }
  return a.lane - b.lane;
};

const STATUS_PRIORITY = {
  ok: 1,
  dnf: 2,
  dns: 3,
  abs: 4,
  dsq: 5,
  hors_course: 6,
};

const getEffectiveEventGroupId = (race) => {
  if (race?.eventGroupId) {
    return race.eventGroupId;
  }
  const categoryId = race?.category?._id || race?.category;
  const boatClassId = race?.boatClass?._id || race?.boatClass;
  const journeyPart = race?.journeyIndex || 1;
  return `${categoryId?.toString?.() || "unknown"}::${
    boatClassId?.toString?.() || "open"
  }::J${journeyPart}`;
};

const buildDefaultEventGroupId = (raceLike) => {
  const categoryId = raceLike?.category?._id || raceLike?.category;
  const boatClassId = raceLike?.boatClass?._id || raceLike?.boatClass;
  const journeyPart = Number(raceLike?.journeyIndex) || 1;
  return `${categoryId?.toString?.() || "unknown"}::${
    boatClassId?.toString?.() || "open"
  }::J${journeyPart}`;
};

const getEffectivePointTable = (rankingSystem) => {
  if (
    rankingSystem?.customPointTable &&
    Array.isArray(rankingSystem.customPointTable) &&
    rankingSystem.customPointTable.length > 0
  ) {
    return rankingSystem.customPointTable.reduce((acc, entry) => {
      if (
        Number.isInteger(entry?.position) &&
        entry.position > 0 &&
        Number.isFinite(entry?.points)
      ) {
        acc[entry.position] = Number(entry.points);
      }
      return acc;
    }, {});
  }
  return DEFAULT_POINT_TABLE;
};

const scoreForPosition = (position, pointTable) => {
  if (!Number.isInteger(position) || position < 1) {
    return 0;
  }
  return Number(pointTable[position] || 0);
};

const resolveBestLaneRecord = (current, candidate) => {
  if (!current) {
    return candidate;
  }

  const currentTimed =
    current.status === "ok" && Number.isFinite(current.elapsedMs);
  const candidateTimed =
    candidate.status === "ok" && Number.isFinite(candidate.elapsedMs);

  if (candidateTimed && !currentTimed) {
    return candidate;
  }
  if (candidateTimed && currentTimed) {
    if (candidate.elapsedMs < current.elapsedMs) {
      return candidate;
    }
    return current;
  }

  const currentPos = Number.isInteger(current.finishPosition)
    ? current.finishPosition
    : Number.MAX_SAFE_INTEGER;
  const candidatePos = Number.isInteger(candidate.finishPosition)
    ? candidate.finishPosition
    : Number.MAX_SAFE_INTEGER;
  if (candidatePos < currentPos) {
    return candidate;
  }

  const currentStatus = STATUS_PRIORITY[current.status] || 99;
  const candidateStatus = STATUS_PRIORITY[candidate.status] || 99;
  if (candidateStatus < currentStatus) {
    return candidate;
  }

  return current;
};

const buildConsolidatedEventEntries = (races, pointTable) => {
  const athleteMap = new Map();

  for (const race of races) {
    for (const lane of race.lanes || []) {
      // Hors-course athletes participate but are excluded from ranking/points
      const laneStatus = (lane.result?.status || "ok").toLowerCase();
      if (laneStatus === "hors_course") continue;

      // Use crew serialization logic. We must establish a uniform ID for the crew to map unique participants or crews
      const rawCrew = lane.crew || [];
      const primaryAthleteId = rawCrew[0]?._id || rawCrew[0];
      const fallbackAthleteId = lane.athlete?._id || lane.athlete;
      const crewKey =
        rawCrew.length > 0
          ? rawCrew.map((c) => c._id || c).join("-")
          : fallbackAthleteId
            ? fallbackAthleteId.toString()
            : null;

      if (!crewKey) continue;

      const result = lane.result || {};
      const status = result.status || "ok";

      const candidate = {
        athleteId: crewKey, // mapping key for crew
        athlete: fallbackAthleteId || primaryAthleteId, // legacy fallback
        crew: lane.crew,
        crewNumber: lane.crewNumber,
        club: lane.club || null,
        lane: lane.lane,
        sourceRaceId: lane.sourceRaceId || race._id,
        sourceRaceName:
          race.name ||
          `Race ${lane.sourceRaceOrder || race.order || ""}`.trim(),
        status,
        elapsedMs:
          Number.isFinite(result.elapsedMs) && result.elapsedMs >= 0
            ? Number(result.elapsedMs)
            : undefined,
        finishPosition: Number.isInteger(result.finishPosition)
          ? result.finishPosition
          : undefined,
      };

      athleteMap.set(
        candidate.athleteId,
        resolveBestLaneRecord(athleteMap.get(candidate.athleteId), candidate),
      );
    }
  }

  const consolidated = Array.from(athleteMap.values());

  const timed = consolidated
    .filter(
      (entry) => entry.status === "ok" && Number.isFinite(entry.elapsedMs),
    )
    .sort((a, b) => a.elapsedMs - b.elapsedMs);

  timed.forEach((entry, index) => {
    entry.rank = index + 1;
    entry.points = scoreForPosition(entry.rank, pointTable);
  });

  const untimed = consolidated
    .filter(
      (entry) => !(entry.status === "ok" && Number.isFinite(entry.elapsedMs)),
    )
    .sort((a, b) => {
      const statusA = STATUS_PRIORITY[a.status] || 99;
      const statusB = STATUS_PRIORITY[b.status] || 99;
      if (statusA !== statusB) {
        return statusA - statusB;
      }
      const posA = Number.isInteger(a.finishPosition)
        ? a.finishPosition
        : Number.MAX_SAFE_INTEGER;
      const posB = Number.isInteger(b.finishPosition)
        ? b.finishPosition
        : Number.MAX_SAFE_INTEGER;
      if (posA !== posB) {
        return posA - posB;
      }
      return (a.lane || 999) - (b.lane || 999);
    })
    .map((entry) => ({
      ...entry,
      rank: null,
      points: 0,
    }));

  return [...timed, ...untimed];
};

const resolveRankingSystemForCompetition = async (
  competition,
  rankingSystemId,
) => {
  if (rankingSystemId) {
    const selected = await RankingSystem.findById(rankingSystemId);
    if (!selected) {
      throw new Error("Ranking system not found");
    }
    return selected;
  }

  return RankingSystem.findOne({
    isActive: true,
    $or: [{ discipline: competition.discipline }, { discipline: null }],
  }).sort({ sortOrder: 1, code: 1 });
};

const fetchRacesForEventGroup = async (competitionId, eventGroupId) => {
  const allRaces = await CompetitionRace.find({ competition: competitionId })
    .populate({ path: "category", select: "abbreviation titles" })
    .populate({ path: "boatClass", select: "code names" })
    .populate({
      path: "lanes.athlete",
      select: "firstName lastName firstNameAr lastNameAr licenseNumber",
    })
    .populate({ path: "lanes.club", select: "name nameAr code" });

  return allRaces.filter(
    (race) => getEffectiveEventGroupId(race) === eventGroupId,
  );
};

const toOfficialEntryPayload = (entry) => {
  const athleteName = `${entry.athlete?.firstName || ""} ${
    entry.athlete?.lastName || ""
  }`.trim();
  const athleteNameAr = `${entry.athlete?.firstNameAr || ""} ${
    entry.athlete?.lastNameAr || ""
  }`.trim();

  return {
    athlete: entry.athlete?._id || entry.athlete,
    club: entry.club?._id || entry.club || undefined,
    athleteName,
    athleteNameAr: athleteNameAr || undefined,
    clubName: entry.club?.name || entry.club?.nameAr || entry.club?.code,
    lane: entry.lane,
    sourceRace: entry.sourceRaceId,
    sourceRaceName: entry.sourceRaceName,
    status: entry.status,
    elapsedMs: entry.elapsedMs,
    finishPosition: entry.finishPosition,
    rank: entry.rank || undefined,
    points: entry.points || 0,
  };
};

export const listOfficialResultGroups = asyncHandler(async (req, res) => {
  const { competitionId } = req.params;
  const { journeyIndex } = req.query;
  const competition = await resolveCompetitionOrRespond(competitionId, res);
  if (!competition) {
    return;
  }

  let query = { competition: competition._id };
  if (
    journeyIndex !== undefined &&
    journeyIndex !== null &&
    journeyIndex !== ""
  ) {
    query.journeyIndex = Number(journeyIndex);
  }

  const races = await CompetitionRace.find(query)
    .select(
      "_id category boatClass journeyIndex name order startTime status eventGroupId",
    )
    .populate({ path: "category", select: "abbreviation titles" })
    .populate({ path: "boatClass", select: "code names" })
    .lean();

  const published = await OfficialResult.find({ competition: competition._id })
    .select("eventGroupId publishedAt revision locked rankingSystem")
    .lean();
  const publishedMap = new Map(
    published.map((item) => [item.eventGroupId, item]),
  );

  const groups = new Map();

  for (const race of races) {
    const groupId = getEffectiveEventGroupId(race);
    if (!groups.has(groupId)) {
      groups.set(groupId, {
        eventGroupId: groupId,
        eventLabel: `${race.category?.abbreviation || ""} ${
          race.boatClass?.code || ""
        }`.trim(),
        category: race.category || null,
        boatClass: race.boatClass || null,
        raceCount: 0,
        completedRaceCount: 0,
      });
    }

    const bucket = groups.get(groupId);
    bucket.raceCount += 1;
    if (race.status === "completed") {
      bucket.completedRaceCount += 1;
    }
  }

  const response = Array.from(groups.values())
    .map((group) => {
      const official = publishedMap.get(group.eventGroupId);
      const canPublish =
        group.raceCount > 0 && group.completedRaceCount === group.raceCount;
      return {
        ...group,
        canPublish,
        published: Boolean(official),
        publishedAt: official?.publishedAt,
        revision: official?.revision,
        locked: official?.locked,
        rankingSystem: official?.rankingSystem || null,
      };
    })
    .sort((a, b) => a.eventLabel.localeCompare(b.eventLabel));

  return res.json(response);
});

const publishOfficialEventGroupInternal = async ({
  competition,
  eventGroupId,
  rankingSystemId,
  force,
  userId,
}) => {
  const normalizedGroupId = eventGroupId.toString().trim();

  const rankingSystem = await resolveRankingSystemForCompetition(
    competition,
    rankingSystemId,
  );
  const pointTable = getEffectivePointTable(rankingSystem);

  const races = await fetchRacesForEventGroup(
    competition._id,
    normalizedGroupId,
  );
  const completedRaces = races.filter((race) => race.status === "completed");
  if (!completedRaces.length) {
    const error = new Error(
      "Cannot publish without completed races in this event group",
    );
    error.statusCode = 400;
    throw error;
  }

  const consolidatedEntries = buildConsolidatedEventEntries(
    completedRaces,
    pointTable,
  );

  const existing = await OfficialResult.findOne({
    competition: competition._id,
    eventGroupId: normalizedGroupId,
  });

  if (existing?.locked && !force) {
    const error = new Error(
      "Official result is locked. Republish with force=true to create a new revision.",
    );
    error.statusCode = 409;
    throw error;
  }

  const firstRace = completedRaces[0];
  const officialPayload = {
    competition: competition._id,
    eventGroupId: normalizedGroupId,
    eventLabel: `${firstRace?.category?.abbreviation || ""} ${
      firstRace?.boatClass?.code || ""
    }`.trim(),
    category: firstRace?.category?._id || firstRace?.category,
    boatClass: firstRace?.boatClass?._id || firstRace?.boatClass,
    raceIds: completedRaces.map((race) => race._id),
    rankingSystem: rankingSystem
      ? {
          id: rankingSystem._id,
          code: rankingSystem.code,
          nameEn: rankingSystem.names?.en,
        }
      : undefined,
    pointTable,
    entries: consolidatedEntries.map(toOfficialEntryPayload),
    totalParticipants: consolidatedEntries.length,
    publishedAt: new Date(),
    publishedBy: userId,
    revision: existing ? Number(existing.revision || 1) + 1 : 1,
    locked: true,
  };

  const official = await OfficialResult.findOneAndUpdate(
    {
      competition: competition._id,
      eventGroupId: normalizedGroupId,
    },
    { $set: officialPayload },
    { new: true, upsert: true },
  ).lean();

  return { official, existed: Boolean(existing) };
};

export const autoAssignEventGroups = asyncHandler(async (req, res) => {
  const { competitionId } = req.params;
  const competition = await resolveCompetitionOrRespond(competitionId, res);
  if (!competition) {
    return;
  }

  const rewriteAll = req.body?.rewriteAll === true;

  const races = await CompetitionRace.find({ competition: competition._id })
    .select("_id category boatClass journeyIndex eventGroupId")
    .lean();

  const updates = [];
  for (const race of races) {
    const current = race.eventGroupId?.trim();
    const next = buildDefaultEventGroupId(race);
    if (rewriteAll || !current) {
      updates.push({
        updateOne: {
          filter: { _id: race._id },
          update: {
            $set: {
              eventGroupId: next,
              updatedBy: req.user?.id,
            },
          },
        },
      });
    }
  }

  if (updates.length) {
    await CompetitionRace.bulkWrite(updates);
  }

  return res.json({
    success: true,
    updatedCount: updates.length,
    rewriteAll,
  });
});

export const getProvisionalEventResults = asyncHandler(async (req, res) => {
  const { competitionId, eventGroupId } = req.params;
  const competition = await resolveCompetitionOrRespond(competitionId, res);
  if (!competition) {
    return;
  }

  const rankingSystem = await resolveRankingSystemForCompetition(
    competition,
    req.query?.rankingSystemId,
  );
  const pointTable = getEffectivePointTable(rankingSystem);

  const races = await fetchRacesForEventGroup(competition._id, eventGroupId);
  const completedRaces = races.filter((race) => race.status === "completed");

  if (!completedRaces.length) {
    return res.status(404).json({
      message: "No completed races found for this event group",
    });
  }

  const entries = buildConsolidatedEventEntries(completedRaces, pointTable);
  const firstRace = completedRaces[0];

  return res.json({
    eventGroupId,
    eventLabel: `${firstRace?.category?.abbreviation || ""} ${
      firstRace?.boatClass?.code || ""
    }`.trim(),
    category: firstRace?.category || null,
    boatClass: firstRace?.boatClass || null,
    raceIds: completedRaces.map((race) => race._id),
    rankingSystem: rankingSystem
      ? {
          _id: rankingSystem._id,
          code: rankingSystem.code,
          names: rankingSystem.names,
        }
      : null,
    entries,
    provisional: true,
  });
});

export const getOfficialEventResults = asyncHandler(async (req, res) => {
  const { competitionId, eventGroupId } = req.params;
  const competition = await resolveCompetitionOrRespond(competitionId, res);
  if (!competition) {
    return;
  }

  const official = await OfficialResult.findOne({
    competition: competition._id,
    eventGroupId,
  }).lean();

  if (!official) {
    return res
      .status(404)
      .json({ message: "No official result published yet" });
  }

  return res.json(official);
});

export const publishOfficialEventResults = asyncHandler(async (req, res) => {
  const { competitionId } = req.params;
  const { eventGroupId, rankingSystemId, force } = req.body || {};

  if (!eventGroupId || !eventGroupId.toString().trim()) {
    return res.status(400).json({ message: "eventGroupId is required" });
  }

  const competition = await resolveCompetitionOrRespond(competitionId, res);
  if (!competition) {
    return;
  }

  const { official, existed } = await publishOfficialEventGroupInternal({
    competition,
    eventGroupId,
    rankingSystemId,
    force,
    userId: req.user?.id,
  });

  return res.status(existed ? 200 : 201).json(official);
});

export const publishAllReadyOfficialResults = asyncHandler(async (req, res) => {
  const { competitionId } = req.params;
  const { rankingSystemId, force = false } = req.body || {};

  const competition = await resolveCompetitionOrRespond(competitionId, res);
  if (!competition) {
    return;
  }

  const races = await CompetitionRace.find({ competition: competition._id })
    .select("category boatClass journeyIndex eventGroupId status")
    .lean();

  const grouped = new Map();
  for (const race of races) {
    const groupId = getEffectiveEventGroupId(race);
    if (!grouped.has(groupId)) {
      grouped.set(groupId, { total: 0, completed: 0 });
    }
    const bucket = grouped.get(groupId);
    bucket.total += 1;
    if (race.status === "completed") {
      bucket.completed += 1;
    }
  }

  const readyGroupIds = Array.from(grouped.entries())
    .filter(
      ([, counts]) => counts.total > 0 && counts.total === counts.completed,
    )
    .map(([groupId]) => groupId);

  const results = [];
  for (const groupId of readyGroupIds) {
    try {
      const { official, existed } = await publishOfficialEventGroupInternal({
        competition,
        eventGroupId: groupId,
        rankingSystemId,
        force,
        userId: req.user?.id,
      });
      results.push({
        eventGroupId: groupId,
        success: true,
        revision: official.revision,
        action: existed ? "updated" : "created",
      });
    } catch (error) {
      results.push({
        eventGroupId: groupId,
        success: false,
        message: error.message,
      });
    }
  }

  return res.json({
    success: true,
    totalGroups: grouped.size,
    readyGroups: readyGroupIds.length,
    publishedGroups: results.filter((item) => item.success).length,
    results,
  });
});

export const unpublishOfficialEventResults = asyncHandler(async (req, res) => {
  const { competitionId, eventGroupId } = req.params;
  const competition = await resolveCompetitionOrRespond(competitionId, res);
  if (!competition) {
    return;
  }

  const deleted = await OfficialResult.findOneAndDelete({
    competition: competition._id,
    eventGroupId,
  }).lean();

  if (!deleted) {
    return res.status(404).json({ message: "Official result not found" });
  }

  return res.json({ success: true, eventGroupId });
});

export const listCompetitionPenalties = asyncHandler(async (req, res) => {
  const { competitionId } = req.params;
  const { journeyIndex } = req.query;
  const competition = await resolveCompetitionOrRespond(competitionId, res);
  if (!competition) {
    return;
  }

  const query = {
    competition: competition._id,
    isActive: true,
  };

  if (
    journeyIndex !== undefined &&
    journeyIndex !== null &&
    journeyIndex !== ""
  ) {
    const parsedJourneyIndex = Number(journeyIndex);
    if (!Number.isFinite(parsedJourneyIndex) || parsedJourneyIndex <= 0) {
      return res
        .status(400)
        .json({ message: "journeyIndex must be a positive number" });
    }
    query.journeyIndex = parsedJourneyIndex;
  }

  const penalties = await CompetitionPenalty.find(query)
    .populate({ path: "club", select: "name code nameAr" })
    .populate({ path: "category", select: "abbreviation titles gender" })
    .sort({ createdAt: -1 })
    .lean();

  return res.json(penalties);
});

export const createCompetitionPenalty = asyncHandler(async (req, res) => {
  const { competitionId } = req.params;
  const competition = await resolveCompetitionOrRespond(competitionId, res);
  if (!competition) {
    return;
  }

  const clubId = toObjectId(req.body?.club);
  const categoryId = toObjectId(req.body?.category);
  const journeyIndexRaw = req.body?.journeyIndex;
  const penaltyPoints = Number(req.body?.penaltyPoints);
  const journeyIndex =
    journeyIndexRaw === undefined ||
    journeyIndexRaw === null ||
    journeyIndexRaw === ""
      ? null
      : Number(journeyIndexRaw);

  if (!clubId) {
    return res.status(400).json({ message: "club is required" });
  }
  if (
    journeyIndexRaw !== undefined &&
    journeyIndexRaw !== null &&
    journeyIndexRaw !== ""
  ) {
    if (!Number.isFinite(journeyIndex) || journeyIndex <= 0) {
      return res
        .status(400)
        .json({ message: "journeyIndex must be a positive number" });
    }
  }
  if (!Number.isFinite(penaltyPoints) || penaltyPoints <= 0) {
    return res
      .status(400)
      .json({ message: "penaltyPoints must be a positive number" });
  }

  const payload = {
    competition: competition._id,
    club: clubId,
    category: categoryId || undefined,
    journeyIndex: Number.isFinite(journeyIndex) ? journeyIndex : undefined,
    penaltyPoints,
    targetType: req.body?.targetType === "official" ? "official" : "club",
    firstName: normaliseString(req.body?.firstName),
    lastName: normaliseString(req.body?.lastName),
    licenseNumber: normaliseString(req.body?.licenseNumber),
    role: normaliseString(req.body?.role),
    observations: normaliseString(req.body?.observations),
    createdBy: req.user?.id,
    updatedBy: req.user?.id,
  };

  const created = await CompetitionPenalty.create(payload);
  const hydrated = await CompetitionPenalty.findById(created._id)
    .populate({ path: "club", select: "name code nameAr" })
    .populate({ path: "category", select: "abbreviation titles gender" })
    .lean();

  return res.status(201).json(hydrated);
});

export const updateCompetitionPenalty = asyncHandler(async (req, res) => {
  const { competitionId, penaltyId } = req.params;
  const competition = await resolveCompetitionOrRespond(competitionId, res);
  if (!competition) {
    return;
  }

  const updates = { updatedBy: req.user?.id };

  if (req.body?.club !== undefined) {
    const clubId = toObjectId(req.body?.club);
    if (!clubId) {
      return res.status(400).json({ message: "club is required" });
    }
    updates.club = clubId;
  }

  if (req.body?.category !== undefined) {
    const categoryId = toObjectId(req.body?.category);
    updates.category = categoryId || undefined;
  }

  if (req.body?.journeyIndex !== undefined) {
    const journeyIndexRaw = req.body?.journeyIndex;
    if (journeyIndexRaw === null || journeyIndexRaw === "") {
      updates.$unset = { ...(updates.$unset || {}), journeyIndex: "" };
    } else {
      const journeyIndex = Number(journeyIndexRaw);
      if (!Number.isFinite(journeyIndex) || journeyIndex <= 0) {
        return res
          .status(400)
          .json({ message: "journeyIndex must be a positive number" });
      }
      updates.journeyIndex = journeyIndex;
    }
  }

  if (req.body?.penaltyPoints !== undefined) {
    const penaltyPoints = Number(req.body?.penaltyPoints);
    if (!Number.isFinite(penaltyPoints) || penaltyPoints <= 0) {
      return res
        .status(400)
        .json({ message: "penaltyPoints must be a positive number" });
    }
    updates.penaltyPoints = penaltyPoints;
  }

  if (req.body?.targetType !== undefined) {
    updates.targetType =
      req.body?.targetType === "official" ? "official" : "club";
  }

  if (req.body?.firstName !== undefined) {
    updates.firstName = normaliseString(req.body?.firstName);
  }
  if (req.body?.lastName !== undefined) {
    updates.lastName = normaliseString(req.body?.lastName);
  }
  if (req.body?.licenseNumber !== undefined) {
    updates.licenseNumber = normaliseString(req.body?.licenseNumber);
  }
  if (req.body?.role !== undefined) {
    updates.role = normaliseString(req.body?.role);
  }
  if (req.body?.observations !== undefined) {
    updates.observations = normaliseString(req.body?.observations);
  }

  const { $unset, ...setUpdates } = updates;
  const updateQuery = Object.keys($unset || {}).length
    ? { $set: setUpdates, $unset }
    : { $set: setUpdates };

  const updated = await CompetitionPenalty.findOneAndUpdate(
    {
      _id: penaltyId,
      competition: competition._id,
      isActive: true,
    },
    updateQuery,
    { new: true },
  )
    .populate({ path: "club", select: "name code nameAr" })
    .populate({ path: "category", select: "abbreviation titles gender" })
    .lean();

  if (!updated) {
    return res.status(404).json({ message: "Penalty not found" });
  }

  return res.json(updated);
});

export const deleteCompetitionPenalty = asyncHandler(async (req, res) => {
  const { competitionId, penaltyId } = req.params;
  const competition = await resolveCompetitionOrRespond(competitionId, res);
  if (!competition) {
    return;
  }

  const deleted = await CompetitionPenalty.findOneAndUpdate(
    {
      _id: penaltyId,
      competition: competition._id,
      isActive: true,
    },
    {
      $set: {
        isActive: false,
        updatedBy: req.user?.id,
      },
    },
    { new: true },
  ).lean();

  if (!deleted) {
    return res.status(404).json({ message: "Penalty not found" });
  }

  return res.json({ success: true, penaltyId: deleted._id });
});

export const computeCompetitionRankings = asyncHandler(async (req, res) => {
  const { competitionId } = req.params;
  const competition = await resolveCompetitionOrRespond(competitionId, res);
  if (!competition) {
    return;
  }

  const races = await CompetitionRace.find({ competition: competition._id })
    .select(
      "category boatClass journeyIndex name order status lanes distanceOverride",
    )
    .lean();

  if (!races.length) {
    return res.json([]);
  }

  const standings = new Map();
  const categoryIds = new Set();
  const boatClassIds = new Set();
  const athleteIds = new Set();

  for (const race of races) {
    const categoryKey = race.category ? race.category.toString() : "";
    const boatClassKey = race.boatClass ? race.boatClass.toString() : "";
    const key = `${categoryKey}::${boatClassKey}`;

    if (!standings.has(key)) {
      standings.set(key, {
        category: race.category,
        boatClass: race.boatClass,
        entries: [],
      });
    }

    const container = standings.get(key);

    for (const lane of race.lanes || []) {
      if (!lane?.athlete) {
        continue;
      }
      const result = lane.result || {};
      const { status = "ok" } = result;
      const isTimed =
        status === "ok" &&
        result.elapsedMs !== undefined &&
        result.elapsedMs !== null;

      container.entries.push({
        raceId: race._id,
        raceName: race.name,
        journeyIndex: race.journeyIndex,
        lane: lane.lane,
        athlete: lane.athlete,
        club: lane.club,
        finishPosition: result.finishPosition,
        elapsedMs: isTimed ? result.elapsedMs : undefined,
        status,
      });

      if (race.category) {
        const categoryKey = race.category.toString();
        if (categoryKey) {
          categoryIds.add(categoryKey);
        }
      }
      if (race.boatClass) {
        const boatClassKey = race.boatClass.toString();
        if (boatClassKey) {
          boatClassIds.add(boatClassKey);
        }
      }
      const athleteKey = lane.athlete.toString();
      if (athleteKey) {
        athleteIds.add(athleteKey);
      }
    }
  }

  const categoryLookup = new Map();
  if (categoryIds.size) {
    const categories = await Category.find({
      _id: {
        $in: [...categoryIds].map((id) => new mongoose.Types.ObjectId(id)),
      },
    })
      .select("abbreviation titles")
      .lean();
    for (const category of categories) {
      categoryLookup.set(category._id.toString(), category);
    }
  }

  const boatClassLookup = new Map();
  if (boatClassIds.size) {
    const boatClasses = await BoatClass.find({
      _id: {
        $in: [...boatClassIds].map((id) => new mongoose.Types.ObjectId(id)),
      },
    })
      .select("code names")
      .lean();
    for (const boatClass of boatClasses) {
      boatClassLookup.set(boatClass._id.toString(), boatClass);
    }
  }

  const athleteLookup = new Map();
  if (athleteIds.size) {
    const athletes = await Athlete.find({
      _id: {
        $in: [...athleteIds].map((id) => new mongoose.Types.ObjectId(id)),
      },
    })
      .select(
        "firstName lastName firstNameAr lastNameAr licenseNumber club memberships",
      )
      .lean();
    for (const athlete of athletes) {
      athleteLookup.set(athlete._id.toString(), athlete);
    }
  }

  const response = [];

  standings.forEach((container) => {
    const sorted = container.entries.sort(bestTimeSorter);
    const topSix = sorted.slice(0, 6);

    const rows = topSix.map((entry, index) => {
      const athlete = athleteLookup.get(entry.athlete.toString());
      const boatClass = container.boatClass
        ? boatClassLookup.get(container.boatClass.toString())
        : null;
      const payload = {
        rank: index + 1,
        athleteId: entry.athlete,
        athleteName: athlete
          ? `${athlete.firstName} ${athlete.lastName}`.trim()
          : undefined,
        athleteNameAr: athlete
          ? `${athlete.firstNameAr} ${athlete.lastNameAr}`.trim()
          : undefined,
        licenseNumber: athlete?.licenseNumber,
        clubId: entry.club,
        elapsedMs: entry.elapsedMs,
        finishPosition: entry.finishPosition,
        status: entry.status,
        raceId: entry.raceId,
        raceName: entry.raceName,
        lane: entry.lane,
        journeyIndex: entry.journeyIndex,
        boatClassCode: boatClass?.code,
        boatClassLabel: boatClass?.names?.en,
      };
      return payload;
    });

    const category = container.category
      ? categoryLookup.get(container.category.toString())
      : null;

    response.push({
      categoryId: container.category,
      categoryCode: category?.abbreviation,
      categoryLabel: category?.titles?.en,
      boatClassId: container.boatClass,
      boatClassCode: container.boatClass
        ? boatClassLookup.get(container.boatClass.toString())?.code
        : undefined,
      boatClassLabel: container.boatClass
        ? boatClassLookup.get(container.boatClass.toString())?.names?.en
        : undefined,
      standings: rows,
    });
  });

  return res.json(response);
});

// Combine Races (Synchronization approach)
export const combineRaces = async (req, res) => {
  try {
    const { competitionId } = req.params;
    const { raceIds } = req.body;

    if (!competitionId || !raceIds || raceIds.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Please select at least two races to combine.",
      });
    }

    const races = await CompetitionRace.find({
      _id: { $in: raceIds },
      competition: competitionId,
    });

    if (races.length !== raceIds.length) {
      return res
        .status(404)
        .json({ success: false, message: "One or more races not found." });
    }

    // Sort races by ID to ensure consistent order
    races.sort((a, b) => a._id.toString().localeCompare(b._id.toString()));

    const baseOrder = Math.min(...races.map((r) => r.order || Infinity));
    // Find the race that originally had the minimum order to use its start time
    let baseTime = new Date();
    for (const r of races) {
      if (r.order === baseOrder && r.startTime) {
        baseTime = r.startTime;
        break;
      }
    }

    for (const race of races) {
      const sourceRaceId = race._id;
      const sourceRaceOrder = race.order || null;

      race.order = baseOrder;
      race.startTime = baseTime;

      // Preserve original lane numbers per race (no renumbering)
      // This allows duplicate lane numbers across races per competition rules
      // Also track which original race each lane came from
      race.lanes.sort((a, b) => a.lane - b.lane);
      race.lanes.forEach((lane) => {
        lane.sourceRaceId = sourceRaceId;
        lane.sourceRaceOrder = sourceRaceOrder;
      });

      await race.save();
    }

    res.status(200).json({
      success: true,
      message: "Races synchronized successfully!",
    });
  } catch (error) {
    console.error("Error in combineRaces:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error combining races." });
  }
};

// Admin: backfill source race metadata on existing races
export const backfillSourceRaceMetadata = asyncHandler(async (req, res) => {
  const { competitionId } = req.params;
  const competition = await resolveCompetitionOrRespond(competitionId, res);
  if (!competition) return;

  const races = await CompetitionRace.find({
    competition: competitionId,
  }).exec();
  let updatedCount = 0;

  for (const race of races) {
    let modified = false;
    const raceId = race._id;
    const raceOrder = race.order || null;

    if (!Array.isArray(race.lanes)) continue;

    for (let i = 0; i < race.lanes.length; i++) {
      const lane = race.lanes[i];
      if (!lane) continue;
      if (!lane.sourceRaceId) {
        lane.sourceRaceId = raceId;
        modified = true;
      }
      if (!lane.sourceRaceOrder && raceOrder != null) {
        lane.sourceRaceOrder = raceOrder;
        modified = true;
      }
    }

    if (modified) {
      await race.save();
      updatedCount++;
    }
  }

  return res.json({ success: true, updatedRaces: updatedCount });
});
