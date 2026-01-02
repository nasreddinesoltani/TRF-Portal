import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Athlete from "../Models/athleteModel.js";
import Club from "../Models/clubModel.js";
import TransferRequest from "../Models/transferRequestModel.js";

const transferPopulateConfig = [
  {
    path: "athlete",
    select: "firstName lastName licenseNumber memberships cin passportNumber",
  },
  { path: "fromClub", select: "name code" },
  { path: "toClub", select: "name code" },
  { path: "requestedBy", select: "firstName lastName role" },
  { path: "approvedBy", select: "firstName lastName role" },
];

const ensureObjectId = (value) => {
  if (mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return null;
};

export const createTransferRequest = asyncHandler(async (req, res) => {
  const { athleteId, toClubId, notes } = req.body;

  const athleteObjectId = ensureObjectId(athleteId);
  const toClubObjectId = ensureObjectId(toClubId);
  const requesterObjectId = ensureObjectId(req.user?.id || req.user?._id);

  if (!athleteObjectId || !toClubObjectId) {
    return res
      .status(400)
      .json({ message: "Invalid athlete or club identifier" });
  }

  if (!requesterObjectId) {
    return res.status(403).json({ message: "User context is missing" });
  }

  const athlete = await Athlete.findById(athleteObjectId)
    .populate("memberships.club", "name code")
    .lean();

  if (!athlete) {
    return res.status(404).json({ message: "Athlete not found" });
  }

  const fromMembership = athlete.memberships?.find(
    (membership) => membership.status === "active" && membership.club
  );

  if (!fromMembership) {
    return res
      .status(400)
      .json({ message: "Athlete does not have an active club membership" });
  }

  const fromClubObjectId = ensureObjectId(
    typeof fromMembership.club === "object"
      ? fromMembership.club._id
      : fromMembership.club
  );

  if (!fromClubObjectId) {
    return res.status(400).json({ message: "Invalid originating club" });
  }

  if (fromClubObjectId.equals(toClubObjectId)) {
    return res
      .status(400)
      .json({ message: "Target club must be different from current club" });
  }

  const toClub = await Club.findById(toClubObjectId).lean();
  if (!toClub) {
    return res.status(404).json({ message: "Target club not found" });
  }

  if (req.user?.role === "club_manager") {
    if (!req.user.clubId || req.user.clubId !== fromClubObjectId.toString()) {
      return res
        .status(403)
        .json({ message: "You are not authorized to transfer this athlete" });
    }
  }

  const pendingExisting = await TransferRequest.findOne({
    athlete: athleteObjectId,
    status: "pending",
  });

  if (pendingExisting) {
    return res.status(409).json({ message: "Pending transfer already exists" });
  }

  const transferRequest = await TransferRequest.create({
    athlete: athleteObjectId,
    fromClub: fromClubObjectId,
    toClub: toClubObjectId,
    status: "pending",
    requestedBy: requesterObjectId,
    notes,
  });

  await transferRequest.populate(transferPopulateConfig);

  res.status(201).json({
    message: "Transfer request created",
    transferRequest,
  });
});

export const listTransferRequests = asyncHandler(async (req, res) => {
  const { status, clubId, direction } = req.query;

  const filter = {};

  if (status) {
    filter.status = status;
  }

  const clubObjectId = ensureObjectId(clubId);

  if (req.user?.role === "club_manager") {
    const managerClubId = ensureObjectId(req.user.clubId);
    if (!managerClubId) {
      return res.status(403).json({ message: "Club assignment not found" });
    }
    filter.$or = [{ fromClub: managerClubId }, { toClub: managerClubId }];
  } else if (clubObjectId) {
    if (direction === "incoming") {
      filter.toClub = clubObjectId;
    } else if (direction === "outgoing") {
      filter.fromClub = clubObjectId;
    } else {
      filter.$or = [{ fromClub: clubObjectId }, { toClub: clubObjectId }];
    }
  }

  const transfers = await TransferRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate(transferPopulateConfig)
    .lean();

  res.json(transfers);
});

export const updateTransferRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { action, note } = req.body;

  const transferRequest = await TransferRequest.findById(id);

  if (!transferRequest) {
    return res.status(404).json({ message: "Transfer request not found" });
  }

  if (transferRequest.status !== "pending") {
    return res
      .status(400)
      .json({ message: "Only pending requests can be updated" });
  }

  if (!["approve", "reject"].includes(action)) {
    return res.status(400).json({ message: "Invalid action" });
  }

  if (!req.user || !["admin", "jury_president"].includes(req.user.role)) {
    return res
      .status(403)
      .json({ message: "Only administrators or jury presidents can decide" });
  }

  if (action === "reject") {
    transferRequest.status = "rejected";
    transferRequest.adminNote = note;
    transferRequest.approvedBy = req.user?.id || req.user?._id;
    transferRequest.decisionAt = new Date();
    await transferRequest.save();
    await transferRequest.populate(transferPopulateConfig);
    return res.json({
      message: "Transfer request rejected",
      transferRequest,
    });
  }

  const athlete = await Athlete.findById(transferRequest.athlete);

  if (!athlete) {
    return res.status(404).json({ message: "Athlete not found" });
  }

  const fromClubId = transferRequest.fromClub.toString();
  const toClubId = transferRequest.toClub.toString();

  const membershipIndex = athlete.memberships?.findIndex((entry) => {
    const clubIdValue =
      typeof entry.club === "object" ? entry.club.toString() : entry.club;
    return clubIdValue === fromClubId && entry.status === "active";
  });

  const now = new Date();

  // First, mark the old membership as transferred (if exists)
  if (membershipIndex !== undefined && membershipIndex >= 0) {
    await Athlete.findByIdAndUpdate(
      transferRequest.athlete,
      {
        $set: {
          [`memberships.${membershipIndex}.status`]: "transferred",
          [`memberships.${membershipIndex}.endDate`]: now,
        },
      },
      { runValidators: false }
    );
  }

  // Then, add the new membership
  await Athlete.findByIdAndUpdate(
    transferRequest.athlete,
    {
      $push: {
        memberships: {
          club: transferRequest.toClub,
          season: now.getFullYear(),
          status: "active",
          startDate: now,
        },
      },
    },
    { runValidators: false }
  );

  transferRequest.status = "approved";
  transferRequest.approvedBy = req.user?.id || req.user?._id;
  transferRequest.adminNote = note;
  transferRequest.decisionAt = now;

  await transferRequest.save();
  await transferRequest.populate(transferPopulateConfig);

  res.json({
    message: "Transfer request approved",
    transferRequest,
  });
});
