import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Competition, {
  COMPETITION_DISCIPLINES,
  COMPETITION_SCOPES,
  COMPETITION_STATUSES,
  COMPETITION_TYPES,
  FOREIGN_ELIGIBILITY_MODES,
  PARTICIPATION_MODES,
  REGISTRATION_STATUSES,
  RESULTS_STATUSES,
  STAGE_TYPES,
} from "../Models/competitionModel.js";
import {
  computeCompetitionRegistrationStatus,
  syncCompetitionRegistrationStatus,
} from "../Services/registrationStatusService.js";

const parseDate = (value) => {
  if (!value) {
    return undefined;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const normaliseNames = (names = {}) => ({
  en: typeof names.en === "string" ? names.en.trim() : undefined,
  fr: typeof names.fr === "string" ? names.fr.trim() : undefined,
  ar: typeof names.ar === "string" ? names.ar.trim() : undefined,
});

const parseNumber = (value, fallback) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Value must be a valid number");
  }
  return parsed;
};

const sanitiseObjectIdArray = (values = []) => {
  const list = Array.isArray(values) ? values : [values];
  return list
    .map((value) => {
      if (mongoose.Types.ObjectId.isValid(value)) {
        return new mongoose.Types.ObjectId(value);
      }
      return null;
    })
    .filter(Boolean)
    .filter(
      (value, index, array) =>
        array.findIndex((candidate) => candidate.equals(value)) === index,
    );
};

const sanitiseCategoryDistances = (items = []) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      const distance = parseNumber(item.distance, undefined);
      if (distance === undefined || distance < 0) {
        return null;
      }

      const categoryId = mongoose.Types.ObjectId.isValid(item.category)
        ? new mongoose.Types.ObjectId(item.category)
        : null;
      const boatClassId = mongoose.Types.ObjectId.isValid(item.boatClass)
        ? new mongoose.Types.ObjectId(item.boatClass)
        : null;

      if (!categoryId && !boatClassId) {
        return null;
      }

      return {
        category: categoryId,
        boatClass: boatClassId,
        distance,
      };
    })
    .filter(Boolean);
};

const sanitiseStages = (stages = []) => {
  if (!Array.isArray(stages)) {
    return [];
  }

  return stages
    .map((stage, index) => {
      const name = typeof stage.name === "string" ? stage.name.trim() : "";
      if (!name) {
        return null;
      }

      const stageType = STAGE_TYPES.includes(stage.type) ? stage.type : "stage";

      const orderValue = (() => {
        try {
          return parseNumber(stage.order, index);
        } catch (error) {
          return index;
        }
      })();

      const date = parseDate(stage.date);
      const registrationOpenDate = parseDate(stage.registrationOpenDate);
      const registrationCloseDate = parseDate(stage.registrationCloseDate);
      const isFinalDay = Boolean(stage.isFinalDay);
      const notes = stage.notes ? stage.notes.toString().trim() : undefined;

      const sessions = Array.isArray(stage.sessions)
        ? stage.sessions
            .map((session, sessionIndex) => {
              const sessionName =
                typeof session?.name === "string" ? session.name.trim() : "";
              if (!sessionName) {
                return null;
              }
              const sessionOrder = (() => {
                try {
                  return parseNumber(session.order, sessionIndex);
                } catch (error) {
                  return sessionIndex;
                }
              })();
              return {
                name: sessionName,
                order: sessionOrder,
                startTime: parseDate(session.startTime),
                endTime: parseDate(session.endTime),
                notes: session.notes
                  ? session.notes.toString().trim()
                  : undefined,
              };
            })
            .filter(Boolean)
        : [];

      return {
        name,
        type: stageType,
        order: orderValue,
        date,
        registrationOpenDate,
        registrationCloseDate,
        isFinalDay,
        sessions,
        notes,
      };
    })
    .filter(Boolean);
};

const sanitiseScope = (scope, existingScope) => {
  // No scope in payload at all → keep existing (or default during create).
  if (scope === undefined) {
    return existingScope ? { ...existingScope } : undefined;
  }

  // Explicit null/empty clears international fields back to national defaults.
  if (scope === null) {
    return { type: "national" };
  }

  const raw = typeof scope === "object" ? scope : {};
  const type = COMPETITION_SCOPES.includes(raw.type) ? raw.type : "national";

  const sanitiseFederationList = (values) =>
    Array.isArray(values)
      ? values
          .map((v) => (typeof v === "string" ? v.trim().toUpperCase() : ""))
          .filter(Boolean)
      : [];

  const next = {
    type,
    organiserFederation:
      typeof raw.organiserFederation === "string"
        ? raw.organiserFederation.trim().toUpperCase() || undefined
        : undefined,
    hostFederation:
      typeof raw.hostFederation === "string"
        ? raw.hostFederation.trim().toUpperCase() || undefined
        : undefined,
    hostCountry:
      typeof raw.hostCountry === "string"
        ? raw.hostCountry.trim().toUpperCase() || undefined
        : undefined,
    participatingFederations: sanitiseFederationList(
      raw.participatingFederations
    ),
    trfParticipates:
      raw.trfParticipates === undefined ? true : Boolean(raw.trfParticipates),
    participationMode: PARTICIPATION_MODES.includes(raw.participationMode)
      ? raw.participationMode
      : "by_club",
    foreignEligibilityMode: FOREIGN_ELIGIBILITY_MODES.includes(
      raw.foreignEligibilityMode
    )
      ? raw.foreignEligibilityMode
      : "relaxed",
  };

  return next;
};

const buildCompetitionPayload = (body, userId, options = {}) => {
  const { allowPartial = false, existingCompetition = null } = options;

  const {
    code,
    names,
    discipline,
    competitionType,
    season,
    startDate,
    endDate,
    venue,
    organizer,
    registrationWindow,
    allowUpCategory,
    allowedCategories,
    allowedBoatClasses,
    defaultDistance,
    categoryDistances,
    stages,
    notes,
    status,
    registrationStatus,
    resultsStatus,
    scope,
  } = body;

  if (!allowPartial || code !== undefined) {
    if (!code || typeof code !== "string") {
      throw new Error("Competition code is required");
    }
  }

  const normalisedNames =
    names !== undefined ? normaliseNames(names) : existingCompetition?.names;

  if (!allowPartial || names !== undefined) {
    if (!normalisedNames?.en || !normalisedNames?.fr || !normalisedNames?.ar) {
      throw new Error("Competition names in all languages are required");
    }
  }

  if (
    (!allowPartial || discipline !== undefined) &&
    !COMPETITION_DISCIPLINES.includes(discipline)
  ) {
    throw new Error("Unsupported competition discipline");
  }

  if (
    (!allowPartial || competitionType !== undefined) &&
    !COMPETITION_TYPES.includes(competitionType)
  ) {
    throw new Error("Unsupported competition type");
  }

  const seasonValue = (() => {
    if (season === undefined) {
      return existingCompetition?.season ?? new Date().getFullYear();
    }
    const parsed = parseNumber(season, undefined);
    if (!parsed) {
      throw new Error("Season must be a valid year");
    }
    return parsed;
  })();

  const startDateValue =
    startDate !== undefined
      ? parseDate(startDate)
      : existingCompetition?.startDate;

  const endDateValue =
    endDate !== undefined ? parseDate(endDate) : existingCompetition?.endDate;

  if (!allowPartial || startDate !== undefined) {
    if (!startDateValue) {
      throw new Error("Start date is required");
    }
  }

  if (!allowPartial || endDate !== undefined) {
    if (!endDateValue) {
      throw new Error("End date is required");
    }
  }

  if (startDateValue && endDateValue && startDateValue > endDateValue) {
    throw new Error("Start date cannot be after end date");
  }

  const payload = {};

  if (code !== undefined) {
    payload.code = code.trim().toUpperCase();
  }
  if (names !== undefined) {
    payload.names = normalisedNames;
  }
  if (discipline !== undefined) {
    payload.discipline = discipline;
  }
  if (competitionType !== undefined) {
    payload.competitionType = competitionType;
  }
  payload.season = seasonValue;
  payload.startDate = startDateValue;
  payload.endDate = endDateValue;

  if (venue !== undefined) {
    payload.venue = {
      name: venue?.name?.toString().trim() || undefined,
      address: venue?.address?.toString().trim() || undefined,
      city: venue?.city?.toString().trim() || undefined,
      country: venue?.country?.toString().trim() || undefined,
      latitude:
        venue?.latitude !== undefined
          ? parseNumber(venue.latitude, undefined)
          : existingCompetition?.venue?.latitude,
      longitude:
        venue?.longitude !== undefined
          ? parseNumber(venue.longitude, undefined)
          : existingCompetition?.venue?.longitude,
    };
  }

  if (organizer !== undefined) {
    payload.organizer = {
      primary: organizer?.primary?.toString().trim() || undefined,
      secondary: organizer?.secondary?.toString().trim() || undefined,
      contactEmail: organizer?.contactEmail?.toString().trim() || undefined,
      contactPhone: organizer?.contactPhone?.toString().trim() || undefined,
    };
  }

  if (registrationWindow !== undefined) {
    const openAt = parseDate(registrationWindow?.openAt);
    const closeAt = parseDate(registrationWindow?.closeAt);
    if (openAt && closeAt && openAt > closeAt) {
      throw new Error("Registration open date cannot be after the close date");
    }
    payload.registrationWindow = {
      openAt,
      closeAt,
    };
  }

  if (allowUpCategory !== undefined) {
    payload.allowUpCategory = Boolean(allowUpCategory);
  }

  if (allowedCategories !== undefined) {
    payload.allowedCategories = sanitiseObjectIdArray(allowedCategories);
  }

  if (allowedBoatClasses !== undefined) {
    payload.allowedBoatClasses = sanitiseObjectIdArray(allowedBoatClasses);
  }

  if (defaultDistance !== undefined) {
    const distance = parseNumber(defaultDistance, null);
    if (distance !== null && distance < 0) {
      throw new Error("Default distance must be zero or greater");
    }
    payload.defaultDistance = distance === null ? undefined : distance;
  }

  if (categoryDistances !== undefined) {
    payload.categoryDistances = sanitiseCategoryDistances(categoryDistances);
  }

  if (stages !== undefined) {
    payload.stages = sanitiseStages(stages);
  }

  if (notes !== undefined) {
    payload.notes = notes?.toString().trim() || undefined;
  }

  if (scope !== undefined) {
    const scopePayload = sanitiseScope(
      scope,
      existingCompetition?.scope?.toObject?.() ?? existingCompetition?.scope
    );
    if (scopePayload) {
      // Cross-field validation for international competitions.
      if (scopePayload.type !== "national") {
        if (!scopePayload.hostCountry) {
          throw new Error(
            "International competitions require a host country (scope.hostCountry)"
          );
        }
        if (scopePayload.type === "international_oaas") {
          scopePayload.trfParticipates = false;
        }
      }
      payload.scope = scopePayload;
    }
  }

  // Handle status fields with validation
  if (status !== undefined && COMPETITION_STATUSES.includes(status)) {
    payload.status = status;
  }

  if (
    registrationStatus !== undefined &&
    REGISTRATION_STATUSES.includes(registrationStatus)
  ) {
    payload.registrationStatus = registrationStatus;
  }

  payload.registrationStatus = computeCompetitionRegistrationStatus({
    registrationStatus: payload.registrationStatus,
    registrationWindow:
      payload.registrationWindow ?? existingCompetition?.registrationWindow,
  });

  if (resultsStatus !== undefined && RESULTS_STATUSES.includes(resultsStatus)) {
    payload.resultsStatus = resultsStatus;
  }

  if (userId) {
    if (!existingCompetition) {
      payload.createdBy = userId;
    }
    payload.updatedBy = userId;
  }

  return payload;
};

const applyStatusUpdates = (competition, updates = {}) => {
  const { status, registrationStatus, resultsStatus, publishedAt } = updates;

  if (status !== undefined) {
    if (!COMPETITION_STATUSES.includes(status)) {
      throw new Error("Unsupported competition status");
    }
    competition.status = status;
    if (status === "published" && !competition.publishedAt) {
      competition.publishedAt = new Date();
    }
  }

  if (registrationStatus !== undefined) {
    if (!REGISTRATION_STATUSES.includes(registrationStatus)) {
      throw new Error("Unsupported registration status");
    }
    competition.registrationStatus = registrationStatus;
  }

  if (resultsStatus !== undefined) {
    if (!RESULTS_STATUSES.includes(resultsStatus)) {
      throw new Error("Unsupported results status");
    }
    competition.resultsStatus = resultsStatus;
    if (resultsStatus === "official") {
      competition.resultsPublishedAt =
        competition.resultsPublishedAt || new Date();
    }
  }

  if (publishedAt !== undefined) {
    const parsed = parseDate(publishedAt);
    if (!parsed) {
      throw new Error("Published date must be valid");
    }
    competition.publishedAt = parsed;
  }
};

export const listCompetitions = asyncHandler(async (req, res) => {
  const {
    discipline,
    season,
    status,
    search,
    includeArchived,
    scope,
    limit = 50,
  } = req.query;

  const filters = {};

  if (discipline) {
    if (!COMPETITION_DISCIPLINES.includes(discipline)) {
      return res.status(400).json({ message: "Unsupported discipline" });
    }
    filters.discipline = discipline;
  }

  // Scope filter: accepts a specific scope type, or "international" (any
  // non-national scope) / "national" (only national).
  if (scope) {
    const trimmed = scope.trim();
    if (COMPETITION_SCOPES.includes(trimmed)) {
      filters["scope.type"] = trimmed;
    } else if (trimmed.toLowerCase() === "international") {
      filters["scope.type"] = { $ne: "national" };
    } else if (trimmed.toLowerCase() === "national") {
      filters["scope.type"] = "national";
    }
  }

  if (season) {
    const seasonValue = Number(season);
    if (!Number.isFinite(seasonValue)) {
      return res.status(400).json({ message: "Season must be a number" });
    }
    filters.season = seasonValue;
  }

  const includeArchivedFlag =
    includeArchived && includeArchived.toString().toLowerCase() === "true";

  if (status) {
    if (!COMPETITION_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Unsupported status" });
    }
    filters.status = status;
  } else if (!includeArchivedFlag) {
    filters.status = { $ne: "archived" };
  }

  if (search && search.trim()) {
    const regex = new RegExp(search.trim(), "i");
    filters.$or = [
      { code: regex },
      { "names.en": regex },
      { "names.fr": regex },
      { "names.ar": regex },
      { "venue.name": regex },
      { "venue.city": regex },
    ];
  }

  const limitValue = Math.min(Number(limit) || 50, 200);

  const competitions = await Competition.find(filters)
    .sort({ startDate: 1, code: 1 })
    .limit(limitValue)
    .lean();

  const competitionsWithStatus = competitions.map((competition) => ({
    ...competition,
    registrationStatus: computeCompetitionRegistrationStatus(competition),
  }));

  res.json(competitionsWithStatus);
});

export const getCompetitionById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid competition identifier" });
  }

  const competition = await Competition.findById(id)
    .populate("allowedCategories", "abbreviation titles type")
    .populate("allowedBoatClasses", "code names discipline")
    .lean();

  if (!competition) {
    return res.status(404).json({ message: "Competition not found" });
  }

  res.json({
    ...competition,
    registrationStatus: computeCompetitionRegistrationStatus(competition),
  });
});

export const createCompetition = asyncHandler(async (req, res) => {
  try {
    const payload = buildCompetitionPayload(req.body, req.user?.id);
    const competition = await Competition.create(payload);
    res.status(201).json({
      message: "Competition created successfully",
      competition,
    });
  } catch (error) {
    console.error("Failed to create competition", error);
    res
      .status(400)
      .json({ message: error.message || "Failed to create competition" });
  }
});

export const updateCompetition = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid competition identifier" });
  }

  const competition = await Competition.findById(id);
  if (!competition) {
    return res.status(404).json({ message: "Competition not found" });
  }

  try {
    const payload = buildCompetitionPayload(req.body, req.user?.id, {
      allowPartial: true,
      existingCompetition: competition,
    });

    Object.assign(competition, payload);
    // Debug: log registration window and computed next status when updating
    try {
      const next = computeCompetitionRegistrationStatus(competition);
      console.log(
        `Updating competition ${competition._id.toString()} registrationWindow=`,
        competition.registrationWindow,
        `computedRegistrationStatus=`,
        next,
      );
    } catch (err) {
      console.error("Failed computing registration status during update", err);
    }
    syncCompetitionRegistrationStatus(competition);
    await competition.save();

    res.json({
      message: "Competition updated successfully",
      competition,
    });
  } catch (error) {
    console.error("Failed to update competition", error);
    res
      .status(400)
      .json({ message: error.message || "Failed to update competition" });
  }
});

export const updateCompetitionStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid competition identifier" });
  }

  const competition = await Competition.findById(id);
  if (!competition) {
    return res.status(404).json({ message: "Competition not found" });
  }

  try {
    applyStatusUpdates(competition, req.body || {});
    // Debug: log registration window and computed next status when updating status
    try {
      const next = computeCompetitionRegistrationStatus(competition);
      console.log(
        `Updating competition status ${competition._id.toString()} registrationWindow=`,
        competition.registrationWindow,
        `computedRegistrationStatus=`,
        next,
      );
    } catch (err) {
      console.error(
        "Failed computing registration status during status update",
        err,
      );
    }
    syncCompetitionRegistrationStatus(competition);
    competition.updatedBy = req.user?.id || competition.updatedBy;
    await competition.save();

    res.json({
      message: "Competition status updated",
      competition,
    });
  } catch (error) {
    console.error("Failed to update competition status", error);
    res.status(400).json({
      message: error.message || "Failed to update competition status",
    });
  }
});

export const deleteCompetition = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid competition identifier" });
  }

  const competition = await Competition.findById(id);
  if (!competition) {
    return res.status(404).json({ message: "Competition not found" });
  }

  await competition.deleteOne();

  res.json({ message: "Competition deleted successfully" });
});
