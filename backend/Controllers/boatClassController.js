import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import BoatClass from "../Models/boatClassModel.js";
import {
  DEFAULT_BOAT_CLASSES,
  seedDefaultBoatClasses,
} from "../Services/boatClassDefaults.js";

const DISCIPLINES = ["classic", "coastal", "beach", "indoor"];
const WEIGHT_CLASSES = ["open", "lightweight", "para"];
const GENDERS = ["men", "women", "mixed"];

const normaliseNames = (names = {}) => ({
  en: typeof names.en === "string" ? names.en.trim() : undefined,
  fr: typeof names.fr === "string" ? names.fr.trim() : undefined,
  ar: typeof names.ar === "string" ? names.ar.trim() : undefined,
});

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const lowered = value.toLowerCase();
    if (["true", "1", "yes", "on"].includes(lowered)) {
      return true;
    }
    if (["false", "0", "no", "off"].includes(lowered)) {
      return false;
    }
  }
  return fallback;
};

const parseNumber = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a valid number`);
  }
  return parsed;
};

const sanitiseAllowedGenders = (values) => {
  if (!values) {
    return GENDERS.slice();
  }
  const list = Array.isArray(values) ? values : [values];
  const filtered = list
    .map((item) => item && item.toString().toLowerCase())
    .filter((item) => GENDERS.includes(item));
  return filtered.length ? filtered : GENDERS.slice();
};

export const listBoatClasses = asyncHandler(async (req, res) => {
  const {
    discipline,
    includeInactive,
    search,
    activeOnly,
    sort = "code",
  } = req.query;

  const filters = {};

  if (discipline) {
    if (!DISCIPLINES.includes(discipline)) {
      return res.status(400).json({ message: "Unsupported discipline" });
    }
    filters.discipline = discipline;
  }

  const includeAll = parseBoolean(includeInactive, false) === true;
  const activeFilter = parseBoolean(activeOnly, false);

  if (!includeAll || activeFilter) {
    filters.isActive = true;
  }

  if (search) {
    const regex = new RegExp(search.trim(), "i");
    filters.$or = [
      { code: regex },
      { "names.en": regex },
      { "names.fr": regex },
      { "names.ar": regex },
    ];
  }

  const sortOption = (() => {
    if (sort === "createdAt") {
      return { createdAt: -1 };
    }
    if (sort === "crewSize") {
      return { crewSize: 1, code: 1 };
    }
    return { sortOrder: 1, code: 1 };
  })();

  const classes = await BoatClass.find(filters).sort(sortOption).lean();

  res.json(classes);
});

export const getBoatClassById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid boat class identifier" });
  }

  const boatClass = await BoatClass.findById(id).lean();
  if (!boatClass) {
    return res.status(404).json({ message: "Boat class not found" });
  }

  res.json(boatClass);
});

export const createBoatClass = asyncHandler(async (req, res) => {
  const {
    code,
    discipline,
    names,
    description,
    crewSize,
    coxswain,
    sculling,
    relay,
    runSegment,
    weightClass,
    allowedGenders,
    sortOrder,
    isActive,
    tags,
  } = req.body;

  if (!code || typeof code !== "string") {
    return res.status(400).json({ message: "Code is required" });
  }

  const uppercaseCode = code.trim().toUpperCase();

  if (!DISCIPLINES.includes(discipline)) {
    return res.status(400).json({ message: "Unsupported discipline" });
  }

  const normalisedNames = normaliseNames(names);
  if (!normalisedNames.en || !normalisedNames.fr || !normalisedNames.ar) {
    return res.status(400).json({ message: "All language names are required" });
  }

  if (weightClass && !WEIGHT_CLASSES.includes(weightClass)) {
    return res.status(400).json({ message: "Unsupported weight class" });
  }

  let crewSizeValue;
  try {
    crewSizeValue = parseNumber(crewSize, "Crew size");
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  if (!crewSizeValue || crewSizeValue < 1) {
    return res
      .status(400)
      .json({ message: "Crew size must be a positive number" });
  }

  if (crewSizeValue > 12) {
    return res.status(400).json({ message: "Crew size cannot exceed twelve" });
  }

  let sortOrderValue = 0;
  try {
    sortOrderValue = parseNumber(sortOrder, "Sort order") ?? 0;
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  // Check for duplicate code within the same discipline and weight class
  const effectiveWeightClass = weightClass || "open";
  const existingBoatClass = await BoatClass.findOne({
    code: uppercaseCode,
    discipline,
    weightClass: effectiveWeightClass,
  });
  if (existingBoatClass) {
    return res.status(400).json({
      message: `A boat class with code "${uppercaseCode}" already exists for ${discipline} discipline with ${effectiveWeightClass} weight class`,
    });
  }

  const boatClass = await BoatClass.create({
    code: uppercaseCode,
    discipline,
    names: normalisedNames,
    description: description?.trim() || undefined,
    crewSize: crewSizeValue,
    coxswain: parseBoolean(coxswain),
    sculling: parseBoolean(sculling),
    relay: parseBoolean(relay),
    runSegment: parseBoolean(runSegment),
    weightClass: weightClass || "open",
    allowedGenders: sanitiseAllowedGenders(allowedGenders),
    sortOrder: sortOrderValue,
    isActive: parseBoolean(isActive, true),
    tags: Array.isArray(tags)
      ? tags.map((tag) => tag?.toString().trim()).filter(Boolean)
      : [],
  });

  res.status(201).json({
    message: "Boat class created successfully",
    boatClass,
  });
});

export const updateBoatClass = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid boat class identifier" });
  }

  const boatClass = await BoatClass.findById(id);
  if (!boatClass) {
    return res.status(404).json({ message: "Boat class not found" });
  }

  const {
    code,
    discipline,
    names,
    description,
    crewSize,
    coxswain,
    sculling,
    relay,
    runSegment,
    weightClass,
    allowedGenders,
    sortOrder,
    isActive,
    tags,
  } = req.body;

  if (code !== undefined) {
    if (!code) {
      return res.status(400).json({ message: "Code cannot be empty" });
    }
    boatClass.code = code.trim().toUpperCase();
  }

  if (discipline !== undefined) {
    if (!DISCIPLINES.includes(discipline)) {
      return res.status(400).json({ message: "Unsupported discipline" });
    }
    boatClass.discipline = discipline;
  }

  if (names !== undefined) {
    const normalisedNames = normaliseNames(names);
    if (!normalisedNames.en || !normalisedNames.fr || !normalisedNames.ar) {
      return res
        .status(400)
        .json({ message: "All language names are required" });
    }
    boatClass.names = normalisedNames;
  }

  if (description !== undefined) {
    boatClass.description = description ? description.trim() : undefined;
  }

  if (crewSize !== undefined) {
    let crewSizeValue;
    try {
      crewSizeValue = parseNumber(crewSize, "Crew size");
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
    if (!crewSizeValue || crewSizeValue < 1) {
      return res
        .status(400)
        .json({ message: "Crew size must be a positive number" });
    }
    if (crewSizeValue > 12) {
      return res
        .status(400)
        .json({ message: "Crew size cannot exceed twelve" });
    }
    boatClass.crewSize = crewSizeValue;
  }

  if (coxswain !== undefined) {
    boatClass.coxswain = parseBoolean(coxswain);
  }

  if (sculling !== undefined) {
    boatClass.sculling = parseBoolean(sculling);
  }

  if (relay !== undefined) {
    boatClass.relay = parseBoolean(relay);
  }

  if (runSegment !== undefined) {
    boatClass.runSegment = parseBoolean(runSegment);
  }

  if (weightClass !== undefined) {
    if (!WEIGHT_CLASSES.includes(weightClass)) {
      return res.status(400).json({ message: "Unsupported weight class" });
    }
    boatClass.weightClass = weightClass;
  }

  if (allowedGenders !== undefined) {
    boatClass.allowedGenders = sanitiseAllowedGenders(allowedGenders);
  }

  if (sortOrder !== undefined) {
    let sortOrderValue;
    try {
      sortOrderValue = parseNumber(sortOrder, "Sort order");
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
    boatClass.sortOrder = sortOrderValue ?? 0;
  }

  if (isActive !== undefined) {
    boatClass.isActive = parseBoolean(isActive, true);
  }

  if (tags !== undefined) {
    boatClass.tags = Array.isArray(tags)
      ? tags.map((tag) => tag?.toString().trim()).filter(Boolean)
      : [];
  }

  // Check for duplicate code within the same discipline and weight class (excluding current record)
  const existingBoatClass = await BoatClass.findOne({
    _id: { $ne: boatClass._id },
    code: boatClass.code,
    discipline: boatClass.discipline,
    weightClass: boatClass.weightClass,
  });
  if (existingBoatClass) {
    return res.status(400).json({
      message: `A boat class with code "${boatClass.code}" already exists for ${boatClass.discipline} discipline with ${boatClass.weightClass} weight class`,
    });
  }

  await boatClass.save();

  res.json({
    message: "Boat class updated successfully",
    boatClass,
  });
});

export const deleteBoatClass = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid boat class identifier" });
  }

  const boatClass = await BoatClass.findById(id);
  if (!boatClass) {
    return res.status(404).json({ message: "Boat class not found" });
  }

  await boatClass.deleteOne();

  res.json({ message: "Boat class deleted successfully" });
});

export const bootstrapBoatClasses = asyncHandler(async (req, res) => {
  await seedDefaultBoatClasses();
  const classes = await BoatClass.find().sort({ discipline: 1, sortOrder: 1 });
  res.json({
    message: "Default boat classes synchronised",
    total: classes.length,
    defaultsApplied: DEFAULT_BOAT_CLASSES.length,
    classes,
  });
});
