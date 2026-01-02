import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Competition, {
  COMPETITION_DISCIPLINES,
  COMPETITION_STATUSES,
  COMPETITION_TYPES,
  REGISTRATION_STATUSES,
  RESULTS_STATUSES,
  STAGE_TYPES,
} from "../Models/competitionModel.js";

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
        array.findIndex((candidate) => candidate.equals(value)) === index
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
        isFinalDay,
        sessions,
        notes,
      };
    })
    .filter(Boolean);
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
    limit = 50,
  } = req.query;

  const filters = {};

  if (discipline) {
    if (!COMPETITION_DISCIPLINES.includes(discipline)) {
      return res.status(400).json({ message: "Unsupported discipline" });
    }
    filters.discipline = discipline;
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

  res.json(competitions);
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

  res.json(competition);
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
