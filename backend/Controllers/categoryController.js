import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Category from "../Models/categoryModel.js";
import {
  assignNationalCategoriesForSeason,
  getSeasonYear,
} from "../Services/categoryAssignmentService.js";

const CATEGORY_TYPES = ["national", "international"];
const CATEGORY_GENDERS = ["men", "women", "mixed"];

const normaliseTitles = (titles = {}) => ({
  ar: typeof titles.ar === "string" ? titles.ar.trim() : undefined,
  fr: typeof titles.fr === "string" ? titles.fr.trim() : undefined,
  en: typeof titles.en === "string" ? titles.en.trim() : undefined,
});

const parseNumberOrNull = (value, fieldName) => {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`${fieldName} must be a valid number`);
  }
  if (parsed < 0) {
    throw new Error(`${fieldName} must be zero or greater`);
  }
  return parsed;
};

export const listCategories = asyncHandler(async (req, res) => {
  const { type = "national", includeInactive, gender } = req.query;

  if (!CATEGORY_TYPES.includes(type)) {
    return res.status(400).json({ message: "Unsupported category type" });
  }

  const filters = { type };
  if (!includeInactive || includeInactive === "false") {
    filters.isActive = true;
  }

  // Handle gender filter
  if (gender && ["men", "women", "mixed"].includes(gender)) {
    filters.gender = gender;
  }

  const categories = await Category.find(filters)
    .sort({ minAge: 1, maxAge: 1, abbreviation: 1 })
    .lean();

  res.json(categories);
});

export const createCategory = asyncHandler(async (req, res) => {
  const {
    type = "national",
    abbreviation,
    gender,
    minAge,
    maxAge,
    titles,
    isActive = true,
  } = req.body;

  if (!abbreviation || typeof abbreviation !== "string") {
    return res.status(400).json({ message: "Abbreviation is required" });
  }

  if (!CATEGORY_TYPES.includes(type)) {
    return res.status(400).json({ message: "Unsupported category type" });
  }

  if (!CATEGORY_GENDERS.includes(gender)) {
    return res.status(400).json({ message: "Unsupported category gender" });
  }

  let minAgeValue;
  let maxAgeValue;

  try {
    minAgeValue = parseNumberOrNull(minAge, "Minimum age");
    maxAgeValue = parseNumberOrNull(maxAge, "Maximum age");
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  if (minAgeValue === undefined || maxAgeValue === undefined) {
    return res
      .status(400)
      .json({ message: "Both minimum and maximum ages are required" });
  }

  if (minAgeValue > maxAgeValue) {
    return res
      .status(400)
      .json({ message: "Minimum age cannot be greater than maximum age" });
  }

  const category = await Category.create({
    type,
    abbreviation,
    gender,
    minAge: minAgeValue,
    maxAge: maxAgeValue,
    titles: normaliseTitles(titles),
    isActive: Boolean(isActive),
  });

  res.status(201).json({
    message: "Category created successfully",
    category,
  });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid category identifier" });
  }

  const category = await Category.findById(id);

  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }

  const { abbreviation, gender, minAge, maxAge, titles, isActive } = req.body;

  if (abbreviation !== undefined) {
    if (!abbreviation) {
      return res.status(400).json({ message: "Abbreviation cannot be empty" });
    }
    category.abbreviation = abbreviation;
  }

  if (gender !== undefined) {
    if (!CATEGORY_GENDERS.includes(gender)) {
      return res.status(400).json({ message: "Unsupported category gender" });
    }
    category.gender = gender;
  }

  let minAgeValue = category.minAge;
  let maxAgeValue = category.maxAge;

  if (minAge !== undefined) {
    try {
      minAgeValue = parseNumberOrNull(minAge, "Minimum age");
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  }

  if (maxAge !== undefined) {
    try {
      maxAgeValue = parseNumberOrNull(maxAge, "Maximum age");
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  }

  if (minAgeValue === undefined || maxAgeValue === undefined) {
    return res
      .status(400)
      .json({ message: "Both minimum and maximum ages are required" });
  }

  if (minAgeValue > maxAgeValue) {
    return res
      .status(400)
      .json({ message: "Minimum age cannot be greater than maximum age" });
  }

  category.minAge = minAgeValue;
  category.maxAge = maxAgeValue;

  if (titles !== undefined) {
    category.titles = normaliseTitles(titles);
  }

  if (isActive !== undefined) {
    category.isActive = Boolean(isActive);
  }

  await category.save();

  res.json({
    message: "Category updated successfully",
    category,
  });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid category identifier" });
  }

  const category = await Category.findById(id);

  if (!category) {
    return res.status(404).json({ message: "Category not found" });
  }

  await category.deleteOne();

  res.json({ message: "Category deleted successfully" });
});

export const recalculateNationalCategories = asyncHandler(async (req, res) => {
  const { season } = req.body || {};
  let seasonYear = Number.parseInt(season, 10);

  if (Number.isNaN(seasonYear)) {
    seasonYear = getSeasonYear();
  }

  const result = await assignNationalCategoriesForSeason(seasonYear);

  res.json({
    message: "National categories recalculated",
    season: seasonYear,
    ...result,
  });
});
