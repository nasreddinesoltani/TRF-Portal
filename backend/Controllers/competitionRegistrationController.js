import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Competition from "../Models/competitionModel.js";
import CompetitionEntry, {
  COMPETITION_ENTRY_STATUSES,
} from "../Models/competitionEntryModel.js";
import Athlete from "../Models/athleteModel.js";
import Club from "../Models/clubModel.js";
import Category from "../Models/categoryModel.js";
import BoatClass from "../Models/boatClassModel.js";

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

const resolveEffectiveRegistrationStatus = (competition) => {
  if (!competition) return "not_open";
  const { registrationStatus, registrationWindow } = competition;

  // If explicitly closed, it overrides everything
  if (registrationStatus === "closed") {
    return "closed";
  }

  // If explicitly open, it overrides window checks (e.g. extended manually)
  if (registrationStatus === "open") {
    return "open";
  }

  // If status is 'not_open' (default), check if we are in the window
  if (registrationWindow?.openAt && registrationWindow?.closeAt) {
    const now = new Date();
    const openAt = new Date(registrationWindow.openAt);
    const closeAt = new Date(registrationWindow.closeAt);

    if (now >= openAt && now <= closeAt) {
      return "open";
    }

    if (now > closeAt) {
      return "closed";
    }
  }

  return registrationStatus;
};

const roleIsAdmin = (role) => role === "admin";
const roleIsJury = (role) => role === "jury_president";
const roleIsClubManager = (role) => role === "club_manager";
const hasManagementPrivileges = (role) => roleIsAdmin(role) || roleIsJury(role);

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
    type: boatClass.type || null,
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
    crewNumber: entry.crewNumber || 1,
    seed: entry.seed || null,
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
    .lean();
};

const resolveClubContext = async (req, { requireClub = false } = {}) => {
  const role = req.user?.role;
  let targetClubId = null;

  if (roleIsClubManager(role)) {
    targetClubId = toObjectId(req.user?.clubId);
    if (!targetClubId) {
      throw new Error(
        "Club account is missing an associated club. Please contact an administrator."
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
  return Array.isArray(athlete.memberships)
    ? athlete.memberships.some((membership) => {
        if (!membership) {
          return false;
        }
        const membershipClubId = membership.club?.toString?.();
        if (!membershipClubId || membershipClubId !== clubIdString) {
          return false;
        }
        if (membership.status !== "active") {
          return false;
        }
        if (competitionSeason && membership.season) {
          return membership.season === competitionSeason;
        }
        return true;
      })
    : false;
};

const findSeasonAssignment = (athlete, season) => {
  if (!Array.isArray(athlete.categoryAssignments) || !season) {
    return null;
  }
  return athlete.categoryAssignments.find(
    (assignment) =>
      assignment &&
      assignment.type === "national" &&
      assignment.season === season &&
      assignment.category
  );
};

const athleteFitsCategory = (assignment, categoryDoc, allowUpCategory) => {
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

  if (!allowUpCategory) {
    return false;
  }

  if (
    assignment.gender &&
    categoryDoc.gender &&
    assignment.gender !== categoryDoc.gender
  ) {
    return false;
  }

  if (typeof assignment.ageOnCutoff !== "number") {
    return false;
  }

  const meetsMin =
    typeof categoryDoc.minAge === "number"
      ? assignment.ageOnCutoff >= categoryDoc.minAge
      : true;
  const meetsMax =
    typeof categoryDoc.maxAge === "number"
      ? assignment.ageOnCutoff <= categoryDoc.maxAge
      : true;

  return meetsMin && meetsMax;
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
        "firstName lastName firstNameAr lastNameAr licenseNumber gender birthDate categoryAssignments memberships",
      populate: {
        path: "memberships.club",
        select: "name nameAr code type",
      },
    },
    {
      path: "crew",
      select:
        "firstName lastName firstNameAr lastNameAr licenseNumber gender birthDate categoryAssignments memberships",
      populate: {
        path: "memberships.club",
        select: "name nameAr code type",
      },
    },
    {
      path: "category",
      select: "abbreviation titles gender minAge maxAge",
    },
    {
      path: "boatClass",
      select: "code names type seats",
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
          "firstName lastName firstNameAr lastNameAr licenseNumber gender birthDate categoryAssignments memberships",
        populate: {
          path: "memberships.club",
          select: "name nameAr code type",
        },
      },
      {
        path: "crew",
        select:
          "firstName lastName firstNameAr lastNameAr licenseNumber gender birthDate categoryAssignments memberships",
        populate: {
          path: "memberships.club",
          select: "name nameAr code type",
        },
      },
      {
        path: "category",
        select: "abbreviation titles gender minAge maxAge",
      },
      {
        path: "boatClass",
        select: "code names type seats",
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

  const effectiveStatus = resolveEffectiveRegistrationStatus(competition);

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
      allowedCategories,
      allowedBoatClasses,
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
  const { q = "", limit = 50 } = req.query;

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

  let clubContext;
  try {
    clubContext = await resolveClubContext(req, {
      requireClub: true,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const categoryId = toObjectId(req.query.category);
  const searchTerm = q.toString().trim();
  const numericLimit = (() => {
    const parsed = Number(limit);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : 50;
  })();

  const allowedCategorySet =
    Array.isArray(competition.allowedCategories) &&
    competition.allowedCategories.length > 0
      ? new Set(
          competition.allowedCategories.map((category) =>
            category?._id?.toString?.()
          )
        )
      : null;

  const entryQuery = {
    competition: competition._id,
    status: { $ne: "withdrawn" },
  };

  const existingEntries = await CompetitionEntry.find(entryQuery)
    .select("athlete crew status category")
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

  const athleteQuery = {
    memberships: {
      $elemMatch: {
        club: clubContext.clubId,
        status: "active",
        ...(competition.season
          ? {
              $or: [
                { season: { $exists: false } },
                { season: competition.season },
              ],
            }
          : {}),
      },
    },
  };

  if (searchFilters.length) {
    athleteQuery.$or = searchFilters;
  }

  const athletes = await Athlete.find(athleteQuery)
    .select(
      "firstName lastName firstNameAr lastNameAr licenseNumber gender birthDate categoryAssignments memberships"
    )
    .limit(numericLimit)
    .sort({ lastName: 1, firstName: 1 })
    .lean();

  const requestedCategories = new Set();
  if (categoryId) {
    requestedCategories.add(categoryId.toString());
  }

  athletes.forEach((athlete) => {
    const assignment = findSeasonAssignment(athlete, competition.season);
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
    categoryDocs.map((category) => [category._id.toString(), category])
  );

  const eligibleAthletes = athletes
    .map((athlete) => {
      const assignment = findSeasonAssignment(athlete, competition.season);
      if (!assignment) {
        return null;
      }

      if (
        allowedCategorySet &&
        !allowedCategorySet.has(assignment.category?.toString?.())
      ) {
        return null;
      }

      if (
        categoryId &&
        assignment.category?.toString?.() !== categoryId.toString()
      ) {
        const requestedCategoryDoc = categoryMap.get(categoryId.toString());
        if (
          !athleteFitsCategory(
            assignment,
            requestedCategoryDoc,
            competition.allowUpCategory
          )
        ) {
          return null;
        }
      }

      if (
        !ensureMembershipForClub(
          athlete,
          clubContext.clubId,
          competition.season
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
            }
          : null,
        category: serializeCategory(categoryDoc),
      };
    })
    .filter(Boolean);

  return res.json({
    competition: {
      id: competition._id.toString(),
      season: competition.season,
    },
    club: serializeClub(clubContext.clubDoc),
    athletes: eligibleAthletes,
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

  const effectiveStatus = resolveEffectiveRegistrationStatus(competition);
  if (effectiveStatus !== "open") {
    return res
      .status(400)
      .json({ message: "Registration is not open for this competition" });
  }

  const role = req.user?.role;
  if (!roleIsClubManager(role) && !hasManagementPrivileges(role)) {
    return res
      .status(403)
      .json({ message: "You are not allowed to register athletes" });
  }

  let clubContext;
  try {
    clubContext = await resolveClubContext(req, { requireClub: true });
  } catch (error) {
    return res.status(400).json({ message: error.message });
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
      seed: entry.seed ? Number(entry.seed) : null,
      notes:
        typeof entry.notes === "string" && entry.notes.trim().length
          ? entry.notes.trim()
          : undefined,
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
      "firstName lastName licenseNumber gender birthDate categoryAssignments memberships licenseStatus documentsStatus documentsIssues"
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
  }).select("athlete crew status");

  const busyAthleteIds = new Set();
  existingEntries.forEach((entry) => {
    if (entry.athlete) busyAthleteIds.add(entry.athlete.toString());
    if (Array.isArray(entry.crew)) {
      entry.crew.forEach((id) => busyAthleteIds.add(id.toString()));
    }
  });

  const allowedCategorySet =
    Array.isArray(competition.allowedCategories) &&
    competition.allowedCategories.length > 0
      ? new Set(
          competition.allowedCategories.map((category) =>
            category?._id?.toString?.()
          )
        )
      : null;

  // Fetch all active entries for this competition/club involving these categories
  // to determine the next available crew numbers (filling gaps).
  const existingActiveEntries = await CompetitionEntry.find({
    competition: competition._id,
    club: clubContext.clubId,
    category: { $in: Array.from(allCategoryIds) },
    status: { $ne: "withdrawn" },
  }).select("category boatClass crewNumber");

  // Map: "catId_boatClassId" -> Set(crewNumbers)
  const usedNumbersMap = new Map();

  const getCounterKey = (catId, boatClassId) => {
    return `${catId}_${boatClassId || "null"}`;
  };

  for (const entry of existingActiveEntries) {
    const key = getCounterKey(entry.category, entry.boatClass);
    if (!usedNumbersMap.has(key)) {
      usedNumbersMap.set(key, new Set());
    }
    usedNumbersMap.get(key).add(entry.crewNumber || 0);
  }

  const creations = [];

  for (const entry of parsedEntries) {
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
        req.body.bypassMultipleEntries === true;

      if (busyAthleteIds.has(idStr)) {
        if (!allowMultiple) {
          const athleteName = athlete 
            ? `${athlete.firstName || "Athlete"} ${athlete.lastName || idStr}`
            : `Athlete ${idStr}`;
            
          return res.status(400).json({
            message: `${athleteName} is already registered for this competition`,
          });
        }
        
        // If multiple are allowed, check for EXACT duplicate (same athlete, same category, same boat class)
        const isDuplicateEvent = existingEntries.some(e => {
          const isSameAthlete = (e.athlete?.toString() === idStr) || 
                                (Array.isArray(e.crew) && e.crew.some(m => m.toString() === idStr));
          const isSameCategory = e.category?.toString() === entry.categoryId?.toString();
          const isSameBoatClass = e.boatClass?.toString() === entry.boatClassId?.toString();
          return isSameAthlete && isSameCategory && isSameBoatClass;
        });

        if (isDuplicateEvent) {
          const athleteName = athlete 
            ? `${athlete.firstName || "Athlete"} ${athlete.lastName || idStr}`
            : `Athlete ${idStr}`;
          return res.status(400).json({
            message: `${athleteName} is already registered for this exact event (Category/Boat Class)`,
          });
        }
      }

      if (
        !ensureMembershipForClub(
          athlete,
          clubContext.clubId,
          competition.season
        )
      ) {
        return res.status(400).json({
          message: `${athlete.firstName} ${athlete.lastName} does not have an active membership with this club for the season`,
        });
      }

      // Validate license status - athlete must have all documents approved
      // BYPASS: If is a historical season, we allow admins to bypass document validation
      const currentYear = new Date().getFullYear();
      const isHistoricalSeason = competition.season && competition.season < currentYear;

      if (!isHistoricalSeason && athlete.licenseStatus !== "active") {
        const issuesList = Array.isArray(athlete.documentsIssues) && athlete.documentsIssues.length > 0
          ? ` (${athlete.documentsIssues.join(", ")})`
          : "";
        return res.status(400).json({
          message: `${athlete.firstName} ${athlete.lastName} does not have an active license - documents incomplete${issuesList}`,
        });
      }

      const assignment = findSeasonAssignment(athlete, competition.season);
      if (!assignment) {
        return res.status(400).json({
          message: `${athlete.firstName} ${athlete.lastName} does not have a category assignment for the competition season`,
        });
      }

      if (
        !req.body.bypassEligibility &&
        !athleteFitsCategory(
          assignment,
          categoryDoc,
          competition.allowUpCategory
        )
      ) {
        return res.status(400).json({
          message: `${athlete.firstName} ${athlete.lastName} is not eligible for ${categoryDoc.abbreviation}`,
        });
      }
    }

    // Determine next available crew number
    const counterKey = getCounterKey(entry.categoryId, entry.boatClassId);
    if (!usedNumbersMap.has(counterKey)) {
      usedNumbersMap.set(counterKey, new Set());
    }
    const usedSet = usedNumbersMap.get(counterKey);

    let nextNumber = 1;
    while (usedSet.has(nextNumber)) {
      nextNumber++;
    }
    usedSet.add(nextNumber);

    const isSingle = entry.crewIds.length === 1;

    const creation = new CompetitionEntry({
      competition: competition._id,
      club: clubContext.clubId,
      athlete: isSingle ? entry.crewIds[0] : undefined,
      crew: entry.crewIds,
      category: entry.categoryId,
      boatClass: entry.boatClassId || undefined,
      crewNumber: nextNumber,
      seed: entry.seed || null,
      status: "pending",
      notes: entry.notes,
      submittedBy: req.user.id,
      submittedAt: new Date(),
    });
    creations.push(creation.save());

    // Mark these athletes as busy for subsequent entries in the same batch
    entry.crewIds.forEach((id) => busyAthleteIds.add(id.toString()));
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
    await CompetitionEntry.deleteOne({ _id: entry._id });
    return res.json({ message: "Entry deleted", deleted: true, entryId });
  }

  // If after deadline, SOFT WITHDRAW
  if (entry.status === "withdrawn") {
    return res.json({ entry: serializeEntry(entry) });
  }

  entry.status = "withdrawn";
  entry.reviewedBy = req.user.id;
  entry.reviewedAt = new Date();
  entry.reviewerNotes = isClubManager
    ? "Withdrawn by club (post-deadline)"
    : "Withdrawn by official";

  await entry.save();
  await populateEntryDoc(entry);

  return res.json({ entry: serializeEntry(entry) });
});

export const updateEntry = asyncHandler(async (req, res) => {
  const { competitionId, entryId } = req.params;
  const { seed, notes, crewNumber } = req.body;

  const role = req.user?.role;
  if (!hasManagementPrivileges(role)) {
    return res.status(403).json({ message: "Not authorized to update entries" });
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
    entryId: entry._id.toString() 
  });
});
