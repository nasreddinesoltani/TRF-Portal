import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import Athlete from "../Models/athleteModel.js";
import TransferRequest from "../Models/transferRequestModel.js";
import AthleteDeletionRequest from "../Models/athleteDeletionRequestModel.js";
import Club from "../Models/clubModel.js";
import LicenseCounter from "../Models/licenseCounterModel.js";
import { importPhotos } from "../scripts/organizeAndImportPhotos.mjs";
import {
  getNextLicense,
  syncLicenseCounter,
} from "../Services/licenseService.js";
import {
  applyDocumentStatusToAthlete,
  DOCUMENT_DEFINITIONS,
  evaluateDocumentStatuses,
  getDocumentDefinition,
  normalizeDocumentType,
  serialiseDocument,
  serialiseDocuments,
} from "../Services/documentStatusService.js";
import {
  ensureNationalCategoryForAthlete,
  ensureNationalCategoriesForAthletes,
  getSeasonYear,
} from "../Services/categoryAssignmentService.js";
import { ATHLETE_UPLOAD_ROOT, UPLOADS_ROOT } from "../config/upload.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const normalizeArabic = (value = "") => value.trim();
const normalizeIdentifier = (value = "") => value.trim();
const MAX_LICENSE_ATTEMPTS = 5;
const { promises: fsPromises } = fs;
const LICENSE_ATTENTION_STATUSES = [
  "pending_documents",
  "expired_medical",
  "suspended",
];

const resolveUserId = (user) => {
  if (!user) {
    return undefined;
  }
  if (user._id) {
    return user._id;
  }
  if (user.id) {
    return user.id;
  }
  return undefined;
};

const resolveStoragePath = (storagePath) => {
  if (!storagePath) {
    return null;
  }

  const absolute = path.isAbsolute(storagePath)
    ? storagePath
    : path.join(UPLOADS_ROOT, storagePath);
  const normalised = path.normalize(absolute);
  const relative = path.relative(UPLOADS_ROOT, normalised);

  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  return normalised;
};

const toRelativeStoragePath = (absolutePath) => {
  if (!absolutePath) {
    return null;
  }

  const normalised = path.normalize(absolutePath);
  const relative = path.relative(UPLOADS_ROOT, normalised);

  if (!relative || relative.startsWith("..")) {
    return normalised;
  }

  return relative;
};

const deleteFileQuietly = async (filePath) => {
  if (!filePath) {
    return;
  }

  try {
    await fsPromises.unlink(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return;
    }
    console.warn("Failed to remove file", filePath, error?.message);
  }
};

const deleteDocumentFileIfExists = async (storagePath) => {
  const absolutePath = resolveStoragePath(storagePath);
  if (!absolutePath) {
    return;
  }
  await deleteFileQuietly(absolutePath);
};

const ensureDocumentContainer = (athlete) => {
  if (!athlete.documents) {
    athlete.documents = {};
  }
  return athlete.documents;
};

const saveAthleteWithEvaluation = async (athlete) => {
  const evaluation = applyDocumentStatusToAthlete(athlete);
  await athlete.save();
  return evaluation;
};

const isLicenseCollisionError = (error) => {
  if (!error) {
    return false;
  }

  const duplicateCode =
    error.code === 11000 ||
    error.code === 11001 ||
    error.code === 11002 ||
    error.codeName === "DuplicateKey" ||
    (typeof error.code === "string" && error.code.startsWith("E110")) ||
    (typeof error.message === "string" &&
      error.message.includes("duplicate key error"));

  if (!duplicateCode) {
    return false;
  }

  const keyPattern = error.keyPattern || {};
  if (keyPattern.licenseSequence || keyPattern.licenseNumber) {
    return true;
  }

  if (typeof error.message === "string") {
    return (
      error.message.includes("licenseSequence") ||
      error.message.includes("licenseNumber")
    );
  }

  return false;
};

const buildDuplicateQuery = ({ firstNameAr, lastNameAr, birthDate }) => {
  if (!firstNameAr || !lastNameAr || !birthDate) {
    return null;
  }

  return {
    firstNameAr: {
      $regex: new RegExp(`^${normalizeArabic(firstNameAr)}$`, "i"),
    },
    lastNameAr: { $regex: new RegExp(`^${normalizeArabic(lastNameAr)}$`, "i") },
    birthDate: new Date(birthDate),
  };
};

export const performAthleteDeletion = async (athlete) => {
  if (!athlete || !athlete._id) {
    throw new Error("Invalid athlete reference supplied for deletion");
  }

  await TransferRequest.deleteMany({ athlete: athlete._id });
  await athlete.deleteOne();
};

export const syncLicenseCounterHandler = asyncHandler(async (req, res) => {
  const sequenceValue = await syncLicenseCounter();
  res.json({
    message: "License counter synchronised",
    sequenceValue,
  });
});

// @desc    Search athletes (basic text search)
// @route   GET /api/athletes
// @access  Authenticated
export const searchAthletes = asyncHandler(async (req, res) => {
  const {
    q,
    clubId,
    limit = 25,
    birthDate,
    membershipStatus,
    licenseStatus,
    gender,
  } = req.query;
  const filters = {};

  if (q) {
    const queryRegex = new RegExp(q, "i");
    filters.$or = [
      { firstName: queryRegex },
      { lastName: queryRegex },
      { firstNameAr: queryRegex },
      { lastNameAr: queryRegex },
      { licenseNumber: queryRegex },
      { cin: queryRegex },
      { passportNumber: queryRegex },
    ];
  }

  if (gender) {
    const normalizedGender = gender.toString().toLowerCase();
    if (["male", "female"].includes(normalizedGender)) {
      filters.gender = normalizedGender;
    }
  }

  if (licenseStatus && licenseStatus !== "all") {
    const normalizedLicenseStatus = licenseStatus.toString().toLowerCase();

    if (normalizedLicenseStatus === "needs_attention") {
      filters.status = { $in: LICENSE_ATTENTION_STATUSES };
    } else if (
      ["active", "pending_documents", "expired_medical", "suspended"].includes(
        normalizedLicenseStatus
      )
    ) {
      filters.status = normalizedLicenseStatus;
    }
  }

  if (birthDate) {
    const parsed = new Date(birthDate);
    if (!Number.isNaN(parsed.getTime())) {
      const startOfDay = new Date(parsed);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(parsed);
      endOfDay.setHours(23, 59, 59, 999);
      filters.birthDate = { $gte: startOfDay, $lte: endOfDay };
    }
  }

  const membershipMatch = {};

  if (clubId && mongoose.Types.ObjectId.isValid(clubId)) {
    membershipMatch.club = new mongoose.Types.ObjectId(clubId);
  }

  if (membershipStatus && membershipStatus !== "all") {
    const normalizedMembershipStatus = membershipStatus
      .toString()
      .toLowerCase();
    if (
      ["active", "inactive", "pending", "transferred"].includes(
        normalizedMembershipStatus
      )
    ) {
      membershipMatch.status = normalizedMembershipStatus;
    }
  }

  if (Object.keys(membershipMatch).length > 0) {
    filters.memberships = { $elemMatch: membershipMatch };
  }

  const athletes = await Athlete.find(filters)
    .sort({ lastName: 1 })
    .limit(Number(limit))
    .populate("memberships.club", "name code type");

  const seasonYear = getSeasonYear();
  const categoryCache = {};
  await ensureNationalCategoriesForAthletes(
    athletes,
    seasonYear,
    categoryCache
  );

  athletes.forEach((athlete) => {
    const evaluation = evaluateDocumentStatuses(athlete);
    if (!athlete.documentsStatus) {
      athlete.documentsStatus = evaluation.status;
    }
    if (
      !Array.isArray(athlete.documentsIssues) ||
      !athlete.documentsIssues.length
    ) {
      athlete.documentsIssues = evaluation.issues || [];
    }
  });

  res.json(athletes);
});

// @desc    Retrieve global athlete/license statistics
// @route   GET /api/athletes/stats
// @access  Authenticated (roles: admin, club_manager, jury_president, umpire)
export const getAthleteStatistics = asyncHandler(async (req, res) => {
  const currentSeason = new Date().getFullYear();

  const [
    total,
    byStatusAgg,
    byGenderAgg,
    licensedCount,
    uniqueClubAgg,
    lastUpdatedEntry,
    // Current season stats - only athletes with active membership in current season
    currentSeasonAgg,
  ] = await Promise.all([
    Athlete.countDocuments(),
    Athlete.aggregate([
      {
        $group: {
          _id: {
            $cond: [
              { $ifNull: ["$status", false] },
              { $toLower: "$status" },
              "pending_documents",
            ],
          },
          count: { $sum: 1 },
        },
      },
    ]),
    Athlete.aggregate([
      {
        $group: {
          _id: {
            $cond: [
              { $ifNull: ["$gender", false] },
              { $toLower: "$gender" },
              "unknown",
            ],
          },
          count: { $sum: 1 },
        },
      },
    ]),
    Athlete.countDocuments({ licenseNumber: { $nin: [null, ""] } }),
    Athlete.aggregate([
      {
        $unwind: {
          path: "$memberships",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $match: {
          "memberships.club": { $ne: null },
        },
      },
      {
        $group: {
          _id: "$memberships.club",
        },
      },
      {
        $count: "count",
      },
    ]),
    Athlete.findOne({}, { updatedAt: 1 }).sort({ updatedAt: -1 }).lean(),
    // Current season aggregation - athletes with ACTIVE membership in current season
    Athlete.aggregate([
      {
        $match: {
          memberships: {
            $elemMatch: {
              season: currentSeason,
              status: "active",
            },
          },
        },
      },
      {
        $facet: {
          total: [{ $count: "count" }],
          byLicenseStatus: [
            {
              $group: {
                _id: {
                  $cond: [
                    { $ifNull: ["$status", false] },
                    { $toLower: "$status" },
                    "pending_documents",
                  ],
                },
                count: { $sum: 1 },
              },
            },
          ],
          byGender: [
            {
              $group: {
                _id: {
                  $cond: [
                    { $ifNull: ["$gender", false] },
                    { $toLower: "$gender" },
                    "unknown",
                  ],
                },
                count: { $sum: 1 },
              },
            },
          ],
          licensed: [
            {
              $match: { licenseNumber: { $nin: [null, ""] } },
            },
            { $count: "count" },
          ],
        },
      },
    ]),
  ]);

  const normaliseFacet = (aggArray = []) => {
    const map = new Map();
    aggArray.forEach((entry) => {
      if (!entry) {
        return;
      }
      const key = (entry._id || "").toString();
      map.set(key, entry.count || 0);
    });
    return map;
  };

  const statusMap = normaliseFacet(byStatusAgg);
  const genderMap = normaliseFacet(byGenderAgg);

  const byStatus = {
    active: statusMap.get("active") || 0,
    pending_documents: statusMap.get("pending_documents") || 0,
    expired_medical: statusMap.get("expired_medical") || 0,
    suspended: statusMap.get("suspended") || 0,
    inactive: statusMap.get("inactive") || 0,
  };

  const byGender = {
    male: genderMap.get("male") || 0,
    female: genderMap.get("female") || 0,
    unknown: genderMap.get("unknown") || 0,
  };

  const attentionSummary = LICENSE_ATTENTION_STATUSES.reduce(
    (accumulator, statusKey) => {
      const count = byStatus[statusKey] || 0;
      accumulator.total += count;
      if (statusKey === "pending_documents") {
        accumulator.pendingDocuments = count;
      } else if (statusKey === "expired_medical") {
        accumulator.expiredMedical = count;
      } else if (statusKey === "suspended") {
        accumulator.suspended = count;
      }
      return accumulator;
    },
    { total: 0, pendingDocuments: 0, expiredMedical: 0, suspended: 0 }
  );

  const uniqueClubs = uniqueClubAgg?.[0]?.count || 0;
  const lastUpdated = lastUpdatedEntry?.updatedAt || null;

  // Process current season stats (only athletes with ACTIVE membership)
  const seasonData = currentSeasonAgg?.[0] || {};
  const seasonStatusMap = normaliseFacet(seasonData.byLicenseStatus || []);
  const seasonGenderMap = normaliseFacet(seasonData.byGender || []);

  const currentSeasonStats = {
    total: seasonData.total?.[0]?.count || 0,
    licensed: seasonData.licensed?.[0]?.count || 0,
    byStatus: {
      active: seasonStatusMap.get("active") || 0,
      pending_documents: seasonStatusMap.get("pending_documents") || 0,
      expired_medical: seasonStatusMap.get("expired_medical") || 0,
      suspended: seasonStatusMap.get("suspended") || 0,
      inactive: seasonStatusMap.get("inactive") || 0,
    },
    byGender: {
      male: seasonGenderMap.get("male") || 0,
      female: seasonGenderMap.get("female") || 0,
      unknown: seasonGenderMap.get("unknown") || 0,
    },
    // Attention: athletes with ACTIVE membership who have license issues
    attention: {
      total:
        (seasonStatusMap.get("pending_documents") || 0) +
        (seasonStatusMap.get("expired_medical") || 0) +
        (seasonStatusMap.get("suspended") || 0),
      pendingDocuments: seasonStatusMap.get("pending_documents") || 0,
      expiredMedical: seasonStatusMap.get("expired_medical") || 0,
      suspended: seasonStatusMap.get("suspended") || 0,
    },
  };

  return res.json({
    total,
    licensed: licensedCount,
    byStatus,
    byGender,
    attention: attentionSummary,
    uniqueClubs,
    lastUpdated,
    // New: current season specific stats
    currentSeason,
    season: currentSeasonStats,
  });
});

// @desc    Create athlete with automatic license and duplicate check
// @route   POST /api/athletes
// @access  Admin, Club manager
export const createAthlete = asyncHandler(async (req, res) => {
  const {
    firstName,
    lastName,
    firstNameAr,
    lastNameAr,
    birthDate,
    gender,
    nationality,
    cin,
    passportNumber,
    documents = {},
    membership,
    licenseStatus,
  } = req.body;

  const allowedMembershipStatuses = [
    "active",
    "inactive",
    "pending",
    "transferred",
  ];

  if (
    membership?.status &&
    !allowedMembershipStatuses.includes(membership.status)
  ) {
    return res.status(400).json({ message: "Invalid membership status" });
  }

  if (
    !firstName ||
    !lastName ||
    !firstNameAr ||
    !lastNameAr ||
    !birthDate ||
    !gender
  ) {
    return res.status(400).json({ message: "Missing required athlete fields" });
  }

  const allowedLicenseStatuses = ["active", "inactive", "pending", "suspended"];
  const normalizedLicenseStatus = licenseStatus
    ? licenseStatus.toString().toLowerCase()
    : "inactive";

  if (!allowedLicenseStatuses.includes(normalizedLicenseStatus)) {
    return res.status(400).json({ message: "Invalid license status" });
  }

  const normalizedCin = cin ? normalizeIdentifier(cin) : undefined;
  const normalizedPassport = passportNumber
    ? normalizeIdentifier(passportNumber)
    : undefined;

  if (normalizedCin) {
    const existingByCin = await Athlete.findOne({ cin: normalizedCin });
    if (existingByCin) {
      return res.status(409).json({
        message: "An athlete with this CIN already exists",
        athlete: existingByCin,
      });
    }
  }

  if (normalizedPassport) {
    const existingByPassport = await Athlete.findOne({
      passportNumber: normalizedPassport,
    });
    if (existingByPassport) {
      return res.status(409).json({
        message: "An athlete with this passport number already exists",
        athlete: existingByPassport,
      });
    }
  }

  const duplicateQuery = buildDuplicateQuery({
    firstNameAr,
    lastNameAr,
    birthDate,
  });

  if (duplicateQuery) {
    const existing = await Athlete.findOne(duplicateQuery);
    if (existing) {
      return res
        .status(409)
        .json({ message: "Athlete already exists", athlete: existing });
    }
  }

  const membershipEntries = [];
  const season = new Date().getFullYear();

  const clubIdFromRequest = membership?.clubId || req.user?.clubId;

  if (clubIdFromRequest && mongoose.Types.ObjectId.isValid(clubIdFromRequest)) {
    membershipEntries.push({
      club: new mongoose.Types.ObjectId(clubIdFromRequest),
      season,
      status: "active",
    });
  }

  let lastLicenseError = null;

  for (let attempt = 0; attempt < MAX_LICENSE_ATTEMPTS; attempt += 1) {
    const { sequence, licenseNumber, year } = await getNextLicense();

    try {
      const athlete = await Athlete.create({
        firstName,
        lastName,
        firstNameAr: normalizeArabic(firstNameAr),
        lastNameAr: normalizeArabic(lastNameAr),
        birthDate,
        gender,
        nationality,
        cin: normalizedCin,
        passportNumber: normalizedPassport,
        licenseNumber,
        licenseSequence: sequence,
        licenseYear: year,
        licenseStatus: normalizedLicenseStatus,
        documents,
        memberships: membershipEntries,
        createdBy: req.user?.id,
      });

      const evaluation = await saveAthleteWithEvaluation(athlete);
      const seasonYear = getSeasonYear();
      const categoryCache = {};
      await ensureNationalCategoryForAthlete(
        athlete,
        seasonYear,
        categoryCache
      );
      await athlete.populate("memberships.club", "name");

      const athletePayload = athlete.toObject({ virtuals: false });
      athletePayload.documents = serialiseDocuments(athlete.documents);

      return res.status(201).json({
        message: "Athlete created successfully",
        athlete: athletePayload,
        evaluation,
      });
    } catch (error) {
      if (isLicenseCollisionError(error)) {
        lastLicenseError = error;
        console.warn(
          `Duplicate license detected (sequence ${sequence}). Resync attempt ${
            attempt + 1
          }/${MAX_LICENSE_ATTEMPTS}.`
        );
        await syncLicenseCounter();
        continue;
      }

      throw error;
    }
  }

  console.error(
    "Unable to allocate a unique license number after multiple attempts.",
    lastLicenseError
  );

  return res.status(500).json({
    message:
      "Unable to generate a unique license number at this time. Please try again.",
  });
});

// @desc    Update an existing athlete
// @route   PUT /api/athletes/:id
// @access  Admin, Club manager
export const updateAthlete = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid athlete identifier" });
  }

  const athlete = await Athlete.findById(id);

  if (!athlete) {
    return res.status(404).json({ message: "Athlete not found" });
  }

  const {
    firstName,
    lastName,
    firstNameAr,
    lastNameAr,
    birthDate,
    gender,
    nationality,
    cin,
    passportNumber,
    documents,
    membership,
    licenseStatus,
  } = req.body;

  const candidateFirstNameAr =
    firstNameAr !== undefined ? firstNameAr : athlete.firstNameAr;
  const candidateLastNameAr =
    lastNameAr !== undefined ? lastNameAr : athlete.lastNameAr;
  const candidateBirthDate =
    birthDate !== undefined ? birthDate : athlete.birthDate;

  const duplicateQuery = buildDuplicateQuery({
    firstNameAr: candidateFirstNameAr,
    lastNameAr: candidateLastNameAr,
    birthDate: candidateBirthDate,
  });

  if (duplicateQuery) {
    const existing = await Athlete.findOne({
      ...duplicateQuery,
      _id: { $ne: athlete._id },
    });

    if (existing) {
      return res.status(409).json({
        message:
          "An athlete with the same Arabic name and birth date already exists",
        athlete: existing,
      });
    }
  }

  if (cin !== undefined) {
    const normalizedCin = normalizeIdentifier(cin || "");

    if (normalizedCin) {
      const existingByCin = await Athlete.findOne({
        cin: normalizedCin,
        _id: { $ne: athlete._id },
      });

      if (existingByCin) {
        return res.status(409).json({
          message: "An athlete with this CIN already exists",
          athlete: existingByCin,
        });
      }

      athlete.cin = normalizedCin;
    } else {
      athlete.cin = undefined;
    }
  }

  if (passportNumber !== undefined) {
    const normalizedPassport = normalizeIdentifier(passportNumber || "");

    if (normalizedPassport) {
      const existingByPassport = await Athlete.findOne({
        passportNumber: normalizedPassport,
        _id: { $ne: athlete._id },
      });

      if (existingByPassport) {
        return res.status(409).json({
          message: "An athlete with this passport number already exists",
          athlete: existingByPassport,
        });
      }

      athlete.passportNumber = normalizedPassport;
    } else {
      athlete.passportNumber = undefined;
    }
  }

  if (firstName !== undefined) {
    athlete.firstName = firstName;
  }

  if (lastName !== undefined) {
    athlete.lastName = lastName;
  }

  if (firstNameAr !== undefined) {
    athlete.firstNameAr = normalizeArabic(firstNameAr);
  }

  if (lastNameAr !== undefined) {
    athlete.lastNameAr = normalizeArabic(lastNameAr);
  }

  if (birthDate !== undefined) {
    athlete.birthDate = birthDate;
  }

  if (gender !== undefined) {
    athlete.gender = gender;
  }

  if (nationality !== undefined) {
    athlete.nationality = nationality;
  }

  if (documents) {
    athlete.documents = { ...(athlete.documents || {}), ...documents };
  }

  if (licenseStatus !== undefined) {
    const normalizedLicenseStatus = licenseStatus
      ? licenseStatus.toString().toLowerCase()
      : "";
    const allowedLicenseStatuses = [
      "active",
      "inactive",
      "pending",
      "suspended",
    ];

    if (!allowedLicenseStatuses.includes(normalizedLicenseStatus)) {
      return res.status(400).json({ message: "Invalid license status" });
    }

    athlete.licenseStatus = normalizedLicenseStatus;
  }

  const requestedClubId = membership?.clubId;
  const previousClubId = membership?.previousClubId;

  if (requestedClubId && req.user?.role !== "admin") {
    return res.status(403).json({
      message: "Only administrators can reassign athlete clubs",
    });
  }

  const normalizeIncomingClubId = (value) => {
    if (!value) {
      return undefined;
    }

    if (value instanceof mongoose.Types.ObjectId) {
      return value.toString();
    }

    if (typeof value === "string" && mongoose.Types.ObjectId.isValid(value)) {
      return new mongoose.Types.ObjectId(value).toString();
    }

    if (
      typeof value === "object" &&
      value !== null &&
      value._id &&
      mongoose.Types.ObjectId.isValid(value._id)
    ) {
      return new mongoose.Types.ObjectId(value._id).toString();
    }

    if (typeof value.toString === "function") {
      const candidate = value.toString();
      if (mongoose.Types.ObjectId.isValid(candidate)) {
        return new mongoose.Types.ObjectId(candidate).toString();
      }
      return candidate;
    }

    return undefined;
  };

  if (requestedClubId && mongoose.Types.ObjectId.isValid(requestedClubId)) {
    const resolveClubIdString = (clubReference) => {
      if (!clubReference) {
        return undefined;
      }

      if (typeof clubReference === "string") {
        return clubReference;
      }

      if (clubReference instanceof mongoose.Types.ObjectId) {
        return clubReference.toString();
      }

      if (
        typeof clubReference === "object" &&
        clubReference !== null &&
        clubReference._id
      ) {
        return clubReference._id.toString();
      }

      if (typeof clubReference.toString === "function") {
        return clubReference.toString();
      }

      return undefined;
    };

    const now = new Date();
    const targetObjectId = new mongoose.Types.ObjectId(requestedClubId);
    const targetClubIdString = targetObjectId.toString();
    const previousClubIdString = normalizeIncomingClubId(previousClubId);

    const findMembershipByClub = (clubIdString) =>
      athlete.memberships?.find((entry) => {
        const entryClubId = resolveClubIdString(entry.club);
        return entryClubId === clubIdString;
      }) || null;

    const targetMembership = findMembershipByClub(targetClubIdString);

    let currentMembership = null;

    if (previousClubIdString && previousClubIdString !== targetClubIdString) {
      currentMembership = findMembershipByClub(previousClubIdString);
    }

    if (!currentMembership) {
      currentMembership =
        athlete.memberships?.find((entry) => {
          const entryClubId = resolveClubIdString(entry.club);
          if (!entryClubId || entryClubId === targetClubIdString) {
            return false;
          }
          return entry.status !== "transferred";
        }) || null;
    }

    if (currentMembership) {
      const currentClubIdString = resolveClubIdString(currentMembership.club);

      if (currentClubIdString && currentClubIdString !== targetClubIdString) {
        currentMembership.status = "transferred";
        currentMembership.endDate = now;

        if (!currentMembership.startDate) {
          currentMembership.startDate = now;
        }
      }
    }

    if (targetMembership) {
      targetMembership.status = membership?.status || "active";
      targetMembership.season =
        membership?.season || targetMembership.season || now.getFullYear();
      targetMembership.startDate = targetMembership.startDate || now;
      targetMembership.endDate = undefined;
    } else {
      athlete.memberships.push({
        club: targetObjectId,
        season: membership?.season || now.getFullYear(),
        status: membership?.status || "active",
        startDate: now,
      });
    }
  }

  const evaluation = await saveAthleteWithEvaluation(athlete);
  const seasonYear = getSeasonYear();
  const categoryCache = {};
  await ensureNationalCategoryForAthlete(athlete, seasonYear, categoryCache);
  await athlete.populate("memberships.club", "name");

  const athletePayload = athlete.toObject({ virtuals: false });
  athletePayload.documents = serialiseDocuments(athlete.documents);

  res.json({
    message: "Athlete updated successfully",
    athlete: athletePayload,
    evaluation,
  });
});

export const updateAthleteLicenseStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { licenseStatus } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid athlete identifier" });
  }

  if (!licenseStatus) {
    return res.status(400).json({ message: "License status is required" });
  }

  const normalizedLicenseStatus = licenseStatus.toString().toLowerCase();
  const allowedLicenseStatuses = ["active", "inactive", "pending", "suspended"];

  if (!allowedLicenseStatuses.includes(normalizedLicenseStatus)) {
    return res.status(400).json({ message: "Invalid license status" });
  }

  const athlete = await Athlete.findByIdAndUpdate(
    id,
    { licenseStatus: normalizedLicenseStatus },
    { new: true, runValidators: false }
  ).populate("memberships.club", "name");

  if (!athlete) {
    return res.status(404).json({ message: "Athlete not found" });
  }

  res.json({
    message: "License status updated successfully",
    athlete,
  });
});

export const listAthleteDocuments = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid athlete identifier" });
  }

  const athlete = await Athlete.findById(id);

  if (!athlete) {
    return res.status(404).json({ message: "Athlete not found" });
  }

  const evaluation = evaluateDocumentStatuses(athlete);

  const definitions = Object.keys(DOCUMENT_DEFINITIONS).map((key) => ({
    ...DOCUMENT_DEFINITIONS[key],
  }));

  return res.json({
    message: "Athlete documents retrieved",
    athleteId: athlete._id,
    status: athlete.status,
    documents: serialiseDocuments(athlete.documents || {}),
    evaluation,
    definitions,
  });
});

export const getAthleteDocumentStatus = asyncHandler(async (req, res) => {
  const { id, docType } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid athlete identifier" });
  }

  const normalizedDocType = normalizeDocumentType(docType);
  if (!normalizedDocType) {
    return res.status(400).json({ message: "Unsupported document type" });
  }

  const athlete = await Athlete.findById(id);

  if (!athlete) {
    return res.status(404).json({ message: "Athlete not found" });
  }

  const evaluation = evaluateDocumentStatuses(athlete);
  const definition = getDocumentDefinition(normalizedDocType);
  const document = serialiseDocument(
    athlete.documents?.[normalizedDocType] || null
  );
  const state =
    evaluation.documentStates?.[normalizedDocType] ??
    (document ? "pending" : "missing");

  return res.json({
    message: "Document status retrieved",
    athleteId: athlete._id,
    documentType: normalizedDocType,
    definition,
    state,
    document,
    evaluation,
  });
});

export const uploadAthleteDocument = asyncHandler(async (req, res) => {
  const { id, docType } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    await deleteFileQuietly(req.file?.path);
    return res.status(400).json({ message: "Invalid athlete identifier" });
  }

  const normalizedDocType = normalizeDocumentType(docType);

  if (!normalizedDocType) {
    await deleteFileQuietly(req.file?.path);
    return res.status(400).json({ message: "Unsupported document type" });
  }

  if (!req.file) {
    return res.status(400).json({ message: "Document file is required" });
  }

  const athlete = await Athlete.findById(id);

  if (!athlete) {
    await deleteFileQuietly(req.file?.path);
    return res.status(404).json({ message: "Athlete not found" });
  }

  try {
    const documents = ensureDocumentContainer(athlete);
    const previousDocument = documents[normalizedDocType];

    if (previousDocument?.storagePath) {
      await deleteDocumentFileIfExists(previousDocument.storagePath);
    }

    const relativePath = toRelativeStoragePath(req.file.path);
    const metadata = {
      originalName: req.file.originalname,
      storedName: req.file.filename,
      fieldName: req.file.fieldname,
    };

    if (req.body && typeof req.body === "object") {
      Object.keys(req.body).forEach((key) => {
        if (!metadata[key] && typeof req.body[key] === "string") {
          metadata[key] = req.body[key];
        }
      });
    }

    documents[normalizedDocType] = {
      fileName: req.file.filename || req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      storagePath: relativePath,
      url: null,
      uploadedAt: new Date(),
      uploadedBy: resolveUserId(req.user),
      status: "pending",
      verifiedAt: undefined,
      verifiedBy: undefined,
      note: undefined,
      rejectionReason: undefined,
      metadata,
    };

    const definition = getDocumentDefinition(normalizedDocType);

    if (definition?.requiresExpiry && req.body?.expiresAt) {
      const expiryDate = new Date(req.body.expiresAt);
      if (Number.isNaN(expiryDate.getTime())) {
        await deleteDocumentFileIfExists(relativePath);
        await deleteFileQuietly(req.file?.path);
        return res.status(400).json({ message: "Invalid expiresAt value" });
      }
      documents[normalizedDocType].expiresAt = expiryDate;
    }

    const evaluation = await saveAthleteWithEvaluation(athlete);
    const documentPayload = serialiseDocument(
      athlete.documents?.[normalizedDocType]
    );

    return res.json({
      message: "Document uploaded successfully",
      athleteId: athlete._id,
      documentType: normalizedDocType,
      document: documentPayload,
      evaluation,
    });
  } catch (error) {
    await deleteFileQuietly(req.file?.path);
    throw error;
  }
});

export const approveAthleteDocument = asyncHandler(async (req, res) => {
  const { id, docType } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid athlete identifier" });
  }

  const normalizedDocType = normalizeDocumentType(docType);
  if (!normalizedDocType) {
    return res.status(400).json({ message: "Unsupported document type" });
  }

  const athlete = await Athlete.findById(id);

  if (!athlete) {
    return res.status(404).json({ message: "Athlete not found" });
  }

  const documents = ensureDocumentContainer(athlete);
  const documentEntry = documents[normalizedDocType];

  if (!documentEntry) {
    return res.status(404).json({ message: "Document not found" });
  }

  const definition = getDocumentDefinition(normalizedDocType);
  const now = new Date();

  documentEntry.status = "approved";
  documentEntry.verifiedAt = now;
  documentEntry.verifiedBy = resolveUserId(req.user);
  documentEntry.rejectionReason = undefined;

  if (req.body?.note !== undefined) {
    documentEntry.note = req.body.note;
  }

  if (definition?.requiresExpiry) {
    if (req.body?.expiresAt) {
      const expiryDate = new Date(req.body.expiresAt);
      if (Number.isNaN(expiryDate.getTime())) {
        return res.status(400).json({ message: "Invalid expiresAt value" });
      }
      documentEntry.expiresAt = expiryDate;
    } else if (!documentEntry.expiresAt) {
      return res.status(400).json({
        message: "Medical certificate expiry date is required",
      });
    }
  }

  const evaluation = await saveAthleteWithEvaluation(athlete);
  const documentPayload = serialiseDocument(documentEntry);

  return res.json({
    message: "Document approved successfully",
    athleteId: athlete._id,
    documentType: normalizedDocType,
    document: documentPayload,
    evaluation,
  });
});

export const rejectAthleteDocument = asyncHandler(async (req, res) => {
  const { id, docType } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid athlete identifier" });
  }

  const normalizedDocType = normalizeDocumentType(docType);
  if (!normalizedDocType) {
    return res.status(400).json({ message: "Unsupported document type" });
  }

  const athlete = await Athlete.findById(id);

  if (!athlete) {
    return res.status(404).json({ message: "Athlete not found" });
  }

  const documents = ensureDocumentContainer(athlete);
  const documentEntry = documents[normalizedDocType];

  if (!documentEntry) {
    return res.status(404).json({ message: "Document not found" });
  }

  const now = new Date();
  const rejectionReason = req.body?.reason || req.body?.rejectionReason;

  documentEntry.status = "rejected";
  documentEntry.verifiedAt = now;
  documentEntry.verifiedBy = resolveUserId(req.user);
  documentEntry.rejectionReason =
    rejectionReason || documentEntry.rejectionReason || "Document rejected";

  if (req.body?.note !== undefined) {
    documentEntry.note = req.body.note;
  }

  const evaluation = await saveAthleteWithEvaluation(athlete);
  const documentPayload = serialiseDocument(documentEntry);

  return res.json({
    message: "Document rejected",
    athleteId: athlete._id,
    documentType: normalizedDocType,
    document: documentPayload,
    evaluation,
  });
});

export const updateMedicalCertificate = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid athlete identifier" });
  }

  const athlete = await Athlete.findById(id);

  if (!athlete) {
    return res.status(404).json({ message: "Athlete not found" });
  }

  const documents = ensureDocumentContainer(athlete);
  const documentEntry = documents.medicalCertificate;

  if (!documentEntry) {
    return res.status(404).json({ message: "Medical certificate not found" });
  }

  if (req.body?.expiresAt !== undefined) {
    const expiryDate = new Date(req.body.expiresAt);
    if (Number.isNaN(expiryDate.getTime())) {
      return res.status(400).json({ message: "Invalid expiresAt value" });
    }
    documentEntry.expiresAt = expiryDate;
  }

  if (req.body?.note !== undefined) {
    documentEntry.note = req.body.note;
  }

  if (req.body?.status !== undefined) {
    const status = req.body.status;
    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }
    documentEntry.status = status;

    if (status === "approved") {
      documentEntry.verifiedAt = new Date();
      documentEntry.verifiedBy = resolveUserId(req.user);
      documentEntry.rejectionReason = undefined;
    } else if (status === "rejected") {
      documentEntry.verifiedAt = new Date();
      documentEntry.verifiedBy = resolveUserId(req.user);
      documentEntry.rejectionReason =
        req.body?.reason ||
        documentEntry.rejectionReason ||
        "Document rejected";
    } else {
      documentEntry.verifiedAt = undefined;
      documentEntry.verifiedBy = undefined;
      documentEntry.rejectionReason = undefined;
    }
  }

  const evaluation = await saveAthleteWithEvaluation(athlete);
  const documentPayload = serialiseDocument(documentEntry);

  return res.json({
    message: "Medical certificate updated",
    athleteId: athlete._id,
    documentType: "medicalCertificate",
    document: documentPayload,
    evaluation,
  });
});

export const removeAthleteDocument = asyncHandler(async (req, res) => {
  const { id, docType } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid athlete identifier" });
  }

  const normalizedDocType = normalizeDocumentType(docType);
  if (!normalizedDocType) {
    return res.status(400).json({ message: "Unsupported document type" });
  }

  const athlete = await Athlete.findById(id);

  if (!athlete) {
    return res.status(404).json({ message: "Athlete not found" });
  }

  const documents = ensureDocumentContainer(athlete);
  const documentEntry = documents[normalizedDocType];

  if (!documentEntry) {
    return res.status(404).json({ message: "Document not found" });
  }

  await deleteDocumentFileIfExists(documentEntry.storagePath);
  delete documents[normalizedDocType];

  const evaluation = await saveAthleteWithEvaluation(athlete);

  return res.json({
    message: "Document removed",
    athleteId: athlete._id,
    documentType: normalizedDocType,
    documents: serialiseDocuments(athlete.documents || {}),
    evaluation,
  });
});

export const deleteAthlete = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid athlete identifier" });
  }

  const athlete = await Athlete.findById(id);

  if (!athlete) {
    return res.status(404).json({ message: "Athlete not found" });
  }

  if (req.user?.role !== "admin") {
    return res.status(403).json({
      message:
        "Only administrators can permanently delete athletes. Please submit a deletion request for approval.",
    });
  }

  await performAthleteDeletion(athlete);

  const resolvedBy = req.user?.id || req.user?._id || undefined;

  await AthleteDeletionRequest.updateMany(
    { athlete: athlete._id, status: "pending" },
    {
      status: "approved",
      resolvedBy,
      resolvedAt: new Date(),
      resolutionNotes: "Deletion completed by admin",
    }
  );

  res.json({ message: "Athlete deleted successfully" });
});

export const resetAthleteLicenseStatuses = asyncHandler(async (req, res) => {
  const { season, clubIds } = req.body || {};

  let seasonYear = Number.parseInt(season, 10);
  if (Number.isNaN(seasonYear)) {
    seasonYear = getSeasonYear();
  }

  const now = new Date();

  const filter = {};
  if (Array.isArray(clubIds) && clubIds.length) {
    const validClubIds = clubIds
      .map((value) => {
        if (mongoose.Types.ObjectId.isValid(value)) {
          return new mongoose.Types.ObjectId(value);
        }
        return null;
      })
      .filter(Boolean);

    if (validClubIds.length) {
      filter["memberships.club"] = { $in: validClubIds };
    }
  }

  const update = {
    $set: {
      licenseStatus: "inactive",
      updatedAt: now,
    },
  };

  const options = {};

  if (!Number.isNaN(seasonYear)) {
    update.$set["memberships.$[seasonEntry].status"] = "inactive";
    update.$set["memberships.$[seasonEntry].endDate"] = now;
    options.arrayFilters = [
      {
        "seasonEntry.season": seasonYear,
        "seasonEntry.status": { $in: ["active", "pending"] },
      },
    ];
  }

  const result = await Athlete.updateMany(filter, update, options);

  const matched = result?.matchedCount ?? result?.n ?? 0;
  const modified = result?.modifiedCount ?? result?.nModified ?? 0;

  res.json({
    message: "License statuses reset to inactive",
    season: seasonYear,
    matched,
    modified,
  });
});

export const importAthletesFromCsv = asyncHandler(async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ message: "CSV file is required" });
    }

    let records;

    try {
      records = parse(req.file.buffer, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        trim: true,
      });
    } catch (error) {
      console.error("Failed to parse athlete import CSV", error);
      return res.status(400).json({
        message: "Unable to parse CSV file",
        details: error.message,
      });
    }

    if (!Array.isArray(records)) {
      records = [];
    }

    // Log the columns found in the CSV for debugging
    if (records.length > 0) {
      console.log("CSV columns found:", Object.keys(records[0]));
      console.log("First row data:", records[0]);
    }

    const summary = {
      total: records.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      processed: 0,
    };

    // Case-insensitive column lookup
    const readStringValue = (record, ...keys) => {
      // First try exact match
      for (const key of keys) {
        if (record[key] !== undefined && record[key] !== null) {
          const candidate = record[key].toString().trim();
          if (candidate) {
            return candidate;
          }
        }
      }

      // Then try case-insensitive match
      const recordKeys = Object.keys(record);
      for (const key of keys) {
        const keyLower = key.toLowerCase();
        const matchedKey = recordKeys.find((k) => k.toLowerCase() === keyLower);
        if (
          matchedKey &&
          record[matchedKey] !== undefined &&
          record[matchedKey] !== null
        ) {
          const candidate = record[matchedKey].toString().trim();
          if (candidate) {
            return candidate;
          }
        }
      }

      return null;
    };

    const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const clubCache = new Map();

    // Sync license counter to max existing sequence before starting import
    const maxSeqAthlete = await Athlete.findOne({
      licenseSequence: { $exists: true },
    })
      .sort({ licenseSequence: -1 })
      .select("licenseSequence")
      .lean();

    if (maxSeqAthlete?.licenseSequence) {
      await LicenseCounter.findOneAndUpdate(
        { key: "athleteLicense" },
        { $max: { sequenceValue: maxSeqAthlete.licenseSequence } },
        { upsert: true }
      );
    }

    for (let index = 0; index < records.length; index += 1) {
      const rowNumber = index + 2;
      const row = records[index];

      if (!row || typeof row !== "object") {
        summary.skipped += 1;
        summary.errors.push({
          row: rowNumber,
          message: "Row is not a valid object",
        });
        continue;
      }

      // Read name fields - any name field can be used
      let firstName = readStringValue(row, "firstName", "first_name", "prenom");
      let lastName = readStringValue(row, "lastName", "last_name", "nom");
      let firstNameAr = readStringValue(
        row,
        "firstNameAr",
        "first_name_ar",
        "prenomAr"
      );
      let lastNameAr = readStringValue(
        row,
        "lastNameAr",
        "last_name_ar",
        "nomAr"
      );

      // Also support a single "name" or "fullName" column
      const fullName = readStringValue(
        row,
        "name",
        "fullName",
        "full_name",
        "nom_complet"
      );
      const fullNameAr = readStringValue(
        row,
        "nameAr",
        "fullNameAr",
        "nom_complet_ar"
      );

      // If full name provided, split into first/last (assumes "FirstName LastName" format)
      if (fullName && (!firstName || !lastName)) {
        const parts = fullName.trim().split(/\s+/);
        if (parts.length >= 2) {
          if (!firstName) firstName = parts[0];
          if (!lastName) lastName = parts.slice(1).join(" ");
        } else if (parts.length === 1) {
          if (!firstName) firstName = parts[0];
          if (!lastName) lastName = parts[0];
        }
      }

      if (fullNameAr && (!firstNameAr || !lastNameAr)) {
        const parts = fullNameAr.trim().split(/\s+/);
        if (parts.length >= 2) {
          if (!firstNameAr) firstNameAr = parts[0];
          if (!lastNameAr) lastNameAr = parts.slice(1).join(" ");
        } else if (parts.length === 1) {
          if (!firstNameAr) firstNameAr = parts[0];
          if (!lastNameAr) lastNameAr = parts[0];
        }
      }

      // Use any available first name for all first name fields
      const anyFirstName = firstName || firstNameAr;
      firstName = firstName || anyFirstName;
      firstNameAr = firstNameAr || anyFirstName;

      // Use any available last name for all last name fields
      let anyLastName = lastName || lastNameAr;

      // If we have a first name but no last name, try to split the first name
      // (handles case where full name was put in firstName/firstNameAr column)
      if (!anyLastName && anyFirstName) {
        const parts = anyFirstName.trim().split(/\s+/);
        if (parts.length >= 2) {
          // Use first part as first name, rest as last name
          const splitFirst = parts[0];
          const splitLast = parts.slice(1).join(" ");
          firstName = splitFirst;
          firstNameAr = splitFirst;
          lastName = splitLast;
          lastNameAr = splitLast;
          anyLastName = splitLast;
        } else {
          // Only one word - use it for both first and last name
          lastName = anyFirstName;
          lastNameAr = anyFirstName;
          anyLastName = anyFirstName;
        }
      } else {
        lastName = lastName || anyLastName;
        lastNameAr = lastNameAr || anyLastName;
      }

      const birthDateRaw = readStringValue(
        row,
        "birthDate",
        "birth_date",
        "dateNaissance"
      );
      const genderRaw = readStringValue(row, "gender", "sexe");
      const clubCodeRaw = readStringValue(row, "clubCode", "club", "club_code");

      // Validate required fields - only need ONE name (first or last, Arabic or Latin)
      const missingFields = [];
      if (!anyFirstName) missingFields.push("firstName or firstNameAr");
      if (!anyLastName) missingFields.push("lastName or lastNameAr");
      if (!birthDateRaw) missingFields.push("birthDate");
      if (!genderRaw) missingFields.push("gender");
      if (!clubCodeRaw) missingFields.push("clubCode");

      if (missingFields.length > 0) {
        summary.skipped += 1;
        summary.errors.push({
          row: rowNumber,
          message: `Missing required fields: ${missingFields.join(
            ", "
          )}. Available columns: ${Object.keys(row).join(", ")}`,
        });
        continue;
      }

      // Parse birth date
      let birthDate;
      try {
        birthDate = new Date(birthDateRaw);
        if (isNaN(birthDate.getTime())) {
          throw new Error("Invalid date");
        }
      } catch {
        summary.skipped += 1;
        summary.errors.push({
          row: rowNumber,
          message: `Invalid birthDate format: ${birthDateRaw}`,
        });
        continue;
      }

      // Normalize gender
      const genderLower = genderRaw.toLowerCase();
      let gender;
      if (["male", "m", "homme", "ذكر"].includes(genderLower)) {
        gender = "male";
      } else if (["female", "f", "femme", "أنثى"].includes(genderLower)) {
        gender = "female";
      } else {
        summary.skipped += 1;
        summary.errors.push({
          row: rowNumber,
          message: `Invalid gender value: ${genderRaw}. Use male/female or m/f`,
        });
        continue;
      }

      // Find club
      const normalizedClubCode = clubCodeRaw.trim();
      const cacheKey = normalizedClubCode.toLowerCase();
      let club = clubCache.get(cacheKey);

      if (!club) {
        const codeRegex = new RegExp(
          `^${escapeRegex(normalizedClubCode)}$`,
          "i"
        );
        club = await Club.findOne({ code: codeRegex });

        if (club) {
          clubCache.set(cacheKey, club);
        }
      }

      if (!club) {
        summary.skipped += 1;
        summary.errors.push({
          row: rowNumber,
          message: `Club not found: ${normalizedClubCode}`,
        });
        continue;
      }

      // Optional fields
      const cin = readStringValue(row, "cin", "CIN");
      const passportNumber = readStringValue(
        row,
        "passportNumber",
        "passport",
        "passeport"
      );
      const nationality =
        readStringValue(row, "nationality", "nationalite") || "Tunisia";
      const seasonRaw = readStringValue(row, "season");
      const season = seasonRaw ? parseInt(seasonRaw, 10) : getSeasonYear();
      const membershipStatus =
        readStringValue(row, "membershipStatus", "status") || "active";

      // Check for existing athlete by CIN or passport
      let existingAthlete = null;
      if (cin) {
        existingAthlete = await Athlete.findOne({ cin });
      }
      if (!existingAthlete && passportNumber) {
        existingAthlete = await Athlete.findOne({ passportNumber });
      }

      try {
        if (existingAthlete) {
          // Update existing athlete - add/update membership
          const existingMembership = existingAthlete.memberships?.find(
            (m) =>
              m.club.toString() === club._id.toString() && m.season === season
          );

          if (existingMembership) {
            // Update membership status
            await Athlete.updateOne(
              {
                _id: existingAthlete._id,
                "memberships.club": club._id,
                "memberships.season": season,
              },
              { $set: { "memberships.$.status": membershipStatus } }
            );
          } else {
            // Add new membership
            await Athlete.updateOne(
              { _id: existingAthlete._id },
              {
                $push: {
                  memberships: {
                    club: club._id,
                    season,
                    status: membershipStatus,
                    membershipType: "primary",
                    startDate: new Date(),
                  },
                },
              }
            );
          }
          summary.updated += 1;
        } else {
          // Create new athlete with auto-generated license
          const currentYear = new Date().getFullYear();
          const yearSuffix = currentYear.toString().slice(-2);

          // Retry loop for license collision handling
          let saved = false;
          let attempts = 0;
          const maxAttempts = 5;

          while (!saved && attempts < maxAttempts) {
            attempts += 1;

            // Get next license sequence
            const counter = await LicenseCounter.findOneAndUpdate(
              { key: "athleteLicense" },
              { $inc: { sequenceValue: 1 } },
              { new: true, upsert: true }
            );

            const licenseSequence = counter.sequenceValue;
            const licenseNumber = `${licenseSequence}-${yearSuffix}`;

            const newAthlete = new Athlete({
              firstName,
              lastName,
              firstNameAr,
              lastNameAr,
              birthDate,
              gender,
              nationality,
              cin: cin || undefined,
              passportNumber: passportNumber || undefined,
              licenseNumber,
              licenseSequence,
              licenseYear: currentYear,
              status: "pending_documents",
              memberships: [
                {
                  club: club._id,
                  season,
                  status: membershipStatus,
                  membershipType: "primary",
                  startDate: new Date(),
                },
              ],
            });

            try {
              await newAthlete.save();
              summary.created += 1;
              saved = true;
            } catch (saveError) {
              // Check if it's a duplicate key error on licenseSequence
              if (
                isLicenseCollisionError(saveError) &&
                attempts < maxAttempts
              ) {
                // Retry with next sequence
                continue;
              }
              throw saveError;
            }
          }

          if (!saved) {
            throw new Error(
              "Failed to generate unique license after multiple attempts"
            );
          }
        }
      } catch (error) {
        summary.failed += 1;
        summary.errors.push({
          row: rowNumber,
          message: `Failed to save athlete: ${error.message}`,
        });
      }

      summary.processed += 1;
    }

    return res.json({
      message: `Import completed: ${summary.created} created, ${summary.updated} updated, ${summary.failed} failed`,
      summary,
    });
  } catch (error) {
    console.error("Error processing athlete import", error);
    res.status(500).json({
      message: "Error processing athlete import",
      details: error.message,
    });
  }
});

export const bulkUpdateAthleteStatus = asyncHandler(async (req, res) => {
  console.log("Bulk status update request received");
  if (!req.file) {
    console.error("No file uploaded");
    res.status(400);
    throw new Error("CSV file is required");
  }

  const { season } = req.body;
  const targetSeason = season ? Number(season) : getSeasonYear();
  console.log(`Target season: ${targetSeason}`);

  try {
    const fileContent = req.file.buffer.toString("utf-8");
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });

    console.log(`Parsed ${records.length} records`);

    if (!records.length) {
      res.status(400);
      throw new Error("CSV file is empty or invalid");
    }

    const results = {
      total: records.length,
      updated: 0,
      notFound: 0,
      errors: [],
    };

    for (const record of records) {
      const licenseNumber = record.licenseNumber || record.LicenseNumber;

      if (!licenseNumber) {
        results.errors.push("Missing license number in row");
        continue;
      }

      const athlete = await Athlete.findOne({ licenseNumber });

      if (!athlete) {
        results.notFound++;
        results.errors.push(`Athlete not found: ${licenseNumber}`);
        continue;
      }

      // Use updateOne to bypass full document validation for legacy data issues
      // and to avoid "status: `approved` is not a valid enum value" if there's a schema mismatch we can't see.
      // But wait, "approved" IS valid for documents.
      // The error might be misleading or referring to a different status field?
      // athlete.status enum: ["active", "inactive", "pending_documents", "expired_medical", "suspended"]
      // We are setting athlete.status = "active", which is valid.

      // Let's construct the update object for updateOne.
      const updateFields = {
        status: "active",
        licenseStatus: "active",
        documentsStatus: "active",
      };

      if (athlete.documents) {
        for (const key of Object.keys(athlete.documents)) {
          if (athlete.documents[key]) {
            updateFields[`documents.${key}.status`] = "approved";
            updateFields[`documents.${key}.verifiedAt`] = new Date();
            if (req.user && req.user._id) {
              updateFields[`documents.${key}.verifiedBy`] = req.user._id;
            }
          }
        }
      }

      if (athlete.memberships && Array.isArray(athlete.memberships)) {
        const membershipIndex = athlete.memberships.findIndex(
          (m) => m.season === targetSeason
        );
        if (membershipIndex >= 0) {
          updateFields[`memberships.${membershipIndex}.status`] = "active";
        }
      }

      await Athlete.updateOne({ _id: athlete._id }, { $set: updateFields });
      results.updated++;
    }
    console.log("Bulk update completed", results);

    res.json({
      message: "Bulk status update completed",
      results,
    });
  } catch (error) {
    console.error("Error in bulkUpdateAthleteStatus:", error);
    res.status(500);
    throw new Error(`Bulk update failed: ${error.message}`);
  }
});

/**
 * Add a secondary club membership for an athlete from Centre de Promotion.
 * This allows athletes from Centre de Promotion to also be members of a club
 * without going through the transfer process.
 *
 * Access:
 * - Admin can add any athlete to any club
 * - Club managers can only add athletes from their associated Centre de Promotion
 */
export const addSecondaryMembership = asyncHandler(async (req, res) => {
  const { athleteId, clubId, season } = req.body;

  if (!athleteId || !clubId) {
    return res
      .status(400)
      .json({ message: "Athlete ID and Club ID are required" });
  }

  if (
    !mongoose.Types.ObjectId.isValid(athleteId) ||
    !mongoose.Types.ObjectId.isValid(clubId)
  ) {
    return res
      .status(400)
      .json({ message: "Invalid athlete or club identifier" });
  }

  const athlete = await Athlete.findById(athleteId).populate(
    "memberships.club",
    "name code type parentClub"
  );
  if (!athlete) {
    return res.status(404).json({ message: "Athlete not found" });
  }

  const targetClub = await Club.findById(clubId).populate(
    "parentClub",
    "name code type"
  );
  if (!targetClub) {
    return res.status(404).json({ message: "Target club not found" });
  }

  // Find the athlete's primary (active) membership
  const primaryMembership = athlete.memberships?.find(
    (m) =>
      m.status === "active" &&
      (m.membershipType === "primary" || !m.membershipType)
  );

  if (!primaryMembership) {
    return res
      .status(400)
      .json({ message: "Athlete does not have an active primary membership" });
  }

  // Get the primary club info
  const primaryClub = primaryMembership.club;
  const primaryClubId =
    typeof primaryClub === "object" ? primaryClub._id : primaryClub;

  // Check if primary club is a Centre de Promotion
  let primaryClubDoc = primaryMembership.club;
  if (typeof primaryClubDoc !== "object" || !primaryClubDoc.type) {
    primaryClubDoc = await Club.findById(primaryClubId).lean();
  }

  if (!primaryClubDoc || primaryClubDoc.type !== "centre_de_promotion") {
    return res.status(400).json({
      message:
        "Only athletes from Centre de Promotion can have dual membership",
    });
  }

  // Access control
  const userRole = req.user?.role;
  const userClubId = req.user?.clubId;

  if (userRole !== "admin" && userRole !== "federation") {
    // Club manager - check if their club has this Centre de Promotion
    if (userRole === "club_manager") {
      // The target club must be the user's club
      if (userClubId !== clubId) {
        return res.status(403).json({
          message: "You can only add athletes to your own club",
        });
      }

      // Check if user's club is the parent of the Centre de Promotion
      const userClub = await Club.findById(userClubId).lean();
      if (!userClub) {
        return res.status(403).json({ message: "Your club not found" });
      }

      // The Centre de Promotion must have this club as its parent
      if (
        !primaryClubDoc.parentClub ||
        primaryClubDoc.parentClub.toString() !== userClubId
      ) {
        return res.status(403).json({
          message:
            "You can only add athletes from your associated Centre de Promotion",
        });
      }
    } else {
      return res
        .status(403)
        .json({ message: "Not authorized to add secondary membership" });
    }
  }

  // Check if athlete already has an active membership with this club
  const existingMembership = athlete.memberships?.find((m) => {
    const mClubId =
      typeof m.club === "object" ? m.club._id.toString() : m.club.toString();
    return mClubId === clubId && m.status === "active";
  });

  if (existingMembership) {
    return res.status(400).json({
      message: "Athlete already has an active membership with this club",
    });
  }

  // Add the secondary membership
  const now = new Date();
  const membershipSeason = season || now.getFullYear();

  const newMembership = {
    club: new mongoose.Types.ObjectId(clubId),
    season: membershipSeason,
    status: "active",
    membershipType: "secondary",
    startDate: now,
  };

  // Use findByIdAndUpdate to avoid full document validation
  const updatedAthlete = await Athlete.findByIdAndUpdate(
    athleteId,
    { $push: { memberships: newMembership } },
    { new: true, runValidators: false }
  ).populate("memberships.club", "name code type");

  res.status(201).json({
    message: "Secondary membership added successfully",
    athlete: updatedAthlete.toObject({ virtuals: false }),
  });
});

/**
 * Remove a secondary club membership from an athlete.
 * Only removes secondary memberships, not primary ones.
 */
export const removeSecondaryMembership = asyncHandler(async (req, res) => {
  const { athleteId, clubId } = req.body;

  if (!athleteId || !clubId) {
    return res
      .status(400)
      .json({ message: "Athlete ID and Club ID are required" });
  }

  if (
    !mongoose.Types.ObjectId.isValid(athleteId) ||
    !mongoose.Types.ObjectId.isValid(clubId)
  ) {
    return res
      .status(400)
      .json({ message: "Invalid athlete or club identifier" });
  }

  const athlete = await Athlete.findById(athleteId).populate(
    "memberships.club",
    "name code type"
  );
  if (!athlete) {
    return res.status(404).json({ message: "Athlete not found" });
  }

  // Find the secondary membership to remove
  const membershipIndex = athlete.memberships?.findIndex((m) => {
    const mClubId =
      typeof m.club === "object" ? m.club._id.toString() : m.club.toString();
    return (
      mClubId === clubId &&
      m.membershipType === "secondary" &&
      m.status === "active"
    );
  });

  if (membershipIndex === -1) {
    return res.status(404).json({
      message: "Secondary membership not found for this club",
    });
  }

  // Access control
  const userRole = req.user?.role;
  const userClubId = req.user?.clubId;

  if (userRole !== "admin" && userRole !== "federation") {
    if (userRole === "club_manager") {
      if (userClubId !== clubId) {
        return res.status(403).json({
          message: "You can only remove athletes from your own club",
        });
      }
    } else {
      return res
        .status(403)
        .json({ message: "Not authorized to remove secondary membership" });
    }
  }

  // Get the membership _id to update
  const membership = athlete.memberships[membershipIndex];
  const membershipId = membership._id;

  // Use findByIdAndUpdate to avoid full document validation
  const updatedAthlete = await Athlete.findOneAndUpdate(
    { _id: athleteId, "memberships._id": membershipId },
    {
      $set: {
        "memberships.$.status": "inactive",
        "memberships.$.endDate": new Date(),
      },
    },
    { new: true, runValidators: false }
  ).populate("memberships.club", "name code type");

  res.json({
    message: "Secondary membership removed successfully",
    athlete: updatedAthlete.toObject({ virtuals: false }),
  });
});

/**
 * Get athletes from a Centre de Promotion that can be added to a club.
 * For club managers, returns athletes from their associated Centre de Promotion.
 * For admin, can specify any Centre de Promotion.
 */
export const getCentreAthletes = asyncHandler(async (req, res) => {
  const { centreId } = req.params;
  const userRole = req.user?.role;
  const userClubId = req.user?.clubId;

  let targetCentreId = centreId;

  if (userRole !== "admin" && userRole !== "federation") {
    if (userRole === "club_manager" && userClubId) {
      // Find the Centre de Promotion associated with this club
      const centre = await Club.findOne({
        type: "centre_de_promotion",
        parentClub: userClubId,
      }).lean();

      if (!centre) {
        return res.status(404).json({
          message: "No Centre de Promotion associated with your club",
        });
      }

      targetCentreId = centre._id.toString();

      // If centreId was provided, verify it matches
      if (centreId && centreId !== targetCentreId) {
        return res.status(403).json({
          message:
            "You can only access athletes from your associated Centre de Promotion",
        });
      }
    } else {
      return res.status(403).json({ message: "Not authorized" });
    }
  }

  if (!targetCentreId || !mongoose.Types.ObjectId.isValid(targetCentreId)) {
    return res.status(400).json({ message: "Valid Centre ID is required" });
  }

  // Find athletes with active membership in this Centre de Promotion
  const athletes = await Athlete.find({
    "memberships.club": new mongoose.Types.ObjectId(targetCentreId),
    "memberships.status": "active",
  })
    .populate("memberships.club", "name code type")
    .select(
      "firstName lastName firstNameAr lastNameAr licenseNumber birthDate gender memberships"
    )
    .lean();

  // Filter to only include athletes whose primary membership is with the centre
  const centreAthletes = athletes.filter((athlete) => {
    const primaryMembership = athlete.memberships?.find(
      (m) =>
        m.status === "active" &&
        (m.membershipType === "primary" || !m.membershipType)
    );
    if (!primaryMembership) return false;

    const clubId =
      typeof primaryMembership.club === "object"
        ? primaryMembership.club._id.toString()
        : primaryMembership.club.toString();

    return clubId === targetCentreId;
  });

  res.json({
    athletes: centreAthletes,
    count: centreAthletes.length,
  });
});

// @desc    Update athlete memberships directly (admin only, bypasses validation for legacy data)
// @route   PATCH /api/athletes/:id/memberships
// @access  Admin
export const updateAthleteMemberships = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { memberships, action, membershipIndex, membershipData } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid athlete identifier" });
  }

  const athlete = await Athlete.findById(id).populate(
    "memberships.club",
    "name code type"
  );

  if (!athlete) {
    return res.status(404).json({ message: "Athlete not found" });
  }

  const now = new Date();
  const currentSeason = getSeasonYear();

  // Handle specific actions
  if (action === "remove" && membershipIndex !== undefined) {
    // Remove a specific membership
    if (
      membershipIndex < 0 ||
      membershipIndex >= (athlete.memberships?.length || 0)
    ) {
      return res.status(400).json({ message: "Invalid membership index" });
    }

    // Use $unset and $pull via findByIdAndUpdate to bypass validation
    const membershipToRemove = athlete.memberships[membershipIndex];

    await Athlete.findByIdAndUpdate(
      id,
      {
        $pull: {
          memberships: {
            club: membershipToRemove.club._id || membershipToRemove.club,
            season: membershipToRemove.season,
          },
        },
      },
      { runValidators: false }
    );

    const updatedAthlete = await Athlete.findById(id).populate(
      "memberships.club",
      "name code type"
    );
    return res.json({
      message: "Membership removed successfully",
      athlete: updatedAthlete,
    });
  }

  if (action === "deactivate" && membershipIndex !== undefined) {
    // Set a membership to inactive instead of removing
    if (
      membershipIndex < 0 ||
      membershipIndex >= (athlete.memberships?.length || 0)
    ) {
      return res.status(400).json({ message: "Invalid membership index" });
    }

    await Athlete.findByIdAndUpdate(
      id,
      {
        $set: {
          [`memberships.${membershipIndex}.status`]: "inactive",
          [`memberships.${membershipIndex}.endDate`]: now,
        },
      },
      { runValidators: false }
    );

    const updatedAthlete = await Athlete.findById(id).populate(
      "memberships.club",
      "name code type"
    );
    return res.json({
      message: "Membership deactivated successfully",
      athlete: updatedAthlete,
    });
  }

  if (action === "activate" && membershipIndex !== undefined) {
    // Reactivate a membership
    if (
      membershipIndex < 0 ||
      membershipIndex >= (athlete.memberships?.length || 0)
    ) {
      return res.status(400).json({ message: "Invalid membership index" });
    }

    await Athlete.findByIdAndUpdate(
      id,
      {
        $set: {
          [`memberships.${membershipIndex}.status`]: "active",
          [`memberships.${membershipIndex}.season`]: currentSeason,
        },
        $unset: {
          [`memberships.${membershipIndex}.endDate`]: "",
        },
      },
      { runValidators: false }
    );

    const updatedAthlete = await Athlete.findById(id).populate(
      "memberships.club",
      "name code type"
    );
    return res.json({
      message: "Membership activated successfully",
      athlete: updatedAthlete,
    });
  }

  if (action === "add" && membershipData) {
    // Add a new membership
    const {
      clubId,
      status = "active",
      membershipType = "primary",
    } = membershipData;

    if (!clubId || !mongoose.Types.ObjectId.isValid(clubId)) {
      return res.status(400).json({ message: "Valid club ID is required" });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ message: "Club not found" });
    }

    await Athlete.findByIdAndUpdate(
      id,
      {
        $push: {
          memberships: {
            club: new mongoose.Types.ObjectId(clubId),
            season: currentSeason,
            status,
            membershipType,
            startDate: now,
          },
        },
      },
      { runValidators: false }
    );

    const updatedAthlete = await Athlete.findById(id).populate(
      "memberships.club",
      "name code type"
    );
    return res.json({
      message: "Membership added successfully",
      athlete: updatedAthlete,
    });
  }

  if (action === "transfer" && membershipData) {
    // Transfer from one club to another
    const { fromClubId, toClubId } = membershipData;

    if (!toClubId || !mongoose.Types.ObjectId.isValid(toClubId)) {
      return res
        .status(400)
        .json({ message: "Valid target club ID is required" });
    }

    const toClub = await Club.findById(toClubId);
    if (!toClub) {
      return res.status(404).json({ message: "Target club not found" });
    }

    const updateOps = {
      $push: {
        memberships: {
          club: new mongoose.Types.ObjectId(toClubId),
          season: currentSeason,
          status: "active",
          membershipType: "primary",
          startDate: now,
        },
      },
    };

    // If fromClubId specified, mark that membership as transferred
    if (fromClubId && mongoose.Types.ObjectId.isValid(fromClubId)) {
      const fromIndex = athlete.memberships?.findIndex((m) => {
        const clubId = m.club._id ? m.club._id.toString() : m.club.toString();
        return clubId === fromClubId && m.status === "active";
      });

      if (fromIndex >= 0) {
        updateOps.$set = {
          [`memberships.${fromIndex}.status`]: "transferred",
          [`memberships.${fromIndex}.endDate`]: now,
        };
      }
    }

    await Athlete.findByIdAndUpdate(id, updateOps, { runValidators: false });

    const updatedAthlete = await Athlete.findById(id).populate(
      "memberships.club",
      "name code type"
    );
    return res.json({
      message: "Athlete transferred successfully",
      athlete: updatedAthlete,
    });
  }

  // If full memberships array is provided, replace all memberships
  if (memberships && Array.isArray(memberships)) {
    const validatedMemberships = memberships.map((m) => ({
      club: new mongoose.Types.ObjectId(m.clubId || m.club),
      season: m.season || currentSeason,
      status: m.status || "active",
      membershipType: m.membershipType || "primary",
      startDate: m.startDate ? new Date(m.startDate) : now,
      endDate: m.endDate ? new Date(m.endDate) : undefined,
    }));

    await Athlete.findByIdAndUpdate(
      id,
      { $set: { memberships: validatedMemberships } },
      { runValidators: false }
    );

    const updatedAthlete = await Athlete.findById(id).populate(
      "memberships.club",
      "name code type"
    );
    return res.json({
      message: "Memberships updated successfully",
      athlete: updatedAthlete,
    });
  }

  return res
    .status(400)
    .json({ message: "Invalid request. Provide action or memberships array." });
});

export const triggerPhotoImport = asyncHandler(async (req, res) => {
  try {
      // Run synchronously to return summary
      const result = await importPhotos({ useExistingConnection: true });
      res.json({ 
          message: "Photo import process completed",
          summary: result 
      });
  } catch (error) {
      res.status(500);
      throw new Error(`Import failed: ${error.message}`);
  }
});
