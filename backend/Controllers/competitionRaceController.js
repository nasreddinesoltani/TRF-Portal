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

    const crewNumber = crewNumberMap.get(representative._id.toString());

    return {
      athlete: athleteDoc,
      crew: crewDocs,
      clubId,
      seed: entry.seed,
      notes: entry.notes,
      crewNumber,
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
    const lanes = chunk.map((entry, laneIndex) => ({
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
      crewNumber: entry.crewNumber,
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
      journeyIndex: journeyValue,
      sessionLabel: normaliseString(sessionLabel),
      name: `${prefixLabel} ${index + 1}`, // Keep name as "Heat 1", "Heat 2" etc. relative to this batch
      order: currentOrder,
      startTime: currentStartTime,
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

  return res.json(races);
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

  return res.json(race);
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

const pickLaneAssignment = (lane) => {
  if (!lane) {
    return {
      athlete: undefined,
      crew: [],
      crewNumber: undefined,
      club: undefined,
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
    seed: lane.seed || undefined,
    notes: lane.notes || undefined,
    result:
      lane.result && typeof lane.result === "object"
        ? (lane.result.toObject?.() ?? { ...lane.result })
        : undefined,
  };
};

const assignLaneDetails = (lane, details) => {
  lane.athlete = details.athlete || undefined;
  lane.crew = Array.isArray(details.crew) ? details.crew : [];
  lane.crewNumber = details.crewNumber || undefined;
  lane.club = details.club || undefined;
  lane.seed = details.seed || undefined;
  lane.notes = details.notes || undefined;
  lane.result = details.result || undefined;
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

  const sourcePayload = pickLaneAssignment(sourceLane);
  const targetPayload = pickLaneAssignment(targetLane);

  assignLaneDetails(sourceLane, targetPayload);
  assignLaneDetails(targetLane, sourcePayload);

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
    if (!Number.isInteger(laneNumber) || laneNumber < 1 || laneNumber > 8) {
      throw new Error("Lane numbers must be between 1 and 8");
    }

    const update = {
      lane: laneNumber,
      result: {},
    };

    if (laneResult.status) {
      if (!LANE_RESULT_STATUSES.includes(laneResult.status)) {
        throw new Error("Unsupported lane result status");
      }
      update.result.status = laneResult.status;
    }

    if (laneResult.finishPosition !== undefined) {
      const finishPosition = Number(laneResult.finishPosition);
      if (!Number.isInteger(finishPosition) || finishPosition < 1) {
        throw new Error("Finish position must be a positive integer");
      }
      update.result.finishPosition = finishPosition;
    }

    if (laneResult.elapsedMs !== undefined) {
      const elapsedMs = Number(laneResult.elapsedMs);
      if (Number.isNaN(elapsedMs) || elapsedMs < 0) {
        throw new Error("Elapsed time must be zero or greater");
      }
      update.result.elapsedMs = elapsedMs;
    }

    if (laneResult.notes) {
      update.result.notes = laneResult.notes.toString().trim();
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
