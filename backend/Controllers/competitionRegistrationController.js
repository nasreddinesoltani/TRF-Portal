import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Competition, {
  isInternationalScope,
} from "../Models/competitionModel.js";
import CompetitionEntry, {
  COMPETITION_ENTRY_STATUSES,
} from "../Models/competitionEntryModel.js";
import Athlete from "../Models/athleteModel.js";
import Club from "../Models/clubModel.js";
import Category from "../Models/categoryModel.js";
import BoatClass from "../Models/boatClassModel.js";
import CompetitionRace from "../Models/competitionRaceModel.js";
import { computeCompetitionRegistrationStatus } from "../Services/registrationStatusService.js";

// --- International competition support ---
// Returns "national" or "international" based on competition scope.
// Every existing competition defaults to "national" (scope.type defaults).
const resolveEligibilityMode = (competition) =>
  isInternationalScope(competition?.scope?.type) ? "international" : "national";

// Whether an athlete is considered "foreign" for eligibility purposes.
const isForeignAthlete = (athlete) => Boolean(athlete?.isForeign);

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

const resolveEffectiveRegistrationStatus = (
  competition,
  journeyIndex = null,
) => {
  return computeCompetitionRegistrationStatus(
    competition,
    new Date(),
    journeyIndex,
  );
};

const roleIsAdmin = (role) => role === "admin";
const roleIsJury = (role) => role === "jury_president";
const roleIsClubManager = (role) => role === "club_manager";
const hasManagementPrivileges = (role) => roleIsAdmin(role) || roleIsJury(role);

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

const buildEntryAssignmentKey = (entry) => {
  const categoryId = entry?.category?.toString?.() || null;
  const boatClassId = entry?.boatClass?.toString?.() || null;
  const clubId = entry?.club?.toString?.() || null;
  const crewIds = toSortedUniqueIds(
    Array.isArray(entry?.crew)
      ? entry.crew.map((member) => member?.toString?.()).filter(Boolean)
      : [],
  );
  const athleteId = crewIds.length
    ? null
    : entry?.athlete?.toString?.() || null;

  return buildAssignmentKey({
    categoryId,
    boatClassId,
    clubId,
    athleteId,
    crewIds,
  });
};

const buildLaneAssignmentKey = (race, lane) => {
  const categoryId =
    lane?.category?.toString?.() || race?.category?.toString?.() || null;
  const boatClassId =
    lane?.boatClass?.toString?.() || race?.boatClass?.toString?.() || null;
  const clubId = lane?.club?.toString?.() || null;
  const crewIds = toSortedUniqueIds(
    Array.isArray(lane?.crew)
      ? lane.crew.map((member) => member?.toString?.()).filter(Boolean)
      : [],
  );
  const athleteId = crewIds.length ? null : lane?.athlete?.toString?.() || null;

  return buildAssignmentKey({
    categoryId,
    boatClassId,
    clubId,
    athleteId,
    crewIds,
  });
};

const markRaceLanesWithdrawn = async (competitionId, entry, userId) => {
  const entryKey = buildEntryAssignmentKey(entry);
  if (!entryKey) {
    return { matched: 0, updated: 0 };
  }

  const races = await CompetitionRace.find({ competition: competitionId });
  let matched = 0;
  let updated = 0;

  for (const race of races) {
    let raceChanged = false;
    race.lanes = (race.lanes || []).map((lane) => {
      const laneKey = buildLaneAssignmentKey(race, lane);
      if (laneKey !== entryKey) {
        return lane;
      }

      matched += 1;
      const nextLane = {
        ...lane.toObject?.(),
        ...lane,
        registrationStatus: "withdrawn",
      };

      const existingResult = nextLane.result || {};
      if ((existingResult.status || "ok") === "ok") {
        nextLane.result = {
          ...existingResult,
          status: "withdrawn",
          finishPosition: undefined,
          elapsedMs: undefined,
          notes: existingResult.notes || "Withdrawn",
        };
      }

      raceChanged = true;
      updated += 1;
      return nextLane;
    });

    if (raceChanged) {
      race.markModified("lanes");
      if (userId) {
        race.updatedBy = userId;
      }
      await race.save();
    }
  }

  return { matched, updated };
};

const restoreRaceLanesFromWithdrawn = async (competitionId, entry, userId) => {
  const entryKey = buildEntryAssignmentKey(entry);
  if (!entryKey) {
    return { matched: 0, updated: 0 };
  }

  const races = await CompetitionRace.find({ competition: competitionId });
  let matched = 0;
  let updated = 0;

  for (const race of races) {
    let raceChanged = false;
    race.lanes = (race.lanes || []).map((lane) => {
      const laneKey = buildLaneAssignmentKey(race, lane);
      if (laneKey !== entryKey) {
        return lane;
      }

      matched += 1;
      const nextLane = {
        ...lane.toObject?.(),
        ...lane,
      };
      let laneChanged = false;

      if ((nextLane.registrationStatus || "").toLowerCase() === "withdrawn") {
        nextLane.registrationStatus = null;
        laneChanged = true;
      }

      const existingResult = nextLane.result || {};
      if ((existingResult.status || "").toLowerCase() === "withdrawn") {
        nextLane.result = {
          ...existingResult,
          status: "ok",
          finishPosition: undefined,
          elapsedMs: undefined,
          notes:
            existingResult.notes === "Withdrawn"
              ? undefined
              : existingResult.notes,
        };
        laneChanged = true;
      }

      if (!laneChanged) {
        return lane;
      }

      raceChanged = true;
      updated += 1;
      return nextLane;
    });

    if (raceChanged) {
      race.markModified("lanes");
      if (userId) {
        race.updatedBy = userId;
      }
      await race.save();
    }
  }

  return { matched, updated };
};

const resolveRestoredEntryStatus = (entry) => {
  const statusBeforeWithdraw =
    entry?.metadata?.get?.("statusBeforeWithdraw") ||
    entry?.metadata?.statusBeforeWithdraw;

  if (
    COMPETITION_ENTRY_STATUSES.includes(statusBeforeWithdraw) &&
    statusBeforeWithdraw !== "withdrawn"
  ) {
    return statusBeforeWithdraw;
  }

  return "pending";
};

const serializeCategory = (category) => {
  if (!category) {
    return null;
  }
  return {
    id: category._id?.toString?.() || category.id || null,
    abbreviation: category.abbreviation || null,
    titles: category.titles || {},
    gender: category.gender || null,
    minAge: category.minAge ?? null,
    maxAge: category.maxAge ?? null,
    isPara: category.isPara || false,
  };
};

const serializeBoatClass = (boatClass) => {
  if (!boatClass) {
    return null;
  }
  return {
    id: boatClass._id?.toString?.() || boatClass.id || null,
    code: boatClass.code || null,
    names: boatClass.names || {},
    discipline: boatClass.discipline || null,
    weightClass: boatClass.weightClass || "open",
    seats: boatClass.crewSize ?? boatClass.seats ?? null,
  };
};

const serializeClub = (club) => {
  if (!club) {
    return null;
  }
  return {
    id: club._id?.toString?.() || club.id || null,
    name: club.name || null,
    nameAr: club.nameAr || null,
    code: club.code || null,
    type: club.type || null,
  };
};

const serializeUser = (user) => {
  if (!user) {
    return null;
  }
  return {
    id: user._id?.toString?.() || user.id || null,
    firstName: user.firstName || null,
    lastName: user.lastName || null,
    role: user.role || null,
  };
};

const serializeAthlete = (athlete) => {
  if (!athlete) {
    return null;
  }
  return {
    id: athlete._id?.toString?.() || athlete.id || null,
    firstName: athlete.firstName || null,
    lastName: athlete.lastName || null,
    firstNameAr: athlete.firstNameAr || null,
    lastNameAr: athlete.lastNameAr || null,
    licenseNumber: athlete.licenseNumber || null,
    gender: athlete.gender || null,
    birthDate: athlete.birthDate || null,
    categoryAssignments: Array.isArray(athlete.categoryAssignments)
      ? athlete.categoryAssignments.map((assignment) => ({
          season: assignment?.season ?? null,
          type: assignment?.type || null,
          category: assignment?.category?.toString?.() || null,
          abbreviation: assignment?.abbreviation || null,
          gender: assignment?.gender || null,
          titles: assignment?.titles || {},
          ageOnCutoff: assignment?.ageOnCutoff ?? null,
        }))
      : [],

    memberships: Array.isArray(athlete.memberships)
      ? athlete.memberships.map((m) => ({
          club: serializeClub(m.club) || { id: m.club?.toString?.() || null },
          season: m.season,
          status: m.status,
          membershipType: m.membershipType,
          startDate: m.startDate,
          endDate: m.endDate,
        }))
      : [],
  };
};

const serializeEntry = (entry) => {
  if (!entry) {
    return null;
  }
  return {
    id: entry._id?.toString?.() || entry.id || null,
    status: entry.status,
    notes: entry.notes || null,
    reviewerNotes: entry.reviewerNotes || null,
    submittedAt: entry.submittedAt || entry.createdAt || null,
    reviewedAt: entry.reviewedAt || null,
    club: serializeClub(entry.club),
    athlete: serializeAthlete(entry.athlete),
    crew: Array.isArray(entry.crew) ? entry.crew.map(serializeAthlete) : [],
    category: serializeCategory(entry.category),
    boatClass: serializeBoatClass(entry.boatClass),
    journeyIndex: entry.journeyIndex || null,
    crewNumber: entry.crewNumber ?? null,
    seed: entry.seed || null,
    representingType: entry.representingType || null,
    representingNation: entry.representingNation || null,
    documentType: entry.documentType || null,
    submittedBy: serializeUser(entry.submittedBy),
    reviewedBy: serializeUser(entry.reviewedBy),
  };
};

const fetchCompetition = async (competitionId) => {
  const id = toObjectId(competitionId);
  if (!id) {
    return null;
  }
  return Competition.findById(id)
    .populate({
      path: "allowedCategories",
      select: "abbreviation titles gender minAge maxAge",
    })
    .populate({
      path: "allowedBoatClasses",
      select: "code names type seats crewSize",
    })
    .lean()
    .then((competition) => {
      if (!competition) {
        return competition;
      }

      return {
        ...competition,
        registrationStatus: computeCompetitionRegistrationStatus(competition),
      };
    });
};

const resolveClubContext = async (req, { requireClub = false } = {}) => {
  const role = req.user?.role;
  let targetClubId = null;

  if (roleIsClubManager(role)) {
    targetClubId = toObjectId(req.user?.clubId);
    if (!targetClubId) {
      throw new Error(
        "Club account is missing an associated club. Please contact an administrator.",
      );
    }
  } else {
    const candidate = req.query.clubId || req.body?.clubId || null;
    targetClubId = toObjectId(candidate);
  }

  if (requireClub && !targetClubId) {
    throw new Error("A club context is required for this action");
  }

  let clubDoc = null;
  if (targetClubId) {
    clubDoc = await Club.findById(targetClubId)
      .select("name nameAr code type")
      .lean();
    if (!clubDoc) {
      throw new Error("Club not found");
    }
  }

  return { clubId: targetClubId, clubDoc };
};

const ensureMembershipForClub = (athlete, clubId, competitionSeason) => {
  if (!clubId) {
    return false;
  }
  const clubIdString = clubId.toString();
  if (!Array.isArray(athlete.memberships)) {
    return false;
  }

  const activeClubMemberships = athlete.memberships.filter((membership) => {
    if (!membership) {
      return false;
    }
    const membershipClubId = membership.club?.toString?.();
    if (!membershipClubId || membershipClubId !== clubIdString) {
      return false;
    }
    return membership.status === "active";
  });

  if (!activeClubMemberships.length) {
    return false;
  }

  // Prefer exact season matching when available.
  if (competitionSeason !== undefined && competitionSeason !== null) {
    const seasonValue = Number(competitionSeason);
    const hasSeasonMatch = activeClubMemberships.some((membership) => {
      if (membership.season === undefined || membership.season === null) {
        return true;
      }
      return Number(membership.season) === seasonValue;
    });

    if (hasSeasonMatch) {
      return true;
    }
  }

  // Fallback for legacy/stale season tagging: still allow active same-club membership.
  return true;
};

const findSeasonAssignment = (athlete, season, type = "national") => {
  if (
    !Array.isArray(athlete.categoryAssignments) ||
    !athlete.categoryAssignments.length
  ) {
    return null;
  }

  // Try exact match on type + season first.
  const exact = athlete.categoryAssignments.find(
    (assignment) =>
      assignment &&
      assignment.type === type &&
      Number(assignment.season) === Number(season) &&
      assignment.category,
  );

  if (exact) {
    return exact;
  }

  // Fallback to latest known assignment of the same type.
  const fallback = athlete.categoryAssignments
    .filter(
      (assignment) =>
        assignment && assignment.type === type && assignment.category,
    )
    .sort((a, b) => Number(b.season || 0) - Number(a.season || 0))[0];

  if (fallback) {
    return fallback;
  }

  // For international events, also try the national assignment as a last
  // resort so a Tunisian athlete with only a national assignment can still
  // be entered (strict club/license checks still apply elsewhere).
  if (type === "international") {
    return findSeasonAssignment(athlete, season, "national");
  }

  return null;
};

/**
 * Directional "up-category" eligibility.
 *
 * Rule (per federation logic): a YOUNGER athlete may race in an OLDER category
 * (U15 -> U17 -> U19 -> Senior), but an athlete may NEVER drop DOWN into a
 * younger category (U19 cannot race U17, Senior cannot race U19, etc.).
 *
 * Direction is decided by comparing category age-bands, NOT by the athlete's
 * raw age against a single band (age bands can overlap or omit a maxAge). The
 * requested category must be the SAME or OLDER than the athlete's own assigned
 * category, i.e. requestedCategory.minAge >= assignedCategory.minAge.
 *
 * @param {object} assignedCategoryDoc - the athlete's own season category doc
 *   (with minAge/maxAge). Used to determine direction.
 */
const athleteFitsCategory = (
  assignment,
  categoryDoc,
  allowUpCategory,
  bypassAgeCheck = false,
  assignedCategoryDoc = null,
) => {
  if (!assignment || !categoryDoc) {
    return false;
  }

  const assignmentCategoryId = assignment.category?.toString?.();
  if (
    assignmentCategoryId &&
    assignmentCategoryId === categoryDoc._id?.toString?.()
  ) {
    return true;
  }

  // Registering into a DIFFERENT category is only permitted when either
  // up-category racing is enabled or age checks are bypassed.
  if (!allowUpCategory && !bypassAgeCheck) {
    return false;
  }

  const assignmentGender = normalizeAssignmentGender(assignment.gender);
  const categoryGender = normalizeAssignmentGender(categoryDoc.gender);
  // Mixed categories intentionally accept both men and women. Only enforce a
  // strict gender match for single-gender categories.
  if (
    assignmentGender &&
    categoryGender &&
    categoryGender !== "mixed" &&
    assignmentGender !== categoryGender
  ) {
    return false;
  }

  return isUpOrSameCategory(assignedCategoryDoc, categoryDoc, assignment);
};

/**
 * Returns true when `requestedCategoryDoc` is the SAME age level or OLDER than
 * `assignedCategoryDoc` (i.e. moving up is allowed, moving down is not).
 *
 * Primary comparison uses category minAge (a higher minAge = an older
 * category). When the athlete's assigned category is unknown, we fall back to
 * the athlete's age vs the requested category's maxAge ceiling.
 */
const isUpOrSameCategory = (
  assignedCategoryDoc,
  requestedCategoryDoc,
  assignment,
) => {
  const requestedMin =
    typeof requestedCategoryDoc?.minAge === "number"
      ? requestedCategoryDoc.minAge
      : null;
  const assignedMin =
    typeof assignedCategoryDoc?.minAge === "number"
      ? assignedCategoryDoc.minAge
      : null;

  if (requestedMin !== null && assignedMin !== null) {
    // Requested is older-or-equal -> up/same allowed. Younger -> down, blocked.
    return requestedMin >= assignedMin;
  }

  // Fallback (assigned category unknown): block an athlete who is clearly too
  // OLD for the requested band (older athlete dropping down), otherwise allow.
  const age =
    typeof assignment?.ageOnCutoff === "number" ? assignment.ageOnCutoff : null;
  if (age !== null && typeof requestedCategoryDoc?.maxAge === "number") {
    return age <= requestedCategoryDoc.maxAge;
  }

  return true;
};

const normalizeAssignmentGender = (gender) => {
  if (!gender) {
    return null;
  }
  const value = String(gender).toLowerCase();
  if (value === "female" || value === "women") {
    return "women";
  }
  if (value === "male" || value === "men") {
    return "men";
  }
  return value;
};

const computeAgeOnCutoff = (birthDate, season) => {
  if (!birthDate) {
    return null;
  }
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) {
    return null;
  }

  const seasonYear = Number(season);
  const cutoffYear = Number.isFinite(seasonYear)
    ? seasonYear
    : new Date().getFullYear();
  const cutoff = new Date(cutoffYear, 11, 31);

  let age = cutoff.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    cutoff.getMonth() < birth.getMonth() ||
    (cutoff.getMonth() === birth.getMonth() &&
      cutoff.getDate() < birth.getDate());
  if (beforeBirthday) {
    age -= 1;
  }
  return age >= 0 ? age : null;
};

const buildFallbackAssignment = (
  athlete,
  categoryDoc,
  season,
  type = "national",
) => {
  if (!athlete || !categoryDoc) {
    return null;
  }

  const athleteGender = normalizeAssignmentGender(athlete.gender);
  const categoryGender = normalizeAssignmentGender(categoryDoc.gender);

  // Mixed categories accept both men and women — only reject on a strict
  // gender mismatch for single-gender categories.
  if (
    athleteGender &&
    categoryGender &&
    categoryGender !== "mixed" &&
    athleteGender !== categoryGender
  ) {
    return null;
  }

  const ageOnCutoff = computeAgeOnCutoff(athlete.birthDate, season);

  if (typeof ageOnCutoff !== "number") {
    return null;
  }

  const meetsMin =
    typeof categoryDoc.minAge === "number"
      ? ageOnCutoff >= categoryDoc.minAge
      : true;
  const meetsMax =
    typeof categoryDoc.maxAge === "number"
      ? ageOnCutoff <= categoryDoc.maxAge
      : true;

  if (!meetsMin || !meetsMax) {
    return null;
  }

  return {
    season,
    type,
    category: categoryDoc._id,
    abbreviation: categoryDoc.abbreviation || null,
    titles: categoryDoc.titles || {},
    ageOnCutoff,
    gender: categoryGender || athleteGender || null,
  };
};

const athleteMatchesRequestedCategory = (
  athlete,
  assignment,
  requestedCategoryDoc,
  season,
  allowUpCategory = false,
  bypassAgeCheck = false,
  assignedCategoryDoc = null,
) => {
  if (!requestedCategoryDoc) {
    return true;
  }

  const assignmentCategoryId = assignment?.category?.toString?.();
  if (
    assignmentCategoryId &&
    assignmentCategoryId === requestedCategoryDoc._id?.toString?.()
  ) {
    return true;
  }

  // Registering into a DIFFERENT category than the athlete's own assignment is
  // only permitted when up-category racing is enabled or age is bypassed.
  if (!allowUpCategory && !bypassAgeCheck) {
    return false;
  }

  const athleteGender = normalizeAssignmentGender(athlete?.gender);
  const categoryGender = normalizeAssignmentGender(requestedCategoryDoc.gender);
  // Mixed categories accept both men and women; only single-gender categories
  // enforce a strict gender match.
  if (
    athleteGender &&
    categoryGender &&
    categoryGender !== "mixed" &&
    athleteGender !== categoryGender
  ) {
    return false;
  }

  // Directional up-category rule: requested category must be same-or-older than
  // the athlete's own assigned category (younger athletes may move up; older
  // athletes may never drop down).
  return isUpOrSameCategory(assignedCategoryDoc, requestedCategoryDoc, {
    ...assignment,
    ageOnCutoff:
      typeof assignment?.ageOnCutoff === "number"
        ? assignment.ageOnCutoff
        : computeAgeOnCutoff(athlete?.birthDate, season),
  });
};

const populateEntryDoc = async (entryDoc) =>
  entryDoc.populate([
    {
      path: "club",
      select: "name nameAr code type",
    },
    {
      path: "athlete",
      select:
        "firstName lastName firstNameAr lastNameAr licenseNumber gender birthDate categoryAssignments memberships isForeign nationalityCode representingNation",
      populate: {
        path: "memberships.club",
        select: "name nameAr code type",
      },
    },
    {
      path: "crew",
      select:
        "firstName lastName firstNameAr lastNameAr licenseNumber gender birthDate categoryAssignments memberships isForeign nationalityCode representingNation",
      populate: {
        path: "memberships.club",
        select: "name nameAr code type",
      },
    },
    {
      path: "category",
      select: "abbreviation titles gender minAge maxAge isPara",
    },
    {
      path: "boatClass",
      select: "code names discipline crewSize weightClass",
    },
    {
      path: "submittedBy",
      select: "firstName lastName role",
    },
    {
      path: "reviewedBy",
      select: "firstName lastName role",
    },
  ]);

export const getRegistrationSummary = asyncHandler(async (req, res) => {
  const { competitionId } = req.params;

  const competition = await fetchCompetition(competitionId);
  if (!competition) {
    return res.status(404).json({ message: "Competition not found" });
  }

  const role = req.user?.role;
  if (!roleIsClubManager(role) && !hasManagementPrivileges(role)) {
    return res.status(403).json({
      message: "You are not allowed to view competition registrations",
    });
  }

  let clubContext = null;
  try {
    clubContext = await resolveClubContext(req, {
      requireClub: roleIsClubManager(role),
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const entryQuery = { competition: competition._id };
  if (clubContext.clubId) {
    entryQuery.club = clubContext.clubId;
  }

  // Optional journey filtering
  const requestedJourney = req.query.journeyIndex
    ? Number(req.query.journeyIndex)
    : null;
  if (requestedJourney && Number.isFinite(requestedJourney)) {
    entryQuery.journeyIndex = requestedJourney;
  }

  // Optional representingType filter (international scope)
  if (req.query.representingType) {
    entryQuery.representingType = req.query.representingType;
  }

  const entries = await CompetitionEntry.find(entryQuery)
    .sort({ createdAt: 1 })
    .populate([
      {
        path: "club",
        select: "name nameAr code type",
      },
      {
        path: "athlete",
        select:
          "firstName lastName firstNameAr lastNameAr licenseNumber gender birthDate categoryAssignments memberships isForeign nationalityCode representingNation",
        populate: {
          path: "memberships.club",
          select: "name nameAr code type",
        },
      },
      {
        path: "crew",
        select:
          "firstName lastName firstNameAr lastNameAr licenseNumber gender birthDate categoryAssignments memberships isForeign nationalityCode representingNation",
        populate: {
          path: "memberships.club",
          select: "name nameAr code type",
        },
      },
      {
        path: "category",
        select: "abbreviation titles gender minAge maxAge isPara",
      },
      {
        path: "boatClass",
        select: "code names discipline crewSize weightClass",
      },
      {
        path: "submittedBy",
        select: "firstName lastName role",
      },
      {
        path: "reviewedBy",
        select: "firstName lastName role",
      },
    ])
    .lean();

  const allowedCategories = Array.isArray(competition.allowedCategories)
    ? competition.allowedCategories.map(serializeCategory)
    : [];
  const allowedBoatClasses = Array.isArray(competition.allowedBoatClasses)
    ? competition.allowedBoatClasses.map(serializeBoatClass)
    : [];

  const effectiveStatus = resolveEffectiveRegistrationStatus(
    competition,
    requestedJourney,
  );

  const canSubmit =
    effectiveStatus === "open" &&
    (roleIsClubManager(role)
      ? Boolean(clubContext.clubId)
      : hasManagementPrivileges(role) && Boolean(clubContext.clubId));

  const responsePayload = {
    competition: {
      id: competition._id.toString(),
      code: competition.code,
      names: competition.names,
      season: competition.season,
      discipline: competition.discipline,
      competitionType: competition.competitionType,
      registrationStatus: effectiveStatus,
      registrationWindow: competition.registrationWindow || {},
      allowUpCategory: competition.allowUpCategory,
      bypassAgeCheck: competition.bypassAgeCheck,
      allowedCategories,
      allowedBoatClasses,
      stages: competition.stages || [],
    },
    club: serializeClub(clubContext?.clubDoc),
    entries: entries.map(serializeEntry),
    permissions: {
      canSubmit,
      canWithdraw: effectiveStatus === "open" && roleIsClubManager(role),
      canManageEntries: hasManagementPrivileges(role),
    },
  };

  return res.json(responsePayload);
});

export const listEligibleAthletes = asyncHandler(async (req, res) => {
  const { competitionId } = req.params;
  const { q = "", limit = 50, debugAthlete = "" } = req.query;

  const competition = await fetchCompetition(competitionId);
  if (!competition) {
    return res.status(404).json({ message: "Competition not found" });
  }

  const role = req.user?.role;
  if (!roleIsClubManager(role) && !hasManagementPrivileges(role)) {
    return res
      .status(403)
      .json({ message: "You are not allowed to view eligible athletes" });
  }

  const eligibilityMode = resolveEligibilityMode(competition);
  const isInternational = eligibilityMode === "international";

  let clubContext;
  try {
    clubContext = await resolveClubContext(req, {
      requireClub: !isInternational,
    });
  } catch (error) {
    if (isInternational) {
      clubContext = { clubId: null, clubDoc: null };
    } else {
      return res.status(400).json({ message: error.message });
    }
  }

  const categoryId = toObjectId(req.query.category);
  const searchTerm = q.toString().trim();
  const numericLimit = (() => {
    const parsed = Number(limit);
    return Number.isFinite(parsed) && parsed > 0
      ? Math.min(parsed, 10000)
      : 5000;
  })();

  const allowedCategorySet =
    Array.isArray(competition.allowedCategories) &&
    competition.allowedCategories.length > 0
      ? new Set(
          competition.allowedCategories.map((category) =>
            category?._id?.toString?.(),
          ),
        )
      : null;

  // Accept optional journeyIndex so the "already registered" check is scoped
  const requestedJourney = req.query.journeyIndex
    ? Number(req.query.journeyIndex)
    : null;

  const entryQuery = {
    competition: competition._id,
    status: { $ne: "withdrawn" },
  };

  // When a journey is specified, only consider entries for THAT journey
  // so athletes registered for a different journey still appear as eligible
  if (requestedJourney && Number.isFinite(requestedJourney)) {
    entryQuery.journeyIndex = requestedJourney;
  }

  const existingEntries = await CompetitionEntry.find(entryQuery)
    .select(
      "athlete crew status category journeyIndex representingType representingNation documentType",
    )
    .lean();

  const existingEntryMap = new Map();
  for (const entry of existingEntries) {
    if (entry.athlete) {
      existingEntryMap.set(entry.athlete.toString(), entry);
    }
    if (Array.isArray(entry.crew)) {
      for (const memberId of entry.crew) {
        existingEntryMap.set(memberId.toString(), entry);
      }
    }
  }

  const searchFilters = [];
  if (searchTerm) {
    const regex = new RegExp(searchTerm, "i");
    searchFilters.push({ firstName: regex });
    searchFilters.push({ lastName: regex });
    searchFilters.push({ firstNameAr: regex });
    searchFilters.push({ lastNameAr: regex });
    searchFilters.push({ licenseNumber: regex });
  }

  // Fetch the selected category to check its para status
  let selectedCategoryDoc = null;
  if (categoryId) {
    selectedCategoryDoc = await Category.findById(categoryId)
      .select("abbreviation titles gender minAge maxAge isPara")
      .lean();
  }

  // Build the athlete query based on eligibility mode
  const athleteQuery = isInternational
    ? {
        $or: [
          // Domestic path: athletes with active club membership
          {
            isForeign: { $ne: true },
            licenseStatus: "active",
            memberships: {
              $elemMatch: {
                club: clubContext.clubId,
                status: "active",
                season: competition.season,
              },
            },
          },
          // Foreign path: any foreign athlete (no membership/license required)
          { isForeign: true, nationalityCode: { $exists: true, $ne: "" } },
        ],
      }
    : {
        // National: existing behaviour — club membership required
        licenseStatus: "active",
        memberships: {
          $elemMatch: {
            club: clubContext.clubId,
            status: "active",
            season: competition.season,
          },
        },
      };

  // Filter by para status if a category is selected
  if (selectedCategoryDoc) {
    athleteQuery.isPara =
      selectedCategoryDoc.isPara === true ? true : { $ne: true };
  }

  const athletes = await Athlete.find(athleteQuery)
    .select(
      "firstName lastName firstNameAr lastNameAr licenseNumber gender birthDate categoryAssignments memberships isPara isForeign nationalityCode representingNation federationCode",
    )
    .limit(numericLimit)
    .sort({ lastName: 1, firstName: 1 })
    .lean();

  const requestedCategories = new Set();
  if (categoryId) {
    requestedCategories.add(categoryId.toString());
  }

  athletes.forEach((athlete) => {
    const assignmentType = isInternational ? "international" : "national";
    const assignment = findSeasonAssignment(
      athlete,
      competition.season,
      assignmentType,
    );
    if (assignment?.category) {
      requestedCategories.add(assignment.category.toString());
    }
  });

  const categoryDocs = requestedCategories.size
    ? await Category.find({ _id: { $in: Array.from(requestedCategories) } })
        .select("abbreviation titles gender minAge maxAge")
        .lean()
    : [];

  const categoryMap = new Map(
    categoryDocs.map((category) => [category._id.toString(), category]),
  );

  const eligibleAthletes = athletes
    .map((athlete) => {
      const assignmentType = isInternational ? "international" : "national";
      let assignment = findSeasonAssignment(
        athlete,
        competition.season,
        assignmentType,
      );
      // For international, fall back to national assignment as last resort
      if (!assignment && isInternational) {
        assignment = findSeasonAssignment(
          athlete,
          competition.season,
          "national",
        );
      }
      if (!assignment && selectedCategoryDoc) {
        assignment = buildFallbackAssignment(
          athlete,
          selectedCategoryDoc,
          competition.season,
          assignmentType,
        );
      }
      if (!assignment) {
        return null;
      }

      if (
        allowedCategorySet &&
        !allowedCategorySet.has(assignment.category?.toString?.())
      ) {
        // If a specific category is requested and allowed, keep evaluating
        // via category-fit checks instead of dropping early.
        if (!categoryId || !allowedCategorySet.has(categoryId.toString())) {
          return null;
        }
      }

      if (categoryId) {
        const requestedCategoryDoc = categoryMap.get(categoryId.toString());
        const assignedCategoryDoc = categoryMap.get(
          assignment.category?.toString?.(),
        );
        if (
          !athleteMatchesRequestedCategory(
            athlete,
            assignment,
            requestedCategoryDoc,
            competition.season,
            competition.allowUpCategory,
            competition.bypassAgeCheck,
            assignedCategoryDoc,
          )
        ) {
          return null;
        }
      }

      if (
        !isForeignAthlete(athlete) &&
        !ensureMembershipForClub(
          athlete,
          clubContext.clubId,
          competition.season,
        )
      ) {
        return null;
      }

      const existingEntry = existingEntryMap.get(athlete._id.toString());
      const categoryDoc = categoryMap.get(assignment.category?.toString?.());

      return {
        athlete: serializeAthlete(athlete),
        assignment: assignment
          ? {
              categoryId: assignment.category?.toString?.() || null,
              abbreviation: assignment.abbreviation || null,
              titles: assignment.titles || {},
              ageOnCutoff: assignment.ageOnCutoff ?? null,
              gender: assignment.gender || null,
            }
          : null,
        existingEntry: existingEntry
          ? {
              id: existingEntry._id?.toString?.() || null,
              status: existingEntry.status,
              categoryId: existingEntry.category?.toString?.() || null,
              journeyIndex: existingEntry.journeyIndex || null,
              representingType: existingEntry.representingType || null,
              representingNation: existingEntry.representingNation || null,
              documentType: existingEntry.documentType || null,
            }
          : null,
        category: serializeCategory(categoryDoc),
      };
    })
    .filter(Boolean);

  let debug = null;
  const debugNeedle = String(debugAthlete || "").trim();
  if (debugNeedle) {
    let debugAthleteDoc = null;
    const debugAsObjectId = toObjectId(debugNeedle);

    if (debugAsObjectId) {
      debugAthleteDoc = await Athlete.findById(debugAsObjectId)
        .select(
          "firstName lastName firstNameAr lastNameAr licenseNumber gender birthDate categoryAssignments memberships licenseStatus isPara isForeign nationalityCode representingNation federationCode",
        )
        .populate({
          path: "memberships.club",
          select: "name nameAr code type",
        })
        .lean();
    }

    if (!debugAthleteDoc) {
      debugAthleteDoc = await Athlete.findOne({
        licenseNumber: debugNeedle,
      })
        .select(
          "firstName lastName firstNameAr lastNameAr licenseNumber gender birthDate categoryAssignments memberships licenseStatus isPara isForeign nationalityCode representingNation federationCode",
        )
        .populate({
          path: "memberships.club",
          select: "name nameAr code type",
        })
        .lean();
    }

    if (!debugAthleteDoc) {
      const regex = new RegExp(debugNeedle, "i");
      debugAthleteDoc = await Athlete.findOne({
        $or: [
          { firstName: regex },
          { lastName: regex },
          { firstNameAr: regex },
          { lastNameAr: regex },
        ],
      })
        .select(
          "firstName lastName firstNameAr lastNameAr licenseNumber gender birthDate categoryAssignments memberships licenseStatus isPara",
        )
        .populate({
          path: "memberships.club",
          select: "name nameAr code type",
        })
        .lean();
    }

    if (!debugAthleteDoc) {
      debug = {
        query: debugNeedle,
        found: false,
        reason: "Athlete not found by id/license/name",
      };
    } else {
      const assignment = findSeasonAssignment(
        debugAthleteDoc,
        competition.season,
      );
      const membershipOk = ensureMembershipForClub(
        debugAthleteDoc,
        clubContext.clubId,
        competition.season,
      );

      const paraOk = selectedCategoryDoc
        ? selectedCategoryDoc.isPara === true
          ? debugAthleteDoc.isPara === true
          : debugAthleteDoc.isPara !== true
        : true;

      const searchOk = !searchTerm
        ? true
        : [
            debugAthleteDoc.firstName,
            debugAthleteDoc.lastName,
            debugAthleteDoc.firstNameAr,
            debugAthleteDoc.lastNameAr,
            debugAthleteDoc.licenseNumber,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(searchTerm.toLowerCase());

      const assignmentCategoryId = assignment?.category?.toString?.() || null;
      const allowedCategoryOk = allowedCategorySet
        ? Boolean(
            assignmentCategoryId &&
            allowedCategorySet.has(String(assignmentCategoryId)),
          )
        : true;

      const requestedCategoryOk = categoryId
        ? assignmentCategoryId === categoryId.toString() ||
          athleteFitsCategory(
            assignment,
            selectedCategoryDoc || categoryMap.get(categoryId.toString()),
            competition.allowUpCategory,
            competition.bypassAgeCheck,
            categoryMap.get(assignment?.category?.toString?.()),
          )
        : true;

      const licenseOk = debugAthleteDoc.licenseStatus === "active";
      const appearsInList = eligibleAthletes.some(
        (entry) =>
          entry?.athlete?.id &&
          entry.athlete.id.toString() === debugAthleteDoc._id.toString(),
      );

      const reasons = [];
      if (!licenseOk) reasons.push("license_not_active");
      if (!assignment) reasons.push("missing_season_category_assignment");
      if (!allowedCategoryOk)
        reasons.push("assignment_not_in_allowed_categories");
      if (!requestedCategoryOk)
        reasons.push("not_eligible_for_requested_category");
      if (!membershipOk) reasons.push("no_active_membership_for_club_season");
      if (!paraOk) reasons.push("para_status_mismatch");
      if (!searchOk) reasons.push("does_not_match_search_query");

      debug = {
        query: debugNeedle,
        found: true,
        appearsInList,
        athlete: {
          id: debugAthleteDoc._id?.toString?.(),
          firstName: debugAthleteDoc.firstName,
          lastName: debugAthleteDoc.lastName,
          licenseNumber: debugAthleteDoc.licenseNumber,
          licenseStatus: debugAthleteDoc.licenseStatus,
          isPara: debugAthleteDoc.isPara === true,
        },
        checks: {
          licenseOk,
          membershipOk,
          paraOk,
          searchOk,
          assignmentFound: Boolean(assignment),
          allowedCategoryOk,
          requestedCategoryOk,
        },
        assignment: assignment
          ? {
              season: assignment.season,
              categoryId: assignmentCategoryId,
              abbreviation: assignment.abbreviation,
              ageOnCutoff: assignment.ageOnCutoff,
              gender: assignment.gender,
            }
          : null,
        reasons,
      };
    }
  }

  return res.json({
    competition: {
      id: competition._id.toString(),
      season: competition.season,
    },
    club: serializeClub(clubContext.clubDoc),
    athletes: eligibleAthletes,
    debug,
  });
});

export const createCompetitionEntries = asyncHandler(async (req, res) => {
  const { competitionId } = req.params;
  const { entries } = req.body;

  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ message: "At least one entry is required" });
  }

  const competition = await Competition.findById(competitionId)
    .populate("allowedCategories")
    .lean();

  if (!competition) {
    return res.status(404).json({ message: "Competition not found" });
  }

  const role = req.user?.role;
  if (!roleIsClubManager(role) && !hasManagementPrivileges(role)) {
    return res
      .status(403)
      .json({ message: "You are not allowed to register athletes" });
  }

  const eligibilityMode = resolveEligibilityMode(competition);
  const isInternational = eligibilityMode === "international";

  // Admins and jury presidents can bypass registration window checks
  // Determine requested journey indexes from payload so we validate per-journey
  const requestedJourneyIndexes = Array.isArray(entries)
    ? Array.from(
        new Set(
          entries
            .map((e) => (e && e.journeyIndex ? Number(e.journeyIndex) : null))
            .filter((v) => Number.isFinite(v)),
        ),
      )
    : [];

  if (!requestedJourneyIndexes.length) {
    // No specific journey requested: use competition-level effective status
    const effectiveStatus = resolveEffectiveRegistrationStatus(competition);
    if (effectiveStatus !== "open" && !hasManagementPrivileges(role)) {
      return res
        .status(400)
        .json({ message: "Registration is not open for this competition" });
    }
  } else if (!hasManagementPrivileges(role)) {
    // Validate each requested journey is open
    for (const jIndex of requestedJourneyIndexes) {
      const status = computeCompetitionRegistrationStatus(
        competition,
        new Date(),
        jIndex,
      );
      if (status !== "open") {
        return res.status(400).json({
          message: `Registration for journey ${jIndex} is not open`,
        });
      }
    }
  }

  let clubContext;
  try {
    clubContext = await resolveClubContext(req, {
      requireClub: !isInternational,
    });
  } catch (error) {
    if (isInternational) {
      clubContext = { clubId: null, clubDoc: null };
    } else {
      return res.status(400).json({ message: error.message });
    }
  }

  // Parse entries and normalize to crewIds
  const parsedEntries = entries.map((entry) => {
    const athleteId = toObjectId(entry.athleteId || entry.athlete);
    const crewIds = Array.isArray(entry.crewIds)
      ? entry.crewIds.map(toObjectId).filter(Boolean)
      : [];

    // If athleteId is provided but no crewIds, treat as single crew
    if (athleteId && crewIds.length === 0) {
      crewIds.push(athleteId);
    }

    return {
      crewIds,
      categoryId: toObjectId(entry.categoryId || entry.category),
      boatClassId: toObjectId(entry.boatClassId || entry.boatClass),
      journeyIndex: entry.journeyIndex ? Number(entry.journeyIndex) : null,
      seed: entry.seed ? Number(entry.seed) : null,
      notes:
        typeof entry.notes === "string" && entry.notes.trim().length
          ? entry.notes.trim()
          : undefined,
      representingType: entry.representingType || undefined,
      representingNation: entry.representingNation || undefined,
      documentType: entry.documentType || undefined,
    };
  });

  // Collect all IDs for bulk fetching
  const allAthleteIds = new Set();
  const allCategoryIds = new Set();
  const allBoatClassIds = new Set();

  for (const entry of parsedEntries) {
    if (entry.crewIds.length === 0) {
      return res
        .status(400)
        .json({ message: "Each entry must include at least one athlete" });
    }
    if (!entry.categoryId) {
      return res
        .status(400)
        .json({ message: "Each entry must include a category" });
    }
    entry.crewIds.forEach((id) => allAthleteIds.add(id.toString()));
    allCategoryIds.add(entry.categoryId.toString());
    if (entry.boatClassId) {
      allBoatClassIds.add(entry.boatClassId.toString());
    }
  }

  const athletes = await Athlete.find({
    _id: { $in: Array.from(allAthleteIds) },
  })
    .select(
      "firstName lastName licenseNumber gender birthDate categoryAssignments memberships licenseStatus documentsStatus documentsIssues",
    )
    .lean();

  const categories = await Category.find({
    _id: { $in: Array.from(allCategoryIds) },
  })
    .select("abbreviation titles gender minAge maxAge")
    .lean();

  const boatClasses = await BoatClass.find({
    _id: { $in: Array.from(allBoatClassIds) },
  })
    .select("code names crewSize")
    .lean();

  const athleteMap = new Map(athletes.map((a) => [a._id.toString(), a]));
  const categoryMap = new Map(categories.map((c) => [c._id.toString(), c]));
  const boatClassMap = new Map(boatClasses.map((b) => [b._id.toString(), b]));

  // Check for existing entries for ANY of the athletes
  const existingEntries = await CompetitionEntry.find({
    competition: competition._id,
    $or: [
      { athlete: { $in: Array.from(allAthleteIds) } },
      { crew: { $in: Array.from(allAthleteIds) } },
    ],
    status: { $ne: "withdrawn" },
  }).select("athlete crew status category boatClass journeyIndex");

  // To check busy athletes, we now factor in journeyIndex
  // Map: "athleteId_journeyIndex" -> true
  const busyAthleteJourneys = new Set();
  existingEntries.forEach((entry) => {
    const jIndex = entry.journeyIndex || "all";
    if (entry.athlete)
      busyAthleteJourneys.add(`${entry.athlete.toString()}_${jIndex}`);
    if (Array.isArray(entry.crew)) {
      entry.crew.forEach((id) =>
        busyAthleteJourneys.add(`${id.toString()}_${jIndex}`),
      );
    }
  });

  const allowedCategorySet =
    Array.isArray(competition.allowedCategories) &&
    competition.allowedCategories.length > 0
      ? new Set(
          competition.allowedCategories.map((category) =>
            category?._id?.toString?.(),
          ),
        )
      : null;

  // Fetch all active entries (pending + approved only — not withdrawn/rejected)
  // to determine crew slot continuity across journeys.
  const existingActiveEntries = await CompetitionEntry.find({
    competition: competition._id,
    club: clubContext.clubId,
    category: { $in: Array.from(allCategoryIds) },
    status: { $nin: ["withdrawn", "rejected"] },
  }).select("category boatClass crewNumber crew athlete");

  // Build a SLOT MAP per (catId_boatClassId):
  //   slotMap[key] = Map<crewNumber, Set<athleteId>>
  // A "slot" is a persistent crew identity. An incoming crew REUSES a slot when it
  // shares at least one athlete with that slot's current crew set. This is the
  // mechanism that makes EPT 1 persist across journeys even when athletes rotate.
  const slotMap = new Map();

  const getCounterKey = (catId, boatClassId) => {
    return `${catId}_${boatClassId || "null"}`;
  };

  for (const entry of existingActiveEntries) {
    const crewArr =
      Array.isArray(entry.crew) && entry.crew.length > 1 ? entry.crew : null;
    if (!crewArr) continue; // skip singles and invalid entries
    const key = getCounterKey(entry.category, entry.boatClass);
    if (!slotMap.has(key)) slotMap.set(key, new Map());
    const slots = slotMap.get(key);
    const slotNum = entry.crewNumber || 0;
    const athleteIds = new Set(crewArr.map((id) => id.toString()));
    if (slots.has(slotNum)) {
      // Union athlete sets across journeys for the same slot
      for (const id of athleteIds) slots.get(slotNum).add(id);
    } else {
      slots.set(slotNum, athleteIds);
    }
  }

  const creations = [];

  for (const entry of parsedEntries) {
    if (entry.journeyIndex && Array.isArray(competition.stages)) {
      const stage = competition.stages.find(
        (st, idx) => (st.order ?? idx + 1) === entry.journeyIndex,
      );
      if (stage) {
        const now = new Date();
        if (
          stage.registrationOpenDate &&
          now < new Date(stage.registrationOpenDate)
        ) {
          if (!hasManagementPrivileges(role)) {
            return res.status(400).json({
              message: `Registration for ${
                stage.name || `Journey ${entry.journeyIndex}`
              } has not opened yet`,
            });
          }
        }
        if (
          stage.registrationCloseDate &&
          now > new Date(stage.registrationCloseDate)
        ) {
          if (!hasManagementPrivileges(role)) {
            return res.status(400).json({
              message: `Registration for ${
                stage.name || `Journey ${entry.journeyIndex}`
              } is closed`,
            });
          }
        }
      }
    }

    const categoryDoc = categoryMap.get(entry.categoryId.toString());
    if (!categoryDoc) {
      return res.status(400).json({ message: "Category not found" });
    }

    if (
      allowedCategorySet &&
      !allowedCategorySet.has(categoryDoc._id.toString())
    ) {
      return res
        .status(400)
        .json({ message: "Category is not enabled for this competition" });
    }

    // Validate Boat Class and Crew Size
    if (entry.boatClassId) {
      const boatClass = boatClassMap.get(entry.boatClassId.toString());
      if (!boatClass) {
        return res.status(400).json({ message: "Boat class not found" });
      }
      if (entry.crewIds.length !== boatClass.crewSize) {
        return res.status(400).json({
          message: `Boat class ${boatClass.code} requires ${boatClass.crewSize} athletes, but ${entry.crewIds.length} were provided`,
        });
      }
    }

    // Validate each athlete in the crew
    for (const athleteId of entry.crewIds) {
      const idStr = athleteId.toString();
      const athlete = athleteMap.get(idStr);

      if (!athlete) {
        return res.status(400).json({ message: `Athlete not found: ${idStr}` });
      }

      const allowMultiple =
        competition.discipline === "beach" ||
        competition.discipline === "coastal" ||
        competition.competitionType === "championship" ||
        req.body.bypassMultipleEntries === true;

      const jKey = `${idStr}_${entry.journeyIndex || "all"}`;
      if (busyAthleteJourneys.has(jKey)) {
        if (!allowMultiple) {
          const athleteName = athlete
            ? `${athlete.firstName || "Athlete"} ${athlete.lastName || idStr}`
            : `Athlete ${idStr}`;

          return res.status(400).json({
            message: `${athleteName} is already registered for this competition/stage`,
          });
        }

        // If multiple are allowed, check for EXACT duplicate (same athlete, same category, same boat class, same journey)
        const isDuplicateEvent = existingEntries.some((e) => {
          const isSameAthlete =
            e.athlete?.toString() === idStr ||
            (Array.isArray(e.crew) &&
              e.crew.some((m) => m.toString() === idStr));
          const isSameCategory =
            e.category?.toString() === entry.categoryId?.toString();
          const isSameBoatClass =
            e.boatClass?.toString() === entry.boatClassId?.toString();
          const isSameJourney = (e.journeyIndex || null) === entry.journeyIndex;

          return (
            isSameAthlete && isSameCategory && isSameBoatClass && isSameJourney
          );
        });

        if (isDuplicateEvent) {
          const athleteName = athlete
            ? `${athlete.firstName || "Athlete"} ${athlete.lastName || idStr}`
            : `Athlete ${idStr}`;
          return res.status(400).json({
            message: `${athleteName} is already registered for this exact event (Category/Boat/Journey)`,
          });
        }
      }

      if (
        !isForeignAthlete(athlete) &&
        !(isInternational && !clubContext.clubId) &&
        !ensureMembershipForClub(
          athlete,
          clubContext.clubId,
          competition.season,
        )
      ) {
        return res.status(400).json({
          message: `${athlete.firstName} ${athlete.lastName} does not have an active membership with this club for the season`,
        });
      }

      // Validate license status — skip for foreign athletes and international entries without club context
      if (
        !isForeignAthlete(athlete) &&
        !(isInternational && !clubContext.clubId)
      ) {
        const currentYear = new Date().getFullYear();
        const isHistoricalSeason =
          competition.season && competition.season < currentYear;

        if (!isHistoricalSeason && athlete.licenseStatus !== "active") {
          const issuesList =
            Array.isArray(athlete.documentsIssues) &&
            athlete.documentsIssues.length > 0
              ? ` (${athlete.documentsIssues.join(", ")})`
              : "";
          return res.status(400).json({
            message: `${athlete.firstName} ${athlete.lastName} does not have an active license - documents incomplete${issuesList}`,
          });
        }
      }

      const assignmentType = isInternational ? "international" : "national";
      let assignment = findSeasonAssignment(
        athlete,
        competition.season,
        assignmentType,
      );
      if (!assignment && isInternational) {
        assignment = findSeasonAssignment(
          athlete,
          competition.season,
          "national",
        );
      }
      if (!assignment && categoryDoc) {
        assignment = buildFallbackAssignment(
          athlete,
          categoryDoc,
          competition.season,
          assignmentType,
        );
      }
      if (!assignment) {
        return res.status(400).json({
          message: `${athlete.firstName} ${athlete.lastName} does not have a category assignment for the competition season`,
        });
      }

      // Resolve the athlete's OWN assigned category doc so we can enforce the
      // directional up-category rule (younger may go up, older may not go down).
      let assignedCategoryDoc = categoryMap.get(
        assignment.category?.toString?.(),
      );
      if (!assignedCategoryDoc && assignment.category) {
        assignedCategoryDoc = await Category.findById(assignment.category)
          .select("abbreviation titles gender minAge maxAge")
          .lean();
      }

      if (
        !req.body.bypassEligibility &&
        !athleteFitsCategory(
          assignment,
          categoryDoc,
          competition.allowUpCategory,
          competition.bypassAgeCheck,
          assignedCategoryDoc,
        )
      ) {
        return res.status(400).json({
          message: `${athlete.firstName} ${athlete.lastName} is not eligible for ${categoryDoc.abbreviation}`,
        });
      }
    }

    // Mixed events with more than one seat require a genuine mix — at least one
    // man and one woman in the crew (e.g. a mixed double must be 1M + 1W).
    // A crew is treated as "mixed" when either the category gender is mixed OR
    // the boat class itself is a mixed boat (e.g. CMix2x), so two same-gender
    // athletes can never be entered in a mixed double even under a men's or
    // women's category.
    const boatClassForMixCheck = entry.boatClassId
      ? boatClassMap.get(entry.boatClassId.toString())
      : null;
    const isMixedBoatClass =
      /mix/i.test(boatClassForMixCheck?.code || "") ||
      /mixed/i.test(boatClassForMixCheck?.names?.en || "");
    const isMixedCategory =
      normalizeAssignmentGender(categoryDoc.gender) === "mixed";

    if (
      !req.body.bypassEligibility &&
      (isMixedCategory || isMixedBoatClass) &&
      entry.crewIds.length > 1
    ) {
      const crewGenders = entry.crewIds.map((id) =>
        normalizeAssignmentGender(athleteMap.get(id.toString())?.gender),
      );
      const hasMan = crewGenders.includes("men");
      const hasWoman = crewGenders.includes("women");
      if (!hasMan || !hasWoman) {
        const label =
          boatClassForMixCheck?.code ||
          categoryDoc.abbreviation ||
          "mixed event";
        return res.status(400).json({
          message: `A mixed crew for ${label} must include both a man and a woman`,
        });
      }
    }

    const isSingle = entry.crewIds.length === 1;
    const isCrewBoat = !isSingle;
    let nextNumber;

    if (isCrewBoat) {
      // Slot-reuse: find the best-matching existing slot by athlete overlap.
      // If the incoming crew shares at least one athlete with an existing slot,
      // it CONTINUES that slot (same crewNumber). Otherwise it gets a new number.
      const counterKey = getCounterKey(entry.categoryId, entry.boatClassId);
      if (!slotMap.has(counterKey)) slotMap.set(counterKey, new Map());
      const slots = slotMap.get(counterKey);

      const newCrewSet = new Set(entry.crewIds.map((id) => id.toString()));
      let bestSlot = null;
      let bestOverlap = 0;

      for (const [slotNum, slotAthletes] of slots) {
        const overlap = [...newCrewSet].filter((id) =>
          slotAthletes.has(id),
        ).length;
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestSlot = slotNum;
        }
      }

      if (bestSlot !== null && bestOverlap > 0) {
        // Continue existing slot — inherit its number and expand its athlete set.
        nextNumber = bestSlot;
        for (const id of newCrewSet) slots.get(bestSlot).add(id);
      } else {
        // New slot — assign the smallest positive integer not yet taken by any slot.
        const usedNums = new Set(slots.keys());
        nextNumber = 1;
        while (usedNums.has(nextNumber)) nextNumber++;
        slots.set(nextNumber, newCrewSet);
      }
    }

    const creation = new CompetitionEntry({
      competition: competition._id,
      club: clubContext.clubId,
      athlete: isSingle ? entry.crewIds[0] : undefined,
      crew: entry.crewIds,
      category: entry.categoryId,
      boatClass: entry.boatClassId || undefined,
      journeyIndex: entry.journeyIndex || undefined,
      crewNumber: isCrewBoat ? nextNumber : undefined,
      seed: entry.seed || null,
      status: "pending",
      notes: entry.notes,
      submittedBy: req.user.id,
      submittedAt: new Date(),
      representingType: entry.representingType,
      representingNation: entry.representingNation,
      documentType: entry.documentType,
    });
    creations.push(creation.save());

    // Mark these athletes as busy for subsequent entries in the same batch
    entry.crewIds.forEach((id) =>
      busyAthleteJourneys.add(
        `${id.toString()}_${entry.journeyIndex || "all"}`,
      ),
    );
  }

  const savedEntries = await Promise.all(creations);

  await Promise.all(savedEntries.map((entry) => populateEntryDoc(entry)));

  return res.status(201).json({
    entries: savedEntries.map(serializeEntry),
  });
});

export const updateEntryStatus = asyncHandler(async (req, res) => {
  const { competitionId, entryId } = req.params;
  const { status, reviewerNotes } = req.body;

  const competition = await Competition.findById(competitionId).lean();
  if (!competition) {
    return res.status(404).json({ message: "Competition not found" });
  }

  if (!hasManagementPrivileges(req.user?.role)) {
    return res
      .status(403)
      .json({ message: "Only administrators may update entry status" });
  }

  const normalisedStatus = status?.toString?.().toLowerCase();
  if (!COMPETITION_ENTRY_STATUSES.includes(normalisedStatus)) {
    return res.status(400).json({ message: "Unsupported entry status" });
  }

  const entry = await CompetitionEntry.findOne({
    _id: toObjectId(entryId),
    competition: competition._id,
  });

  if (!entry) {
    return res.status(404).json({ message: "Entry not found" });
  }

  entry.status = normalisedStatus;
  entry.reviewedBy = req.user.id;
  entry.reviewedAt = new Date();
  entry.reviewerNotes = reviewerNotes || undefined;

  await entry.save();
  await populateEntryDoc(entry);

  return res.json({ entry: serializeEntry(entry) });
});

export const withdrawEntry = asyncHandler(async (req, res) => {
  const { competitionId, entryId } = req.params;

  const competition = await Competition.findById(competitionId).lean();
  if (!competition) {
    return res.status(404).json({ message: "Competition not found" });
  }

  const entry = await CompetitionEntry.findOne({
    _id: toObjectId(entryId),
    competition: competition._id,
  });

  if (!entry) {
    return res.status(404).json({ message: "Entry not found" });
  }

  const role = req.user?.role;
  const isClubManager = roleIsClubManager(role);
  const isOfficial = hasManagementPrivileges(role);

  if (isClubManager) {
    if (entry.club?.toString() !== req.user?.clubId) {
      return res
        .status(403)
        .json({ message: "You may only withdraw your club's entries" });
    }
  } else if (!isOfficial) {
    return res
      .status(403)
      .json({ message: "You are not allowed to withdraw this entry" });
  }

  // Check deadline
  const closeAt = competition.registrationWindow?.closeAt
    ? new Date(competition.registrationWindow.closeAt)
    : null;
  const now = new Date();
  const isBeforeDeadline = closeAt && now <= closeAt;

  // If before deadline, HARD DELETE
  if (isBeforeDeadline) {
    const laneSync = await markRaceLanesWithdrawn(
      competition._id,
      entry,
      req.user?.id,
    );
    await CompetitionEntry.deleteOne({ _id: entry._id });
    return res.json({
      message: "Entry deleted",
      deleted: true,
      entryId,
      raceLaneSync: laneSync,
    });
  }

  // If after deadline, SOFT WITHDRAW
  if (entry.status === "withdrawn") {
    return res.json({ entry: serializeEntry(entry) });
  }

  const previousStatus =
    COMPETITION_ENTRY_STATUSES.includes(entry.status) &&
    entry.status !== "withdrawn"
      ? entry.status
      : "pending";
  if (!entry.metadata || typeof entry.metadata.set !== "function") {
    entry.metadata = new Map();
  }
  entry.metadata.set("statusBeforeWithdraw", previousStatus);

  entry.status = "withdrawn";
  entry.reviewedBy = req.user.id;
  entry.reviewedAt = new Date();
  entry.reviewerNotes = isClubManager
    ? "Withdrawn by club (post-deadline)"
    : "Withdrawn by official";

  await entry.save();
  const laneSync = await markRaceLanesWithdrawn(
    competition._id,
    entry,
    req.user?.id,
  );
  await populateEntryDoc(entry);

  return res.json({ entry: serializeEntry(entry), raceLaneSync: laneSync });
});

export const unwithdrawEntry = asyncHandler(async (req, res) => {
  const { competitionId, entryId } = req.params;

  const competition = await Competition.findById(competitionId).lean();
  if (!competition) {
    return res.status(404).json({ message: "Competition not found" });
  }

  const entry = await CompetitionEntry.findOne({
    _id: toObjectId(entryId),
    competition: competition._id,
  });

  if (!entry) {
    return res.status(404).json({ message: "Entry not found" });
  }

  const role = req.user?.role;
  const isClubManager = roleIsClubManager(role);
  const isOfficial = hasManagementPrivileges(role);

  if (isClubManager) {
    if (entry.club?.toString() !== req.user?.clubId) {
      return res
        .status(403)
        .json({ message: "You may only restore your club's entries" });
    }
  } else if (!isOfficial) {
    return res
      .status(403)
      .json({ message: "You are not allowed to restore this entry" });
  }

  if (entry.status !== "withdrawn") {
    await populateEntryDoc(entry);
    return res.json({ entry: serializeEntry(entry) });
  }

  const restoredStatus = resolveRestoredEntryStatus(entry);

  entry.status = restoredStatus;
  entry.reviewedBy = req.user.id;
  entry.reviewedAt = new Date();
  entry.reviewerNotes = isClubManager
    ? "Withdrawal reverted by club"
    : "Withdrawal reverted by official";
  if (entry.metadata?.delete) {
    entry.metadata.delete("statusBeforeWithdraw");
  }

  await entry.save();
  const laneSync = await restoreRaceLanesFromWithdrawn(
    competition._id,
    entry,
    req.user?.id,
  );
  await populateEntryDoc(entry);

  return res.json({ entry: serializeEntry(entry), raceLaneSync: laneSync });
});

export const restoreEntryFromRaceLane = asyncHandler(async (req, res) => {
  const { competitionId } = req.params;
  const { raceId, lane } = req.body || {};

  const competition = await Competition.findById(competitionId).lean();
  if (!competition) {
    return res.status(404).json({ message: "Competition not found" });
  }

  const role = req.user?.role;
  const isClubManager = roleIsClubManager(role);
  const isOfficial = hasManagementPrivileges(role);
  if (!isClubManager && !isOfficial) {
    return res
      .status(403)
      .json({ message: "You are not allowed to restore lane entries" });
  }

  const raceObjectId = toObjectId(raceId);
  if (!raceObjectId) {
    return res.status(400).json({ message: "Invalid race identifier" });
  }

  const laneNumber = Number(lane);
  if (!Number.isInteger(laneNumber) || laneNumber < 1) {
    return res.status(400).json({ message: "Invalid lane number" });
  }

  const race = await CompetitionRace.findOne({
    _id: raceObjectId,
    competition: competition._id,
  });

  if (!race) {
    return res.status(404).json({ message: "Race not found" });
  }

  const raceLane = (race.lanes || []).find(
    (currentLane) => Number(currentLane?.lane) === laneNumber,
  );
  if (!raceLane) {
    return res.status(404).json({ message: "Lane not found" });
  }

  const crewIds = toSortedUniqueIds(
    Array.isArray(raceLane?.crew)
      ? raceLane.crew.map((member) => member?.toString?.()).filter(Boolean)
      : [],
  );
  const athleteId = crewIds.length
    ? null
    : raceLane?.athlete?.toString?.() || null;

  if (!athleteId && crewIds.length === 0) {
    return res.status(400).json({ message: "Lane has no assigned competitor" });
  }

  const clubId = raceLane?.club?.toString?.() || null;
  const categoryId =
    raceLane?.category?.toString?.() || race?.category?.toString?.() || null;
  const boatClassId =
    raceLane?.boatClass?.toString?.() || race?.boatClass?.toString?.() || null;

  if (!clubId || !categoryId) {
    return res
      .status(400)
      .json({ message: "Lane is missing required event context" });
  }

  if (isClubManager && clubId !== req.user?.clubId) {
    return res
      .status(403)
      .json({ message: "You may only restore lanes for your club" });
  }

  const laneAssignmentKey = buildAssignmentKey({
    categoryId,
    boatClassId,
    clubId,
    athleteId,
    crewIds,
  });
  if (!laneAssignmentKey) {
    return res.status(400).json({ message: "Could not derive assignment key" });
  }

  const candidateEntries = await CompetitionEntry.find({
    competition: competition._id,
    club: clubId,
    category: categoryId,
    ...(boatClassId
      ? { boatClass: boatClassId }
      : { boatClass: { $in: [null, undefined] } }),
  });

  let matchingEntry = candidateEntries.find(
    (entry) => buildEntryAssignmentKey(entry) === laneAssignmentKey,
  );

  let created = false;
  if (!matchingEntry) {
    matchingEntry = new CompetitionEntry({
      competition: competition._id,
      club: clubId,
      athlete: athleteId || undefined,
      crew: crewIds,
      category: categoryId,
      boatClass: boatClassId || undefined,
      journeyIndex: race?.journeyIndex || undefined,
      crewNumber: raceLane?.crewNumber || undefined,
      seed: raceLane?.seed || null,
      notes: raceLane?.notes || "Restored from race lane",
      status: "pending",
      submittedBy: req.user?.id,
      submittedAt: new Date(),
      reviewerNotes: isClubManager
        ? "Restored from race lane by club"
        : "Restored from race lane by official",
      reviewedBy: req.user?.id,
      reviewedAt: new Date(),
    });
    await matchingEntry.save();
    created = true;
  } else if (matchingEntry.status === "withdrawn") {
    matchingEntry.status = resolveRestoredEntryStatus(matchingEntry);
    matchingEntry.reviewerNotes = isClubManager
      ? "Withdrawal reverted by club"
      : "Withdrawal reverted by official";
    matchingEntry.reviewedBy = req.user?.id;
    matchingEntry.reviewedAt = new Date();
    if (matchingEntry.metadata?.delete) {
      matchingEntry.metadata.delete("statusBeforeWithdraw");
    }
    await matchingEntry.save();
  }

  const laneSync = await restoreRaceLanesFromWithdrawn(
    competition._id,
    matchingEntry,
    req.user?.id,
  );
  await populateEntryDoc(matchingEntry);

  return res.json({
    entry: serializeEntry(matchingEntry),
    created,
    raceLaneSync: laneSync,
  });
});

export const updateEntry = asyncHandler(async (req, res) => {
  const { competitionId, entryId } = req.params;
  const {
    seed,
    notes,
    crewNumber,
    representingType,
    representingNation,
    documentType,
  } = req.body;

  const role = req.user?.role;
  if (!hasManagementPrivileges(role)) {
    return res
      .status(403)
      .json({ message: "Not authorized to update entries" });
  }

  const competition = await Competition.findById(competitionId).lean();
  if (!competition) {
    return res.status(404).json({ message: "Competition not found" });
  }

  const entry = await CompetitionEntry.findOne({
    _id: toObjectId(entryId),
    competition: competition._id,
  });

  if (!entry) {
    return res.status(404).json({ message: "Entry not found" });
  }

  let updated = false;

  if (seed !== undefined) {
    entry.seed = seed === "" || seed === null ? null : Number(seed);
    updated = true;
  }

  if (notes !== undefined) {
    entry.notes = notes;
    updated = true;
  }

  if (crewNumber !== undefined) {
    entry.crewNumber = Number(crewNumber);
    updated = true;
  }

  if (representingType !== undefined) {
    entry.representingType = representingType || undefined;
    updated = true;
  }

  if (representingNation !== undefined) {
    entry.representingNation = representingNation || undefined;
    updated = true;
  }

  if (documentType !== undefined) {
    entry.documentType = documentType || undefined;
    updated = true;
  }

  if (updated) {
    await entry.save();
    await populateEntryDoc(entry);
  }

  return res.json({ entry: serializeEntry(entry) });
});

export const deleteEntry = asyncHandler(async (req, res) => {
  const { competitionId, entryId } = req.params;

  const competition = await Competition.findById(competitionId).lean();
  if (!competition) {
    return res.status(404).json({ message: "Competition not found" });
  }

  const entry = await CompetitionEntry.findOne({
    _id: toObjectId(entryId),
    competition: competition._id,
  });

  if (!entry) {
    return res.status(404).json({ message: "Entry not found" });
  }

  const role = req.user?.role;
  if (!hasManagementPrivileges(role)) {
    return res
      .status(403)
      .json({ message: "Only administrators may permanently delete entries" });
  }

  await CompetitionEntry.deleteOne({ _id: entry._id });

  return res.json({
    message: "Entry permanently deleted",
    deleted: true,
    entryId: entry._id.toString(),
  });
});
