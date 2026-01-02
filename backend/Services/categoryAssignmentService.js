import Category from "../Models/categoryModel.js";
import Athlete from "../Models/athleteModel.js";

const CATEGORY_TYPES = {
  national: "national",
  international: "international",
};

const CATEGORY_GENDERS = {
  men: "men",
  women: "women",
  mixed: "mixed",
};

const GENDER_TO_CATEGORY_GENDER = {
  male: [CATEGORY_GENDERS.men],
  female: [CATEGORY_GENDERS.women],
};

const ALL_CATEGORY_GENDERS = Object.values(CATEGORY_GENDERS);

const ensureCategoriesInCache = async (
  cache,
  type = CATEGORY_TYPES.national
) => {
  if (!cache[type]) {
    cache[type] = (
      await Category.find({ type, isActive: true })
        .sort({ minAge: 1, maxAge: 1, abbreviation: 1 })
        .lean()
    ).filter(
      (category) =>
        !category?.gender || ALL_CATEGORY_GENDERS.includes(category.gender)
    );
  }
  return cache[type];
};

export const getSeasonYear = (referenceDate = new Date()) => {
  const date =
    referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  return date.getFullYear();
};

export const calculateAgeOnSeasonCutoff = (birthDate, seasonYear) => {
  if (!birthDate) {
    return null;
  }

  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) {
    return null;
  }

  const cutoff = new Date(seasonYear, 11, 31, 23, 59, 59, 999);
  let age = cutoff.getFullYear() - birth.getFullYear();

  const hasBirthdayAfterCutoff =
    birth.getMonth() > cutoff.getMonth() ||
    (birth.getMonth() === cutoff.getMonth() &&
      birth.getDate() > cutoff.getDate());

  if (hasBirthdayAfterCutoff) {
    age -= 1;
  }

  return age;
};

const pickMatchingCategory = (categories, gender, age) => {
  if (!Array.isArray(categories) || typeof age !== "number") {
    return null;
  }

  const allowedGenders =
    GENDER_TO_CATEGORY_GENDER[gender] ?? ALL_CATEGORY_GENDERS;
  let bestMatch = null;

  for (const category of categories) {
    // Mixed categories match any athlete gender
    // Gender-specific categories must match the athlete's allowed genders
    if (
      category.gender !== "mixed" &&
      !allowedGenders.includes(category.gender)
    ) {
      continue;
    }

    const minAge = Number.isFinite(category.minAge)
      ? category.minAge
      : -Infinity;
    const maxAge = Number.isFinite(category.maxAge)
      ? category.maxAge
      : Infinity;

    if (age < minAge || age > maxAge) {
      continue;
    }

    if (!bestMatch) {
      bestMatch = category;
      continue;
    }

    const bestMin = Number.isFinite(bestMatch.minAge)
      ? bestMatch.minAge
      : -Infinity;
    const bestMax = Number.isFinite(bestMatch.maxAge)
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
        category.abbreviation ||
        category.titles?.en ||
        ""
      ).toString();
      const bestLabel = (
        bestMatch.abbreviation ||
        bestMatch.titles?.en ||
        ""
      ).toString();
      if (currentLabel.localeCompare(bestLabel) < 0) {
        bestMatch = category;
      }
    }
  }

  return bestMatch;
};

const buildAssignmentPayload = (categoryDoc, seasonYear, age) => ({
  season: seasonYear,
  type: CATEGORY_TYPES.national,
  category: categoryDoc?._id,
  abbreviation: categoryDoc?.abbreviation,
  gender: categoryDoc?.gender,
  titles: {
    ar: categoryDoc?.titles?.ar ?? null,
    fr: categoryDoc?.titles?.fr ?? null,
    en: categoryDoc?.titles?.en ?? null,
  },
  ageOnCutoff: age,
});

export const ensureNationalCategoryForAthlete = async (
  athlete,
  seasonYear,
  cache = {}
) => {
  if (!athlete || !athlete.birthDate) {
    return false;
  }

  if (typeof athlete.save !== "function") {
    return false;
  }

  const age = calculateAgeOnSeasonCutoff(athlete.birthDate, seasonYear);
  if (age === null) {
    return false;
  }

  const categories = await ensureCategoriesInCache(
    cache,
    CATEGORY_TYPES.national
  );
  if (!categories.length) {
    return false;
  }

  const sanitizeAssignmentGender = (value) =>
    !value || ALL_CATEGORY_GENDERS.includes(value) ? value : undefined;

  let assignments = Array.isArray(athlete.categoryAssignments)
    ? athlete.categoryAssignments.map((entry) =>
        entry && typeof entry.toObject === "function" ? entry.toObject() : entry
      )
    : [];
  let assignmentsChanged = false;

  assignments = assignments.filter((entry) => {
    if (!entry) {
      assignmentsChanged = true;
      return false;
    }

    if (sanitizeAssignmentGender(entry.gender) === undefined && entry.gender) {
      assignmentsChanged = true;
      return false;
    }

    return true;
  });

  const category = pickMatchingCategory(categories, athlete.gender, age);

  const existingIndex = assignments.findIndex(
    (entry) =>
      entry.type === CATEGORY_TYPES.national && entry.season === seasonYear
  );

  if (!category) {
    if (existingIndex >= 0) {
      assignments.splice(existingIndex, 1);
      assignmentsChanged = true;
    }

    if (assignmentsChanged) {
      await Athlete.updateOne(
        { _id: athlete._id },
        { $set: { categoryAssignments: assignments } }
      );
      return true;
    }
    return false;
  }

  const payload = buildAssignmentPayload(category, seasonYear, age);

  const existing = existingIndex >= 0 ? assignments[existingIndex] : null;
  const isSameAssignment = existing
    ? existing.category?.toString?.() === category._id?.toString?.() &&
      existing.abbreviation === payload.abbreviation &&
      existing.ageOnCutoff === payload.ageOnCutoff
    : false;

  if (!isSameAssignment) {
    if (existingIndex >= 0) {
      assignments[existingIndex] = { ...existing, ...payload };
    } else {
      assignments.push(payload);
    }
    assignmentsChanged = true;
  }

  if (assignmentsChanged) {
    await Athlete.updateOne(
      { _id: athlete._id },
      { $set: { categoryAssignments: assignments } }
    );
    return true;
  }

  return false;
};

export const ensureNationalCategoriesForAthletes = async (
  athletes,
  seasonYear,
  cache = {}
) => {
  if (!Array.isArray(athletes) || athletes.length === 0) {
    return 0;
  }

  const categoryDocs = await ensureCategoriesInCache(
    cache,
    CATEGORY_TYPES.national
  );
  if (!categoryDocs.length) {
    return 0;
  }

  let updates = 0;
  for (const athlete of athletes) {
    const changed = await ensureNationalCategoryForAthlete(
      athlete,
      seasonYear,
      cache
    );
    if (changed) {
      updates += 1;
    }
  }
  return updates;
};

export const assignNationalCategoriesForSeason = async (seasonYear) => {
  const cache = {};
  const categories = await ensureCategoriesInCache(
    cache,
    CATEGORY_TYPES.national
  );
  if (!categories.length) {
    return { updated: 0, total: 0 };
  }

  const athletes = await Athlete.find({ birthDate: { $ne: null } });
  let updated = 0;
  for (const athlete of athletes) {
    const changed = await ensureNationalCategoryForAthlete(
      athlete,
      seasonYear,
      cache
    );
    if (changed) {
      updated += 1;
    }
  }

  return { updated, total: athletes.length };
};
