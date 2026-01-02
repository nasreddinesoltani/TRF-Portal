import asyncHandler from "express-async-handler";
import crypto from "crypto";
import mongoose from "mongoose";
import Club from "../Models/clubModel.js";
import User from "../Models/userModel.js";
import Athlete from "../Models/athleteModel.js";
import TransferRequest from "../Models/transferRequestModel.js";
import AthleteDeletionRequest from "../Models/athleteDeletionRequestModel.js";
import { sendClubInvitationEmail } from "../Services/emailService.js";
import {
  ensureNationalCategoriesForAthletes,
  getSeasonYear,
} from "../Services/categoryAssignmentService.js";
import {
  evaluateDocumentStatuses,
  serialiseDocuments,
} from "../Services/documentStatusService.js";

const ALLOWED_CLUB_TYPES = [
  "club",
  "country",
  "centre_de_promotion",
  "ecole_federale",
];

const PROMOTION_CENTER_TYPE = "centre_de_promotion";

const generateClubCode = (name) => {
  const base = name
    .normalize("NFD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();
  const random = crypto.randomInt(100, 999);
  return `${base.slice(0, 4)}${random}`;
};

const generateTempPassword = () => {
  const random = crypto.randomBytes(4).toString("hex");
  return `${random}Aa1!`;
};

// @desc    Create a new club or country account
// @route   POST /api/clubs
// @access  Admin
export const createClub = asyncHandler(async (req, res) => {
  const {
    name,
    nameAr,
    type = "club",
    email,
    phone,
    address,
    city,
    logoUrl,
    seasonActivation,
    contact = {},
    parentClubId,
  } = req.body;

  if (!name || !email) {
    return res.status(400).json({ message: "Name and email are required" });
  }

  if (!ALLOWED_CLUB_TYPES.includes(type)) {
    return res.status(400).json({ message: "Invalid club type" });
  }

  let parentClubRef;

  if (type === PROMOTION_CENTER_TYPE) {
    if (!parentClubId || !mongoose.Types.ObjectId.isValid(parentClubId)) {
      return res.status(400).json({
        message: "Promotion centers must reference a valid parent club",
      });
    }

    const parentClub = await Club.findById(parentClubId).select("type name");

    if (!parentClub) {
      return res
        .status(404)
        .json({ message: "Parent club not found for promotion center" });
    }

    if (parentClub.type !== "club") {
      return res.status(400).json({
        message: "Promotion centers can only belong to base clubs",
      });
    }

    parentClubRef = parentClub._id;
  } else if (parentClubId) {
    return res.status(400).json({
      message: "Only promotion centers may define a parent club",
    });
  }

  const existingClub = await Club.findOne({ $or: [{ name }, { email }] });
  if (existingClub) {
    return res
      .status(409)
      .json({ message: "Club with same name or email exists" });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res
      .status(409)
      .json({ message: "A user account with this email already exists" });
  }

  let clubCode = req.body.code ? req.body.code.trim().toUpperCase() : null;

  if (clubCode) {
    const codeExists = await Club.exists({ code: clubCode });
    if (codeExists) {
      return res.status(409).json({ message: "Club code already in use" });
    }
  } else {
    clubCode = generateClubCode(name);
    let safeguard = 0;
    while ((await Club.exists({ code: clubCode })) && safeguard < 5) {
      clubCode = generateClubCode(name);
      safeguard += 1;
    }
  }

  const club = await Club.create({
    name,
    nameAr,
    type,
    email,
    phone,
    address,
    city,
    logoUrl,
    code: clubCode,
    contacts: {
      primaryName:
        contact.firstName || contact.lastName
          ? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim()
          : undefined,
      primaryPhone: contact.phone,
    },
    seasonActivation,
    createdBy: req.user?.id,
    parentClub: parentClubRef,
  });

  const tempPassword = generateTempPassword();

  const managerAccount = await User.create({
    firstName: contact.firstName || name,
    lastName: contact.lastName || "Manager",
    firstNameAr: contact.firstNameAr,
    lastNameNameAr: contact.lastNameAr,
    email,
    password: tempPassword,
    role: "club_manager",
    mustChangePassword: true,
    clubId: club._id,
    phone: contact.phone,
    gender: contact.gender,
    birthDate: contact.birthDate,
    address,
    city,
    isActive: true,
  });

  // TODO: integrate with mailer service
  try {
    await sendClubInvitationEmail({
      to: email,
      clubName: name,
      tempPassword,
    });
  } catch (error) {
    console.error("Failed to send club invitation email", error);
  }

  await club.populate("parentClub", "name code type isActive");

  res.status(201).json({
    message: "Club created successfully",
    club,
    credentials: {
      email,
      tempPassword,
    },
  });
});

// @desc    Get all clubs
// @route   GET /api/clubs
// @access  Admin, Jury President
export const listClubs = asyncHandler(async (req, res) => {
  const filter = {};

  if (req.query.isActive) {
    filter.isActive = req.query.isActive === "true";
  }

  const currentSeason = getSeasonYear();

  // Get clubs with athlete counts for current season (active memberships only)
  const clubs = await Club.find(filter)
    .sort({ name: 1 })
    .populate("parentClub", "name code type isActive")
    .lean();

  // Get athlete counts per club for current season active memberships
  // Use $addToSet to count unique athletes (in case of multiple memberships)
  const athleteCounts = await Athlete.aggregate([
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
    { $unwind: "$memberships" },
    {
      $match: {
        "memberships.season": currentSeason,
        "memberships.status": "active",
      },
    },
    {
      $group: {
        _id: "$memberships.club",
        athletes: { $addToSet: "$_id" },
      },
    },
    {
      $project: {
        _id: 1,
        count: { $size: "$athletes" },
      },
    },
  ]);

  // Create a map of club ID to athlete count
  const countMap = new Map();
  athleteCounts.forEach((item) => {
    countMap.set(item._id.toString(), item.count);
  });

  // Add athleteCount to each club
  const clubsWithCounts = clubs.map((club) => ({
    ...club,
    athleteCount: countMap.get(club._id.toString()) || 0,
  }));

  res.json(clubsWithCounts);
});

// @desc    Update club status (activate/deactivate)
// @route   PATCH /api/clubs/:id/status
// @access  Admin
export const updateClubStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  const club = await Club.findById(id).populate(
    "parentClub",
    "name code type isActive"
  );

  if (!club) {
    return res.status(404).json({ message: "Club not found" });
  }

  club.isActive = Boolean(isActive);
  await club.save();

  await User.updateMany(
    { clubId: club._id, role: "club_manager" },
    { isActive: Boolean(isActive) }
  );

  res.json({ message: "Club status updated", club });
});

// @desc    Get single club details
// @route   GET /api/clubs/:id
// @access  Admin
export const getClubById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid club identifier" });
  }

  const club = await Club.findById(id);

  if (!club) {
    return res.status(404).json({ message: "Club not found" });
  }

  res.json(club);
});

// @desc    Update club details
// @route   PUT /api/clubs/:id
// @access  Admin
export const updateClub = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    nameAr,
    type,
    email,
    phone,
    address,
    city,
    logoUrl,
    isActive,
    seasonActivation,
    contact = {},
    parentClubId,
  } = req.body;

  const club = await Club.findById(id);

  if (!club) {
    return res.status(404).json({ message: "Club not found" });
  }

  if (type && !ALLOWED_CLUB_TYPES.includes(type)) {
    return res.status(400).json({ message: "Invalid club type" });
  }

  const targetType = type || club.type;
  let parentClubRef = club.parentClub;

  if (targetType === PROMOTION_CENTER_TYPE) {
    const candidateParentId =
      parentClubId !== undefined && parentClubId !== null
        ? parentClubId
        : parentClubRef || null;

    if (
      !candidateParentId ||
      !mongoose.Types.ObjectId.isValid(candidateParentId)
    ) {
      return res.status(400).json({
        message: "Promotion centers must reference a valid parent club",
      });
    }

    if (candidateParentId.toString() === club._id.toString()) {
      return res
        .status(400)
        .json({ message: "A promotion center cannot reference itself" });
    }

    const parentClub = await Club.findById(candidateParentId).select("type");

    if (!parentClub) {
      return res
        .status(404)
        .json({ message: "Parent club not found for promotion center" });
    }

    if (parentClub.type !== "club") {
      return res.status(400).json({
        message: "Promotion centers can only belong to base clubs",
      });
    }

    parentClubRef = parentClub._id;
  } else if (parentClubId !== undefined) {
    if (parentClubId) {
      return res.status(400).json({
        message: "Only promotion centers may define a parent club",
      });
    }

    parentClubRef = undefined;
  }

  const manager = await User.findOne({
    clubId: club._id,
    role: "club_manager",
  });

  const updates = {};

  if (name) {
    updates.name = name;
  }

  if (nameAr !== undefined) {
    updates.nameAr = nameAr;
  }

  if (req.body.code) {
    const newCode = req.body.code.trim().toUpperCase();
    if (newCode !== club.code) {
      const codeConflict = await Club.findOne({
        code: newCode,
        _id: { $ne: id },
      });
      if (codeConflict) {
        return res.status(409).json({ message: "Club code already in use" });
      }
      updates.code = newCode;
    }
  }

  if (type) {
    updates.type = type;
  }

  if (phone !== undefined) {
    updates.phone = phone;
  }

  if (address !== undefined) {
    updates.address = address;
  }

  if (city !== undefined) {
    updates.city = city;
  }

  if (logoUrl !== undefined) {
    updates.logoUrl = logoUrl;
  }

  const shouldUpdateParent =
    (targetType === PROMOTION_CENTER_TYPE &&
      (!club.parentClub ||
        club.parentClub.toString() !== parentClubRef?.toString())) ||
    (targetType !== PROMOTION_CENTER_TYPE && club.parentClub);

  if (shouldUpdateParent) {
    updates.parentClub = parentClubRef;
  }

  if (seasonActivation !== undefined) {
    updates.seasonActivation = seasonActivation;
  }

  if (typeof isActive === "boolean") {
    updates.isActive = isActive;
  }

  if (email && email !== club.email) {
    const emailConflict = await Club.findOne({ email, _id: { $ne: id } });
    if (emailConflict) {
      return res
        .status(409)
        .json({ message: "Another club already uses this email" });
    }

    const userConflict = await User.findOne({ email });
    if (
      userConflict &&
      (!manager || userConflict._id.toString() !== manager._id.toString())
    ) {
      return res
        .status(409)
        .json({ message: "A user account already uses this email" });
    }

    updates.email = email;
  }

  if (contact && Object.keys(contact).length > 0) {
    const hasNameField =
      Object.prototype.hasOwnProperty.call(contact, "firstName") ||
      Object.prototype.hasOwnProperty.call(contact, "lastName");

    const composedName = `${contact.firstName ?? ""} ${contact.lastName ?? ""}`
      .trim()
      .replace(/\s+/g, " ");

    updates.contacts = {
      primaryName: hasNameField
        ? composedName || undefined
        : club.contacts?.primaryName,
      primaryPhone: Object.prototype.hasOwnProperty.call(contact, "phone")
        ? contact.phone
        : club.contacts?.primaryPhone,
    };
  }

  Object.assign(club, updates);
  await club.save();

  if (manager) {
    if (contact && Object.prototype.hasOwnProperty.call(contact, "firstName")) {
      manager.firstName = contact.firstName;
    }

    if (contact && Object.prototype.hasOwnProperty.call(contact, "lastName")) {
      manager.lastName = contact.lastName;
    }

    if (contact && Object.prototype.hasOwnProperty.call(contact, "phone")) {
      manager.phone = contact.phone;
    }

    if (email && email !== manager.email) {
      manager.email = email;
    }

    if (typeof isActive === "boolean") {
      manager.isActive = isActive;
    }

    await manager.save();
  }

  await club.populate("parentClub", "name code type isActive");

  res.json({ message: "Club updated successfully", club });
});
// @route   GET /api/clubs/mine?id=optional
// @access  Admin, Club manager
export const getClubSummary = asyncHandler(async (req, res) => {
  let clubId = req.user?.clubId;

  if (req.user?.role === "admin" && req.query.id) {
    clubId = req.query.id;
  }

  if (!clubId) {
    return res.status(404).json({ message: "Club not assigned to user" });
  }

  const club = await Club.findById(clubId).lean();

  if (!club) {
    return res.status(404).json({ message: "Club not found" });
  }

  const baseMembershipFilter = { "memberships.club": club._id };

  const [
    totalAthletes,
    activeMemberships,
    inactiveMemberships,
    pendingMemberships,
    transferredMemberships,
  ] = await Promise.all([
    Athlete.countDocuments(baseMembershipFilter),
    Athlete.countDocuments({
      memberships: { $elemMatch: { club: club._id, status: "active" } },
    }),
    Athlete.countDocuments({
      memberships: { $elemMatch: { club: club._id, status: "inactive" } },
    }),
    Athlete.countDocuments({
      memberships: { $elemMatch: { club: club._id, status: "pending" } },
    }),
    Athlete.countDocuments({
      memberships: { $elemMatch: { club: club._id, status: "transferred" } },
    }),
  ]);

  const manager = await User.findOne({
    clubId: club._id,
    role: "club_manager",
  })
    .select("firstName lastName email phone")
    .lean();

  const recentAthletesRaw = await Athlete.find({
    "memberships.club": club._id,
  })
    .sort({ createdAt: -1 })
    .limit(5)
    .select(
      "firstName lastName licenseNumber status memberships createdAt cin passportNumber"
    )
    .lean();

  const clubIdString = club._id.toString();
  const recentAthletes = recentAthletesRaw.map((athlete) => {
    const membership = athlete.memberships?.find(
      (entry) => entry.club?.toString() === clubIdString
    );

    return {
      id: athlete._id,
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      licenseNumber: athlete.licenseNumber,
      cin: athlete.cin,
      passportNumber: athlete.passportNumber,
      status: athlete.status,
      membershipStatus: membership?.status,
      createdAt: athlete.createdAt,
    };
  });

  res.json({
    club,
    manager,
    stats: {
      totalAthletes,
      activeMemberships,
      inactiveMemberships,
      pendingMemberships,
      transferredMemberships,
    },
    recentAthletes,
  });
});

const normalizeClubMembership = (athlete, clubId) => {
  if (!athlete?.memberships?.length) {
    return null;
  }

  const targetId = clubId.toString();

  return (
    athlete.memberships.find((membership) => {
      if (!membership.club) {
        return false;
      }

      const membershipClubId = (() => {
        if (typeof membership.club === "string") {
          return membership.club;
        }
        if (
          typeof membership.club === "object" &&
          membership.club !== null &&
          membership.club._id
        ) {
          return membership.club._id.toString();
        }
        if (typeof membership.club?.toString === "function") {
          return membership.club.toString();
        }
        return undefined;
      })();

      return membershipClubId === targetId;
    }) || null
  );
};

const buildAthleteClubView = (athlete, clubId, seasonYear) => {
  const membership = normalizeClubMembership(athlete, clubId);

  const membershipClub = membership?.club;
  const membershipClubId = (() => {
    if (!membershipClub) {
      return undefined;
    }

    if (typeof membershipClub === "string") {
      return membershipClub;
    }

    if (
      typeof membershipClub === "object" &&
      membershipClub !== null &&
      membershipClub._id
    ) {
      return membershipClub._id.toString();
    }

    if (typeof membershipClub?.toString === "function") {
      return membershipClub.toString();
    }

    return undefined;
  })();
  const clubName =
    typeof membershipClub === "object"
      ? membershipClub.name || membershipClub.code
      : undefined;

  const assignments = Array.isArray(athlete.categoryAssignments)
    ? athlete.categoryAssignments.map((entry) =>
        typeof entry?.toObject === "function"
          ? entry.toObject({ depopulate: true })
          : entry
      )
    : [];

  const currentNationalCategory =
    assignments.find(
      (entry) => entry?.type === "national" && entry?.season === seasonYear
    ) || null;

  const documentEvaluation = evaluateDocumentStatuses(athlete);
  const documentsStatus =
    athlete.documentsStatus || documentEvaluation.status || "pending_documents";
  const documentsIssues = Array.isArray(athlete.documentsIssues)
    ? athlete.documentsIssues.length
      ? athlete.documentsIssues
      : documentEvaluation.issues || []
    : documentEvaluation.issues || [];

  return {
    _id: athlete._id,
    firstName: athlete.firstName,
    lastName: athlete.lastName,
    firstNameAr: athlete.firstNameAr,
    lastNameAr: athlete.lastNameAr,
    fullName: `${athlete.firstName ?? ""} ${athlete.lastName ?? ""}`.trim(),
    fullNameAr: `${athlete.firstNameAr ?? ""} ${
      athlete.lastNameAr ?? ""
    }`.trim(),
    licenseNumber: athlete.licenseNumber,
    cin: athlete.cin,
    passportNumber: athlete.passportNumber,
    birthDate: athlete.birthDate,
    gender: athlete.gender,
    athleteStatus: athlete.status,
    status: athlete.status,
    licenseStatus: athlete.licenseStatus || "inactive",
    documentsStatus,
    documentsIssues,
    documentEvaluation,
    membershipStatus: membership?.status,
    membershipStartDate: membership?.startDate,
    membershipEndDate: membership?.endDate,
    membershipSeason: membership?.season,
    membershipClubId,
    membershipClubName: clubName,
    documents: serialiseDocuments(athlete.documents || {}),
    categoryAssignments: assignments,
    nationalCategory: currentNationalCategory,
    createdAt: athlete.createdAt,
    updatedAt: athlete.updatedAt,
  };
};

export const getClubDetailsWithAthletes = asyncHandler(async (req, res) => {
  let { id } = req.params;

  if (id === "mine") {
    if (!req.user?.clubId) {
      return res.status(404).json({ message: "Club assignment not found" });
    }
    id = req.user.clubId;
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid club identifier" });
  }

  if (
    req.user?.role === "club_manager" &&
    (!req.user.clubId || req.user.clubId !== id)
  ) {
    return res
      .status(403)
      .json({ message: "You are not authorized to view this club" });
  }

  const club = await Club.findById(id)
    .populate("parentClub", "name code type isActive")
    .lean();

  if (!club) {
    return res.status(404).json({ message: "Club not found" });
  }

  // Find associated Centre de Promotion if this is a regular club
  let associatedCentre = null;
  if (club.type === "club") {
    associatedCentre = await Club.findOne({
      type: "centre_de_promotion",
      parentClub: id,
      isActive: true,
    })
      .select("_id name nameAr code")
      .lean();
  }

  const athletesRaw = await Athlete.find({ "memberships.club": id })
    .select(
      "firstName lastName firstNameAr lastNameAr licenseNumber cin passportNumber birthDate gender status licenseStatus documentsStatus documentsIssues memberships documents createdAt updatedAt categoryAssignments"
    )
    .populate("memberships.club", "name code");

  const seasonYear = getSeasonYear();
  const categoryCache = {};
  await ensureNationalCategoriesForAthletes(
    athletesRaw,
    seasonYear,
    categoryCache
  );

  const athletes = {
    active: [],
    inactive: [],
    pending: [],
    transferred: [],
  };

  const counts = {
    active: 0,
    inactive: 0,
    pending: 0,
    transferred: 0,
  };

  athletesRaw.forEach((athlete) => {
    const membership = normalizeClubMembership(athlete, id);
    const status = membership?.status || "inactive";
    const view = buildAthleteClubView(athlete, id, seasonYear);

    if (status === "active") {
      athletes.active.push(view);
      counts.active += 1;
    } else if (status === "pending") {
      athletes.pending.push(view);
      counts.pending += 1;
    } else if (status === "transferred") {
      athletes.transferred.push(view);
      counts.transferred += 1;
    } else {
      athletes.inactive.push(view);
      counts.inactive += 1;
    }
  });

  const pendingTransfers = await TransferRequest.find({
    status: "pending",
    $or: [{ fromClub: id }, { toClub: id }],
  })
    .sort({ createdAt: -1 })
    .populate([
      { path: "athlete", select: "firstName lastName licenseNumber" },
      { path: "fromClub", select: "name code" },
      { path: "toClub", select: "name code" },
      { path: "requestedBy", select: "firstName lastName role" },
    ])
    .lean();

  const pendingDeletionRequests = await AthleteDeletionRequest.find({
    club: id,
    status: "pending",
  })
    .sort({ createdAt: -1 })
    .populate([
      { path: "athlete", select: "firstName lastName licenseNumber" },
      { path: "requestedBy", select: "firstName lastName role" },
    ])
    .lean();

  res.json({
    club,
    athletes,
    counts,
    pendingTransfers,
    pendingDeletionRequests,
    associatedCentre,
    permissions: {
      canManageAthletes: ["admin", "club_manager"].includes(req.user?.role),
      canDecideTransfers: ["admin", "jury_president"].includes(req.user?.role),
      canApproveDeletions: req.user?.role === "admin",
      canRequestDeletions: ["admin", "club_manager"].includes(req.user?.role),
      canManageDualMembership: ["admin", "federation", "club_manager"].includes(
        req.user?.role
      ),
    },
  });
});

export const updateClubAthleteStatus = asyncHandler(async (req, res) => {
  const { clubId, athleteId } = req.params;
  const { status } = req.body;

  if (!mongoose.Types.ObjectId.isValid(clubId)) {
    return res.status(400).json({ message: "Invalid club identifier" });
  }

  if (!mongoose.Types.ObjectId.isValid(athleteId)) {
    return res.status(400).json({ message: "Invalid athlete identifier" });
  }

  const allowedStatuses = ["active", "inactive", "pending", "transferred"];

  if (!status || !allowedStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid membership status" });
  }

  const clubIdString = clubId.toString();

  if (
    req.user?.role === "club_manager" &&
    (!req.user.clubId || req.user.clubId !== clubIdString)
  ) {
    return res
      .status(403)
      .json({ message: "You are not authorized to change this athlete" });
  }

  if (
    req.user?.role === "club_manager" &&
    !["active", "inactive", "pending"].includes(status)
  ) {
    return res.status(403).json({
      message: "Club managers cannot set this membership status",
    });
  }

  const clubObjectId = new mongoose.Types.ObjectId(clubId);

  const athlete = await Athlete.findById(athleteId).lean();

  if (!athlete) {
    return res.status(404).json({ message: "Athlete not found" });
  }

  const membership = athlete.memberships?.find((entry) => {
    if (!entry.club) {
      return false;
    }
    if (typeof entry.club === "string") {
      return entry.club === clubIdString;
    }
    if (
      typeof entry.club === "object" &&
      entry.club !== null &&
      entry.club._id
    ) {
      return entry.club._id.toString() === clubIdString;
    }
    if (typeof entry.club.toString === "function") {
      return entry.club.toString() === clubIdString;
    }
    return false;
  });

  if (!membership) {
    return res
      .status(404)
      .json({ message: "Athlete does not belong to this club" });
  }

  const updateQuery = {
    _id: athleteId,
    "memberships.club": clubObjectId,
  };

  const updateOperations = {
    $set: {
      "memberships.$.status": status,
    },
  };

  if (status === "inactive") {
    updateOperations.$set.status = "inactive";
    if (!membership.endDate) {
      updateOperations.$set["memberships.$.endDate"] = new Date();
    }
  } else if (status === "active") {
    updateOperations.$set["memberships.$.endDate"] = undefined;
  } else if (status === "transferred") {
    updateOperations.$set["memberships.$.endDate"] = new Date();
  }

  const updateResult = await Athlete.updateOne(updateQuery, updateOperations);

  if (!updateResult.matchedCount) {
    return res.status(404).json({
      message: "Athlete membership not found for this club",
    });
  }

  const updatedAthlete = await Athlete.findById(athleteId)
    .select("firstName lastName memberships")
    .populate("memberships.club", "name code")
    .lean();

  res.json({
    message: updateResult.modifiedCount
      ? "Membership status updated"
      : "Membership status unchanged",
    athlete: updatedAthlete,
  });
});

// @desc    Delete club
// @route   DELETE /api/clubs/:id
// @access  Admin
export const deleteClub = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const club = await Club.findById(id);

  if (!club) {
    return res.status(404).json({ message: "Club not found" });
  }

  const dependentAthlete = await Athlete.findOne({ "memberships.club": id });
  if (dependentAthlete) {
    return res.status(400).json({
      message: "Club cannot be deleted while athletes are associated with it",
    });
  }

  await User.deleteMany({ clubId: club._id });
  await club.deleteOne();

  res.json({ message: "Club deleted successfully" });
});
