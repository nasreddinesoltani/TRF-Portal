import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Country from "../Models/countryModel.js";

const normaliseNames = (names = {}) => ({
  en: typeof names.en === "string" ? names.en.trim() : undefined,
  fr: typeof names.fr === "string" ? names.fr.trim() : undefined,
  ar: typeof names.ar === "string" ? names.ar.trim() : undefined,
});

const parseCode = (value) => {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase();
};

// GET /api/countries  (public) — list active countries
export const listCountries = asyncHandler(async (req, res) => {
  const { includeInactive, isTrf } = req.query;

  const filters = {};
  if (!includeInactive || includeInactive === "false") {
    filters.isActive = true;
  }
  if (isTrf === "true") {
    filters.isTrf = true;
  }

  const countries = await Country.find(filters)
    .sort({ sortOrder: 1, "names.en": 1 })
    .lean();

  res.json(countries);
});

// GET /api/countries/:code  (public) — one country by alpha-3 code
export const getCountryByCode = asyncHandler(async (req, res) => {
  const code = parseCode(req.params.code);
  if (!code) {
    return res.status(400).json({ message: "Country code is required" });
  }

  const country = await Country.findOne({ code }).lean();
  if (!country) {
    return res.status(404).json({ message: "Country not found" });
  }

  res.json(country);
});

// POST /api/countries  (admin)
export const createCountry = asyncHandler(async (req, res) => {
  const {
    code,
    codeAlpha2,
    iocCode,
    names,
    flagUrl,
    federationCode,
    federationNames,
    isTrf = false,
    isActive = true,
    sortOrder = 0,
  } = req.body;

  const normalisedCode = parseCode(code);
  if (!normalisedCode) {
    return res.status(400).json({ message: "Country code is required" });
  }
  if (!names || typeof names.en !== "string" || !names.en.trim()) {
    return res
      .status(400)
      .json({ message: "English name (names.en) is required" });
  }

  const existing = await Country.findOne({ code: normalisedCode });
  if (existing) {
    return res
      .status(409)
      .json({ message: `Country code ${normalisedCode} already exists` });
  }

  const country = await Country.create({
    code: normalisedCode,
    codeAlpha2: parseCode(codeAlpha2),
    iocCode: parseCode(iocCode),
    names: normaliseNames(names),
    flagUrl,
    federationCode: parseCode(federationCode),
    federationNames: normaliseNames(federationNames),
    isTrf: Boolean(isTrf),
    isActive: Boolean(isActive),
    sortOrder: Number(sortOrder) || 0,
  });

  res.status(201).json({
    message: "Country created successfully",
    country,
  });
});

// PUT /api/countries/:id  (admin)
export const updateCountry = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid country identifier" });
  }

  const country = await Country.findById(id);
  if (!country) {
    return res.status(404).json({ message: "Country not found" });
  }

  const {
    code,
    codeAlpha2,
    iocCode,
    names,
    flagUrl,
    federationCode,
    federationNames,
    isTrf,
    isActive,
    sortOrder,
  } = req.body;

  if (code !== undefined) {
    const normalisedCode = parseCode(code);
    if (!normalisedCode) {
      return res.status(400).json({ message: "Country code cannot be empty" });
    }
    const clash = await Country.findOne({
      code: normalisedCode,
      _id: { $ne: country._id },
    });
    if (clash) {
      return res
        .status(409)
        .json({ message: `Country code ${normalisedCode} already exists` });
    }
    country.code = normalisedCode;
  }

  if (codeAlpha2 !== undefined) country.codeAlpha2 = parseCode(codeAlpha2);
  if (iocCode !== undefined) country.iocCode = parseCode(iocCode);
  if (names !== undefined) country.names = normaliseNames(names);
  if (flagUrl !== undefined) country.flagUrl = flagUrl;
  if (federationCode !== undefined)
    country.federationCode = parseCode(federationCode);
  if (federationNames !== undefined)
    country.federationNames = normaliseNames(federationNames);
  if (isTrf !== undefined) country.isTrf = Boolean(isTrf);
  if (isActive !== undefined) country.isActive = Boolean(isActive);
  if (sortOrder !== undefined) country.sortOrder = Number(sortOrder) || 0;

  await country.save();

  res.json({
    message: "Country updated successfully",
    country,
  });
});

// DELETE /api/countries/:id  (admin)
export const deleteCountry = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid country identifier" });
  }

  const country = await Country.findById(id);
  if (!country) {
    return res.status(404).json({ message: "Country not found" });
  }

  await country.deleteOne();

  res.json({ message: "Country deleted successfully" });
});
