import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Athlete from "../Models/athleteModel.js";
import AthleteDeletionRequest from "../Models/athleteDeletionRequestModel.js";
import { performAthleteDeletion } from "./athleteController.js";

const extractClubId = (clubRef) => {
  if (!clubRef) {
    return null;
  }

  if (clubRef instanceof mongoose.Types.ObjectId) {
    return clubRef.toString();
  }

  if (typeof clubRef === "string") {
    return clubRef;
  }

  if (typeof clubRef === "object" && clubRef._id) {
    return clubRef._id.toString();
  }

  if (typeof clubRef.toString === "function") {
    return clubRef.toString();
  }

  return null;
};

const athleteBelongsToClub = (athlete, clubId) => {
  if (!clubId || !athlete?.memberships?.length) {
    return false;
  }

  const target = clubId.toString();

  return athlete.memberships.some((membership) => {
    const membershipClub = extractClubId(membership?.club);
    return membershipClub === target;
  });
};

const resolveActiveClubForAthlete = (athlete) => {
  if (!athlete?.memberships?.length) {
    return null;
  }

  const prioritized =
    athlete.memberships.find((entry) => entry?.status === "active") ||
    athlete.memberships[0];

  return prioritized ? extractClubId(prioritized.club) : null;
};

export const createAthleteDeletionRequest = asyncHandler(async (req, res) => {
  const { athleteId, reason, clubId: explicitClubId } = req.body;

  if (!athleteId || !mongoose.Types.ObjectId.isValid(athleteId)) {
    return res
      .status(400)
      .json({ message: "A valid athlete identifier is required" });
  }

  const athlete = await Athlete.findById(athleteId).populate(
    "memberships.club",
    "name code"
  );

  if (!athlete) {
    return res.status(404).json({ message: "Athlete not found" });
  }

  let associatedClubId = null;

  if (req.user?.role === "club_manager") {
    if (!req.user.clubId) {
      return res
        .status(403)
        .json({ message: "You are not assigned to a club" });
    }

    if (!athleteBelongsToClub(athlete, req.user.clubId)) {
      return res.status(403).json({
        message: "You are not authorized to request deletion for this athlete",
      });
    }

    associatedClubId = req.user.clubId;
  } else if (req.user?.role === "admin") {
    if (explicitClubId && mongoose.Types.ObjectId.isValid(explicitClubId)) {
      associatedClubId = explicitClubId;
    } else {
      associatedClubId = resolveActiveClubForAthlete(athlete);
    }
  } else {
    return res
      .status(403)
      .json({ message: "You are not authorized to request deletions" });
  }

  if (!associatedClubId) {
    return res
      .status(400)
      .json({ message: "Unable to determine the athlete's club association" });
  }

  if (!mongoose.Types.ObjectId.isValid(associatedClubId)) {
    return res
      .status(400)
      .json({ message: "Invalid club identifier for deletion request" });
  }

  const clubObjectId = new mongoose.Types.ObjectId(associatedClubId);

  const pendingRequest = await AthleteDeletionRequest.findOne({
    athlete: athlete._id,
    status: "pending",
  });

  if (pendingRequest) {
    return res.status(409).json({
      message: "A deletion request for this athlete is already pending",
      request: pendingRequest,
    });
  }

  const deletionRequest = await AthleteDeletionRequest.create({
    athlete: athlete._id,
    club: clubObjectId,
    requestedBy: req.user.id,
    reason: reason?.trim() || undefined,
  });

  await deletionRequest.populate([
    { path: "athlete", select: "firstName lastName licenseNumber" },
    { path: "requestedBy", select: "firstName lastName role" },
  ]);

  res.status(201).json({
    message: "Deletion request submitted and awaiting administrator review",
    request: deletionRequest,
  });
});

export const listAthleteDeletionRequests = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};

  if (status) {
    filter.status = status;
  }

  if (req.user?.role === "club_manager") {
    if (!req.user.clubId) {
      return res
        .status(403)
        .json({ message: "You are not assigned to a club" });
    }
    filter.club = req.user.clubId;
  } else if (
    req.query.clubId &&
    mongoose.Types.ObjectId.isValid(req.query.clubId)
  ) {
    filter.club = req.query.clubId;
  }

  const requests = await AthleteDeletionRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate([
      { path: "athlete", select: "firstName lastName licenseNumber" },
      { path: "requestedBy", select: "firstName lastName role" },
      { path: "decidedBy", select: "firstName lastName role" },
    ]);

  res.json(requests);
});

export const updateAthleteDeletionRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { action, note } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res
      .status(400)
      .json({ message: "Invalid deletion request identifier" });
  }

  if (!action || !["approve", "reject"].includes(action)) {
    return res.status(400).json({ message: "A valid action is required" });
  }

  const deletionRequest = await AthleteDeletionRequest.findById(id).populate(
    "athlete"
  );

  if (!deletionRequest) {
    return res.status(404).json({ message: "Deletion request not found" });
  }

  if (deletionRequest.status !== "pending") {
    return res
      .status(400)
      .json({ message: "This deletion request has already been processed" });
  }

  if (action === "approve") {
    if (deletionRequest.athlete) {
      await performAthleteDeletion(deletionRequest.athlete);
    }
    deletionRequest.status = "approved";
  } else {
    deletionRequest.status = "rejected";
  }

  deletionRequest.decisionNote = note?.trim() || undefined;
  deletionRequest.decidedBy = req.user.id;
  deletionRequest.decidedAt = new Date();

  await deletionRequest.save();
  await deletionRequest.populate([
    { path: "athlete", select: "firstName lastName licenseNumber" },
    { path: "requestedBy", select: "firstName lastName role" },
    { path: "decidedBy", select: "firstName lastName role" },
  ]);

  res.json({
    message:
      action === "approve"
        ? "Athlete deletion approved and completed"
        : "Athlete deletion request rejected",
    request: deletionRequest,
  });
});
